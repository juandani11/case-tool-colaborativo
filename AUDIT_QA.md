# Auditoría de Robustez, Casos Borde y Claridad — QA/UX

**Fecha:** 2026-11-01  
**Alcance:** Agente Tutor IA y editor UML/React Flow.  
**Método:** inspección de código, pruebas de validadores, prueba del prompt contra un mock HTTP local y prueba de helpers Yjs con `Y.Doc` real. No se invocó Groq real durante la auditoría para evitar consumo externo; las pruebas del prompt se hicieron sobre el cuerpo enviado al proveedor.

---

## 1. Matriz de pruebas — Agente Tutor IA

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Pregunta teórica sin selección | Respuesta general, clara y pedagógica | El prompt indica “no tiene ningún elemento seleccionado” y pide responder de forma general | PASS |
| Clase seleccionada + “bórrala” | Resolver el pronombre contra `selectedElement` y ejecutar `removeEntity` | El prompt incorpora el nombre y la metadata del elemento y ordena resolver referencias con `selectedElement` | PASS |
| Comando ambiguo “hazlo más grande” | Pedir aclaración sin inventar mutaciones | Regla explícita de intención ambigua: `mutations: []` y solicitud de aclaración | PASS |
| Historial vacío | Usar contexto vacío sin fallar | Plantilla `formatChatHistory` y fallback `(sin mensajes previos)` | PASS |
| `selectedElement` nulo por error de red | Responder de forma general sin romper | `validation.js` acepta `null`; el prompt indica que no hay selección | PASS |
| Pregunta fuera de contexto | Redirigir al diseño UML sin responder el tema ajeno | Regla explícita para consultas no relacionadas con UML, diagramas, bases de datos o el proyecto | PASS |
| Elemento seleccionado debe mencionarse siempre | Incluir el nombre exacto del elemento como ejemplo | Regla explícita de tutoría contextual y JSON del elemento en el prompt | PASS |
| Acción con explicación didáctica | Confirmar la acción y explicar el concepto UML aplicado | Regla explícita con ejemplo de herencia | PASS |
| Duplicado de entidad por IA | Evitar `addEntity` si el nombre ya existe | Regla explícita: usar `addAttribute` si la entidad ya existe | PASS |
| Metadata de clase enviada al backend | Incluir nombre, estereotipo, atributos y métodos | `SelectedElementContext` se construye en `page.tsx` y se valida en `validation.js` | PASS |
| Metadata de relación enviada al backend | Incluir tipo, entidades conectadas y cardinalidades | `page.tsx` construye `source`, `target`, `type` y cardinalidades; el backend valida el tipo | PASS |
| Tipo de relación inválido en `selectedElement` | Rechazar la metadata inválida sin romper el comando | `validateSelectedElement` devuelve error de validación | PASS |

### Evidencia de la prueba del prompt

Se levantó un servidor HTTP local que interceptó la solicitud a Groq y capturó el `systemPrompt`. Resultados:

- Con `selectedElement` de la clase `Usuario`: el prompt contenía `FOCO DE ATENCIÓN DEL USUARIO`, el nombre `Usuario` y `REGLAS DE TUTORÍA CONTEXTUAL`.
- Sin `selectedElement`: el prompt contenía “no tiene ningún elemento seleccionado”.
- La respuesta del mock fue procesada correctamente como `{ response, mutations: [] }`.

---

## 2. Matriz de pruebas — Editor UML

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Crear clase con nombre vacío | Asignar nombre por defecto o impedir guardar vacío | `EntityEditorPanel` normaliza a `NuevaClase` o `NuevaInterfaz`; `EntityNode` muestra `SinNombre` si el dato legado está vacío | PASS (corregido) |
| Dos clases con el mismo nombre | Advertir o permitir diferenciando por ID | Se muestra advertencia ámbar en el panel; se permite guardar porque React Flow usa IDs | PASS (corregido) |
| Varias relaciones entre las mismas dos clases | Permitir múltiples aristas con IDs únicos | Se probaron dos aristas con el mismo par `n1 -> n2`; ambas se conservaron | PASS con observación: pueden superponerse visualmente |
| Self-loop por clic en modo conexión | Crear una arista `selfloop` visible | El flujo de clic ya asignaba `type: 'selfloop'` | PASS |
| Self-loop por arrastre entre handles | No crear una asociación visualmente inválida | Se corrigió `handleOnConnect` para detectar `source === target` y asignar `selfloop` | PASS (corregido) |
| Eliminar clase con relaciones | Eliminar también sus aristas incidentes | `yRemoveNode` elimina las aristas `source/target`; prueba: quedó 1 nodo y 0 aristas | PASS |
| Persistencia exacta de posiciones | Recuperar `x`, `y` del snapshot tras recargar | `createNodeMap` guarda `position.x/y`; prueba Yjs recuperó `[n1, 11, 22]` y `[n2, 33, 44]` | PASS |
| Recarga de relaciones | Conservar tipo y extremos de cada arista | `edgesToArray` recuperó aristas `association` y `selfloop` con sus extremos | PASS |

### Evidencia de la prueba Yjs

Se transpilaron y ejecutaron `yjsNodeHelpers.ts` e `yjsEdgeHelpers.ts` con un `Y.Doc` real:

```text
positions [ [ 'n1', 11, 22 ], [ 'n2', 33, 44 ] ]
edges [
  [ 'e1', 'association', 'n1', 'n2' ],
  [ 'e2', 'association', 'n1', 'n2' ],
  [ 'e3', 'selfloop', 'n1', 'n1' ]
]
after-delete 1 0
```

Esto verifica posiciones, múltiples aristas, self-loop y borrado en cascada.

---

## 3. Correcciones aplicadas

| Archivo | Corrección |
|---|---|
| `backend/services/aiService.js` | Reglas de foco contextual, referencias, explicación didáctica, redirección fuera de contexto y prevención de entidades duplicadas |
| `backend/validation.js` | Validación y saneamiento de `selectedElement` para nodos y aristas |
| `backend/routes/ai.js` | Propagación de `selectedElement` al servicio de IA |
| `frontend/src/types/diagram.ts` | Contrato `SelectedElementContext` |
| `frontend/src/hooks/useAICommand.ts` | Envío opcional de `selectedElement` |
| `frontend/src/app/diagram/[id]/page.tsx` | Construcción de metadata de selección, self-loop por arrastre, advertencia de nombre duplicado y paso al editor |
| `frontend/src/components/EntityEditorPanel.tsx` | Normalización de nombre vacío y advertencia de duplicado |
| `frontend/src/components/EntityNode.tsx` | Fallback visual `SinNombre` |

---

## 4. Verificación técnica

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `node --check` en `aiService.js`, `validation.js`, `routes/ai.js` | PASS |
| Validador de `selectedElement` con nodo, arista y tipo inválido | PASS |
| Prompt con y sin selección mediante mock HTTP | PASS |
| Helpers Yjs: posiciones, múltiples aristas, self-loop y borrado en cascada | PASS |
| ESLint | 148 problemas preexistentes (140 errores, 8 warnings); sin regresiones nuevas detectadas |

---

## 5. Riesgos residuales

1. **Groq no fue invocado en vivo durante la auditoría.** Las reglas se verificaron en el prompt enviado, no en la variabilidad de la respuesta del modelo.
2. **Aristas paralelas:** React Flow las conserva, pero dos aristas entre el mismo par pueden superponerse visualmente. No producen corrupción de datos.
3. **Nombres duplicados:** se advierten, pero se permiten. La IA recibe una regla para evitar duplicados; el generador sanea colisiones de nombres.
4. **Pruebas de navegador:** no se ejecutó automatización E2E; la verificación del editor fue por código y por pruebas de los helpers Yjs.
5. **Persistencia real:** la prueba de posiciones se hizo sobre Yjs y la serialización; la recarga completa contra Neon se validó previamente en las pruebas de integración.

**Veredicto:** el sistema queda robusto para la demostración. Los casos borde identificados fueron corregidos y las verificaciones de compilación, validación de prompt, Yjs y snapshot están en verde.
