# Auditoría técnica: backend y frontend

## 1. Resumen ejecutivo

La aplicación es funcional y ya completó la migración de JSON local a PostgreSQL/Neon, manteniendo Yjs como fuente de verdad del grafo colaborativo. La arquitectura general es razonable para un MVP: autenticación JWT, ACL por diagrama, persistencia de snapshots Yjs, chat en PostgreSQL, generación de backend Spring Boot y frontend Next.js con React Flow.

Sin embargo, hay dos archivos que concentran demasiadas responsabilidades y varios riesgos que deben atenderse antes de seguir agregando funcionalidad:

- `backend/server.js` (727 líneas) mezcla bootstrap, WebSocket/Yjs, autenticación WS, CRUD de diagramas, rutas de IA, prompts, cliente Groq y generación ZIP.
- `frontend/src/app/diagram/[id]/page.tsx` (922 líneas) mezcla carga de datos, CRUD, roles, asociaciones, IA, XMI, persistencia y UI.

Los riesgos más importantes no son estéticos:

1. **Posible toma de propiedad de un diagrama sin ACL** por efecto secundario de `getOrCreateACL` en middleware de lectura/WS.
2. **Diagramas abiertos por enlace directo pueden no persistir su snapshot Yjs** si no existe la fila en `core.diagrams`.
3. **Generación concurrente de backends sobrescribe el mismo ZIP y borra todo el directorio de salida**.
4. **No hay validación runtime de entradas ni de mutaciones generadas por IA**.
5. **No hay cierre ordenado** ni flush garantizado de snapshots Yjs ante deploy/reinicio.
6. **El frontend silencia errores de API** y mantiene `any` extendido, por lo que TypeScript no protege los flujos críticos.

**Veredicto:** sí existen violaciones graves de SRP y riesgos de seguridad/consistencia. La refactorización debe ser incremental, empezando por los P0 funcionales y de seguridad, no por una reescritura completa.

> **Estado posterior:** la Fase 1 (P0) fue aprobada y aplicada. Este documento conserva el diagnóstico original; el anexo final resume las correcciones de seguridad, transacciones y concurrencia ya implementadas.

No se modificó código de producción durante la auditoría original. Las correcciones posteriores se detallan en el anexo.

---

## 2. Alcance y método

Auditoría estática sobre el working tree actual, sin commit, con lectura directa de:

- Backend: `server.js`, rutas, middleware, servicios, acceso a datos, configuración, generador y scripts.
- Frontend: página del editor, hooks, contextos, cliente API, componentes, utilidades Yjs/AST y configuración TypeScript/ESLint.
- Estado de Git y verificación local de build/typecheck/lint/sintaxis.

No se ejecutaron pruebas contra la base de datos de producción ni se enviaron datos a Groq. No se ejecutaron los tests legacy de `backend/tests`, porque están desactualizados respecto al backend PostgreSQL actual.

---

## 3. Baseline verificado

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` en `frontend/` | Pasa |
| `npm run build` en `frontend/` | Pasa; Next.js 16.3.3, TypeScript y generación de páginas correctos |
| `npm run lint` en `frontend/` | Falla: 154 problemas (144 errores, 10 warnings), preexistentes |
| `node --check` en 15 archivos backend | Pasa |
| Tests legacy `backend/tests/*.js` | Obsoletos; no ejecutados |
| Scripts de lint/typecheck/test en backend | No existen |

Distribución principal de lint:

| Archivo | Problemas |
|---|---:|
| `frontend/src/app/diagram/[id]/page.tsx` | 26 |
| `frontend/src/hooks/useCollaborativeFlow.ts` | 25 |
| `frontend/src/utils/yjsNodeHelpers.ts` | 20 |
| `frontend/src/utils/associationClass.ts` | 15 |
| `frontend/src/utils/yjsEdgeHelpers.ts` | 15 |
| `frontend/src/utils/ast.ts` | 13 |

La mayoría son `@typescript-eslint/no-explicit-any`; también hay errores de `react-hooks/set-state-in-effect` en paneles de edición.

`tsc` pasa porque `any` desactiva la comprobación efectiva de tipos en los flujos más grandes. Por tanto, el build correcto no demuestra que los contratos de datos estén protegidos.

---

## 4. Arquitectura observada

### Backend

```text
server.js
  ├─ configuración Express + CORS + JSON + uploads
  ├─ servidor HTTP + WebSocket Yjs
  ├─ autenticación de conexiones WS
  ├─ persistencia de snapshots Yjs
  ├─ CRUD inline de /api/diagrams/:id
  ├─ rutas IA inline (/api/ai/command, /transcribe, /from-image)
  ├─ cliente Groq + prompts + reparación de JSON
  ├─ generación de backend Spring Boot + descarga ZIP
  └─ bootstrap PostgreSQL

routes/
  ├─ auth.js      -> autenticación + respuestas
  ├─ acl.js       -> miembros/roles + enriquecimiento
  └─ diagrams.js  -> listado y creación

middleware/
  ├─ auth.js       -> JWT
  └─ diagramAuth.js -> ACL y roles

services/
  ├─ userService.js     -> SQL + dominio
  ├─ aclService.js      -> SQL + reglas ACL
  ├─ diagramService.js  -> SQL + snapshots Yjs + tarjetas
  └─ chatService.js     -> SQL + mensajes
```

No hay capa de repositorios, validadores, manejador central de errores ni módulo de configuración validado.

### Frontend

```text
app/diagram/[id]/page.tsx
  ├─ carga de diagrama y fallback localStorage
  ├─ creación/renombrado/eliminación
  ├─ permisos y gating de rol
  ├─ asociaciones, entidades, aristas, locks
  ├─ comandos IA, transcripción y generación desde imagen
  ├─ import/export XMI
  ├─ persistencia/estado de UI
  └─ composición de Toolbar, Sidebar, ChatPanel, ReactFlow

hooks/
  ├─ useCollaborativeFlow.ts -> Yjs + provider + presencia + chat + nodos/aristas + import/export
  ├─ useAICommand.ts         -> llamadas IA + resúmenes + locks
  ├─ useDiagramRole.ts       -> rol del diagrama
  └─ useNodeLocks.ts         -> locks visuales por awareness

components/
  ├─ presentacionales: ChatPanel, Toolbar, DiagramSelector, DiagramCard
  ├─ con lógica de API: MembersPanel
  └─ paneles de edición con `any` y efectos
```

Yjs es la fuente de verdad de nodos, aristas, chat y presencia; React Flow mantiene estado espejo para renderizar. Esa decisión es válida, pero la sincronización está concentrada en un hook demasiado grande.

---

## 5. Hallazgos backend

### 5.1 Prioridad P0

#### B-01. ACL con efecto secundario en lecturas y WS: posible toma de propiedad

**Severidad:** Crítica  
**Evidencia:** `backend/middleware/diagramAuth.js:21-37`, `43-65`, `72-88`; `backend/services/aclService.js:76-98`; `backend/server.js:106-171`.

`requireDiagramMember` y `requireDiagramRole` llaman a `getOrCreateACL` antes de validar permisos. Si un diagrama no tiene fila ACL, la primera petición autenticada crea una ACL con ese usuario como `OWNER`. Lo mismo ocurre al abrir un WebSocket.

Impacto: cualquier usuario autenticado que conozca o adivine un `diagramId` sin ACL puede reclamarlo. También convierte operaciones de lectura en escrituras.

Recomendación:

- Crear la ACL únicamente al crear el diagrama, dentro de la misma transacción.
- En lectura/WS, si no existe ACL, denegar o tratar como recurso inexistente.
- Para diagramas legacy sin ACL, hacer una migración explícita de propietario, no un auto-claim.

#### B-02. Creación de diagrama y ACL no atómica

**Severidad:** Alta  
**Evidencia:** `backend/routes/diagrams.js:27-35`, `40-41`; `backend/server.js:238-244`.

Se crea el diagrama y luego se crea la ACL en dos operaciones separadas. Si falla la segunda, queda un diagrama sin propietario; combinado con B-01, puede ser reclamado por otro usuario.

Recomendación: mover creación de diagrama + ACL a un servicio transaccional usando `withTransaction`.

#### B-03. Diagramas abiertos por enlace directo pueden no persistir snapshots

**Severidad:** Alta  
**Evidencia:** `backend/server.js:203-236` (`GET /api/diagrams/:id` devuelve fallback y no llama `ensureDiagram`); `backend/services/diagramService.js:123-137` (`saveSnapshot` solo actualiza filas existentes).

Si un usuario abre `/diagram/:id` para un id que no existe en `core.diagrams`, el GET responde con datos fallback, el WS crea la ACL y los snapshots Yjs se intentan guardar contra una fila inexistente. El `UPDATE` afecta 0 filas y el grafo no se persiste.

Recomendación: decidir el contrato. Opciones:

- Crear el diagrama de forma explícita y transaccional al abrir un id nuevo.
- O devolver 404 para ids inexistentes y crear solo desde el endpoint de creación.

No hacer `ensureDiagram` implícito sin ACL en un GET sin antes resolver B-01.

#### B-04. Generación concurrente: ZIP fijo y borrado del directorio de salida compartido

**Severidad:** Alta  
**Evidencia:** `backend/generator/generate.js:736-738`, `951-960`; `backend/server.js:514-528`.

Todas las peticiones escriben `backend/generator/output/generated-backend.zip`. Además, la limpieza usa `path.dirname(zipPath)`, que es todo `backend/generator/output`, no solo los archivos de esa petición.

Impacto: dos usuarios generando a la vez pueden descargar el proyecto del otro, sobrescribir archivos o perder salidas de peticiones concurrentes.

Recomendación:

- Crear un directorio temporal único por petición (`fs.mkdtemp`).
- Generar el ZIP dentro de ese directorio con nombre único.
- Limpiar únicamente ese directorio, en `finish`, `close` y ante error.
- Considerar un límite de generaciones concurrentes.

#### B-05. Sin cierre ordenado ni flush garantizado de Yjs

**Severidad:** Alta  
**Evidencia:** `backend/server.js:36-99` (timers de 2 s), `717-727` (bootstrap sin `SIGTERM`/`SIGINT`).

En deploy/reinicio, los snapshots pendientes pueden perderse. No se cierra el servidor HTTP, el pool PostgreSQL ni se hace flush de documentos Yjs.

Recomendación: manejador de `SIGTERM`/`SIGINT` que deje de aceptar conexiones, cierre WS, haga flush de snapshots pendientes, cierre el pool y termine con timeout de seguridad.

#### B-06. Sin validación de entradas ni de salidas de IA

**Severidad:** Alta  
**Evidencia:** `backend/server.js:342-347` y `393-395` (solo comprueban arrays/estado), `475-481`, `499-512`, `626-629`; no hay Zod/Joi/celebrate ni validadores propios.

No se valida:

- Forma y tamaño de `currentState`.
- Tipos de entidades, atributos, relaciones y posiciones.
- Acciones permitidas devueltas por la IA.
- Mutaciones antes de exponerlas al frontend.
- AST de `POST /api/generate` más allá de `entities.length`.

Impacto: datos corruptos, mutaciones no soportadas, errores 500, consumo de IA y posible abuso del prompt.

Recomendación: esquemas runtime para request/response, allowlist de acciones y validación de AST. Zod es una opción razonable; si se quiere evitar dependencia nueva, validadores manuales centralizados.

#### B-07. Errores sin capa central y mensajes internos expuestos

**Severidad:** Media-Alta  
**Evidencia:** `backend/routes/auth.js:43-53` (async sin `try/catch` en Express 4); `backend/server.js:463-466`, `499-500`, `626-629`; `backend/routes/diagrams.js:27-30`.

No hay middleware central de errores ni manejador 404 JSON. Varias rutas devuelven `err.message`, incluidos errores de proveedor. `GET /api/auth/me` puede dejar la petición colgada si falla la consulta.

Recomendación:

- `asyncHandler` o Express 5, `errorHandler` central y `notFoundHandler`.
- Errores públicos normalizados; log interno con contexto.
- No devolver mensajes de PostgreSQL/Groq al cliente.

### 5.2 Prioridad P1

#### B-08. Configuración dispersa y sin validación al arrancar

**Severidad:** Media  
**Evidencia:** `backend/loadEnv.js`; `backend/db.js:12-30`; `backend/middleware/auth.js:6-16`; `backend/middleware/diagramAuth.js:12-18`; `backend/server.js:24-25`, `279-280`; `backend/routes/auth.js:120-130`.

`process.env` se consulta en varios módulos. `AUTH_ENABLED` se interpreta en más de un lugar. `JWT_SECRET` se valida en la primera petición, no al arrancar. `CORS` está abierto a cualquier origen. No hay validación de variables requeridas ni `NODE_ENV`.

Recomendación: `config/env.js` que lea, valide y congele configuración al inicio; CORS configurable por allowlist; fallar rápido si falta `DATABASE_URL`/`JWT_SECRET` cuando auth está activo.

#### B-09. Sin rate limiting en autenticación ni en IA

**Severidad:** Media-Alta  
**Evidencia:** `backend/routes/auth.js`, `backend/server.js:342-347`, `381-407`, `423-466`; no hay middleware de límites.

Login/registro y endpoints de IA no tienen límites por IP/usuario. Los endpoints de IA consumen cuota de Groq y permiten imágenes/audio de hasta 10 MB.

Recomendación: rate limit por IP y usuario, límites de tamaño específicos y, si aplica, cuota por usuario. No confundir con la autenticación.

#### B-10. `server.js` es un god file y mezcla capas

**Severidad:** Alta (mantenibilidad)  
**Evidencia:** `backend/server.js:1-727`; CRUD inline en `203-276`, IA/generación en `342-533`, prompts/parseo en `536-715`.

No es solo “inicializa y monta rutas”: también contiene lógica de negocio, acceso a IA, generación de archivos y persistencia Yjs.

Recomendación incremental:

- `config/env.js`
- `app.js` (`createApp`)
- `routes/ai.js`, `routes/diagrams.js`
- `services/aiService.js`, `services/generationService.js`
- `realtime/yjs.js`
- `middleware/errorHandler.js`, `middleware/validate.js`
- `schemas/*.js`

No cambiar contratos HTTP en la extracción.

#### B-11. Servicios con SQL y dominio mezclados; sin repositorios

**Severidad:** Media  
**Evidencia:** `backend/services/userService.js`, `aclService.js`, `diagramService.js`, `chatService.js`; `backend/services/chatService.js:3` importa `safeId` desde `diagramService.js`.

No hay capa de acceso a datos separada. Los servicios ejecutan SQL, aplican reglas y mapean respuestas. `chatService` depende de un helper de otro servicio.

Impacto: difícil test unitario y acoplamiento entre dominios.

Recomendación: extraer repositorios solo donde aporte valor inmediato (`aclRepository`, `chatRepository`, `diagramRepository`), manteniendo los servicios como fachada. No es necesario convertir todo a repositorios en una sola iteración.

#### B-12. Consulta N+1 al listar miembros

**Severidad:** Baja-Media  
**Evidencia:** `backend/routes/acl.js:30-57`.

Por cada miembro se ejecuta una consulta de usuario. Con muchos miembros, el listado degrada.

Recomendación: una consulta con `JOIN`/`ANY($1)` y mapear en memoria.

#### B-13. Persistencia Yjs en memoria por instancia

**Severidad:** Media (escalabilidad)  
**Evidencia:** `backend/server.js:42-56`, `106-171`.

Los documentos Yjs viven en memoria de una instancia. Con varias réplicas, clientes conectados a instancias distintas no comparten cambios en tiempo real.

Recomendación: documentar la limitación de una sola instancia o añadir un adaptador compartido (por ejemplo, persistencia/redis) antes de escalar horizontalmente.

#### B-14. `/health` no comprueba PostgreSQL ni readiness

**Severidad:** Media  
**Evidencia:** `backend/server.js:93-94`; arranque en `717-727`.

Siempre responde OK aunque la base esté caída. No distingue liveness de readiness.

Recomendación: `/health` ligero y `/ready` con `SELECT 1` y timeout.

#### B-15. Esquema de base de datos no versionado en el repositorio

**Severidad:** Alta (reproducibilidad)  
**Evidencia:** no hay migraciones SQL de la aplicación; `backend/db.js` solo verifica conexión; el esquema `auth/core/chat` se administra fuera del repo.

Impacto: no se puede reconstruir el entorno desde cero de forma fiable; los cambios de esquema dependen de pasos manuales.

Recomendación: migraciones versionadas (SQL simple o herramienta como `node-pg-migrate`) y un comando documentado de bootstrap.

#### B-16. Llamadas a IA sin timeout/retry y endpoint hardcodeado

**Severidad:** Media  
**Evidencia:** `backend/server.js:279-280` define base de Groq; `backend/server.js:444-456` usa URL fija; llamadas sin `AbortController`.

Una llamada lenta puede retener una petición indefinidamente. La configuración de URL no es consistente.

Recomendación: cliente único de Groq con base URL configurable, timeout, abort y política de reintentos limitada.

#### B-17. Generación Spring Boot bloqueante y sin límites

**Severidad:** Media  
**Evidencia:** `backend/generator/generate.js:755-758` y escrituras síncronas múltiples; no hay cola ni límite.

La generación usa `fs` síncrono y puede bloquear el event loop con modelos grandes.

Recomendación: medir primero; si es necesario, mover a `fs/promises` y limitar concurrencia/tamaño. No introducir una cola sin métricas.

### 5.3 Prioridad P2

#### B-18. Contrato de `GET /api/diagrams/:id` confuso

**Severidad:** Baja  
**Evidencia:** `backend/server.js:222-235`; `backend/services/diagramService.js:33-44`, `46-67`.

El endpoint devuelve `nodes: []`/`edges: []` aunque el grafo real está en Yjs. Además, el listado decodifica cada snapshot para construir tarjetas.

Recomendación: documentar el contrato o separar metadatos de grafo. Evitar decodificar snapshots en listados si solo se necesitan metadatos.

#### B-19. Sin heartbeat/límites/origen en WebSocket

**Severidad:** Media  
**Evidencia:** `backend/server.js:106-171`; configuración WS en `23-28`.

No hay heartbeat, límite de payload, validación de origen ni máximo de conexiones por usuario/diagrama.

Recomendación: añadir heartbeat y límites; validar `Origin` en producción.

#### B-20. Autenticación endurecible

**Severidad:** Baja-Media  
**Evidencia:** `backend/routes/auth.js`, `backend/middleware/auth.js:47-58`.

JWT sin `issuer`/`audience` explícitos, sin revocación, sin algoritmo fijado en verificación y sin rate limit específico. Política de password básica.

Recomendación: fijar algoritmo, `issuer`/`audience`, limitar intentos y documentar la política de contraseñas. No es urgente si el despliegue es interno, pero debe quedar explícito.

---

## 6. Hallazgos frontend

### 6.1 Prioridad P0/P1

#### F-01. `page.tsx` es un god component

**Severidad:** Alta  
**Evidencia:** `frontend/src/app/diagram/[id]/page.tsx:1-922`.

Responsabilidades mezcladas:

- Carga de diagramas y fallback localStorage (`104-183`).
- Creación, borrado y renombrado (`199-242`).
- Carga del grafo (`271-288`).
- IA (`293-312`).
- Drag & drop (`316-350`).
- Entidades, aristas, asociaciones, XMI (`399-630`).
- Composición de UI (`632-888`).

Recomendación: extraer hooks/controladores:

- `useDiagramCatalog`
- `useDiagramActions`
- `useDiagramCanvasActions`
- `useDiagramExport`
- `useDiagramAI`
- `DiagramEditorLayout`

La página debe quedar como composición y paso de props de alto nivel.

#### F-02. `useCollaborativeFlow` mezcla demasiadas responsabilidades y silencia errores

**Severidad:** Alta  
**Evidencia:** `frontend/src/hooks/useCollaborativeFlow.ts:1-477`; `any` en `64-65`, `82-83`, `119-132`, `206-225`, `259-337`, `357-370`, `381-408`.

Mezcla conexión Yjs, provider, presencia, locks, nodos, aristas, chat e import/export. Varios `catch {}` ocultan fallos. El error de autenticación/cierre del WS no se comunica al usuario.

Recomendación: separar en:

- `useYjsConnection`
- `usePresence`
- `useCollaborativeGraph`
- `useCollaborativeChat`

Mantener una única instancia de `Y.Doc`/provider y pasar el contexto a los hooks.

#### F-03. `API_BASE` duplicado y configuración no centralizada

**Severidad:** Media  
**Evidencia:** `frontend/src/lib/apiClient.ts:2-3`; `page.tsx:64`; `useAICommand.ts:12`; `useCollaborativeFlow.ts:101`.

La misma lógica se repite y el WS usa otra variable. Un cambio de entorno puede dejar partes apuntando a hosts distintos.

Recomendación: `frontend/src/config.ts` con `API_BASE`, `WS_URL` y validación básica.

#### F-04. Lógica de API/negocio dentro de componentes

**Severidad:** Media  
**Evidencia:** `frontend/src/components/MembersPanel.tsx:37-114`; `frontend/src/app/dashboard/page.tsx:44-80`.

`MembersPanel` hace fetch, mutaciones y manejo de estado; el dashboard hace carga/creación. No son componentes presentacionales.

Recomendación: `useDiagramMembers` y `useDiagramCatalog`; componentes solo renderizan y emiten eventos.

#### F-05. `any` extendido y mutaciones sin validación runtime

**Severidad:** Alta (type-safety)  
**Evidencia:** `frontend/src/utils/ast.ts:194-317`; `useAICommand.ts:22-35`, `44`, `86-151`, `158-244`, `246-292`; `yjsNodeHelpers.ts`, `yjsEdgeHelpers.ts`, `associationClass.ts`.

`applyMutations` acepta `any[]` y `hooks: any`; las mutaciones de IA se aplican sin comprobar forma. `tsc` pasa porque `any` evita el análisis.

Recomendación: tipos discriminados para mutaciones, validadores runtime y eliminar `any` en los flujos críticos antes de limpiar el resto del lint.

#### F-06. Errores de API silenciados en operaciones del diagrama

**Severidad:** Media  
**Evidencia:** `page.tsx:207-242`, `274-288`, `558-570`; `MembersPanel` también ignora fallos en varios caminos.

Crear, renombrar y borrar actualizan la UI de forma optimista aunque la API falle. El usuario puede ver un estado que no existe en el servidor.

Recomendación: manejar error, revertir estado o mostrar feedback; no usar `.catch(() => {})` en operaciones de datos.

#### F-07. Refs mutados durante render y estado duplicado

**Severidad:** Media  
**Evidencia:** `useCollaborativeFlow.ts:79-88`, `useAICommand.ts:63`.

`userRef`, `nodesRef`, `edgesRef`, `optionsRef` se asignan durante el render. En React 19 esto es riesgoso con render concurrente y contribuye a los errores de lint.

Recomendación: actualizar refs en `useEffect` o usar `useEffectEvent`/callbacks estables. Mantener React Flow como espejo explícito de Yjs con una única dirección de actualización.

#### F-08. Errores de WebSocket y edición offline no visibles

**Severidad:** Media  
**Evidencia:** `useCollaborativeFlow.ts:119-132`, `206-225`.

Si el WS falla por auth o se cae, el usuario puede seguir editando en memoria sin recibir una advertencia clara; al cerrar la página puede perder cambios.

Recomendación: exponer estado `connected/reconnecting/unauthorized` y deshabilitar o marcar edición cuando no haya sincronización.

#### F-09. Baseline de lint roto

**Severidad:** Media  
**Evidencia:** `npm run lint` con 154 problemas.

No se puede usar lint como red de seguridad para la refactorización.

Recomendación: no mezclar la limpieza total con el refactor funcional. Primero impedir nuevos errores y limpiar por archivo a medida que se extraen hooks.

### 6.2 Prioridad P2

#### F-10. Posible “modo abierto” si falla `/auth/status`

**Severidad:** Media-Baja  
**Evidencia:** `frontend/src/contexts/AuthContext.tsx:34-66`.

Si la consulta de estado falla por red, el frontend puede quedar con `authEnabled = false` y mostrar la UI como modo abierto, aunque el backend siga exigiendo auth. No es un bypass del backend, pero confunde y puede exponer acciones que luego fallan.

Recomendación: distinguir “auth deshabilitada” de “no se pudo comprobar”; mostrar error de conexión.

#### F-11. Prop drilling y props excesivas

**Severidad:** Baja  
**Evidencia:** `page.tsx:632-888`; `Toolbar` y `ChatPanel` reciben muchas props.

No es un error funcional, pero agrava el tamaño de la página.

Recomendación: evaluar un `DiagramEditorContext` después de extraer los hooks; no crear contexto global innecesario.

#### F-12. Sin error boundary del editor

**Severidad:** Baja  
**Evidencia:** no hay `error.tsx`/error boundary específico para el editor.

Un error de render puede tumbar toda la ruta.

Recomendación: `app/diagram/[id]/error.tsx` con recuperación y reporte básico.

---

## 7. Respuestas directas a las preguntas de auditoría

### Backend

**¿`server.js` solo inicializa/monta rutas o también tiene lógica de negocio?**  
No. Tiene lógica de negocio, persistencia Yjs, autenticación WS, rutas IA, prompts, cliente Groq y generación ZIP.

**¿Hay lógica de negocio en rutas que debería estar en servicios?**  
Sí. `routes/auth.js` y `routes/acl.js` contienen reglas y transformaciones; `routes/diagrams.js` crea diagrama + ACL fuera de una transacción.

**¿Se mezclan servicios con acceso a datos?**  
Sí. Los servicios ejecutan SQL, aplican reglas y mapean resultados. No existe capa de repositorios.

**¿Se valida la entrada con Zod/Joi u otra librería antes de DB/IA?**  
No. Hay validaciones manuales parciales, pero no esquemas runtime ni validación de respuestas de IA.

**¿Hay manejo centralizado de errores?**  
No. Cada ruta maneja errores de forma distinta, algunas no los manejan, y se filtran mensajes internos.

### Frontend

**¿`page.tsx` es demasiado grande?**  
Sí: 922 líneas y múltiples responsabilidades.

**¿`useCollaborativeFlow` mezcla Yjs, chat, nodos, edges y presencia?**  
Sí. Es el segundo god file del frontend.

**¿Hay lógica de API/negocio en componentes que debería estar en hooks?**  
Sí, especialmente `MembersPanel` y `dashboard/page.tsx`.

**¿Se duplica `API_BASE`?**  
Sí, en al menos tres archivos, más una variable separada para WebSocket.

**¿Hay context/useState duplicado o estado innecesario?**  
`AuthContext` está bien delimitado. El problema principal es el estado espejo React Flow/Yjs y refs mutados durante render, no un contexto global duplicado. También hay duplicación entre el id de ruta y `currentDiagramId`.

**¿Se usa `strict` de TypeScript y se evita `any`?**  
`strict: true`, pero se usa `any` extensamente; por eso `tsc` pasa sin proteger los flujos críticos.

---

## 8. Plan de refactorización incremental

La regla es no cambiar comportamiento y contratos en la misma iteración que se mueve código. Cada fase debe dejar build y typecheck en verde.

### Fase 0. Congelar baseline y agregar red de seguridad

- Mantener `npm run build` y `npx tsc --noEmit` como verificación obligatoria.
- Añadir smoke tests manuales/documentados para:
  - login/registro;
  - abrir diagrama, editar nodo/arista, recargar y comprobar persistencia;
  - chat y presencia con dos pestañas;
  - viewer sin permisos de edición;
  - comando IA;
  - generación/descarga ZIP.
- No intentar limpiar los 154 problemas de lint todavía.

### Fase 1. Correcciones P0 sin reestructurar todo

1. Corregir semántica ACL:
   - crear ACL solo en creación o migración explícita;
   - lectura/WS sin ACL debe denegar;
   - diagrama + ACL en una transacción.
2. Resolver el contrato de ids inexistentes y persistencia de snapshots.
3. Hacer la generación concurrente segura con directorio temporal por petición.
4. Añadir cierre ordenado con flush de Yjs.
5. Añadir validación runtime mínima para IA y generación.
6. Añadir manejador central de errores y `asyncHandler`.

Cada punto debe ser un cambio pequeño y verificable, no un big bang.

### Fase 2. Extracción backend

Orden recomendado:

1. `config/env.js` con validación al arranque.
2. `middleware/errorHandler.js` y `middleware/notFound.js`.
3. `routes/ai.js` + `services/aiService.js` (mover sin cambiar respuestas).
4. `routes/diagrams.js` con todo el CRUD, o `diagramController` si se prefiere.
5. `realtime/yjs.js` para provider, persistencia y auth WS.
6. `app.js` con `createApp` y `server.js` como bootstrap delgado.
7. `validators/` o `schemas/` para requests/responses.

### Fase 3. Frontend: datos y hooks

1. `config.ts` para API/WS.
2. `api/diagrams.ts`, `api/ai.ts`, `api/members.ts` para centralizar fetch.
3. Extraer `useDiagramCatalog`, `useDiagramActions`, `useDiagramMembers`.
4. Extraer de `page.tsx` la lógica de asociaciones, XMI e IA.
5. Dividir `useCollaborativeFlow` en conexión, grafo, presencia y chat.
6. Introducir tipos discriminados para mutaciones y eliminar `any` en esos flujos.

### Fase 4. Persistencia y pruebas

- Evaluar repositorios para `acl`, `chat` y `diagram` después de tener tests.
- Añadir migraciones SQL versionadas.
- Añadir tests de integración del backend y pruebas de contrato del frontend.
- Añadir rate limiting y hardening de configuración.

### Fase 5. Limpieza de lint y documentación

- Limpiar `any` restante por archivo.
- Corregir `react-hooks/set-state-in-effect`.
- Actualizar README/AGENTS con comandos de verificación.
- Documentar la limitación de una sola instancia Yjs o el adaptador compartido.

---

## 9. Criterios de aceptación de la refactorización

- `npm run build` pasa.
- `npx tsc --noEmit` pasa.
- No se introducen nuevos errores de lint; idealmente se reduce el baseline.
- El backend mantiene los contratos HTTP existentes, salvo cambios de seguridad documentados.
- Dos pestañas siguen sincronizando nodos, aristas, chat y presencia.
- Los snapshots sobreviven a recarga y reinicio.
- Un usuario viewer no puede editar ni mutar el grafo.
- Un diagrama sin ACL no puede ser reclamado por un usuario cualquiera.
- La generación concurrente no mezcla ZIPs ni borra salidas ajenas.
- No se exponen secretos ni mensajes internos de base de datos/proveedor.

---

## 10. Decisiones que requieren aprobación

1. **Diagramas legacy sin ACL:** ¿migrar propietario explícito o permitir un flujo de reclamo controlado?
2. **Validación:** ¿agregar `zod` o mantener validadores manuales sin dependencias nuevas?
3. **Repositorios:** ¿introducirlos ahora o después de tests, empezando solo por ACL/chat?
4. **Lint:** ¿limpiar los 154 problemas como parte del refactor o solo evitar nuevos?
5. **Tests/CI:** ¿añadir pruebas automatizadas y pipeline antes de las fases 2-3?

Recomendación: aprobar Fase 1 y Fase 2 en ese orden; posponer repositorios y limpieza masiva de lint hasta tener una red de seguridad.

---

## Anexo: Fase 1 (P0) aplicada

Se corrigieron los siguientes hallazgos:

| Hallazgo | Estado | Cambio |
|---|---|---|
| B-01 ACL con efecto secundario | Corregido | Middleware y WS solo leen rol; no crean ACL |
| B-02 Creación diagrama + ACL no atómica | Corregido | `createDiagramWithOwner` y `createDiagramWithOwnerIfAbsent` en transacción |
| B-03 Enlaces directos sin persistencia | Mitigado | GET devuelve 404; el frontend crea el primer diagrama antes de abrir el WS |
| B-04 Generación concurrente insegura | Corregido | `mkdtempSync` y ZIP dentro del directorio único de la petición |
| B-05 Sin cierre ordenado | Corregido | `SIGTERM`/`SIGINT` con flush, cierre de WS y pool |
| B-06 Sin validación de IA/entradas | Corregido | `backend/validation.js`, allowlist de mutaciones y límites |
| B-07 Errores internos expuestos | Mitigado | Respuestas genéricas en auth, ACL, IA y diagramas |
| B-08 Configuración dispersa | Pendiente | Fase 2 |
| B-09 Rate limiting | Pendiente | Fase posterior |
| B-10 `server.js` god file | Pendiente | Fase 2 |
| B-11 Repositorios | Pendiente | Fase 4 |

También se corrigió la condición de carrera de Yjs: el socket se pausa, se valida ACL/Diagrama, se espera `readyPromise` del snapshot y solo entonces se ejecuta `setupWSConnection`. `writeState` espera a `readyPromise` y `bindState` espera escrituras finales pendientes.

**Verificación:** `npm run build` y `npx tsc --noEmit` pasan; `node --check` pasa en 15 archivos backend; los validadores y dos generaciones concurrentes fueron probados; `npm run lint` conserva 154 problemas preexistentes.

## Anexo: Fase 2 aplicada

Se separó la arquitectura sin cambiar contratos:

- `server.js` quedó como bootstrap de 59 líneas.
- `app.js` compone Express, CORS, JSON, salud y rutas.
- `realtime/yjs.js` encapsula WebSocket, ACL WS, snapshots y chat.
- `routes/diagrams.js` y `routes/ai.js` concentran los endpoints.
- `services/aiService.js` contiene prompts y cliente Groq.
- `errors.js` + `middleware/errorHandler.js` eliminan `try/catch` repetidos y unifican errores.
- `MembersPanel` delega datos en `hooks/useDiagramMembers.ts`; `ChatPanel` y `Toolbar` siguen sin API propia.

Verificación: `node --check` en 22 archivos, `npx tsc --noEmit`, `npm run build`, smoke de `/health`, `/ready`, 404 JSON, 400/401; lint de 154 a 150 problemas preexistentes.
