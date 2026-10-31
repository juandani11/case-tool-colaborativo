# Arquitectura

## 1. Visión general

La Herramienta CASE Colaborativa con IA es un sistema web para modelar diagramas UML en tiempo real, con asistencia de inteligencia artificial y generación automática de un backend Spring Boot con PostgreSQL. Su arquitectura separa la interfaz de edición, la lógica de dominio, la colaboración en tiempo real, la persistencia duradera y los servicios externos de IA.

La idea arquitectónica central es que **el estado canónico del diagrama vive en un documento Yjs replicado**. React Flow no es la fuente de verdad: es una vista derivada del documento colaborativo. Los cambios se escriben en Yjs y los observadores actualizan React. La base de datos conserva un snapshot binario de ese documento, además de usuarios, permisos y mensajes del chat.

```text
┌────────────────────────────── FRONTEND ──────────────────────────────┐
│ Next.js 16 + React 19 + React Flow                                   │
│                                                                      │
│  Páginas              Componentes             Estado                 │
│  /login               Toolbar / Palette       Y.Doc                  │
│  /register            EntityNode / UmlEdge      ├─ nodes: Y.Map      │
│  /dashboard           ChatPanel / Panels        ├─ edges: Y.Map      │
│  /diagram/[id]        HelpModal                 └─ chat: Y.Array     │
│                                                                      │
│  Hooks: useCollaborativeFlow, useAICommand, useDiagramRole, useAuth  │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ HTTPS / REST + JWT            │ WebSocket Yjs + JWT
                ▼                               ▼
┌────────────────────────────── BACKEND ───────────────────────────────┐
│ Node.js + Express + y-websocket + Handlebars                         │
│                                                                      │
│  Rutas REST           Middleware             Servicios               │
│  auth                 requireAuth            userService             │
│  diagrams             requireDiagramMember   aclService              │
│  acl                  requireDiagramRole     diagramService          │
│  ai                   requireDiagramWrite    chatService              │
│  generate                                    generador Spring Boot   │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ SQL / TLS                     │ HTTPS
                ▼                               ▼
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│ PostgreSQL en Neon            │   │ Groq API                         │
│                               │   │ texto, voz y visión              │
│ auth.users                    │   └──────────────────────────────────┘
│ auth.diagram_acl              │
│ core.diagrams                 │
│ chat.messages                 │
└───────────────────────────────┘
```

## 2. Objetivos arquitectónicos

1. **Colaboración sin conflictos manuales.** Yjs aporta convergencia eventual mediante un CRDT, sin un servidor central que ordene operaciones.
2. **Persistencia duradera.** PostgreSQL conserva el snapshot del documento, los usuarios, las ACL y el historial del chat.
3. **Identidad verificable.** El backend obtiene el usuario desde el JWT, no desde datos enviados por el cliente.
4. **Memoria contextual del asistente.** La IA recibe los últimos mensajes persistidos del diagrama para mantener continuidad.
5. **Separación de responsabilidades.** Frontend, API, dominio, persistencia y generación tienen límites claros.
6. **Despliegue independiente.** El frontend puede publicarse en Vercel y el backend con WebSocket en un servicio Node persistente.
7. **Degradación controlada.** El modo `AUTH_ENABLED=false` permite desarrollo y demostración sin autenticación, sin borrar las validaciones del código.

## 3. Requisitos arquitectónicamente significativos

| Código | Requisito | Decisión arquitectónica |
|---|---|---|
| RAS-01 | Varios usuarios editan el mismo diagrama | Yjs + `y-websocket`; estado canónico replicado |
| RAS-02 | Los cambios deben sobrevivir a la desconexión | Snapshot Yjs en `core.diagrams.yjs_snapshot` |
| RAS-03 | Cada diagrama tiene propietario y roles | ACL en `auth.diagram_acl` y gates HTTP/WS |
| RAS-04 | La IA debe dirigirse al usuario correcto | Identidad derivada del JWT en el backend |
| RAS-05 | La IA debe recordar la conversación | Historial de `chat.messages` inyectado en el prompt |
| RAS-06 | El chat debe ser colaborativo | Respuesta emitida al `Y.Array('chat')` de la sala |
| RAS-07 | El sistema debe generar un backend ejecutable | Generador con Handlebars y plantillas Spring Boot |
| RAS-08 | El frontend y el backend se despliegan por separado | REST + WebSocket con URLs configurables |
| RAS-09 | No se deben exponer credenciales | Secretos fuera de git y hash bcrypt para contraseñas |

## 4. Estilo arquitectónico

La solución combina tres estilos complementarios:

- **Cliente-servidor en capas** para autenticación, diagramas, ACL y generación.
- **Arquitectura orientada a eventos y CRDT** para la edición colaborativa.
- **Persistencia híbrida** para separar el estado vivo del grafo y el estado durable de la aplicación.

No se trata de una arquitectura de microservicios. El backend es un único proceso Node que sirve REST y WebSocket sobre el mismo servidor HTTP. Esta decisión reduce la complejidad operativa, evita problemas de CORS entre APIs y simplifica el desarrollo local.

## 5. Arquitectura del frontend

### 5.1 Tecnologías

| Tecnología | Uso |
|---|---|
| Next.js 16 | App Router, rutas `/login`, `/register`, `/dashboard`, `/diagram/[id]` |
| React 19 | Componentes de interfaz y composición de hooks |
| React Flow 11 | Canvas, nodos, aristas, selección, zoom y minimapa |
| Yjs 13 | Documento colaborativo y tipos compartidos |
| y-websocket 1.4 | Sincronización del documento y awareness |
| Tailwind CSS 4 | Estilos y sistema de diseño |
| TypeScript | Contratos de dominio y verificación estática |

### 5.2 Organización

```text
frontend/src/
├── app/                 Rutas y páginas
├── components/          Canvas, paneles, toolbar, chat y ayuda
├── contexts/            AuthContext
├── hooks/               Colaboración, IA, roles, bloqueos y sesión
├── lib/                 Cliente HTTP con JWT y presencia
├── utils/               AST, helpers Yjs, XMI, aristas y asociación
├── types/               Contratos TypeScript
└── styles/              Design system
```

### 5.3 Flujo de estado

1. `useCollaborativeFlow` crea el `Y.Doc`, el `WebsocketProvider` y los mapas `nodes`, `edges` y `chat`.
2. La página del editor carga el diagrama mediante REST.
3. El snapshot se aplica a Yjs en una sola transacción.
4. `observeDeep` detecta cambios y reconstruye los arreglos de React Flow.
5. Las acciones del usuario escriben en Yjs, no directamente en el estado canónico de React.

```text
Acción del usuario
      │
      ▼
Hook / utilidad Yjs
      │  set/update en Y.Map
      ▼
Y.Doc local ── update ──► WebSocket ──► otros clientes
      │
      └── observeDeep ──► setNodes / setEdges ──► React Flow
```

### 5.4 Presencia y soft-lock

La presencia no se persiste. Se publica en `awareness`:

- `user`: identidad visible, color y nombre.
- `editing`: nodo seleccionado y timestamp.

Los bloqueos visuales expiran a los 30 segundos. Un nodo bloqueado por otro usuario no es arrastrable, pero el bloqueo es visual y no transaccional.

## 6. Arquitectura del backend

### 6.1 Tecnologías

| Tecnología | Uso |
|---|---|
| Node.js 20+ | Runtime |
| Express | API REST |
| `ws` + `y-websocket` | Servidor WebSocket y protocolo Yjs |
| `pg` | Pool PostgreSQL |
| `jsonwebtoken` | Firma y verificación JWT |
| `bcryptjs` | Hash de contraseñas |
| `multer` | Carga de audio e imágenes en memoria |
| Handlebars | Plantillas del backend generado |
| Archiver | Empaquetado ZIP |

### 6.2 Capas internas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Bootstrap | `server.js` | Entorno, HTTP, base de datos, señales y apagado |
| Aplicación HTTP | `app.js`, `routes/*`, `middleware/errorHandler.js` | Componer Express, exponer endpoints y centralizar errores |
| Tiempo real | `realtime/yjs.js` | WebSocket, snapshots, ACL WS y emisión de chat |
| Seguridad | `middleware/auth.js`, `middleware/diagramAuth.js` | Verificar JWT y roles por diagrama |
| Dominio | `services/*` | Reglas de usuarios, ACL, diagramas, chat e IA |
| Persistencia y generación | `db.js`, `scripts/`, `generator/` | Pool SQL, transacciones, migración y artefactos Spring Boot |

El backend mantiene los documentos Yjs en memoria mientras una sala está activa, pero la fuente durable del grafo es el snapshot persistido. La escritura del snapshot se realiza con debounce de 2 segundos, y el chat se guarda en `chat.messages`.

### 6.3 Servidor único para REST y WebSocket

`server.js` crea el `http.Server` y adjunta el WebSocket; `app.js` compone Express y `realtime/yjs.js` encapsula Yjs. Esto permite:

- Un solo puerto (`1234` por defecto).
- Un solo proceso en desarrollo.
- Autenticación coherente para HTTP y WebSocket.
- Menos configuración de red y CORS.

El WebSocket usa el room `diagram-room-<id>` y recibe el token mediante `?token=`. El servidor aplica un gate de acceso antes de entregar la conexión a `setupWSConnection`.

## 7. Arquitectura de datos

### 7.1 Persistencia híbrida

| Estado | Ubicación | Motivo |
|---|---|---|
| Grafo vivo | `Y.Doc` en clientes y servidor | Colaboración en tiempo real |
| Snapshot del grafo | `core.diagrams.yjs_snapshot` | Durabilidad del estado CRDT |
| Metadatos | `core.diagrams` | Nombre, propietario y fechas |
| Usuarios | `auth.users` | Identidad y credenciales |
| Permisos | `auth.diagram_acl` | Roles por diagrama |
| Chat durable | `chat.messages` | Memoria de IA e historial |
| Presencia | `awareness` | Estado efímero, no persistente |

### 7.2 Sectorización por esquemas

La base se dividió en tres esquemas:

- **`auth`:** usuarios y control de acceso.
- **`core`:** diagramas y snapshots.
- **`chat`:** mensajes del asistente y de usuarios.

La sectorización evita mezclar responsabilidades y permite razonar sobre permisos y respaldo por dominio. Además, aísla las tablas del proyecto de otras tablas existentes en el esquema `public` de la base Neon compartida.

### 7.3 Snapshot Yjs

El grafo no se descompone en tablas de nodos y aristas. Se guarda como `bytea` porque:

- Yjs ya contiene la estructura, los identificadores y los relojes lógicos.
- Se evita duplicar el modelo CRDT en SQL.
- La rehidratación es directa mediante `Y.applyUpdate`.
- Los conteos para el dashboard se obtienen decodificando el snapshot.

Esta decisión es deliberada: PostgreSQL conserva el documento, no reemplaza al CRDT.

## 8. Arquitectura del asistente IA

### 8.1 Componentes

```text
ChatPanel
   │
   ▼
useAICommand
   ├─ nodesToAST: convierte el canvas en un AST de entidades y relaciones
   ├─ apiFetch: adjunta el JWT
   └─ applyMutations: aplica cambios en el orden permitido
          │
          ▼
POST /api/ai/command
   ├─ requireAuth: obtiene userId y username del token
   ├─ chatService.getRecentMessages: últimos 15 mensajes del diagrama
   ├─ chatService.addMessage: persiste el mensaje del usuario
   ├─ getMutationsFromAI: construye prompt y llama a Groq
   ├─ chatService.addMessage: persiste la respuesta del asistente
   └─ emitChatMessage: publica la respuesta en Yjs
          │
          ▼
Groq API
```

### 8.2 Identidad

El nombre del usuario se extrae de `req.user.username`, que proviene del JWT verificado. El cliente no puede imponer otro nombre en el cuerpo de la petición. El prompt exige que la respuesta comience con el nombre del usuario.

### 8.3 Memoria contextual

La memoria se obtiene de `chat.messages` con `getRecentMessages(diagramId, 15)`:

1. La subconsulta selecciona los 15 mensajes más recientes.
2. El `ORDER BY` exterior los devuelve en orden cronológico ascendente.
3. El backend los formatea y los incluye en el prompt.
4. Los mensajes se limitan y se recortan para controlar el tamaño del contexto.

La memoria autoritativa está en PostgreSQL. El frontend no envía el historial, lo que evita manipulación y duplicación de estado.

### 8.4 Chat colaborativo

La respuesta del asistente se persiste y, además, se emite al chat Yjs de la sala. El frontend solo agrega la respuesta localmente si el backend no pudo emitirla, usando `chatEmitted` para evitar duplicados. Así, todos los participantes ven la intervención de la IA.

### 8.5 Contrato de mutaciones

La IA no modifica el canvas directamente. Devuelve un JSON con:

- `response`: explicación o confirmación dirigida al usuario.
- `mutations`: lista ordenada de acciones.

Acciones permitidas:

- `addEntity`
- `addAttribute`
- `addRelationship`
- `removeEntity`
- `removeRelationship`

El orden obligatorio es: entidades, atributos, relaciones y eliminaciones. Esto evita referencias a nodos que todavía no existen.

## 9. Arquitectura de despliegue

```text
┌──────────────────────┐        HTTPS         ┌──────────────────────┐
│ Navegador            │ ───────────────────► │ Vercel               │
│ Next.js cliente      │                      │ Frontend Next.js     │
└──────────┬───────────┘                      └──────────────────────┘
           │
           │ REST + WebSocket
           ▼
┌──────────────────────┐        SQL/TLS      ┌──────────────────────┐
│ Railway              │ ───────────────────► │ Neon PostgreSQL      │
│ Backend Node         │                      │ auth / core / chat   │
│ Express + WS         │                      └──────────────────────┘
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────┐
│ Groq API             │
│ texto, voz, visión   │
└──────────────────────┘
```

### 9.1 Decisiones de despliegue

- **Vercel para el frontend:** optimizado para Next.js y para el build del App Router.
- **Railway para el backend:** necesita un proceso persistente y conexiones WebSocket abiertas; un entorno serverless tradicional no es adecuado para `y-websocket`.
- **Neon para PostgreSQL:** base administrada con TLS, branching y conexión compatible con `pg`.
- **Groq para IA:** API compatible con OpenAI, sin SDK propio, invocada con `fetch`.

### 9.2 Variables de entorno

| Servicio | Variables |
|---|---|
| Backend | `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL`, `JWT_SECRET`, `JWT_EXPIRATION`, `AUTH_ENABLED`, `PORT` |
| Frontend | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` |

`DATABASE_URL` y las claves se guardan en `backend/.env.local` o en el gestor de secretos del proveedor. Nunca se versionan.

## 10. Seguridad

### 10.1 Autenticación

- Registro con validación de username, email y contraseña.
- Hash con bcrypt y 10 rondas.
- JWT firmado con secreto de al menos 32 caracteres.
- Expiración configurable, por defecto `7d`.
- El token se envía en `Authorization: Bearer` para REST y en `?token=` para WebSocket.

### 10.2 Autorización

| Rol | Permisos |
|---|---|
| `OWNER` | Ver, editar, renombrar, eliminar y administrar miembros |
| `EDITOR` | Ver y editar |
| `VIEWER` | Solo ver |

Los roles se consultan en `auth.diagram_acl`. El WebSocket es fail-closed: sin token responde `4401`; sin rol responde `4403`.

### 10.3 Protección de datos

- El `password_hash` nunca se devuelve en las respuestas.
- Los identificadores de diagrama se sanean antes de usarse en rutas y consultas.
- Las consultas usan parámetros, no concatenación de SQL.
- Los archivos de audio e imagen se procesan en memoria con límite de 10 MB.
- Las credenciales no se incluyen en la documentación ni en el repositorio.

## 11. Atributos de calidad

| Atributo | Evaluación |
|---|---|
| Colaboración | Alta: convergencia CRDT y chat compartido |
| Durabilidad | Alta para snapshots y chat; depende del proveedor |
| Consistencia | Eventual en el grafo, fuerte en identidad y ACL |
| Escalabilidad | Moderada; un proceso WS y un pool de 10 conexiones |
| Mantenibilidad | Buena separación por capas y servicios |
| Seguridad | JWT, bcrypt y ACL; pendiente el read-only real en Yjs |
| Disponibilidad | Depende de Vercel, Railway, Neon y Groq |
| Observabilidad | Logs de errores; sin trazas distribuidas |

## 12. Decisiones arquitectónicas

| ID | Decisión | Justificación | Consecuencia |
|---|---|---|---|
| ADR-01 | Yjs como fuente de verdad del grafo | Convergencia sin servidor de operaciones | El grafo no se normaliza en SQL |
| ADR-02 | Snapshot binario en PostgreSQL | Simplicidad y fidelidad del CRDT | Menos consultas relacionales sobre nodos |
| ADR-03 | Chat durable en PostgreSQL | Memoria consistente para la IA | Se duplica el chat en Yjs y en SQL con fines distintos |
| ADR-04 | Identidad desde JWT | Evita suplantación | Requiere autenticación para usar la IA |
| ADR-05 | Historial de 15 mensajes | Contexto útil con costo controlado | No hay memoria ilimitada |
| ADR-06 | Respuesta IA emitida por Yjs | Todos los colaboradores la ven | Requiere manejar `chatEmitted` para no duplicar |
| ADR-07 | Backend único para REST y WS | Menos complejidad operativa | Un solo punto de fallo |
| ADR-08 | Esquemas `auth`, `core`, `chat` | Separación de dominios y aislamiento | Mayor disciplina en consultas y migraciones |

## 13. Limitaciones conocidas

- El bloqueo de nodos es visual, no transaccional.
- Un `VIEWER` no está aislado por completo a nivel de actualizaciones Yjs.
- La IA depende de Groq y de la disponibilidad de red.
- El historial se limita a 15 mensajes y a un recorte de caracteres.
- La generación de backend cubre el modelo actual; no todo UML 2.5.
- El despliegue del backend requiere un host con WebSocket persistente.
- No hay observabilidad distribuida ni métricas de uso.

## 14. Referencias internas

- `README.md`
- `docs/FLUJOS_Y_ARQUITECTURA.md`
- `frontend/src/hooks/useCollaborativeFlow.ts`
- `frontend/src/hooks/useAICommand.ts`
- `frontend/src/hooks/useDiagramMembers.ts`
- `backend/server.js`
- `backend/app.js`
- `backend/realtime/yjs.js`
- `backend/errors.js`
- `backend/middleware/errorHandler.js`
- `backend/db.js`
- `backend/services/aiService.js`
- `backend/services/chatService.js`
- `backend/services/diagramService.js`
- `backend/services/aclService.js`
- `backend/services/userService.js`

Continuar con [[02_Proceso]].
