# CASE-Tool — Arquitectura y Flujos End-to-End

> Documento de ingeniería: qué hace cada flujo, qué archivos lo implementan y **por qué** existen esos archivos / librerías.
> Alcance: `frontend/` (Next.js 16 + React 19), `backend/` (Express + y-websocket + generador Handlebars), `mobile/` (stub).
> Fecha: 2026-09-23.

---

## 1. Visión de arquitectura

```
┌──────────────────────── FRONTEND (Next.js, :3000) ────────────────────────┐
│ app/diagram/[id]/page.tsx  ← orquestador del editor                       │
│  ├─ Toolbar.tsx / Sidebar.tsx / Palette.tsx / DiagramSelector.tsx         │
│  ├─ EntityNode.tsx + UmlEdge.tsx + 4 edges + SelfLoopEdge + DashedEdge    │
│  ├─ EntityEditorPanel / EdgeEditorPanel / ChatPanel / MembersPanel        │
│  │   / PresencePanel / HelpModal / DiagramCard / AppLogo                  │
│  ├─ hooks: useCollaborativeFlow / useAICommand / useNodeLocks             │
│  │        useDiagramRole / useAuth / useHelpModal                         │
│  ├─ utils: ast.ts / yjsNodeHelpers / yjsEdgeHelpers / floatingEdges.ts    │
│  │        associationClass.ts / xmiExporter / xmiImporter                 │
│  │        diagramExportImport / relationshipTypeMapper                    │
│  ├─ lib: apiClient.ts (JWT) / presence.ts (identidad)                     │
│  ├─ contexts/AuthContext.tsx + data/manual.ts + styles/design-system.ts   │
│  └─ state vivo: Y.Doc { nodes: Y.Map, edges: Y.Map, chat: Y.Array }       │
└──────────────┬───────────────────────────────────┬────────────────────────┘
               │ HTTPS/REST (fetch, apiFetch)      │ WS (y-websocket)
               ▼                                   ▼
┌──────────────────────── BACKEND (Express + ws, :1234) ────────────────────┐
│ server.js: monta REST + WS en el mismo http.Server                        │
│  ├─ routes/auth.js → services/userService.js (bcryptjs + jsonwebtoken)   │
│  ├─ routes/diagrams.js + routes/acl.js → services/aclService.js          │
│  ├─ middleware/auth.js (requireAuth/optionalAuth/signToken/verifyToken)  │
│  ├─ middleware/diagramAuth.js (requireDiagramMember/Role/Write)          │
│  ├─ persistencia archivo: data/diagrams/<id>.json + <id>.acl.json        │
│  ├─ POST /api/ai/command|transcribe|from-image (Groq + multer)           │
│  └─ POST /api/generate → generator/generate.js + typeMapper.js           │
│       + templates/*.hbs → ZIP (archiver) → res.download → rm temporal     │
└───────────────────────────────────────────────────────────────────────────┘
```

**Idea central:** el frontend no tiene estado canónico local. El estado canónico del diagrama es el `Y.Doc` replicado. React (`nodes`/`edges`) es una **vista** derivada vía `observeDeep`. Los writes van a Yjs; los observers actualizan React. Esto elimina una clase entera de bugs de divergencia entre peers.

**Por qué monorepo `frontend/` + `backend/`:** despliegue separado (Vercel solo sirve `frontend/`, ver `vercel.json`), pero contratos compartidos implícitos (AST, `typeMap`, JWT `?token=`). El backend es stateless salvo `data/` y sirve a la vez REST y WS sobre el mismo puerto para simplificar CORS y dev (`npm start` → un solo proceso).

---

## 2. Stack: librerías y por qué

### 2.1 Frontend (`frontend/package.json`)

| Librería | Versión | Por qué existe (decisión) |
|---|---|---|
| `next` | 16.3.3 | App Router + routing por carpeta (`/dashboard`, `/diagram/[id]`, `/login`). SSR no se usa para el canvas (todo es `'use client'`), pero se aprovecha el router, el build y el despliegue en Vercel. |
| `react` / `react-dom` | 19.2.8 | Base UI. React 19 obliga a código sin mutación directa del estado (por eso los helpers Yjs reconstruyen `Y.Map` en vez de mutar objetos). |
| `reactflow` (React Flow) | 11.11.4 | Canvas UML: nodos arrastrables, handles, `applyNodeChanges/applyEdgeChanges`, `getSmoothStepPath`, `MiniMap/Controls/Background`. Reimplementarlo sería meses de trabajo; solo se customiza la capa visual (edges propios, handles sutiles). |
| `yjs` | 13.6.32 | CRDT para colaboración sin servidor de resolución de conflictos. Se eligió CRDT sobre OT porque no requiere servidor central de operaciones: cada peer fusiona updates conmutativos. |
| `y-websocket` | 1.4.1 | Provider que sincroniza `Y.Doc` por WebSocket + `awareness` (presencia efímera). Se usa **tanto** para datos (nodes/edges/chat) como para señalización (quién está online, qué nodo edita). Sin esto habría que inventar protocolo propio. |
| `react-markdown` | 10.1.0 | Render del manual embebido (`HelpModal`). Markdown en `data/manual.ts` en vez de JSX hardcodeado para que el contenido sea editable sin tocar componentes. |
| `tailwindcss` + `@tailwindcss/postcss` | 4 | Estilos utilitarios + `styles/design-system.ts` (`DS.button/input/card/header`) para consistencia entre dashboard/login/editor. |
| `typescript`, `@types/*`, `eslint`, `eslint-config-next` | dev | Tipado estricto en dominio UML (`types/diagram.ts`) y gates de CI (`tsc --noEmit`, suites en `backend/tests` y `backend/generator/tests`). |

### 2.2 Backend (`backend/package.json`)

| Librería | Por qué existe |
|---|---|
| `express` | REST (`/api/auth`, `/api/diagrams`, `/api/ai/*`, `/api/generate`). Minimalista, suficiente; no se necesita Nest para este tamaño. |
| `ws` + `y-websocket/bin/utils::setupWSConnection` | Servidor WS compartiendo `http.Server` con Express. `setupWSConnection` implementa el protocolo sync/awareness de Yjs; no se reimplementa. |
| `yjs` + `y-websocket` (backend) | Solo para el protocolo WS (el backend no persiste el `Y.Doc` en memoria: la persistencia canónica es `data/diagrams/*.json` vía REST snapshot + rehidratación Yjs al abrir). |
| `jsonwebtoken` | Firma/verificación JWT (`middleware/auth.js`). `verifyToken` se reutiliza en HTTP y en WS (`?token=`), un solo secreto. |
| `bcryptjs` | Hash de passwords (10 rounds) en `services/userService.js`. Nunca se persiste ni se devuelve en claro. |
| `multer` (memoryStorage, 10 MB) | Subida de audio/imagen para IA sin tocar disco: el buffer va directo a `fetch` Groq. Evita limpieza de temporales y path traversal. |
| `handlebars` | Motor del generador (`generator/generate.js` + `templates/*.hbs`). Lógica mínima en plantillas + helpers (`pascalCase`, `eq`, `sqlPkType`, `safeTableName`…): el cómputo vive en JS testeable, las plantillas solo interpolan. |
| `archiver` | Empaquetado ZIP del backend generado en memoria→disco temporal→`res.download`→`rm` (sin acumulación). |
| `dotenv` | `GROQ_API_KEY`, `GROQ_MODEL`, `JWT_SECRET`, `AUTH_ENABLED`, `PORT`. |
| `cors` | El frontend (`:3000` / Vercel) y el backend (`:1234`) son orígenes distintos. |

### 2.3 Servicios externos (no npm)

| Servicio | Modelos / uso | Por qué |
|---|---|---|
| Groq OpenAI-compatible | `openai/gpt-oss-20b` (texto), `whisper-large-v3` (voz), `qwen/qwen3.8-27b` (visión) | Un solo `fetch` con `Authorization: Bearer`, sin SDK. Temperatura `0.1` + system prompt estricto para forzar JSON `{ mutations }`. |

---

## 3. Mapa archivo → responsabilidad

### Frontend — páginas (`src/app/`)

| Archivo | Responsabilidad | Por qué existe |
|---|---|---|
| `app/layout.tsx` | `AuthProvider` global + font Inter + cadena `h-full` para que React Flow tenga dimensiones | Sin la cadena `html.h-full → body → flex → min-h-0 → w/h-full`, React Flow mide 0×0 y lanza el error de dimensiones. |
| `app/page.tsx` | Redirector `/` → `/diagram/<last>` sin auth, `/login` o `/dashboard` con auth | Evita duplicar el editor; una sola ruta canónica del canvas. |
| `app/diagram/[id]/page.tsx` | **Orquestador del editor** (933 líneas): carga lista, `key={id}` para remontar Yjs/rol/panels, modo conexión de paleta, banner, `edgeTypes/nodeTypes`, panels, Chat/Members, XMI, generate, VIEWER read-only | Punto de integración de todos los hooks. El `key={id}` es la forma barata y correcta de aislar rooms Yjs al navegar. |
| `app/dashboard/page.tsx` | Lista `owned/shared`, búsqueda, `POST /api/diagrams` → `router.push(/diagram/id)`, botón Ayuda | Separar gestión (CRUD) de edición (canvas) reduce acoplamiento y permite ACL por card. |
| `app/login/page.tsx`, `app/register/page.tsx` | Formularios + `AppLogo` + `DS` | Reutilizan `AuthContext`; redirigen a `/dashboard`. |

### Frontend — componentes de canvas

| Archivo | Responsabilidad | Por qué |
|---|---|---|
| `components/EntityNode.tsx` | Nodo UML (clase/interfaz/abstracta/nota), `lockedBy`, handles sutiles hover | Un solo `nodeTypes.entity` simplifica Yjs (`type` siempre `entity`, la variante va en `data.stereotype`). |
| `components/UmlEdge.tsx` | Base de las 4 aristas: `getSmoothStepPath` + cardinalidades (`ALONG_OFFSET=28`, `PERP_OFFSET=24`) + selección azul | Centraliza routing ortogonal estilo EA y labels; los wrappers solo añaden el marcador. `ALONG_OFFSET 10→28` fue el fix para que los labels no queden tapados por el borde. |
| `components/AssociationEdge/InheritanceEdge/AggregationEdge/CompositionEdge.tsx` | Mismo path + marcador (línea / triángulo hueco △ / rombo lleno ◆ / rombo vacío ◇) orientado por **segmento final** (`getEdgeEndVector`) | Con codos de 90°, orientar por vector recto deja el marcador girado. Por eso se usa el eje del handle destino. |
| `components/edges/SelfLoopEdge.tsx` | Bucle Bezier a la derecha (`loopWidth 70`, `entryGap 24`) con `type:'selfloop'` | React Flow dibuja self-loops como líneas colapsadas; el edge propio lo vuelve un lazo legible. El tipo UML real viaja en `data.type`, el tipo de render en `edge.type`. |
| `components/DashedEdge.tsx` | Línea ámbar punteada (links de clase asociativa, no AST) | Se excluye del AST (`isAssociationClassLink`); es decoración de editor. |
| `components/AssociationClassConnector.tsx` | Overlay SVG del punto medio de la arista al borde del nodo asociativo | La línea no es un edge React Flow (no interfiere con selección/routing); se recalcula al mover extremos. |
| `components/Palette.tsx` | Dos modos: drag-and-drop (Clase/Interfaz/Abstracta/Nota) + click-to-connect (4 relaciones, `RELATIONSHIPS` con `id` = clave de `edgeTypes` y `relationshipType` = tipo AST) | El `activeRelationType` se usa **directo** como `edge.type` (sin lookup intermedio) para eliminar un punto de fallo. `connectionRadius={40}` + `onConnectStart/End` mejoran el agarre de handles. |

### Frontend — panels y chrome

| Archivo | Responsabilidad |
|---|---|
| `components/Toolbar.tsx` | Acciones (Entidad, Conexión, JSON/XMI, Importar, Desde imagen, Generar, Chat, Miembros, Ayuda), `PresencePanel`, estado conexión, `UserMenu`. Botón Ayuda + `HelpModal` montado aquí. |
| `components/Sidebar.tsx` | Explorador de entidades (selección; bloqueada en VIEWER). `flex-shrink-0` para no colapsar el canvas. |
| `components/EntityEditorPanel.tsx` / `EdgeEditorPanel.tsx` | Edición de atributos/métodos y cardinalidades/tipo + conversión a clase asociativa. Escriben vía `updateNode/updateEdge` (Yjs), nunca `setState` directo. |
| `components/ChatPanel.tsx` | UI del asistente (texto + micrófono + imagen). Delegación total a `useAICommand`. |
| `components/MembersPanel.tsx` | CRUD de miembros (solo OWNER). Consume `routes/acl.js`. |
| `components/PresencePanel.tsx` | Avatares desde `connectedUsers` (sin lógica: pura vista). |
| `components/DiagramCard.tsx` / `DiagramSelector.tsx` | Cards del dashboard y selector interno del editor. |
| `components/HelpModal.tsx` + `data/manual.ts` + `hooks/useHelpModal.ts` | Manual de 10 secciones con índice lateral + buscador + F1/Escape/click-fuera. |
| `components/AppLogo.tsx` + `styles/design-system.ts` | Identidad y clases Tailwind compartidas. |
| `components/UserMenu.tsx`, `RelationTypeSelector.tsx` | Sesión y selector de tipo de conexión. |

### Frontend — hooks / lib / utils

| Archivo | Responsabilidad | Decisión clave |
|---|---|---|
| `hooks/useCollaborativeFlow.ts` | Ciclo de vida `Y.Doc + WebsocketProvider`, observers `observeDeep`, writers Yjs, `onNodesChange/onNodeDragStop/onEdgesChange/onConnect`, `export/import/loadDiagramData`, presencia inicial, soft-lock publish, `providerRef` expuesto | **Writes → Yjs, reads ← observer.** `isDraggingRef` evita re-render por cada tick de Yjs durante el drag (solo se publica al soltar). Cleanup captura provider/doc en variables locales (no `ref.current`, que ya apuntaría al nuevo) + `awareness.setLocalState(null)` **antes** de `destroy()` para no resucitar avatares zombie. |
| `hooks/useAICommand.ts` | `handleSendCommand` (JSON), `handleVoiceCommand` (MediaRecorder webm → FormData), `handleFromImage` (FormData + AST) | `apiFetch` (nunca fija `Content-Type` en FormData: lo pone el navegador con boundary). |
| `hooks/useNodeLocks.ts` | Lee `awareness.getStates()` → `Map<nodeId, {name,color}>`, expira a 30 s | Soft-lock es **visual**, no transaccional: `draggable:false` en nodos ajenos, pero Yjs seguiría aceptando writes (aceptable para el alcance). |
| `hooks/useDiagramRole.ts` | Rol del diagrama actual (`GET .../role`) | El editor deriva read-only de aquí, no del JWT. |
| `hooks/useAuth.ts` + `contexts/AuthContext.tsx` | Sesión (`/status` → `/me`), `login/register/logout`, `localStorage case-tool:token` | Validación contra `/me`, no `jwt-decode` en cliente (menos deps, misma UX; sobrevive a backend caído quedando en modo abierto). |
| `lib/apiClient.ts` | `apiFetch` (inyecta `Bearer`), `getWsParams` (`{token}` → `?token=`) | Un solo lugar para auth HTTP+WS. |
| `lib/presence.ts` | `generateUserColor` determinista (hash de `user.id`), `getOrCreateSessionIdentity` (sessionStorage), `resolvePresenceIdentity` | Color estable entre pestañas/reconexiones sin storage extra para autenticados; anónimos estables por pestaña. |
| `utils/yjsNodeHelpers.ts` | `createNodeMap/add/update/remove/nodesToArray` (Y.Map anidados: `position`, `data`, `attributes[]`, `methods[]`) | Granularidad de `Y.Map` permite updates de posición sin reescribir atributos (menos tráfico, menos conflictos). `removeNode` borra aristas incidentes (integridad referencial local). |
| `utils/yjsEdgeHelpers.ts` | `typeMap/reverseTypeMap`, `createEdgeMap/add/update/remove/edgesToArray` | Doble tipado: `edge.type` (render React Flow) vs `data.type` (semántica UML/AST). `updateEdge` hace merge (no pierde `associationClassNodeId`, `intermediateAttributes`…) y normaliza `default→association`. |
| `utils/ast.ts` | `nodesToAST` (React Flow → `{entities, relationships}` + intermedias) y `applyMutations` (IA → Yjs en orden addEntity→addAttribute→addRelationship→remove*) | El orden de aplicación evita referencias colgadas (primero existen los nodos, luego las aristas). `toJavaClassName` es espejo del backend. |
| `utils/associationClass.ts` | `planAssociationDelete`, `buildAssociationNode`, `computeConnectorLines` | Lógica pura y testeable; borrado por botón y por teclado comparten el plan. |
| `utils/floatingEdges.ts` | `getNodeIntersection` + `useFloatingEdgeGeometry` | Aristas centro-a-centro recortadas al borde (estilo Architect); fallback a coords React Flow en self-loop/nodos ausentes. |
| `utils/xmiExporter.ts` / `xmiImporter.ts` | UML 2.5 ↔ nodos/aristas | XMI no preserva el vínculo de clase asociativa (limitación documentada: reimporta como standalone + intermedia auto). |
| `utils/diagramExportImport.ts` | Backup JSON local (Blob/FileReader) | Independiente del servidor; útil sin auth. |
| `utils/relationshipTypeMapper.ts` | Mapeos legacy de tipos | Compatibilidad con diagramas guardados. |
| `types/diagram.ts` | `EntityNodeData`, `RelationshipData`, `AstRelationship`, `Attribute` | Contrato tipado entre canvas, AST e IA. |
| `types/y-websocket.d.ts` | Declaración manual de `WebsocketProvider` | El paquete trae `.d.ts` en ruta que el resolver `bundler` no encuentra (`module`→`src/*.js` vs `types`→`dist/*`); el shim evita TS7016 en Vercel sin `ignoreBuildErrors`. |

### Backend

| Archivo | Responsabilidad |
|---|---|
| `server.js` | Composition root: Express + `http.Server` + `ws`, monta routers, sirve `GET/POST /api/diagrams/:id`, `PUT .../rename`, `DELETE`, `POST /api/ai/*`, `POST /api/generate`, `GET /health`. Gate WS por room `diagram-room-<id>`. |
| `routes/auth.js` | `POST register/login`, `GET me/status`. Sanitiza (`passwordHash` nunca sale). |
| `routes/diagrams.js` | `GET /api/diagrams → {owned, shared}`, `POST` crea + ACL OWNER. Filtra `.acl.json`, excluye legacy sin migrar. |
| `routes/acl.js` | `GET role/acl`, `POST members` (por username), `PATCH/DELETE members/:userId`. OWNER no auto-eliminable. |
| `middleware/auth.js` | `authEnabled()` flag, `requireAuth` (anonymous si flag off), `signToken/verifyToken`. |
| `middleware/diagramAuth.js` | `requireDiagramMember/Role/Write`. Rename = escritura (más estricto que el boceto, coherente). |
| `services/userService.js` | `users.json` + bcrypt (validaciones 400, duplicados, login 401). |
| `services/aclService.js` | `<id>.acl.json`, `getOrCreateACL` idempotente (migración legacy → primer entrante OWNER; anónimo si flag off). |
| `generator/generate.js` | `generateProject(ast)`: sanitize → `expandManyToMany` → contexts (PK, `buildModelAccessors/DtoAccessors`, `buildSqlColumns`, `buildInheritanceInfo`) → Handlebars → `archiver` ZIP. |
| `generator/typeMapper.js` | UML→Java/SQL (`String→VARCHAR`, `UUID`, `BigDecimal`…). |
| `generator/templates/*.hbs` | `pom`, `application.properties`, `model`, `entity-intermediate`, `repository`, `service`, `controller`, `dto`, `migration.sql`, `DemoApplication`, seguridad JWT, `GlobalExceptionHandler`, README. Triple `{{{ }}}` donde el escape rompería tipos Java. |

---

## 4. Flujos end-to-end

### F1 — Autenticación (register / login / sesión)

**Objetivo:** identidad con degradación elegante a modo abierto.

```
Visitante → login/page.tsx → AuthContext.login()
  → POST /api/auth/login {username,password}          (routes/auth.js)
  → userService.verifyPassword (bcrypt.compare)       (services/userService.js)
  → signToken({userId,username}, 7d)                  (middleware/auth.js)
  → localStorage case-tool:token                      (lib/apiClient.ts::setToken)
  → /dashboard
Recarga → AuthContext: GET /api/auth/status → GET /api/auth/me (apiFetch + Bearer)
Logout → clearToken + setUser(null)
```

**Archivos y por qué:**
- `routes/auth.js` + `services/userService.js`: separan transporte de persistencia (cambiar `users.json` por Postgres no toca las rutas).
- `middleware/auth.js::requireAuth`: con `AUTH_ENABLED=false` inyecta `anonymous` y deja pasar — cero regresiones en dev/demo; con `true` exige `Bearer` (401).
- `contexts/AuthContext.tsx` + `lib/apiClient.ts`: un solo punto de token para REST y WS; `apiFetch` solo fija `Content-Type: application/json` con body string para no romper `FormData` (voz/imagen).

### F2 — Dashboard y CRUD de diagramas

```
Dashboard → GET /api/diagrams → {owned, shared}       (routes/diagrams.js)
  + Nuevo → POST /api/diagrams {name} → {id,name} + ACL OWNER → push /diagram/id
  Card → /diagram/[id] | rename → PUT .../rename | delete → DELETE (solo OWNER)
```

**Por qué:** el listado filtra por membresía ACL y jamás lista `*.acl.json`. Legacy sin ACL se excluye hasta migrar (el primero que abre vía `getOrCreateACL` se vuelve OWNER). Cards muestran `entityCount/relationshipCount/updatedAt/role/ownerUsername` calculados del JSON.

### F3 — Apertura del editor y carga (REST snapshot → Yjs)

```
page.tsx [id] → key={id} remonta EditorContent
  → useCollaborativeFlow(roomName=`diagram-room-<id>`)
  → GET /api/diagrams/:id (requireAuth + requireDiagramMember)
  → loadDiagramData({nodes,edges,chat}) en UNA transacción Yjs
  → observeDeep → setNodes/setEdges iniciales
```

**Por qué transacción única:** `doc.transact` fusiona N writes en un update (un solo notify, un solo mensaje WS). `loadDiagramData` limpia (`clear` + `delete`) antes de repoblar para evitar duplicados al reabrir.

### F4 — Edición colaborativa en tiempo real (núcleo)

```
Usuario A arrastra Palette → addNode/updateNode/addEdge (hook)
  → yAddNode/yAddEdge (Y.Map set)                     (utils/yjs*Helpers)
  → Yjs update → WS → setupWSConnection broadcast     (server.js + y-websocket)
  → Usuario B: ye.observeDeep → edgesToArray → setEdges → React Flow re-render
Drag: onNodesChange aplica local (feedback) + isDraggingRef=true (ignora eco Yjs)
  → onNodeDragStop publica position una vez           (menos mensajes, sin jitter)
```

**Por qué Yjs + y-websocket:** CRDT conmutativo = sin servidor de conflictos; `Y.Map` por nodo/arista + sub-`Y.Map` (`position`, `data`) permite updates finos. `observeDeep` (no `observe`) captura mutaciones anidadas (`position.set`, `data.attributes.push`). `isDraggingRef` es esencial: sin él, el eco remoto durante el drag pelearía con el puntero.

**Tipos de arista:** `edge.type` ∈ `{association, inheritance, aggregation, composition, dashed, selfloop}` (render) y `data.type` ∈ `{ASSOCIATION, INHERITANCE, …}` (semántica). `typeMap/reverseTypeMap` traducen en ambos sentidos; `applyMutations` y `nodesToAST` nunca mezclan ambos niveles.

### F5 — Presencia y soft-lock (awareness, no datos)

```
Login → awareness.setLocalStateField('user', resolvePresenceIdentity(user))
  → 'change' → ConnectedUser[] deduplicado por user.id → PresencePanel avatares
Seleccionar nodo → setLocalStateField('editing',{nodeId,timestamp})
  → useNodeLocks filtra <30 s → EntityNode boxShadow + lockedBy + draggable:false ajeno
Salir/recargar → setLocalState(null) ANTES de destroy() → sin zombies
Reconectar → handler 'status connected' republica identidad con reloj fresco
```

**Por qué awareness y no Y.Map:** la presencia es efímera (no debe persistir en `*.json`); Yjs la propaga y la limpia al desconectar gratis. Los dos bugs clásicos están comentados en el código: (1) cleanup que lee `ref.current` destruiría la conexión **nueva**; (2) no anular estado antes de `destroy()` resucita el avatar como zombie por la protección anti-takeover de `y-protocols`.

### F6 — Autorización por diagrama (ACL + gate WS)

```
Invitar: MembersPanel → POST /api/diagrams/:id/members {username,role}
  → aclService.addMember (EDITOR|VIEWER)               (routes/acl.js)
WS connect: wss.on('connection') parsea room + ?token= → verifyToken
  → getOrCreateACL (migración) → getRoleForUser
  → sin token 4401 | sin rol 4403 | OK → setupWSConnection + ws.userRole
Editor: useDiagramRole → VIEWER = canvas no arrastrable/conectable/seleccionable,
  sin botones de edición, ChatPanel readOnly, badge + muro "No tienes acceso"
```

**Por qué `?token=` en WS:** el handshake WS no permite `Authorization` custom en navegador; el query es el canal estándar y `y-websocket` lo soporta vía `{params}` sin romper el room (el servidor parte por `?`). Fail-closed: denegar por defecto.

### F7 — Persistencia en servidor (snapshot)

```
Cerrar/navegar → POST /api/diagrams/:id {name,nodes,edges,chat} (requireDiagramWrite)
  → data/diagrams/<safeId>.json (safeId evita path traversal)
GET devuelve fallback vacío si no existe; rename valida trim; DELETE (OWNER) borra
  .json + .acl.json juntos
```

**Por qué archivo y no DB (estado actual):** simplicidad y portable a demo; el README lo marca como pendiente. El contrato ya es snapshot `{name,nodes,edges,chat}`, migrable a Postgres sin cambiar el frontend.

### F8 — Asistente IA por texto

```
ChatPanel → useAICommand.handleSendCommand
  → nodesToAST(nodes,edges) → POST /api/ai/command {command,currentState}
  → getMutationsFromAI: systemPrompt estricto + model gpt-oss-20b, temp 0.1
  → Groq → JSON {mutations} (+ extractMutationsFromText fallback)
  → applyMutations en orden (addEntity→addAttribute→addRelationship→remove*)
  → resumen en chat (addMessage → Y.Array chat → se sincroniza como un nodo más)
```

**Por qué AST intermedio:** desacopla el canvas del LLM (el prompt ve entidades/relaciones, no coordenadas). **Por qué orden fijo:** crear nodos antes que aristas evita `resolveEntityId → null`. El chat vive en `Y.Array('chat')`, luego el historial es colaborativo gratis.

### F9 — IA por voz

```
Mic → MediaRecorder (webm/opus) → Blob → FormData{audio}
  → POST /api/ai/transcribe (multer memory, 10 MB)
  → fetch Groq /audio/transcriptions (whisper-large-v3, language es)
  → {text} → setCommand + mensaje system "Transcripción: ..."
  → usuario revisa y envía como F8
```

**Por qué transcribir y no ejecutar directo:** el usuario valida el texto antes de mutar el diagrama (menos sorpresas). `multer.memoryStorage` evita I/O de disco; `apiFetch` no toca `Content-Type` en `FormData`.

### F10 — IA desde imagen

```
Desde imagen → FormData{image, currentState} → POST /api/ai/from-image
  → getMutationsFromAI(..., buffer, mime) con qwen3.8-27b (data URL base64)
  → mutations → applyMutations → "Desde imagen: N cambios"
```

**Por qué mismo pipeline:** reutiliza prompt/mutaciones/aplicación de F8; solo cambia el contenido del mensaje (texto + `image_url`). Límite 10 MB protege al backend de imágenes gigantes.

### F11 — Exportar / importar (JSON local + XMI EA)

```
JSON: exportDiagramToJson (Blob download) / importDiagramFromJson (FileReader + validación)
XMI: Toolbar → exportToXmi/downloadXmi (UML 2.5) / importFromXmi (parse → nodos/aristas → transacción Yjs)
```

**Por qué dos formatos:** JSON es backup fiel (preserva `data` extra, `associationOf`, intermedias); XMI es interoperabilidad con Enterprise Architect a costa de perder el vínculo de clase asociativa (documentado).

### F12 — Generación de backend Spring Boot

```
Generar → nodesToAST → POST /api/generate {currentState}
  → generateProject(ast):
    0. sanitizeEntities + normalizeRelationshipEndpoints (nombres Java válidos)
    1. expandManyToMany: cada * a * → intermedia explícita (UUID + 2×@ManyToOne), NUNCA @ManyToMany
    2. por entidad: PK (UUID→GenerationType.UUID), mappedAttributes (omite isFkCollision),
       buildModelAccessors / buildDtoAccessors (getters/setters explícitos, no solo Lombok),
       buildSqlColumns (FK + CONSTRAINT, safeTableName para reserved words),
       buildInheritanceInfo: raíz={isRoot} → @Inheritance(JOINED)+@DiscriminatorColumn;
                             hijo={parentEntity} → extends+@PrimaryKeyJoinColumn (nunca @Inheritance en hijo)
    3. Handlebars render (pom, properties, model, intermediate, repository, service,
       controller, dto, migration.sql, DemoApplication, seguridad JWT, handler, README)
    4. archiver ZIP → res.download → rm temporal
  → navegador descarga backend-generado.zip
```

**Decisiones (por qué):**
- **Sin `@ManyToMany`:** dos colecciones bidireccionales serializan en loop y `@JoinTable` no admite columnas extra (`cantidad`, `fecha`). La intermedia con PK propia + repositorio/controlador propios la hace manipulable desde la app móvil (`config.json` la lista como entidad más).
- **Herencia `JOINED` solo en raíz:** JPA exige una sola estrategia por jerarquía; poner `@Inheritance` en el hijo rompe el arranque en PostgreSQL (`may not override SINGLE_TABLE`). Hijo = `extends` + FK a la tabla padre.
- **FK-collision:** si un atributo se llama como el `@JoinColumn` (`customerId`), la relación es fuente de verdad y el atributo no se mapea (evita `Column duplicated in mapping`).
- **Lógica en JS, no en `.hbs`:** `generate.js` computable y testeado (`association-class`, `getters-setters`, `fk-collision`, `edge-routing`, `floating-edges`); plantillas casi tontas.

### F13 — Clase asociativa UML 2.5 (editor)

```
Arista * a * → EdgeEditorPanel "Convertir" → buildAssociationNode (nombre User+Customer→UserCustomer)
  → nodo {isAssociationClass, associationOf{edgeId,...}} + edge.associationClassNodeId
  → overlay punteado ámbar punto-medio→borde (AssociationClassConnector)
  → nodesToAST toma nombre/atributos del nodo, genera intermedia UNA vez
  → disolver/borrar: planAssociationDelete limpia el vínculo (la arista * a * sobrevive)
```

### F14 — Ayuda embebida

```
Toolbar/Dashboard ❓ → useHelpModal.open() (F1 global, Escape/click-fuera cierran)
  → HelpModal (índice + buscador sobre MANUAL_SECTIONS) → react-markdown render
```

**Por qué `data/manual.ts`:** contenido versionable sin tocar UI; 10 secciones alineadas a flujos reales (sin documentar lo inexistente).

### F15 — Despliegue

```
Vercel (root) → vercel.json {installCommand, buildCommand: cd frontend && ..., outputDirectory: frontend/.next, framework: nextjs}
  + Root Directory=frontend en dashboard (defensa en profundidad contra 404 monorepo)
  + NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL apuntando al backend :1234
  + types/y-websocket.d.ts evita TS7016 sin ignoreBuildErrors
```

---

## 5. Contratos API (backend `server.js`)

| Método / Ruta | Auth | Body | Respuesta |
|---|---|---|---|
| `GET /health` | pública | — | `OK` |
| `POST /api/auth/register` | pública | `{username,email,password}` | `201 {token,user}` / `400` |
| `POST /api/auth/login` | pública | `{username,password}` | `200 {token,user}` / `401` |
| `GET /api/auth/me` | `requireAuth` | — | `{user}` o `{user:null,anonymous:true}` |
| `GET /api/auth/status` | pública | — | `{authEnabled}` |
| `GET /api/diagrams` | abierta* | — | `{owned,shared}` |
| `POST /api/diagrams` | abierta* | `{name}` | `201 {id,name}` + ACL |
| `GET /api/diagrams/:id` | member | — | `{name,nodes,edges,chat}` |
| `POST /api/diagrams/:id` | write | `{name,nodes,edges,chat}` | `{ok:true}` |
| `PUT /api/diagrams/:id/rename` | write | `{name}` | `{ok,name}` |
| `DELETE /api/diagrams/:id` | OWNER | — | `204` |
| `GET /api/diagrams/:id/role`, `GET .../acl`, `POST .../members`, `PATCH/DELETE .../members/:userId` | según rol | — | ACL JSON |
| `POST /api/ai/command` | `requireAuth` | `{command,currentState}` | `{mutations}` |
| `POST /api/ai/transcribe` | `requireAuth` | `FormData{audio}` | `{text}` |
| `POST /api/ai/from-image` | `requireAuth` | `FormData{image,currentState}` | `{mutations}` |
| `POST /api/generate` | `requireAuth` | `{currentState}` | ZIP download |
| `WS /diagram-room-<id>?token=` | gate propio | protocolo Yjs | 4401 sin token, 4403 sin rol |

\* Con `AUTH_ENABLED=false`, `requireAuth` inyecta `anonymous` (modo abierto histórico).

---

## 6. Estado y persistencia

- **Vivo:** `Y.Doc` por room (`nodes: Y.Map<id, Y.Map>`, `edges: Y.Map<id, Y.Map>`, `chat: Y.Array`). Estructura anidada (`position`, `data.attributes[]`) para updates quirúrgicos.
- **Durable:** `backend/data/diagrams/<id>.json` (`{name,nodes,edges,chat}`) + `<id>.acl.json` (`{diagramId,ownerId,members[]}`). Usuarios en `backend/data/users.json` (git-ignored, bcrypt).
- **Efímero:** `awareness` (`user`, `editing`). No se persiste; expira (locks 30 s) y se limpia al desconectar.

---

## 7. Decisiones de ingeniería (resumen ADR)

1. **CRDT > OT:** sin servidor de operaciones; convergencia eventual gratuita.
2. **Vista derivada, no estado dual:** React refleja Yjs; jamás se edita `nodes` sin pasar por Yjs (salvo feedback optimista de drag/selección vía `apply*Changes`).
3. **Doble tipado de arista:** render vs semántica separados para no romper diagramas persistidos al cambiar el visual.
4. **Intermedia explícita > `@ManyToMany`:** evita loops JSON, habilita atributos en la relación y CRUD móvil.
5. **`JOINED` + `@Inheritance` solo en raíz:** único arranque válido en PostgreSQL/Hibernate para la jerarquía.
6. **JWT dual (header + query):** mismo secreto, dos transportes (REST vs WS).
7. **Fail-closed en WS, fail-open en REST sin flag:** colaboración nunca queda expuesta por defecto; dev sigue fluido.
8. **IA con validación humana en voz/imagen:** transcribir/mostrar antes de mutar.
9. **Plantillas tontas, JS listo:** lo testeable vive en `generate.js`/`ast.ts`/`associationClass.ts` (suites en `backend/*/tests`). Visual puro (`routing`, `floating`, `SelfLoop`, `ALONG_OFFSET`) no toca AST/Yjs/backend.

---

## 8. Variables de entorno

| Dónde | Var | Efecto |
|---|---|---|
| `backend/.env` | `GROQ_API_KEY` (req), `GROQ_MODEL` (def `openai/gpt-oss-20b`), `GROQ_VISION_MODEL` (def `qwen/qwen3.8-27b`), `JWT_SECRET` (≥32 chars), `JWT_EXPIRATION` (def `7d`), `AUTH_ENABLED` (`true/false`), `PORT` (def `1234`) | Sin `GROQ_API_KEY`, IA responde 500 explícito. Cambiar `AUTH_ENABLED` exige reinicio (`server.js` lee `.env` al arrancar). |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Antes hardcodeado a localhost; ahora configurable para Vercel. |

## 9. Depuración por flujo (cheatsheet)

| Síntoma | Dónde mirar |
|---|---|
| Avatar zombie | `useCollaborativeFlow` cleanup: ¿`setLocalState(null)` antes de `destroy()`? ¿cleanup usa copias locales? |
| Eco/jitter al arrastrar | `isDraggingRef` + `onNodeDragStop` (¿se publica una sola vez?). |
| Label tapado | `UmlEdge.tsx::ALONG_OFFSET/PERP_OFFSET`. |
| Marcador girado en codo | wrappers deben usar `getEdgeEndVector(targetPosition)`, no vector recto. |
| Self-loop colapsado | `edge.type` debe ser `selfloop` (render) con `data.type` UML intacto. |
| Intermedia no generada | 1) cardinalidades `*` en `EdgeEditorPanel`, 2) Network `POST /api/generate` lleva `cardinalityFrom/To`, 3) backend reiniciado tras tocar generador. |
| Hibernate `may not override SINGLE_TABLE` | `buildInheritanceInfo`: ¿hijo sin `@Inheritance`? ¿raíz con `JOINED`? |
| `Column duplicated` | ¿atributo colisiona con `fkColumn`? Debe marcarse `isFkCollision` y omitirse. |
| WS 4401/4403 | `?token=` presente, `room=diagram-room-<id>`, `aclService.getRoleForUser ≠ NONE`. |
| Vercel 404 / TS7016 | `vercel.json` + Root Directory `frontend` + `types/y-websocket.d.ts` presente. |
