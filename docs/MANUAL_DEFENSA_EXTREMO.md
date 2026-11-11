# MANUAL DE DEFENSA EXTREMO

**Proyecto:** Herramienta CASE Colaborativa con IA  
**Examen:** Segundo Parcial  
**Nivel:** “Biblia del proyecto” — inventario, UI, BD, código forense, 30 preguntas, dependencias y pánico  
**Regla absoluta:** si algo no está en el código, este manual no lo afirma.

---

## Índice

1. [Inventario absoluto](#parte-1-el-inventario-absoluto-el-mapa-del-tesoro)
2. [Mapa de la interfaz: de la UI al código](#parte-2-el-mapa-de-la-interfaz-de-usuario-de-la-ui-al-código)
3. [Anatomía de la base de datos](#parte-3-la-anatomía-de-la-base-de-datos-tabla-por-tabla)
4. [Código línea por línea: 5 métodos](#parte-4-el-código-línea-por-línea-los-5-métodos-más-importantes)
5. [30 preguntas extremas](#parte-5-el-banco-de-preguntas-extremo-las-30-preguntas)
6. [Diccionario de dependencias](#parte-6-el-diccionario-de-dependencias-por-qué-esta-librería-y-no-otra)
7. [Modo pánico](#parte-7-el-modo-pánico-diagnóstico-de-errores)

---

# PARTE 1: El Inventario Absoluto (El “Mapa del Tesoro”)

## 1.0. Mapa visual antes de abrir archivos

```mermaid
flowchart LR
    U["Usuario"] --> FE["Frontend<br/>Next.js + React Flow<br/>Vercel"]
    FE -->|"HTTPS REST"| BE["Backend Node.js<br/>Express + WebSocket<br/>Railway"]
    FE -->|"WSS Yjs"| BE
    BE -->|"pg / SQL"| DB[("PostgreSQL<br/>Neon<br/>auth / core / chat")]
    BE -->|"HTTPS"| AI["Groq / Ollama"]
    AI -->|"JSON validado"| BE
    BE -->|"chat Yjs"| FE
```

## 1.1. Frontend — aplicación y páginas

| Archivo | Qué hace | Por qué está ahí |
|---|---|---|
| `frontend/src/app/layout.tsx` | Layout raíz: `<html>`, `<body>`, fuente Inter, `AuthProvider`. | Next.js exige un root layout; además encadena altura para React Flow. |
| `frontend/src/app/page.tsx` | Punto de entrada; redirige al dashboard, login o editor. | Separa la decisión de ruta de la lógica del editor. |
| `frontend/src/app/login/page.tsx` | Formulario de login. | Vista delgada: llama `AuthContext.login`. |
| `frontend/src/app/register/page.tsx` | Formulario de registro. | Valida coincidencia de contraseñas y llama `AuthContext.register`. |
| `frontend/src/app/dashboard/page.tsx` | Lista diagramas propios/compartidos, crea, renombra, elimina y gestiona solicitudes. | Es el “home” del usuario autenticado. |
| `frontend/src/app/diagram/[id]/page.tsx` | Composition root del editor: conecta Yjs, React Flow, paneles, IA, XMI y generación. | Evita que cada componente conozca toda la aplicación. |
| `frontend/src/app/globals.css` | Tailwind CSS y variables base. | Estilos globales mínimos. |

## 1.2. Frontend — hooks

| Archivo | Qué hace | Método/idea clave |
|---|---|---|
| `frontend/src/hooks/useCollaborativeFlow.ts` | Crea `Y.Doc`, `WebsocketProvider`, mapas `nodes`/`edges`/`chat`, presencia y flush al cerrar. | `requestFlush`, `onNodesChange`, `onNodeDragStop` |
| `frontend/src/hooks/useAICommand.ts` | Envía comandos de texto/voz/imagen, clasifica menciones y aplica mutaciones. | `sendCommandText`, `handleVoiceCommand`, `handleFromImage` |
| `frontend/src/hooks/useAiProvider.ts` | Persiste la configuración de proveedor IA en `localStorage`. | `AiConfig`, `DEFAULT_AI_CONFIG` |
| `frontend/src/hooks/useCanvasInteractions.ts` | Maneja drag-and-drop desde la paleta al canvas. | `onDrop`, `handleAddEntity` |
| `frontend/src/hooks/useDiagramIo.ts` | Exporta/importa XMI y genera el backend. | `handleGenerateBackend`, `handleExportXmi` |
| `frontend/src/hooks/useDiagramLoader.ts` | Carga nombre y chat inicial desde REST al entrar al diagrama. | `useEffect` + `/api/diagrams/:id` |
| `frontend/src/hooks/useDiagramCatalog.ts` | Lista de diagramas disponible en el editor. | `GET /api/diagrams` |
| `frontend/src/hooks/useDiagramAccess.ts` | Estado de solicitud de acceso al diagrama. | `request-access` |
| `frontend/src/hooks/useDiagramRole.ts` | Rol del usuario en el diagrama actual (`OWNER/EDITOR/VIEWER/NONE`). | `GET /api/diagrams/:id/role` |
| `frontend/src/hooks/useDiagramMembers.ts` | CRUD de miembros/ACL. | `GET/POST/PATCH/DELETE /api/diagrams/:id/members` |
| `frontend/src/hooks/useEditorSelection.ts` | Deriva nodo/arista seleccionados y el contexto para la IA. | `selectedElementForAI` |
| `frontend/src/hooks/useRelationMode.ts` | Modo “clic origen → clic destino” para crear relaciones. | `selectRelationType` |
| `frontend/src/hooks/useEdgeCreation.ts` | Crea la arista con el tipo UML correcto. | `createEdge` |
| `frontend/src/hooks/useAssociationEditing.ts` | Convierte/disuelve clase asociativa. | `buildAssociationNode` |
| `frontend/src/hooks/useNodeLocks.ts` | Soft-lock visual desde awareness; expira a 30 s. | `editing` |
| `frontend/src/hooks/usePanelSelection.ts` | Sincroniza selección de paneles con React Flow. | `setNodes/setEdges` de selección |
| `frontend/src/hooks/useHelpModal.ts` | Abre/cierra el manual y atajo F1. | `open`, `close` |
| `frontend/src/hooks/useAuth.ts` | Re-export de `AuthContext`. | Conveniencia de imports |

## 1.3. Frontend — componentes

| Archivo | Qué hace |
|---|---|
| `frontend/src/components/Palette.tsx` | Paleta de elementos y relaciones; iconos SVG, no emojis. |
| `frontend/src/components/Toolbar.tsx` | Acciones del editor: entidad, conexión, XMI, generar, chat, miembros, ayuda. |
| `frontend/src/components/diagram/EditorFlow.tsx` | Configura React Flow, tipos de nodo/arista y estilos. |
| `frontend/src/components/EntityNode.tsx` | Nodo único que dibuja clase/interfaz/abstracta/nota. |
| `frontend/src/components/EntityEditorPanel.tsx` | Edita nombre, atributos, métodos y estereotipo de una entidad. |
| `frontend/src/components/EdgeEditorPanel.tsx` | Edita tipo, cardinalidades y clase asociativa. |
| `frontend/src/components/UmlEdge.tsx` | Base visual de las aristas UML. |
| `frontend/src/components/AssociationEdge.tsx` | Asociación simple. |
| `frontend/src/components/InheritanceEdge.tsx` | Herencia con triángulo hueco. |
| `frontend/src/components/CompositionEdge.tsx` | Composición con rombo lleno. |
| `frontend/src/components/AggregationEdge.tsx` | Agregación con rombo vacío. |
| `frontend/src/components/DashedEdge.tsx` | Conector punteado de clase asociativa. |
| `frontend/src/components/edges/SelfLoopEdge.tsx` | Relación de una entidad consigo misma. |
| `frontend/src/components/AssociationClassConnector.tsx` | Overlay SVG que une la arista con la clase asociativa. |
| `frontend/src/components/ChatPanel.tsx` | Chat colaborativo, menciones, voz, imagen y configuración IA. |
| `frontend/src/components/AiConfigModal.tsx` | Selección Groq/Ollama y detección de modelos locales. |
| `frontend/src/components/HelpModal.tsx` | Manual embebido con búsqueda y Markdown. |
| `frontend/src/components/MembersPanel.tsx` | Miembros y roles del diagrama. |
| `frontend/src/components/PresencePanel.tsx` | Avatares de conectados. |
| `frontend/src/components/Toolbar.tsx` + `AppLogo.tsx` | Marca y navegación. |
| `frontend/src/components/Icons.tsx` | Iconos SVG inline compartidos; evita emojis. |
| `frontend/src/components/DiagramCard.tsx` | Tarjeta del dashboard. |
| `frontend/src/components/dashboard/DashboardDialog.tsx` | Diálogos crear/renombrar/eliminar. |
| `frontend/src/components/dashboard/AccessRequestsSection.tsx` | Solicitudes pendientes del owner. |
| `frontend/src/components/diagram/AuthGate.tsx` | Protege el editor si auth está activo. |
| `frontend/src/components/diagram/EditorAccessStatus.tsx` | Estado de acceso/solicitud. |
| `frontend/src/components/diagram/EditorPanels.tsx` | Orquesta paneles de entidad/arista. |

## 1.4. Frontend — utilidades, tipos y lib

| Archivo | Qué hace |
|---|---|
| `frontend/src/utils/ast.ts` | Canvas → AST y `applyMutations` de la IA. |
| `frontend/src/utils/yjsNodeHelpers.ts` | Nodo React Flow ↔ `Y.Map` anidado. |
| `frontend/src/utils/yjsEdgeHelpers.ts` | Arista React Flow ↔ `Y.Map`; mapea tipo visual vs semántico. |
| `frontend/src/utils/yjsDiagramIo.ts` | Import/export JSON y carga idempotente a Yjs. |
| `frontend/src/utils/yjsTeardown.ts` | Cierra provider y doc sin fugas. |
| `frontend/src/utils/chatMessage.ts` | Construye y deduplica mensajes. |
| `frontend/src/utils/chatMentions.ts` | Clasifica `@usuario` vs `@ai` vs texto normal. |
| `frontend/src/utils/xmiExporter.ts` | Canvas → XMI UML 2.5.1 + UMLDI + extensión EA. |
| `frontend/src/utils/xmiImporter.ts` | XMI → nodos/aristas del editor. |
| `frontend/src/utils/xmiParserUtils.ts` | Helpers de parseo XMI e IDs. |
| `frontend/src/utils/associationClass.ts` | Geometría y planes de conversión/disolución de clase asociativa. |
| `frontend/src/utils/floatingEdges.ts` | Aristas que apuntan al borde del nodo. |
| `frontend/src/utils/diagramExportImport.ts` | JSON de respaldo. |
| `frontend/src/utils/relationshipTypeMapper.ts` | Compatibilidad con diagramas legacy. |
| `frontend/src/lib/apiClient.ts` | `fetch` con JWT, `API_BASE`, token en `localStorage`. |
| `frontend/src/lib/presence.ts` | Identidad/color de presencia. |
| `frontend/src/lib/formatDate.ts` | Fechas del dashboard. |
| `frontend/src/contexts/AuthContext.tsx` | Estado global de sesión. |
| `frontend/src/types/diagram.ts` | Tipos de nodo, arista, atributos, métodos y IA. |
| `frontend/src/types/collaboration.ts` | `ChatMessage`, `ConnectedUser`. |
| `frontend/src/types/dashboard.ts` | Tipos del dashboard/ACL. |

## 1.5. Backend — núcleo

| Archivo | Qué hace | Por qué está separado |
|---|---|---|
| `backend/server.js` | Crea app, HTTP server, WebSocket, inicializa DB y apagado. | Es el composition root del proceso. |
| `backend/app.js` | Configura Express, middlewares, routers y errores. | Se puede testear sin abrir puerto. |
| `backend/db.js` | Pool PostgreSQL, SSL, transacciones, usuario anónimo. | Toda la persistencia pasa por aquí. |
| `backend/loadEnv.js` | Carga `.env.local` y luego `.env`. | `.env.local` tiene prioridad. |
| `backend/errors.js` | `AppError`, `httpError`, `asyncHandler`. | Centraliza errores. |
| `backend/validation.js` | Validación de auth, diagramas, IA, mutaciones y AST. | No confía en el cliente ni en el LLM. |
| `backend/middleware/auth.js` | JWT: `requireAuth`, `signToken`, `verifyToken`. | Autenticación stateless. |
| `backend/middleware/diagramAuth.js` | ACL por diagrama: member, role, write. | Autorización separada de autenticación. |
| `backend/middleware/errorHandler.js` | 404 y respuesta JSON de errores. | Evita filtrar stacks. |
| `backend/middleware/upload.js` | Multer para audio/imagen. | Límites de subida. |

## 1.6. Backend — rutas, servicios y realtime

| Archivo | Qué hace |
|---|---|
| `backend/routes/auth.js` | `POST /register`, `POST /login`, `GET /me`, `GET /status`. |
| `backend/routes/diagrams.js` | Listar/crear/leer/guardar/renombrar/eliminar diagramas. |
| `backend/routes/acl.js` | Rol, ACL, invitar, cambiar rol, quitar miembro. |
| `backend/routes/accessRequests.js` | Solicitar acceso, listar pendientes, aprobar/rechazar. |
| `backend/routes/ai.js` | `/command`, `/transcribe`, `/from-image`, `/ollama-models`. |
| `backend/routes/generator.js` | `POST /api/generate`: valida AST y devuelve ZIP. |
| `backend/services/userService.js` | Usuarios, bcrypt, login. |
| `backend/services/diagramService.js` | Diagramas, snapshots, transacciones y borrado. |
| `backend/services/aclService.js` | Lectura/escritura de ACL, roles, advisory lock. |
| `backend/services/chatService.js` | Persistencia y lectura de `chat.messages`. |
| `backend/services/accessRequestService.js` | Solicitudes y aprobación transaccional. |
| `backend/services/aiService.js` | Strategy Groq/Ollama, prompt, historial, parseo, errores. |
| `backend/realtime/yjs.js` | WebSocket, debounce, bindState, writeState, flush, chat. |

## 1.7. Backend — generador

| Archivo | Qué hace |
|---|---|
| `backend/generator/generate.js` | Orquesta sanitización, expansión, contextos, plantillas y ZIP. |
| `backend/generator/naming.js` | Nombres Java/SQL/rutas; keywords y acentos. |
| `backend/generator/expander.js` | N:M → entidad intermedia; cardinalidades. |
| `backend/generator/contextBuilder.js` | Relaciones JPA, herencia, FK, SQL, getters. |
| `backend/generator/typeMapper.js` | Tipos del editor → Java/SQL. |
| `backend/generator/templateEngine.js` | Registra helpers de Handlebars. |
| `backend/generator/packager.js` | Crea el ZIP con `archiver`. |
| `backend/generator/tests/inheritance.test.js` | Prueba de herencia JPA, PK natural y `clean.sql`. |
| `backend/generator/tests/association-class.test.js` | Prueba de clase asociativa y N:M. |
| `backend/generator/tests/fk-collision.test.js` | Prueba de colisión de columnas FK. |
| `backend/generator/tests/getters-setters.test.js` | Verifica getters/setters generados. |

### 1.7.1. `backend/generator/templates/`

| Plantilla | Genera |
|---|---|
| `pom.xml.hbs` | `pom.xml` Maven con Spring Boot 4, JPA, Security, Flyway, JJWT, LangChain4j. |
| `model.java.hbs` | Entidad JPA con `@Entity`, `@Table`, PK, columnas y relaciones. |
| `entity-intermediate.java.hbs` | Entidad intermedia de N:M con UUID y dos `@ManyToOne`. |
| `repository.java.hbs` | `JpaRepository`. |
| `service.java.hbs` | Servicio CRUD. |
| `controller.java.hbs` | `@RestController` con GET/POST/PUT/DELETE y `201` en POST. |
| `dto.java.hbs` | DTO con getters/setters. |
| `migration.sql.hbs` | `create table` de Flyway. |
| `application.properties.hbs` | Datasource, Hibernate, logging, JWT. |
| `README.md.hbs` | Instrucciones del backend generado. |
| `DemoApplication.java.hbs` | Clase `main`. |
| `GlobalExceptionHandler.java.hbs` | Manejo global de errores Java. |
| `security/*.hbs` | `SecurityConfig`, `JwtService`, filtro, auth y user details. |
| `ai/*.hbs` | Consulta IA local con LangChain4j e intent classifier. |

## 1.8. Configuración y por qué es vital

| Archivo | Contenido | Riesgo si falta |
|---|---|---|
| `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `AUTH_ENABLED`, `PORT`, `GROQ_*`, `OLLAMA_*`. | Sin DB o sin secreto, el backend no arranca/autentica. |
| `backend/.env.local` | Override local; tiene prioridad sobre `.env`. | Si apunta a otra DB, ves datos “perdidos”. |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`. | El frontend no encuentra REST/WebSocket. |
| `frontend/package.json` | Next 16.3.3, React 19.2.8, React Flow 11.11.4, Yjs 13.6.32. | Define el runtime real. |
| `backend/package.json` | Express 4, `pg` 8, `ws` 8, Yjs, `y-websocket`, bcrypt, JWT, Handlebars, archiver. | Define el runtime real. |
| `backend/generator/templates/pom.xml.hbs` | Spring Boot 4.0.0, Java 21, Flyway 12, JJWT 0.12.6, LangChain4j 0.35. | Define el backend generado. |
| `backend/scripts/access_requests.sql` | DDL de solicitudes. | Faltaría la tabla de Fase 3. |
| `Documentacion_Segundo_Parcial/04_Diseno_UML.md` | DDL de referencia completo. | Es la fuente para recrear Neon. |

## 1.9. Variables de entorno exactas

### Backend (`backend/.env`)

| Variable | Ejemplo | Obligatoria | Para qué |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Sí | Pool PostgreSQL/Neon. |
| `PORT` | `1234` | No | Puerto HTTP/WS. |
| `AUTH_ENABLED` | `true` | Sí en producción | Exige JWT; `false` abre modo demo. |
| `JWT_SECRET` | 64 hex | Sí | Firma JWT; mínimo 32 caracteres. |
| `JWT_EXPIRATION` | `7d` | No | Expiración del token. |
| `AI_PROVIDER` | `groq` / `ollama` | No | Proveedor por defecto. |
| `GROQ_API_KEY` | `gsk_...` | Si Groq | Autenticación con Groq. |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | No | Modelo de texto. |
| `GROQ_VISION_MODEL` | `qwen/qwen3.8-27b` | No | Modelo para imagen. |
| `OLLAMA_URL` | `http://localhost:11434/v1` | Si Ollama | Endpoint local. |
| `OLLAMA_MODEL` | `llama3` | Si Ollama | Modelo local. |
| `OLLAMA_VISION_MODEL` | `llava` | No | Modelo visual local. |
| `PG_POOL_MAX` | `10` | No | Tamaño del pool. |

### Frontend (`frontend/.env.local`)

| Variable | Ejemplo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:1234` | Base de `fetch` REST. |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:1234` | Base del WebSocket Yjs. |

> `NEXT_PUBLIC_*` se expone al navegador. Nunca pongas secretos ahí. `backend/loadEnv.js` carga `.env.local` antes que `.env`; si ambos existen, gana `.env.local`.

---

# PARTE 2: El Mapa de la Interfaz de Usuario (De la UI al Código)

## 2.1. Hacer login: del botón a Neon

**Ruta real:** `frontend/src/app/login/page.tsx` (no existe `LoginView.tsx`).

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant L as login/page.tsx
    participant A as AuthContext
    participant C as apiClient.ts
    participant R as routes/auth.js
    participant V as validation.js
    participant S as userService.js
    participant D as db.js
    participant N as Neon auth.users

    U->>L: Escribe usuario/contraseña y click "Entrar"
    L->>A: login(username,password)
    A->>R: fetch POST /api/auth/login (directo)
    R->>V: validateLoginBody(body)
    V-->>R: {ok,value} o error
    R->>S: verifyPassword(username,password)
    S->>D: pool.query SELECT password_hash
    D->>N: SQL parametrizado
    N-->>D: row
    D-->>S: usuario
    S->>S: bcrypt.compare
    S-->>R: usuario seguro (sin hash)
    R->>R: signToken(user)
    R-->>A: {token,user}
    A->>C: setToken(localStorage)
    A->>L: setUser(user)
    L->>L: router.push('/dashboard')
```

**Paso a paso:**

1. `login/page.tsx` maneja `handleSubmit`, limpia error y activa `loading`.
2. `AuthContext.login` hace `fetch` directo a `${API_BASE}/api/auth/login`; al éxito guarda el token con `setToken`.
3. `apiClient.ts` guarda el token en `localStorage` bajo `case-tool:token` y lo adjunta en cada request con `Authorization: Bearer`.
4. `routes/auth.js` valida entrada con `validateLoginBody` y llama `userService.verifyPassword`.
5. `userService.js` busca por `lower(username) = lower($1)` con SQL parametrizado.
6. `bcrypt.compare` compara el intento con `password_hash`; nunca se desencripta.
7. `signToken` firma un JWT con `userId`, `username` y expiración.
8. `AuthContext` actualiza `user`; `login/page.tsx` navega a `/dashboard`.

**Por qué el login no guarda sesión en DB:** el JWT es stateless. El servidor verifica firma y expiración. **Tradeoff:** no hay revocación inmediata; se mitiga con expiración y rotación de secreto.

## 2.2. Mover un nodo: React Flow → Yjs → WebSocket → Neon

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant RF as EditorFlow.tsx
    participant CF as useCollaborativeFlow.ts
    participant YH as yjsNodeHelpers.ts
    participant Y as Y.Doc (navegador)
    participant WS as y-websocket
    participant SRV as realtime/yjs.js
    participant DS as diagramService.js
    participant DB as Neon core.diagrams

    U->>RF: Arrastra nodo
    RF->>CF: onNodesChange / onNodeDragStop
    CF->>CF: applyNodeChanges local (feedback visual)
    CF->>YH: updateNode(id,{position})
    YH->>Y: Y.Map.set('x'/'y')
    Y->>WS: update binario
    WS->>SRV: sync message
    SRV->>SRV: ydoc.on('update') -> scheduleSnapshot
    Note over SRV: debounce 2 s
    SRV->>DS: saveSnapshot(diagramId, Y.encodeStateAsUpdate)
    DS->>DB: UPDATE yjs_snapshot=$2
    Note over DS,DB: Buffer.from(Uint8Array) -> BYTEA
    U->>RF: Cierra/recarga pestaña
    CF->>WS: {"type":"flush-snapshot"}
    WS->>SRV: readFlushControl
    SRV->>DS: flushDiagramSnapshot
    DS->>DB: UPDATE inmediato
```

**Paso a paso:**

1. `EditorFlow.tsx` entrega `onNodesChange` y `onNodeDragStop` a React Flow.
2. `useCollaborativeFlow.ts` aplica cambios locales para que el arrastre no se sienta lento.
3. Al soltar, `yUpdateNode` escribe la posición final en el `Y.Map` del nodo.
4. Yjs emite un update binario y `WebsocketProvider` lo envía.
5. `backend/realtime/yjs.js` aplica el update al `Y.Doc` del servidor.
6. `scheduleSnapshot` reinicia el timer de 2 s.
7. Al vencer, `Y.encodeStateAsUpdate` serializa el documento completo.
8. `saveSnapshot` hace `UPDATE core.diagrams SET yjs_snapshot = $2`.
9. Al cerrar/recargar, `requestFlush` envía un JSON de control y el backend guarda sin esperar el debounce.

**Clave de autoría:** React Flow **no** es la fuente de verdad. `page.tsx` pasa `nodes={nodes}` y `edges={edges}` desde `useCollaborativeFlow`; no hay `useNodesState` en la página.

## 2.3. Usar la IA: del chat a Groq y de vuelta al diagrama

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant CP as ChatPanel.tsx
    participant AC as useAICommand.ts
    participant API as routes/ai.js
    participant V as validation.js
    participant AI as aiService.js
    participant G as Groq/Ollama
    participant Y as Yjs

    U->>CP: Escribe comando y Enter
    CP->>AC: onSendCommand()
    AC->>AC: classifyChatMessage()
    alt @usuario conectado
        AC->>Y: addMessage('user', texto)
        Note over AC,Y: No se llama a la IA
    else @ai o texto normal
        AC->>AC: nodesToAST(nodes,edges)
        AC->>API: POST /api/ai/command
        API->>V: validateCommandPayload
        API->>AI: getMutationsFromAI(...)
        AI->>G: POST /chat/completions
        G-->>AI: content JSON
        AI-->>API: {mutations,response}
        API->>V: validateMutations
        V-->>API: mutaciones saneadas
        API-->>AC: {mutations,response,chatEmitted}
        AC->>AC: applyMutations(mutations,hooks)
        AC->>Y: addNode/updateNode/addEdge
        API->>Y: emitChatMessage (respuesta IA)
    end
```

**Paso a paso:**

1. `ChatPanel.tsx` captura Enter y llama `onSendCommand`.
2. `useAICommand.ts` clasifica mencion: `@usuario` conectado va solo a Yjs; `@ai`, `@ia` o texto normal va a IA.
3. Para IA, `nodesToAST` convierte nodos/aristas en `{entities,relationships}`.
4. `apiFetch` envía `command`, `currentState`, `diagramId`, `selectedElement` y proveedor.
5. `routes/ai.js` valida payload y ACL; recupera últimos 15 mensajes y persiste el mensaje del usuario.
6. `aiService.js` arma `systemPrompt` + `userContent` y llama `provider.baseUrl/chat/completions`.
7. El modelo devuelve `{response, mutations}`.
8. `validateMutations` verifica allowlist, tipos, cardinalidades y límite de 200.
9. El frontend aplica mutaciones en orden: entidades, atributos, relaciones, borrados.
10. El backend emite la respuesta al `Y.Array('chat')` para que todos la vean; `chatEmitted` evita duplicado local.

## 2.4. Generar backend: del botón al ZIP

**Ruta real:** `Toolbar.tsx` → `page.tsx` → `useDiagramIo.ts` → `POST /api/generate` → `routes/generator.js` → `generate.js` → Handlebars → ZIP.

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant T as Toolbar.tsx
    participant P as page.tsx
    participant IO as useDiagramIo.ts
    participant R as routes/generator.js
    participant V as validation.js
    participant G as generator/generate.js
    participant H as Handlebars
    participant Z as ZIP

    U->>T: Click "Generar"
    T->>P: onGenerateBackend()
    P->>IO: handleGenerateBackend()
    IO->>IO: nodesToAST(nodes,edges)
    IO->>R: POST /api/generate {currentState}
    R->>V: validateAstState(requireEntities:true)
    V-->>R: AST válido
    R->>G: generateProject(ast)
    G->>G: sanitize/normalize/expand
    G->>H: render templates
    H-->>G: archivos Java/SQL
    G->>Z: createZip()
    Z-->>R: ruta temporal
    R-->>IO: application/zip
    IO->>U: descarga backend-generado.zip
```

**Paso a paso:**

1. `Toolbar.tsx` llama la prop `onGenerateBackend`.
2. `page.tsx` usa `useDiagramIo` para ejecutar `handleGenerateBackend`.
3. `useDiagramIo.ts` convierte canvas a AST y hace `POST /api/generate`.
4. `routes/generator.js` valida que exista al menos una entidad y que el AST sea seguro.
5. `generator/generate.js` sanitiza nombres, normaliza relaciones, expande N:M, construye contextos y escribe archivos.
6. Handlebars renderiza `model.java.hbs`, `controller.java.hbs`, `pom.xml.hbs`, etc.
7. `packager.js` comprime todo en ZIP.
8. `routes/generator.js` descarga el ZIP y elimina el directorio temporal al terminar.

---

# PARTE 3: La Anatomía de la Base de Datos (Tabla por Tabla)

## 3.1. Los tres esquemas

| Esquema | Responsabilidad | Analogía |
|---|---|---|
| `auth` | Identidad, permisos y solicitudes. | La recepción del edificio: quién eres y qué llaves tienes. |
| `core` | Ciclo de vida del diagrama y snapshot Yjs. | La sala de archivos: el documento completo. |
| `chat` | Historial de conversación con IA. | El cuaderno de actas de la sala. |

```mermaid
classDiagram
    class USERS {
        +uuid id
        +varchar username
        +varchar email
        +varchar password_hash
        +timestamptz created_at
    }
    class DIAGRAMS {
        +varchar id
        +varchar name
        +uuid owner_id
        +bytea yjs_snapshot
        +timestamptz created_at
        +timestamptz updated_at
    }
    class DIAGRAM_ACL {
        +uuid id
        +varchar diagram_id
        +uuid user_id
        +varchar role
        +timestamptz granted_at
    }
    class MESSAGES {
        +uuid id
        +varchar diagram_id
        +varchar author
        +varchar role
        +text content
        +timestamptz created_at
    }
    class ACCESS_REQUESTS {
        +uuid id
        +varchar diagram_id
        +uuid requester_id
        +varchar status
        +timestamptz created_at
    }
    USERS "1" --> "0..*" DIAGRAMS : owner_id
    USERS "1" --> "0..*" DIAGRAM_ACL : user_id
    DIAGRAMS "1" --> "0..*" DIAGRAM_ACL : diagram_id (sin FK)
    DIAGRAMS "1" --> "0..*" MESSAGES : diagram_id
    DIAGRAMS "1" --> "0..*" ACCESS_REQUESTS : diagram_id
    USERS "1" --> "0..*" ACCESS_REQUESTS : requester_id
```

## 3.2. `auth.users`

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `username` | `varchar` | `NOT NULL`, `UNIQUE` |
| `email` | `varchar` | `NOT NULL`, `UNIQUE` |
| `password_hash` | `varchar` | `NOT NULL`; bcrypt, nunca texto plano |
| `created_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

**Quién la lee/escribe:**

- `backend/services/userService.js`: `createUser`, `findByUsername`, `findByEmail`, `findById`.
- `backend/db.js`: `ensureAnonymousUser`.
- `backend/routes/auth.js`: registro/login.
- `backend/services/aclService.js` y `diagramService.js`: joins para mostrar `owner_username`.

**Por qué está en `auth`:** la identidad es un dominio separado de los diagramas. No debe mezclarse con el snapshot.

## 3.3. `core.diagrams`

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `varchar` | PK generada por app, ej. `diagram-...` |
| `name` | `varchar` | `NOT NULL` |
| `owner_id` | `uuid` | FK a `auth.users(id)` `ON DELETE CASCADE` |
| `yjs_snapshot` | `bytea` | Documento CRDT completo |
| `created_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

**Quién la lee/escribe:**

- `backend/services/diagramService.js`: `createDiagramWithOwner`, `getDiagram`, `listVisibleForUser`, `saveSnapshot`, `getSnapshot`, `renameDiagram`, `touchDiagram`, `deleteDiagram`.
- `backend/realtime/yjs.js`: carga/guarda snapshots.
- `backend/services/chatService.js`: FK de mensajes.

**Por qué está en `core`:** es el agregado principal del producto. El grafo no se normaliza; se guarda como `BYTEA`.

## 3.4. `auth.diagram_acl`

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `diagram_id` | `varchar` | `NOT NULL`; **sin FK física** |
| `user_id` | `uuid` | FK a `auth.users(id)` `ON DELETE CASCADE` |
| `role` | `varchar` | `NOT NULL`, CHECK `OWNER/EDITOR/VIEWER` |
| `granted_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

**Restricción única:** `(diagram_id, user_id)`.

**Quién la lee/escribe:**

- `backend/services/aclService.js`: `readACL`, `getRoleForUser`, `addMember`, `removeMember`, `writeACL`, `getOrCreateACL`.
- `backend/middleware/diagramAuth.js`: `resolveRole`.
- `backend/routes/acl.js`: miembros.
- `backend/routes/diagrams.js`: crear diagrama + owner.
- `backend/realtime/yjs.js`: validar acceso a la sala.

**Por qué está en `auth`:** el rol es una relación entre usuario y diagrama; pertenece al dominio de permisos. **No hay FK a `core.diagrams`** para no acoplar `auth` con `core`; `deleteDiagram` limpia la ACL en una transacción.

## 3.5. `chat.messages`

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `diagram_id` | `varchar` | FK a `core.diagrams(id)` `ON DELETE CASCADE` |
| `author` | `varchar` | `NOT NULL` |
| `role` | `varchar` | `NOT NULL`, CHECK `user/assistant/system` |
| `content` | `text` | `NOT NULL` |
| `created_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

**Quién la lee/escribe:**

- `backend/services/chatService.js`: `addMessage`, `getRecentMessages`, `toWireMessage`.
- `backend/routes/ai.js`: guarda mensaje del usuario y respuesta IA.
- `backend/routes/diagrams.js`: hidrata el chat al abrir el diagrama.
- `backend/services/aiService.js`: `formatChatHistory` lee los últimos 15.

**Por qué está en `chat`:** necesita consultas, orden cronológico, auditoría y memoria de IA. No es un documento CRDT; es una tabla relacional.

## 3.6. `auth.access_requests`

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `diagram_id` | `varchar` | `NOT NULL`, FK a `core.diagrams(id)` `ON DELETE CASCADE` |
| `requester_id` | `uuid` | `NOT NULL`, FK a `auth.users(id)` `ON DELETE CASCADE` |
| `status` | `varchar` | `NOT NULL`, `DEFAULT 'PENDING'`, CHECK `PENDING/APPROVED/REJECTED` |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

**Índices:**

- único parcial `(diagram_id, requester_id) WHERE status = 'PENDING'`;
- `(diagram_id, status)`;
- `(requester_id)`.

**Quién la lee/escribe:**

- `backend/services/accessRequestService.js`: `createRequest`, `listPendingForOwner`, `respondToRequest`.
- `backend/routes/accessRequests.js`.

**Por qué está en `auth`:** una solicitud es una regla de acceso, no parte del documento. El índice parcial impide dos solicitudes PENDING del mismo usuario al mismo diagrama.

## 3.7. DDL de referencia

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar NOT NULL UNIQUE,
  email varchar NOT NULL UNIQUE,
  password_hash varchar NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE core.diagrams (
  id varchar PRIMARY KEY,
  name varchar NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  yjs_snapshot bytea,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth.diagram_acl (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  granted_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (diagram_id, user_id)
);

CREATE TABLE chat.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar REFERENCES core.diagrams(id) ON DELETE CASCADE,
  author varchar NOT NULL,
  role varchar NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth.access_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL REFERENCES core.diagrams(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX access_requests_pending_unique
  ON auth.access_requests (diagram_id, requester_id)
  WHERE status = 'PENDING';

CREATE INDEX access_requests_diagram_status_idx
  ON auth.access_requests (diagram_id, status);

CREATE INDEX access_requests_requester_idx
  ON auth.access_requests (requester_id);
```

## 3.8. Ciclo de vida de un diagrama

```mermaid
stateDiagram-v2
    [*] --> BORRADOR: createDiagramWithOwner
    BORRADOR --> SINCRONIZADO: primer saveSnapshot
    SINCRONIZADO --> SINCRONIZADO: updates + debounce 2 s
    SINCRONIZADO --> FLUSH: beforeunload / pagehide
    FLUSH --> SINCRONIZADO: UPDATE exitoso
    SINCRONIZADO --> ELIMINADO: deleteDiagram
    ELIMINADO --> [*]
```

> El estado `BORRADOR` es lógico: el esquema real no tiene columna `state`; se deriva de `yjs_snapshot IS NULL`. No lo presentes como columna existente.

---

# PARTE 4: El Código Línea por Línea (Los 5 Métodos Más Importantes)

> En los desgloses, “Línea N” se cuenta **dentro del fragmento pegado**, no respecto al archivo completo. La ubicación real del método está en el encabezado de cada sección.

## 4.1. `saveSnapshot` — `backend/services/diagramService.js:220-229`

**Qué hace:** guarda el documento Yjs completo en `core.diagrams.yjs_snapshot` como `BYTEA`.

```javascript
async function saveSnapshot(diagramId, update) {
  const id = safeId(diagramId);
  if (!id || !update) return;
  await pool.query(
    `UPDATE core.diagrams
     SET yjs_snapshot = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, Buffer.from(update)]
  );
}
```

**Desglose forense:**

- **Línea 1:** `async` porque `pool.query` devuelve una promesa. Si se olvida `await`, la función termina antes de escribir.
- **Línea 2:** `safeId` elimina caracteres raros del id. Es defensa en profundidad aunque el id ya venga validado.
- **Línea 3:** si no hay id o no hay snapshot, no se ejecuta SQL. Evita un `UPDATE` con `undefined`.
- **Línea 4:** `UPDATE`, no `INSERT`: el diagrama ya existe; solo cambia su foto.
- **Línea 5:** `yjs_snapshot = $2`: el binario va como parámetro, nunca concatenado.
- **Línea 6:** `updated_at = CURRENT_TIMESTAMP`: el dashboard ordena por actividad reciente.
- **Línea 7:** `WHERE id = $1`: solo actualiza esa fila.
- **Línea 8:** `[id, Buffer.from(update)]`: `update` es `Uint8Array`; `pg` necesita `Buffer` para `BYTEA`.
- **Línea 9:** cierre.

**Qué pasaría sin `Buffer.from`:** `pg` podría interpretar el `Uint8Array` de forma inesperada o fallar; el binario no llegaría igual a PostgreSQL.

**Qué pasaría sin debounce:** cada movimiento del mouse haría un `UPDATE`; con varios usuarios, el pool y Neon se saturarían.

---

## 4.2. `validateMutations` — `backend/validation.js:288-361`

**Qué hace:** convierte la salida del LLM en una lista segura de acciones permitidas. No confía en el modelo.

```javascript
function validateMutations(raw) {
  if (!Array.isArray(raw)) return fail('mutations debe ser un arreglo');
  if (raw.length > MAX_MUTATIONS) return fail('La IA devolvió demasiadas mutaciones');

  const mutations = [];
  for (const item of raw) {
    if (!isPlainObject(item) || !MUTATION_ACTIONS.has(item.action)) {
      return fail('La IA devolvió una acción no permitida');
    }

    if (item.action === 'addEntity') {
      const entityName = stringValue(item.entityName);
      if (!entityName) return fail('addEntity necesita entityName');
      const attributes = validateAttributeList(item.attributes);
      if (!attributes.ok) return attributes;
      mutations.push({ action: item.action, entityName, attributes: attributes.value });
      continue;
    }

    if (item.action === 'addAttribute') {
      const entityName = stringValue(item.entityName);
      if (!entityName) return fail('addAttribute necesita entityName');
      const attribute = validateAttribute(item.attribute);
      if (!attribute.ok) return attribute;
      mutations.push({ action: item.action, entityName, attribute: attribute.value });
      continue;
    }

    if (item.action === 'removeEntity') {
      const entityName = stringValue(item.entityName);
      if (!entityName) return fail('removeEntity necesita entityName');
      mutations.push({ action: item.action, entityName });
      continue;
    }

    if (item.action === 'addRelationship') {
      const sourceEntity = stringValue(item.sourceEntity);
      const targetEntity = stringValue(item.targetEntity);
      const type = stringValue(item.type, { max: 40 });
      if (!sourceEntity || !targetEntity) return fail('addRelationship necesita ambos extremos');
      if (!type || !RELATIONSHIP_TYPES.has(type)) return fail('addRelationship tiene un tipo inválido');

      const cardinalityFrom = item.cardinalityFrom === undefined
        ? undefined
        : stringValue(item.cardinalityFrom, { max: 20 });
      const cardinalityTo = item.cardinalityTo === undefined
        ? undefined
        : stringValue(item.cardinalityTo, { max: 20 });
      if (item.cardinalityFrom !== undefined && !cardinalityFrom) return fail('Cardinalidad inválida');
      if (item.cardinalityTo !== undefined && !cardinalityTo) return fail('Cardinalidad inválida');

      const intermediateAttributes = validateAttributeList(item.intermediateAttributes);
      if (!intermediateAttributes.ok) return intermediateAttributes;

      mutations.push({
        action: item.action,
        sourceEntity,
        targetEntity,
        type,
        ...(cardinalityFrom ? { cardinalityFrom } : {}),
        ...(cardinalityTo ? { cardinalityTo } : {}),
        ...(intermediateAttributes.value.length ? { intermediateAttributes: intermediateAttributes.value } : {}),
      });
      continue;
    }

    const sourceEntity = stringValue(item.sourceEntity);
    const targetEntity = stringValue(item.targetEntity);
    if (!sourceEntity || !targetEntity) return fail('removeRelationship necesita ambos extremos');
    mutations.push({ action: item.action, sourceEntity, targetEntity });
  }

  return ok(mutations);
}
```

**Desglose forense:**

- **Línea 2:** `Array.isArray`: si el LLM devuelve un objeto en vez de un array, se rechaza.
- **Línea 3:** `MAX_MUTATIONS = 200`: evita que un comando intente miles de cambios.
- **Línea 5:** `mutations`: aquí se construye la copia saneada.
- **Línea 6:** recorre cada acción propuesta.
- **Línea 7:** `isPlainObject` + `MUTATION_ACTIONS`: allowlist de cinco acciones. Si el LLM inventa `dropTable`, se rechaza.
- **Línea 11:** `addEntity`: exige `entityName` y valida atributos.
- **Línea 12:** `stringValue`: recorta, limita longitud y exige string.
- **Línea 13:** `validateAttributeList`: valida nombres, tipos, PK, nullable, unique.
- **Línea 14:** `push`: guarda solo campos conocidos; el resto se descarta.
- **Línea 15:** `continue`: pasa a la siguiente mutación.
- **Línea 18:** `addAttribute`: entidad + atributo.
- **Línea 25:** `removeEntity`: solo nombre.
- **Línea 31:** `addRelationship`: exige ambos extremos y tipo.
- **Línea 34:** `RELATIONSHIP_TYPES`: `ASSOCIATION`, `AGGREGATION`, `COMPOSITION`, `INHERITANCE`, `ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `MANY_TO_MANY`.
- **Línea 36-41:** cardinalidades opcionales, máximo 20 caracteres.
- **Línea 43:** atributos intermedios de una clase asociativa.
- **Línea 46-53:** objeto final con solo campos permitidos.
- **Línea 56:** `removeRelationship`: ambos extremos.
- **Línea 61:** devuelve `ok(mutations)`, no `raw`.

**El “por qué”:** el prompt puede pedir JSON, pero un LLM no es una garantía. La allowlist y la validación estructural son deterministas.

**El “por qué NO”:** no se valida solo con el prompt ni con `temperature: 0.1`; eso reduce probabilidad, no elimina alucinación.

---

## 4.3. `expandManyToMany` — `backend/generator/expander.js:76-173`

**Qué hace:** convierte una relación `*` a `*` en una entidad intermedia con UUID y dos `@ManyToOne`.

```javascript
function expandManyToMany(entities, relationships, takenNames) {
  const allEntities = [...(entities || [])];
  const allRelationships = [];
  const intermediates = [];
  const taken = takenNames instanceof Set ? takenNames : new Set(
    (entities || []).map(e => e.name)
  );

  for (const rel of relationships || []) {
    if (!isManyToManyRel(rel)) {
      allRelationships.push(rel);
      continue;
    }

    const from = relFromName(rel, entities);
    const to = relToName(rel, entities);
    if (!from || !to) {
      allRelationships.push(rel);
      continue;
    }

    let intermediateEntity = isValidJavaIdentifier(rel.intermediateEntity)
      ? rel.intermediateEntity
      : `${toJavaClassName(from)}${toJavaClassName(to)}`;
    if (taken.has(intermediateEntity)) {
      const base = intermediateEntity;
      let n = 2;
      while (taken.has(base + n)) n++;
      intermediateEntity = base + n;
    }
    taken.add(intermediateEntity);
    const intermediateTable = /^[a-z0-9_]+$/.test(rel.intermediateTable || '')
      ? rel.intermediateTable
      : `${snakeCase(intermediateEntity)}`;
    const intermediateAttributes = (rel.intermediateAttributes || []).map(a => ({ ...a }));

    intermediates.push({
      name: intermediateEntity,
      tableName: intermediateTable,
      isAssociationClass: !!rel.isAssociationClass,
      fromEntity: from,
      toEntity: to,
      fromEntityLower: toLowerFirst(from),
      toEntityLower: toLowerFirst(to),
      fromEntitySnake: snakeCase(from),
      toEntitySnake: snakeCase(to),
      intermediateAttributes,
      sourceRelationshipId: rel.id,
    });

    allEntities.push({
      id: `intermediate_${rel.id || intermediateEntity}`,
      name: intermediateEntity,
      originalName: intermediateEntity,
      tableName: intermediateTable,
      fieldName: camelCase(intermediateEntity),
      route: `${intermediateTable}s`,
      attributes: [
        { id: `pk_${intermediateEntity}`, name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
        ...intermediateAttributes,
      ],
      intermediateOf: rel.id,
      intermediateTable,
    });

    allRelationships.push({
      id: `${rel.id || intermediateEntity}_a`,
      source: { entityName: intermediateEntity },
      target: { entityName: from },
      fromEntity: intermediateEntity,
      toEntity: from,
      type: 'MANY_TO_ONE',
      cardinalityFrom: '*',
      cardinalityTo: '1',
      synthetic: true,
    });
    allRelationships.push({
      id: `${rel.id || intermediateEntity}_b`,
      source: { entityName: intermediateEntity },
      target: { entityName: to },
      fromEntity: intermediateEntity,
      toEntity: to,
      type: 'MANY_TO_ONE',
      cardinalityFrom: '*',
      cardinalityTo: '1',
      synthetic: true,
    });
  }

  return { allEntities, allRelationships, intermediates };
}
```

**Desglose forense:**

- **Línea 2:** copia de entidades; no muta el AST original.
- **Línea 3:** aquí se acumulan las relaciones finales.
- **Línea 4:** metadatos de intermedias para DTO/config.
- **Línea 5-7:** set de nombres ocupados para evitar colisiones.
- **Línea 9:** recorre todas las relaciones.
- **Línea 10-12:** si no es N:M, se conserva tal cual.
- **Línea 14-15:** resuelve extremos por id, nombre visible o nombre sanitizado.
- **Línea 16-19:** si falta un extremo, degrada sin romper: conserva la relación original.
- **Línea 21-23:** usa el nombre de la clase asociativa si es Java válido; si no, `OrigenDestino`.
- **Línea 24-29:** si el nombre ya existe, agrega `2`, `3`, etc.
- **Línea 30:** reserva el nombre.
- **Línea 31-33:** tabla snake_case o nombre válido provisto.
- **Línea 34:** copia atributos de la relación.
- **Línea 36-48:** registra metadatos de la intermedia.
- **Línea 50-62:** crea una entidad real con PK UUID y atributos.
- **Línea 64-73:** crea relación sintética `intermedia(*) → from(1)`.
- **Línea 74-83:** crea relación sintética `intermedia(*) → to(1)`.
- **Línea 86:** devuelve todo al pipeline.

**Por qué NO `@ManyToMany`:**

| Criterio | `@ManyToMany` | Entidad intermedia |
|---|---|---|
| Atributos extra en la relación | No | Sí |
| Ciclos JSON | Riesgo | Controlable |
| Repositorio/DTO propio | No | Sí |
| Fidelidad UML | Baja | Alta (clase asociativa) |

---

## 4.4. `applyMutations` — `frontend/src/utils/ast.ts:194-317`

**Qué hace:** aplica las mutaciones validadas de la IA al canvas colaborativo, resolviendo nombres a IDs y respetando un orden seguro.

```typescript
export function applyMutations(mutations: any[], hooks: any) {
  const entityNameToId: Record<string, string> = {};
  const nodeDataById: Record<string, any> = {};

  for (const mutation of mutations.filter((m: any) => m.action === 'addEntity')) {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const attributes = (mutation.attributes || []).map((attr: any, index: number) => ({
      id: `attr_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      name: attr.name,
      type: attr.type || 'String',
      isPk: attr.isPk || false,
      nullable: attr.nullable !== false,
      unique: attr.unique || false,
    }));
    const data = {
      label: mutation.entityName,
      attributes,
    };
    hooks.addNode({
      id,
      type: 'entity',
      position: { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 },
      data,
    });
    entityNameToId[mutation.entityName] = id;
    nodeDataById[id] = data;
  }

  function resolveEntityId(name: string): string | null {
    if (entityNameToId[name]) return entityNameToId[name];
    const node = hooks.nodes.find((n: any) => n.data.label === name);
    return node ? node.id : null;
  }

  function resolveNodeData(nodeId: string): any | null {
    if (nodeDataById[nodeId]) return nodeDataById[nodeId];
    const node = hooks.nodes.find((n: any) => n.id === nodeId);
    if (!node) return null;
    nodeDataById[nodeId] = node.data;
    return node.data;
  }

  for (const mutation of mutations.filter((m: any) => m.action === 'addAttribute')) {
    const nodeId = resolveEntityId(mutation.entityName);
    if (!nodeId) {
      console.warn(`Entidad no encontrada: ${mutation.entityName}`);
      continue;
    }
    const data = resolveNodeData(nodeId);
    if (!data) continue;
    const newAttr = {
      id: `attr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: mutation.attribute.name,
      type: mutation.attribute.type || 'String',
      isPk: mutation.attribute.isPk || false,
      nullable: mutation.attribute.nullable !== false,
      unique: mutation.attribute.unique || false,
    };
    const updated = { ...data, attributes: [...(data.attributes || []), newAttr] };
    nodeDataById[nodeId] = updated;
    hooks.updateNode(nodeId, { data: updated });
  }

  for (const mutation of mutations.filter((m: any) => m.action === 'addRelationship')) {
    const sourceId = resolveEntityId(mutation.sourceEntity);
    const targetId = resolveEntityId(mutation.targetEntity);
    if (!sourceId || !targetId) {
      console.warn(`No se encontraron entidades para la relación: ${mutation.sourceEntity} -> ${mutation.targetEntity}`);
      continue;
    }
    const relationshipType: string = mutation.type || 'ASSOCIATION';
    const reactFlowEdgeType = relationshipToReactFlow[relationshipType] || 'association';
    hooks.addEdge({
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: sourceId,
      target: targetId,
      type: reactFlowEdgeType,
      data: {
        type: relationshipType,
        cardinalityFrom: mutation.cardinalityFrom,
        cardinalityTo: mutation.cardinalityTo,
        intermediateAttributes: mutation.intermediateAttributes || [],
      },
    });
  }

  for (const mutation of mutations.filter((m: any) => m.action === 'removeRelationship')) {
    const sourceId = resolveEntityId(mutation.sourceEntity);
    const targetId = resolveEntityId(mutation.targetEntity);
    if (!sourceId || !targetId) {
      console.warn(`No se encontraron entidades para eliminar relación: ${mutation.sourceEntity} -> ${mutation.targetEntity}`);
      continue;
    }
    const edge = hooks.edges.find(
      (e: any) => e.source === sourceId && e.target === targetId
    );
    if (edge) {
      hooks.removeEdge(edge.id);
    } else {
      console.warn(`Relación no encontrada: ${mutation.sourceEntity} -> ${mutation.targetEntity}`);
    }
  }

  for (const mutation of mutations.filter((m: any) => m.action === 'removeEntity')) {
    const nodeId = resolveEntityId(mutation.entityName);
    if (nodeId) {
      hooks.removeNode(nodeId);
    } else {
      console.warn(`Entidad no encontrada para eliminar: ${mutation.entityName}`);
    }
  }
}
```

**Desglose forense:**

- **Línea 1:** `entityNameToId` resuelve nombres del LLM a IDs del canvas.
- **Línea 2:** `nodeDataById` es un snapshot local; `hooks.nodes` no refleja lo que se acaba de crear.
- **Línea 4:** **primero** todas las entidades. Sin esto, un atributo o relación no encontraría su entidad.
- **Línea 5:** ID único con timestamp + random.
- **Línea 6-12:** normaliza atributos con defaults seguros.
- **Línea 13-16:** crea el nodo en posición aleatoria.
- **Línea 17:** `hooks.addNode` escribe en Yjs (no solo en React).
- **Línea 18-19:** registra el nombre y el data local para mutaciones encadenadas.
- **Línea 22-26:** `resolveEntityId`: primero el mapa local, luego el snapshot de `hooks.nodes`.
- **Línea 28-33:** `resolveNodeData`: primero data local, luego snapshot.
- **Línea 35:** **segundo** atributos. La entidad ya existe.
- **Línea 36-39:** si no encuentra la entidad, `console.warn` y continúa; no rompe todo el lote.
- **Línea 40-42:** si no hay data, no puede agregar.
- **Línea 43-50:** crea atributo con defaults.
- **Línea 51-53:** actualiza data local y Yjs.
- **Línea 55:** **tercero** relaciones. Ambos extremos ya existen.
- **Línea 56-59:** resuelve IDs.
- **Línea 60-61:** mapea tipo semántico (`MANY_TO_ONE`) a tipo visual (`association`).
- **Línea 62-72:** `addEdge` con datos de cardinalidad y atributos intermedios.
- **Línea 74:** **cuarto** borrar relaciones; así no quedan aristas colgadas.
- **Línea 75-79:** resuelve extremos.
- **Línea 80-83:** busca la arista por source/target.
- **Línea 84-88:** elimina o advierte.
- **Línea 90:** **último** borrar entidades; así las relaciones ya se borraron.
- **Línea 91-96:** elimina o advierte.

**Por qué el orden es contrato:** si se borra una entidad antes de sus relaciones, quedan aristas huérfanas. Si se agrega un atributo antes de la entidad, no hay a quién asignarlo.

**Limitación honesta:** no es una transacción atómica. Si una mutación falla, las anteriores ya se aplicaron. Se mitiga con validación previa y con orden seguro; no se promete atomicidad.

---

## 4.5. `buildDiagramInterchange` — `frontend/src/utils/xmiExporter.ts:244-283`

**Qué hace:** agrega la sección UMLDI que le dice a Enterprise Architect dónde dibujar cada clase, cada arista y sus waypoints.

```typescript
function buildDiagramInterchange(
  nodes: Node<EntityNodeData>[],
  edges: Edge<RelationshipData>[]
): string {
  let xml = `    <umldi:Diagram xmi:type="umldi:UMLClassDiagram" xmi:id="${DIAGRAM_ID}" isFrame="false" modelElement="PackageRoot">\n`;

  nodes.forEach((node, index) => {
    const nodeId = xmiId(node.id || `node_${index}`);
    const box = getNodeBox(node);
    const x = Math.max(10, Math.round(box.x));
    const y = Math.max(10, Math.round(box.y));
    const w = Math.max(30, Math.round(box.width));
    const h = Math.max(30, Math.round(box.height));
    const label = escapeXml(node.data?.label || nodeId);

    xml += `      <ownedElement xmi:type="umldi:UMLClassifierShape" xmi:id="DE_${nodeId}" modelElement="${nodeId}">\n`;
    xml += `        <ownedElement xmi:type="umldi:UMLNameLabel" xmi:id="NL_${nodeId}" text="${label}"/>\n`;
    xml += `        <bounds xmi:type="dc:bounds" xmi:id="DB_${nodeId}" x="${x}" y="${y}" width="${w}" height="${h}"/>\n`;
    xml += `      </ownedElement>\n`;
  });

  edges.forEach((edge, index) => {
    const geom = getEdgeGeometry(edge, nodes, index);
    if (!geom) return;

    const label = escapeXml(edge.data?.label || '');
    xml += `      <ownedElement xmi:type="umldi:UMLEdge" xmi:id="DE_${geom.subject}" source="${geom.sourceId}" target="${geom.targetId}" geometry="${umlDiGeometry(geom)}">\n`;
    if (label) {
      xml += `        <ownedElement xmi:type="umldi:UMLNameLabel" xmi:id="NL_${geom.subject}" text="${label}">\n`;
      xml += `          <bounds xmi:type="dc:bounds" xmi:id="DB_${geom.subject}" x="${Math.min(geom.sx, geom.ex)}" y="${Math.min(geom.sy, geom.ey) - 16}" width="${Math.max(60, Math.abs(geom.ex - geom.sx))}" height="15"/>\n`;
      xml += `        </ownedElement>\n`;
    }
    xml += `        <waypoint xmi:type="dc:waypoint" xmi:id="WP_${geom.subject}_0" x="${geom.sx}" y="${geom.sy}"/>\n`;
    xml += `        <waypoint xmi:type="dc:waypoint" xmi:id="WP_${geom.subject}_1" x="${geom.ex}" y="${geom.ey}"/>\n`;
    xml += `      </ownedElement>\n`;
  });

  xml += `    </umldi:Diagram>\n`;
  return xml;
}
```

**Desglose forense:**

- **Línea 5:** abre `umldi:Diagram`; `modelElement="PackageRoot"` enlaza el dibujo con el paquete UML.
- **Línea 7:** recorre cada nodo.
- **Línea 8:** `xmiId` sanitiza el id para XML.
- **Línea 9:** `getNodeBox` obtiene x, y, ancho y alto.
- **Línea 10-13:** fuerza mínimos (`10`, `30`) para que EA no reciba geometría cero.
- **Línea 14:** escapa el nombre; evita romper el XML con `<`, `>`, `&`.
- **Línea 16:** `UMLClassifierShape`: forma visual de la clase.
- **Línea 17:** etiqueta visible.
- **Línea 18:** `dc:bounds`: posición y tamaño.
- **Línea 21:** recorre aristas.
- **Línea 22:** `getEdgeGeometry` calcula extremos; si falta un nodo, devuelve `null`.
- **Línea 23:** si no hay geometría, no dibuja la arista.
- **Línea 25:** `UMLEdge`: arista visual con source, target y geometría.
- **Línea 26-30:** si hay etiqueta, agrega nombre y bounds.
- **Línea 31-32:** dos `waypoint`: inicio y fin.
- **Línea 35:** cierra el diagrama.

**Por qué no basta el modelo UML:** el modelo dice “esto es una asociación”; UMLDI dice “dibújala desde estas coordenadas”. EA necesita ambas.

**Por qué también se genera la extensión EA:** EA no importa diagramas solo con UMLDI estándar; necesita su bloque `xmi:Extension` con conectores y `Path` ortogonal. Ver `buildEaExtension` en el mismo archivo.

---

# PARTE 5: El Banco de Preguntas Extremo (Las 30 Preguntas)

## 5.1. Básicas

### 1. ¿Qué hace la aplicación?

- **Respuesta:** herramienta CASE colaborativa para UML en tiempo real, con IA, XMI y generación de backend Spring Boot.
- **Por qué:** une modelado, colaboración y generación en un flujo; el diagrama se convierte en AST y luego en código.
- **Por qué NO:** una herramienta solo de dibujo no tendría colaboración real ni generación.
- **Ubicación:** `frontend/src/app/diagram/[id]/page.tsx`; `backend/routes/generator.js`; `backend/generator/generate.js`.

### 2. ¿Por qué React y React Flow?

- **Respuesta:** React Flow ya resuelve nodos, aristas, handles, zoom y eventos; React 19 + Next 16 integran Yjs y hooks sin fricción.
- **Por qué:** el requisito dominante era un canvas colaborativo, no un CRUD.
- **Por qué NO:** Angular/Vue eran posibles, pero implicaban adaptar otro ecosistema de canvas sin ventaja.
- **Ubicación:** `frontend/package.json`; `frontend/src/components/diagram/EditorFlow.tsx`.

### 3. ¿Por qué Node.js en la herramienta?

- **Respuesta:** el backend es I/O concurrente: REST, WebSocket, PostgreSQL e IA. Node da un solo lenguaje y ecosistema directo para Yjs, `ws` y `pg`.
- **Por qué:** no hay cómputo pesado; hay muchas conexiones y eventos.
- **Por qué NO:** Java para la herramienta duplicaría lenguaje y complicaría Yjs/WebSocket.
- **Ubicación:** `backend/package.json`; `backend/server.js`; `backend/realtime/yjs.js`.

### 4. ¿Por qué PostgreSQL/Neon y no MongoDB?

- **Respuesta:** lo durable es relacional: usuarios, ACL, solicitudes y chat. Necesitamos FKs, CHECK, índices parciales y `BYTEA`.
- **Por qué:** MongoDB habría facilitado un documento, pero perdido integridad de permisos y auditoría.
- **Por qué NO:** el grafo no se guarda como JSON; se guarda como binario Yjs. Mongo no aporta ventaja ahí.
- **Ubicación:** `backend/db.js`; `Documentacion_Segundo_Parcial/04_Diseno_UML.md:975-1031`.

### 5. ¿Cuál es la diferencia entre la herramienta y el backend generado?

- **Respuesta:** la herramienta es Node.js + Express + Yjs + Neon; el backend generado es un ZIP Spring Boot + JPA + PostgreSQL.
- **Por qué:** son dos productos distintos; la herramienta produce el segundo.
- **Por qué NO:** no se debe decir que `Cliente` o `Pedido` son tablas de Neon; se crean en la base del backend generado.
- **Ubicación:** `backend/generator/generate.js`; `backend/generator/templates/`; `frontend/src/hooks/useDiagramIo.ts`.

---

## 5.2. Arquitectura

### 6. ¿Por qué no usaron ORM en Node?

- **Respuesta:** esquema pequeño, `BYTEA`, transacciones manuales y advisory locks. `pg` + SQL parametrizado da control directo.
- **Por qué:** el grafo no es relacional; el ORM no resuelve el problema central y añade capa/codegen.
- **Por qué NO:** Prisma/TypeORM habrían dado tipado, pero también dependencia, migraciones y posible N+1 para cinco tablas.
- **Ubicación:** `backend/db.js`; `backend/services/diagramService.js`; `backend/services/aclService.js`.

### 7. ¿Por qué separaron `routes`, `services` y `db.js`?

- **Respuesta:** cada archivo tiene una responsabilidad: HTTP, reglas/SQL e infraestructura.
- **Por qué:** permite testear sin abrir puerto y cambiar Express sin tocar lógica.
- **Por qué NO:** un monolito en `server.js` sería rápido al inicio e imposible de mantener.
- **Ubicación:** `backend/app.js`; `backend/routes/auth.js`; `backend/services/userService.js`; `backend/db.js`.

### 8. ¿Por qué `server.js` tiene 59 líneas?

- **Respuesta:** es el composition root: crea app, HTTP, WebSocket y apagado. La lógica está en `app.js`, rutas, servicios y DB.
- **Por qué:** separa ciclo de vida del proceso de la lógica de negocio.
- **Por qué NO:** un archivo único mezclaría arranque, SQL y validaciones.
- **Ubicación:** `backend/server.js`; `backend/app.js`.

### 9. ¿React Flow es el dueño de la verdad?

- **Respuesta:** no. React Flow dibuja; Yjs es el estado canónico. `page.tsx` recibe `nodes/edges` de `useCollaborativeFlow`.
- **Por qué:** dos fuentes de verdad producirían carreras.
- **Por qué NO:** `useNodesState` en paralelo a Yjs competiría con los updates remotos.
- **Ubicación:** `frontend/src/app/diagram/[id]/page.tsx`; `frontend/src/hooks/useCollaborativeFlow.ts`.

### 10. ¿Cómo evitan perder cambios al cerrar?

- **Respuesta:** debounce de 2 s + `flush-snapshot` por WebSocket en `beforeunload`/`pagehide` + `writeState` de y-websocket al irse el último cliente.
- **Por qué:** el debounce reduce escrituras; el flush cubre la ventana de cierre.
- **Por qué NO:** guardar en cada píxel saturaría Neon; un botón manual no es confiable.
- **Ubicación:** `frontend/src/hooks/useCollaborativeFlow.ts:171-185`; `backend/realtime/yjs.js:58-82`, `254-270`.

### 11. ¿Qué pasa si hay 100 usuarios en la misma sala?

- **Respuesta:** Yjs sincroniza en memoria y el snapshot se escribe cada 2 s; un solo Node con y-websocket tiene límites. Para 100+ se necesitaría distribuir Yjs/Redis y cuotas.
- **Por qué:** ser honesto sobre el alcance académico.
- **Por qué NO:** no se afirma escalabilidad infinita sin pruebas de carga.
- **Ubicación:** `backend/realtime/yjs.js`; `backend/server.js`.

---

## 5.3. Base de datos

### 12. ¿Por qué no hay tablas `Class` y `Relation`?

- **Respuesta:** el grafo es un CRDT de Yjs; vive completo en `core.diagrams.yjs_snapshot` como `BYTEA`.
- **Por qué:** normalizar rompería relojes lógicos, IDs internos y tombstones.
- **Por qué NO:** tablas de clases darían integridad clásica, pero perderían colaboración.
- **Ubicación:** `backend/services/diagramService.js`; `backend/realtime/yjs.js`; `REVERSE_ENGINEERING_REPORT.md:8-18`.

### 13. ¿Por qué `BYTEA` y no `JSONB`?

- **Respuesta:** Yjs produce un binario opaco; `BYTEA` lo guarda byte por byte.
- **Por qué:** `JSONB` obligaría a recodificar y podría corromper la semántica.
- **Por qué NO:** un JSON legible no es el mismo documento que usa Yjs.
- **Ubicación:** `backend/services/diagramService.js:220-229`; DDL `core.diagrams`.

### 14. ¿Por qué `diagram_acl.diagram_id` no tiene FK física?

- **Respuesta:** el DDL no la declara; la integridad se maneja en `deleteDiagram` con transacción.
- **Por qué:** desacopla `auth` de `core`; evita permisos huérfanos al borrar.
- **Por qué NO:** `ON DELETE CASCADE` sería simple, pero acoplaría esquemas y cambiaría el DDL.
- **Ubicación:** `backend/services/diagramService.js:202-211`; `REVERSE_ENGINEERING_REPORT.md:39-46`.

### 15. ¿Cómo se recupera el snapshot al reconectar?

- **Respuesta:** si el doc sigue en memoria, el cliente recibe el estado vivo; si no, `bindState` lee `BYTEA` y `Y.applyUpdate`.
- **Por qué:** mientras hay conexiones, memoria > DB; al final, `writeState` guarda.
- **Por qué NO:** leer siempre de DB daría una versión vieja si otro usuario sigue editando.
- **Ubicación:** `backend/realtime/yjs.js:94-117`; `docs` de y-websocket.

### 16. ¿Dónde está el DDL real?

- **Respuesta:** en `Documentacion_Segundo_Parcial/04_Diseno_UML.md:975-1031` y `backend/scripts/access_requests.sql`.
- **Por qué:** el DDL vive con la documentación y las migraciones de Fase 3.
- **Por qué NO:** no se inventa un esquema distinto al de los servicios.
- **Ubicación:** `Documentacion_Segundo_Parcial/04_Diseno_UML.md`; `backend/scripts/access_requests.sql`.

### 17. ¿Por qué `deleteDiagram` usa transacción manual?

- **Respuesta:** borra primero ACL y luego diagrama; si algo falla, `ROLLBACK`.
- **Por qué:** no hay FK que haga cascade; la transacción evita huérfanos.
- **Por qué NO:** un DELETE directo sin transacción podría dejar ACL apuntando a un diagrama inexistente.
- **Ubicación:** `backend/services/diagramService.js:202-211`.

---

## 5.4. IA

### 18. ¿Cómo evitan que la IA alucine?

- **Respuesta:** prompt estricto + `validateMutations` con allowlist + límites + `validateAstState`.
- **Por qué:** el LLM es probabilístico; la validación es determinista.
- **Por qué NO:** confiar solo en el prompt o en `temperature: 0.1` no garantiza formato ni seguridad.
- **Ubicación:** `backend/services/aiService.js`; `backend/validation.js:288-361`.

### 19. ¿Cómo funciona la memoria del chat?

- **Respuesta:** `chat.messages` guarda autor, rol y contenido; se toman los últimos 15 y se formatean con `formatChatHistory`.
- **Por qué:** permite resolver “eso”, “esa clase” y distinguir a Carlos de Andrés.
- **Por qué NO:** mandar todo el historial cuesta tokens y contamina con instrucciones viejas.
- **Ubicación:** `backend/services/chatService.js`; `backend/services/aiService.js:59-80`.

### 20. ¿Cómo funciona la tutoría contextual?

- **Respuesta:** el frontend envía `selectedElement`; el backend lo valida y lo inserta en el prompt; la IA lo usa como ejemplo.
- **Por qué:** sin contexto, la respuesta sería genérica.
- **Por qué NO:** una captura siempre es más cara e imprecisa que el AST para texto.
- **Ubicación:** `frontend/src/hooks/useEditorSelection.ts`; `backend/validation.js`; `backend/services/aiService.js`.

### 21. ¿Cómo funcionan Groq y Ollama?

- **Respuesta:** `resolveAiProvider` (Strategy) devuelve `baseUrl`, modelo y key; ambos usan contrato OpenAI-compatible.
- **Por qué:** cambiar de nube a local no duplica prompt ni validación.
- **Por qué NO:** dos implementaciones separadas duplicarían lógica y divergirían.
- **Ubicación:** `backend/services/aiService.js:17-44`; `frontend/src/components/AiConfigModal.tsx`.

### 22. ¿Cómo funcionan las menciones `@usuario`?

- **Respuesta:** `classifyChatMessage` detecta `@handle`; si coincide con un conectado, el mensaje va solo a Yjs y no se llama a la IA.
- **Por qué:** separa conversación humana de comando IA y ahorra tokens.
- **Por qué NO:** mandar todo a la IA haría que respondiera a conversaciones entre personas.
- **Ubicación:** `frontend/src/utils/chatMentions.ts`; `frontend/src/hooks/useAICommand.ts`; `frontend/src/components/ChatPanel.tsx`.

### 23. ¿Qué pasa si Groq falla?

- **Respuesta:** el backend responde 503/504/502 controlado; el frontend muestra el error y no aplica mutaciones.
- **Por qué:** la IA es externa y su caída no debe corromper el diagrama.
- **Por qué NO:** aplicar JSON incompleto dejaría el modelo inconsistente.
- **Ubicación:** `backend/services/aiService.js` (catch de `fetch`); `backend/routes/ai.js`; `frontend/src/hooks/useAICommand.ts`.

---

## 5.5. Generación

### 24. ¿Cómo se genera una relación N:M?

- **Respuesta:** `expandManyToMany` crea una entidad intermedia con UUID y dos `@ManyToOne`, más los atributos de la relación.
- **Por qué:** `@ManyToMany` no admite columnas extra y puede ciclar JSON.
- **Por qué NO:** una tabla puente sin entidad no representa una clase asociativa UML.
- **Ubicación:** `backend/generator/expander.js:76-173`; `entity-intermediate.java.hbs`.

### 25. ¿Cómo se genera la herencia?

- **Respuesta:** el padre lleva `@Inheritance(JOINED)`; el hijo lleva `extends` y `@PrimaryKeyJoinColumn`, sin `@Id`.
- **Por qué:** JPA exige una sola estrategia por jerarquía.
- **Por qué NO:** `SINGLE_TABLE` deja columnas nulas y `TABLE_PER_CLASS` duplica columnas.
- **Ubicación:** `backend/generator/contextBuilder.js:222-259`; `templates/model.java.hbs`.

### 26. ¿Qué pasa con nombres como “Class” o “Order Details”?

- **Respuesta:** `toJavaClassName` sanitiza: `Class` → `ClassEntity`, `Order Details` → `OrderDetails`, `1Order` → `V1Order`.
- **Por qué:** el nombre visible no siempre es un identificador Java válido.
- **Por qué NO:** una regex sola no conoce keywords ni colisiones.
- **Ubicación:** `backend/generator/naming.js:28-75`; `AUDIT_FUZZ_GENERATOR.md`.

### 27. ¿Cómo se exporta XMI?

- **Respuesta:** `exportToXmi` genera UML 2.5.1, UMLDI con bounds/waypoints y extensión EA con `Path` y `TREE=OS`.
- **Por qué:** EA necesita modelo + geometría + extensión propietaria para dibujar relaciones.
- **Por qué NO:** un XML propio no sería interoperable.
- **Ubicación:** `frontend/src/utils/xmiExporter.ts:244-283`, `292-409`, `473-511`.

---

## 5.6. Seguridad

### 28. ¿Cómo funciona JWT?

- **Respuesta:** login firma `userId` + `username`; `requireAuth` verifica firma y expiración; el rol se consulta en ACL.
- **Por qué:** stateless y simple; no hay tabla de sesiones.
- **Por qué NO:** guardar token en DB permitiría revocación, pero añade consulta y tabla. **Tradeoff:** no hay revocación inmediata.
- **Ubicación:** `backend/middleware/auth.js:21-39`, `68-74`; `frontend/src/lib/apiClient.ts`.

### 29. ¿Cómo evitan SQL injection y XSS?

- **Respuesta:** SQL con placeholders `$1`; React escapa el texto del chat y no hay `dangerouslySetInnerHTML`.
- **Por qué:** separar datos de SQL y no interpretar HTML elimina las variantes clásicas.
- **Por qué NO:** concatenar SQL o renderizar HTML crudo serían vulnerables.
- **Ubicación:** `backend/services/userService.js:28-31`; `frontend/src/components/ChatPanel.tsx:276-290`.

### 30. ¿Qué limitaciones de seguridad tienen?

- **Respuesta:** no hay rate limiting; CORS está abierto; el JWT vive en `localStorage`.
- **Por qué:** son tradeoffs de demo/alcance; se reconoce en vez de ocultarlo.
- **Por qué NO:** se podría endurecer con `express-rate-limit`, CORS restringido y cookie `HttpOnly`.
- **Ubicación:** `backend/app.js:17`; `frontend/src/lib/apiClient.ts:7-19`.

---

# PARTE 6: El Diccionario de Dependencias (¿Por qué esta librería y no otra?)

## 6.1. Frontend

| Librería | Versión | ¿Por qué? | Alternativa descartada | Tradeoff |
|---|---:|---|---|---|
| `next` | 16.3.3 | App Router, rutas, deploy directo a Vercel, client/server components. | Vite + React Router | Next añade peso y convenciones; a cambio simplifica routing/deploy. |
| `react` / `react-dom` | 19.2.8 | Base de componentes, hooks y ecosistema. | Angular/Vue | No se aprovecharía React Flow ni el ecosistema actual. |
| `reactflow` | 11.11.4 | Nodos, aristas, handles, zoom, minimapa y eventos de canvas. | D3.js / GoJS | D3 es flexible pero de bajo nivel; GoJS es comercial y pesado. React Flow ahorra meses de canvas. |
| `yjs` | 13.6.32 | CRDT probado, eficiente y con ecosistema de providers. | DIY CRDT / autosave REST | Un CRDT propio sería un proyecto aparte. |
| `y-websocket` | 1.4.1 | Provider WebSocket + servidor listo para Node. | Socket.io puro | Socket.io da mensajería, no sincronización CRDT; habría que implementar protocolo, presencia y persistencia. |
| `react-markdown` | 10.1.0 | Render del manual embebido. | HTML crudo | HTML crudo exigiría sanitización; Markdown es más seguro. |
| `tailwindcss` | 4 | Estilos utilitarios consistentes. | CSS modules / styled-components | Tailwind acelera UI; requiere disciplina de clases. |

## 6.2. Backend

| Librería | Versión | ¿Por qué? | Alternativa descartada | Tradeoff |
|---|---:|---|---|---|
| `express` | 4.18.2 | Rutas, middlewares y ecosistema simple. | Fastify / NestJS | Express es suficiente; Nest añadiría estructura/DI que no se necesita. |
| `pg` | 8.23.1 | Driver PostgreSQL directo, `Pool`, transacciones y `BYTEA`. | Prisma / TypeORM | ORM añadiría codegen/capa para cinco tablas y un documento binario. |
| `yjs` | 13.6.32 | Mismo CRDT en cliente y servidor. | Socket.io | Socket.io no resuelve convergencia ni tombstones. |
| `y-websocket` | 1.4.1 | Servidor listo, `docs` Map y persistencia. | Implementación propia de protocolo | Propio sería riesgoso; el paquete ya maneja sync/awareness. |
| `bcryptjs` | 2.4.3 | Hash de contraseñas sin dependencias nativas. | `argon2` / `crypto.scrypt` | bcrypt es estándar y portable; argon2 es más moderno pero añade binario. |
| `jsonwebtoken` | 9.0.3 | Firma/verificación JWT. | Sesiones en DB | JWT es stateless; sesiones permiten revocación inmediata. |
| `handlebars` | 4.7.9 | Plantillas con condicionales y helpers. | EJS / Pug | Handlebars es lógico y seguro para generar Java; Pug es más frágil con indentación. |
| `archiver` | 7.0.1 | ZIP en streaming. | `adm-zip` | Archiver maneja carpetas grandes y streams. |
| `multer` | 2.3.0 | Subida de audio/imagen. | `busboy` | Multer integra límites y `req.file` fácilmente. |
| `ws` | 8.21.3 | Servidor WebSocket sobre HTTP. | Socket.io | `ws` es el transporte que y-websocket espera; menos capa. |

## 6.3. Generador Spring Boot

| Dependencia | Versión | ¿Por qué? |
|---|---:|---|
| Spring Boot parent | 4.0.0 | Base del backend generado. |
| Java | 21 | Versión LTS del proyecto generado. |
| `spring-boot-starter-web` | gestionada | REST controllers. |
| `spring-boot-starter-data-jpa` | gestionada | Hibernate/JPA. |
| `spring-boot-starter-security` | gestionada | Seguridad del backend generado. |
| `spring-boot-starter-validation` | gestionada | `@Valid`. |
| Flyway | 12.0.0 | Migraciones del backend generado. |
| PostgreSQL driver | gestionada | Conexión a PostgreSQL. |
| Lombok | gestionada | Getters/setters/constructores. |
| JJWT | 0.12.6 | JWT del backend generado. |
| LangChain4j | 0.35.0 | Consulta IA local/embeddings en el backend generado. |

## 6.4. Groq vs OpenAI vs Anthropic

| Proveedor | ¿Por qué se eligió / no? |
|---|---|
| **Groq** | Rápido, API compatible OpenAI, capa gratuita útil para demo. Se usa si hay `GROQ_API_KEY`. |
| **Ollama** | Alternativa local sin nube; permite demo sin internet. |
| **OpenAI** | Potente, pero costo y dependencia de cuenta; no era necesario para el alcance. |
| **Anthropic** | Excelente para texto, pero el contrato no era el mismo; habría que adaptar el cliente. |

**Frase:** “La IA está detrás de una Strategy; Groq y Ollama comparten contrato OpenAI-compatible. Cambiar de proveedor no cambia la validación.”

---

# PARTE 7: El Modo “Pánico” (Diagnóstico de Errores)

## 7.1. “No carga la página”

**Síntoma:** Vercel da error, pantalla blanca o 404.

**Qué revisar:**

1. `npm run build` en `frontend/`.
2. `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WS_URL` en Vercel.
3. Logs de Vercel.
4. Si es local, `npm run dev` y puerto `3000`.

**Qué decir:** “El build local pasa; el problema es de configuración de entorno en Vercel, no de la lógica.”

## 7.2. “No conecta la base de datos”

**Síntoma:** `/ready` devuelve 503; backend no arranca.

**Qué revisar:**

1. `DATABASE_URL` en Railway/local.
2. Que Neon esté activo y con `sslmode=require`.
3. Que el DDL exista (`auth/core/chat`).
4. `docker ps` si es local.

**Qué decir:** “`db.js` solo activa SSL si la URL contiene `sslmode=require`; sin eso, Neon rechaza o falla la conexión.”

## 7.3. “La IA da error 503”

**Síntoma:** chat responde “No se pudo conectar” o 503.

**Qué revisar:**

1. `GROQ_API_KEY` si `AI_PROVIDER=groq`.
2. Si es Ollama: `ollama serve`, `OLLAMA_URL`, túnel Ngrok.
3. Logs de `aiService.js`.

**Qué decir:** “El 503 es controlado; no se aplica ninguna mutación parcial. La IA es un servicio externo.”

## 7.4. “El WebSocket no sincroniza”

**Síntoma:** dos pestañas no comparten cambios.

**Qué revisar:**

1. `NEXT_PUBLIC_WS_URL`.
2. Backend escuchando en `1234`.
3. Token en la URL (`?token=`).
4. Códigos 4401/4403/4404.
5. Que el diagrama exista en `core.diagrams`.

**Qué decir:** “El WebSocket valida token, sala y ACL antes de aceptar; un 4403 significa que el usuario no es miembro.”

## 7.5. “No se guardan los cambios”

**Síntoma:** recargas y ves una versión vieja.

**Qué revisar:**

1. Que el `flush-snapshot` llegue (Network → WS).
2. Que `core.diagrams.yjs_snapshot` cambie.
3. Que no haya `snapshotError` en logs.
4. Que el último usuario no haya cerrado antes de que el servidor procesara el close.

**Qué decir:** “Hay tres capas: debounce, flush por `beforeunload` y `writeState` al irse el último cliente. Si falla, revisamos logs de `saveSnapshot`.”

## 7.6. “EA no dibuja relaciones”

**Síntoma:** importa clases, pero no líneas.

**Qué revisar:**

1. UMLDI (`buildDiagramInterchange`).
2. `memberEnd`/`ownedEnd`.
3. Extensión EA (`buildEaExtension`).
4. `xmi:version` en `xmi:Documentation`, no en la raíz.
5. `Path` y `TREE=OS`.

**Qué decir:** “EA necesita modelo + UMLDI + extensión propietaria; solo el modelo no alcanza.”

## 7.7. “No compila el backend generado”

**Síntoma:** Maven falla.

**Qué revisar:**

1. Java 21 y Maven 3.9+.
2. `mvn clean package -DskipTests`.
3. Nombres sanitizados (`ClassEntity`, `V1Order`).
4. Que el ZIP tenga `pom.xml`, `application.properties`, `clean.sql`.
5. Logs de Hibernate si falla el arranque.

**Qué decir:** “El generador prueba sanitización y herencia; si falla, revisamos el AST de entrada y las plantillas.”

---

# Checklist final

- [ ] `npx tsc --noEmit` y `npm run build` pasan.
- [ ] `node --check backend/realtime/yjs.js` pasa.
- [ ] Login con contraste y foco azul.
- [ ] Paleta con SVG y texto oscuro.
- [ ] Dos navegadores sincronizan.
- [ ] Cerrar pestaña y recargar conserva el nodo.
- [ ] `@usuario` no llama a la IA; `@ai` sí.
- [ ] XMI importa en EA.
- [ ] ZIP generado compila con Maven.
- [ ] `/health` y `/ready` responden.
- [ ] Documentos abiertos: `REVERSE_ENGINEERING_REPORT.md`, `AUDIT_XMI.md`, `Documentacion_Segundo_Parcial/GUIA_YJS_SNAPSHOT.md`.

---

**Fin del manual.**

