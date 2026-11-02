# Auditoría QA Integral — Módulos Restantes

**Fecha:** 2026-11-01  
**Alcance:** Autenticación/JWT, ACL, colaboración Yjs, generación Spring Boot e importación/exportación.  
**Método:** pruebas de servicios contra PostgreSQL/Neon en modo lectura, pruebas HTTP con JWT firmado, pruebas de helpers Yjs con `Y.Doc` real, generación y descompresión lógica de un proyecto Spring Boot, y pruebas puras del exportador XMI.

---

## 1. Autenticación y seguridad JWT

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Registro con email existente | `400` con mensaje claro y sin escritura | `400 Email ya existe`; la comprobación ocurre antes del `INSERT` | PASS |
| Campos vacíos | `400` antes de la base | `400 Username muy corto (mínimo 3 caracteres)` | PASS |
| Contraseña débil | `400` antes de la base | `400 Password muy corta (mínimo 6 caracteres)` | PASS |
| JWT expone `password_hash` | No incluye el hash | El token solo firma `{ userId, username }` | PASS |
| `/api/auth/me` sin token | `401` | `401` | PASS |
| `/api/auth/me` con token válido | Devuelve usuario sin hash | `200`; la respuesta no contiene `password_hash` | PASS |
| Duplicado concurrente | No crear dos usuarios | Restricción única y manejo de `23505` | PASS por diseño |

---

## 2. Control de acceso ACL

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| EDITOR intenta `DELETE /api/diagrams/:id` | `403` aunque llame directo a la API | `403` con `requireDiagramRole('OWNER')` | PASS |
| VIEWER intenta escritura | `403` en POST/PUT/DELETE | `requireDiagramWrite` exige `OWNER` o `EDITOR`; VIEWER queda fuera | PASS por middleware |
| Usuario ajeno abre `/diagram/id-ajeno` | `403` en REST y cierre WS | `403` en `GET`; WebSocket cierra `4403` | PASS |
| Diagrama inexistente en WS | Cierre controlado | Cierre `4404` | PASS |
| OWNER elimina diagrama | ACL y snapshot eliminados | Prueba temporal: antes `OWNER`, después `diagram=false` y `role=NONE` | PASS |
| ACL huérfana | No debe quedar | `deleteDiagram` elimina ACL y diagrama en una transacción | PASS |
| Datos temporales de prueba | No deben persistir | Verificación posterior: 0 diagramas y 0 ACL `qa-audit-%` | PASS |

**Evidencia HTTP:**

```text
me-no-token 401
me-editor 200 true
editor-read 200
editor-delete 403
stranger-read 403 {"error":"No tienes acceso a este diagrama"}
```

---

## 3. Colaboración Yjs / WebSocket

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Dos clientes editan el mismo nodo simultáneamente | Convergencia y JSON válido | Ambos documentos convergieron al mismo JSON; la metadata final fue parseable | PASS |
| Atributos concurrentes | No corromper el nodo | El resultado conservó una estructura válida de atributos y posición | PASS con observación: conflictos sobre el mismo campo usan last-write-wins |
| Reconexión tras caída | Recibir snapshot y re-sincronizar | `WebsocketProvider` reconecta y el servidor carga el snapshot antes de `setupWSConnection` | PASS por diseño; no se simuló una caída de red real |
| Chat de A visible para B | Autor real, no “Anónimo” para usuario autenticado | `addMessage` usa `userRef.current.username`; el backend conserva el autor en Yjs/PostgreSQL | PASS por código |
| Escritura antes del snapshot | No permitir cambios sobre documento vacío | `ws.pause()` + `readyPromise` + `setupWSConnection` | PASS |

---

## 4. Generador de backend Spring Boot

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Diagrama vacío | Rechazar con `400` | `validateAstState(..., { requireEntities: true })` rechazó el AST vacío | PASS |
| Relación N:M | Generar tabla intermedia | Se generó `cliente_producto` con FKs a `cliente` y `producto` | PASS |
| Clases asociativas | Preservar la entidad intermedia | El generador usa la expansión N:M y los nombres de la clase asociativa | PASS por generador |
| ZIP mínimo | Incluir `pom.xml`, `application.properties` y 4 capas | Se verificaron `pom.xml`, properties, controller, service, repository y model | PASS |
| Concurrencia de generación | ZIPs aislados | Directorio temporal único por petición | PASS |

**Evidencia de generación:**

```text
empty-rejected true
pom true
properties true
controller true
service true
repository true
model true
join-table true
```

---

## 5. Importación y exportación JSON/XMI

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| JSON corrupto | Error visible y grafo intacto | Se valida el JSON antes de `yn.clear()`; si falta estructura se aborta sin limpiar | PASS |
| JSON con nodos sin posición | Rechazar sin corromper | Se exige `id`, `position.x`, `position.y` y `data` | PASS |
| JSON con aristas a nodos inexistentes | Rechazar sin corromper | Se validan extremos contra IDs de nodos | PASS |
| JSON con IDs duplicados | Rechazar | Se detectan IDs duplicados de nodos y aristas | PASS |
| XMI inválido | Alerta sin colapsar la pantalla | El importador detecta `parsererror`; la página captura el rechazo de la promesa | PASS |
| Exportar XMI con etiquetas duplicadas | IDs únicos y estables | Se probaron dos clases “Usuario”: `entity_1` y `entity_2` se exportaron con IDs distintos | PASS |
| Exportar relaciones XMI | Conservar IDs originales de nodos/aristas | Asociación exportada como `Ass_edge_1`, con referencias a `entity_1` y `entity_2` | PASS (corregido) |

**Corrección aplicada:** `xmiExporter.ts` usaba el nombre de la clase para construir `xmi:id`. Ahora usa `node.id` y `edge.id` saneados, por lo que dos clases con el mismo nombre no colisionan y las relaciones conservan la identidad del editor.

---

## 6. Correcciones aplicadas

| Archivo | Corrección |
|---|---|
| `frontend/src/hooks/useCollaborativeFlow.ts` | Validación completa de JSON antes de limpiar Yjs; rechazo de nodos/aristas malformados y IDs duplicados |
| `frontend/src/utils/xmiExporter.ts` | IDs XMI estables basados en `node.id` y `edge.id`; soporte para nombres duplicados |
| `frontend/src/app/diagram/[id]/page.tsx` | Captura del rechazo de `importFromXmi` para evitar promesas no manejadas |
| `backend/services/aiService.js` | Reglas de tutoría contextual y prevención de entidades duplicadas |
| `backend/validation.js` | Validación de `selectedElement` |
| `frontend/src/components/EntityEditorPanel.tsx` | Normalización de nombre vacío y advertencia de duplicados |
| `frontend/src/components/EntityNode.tsx` | Fallback visual `SinNombre` |

---

## 7. Verificación técnica

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `node --check` en 22 archivos backend | PASS |
| Pruebas HTTP de auth y ACL | PASS |
| Prueba de cascada de borrado | PASS |
| Prueba Yjs de concurrencia, posiciones y self-loop | PASS |
| Prueba de generación Spring Boot y tabla N:M | PASS |
| Prueba de IDs XMI | PASS |
| ESLint | 145 problemas preexistentes (138 errores, 7 warnings); sin regresiones nuevas |

---

## 8. Riesgos residuales

1. **Reconexión WebSocket:** no se simuló una caída de red real; la garantía se apoya en `y-websocket` y en la carga previa del snapshot en el servidor.
2. **Chat autor:** no se ejecutó una prueba E2E de dos navegadores; se verificó el flujo de autor en el código de `useCollaborativeFlow` y en la emisión del backend.
3. **Conflicto sobre el mismo campo:** Yjs converge sin corromper el JSON, pero el último valor escrito gana en campos compuestos reemplazados.
4. **Groq real:** no se invocó el proveedor; las reglas del tutor se validaron sobre el prompt construido.
5. **Importación XMI:** se validó por código y por el exportador; no se dispone de un archivo EA real en la suite automatizada.

**Veredicto:** los módulos auditados cumplen los casos borde críticos para la demostración. Las correcciones eliminan la pérdida de datos por importación inválida y la colisión de IDs XMI; autenticación, ACL, generación y cascada de borrado quedaron verificadas.
