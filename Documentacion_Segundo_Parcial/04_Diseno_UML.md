# Diseño UML

## 1. Propósito y principios

El diseño traduce el análisis en una solución técnica concreta. Se rige por cinco principios:

1. **Separación de responsabilidades:** presentación, API, dominio, persistencia y generación no se mezclan.
2. **Estado canónico único:** el grafo vive en Yjs; React Flow es una vista derivada.
3. **Persistencia híbrida:** el documento CRDT se guarda como snapshot; los datos de negocio se normalizan en SQL.
4. **Seguridad en el servidor:** la identidad y los roles se verifican en el backend.
5. **Contratos explícitos:** los endpoints, mutaciones y esquemas tienen forma definida.

## 2. Diseño de despliegue

```mermaid
graph LR
    B[Navegador<br/>Next.js Client] -->|HTTPS| V[Vercel<br/>Frontend]
    B -->|REST + JWT| R[Railway<br/>Backend Node]
    B -->|WebSocket + JWT| R
    R -->|SQL TLS| N[(Neon PostgreSQL<br/>auth / core / chat)]
    R -->|HTTPS| G[Groq API<br/>texto / voz / visión]
```

### 2.1 Nodos de despliegue

| Nodo | Tecnología | Responsabilidad |
|---|---|---|
| Cliente | Navegador moderno | Interfaz, Yjs, React Flow, chat |
| Frontend | Vercel + Next.js | Entrega de páginas y assets |
| Backend | Railway + Node.js | REST, WebSocket, IA y generación |
| Base de datos | Neon PostgreSQL | Persistencia durable |
| IA | Groq API | Inferencia de texto, audio y visión |

### 2.2 Comunicaciones

| Origen | Destino | Protocolo | Autenticación |
|---|---|---|---|
| Navegador | Frontend | HTTPS | Sesión del navegador |
| Navegador | Backend | HTTPS REST | `Authorization: Bearer` |
| Navegador | Backend | WebSocket | `?token=` |
| Backend | Neon | PostgreSQL TLS | `DATABASE_URL` |
| Backend | Groq | HTTPS | `GROQ_API_KEY` |

### 2.3 Configuración

El frontend usa `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_WS_URL`. El backend usa `PORT`, `DATABASE_URL`, `JWT_SECRET`, `AUTH_ENABLED`, `GROQ_API_KEY`, `GROQ_MODEL` y `GROQ_VISION_MODEL`.

### 2.3.1.3. Diseño de Base de Datos

La base de datos de la aplicación se despliega en **PostgreSQL/Neon** y se sectoriza en tres esquemas lógicos: `auth` para identidad y permisos, `core` para diagramas y snapshots, y `chat` para conversaciones. La sectorización reduce el acoplamiento entre dominios y permite aplicar permisos y respaldos por área.

```mermaid
erDiagram
    USERS ||--o{ DIAGRAMS : "owner_id · ON DELETE CASCADE"
    USERS ||--o{ DIAGRAM_ACL : "user_id · ON DELETE CASCADE"
    DIAGRAMS ||--o{ MESSAGES : "diagram_id · ON DELETE CASCADE"
    DIAGRAMS ||--o{ DIAGRAM_ACL : "diagram_id · integridad en servicio"
    DIAGRAMS ||--o{ ACCESS_REQUESTS : "diagram_id · ON DELETE CASCADE"
    USERS ||--o{ ACCESS_REQUESTS : "requester_id · ON DELETE CASCADE"

    USERS {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        timestamptz created_at
    }

    DIAGRAMS {
        varchar id PK
        varchar name
        uuid owner_id FK
        bytea yjs_snapshot
        timestamptz created_at
        timestamptz updated_at
    }

    DIAGRAM_ACL {
        uuid id PK
        varchar diagram_id
        uuid user_id FK
        varchar role
        timestamptz granted_at
    }

    MESSAGES {
        uuid id PK
        varchar diagram_id FK
        varchar author
        varchar role
        text content
        timestamptz created_at
    }

    ACCESS_REQUESTS {
        uuid id PK
        varchar diagram_id FK
        uuid requester_id FK
        varchar status
        timestamptz created_at
    }
```

**Aplicación de las reglas de Rumbaugh:**

| Regla                                  | Aplicación en el modelo                                                                                               | Evidencia                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Clase persistente → tabla              | `Usuario`, `Diagrama`, `PermisoDiagrama` y `MensajeChat` se materializan como tablas                                  | `auth.users`, `core.diagrams`, `auth.diagram_acl`, `chat.messages`                                |
| Atributo → columna                     | Cada atributo persistente recibe tipo, nulabilidad y restricción                                                      | `password_hash`, `yjs_snapshot`, `role`, `content`                                                |
| Asociación 1:N → clave foránea         | Un usuario posee muchos diagramas; un diagrama contiene muchos mensajes                                               | `core.diagrams.owner_id`, `chat.messages.diagram_id`                                              |
| Asociación N:M → tabla intermedia      | Un usuario puede participar en muchos diagramas y un diagrama tener muchos usuarios; la tabla intermedia lleva el rol | `auth.diagram_acl`, restricción única `(diagram_id, user_id)`                                     |
| Generalización → estrategia relacional | El generador Spring Boot aplica herencia `JOINED` a las jerarquías UML del diagrama del usuario                       | `@Inheritance(strategy = InheritanceType.JOINED)` en `backend/generator/templates/model.java.hbs` |

**Precisión sobre herencia:** la base de datos propia de la herramienta (`auth`, `core`, `chat`) no contiene una jerarquía de herencia; por tanto, no se inventa una tabla padre. La estrategia `JOINED` se aplica al **backend generado** a partir de los diagramas UML del usuario, donde el generador emite una tabla por clase y `@PrimaryKeyJoinColumn` en las subclases. Esta distinción mantiene la coincidencia entre documentación y código.

**Acciones referenciales:**

- `core.diagrams.owner_id → auth.users.id`: `ON DELETE CASCADE`.
- `auth.diagram_acl.user_id → auth.users.id`: `ON DELETE CASCADE`.
- `chat.messages.diagram_id → core.diagrams.id`: `ON DELETE CASCADE`.
- `auth.diagram_acl.diagram_id` no tiene FK física en el esquema entregado; la integridad se garantiza en `deleteDiagram` mediante una transacción que elimina ACL y diagrama.

El snapshot Yjs se almacena como `bytea` opaco y no se normaliza: representa un CRDT con relojes lógicos e identificadores internos. El chat, en cambio, se normaliza para consultas, memoria de IA y auditoría.

### 2.4. Diagrama de Despliegue (Arquitectura Física)

El diagrama representa los nodos físicos y los protocolos de comunicación. El cliente ejecuta la aplicación Next.js y el cliente Yjs; Vercel entrega el frontend; Railway ejecuta el backend en capas (`routes/` → `middleware/` → `services/` → `db.js`) y el servidor WebSocket; Neon conserva la base sectorizada; Groq provee inferencia externa.

```mermaid
flowchart TB
    CLIENTE["Cliente · Navegador<br/>Next.js 16 + React Flow<br/>Y.Doc + WebsocketProvider"]
    VERCEL["Servidor Frontend<br/>Vercel<br/>Next.js App Router"]

    subgraph RAILWAY["Servidor Backend — Railway<br/>Node.js + Express + y-websocket"]
        direction TB
        APP["Capa de Rutas<br/>app.js + routes/*"]
        MW["Capa de Middleware<br/>auth · diagramAuth · errorHandler"]
        SVC["Capa de Servicios<br/>user · acl · diagram · chat · accessRequest · ai"]
        DBLAYER["Capa de Persistencia<br/>db.js"]
    end

    NEON[("Base de Datos<br/>Neon PostgreSQL<br/>auth / core / chat")]
    GROQ["IA Externa<br/>Groq Cloud<br/>LLM configurable"]

    CLIENTE -->|HTTPS| VERCEL
    CLIENTE -->|HTTPS · REST + JWT| APP
    CLIENTE <-->|WSS · Yjs + JWT| APP
    APP --> MW
    MW --> SVC
    SVC --> DBLAYER
    DBLAYER -->|TCP/IP + TLS| NEON
    SVC -->|HTTPS| GROQ
```

**Correspondencia con el despliegue real:**

| Nodo | Plataforma | Proceso | Protocolo |
|---|---|---|---|
| Cliente | Navegador | Next.js, React Flow, Yjs Client | HTTPS, WSS |
| Frontend | Vercel | Next.js App Router | HTTPS |
| Backend | Railway | Rutas (`app.js`, `routes/`), middleware, servicios, `db.js` y WebSocket Yjs | HTTPS, WSS |
| Base de datos | Neon | PostgreSQL administrado | TCP/IP + TLS |
| IA | Groq Cloud | Modelo configurable: `gpt-oss-20b` por defecto, Qwen para visión y Whisper para voz | HTTPS |

## 3. Diseño de componentes

### 3.1 Frontend

```mermaid
classDiagram
    class EditorPage {
      +diagramId
      +render()
    }

    class CollaborativeFlow {
      +Y.Doc doc
      +WebsocketProvider provider
      +addNode()
      +addEdge()
      +addMessage()
      +loadDiagramData()
    }

    class AICommand {
      +handleSendCommand()
      +handleVoiceCommand()
      +handleFromImage()
    }

    class ChatPanel {
      +messages
      +currentUsername
      +onSend()
    }

    class ApiClient {
      +apiFetch()
      +getWsParams()
    }

    class AuthContext {
      +user
      +token
      +login()
      +logout()
    }

    EditorPage --> CollaborativeFlow
    EditorPage --> AICommand
    EditorPage --> ChatPanel
    AICommand --> ApiClient
    CollaborativeFlow --> ApiClient
    ChatPanel --> AICommand
    AuthContext --> ApiClient
```

### 3.2 Backend

```mermaid
classDiagram
    class Server {
      +expressApp
      +httpServer
      +websocketServer
    }

    class Routes {
      <<infrastructure>>
      +authRoutes()
      +diagramRoutes()
      +aclRoutes()
      +accessRequestRoutes()
      +aiRoutes()
    }

    class AuthMiddleware {
      +requireAuth()
      +verifyToken()
    }

    class DiagramAuth {
      +requireDiagramMember()
      +requireDiagramRole()
      +requireDiagramWrite()
    }

    class ErrorHandler {
      +handle(err)
    }

    class UserService {
      +createUser()
      +verifyPassword()
      +findById()
    }

    class AclService {
      +readACL()
      +getRoleForUser()
      +addMember()
      +removeMember()
    }

    class DiagramService {
      +createDiagramWithOwner()
      +createDiagramWithOwnerIfAbsent()
      +getSnapshot()
      +saveSnapshot()
      +deleteDiagram()
    }

    class ChatService {
      +addMessage()
      +getRecentMessages()
    }

    class AccessRequestService {
      +requestAccess()
      +listPendingForOwner()
      +respondToRequest()
    }

    class AiService {
      +getMutationsFromAI()
      +formatChatHistory()
      +resolveAiProvider()
    }

    class DB {
      +pool
      +withTransaction()
    }

    Server --> Routes
    Routes --> AuthMiddleware
    Routes --> DiagramAuth
    Routes --> ErrorHandler
    Routes --> UserService
    Routes --> AclService
    Routes --> DiagramService
    Routes --> ChatService
    Routes --> AccessRequestService
    Routes --> AiService
    AuthMiddleware --> UserService
    DiagramAuth --> AclService
    UserService --> DB
    AclService --> DB
    DiagramService --> DB
    ChatService --> DB
    AccessRequestService --> DB
```

### 3.3 Responsabilidades

| Componente | Responsabilidad | No debe hacer |
|---|---|---|
| `server.js` | Bootstrap: entorno, HTTP, PostgreSQL, señales y apagado | Definir rutas o lógica de negocio |
| `app.js` | Componer Express, CORS, JSON, salud y rutas | Escuchar puertos o abrir WebSockets |
| `realtime/yjs.js` | WebSocket, snapshots, autenticación WS y chat Yjs | Validar cuerpos REST |
| `routes/auth.js` | Registro, login, sesión | Acceder directamente a SQL |
| `routes/diagrams.js` | CRUD de diagramas y chat inicial | Crear ACL sin transacción |
| `routes/ai.js` | Orquestar comandos, voz, imagen y generación | Construir prompts o llamar Groq directamente |
| `routes/acl.js` | Gestionar miembros | Modificar el grafo |
| `middleware/auth.js` | Verificar JWT | Decidir roles de diagrama |
| `middleware/diagramAuth.js` | Validar membresía y rol | Persistir datos |
| `middleware/errorHandler.js` | Formato único de errores y 404 | Conocer reglas de negocio |
| `userService` | Usuarios y contraseñas | Firmar tokens |
| `aclService` | ACL y roles | Guardar snapshots |
| `diagramService` | Diagramas y snapshots | Conocer Groq |
| `chatService` | Mensajes y memoria | Llamar a Groq |
| `aiService` | Prompts, cliente Groq y parsing | Responder HTTP directamente |

### 3.4. Diagrama de clases del dominio persistente

El siguiente diagrama modela las entidades persistentes del backend con atributos tipados y multiplicidades UML 2.5. Las clases representan el dominio almacenado en PostgreSQL; no se muestran las estructuras efímeras de Yjs.

```mermaid
classDiagram
    class Usuario {
        -UUID id
        -String username
        -String email
        -String passwordHash
        -Date createdAt
        +getId() UUID
        +getUsername() String
    }

    class Diagrama {
        -String id
        -String name
        -UUID ownerId
        -byte[] yjsSnapshot
        -Date createdAt
        -Date updatedAt
        +getId() String
        +getOwnerId() UUID
    }

    class ACL {
        -UUID id
        -String diagramId
        -UUID userId
        -Rol role
        -Date grantedAt
        +getRole() Rol
    }

    class ChatMessage {
        -UUID id
        -String diagramId
        -String author
        -String role
        -String content
        -Date createdAt
        +getAuthor() String
    }

    class AccessRequest {
        -UUID id
        -String diagramId
        -UUID requesterId
        -AccessRequestStatus status
        -Date createdAt
        +isPending() Boolean
    }

    class Rol {
        <<enumeration>>
        OWNER
        EDITOR
        VIEWER
    }

    class AccessRequestStatus {
        <<enumeration>>
        PENDING
        APPROVED
        REJECTED
    }

    Usuario "1" --> "0..*" Diagrama : posee
    Usuario "1" --> "0..*" ACL : participa
    Diagrama "1" --> "0..*" ACL : concede
    Diagrama "1" --> "0..*" ChatMessage : contiene
    Usuario "1" --> "0..*" AccessRequest : solicita
    Diagrama "1" --> "0..*" AccessRequest : recibe
    ACL --> Rol : clasifica
    AccessRequest --> AccessRequestStatus : clasifica
```

Estas clases pertenecen a la **capa de dominio/persistencia**: se materializan en los esquemas `auth`, `core` y `chat`, y su acceso queda encapsulado por `db.js` y los servicios. No son clases de la capa de rutas ni de los middlewares.

**Lectura de multiplicidades:**

- Un `Usuario` posee `0..*` diagramas; cada diagrama tiene un único `owner`.
- Un `Usuario` participa en `0..*` ACL; cada ACL pertenece a un único usuario.
- Un `Diagrama` concede `0..*` ACL; cada ACL referencia un único diagrama.
- Un `Diagrama` contiene `0..*` mensajes; cada mensaje pertenece a un único diagrama.
- Un `Usuario` puede crear `0..*` solicitudes de acceso; cada `AccessRequest` tiene un único `requester_id`.
- Un `Diagrama` puede recibir `0..*` solicitudes; cada `AccessRequest` referencia un único `diagram_id`.

### 3.5. Diagrama de Componentes del Backend (Node.js / Clean Architecture)

```mermaid
flowchart LR
    CLIENTE["Cliente Next.js"] --> RUTAS["Capa de Rutas<br/>app.js · routes/*"]
    RUTAS --> MW["Capa de Middleware<br/>auth · diagramAuth · errorHandler"]
    MW --> SVC["Capa de Servicios<br/>user · acl · diagram · chat · accessRequest · ai · generate"]
    SVC --> REPO["Capa de Persistencia<br/>db.js · SQL parametrizado"]
    REPO --> NEON[("PostgreSQL / Neon<br/>auth · core · chat")]
    SVC --> AI["Adaptador IA<br/>Groq / Ollama"]
    SVC --> GEN["Generador<br/>Handlebars + ZIP"]
    WS["WebSocket Server (Yjs)<br/>realtime/yjs.js"] --> SVC
    WS --> REPO
```

La capa de persistencia se implementa en `db.js` y en las funciones SQL parametrizadas de los servicios; no existe una carpeta `repositories/` separada. El diagrama mantiene la regla de dependencia de Clean Architecture: `Cliente → Rutas → Middleware → Servicios → Persistencia → PostgreSQL`. La API no accede directamente a PostgreSQL y el servidor WebSocket reutiliza los mismos servicios de ACL, diagrama y chat, evitando duplicar reglas de negocio.

### 3.6. Diagrama de Componentes del Backend Generado (Spring Boot)

El generador de `backend/generator/generate.js` produce un proyecto Spring Boot con separación en cuatro capas. El modelo JPA se deriva del AST y las plantillas Handlebars materializan controladores, servicios, repositorios y entidades.

```mermaid
flowchart LR
    CONTROLLER["Capa Controlador<br/>@RestController"] --> SERVICE["Capa Servicio<br/>@Service"]
    SERVICE --> REPOSITORY["Capa Repositorio<br/>JpaRepository"]
    REPOSITORY --> MODEL["Capa Modelo<br/>@Entity"]
    SERVICE --> MODEL
    MODEL --> POSTGRES[("PostgreSQL<br/>tablas generadas")]
    REPOSITORY --> POSTGRES
```

El flujo de dependencias es unidireccional: el controlador no conoce SQL, el servicio orquesta casos de uso y el repositorio encapsula el acceso a datos. La herencia UML se traduce con `@Inheritance(strategy = InheritanceType.JOINED)` en la raíz de la jerarquía.

### 3.7. Diagrama de paquetes de implementación

La estructura física separa el frontend, el backend por capas y la documentación. `routes/` depende de `middleware/`, este de `services/` y los servicios de `db.js`; el frontend solo consume la API.

```mermaid
flowchart TB
    subgraph FRONTEND["frontend/src"]
        APP["app/"]
        COMPONENTS["components/"]
        HOOKS["hooks/"]
        LIB["lib/"]
        UTILS["utils/"]
    end

    subgraph BACKEND["backend/"]
        BOOT["server.js + app.js"]
        ROUTES["routes/"]
        MW["middleware/"]
        SERVICES["services/"]
        DB["db.js"]
        REALTIME["realtime/yjs.js"]
        GENERATOR["generator/"]
    end

    APP --> HOOKS
    COMPONENTS --> HOOKS
    HOOKS --> LIB
    LIB --> UTILS
    HOOKS -->|REST + WSS| ROUTES
    ROUTES --> MW
    MW --> SERVICES
    SERVICES --> DB
    REALTIME --> SERVICES
    REALTIME --> DB
    ROUTES --> GENERATOR
```

### 3.8. Clases del Backend Generado (Spring Boot)

El generador materializa una arquitectura de cuatro capas para cada entidad. El controlador expone HTTP, el servicio contiene la lógica, el repositorio abstrae JPA y la entidad representa la tabla. La dependencia desciende desde el controlador hasta el modelo.

```mermaid
classDiagram
    class DiagramaController {
        <<controller>>
        +getAll() List
        +create(dto) DiagramaDTO
    }

    class DiagramaService {
        <<service>>
        +list() List
        +create(dto) Diagrama
    }

    class DiagramaRepository {
        <<repository>>
        +findById(id) Diagrama
        +save(diagrama) Diagrama
        +delete(id) void
    }

    class Diagrama {
        <<entity>>
        -UUID id
        -String name
        -UUID ownerId
        -Date createdAt
        +getId() UUID
    }

    DiagramaController --> DiagramaService : delega
    DiagramaService --> DiagramaRepository : consulta
    DiagramaRepository --> Diagrama : persiste
```

Este nivel C4 de código demuestra que el backend generado conserva la misma dirección de dependencias que el backend principal: la capa externa (Controller) conoce la capa interna (Service), y la persistencia queda aislada en Repository.

### 3.9. Diagrama de casos de uso (referencia UML)

El diagrama canónico de requisitos está en `01_Requisitos_y_Proceso.md`. Esta vista compacta mantiene la trazabilidad de los ocho casos de uso dentro del capítulo UML.

```mermaid
flowchart LR
    V["Visitante"]
    I["Ingeniero de Software"]
    C["Colaborador"]

    CU01(["CU-01 Autenticarse"])
    CU02(["CU-02 Gestionar diagramas"])
    CU03(["CU-03 Editar colaborativamente"])
    CU04(["CU-04 Gestionar miembros"])
    CU05(["CU-05 Exportar e importar"])
    CU06(["CU-06 Interactuar con Agente IA"])
    CU07(["CU-07 Generar backend"])
    CU08(["CU-08 Consultar manual"])

    V --> CU01
    I --> CU01
    I --> CU02
    I --> CU03
    I --> CU04
    I --> CU05
    I --> CU06
    I --> CU07
    I --> CU08
    C --> CU03
    C --> CU05
    C --> CU06
```

## 4. Diseño de clases del asistente IA

### 4.1 Clases conceptuales de diseño

| Clase | Método / campo | Responsabilidad |
|---|---|---|
| `ChatPanel` | `messages`, `currentUsername`, `onSend` | Frontera de chat, sin API |
| `Toolbar` | props de acciones y archivos | Frontera de comandos, sin API |
| `MembersPanel` | render de owner/miembros | Delegar datos a `useDiagramMembers` |
| `useDiagramMembers` | cargar, invitar, cambiar rol y eliminar | Renderizar |
| `useAICommand` | `sendCommandText`, `handleVoiceCommand`, `handleFromImage` | Control de la interacción |
| `nodesToAST` | función pura | Convertir canvas en dominio |
| `applyMutations` | función pura | Aplicar mutaciones en orden |
| `apiFetch` | función | Adjuntar JWT y ejecutar HTTP |
| `ChatService` | `addMessage`, `getRecentMessages` | Persistencia del chat |
| `AiService` | `getMutationsFromAI`, `formatChatHistory` | Adaptador del proveedor |
| `AIController` | `routes/ai.js`, `/api/ai/command` | Orquestación del turno |
| `YjsPublisher` | `emitChatMessage` en `realtime/yjs.js` | Publicar respuesta en la sala |

### 4.2 Flujo de objetos del asistente

```text
ChatPanel
  └─ useAICommand
       ├─ nodesToAST(nodes, edges)
       ├─ apiFetch(POST /api/ai/command)
       │    └─ app.js -> routes/ai.js
       │         ├─ requireAuth
       │         ├─ chatService.getRecentMessages
       │         ├─ chatService.addMessage(user)
       │         ├─ aiService.getMutationsFromAI
       │         ├─ chatService.addMessage(assistant)
       │         └─ realtime/yjs.js: emitChatMessage
       └─ applyMutations
            └─ Yjs (addNode/addEdge/update/remove)
```

### 4.3 Decisiones del asistente

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Identidad desde JWT | Enviar username en el body | Evita suplantación |
| Historial en PostgreSQL | Enviar historial desde el frontend | Evita manipulación y pérdida |
| Límite de 15 mensajes | Historial completo | Controla costo y latencia |
| Mutaciones tipadas | Modificar el canvas desde la IA | Permite validar y aplicar de forma segura |
| Emisión por Yjs | Solo respuesta HTTP | Todos los colaboradores ven la IA |
| Fallback de texto | Fallar ante JSON inválido | Mejora la recuperación de consultas teóricas |

## 5. Anexo de detalle: base de datos

Este anexo desarrolla el modelo resumido en **2.3.1.3** y conserva el DDL de referencia, la justificación de normalización y las desviaciones controladas.

### 5.1 Sectorización

```text
neondb
├── auth
│   ├── users
│   └── diagram_acl
├── core
│   └── diagrams
├── chat
│   └── messages
└── public
    └── tablas ajenas al proyecto
```

La base Neon es compartida con otras tablas en `public`. Por eso el proyecto usa esquemas propios y nunca asume que `public` le pertenece.

### 5.2 Modelo relacional

```mermaid
erDiagram
    USERS ||--o{ DIAGRAMS : posee
    USERS ||--o{ DIAGRAM_ACL : recibe
    DIAGRAMS ||--o{ DIAGRAM_ACL : concede
    DIAGRAMS ||--o{ MESSAGES : contiene
    USERS ||--o{ ACCESS_REQUESTS : solicita
    DIAGRAMS ||--o{ ACCESS_REQUESTS : recibe

    USERS {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        timestamptz created_at
    }

    DIAGRAMS {
        varchar id PK
        varchar name
        uuid owner_id FK
        bytea yjs_snapshot
        timestamptz created_at
        timestamptz updated_at
    }

    DIAGRAM_ACL {
        uuid id PK
        varchar diagram_id
        uuid user_id FK
        varchar role
        timestamptz granted_at
    }

    MESSAGES {
        uuid id PK
        varchar diagram_id FK
        varchar author
        varchar role
        text content
        timestamptz created_at
    }

    ACCESS_REQUESTS {
        uuid id PK
        varchar diagram_id FK
        uuid requester_id FK
        varchar status
        timestamptz created_at
    }
```

### 5.3 `auth.users`

| Columna | Tipo | Nulabilidad | Restricción |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | PK, default `uuid_generate_v4()` |
| `username` | `varchar` | NOT NULL | UNIQUE |
| `email` | `varchar` | NOT NULL | UNIQUE |
| `password_hash` | `varchar` | NOT NULL | Hash bcrypt |
| `created_at` | `timestamptz` | NULL | default `CURRENT_TIMESTAMP` |

### 5.4 `auth.diagram_acl`

| Columna | Tipo | Nulabilidad | Restricción |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | PK, default `uuid_generate_v4()` |
| `diagram_id` | `varchar` | NOT NULL | Sin FK física en el esquema actual |
| `user_id` | `uuid` | NULL | FK a `auth.users(id)` ON DELETE CASCADE |
| `role` | `varchar` | NOT NULL | CHECK `OWNER`, `EDITOR`, `VIEWER` |
| `granted_at` | `timestamptz` | NULL | default `CURRENT_TIMESTAMP` |

Restricción única: `(diagram_id, user_id)`.

> **Decisión:** la integridad de `diagram_id` se garantiza en la capa de servicio. `deleteDiagram` elimina primero la ACL y después el diagrama dentro de una transacción. No existe FK física de `auth.diagram_acl.diagram_id` a `core.diagrams.id` en el esquema entregado.

### 5.5 `core.diagrams`

| Columna | Tipo | Nulabilidad | Restricción |
|---|---|---|---|
| `id` | `varchar` | NOT NULL | PK |
| `name` | `varchar` | NOT NULL | Nombre visible |
| `owner_id` | `uuid` | NULL | FK a `auth.users(id)` ON DELETE CASCADE |
| `yjs_snapshot` | `bytea` | NULL | Estado Yjs codificado |
| `created_at` | `timestamptz` | NULL | default `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamptz` | NULL | default `CURRENT_TIMESTAMP` |

### 5.6 `chat.messages`

| Columna | Tipo | Nulabilidad | Restricción |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | PK, default `uuid_generate_v4()` |
| `diagram_id` | `varchar` | NULL | FK a `core.diagrams(id)` ON DELETE CASCADE |
| `author` | `varchar` | NOT NULL | Nombre visible |
| `role` | `varchar` | NOT NULL | CHECK `user`, `assistant`, `system` |
| `content` | `text` | NOT NULL | Contenido del mensaje |
| `created_at` | `timestamptz` | NULL | default `CURRENT_TIMESTAMP` |

### 5.6.1 `auth.access_requests`

| Columna | Tipo | Nulabilidad | Restricción |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | PK, default `uuid_generate_v4()` |
| `diagram_id` | `varchar` | NOT NULL | FK a `core.diagrams(id)` ON DELETE CASCADE |
| `requester_id` | `uuid` | NOT NULL | FK a `auth.users(id)` ON DELETE CASCADE |
| `status` | `varchar` | NOT NULL | CHECK `PENDING`, `APPROVED`, `REJECTED`; default `PENDING` |
| `created_at` | `timestamptz` | NOT NULL | default `CURRENT_TIMESTAMP` |

**Restricciones adicionales:**

- Índice único parcial `(diagram_id, requester_id) WHERE status = 'PENDING'`: un usuario solo puede tener una solicitud pendiente por diagrama.
- Índice `(diagram_id, status)` para listar solicitudes pendientes del propietario.
- Índice `(requester_id)` para consultas por solicitante.

La aprobación se ejecuta en una transacción: se bloquea la solicitud con `FOR UPDATE`, se verifica que el usuario sea el `OWNER` del diagrama, se inserta/actualiza la ACL con el rol elegido y se cambia `status` a `APPROVED`. Si algo falla, la transacción hace `ROLLBACK`.

### 5.7 DDL de referencia

```sql
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

> El DDL asume que la extensión `uuid-ossp` está disponible, porque el esquema real usa `uuid_generate_v4()`.

### 5.8 Integridad referencial

| Relación | FK | Borrado |
|---|---|---|
| `core.diagrams.owner_id` | `auth.users.id` | CASCADE |
| `auth.diagram_acl.user_id` | `auth.users.id` | CASCADE |
| `chat.messages.diagram_id` | `core.diagrams.id` | CASCADE |
| `auth.access_requests.diagram_id` | `core.diagrams.id` | CASCADE |
| `auth.access_requests.requester_id` | `auth.users.id` | CASCADE |
| `auth.diagram_acl.diagram_id` | No física | Gestión en servicio |

### 5.9 Normalización

El modelo está en **tercera forma normal** para los datos relacionales:

- Cada tabla tiene clave primaria.
- Los atributos no clave dependen de la clave completa.
- No hay dependencias transitivas.
- La relación usuario-diagrama se resuelve con una tabla intermedia.
- El rol y la fecha de concesión dependen de la pareja diagrama-usuario, no de una de las entidades por separado.

**Excepción deliberada:** `yjs_snapshot` es un objeto binario opaco. No se normaliza porque representa un documento CRDT completo, con relojes lógicos e identificadores internos. Descomponerlo destruiría la semántica de colaboración.

## 6. Aplicación de las reglas de Rumbaugh

Las reglas de transformación del modelo de objetos al modelo relacional se aplican en cuatro pasos explícitos. El criterio rector es preservar la identidad, la multiplicidad y las acciones referenciales del modelo UML sin introducir tablas redundantes.

| Elemento UML | Transformación Rumbaugh | Resultado en PostgreSQL |
|---|---|---|
| Clase persistente | Una tabla por clase con clave primaria | `auth.users`, `core.diagrams`, `chat.messages` |
| Atributo simple | Una columna con dominio y nulabilidad | `username`, `name`, `content` |
| Asociación 1:N | Clave foránea en el lado muchos | `owner_id`, `diagram_id` |
| Asociación N:M con atributos | Tabla intermedia con PK propia y columnas de relación | `auth.diagram_acl` con `role` y `granted_at` |
| Generalización | Estrategia `JOINED` en el backend generado | Tabla por clase + `@PrimaryKeyJoinColumn` |
| Agregación/composición | FK con `ON DELETE CASCADE` cuando el ciclo de vida depende del todo | `chat.messages.diagram_id` |

### 6.1 Regla 1: clase persistente → tabla

Cada clase con identidad y ciclo de vida propio se transforma en una tabla:

| Clase | Tabla |
|---|---|
| Usuario | `auth.users` |
| Diagrama | `core.diagrams` |
| PermisoDiagrama | `auth.diagram_acl` |
| MensajeChat | `chat.messages` |

La clase `SnapshotYjs` no se convierte en una tabla independiente porque es un valor interno de `Diagrama`. Se representa como la columna `yjs_snapshot`.

### 6.2 Regla 2: atributo → columna

Cada atributo persistente se convierte en una columna con dominio, nulabilidad y valor por defecto:

| Atributo conceptual | Columna | Dominio |
|---|---|---|
| Identificador de usuario | `auth.users.id` | `uuid` |
| Username | `auth.users.username` | `varchar` único |
| Email | `auth.users.email` | `varchar` único |
| Contraseña | `auth.users.password_hash` | `varchar` |
| Nombre del diagrama | `core.diagrams.name` | `varchar` no nulo |
| Rol | `auth.diagram_acl.role` | `varchar` con CHECK |
| Contenido | `chat.messages.content` | `text` no nulo |
| Fecha | `created_at`, `granted_at` | `timestamptz` |

### 6.3 Regla 3: asociación → clave foránea o tabla intermedia

- **Asociación 1:N:** un usuario posee muchos diagramas. Se resuelve con `core.diagrams.owner_id` como FK a `auth.users.id`.
- **Asociación N:M:** un usuario puede participar en muchos diagramas y un diagrama puede tener muchos usuarios. Se resuelve con la tabla intermedia `auth.diagram_acl`.
- **Asociación con atributos:** `auth.diagram_acl` no es una tabla puente mínima; contiene `role` y `granted_at`, que pertenecen a la relación y no a una de las entidades.
- **Composición:** un diagrama contiene mensajes. Se resuelve con `chat.messages.diagram_id` y `ON DELETE CASCADE`.

### 6.4 Regla 4: generalización → estrategia relacional

El modelo persistente no requiere una jerarquía de tablas. Los roles `OWNER`, `EDITOR` y `VIEWER` no son subtipos con atributos propios; son valores de un dominio acotado. Por eso se modelan con una columna `role` y una restricción `CHECK`, en lugar de una tabla por rol.

Si en el futuro los roles adquirieran atributos o comportamientos distintos, la generalización podría transformarse en tablas relacionadas por clave primaria. Esa decisión no se justifica en el alcance actual.

### 6.5 Reglas complementarias de claves y acciones referenciales

| Regla | Aplicación | Resultado |
|---|---|---|
| Clave primaria | Identificadores únicos | UUID o varchar según el agregado |
| Clave única | Evitar duplicados | `username`, `email`, `(diagram_id, user_id)` |
| FK con cascada | Mantener integridad al borrar | `owner_id`, `user_id`, `messages.diagram_id` |
| Integridad en servicio | ACL sin FK a diagrama | Borrado transaccional de ACL y diagrama |

### 6.6 Justificación de la tabla intermedia

`PermisoDiagrama` no es una simple tabla de unión. Tiene atributos propios:

- `role`: OWNER, EDITOR o VIEWER.
- `granted_at`: momento de la concesión.
- `id`: identificador propio.

Por eso se modela como una **clase asociativa persistente**, no como una tabla puente mínima.

### 6.7 Desviaciones controladas

1. **Snapshot Yjs:** se conserva como `bytea` en lugar de tablas de nodos y aristas.
2. **`diagram_id` sin FK en ACL:** se mantiene por compatibilidad con el esquema entregado; la integridad se refuerza en el servicio.
3. **Roles como CHECK:** no se crea una tabla de roles porque el conjunto es fijo y pequeño.

## 7. Diseño de secuencias

### 7.1 Secuencia CU-06: comando IA con memoria

```mermaid
sequenceDiagram
    actor U as Usuario
    participant CP as ChatPanel
    participant AI as useAICommand
    participant API as Rutas API
    participant AUTH as Middleware JWT/ACL
    participant CS as Servicio Chat
    participant IAS as Servicio IA
    participant DB as PostgreSQL
    participant G as Groq
    participant Y as Yjs

    U->>CP: Comando de texto
    CP->>AI: handleSendCommand()
    AI->>Y: addMessage(user)
    AI->>AI: nodesToAST()
    AI->>API: POST /api/ai/command + Bearer
    API->>AUTH: requireAuth + requireDiagramMember
    AUTH-->>API: userId, username, rol
    API->>CS: getRecentMessages(diagramId, 15)
    CS->>DB: SELECT chat.messages
    DB-->>CS: historial
    API->>CS: addMessage(user)
    CS->>DB: INSERT role=user
    API->>IAS: getMutationsFromAI(...)
    IAS->>G: prompt + historial + AST
    G-->>IAS: response + mutations
    IAS-->>API: response + mutations
    API->>CS: addMessage(assistant)
    CS->>DB: INSERT role=assistant
    API->>Y: emitChatMessage(response)
    API-->>AI: mutations + response + chatEmitted
    AI->>Y: applyMutations()
    Y-->>CP: observar chat
    Y-->>U: render del diagrama
```

### 7.2 Secuencia de persistencia Yjs

```mermaid
sequenceDiagram
    participant C as Cliente
    participant WS as Servidor WS
    participant Y as Y.Doc
    participant DB as PostgreSQL

    C->>WS: update Yjs
    WS->>Y: applyUpdate
    Y->>Y: emit update
    Y->>WS: scheduleSnapshot(2s)
    WS->>DB: UPDATE core.diagrams SET yjs_snapshot
    WS-->>C: broadcast
```

El debounce de 2 segundos agrupa ráfagas de cambios. Además, `writeState` fuerza un guardado final al cerrar el documento.

### 7.3 Secuencia de generación de backend

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant API as Rutas API
    participant MW as Middleware Auth
    participant GEN as Servicio Generador
    participant FS as Temporal
    participant B as Navegador

    U->>F: Generar backend
    F->>F: nodesToAST()
    F->>API: POST /api/generate
    API->>MW: requireAuth
    MW-->>API: identidad verificada
    API->>GEN: generateProject(ast)
    GEN->>GEN: normalizar y expandir relaciones
    GEN->>FS: escribir ZIP
    API->>B: res.download()
    API->>FS: eliminar temporal
```

### 7.4 Diagrama de comunicación: comando de IA

El diagrama de comunicación muestra la interacción entre objetos y capas al procesar un comando de IA. Los números indican el orden de los mensajes.

```mermaid
flowchart LR
    CP["ChatPanel"]
    RT["Rutas API<br/>routes/ai.js"]
    MW["Middleware<br/>auth · diagramAuth"]
    AI["Servicio IA<br/>aiService"]
    LLM["Groq / Ollama"]
    DB[("Persistencia<br/>db.js / PostgreSQL")]

    CP -->|1: Petición HTTP| RT
    RT -->|2: Validar token| MW
    MW -->|3: Procesar comando| AI
    AI -->|4: Consultar modelo| LLM
    AI -->|5: Guardar historial| DB
    AI -->|6: Respuesta al cliente| CP
```

La secuencia respeta la regla de dependencia: `ChatPanel` no conoce la base de datos, las rutas no ejecutan lógica de negocio y el servicio de IA coordina el modelo y la persistencia a través de las capas correspondientes.

### 7.5 Diagrama de actividad: generar backend Spring Boot

El flujo modela la generación del backend Spring Boot. La solicitud de auditoría lo identifica como `CU-08`; en el inventario de requisitos del proyecto corresponde a `CU-07 Generar backend`.

```mermaid
flowchart TD
    INI(["Inicio"]) --> VAL["Validar diagrama"]
    VAL --> DEC{"¿Diagrama válido?"}
    DEC -->|No| ERR["Mostrar error"]
    ERR --> FIN1(["Fin"])
    DEC -->|Sí| EXP["Expandir relaciones N:M"]
    EXP --> HBS["Renderizar Handlebars"]
    HBS --> ZIP["Empaquetar ZIP"]
    ZIP --> DL["Descargar backend-generado.zip"]
    DL --> FIN2(["Fin"])
```

La validación ocurre antes de tocar el sistema de archivos. Si el AST no contiene entidades, el flujo termina en `Mostrar error`; si es válido, el servicio expande las relaciones muchos-a-muchos, renderiza las plantillas, empaqueta el ZIP y entrega la descarga.

## 8. Diseño de estados

### 8.1 Documento del diagrama

```mermaid
stateDiagram-v2
    [*] --> SinCargar
    SinCargar --> Cargando: abrir editor
    Cargando --> Activo: snapshot aplicado
    Cargando --> Vacio: sin snapshot
    Activo --> Editando: cambios Yjs
    Editando --> Activo: update propagado
    Activo --> Persistiendo: debounce
    Persistiendo --> Activo: snapshot guardado
    Activo --> Desconectado: caída WS
    Desconectado --> Activo: reconexión
```

### 8.2 Mensaje de chat

```mermaid
stateDiagram-v2
    [*] --> Local
    Local --> Persistido: INSERT exitoso
    Local --> Error: fallo de red
    Persistido --> Emitido: publicar en Yjs
    Emitido --> Visible: observer
    Error --> Local: reintento manual
```

### 8.3 Diagrama de Máquina de Estados y transformación Estado → Relacional

El siguiente autómata modela el comportamiento observable del diagrama desde su creación hasta la exportación. Es un diagrama de máquina de estados UML 2.5, no un diagrama de actividades.

```mermaid
stateDiagram-v2
    [*] --> BORRADOR
    BORRADOR --> EN_EDICION: abrir lienzo / conectar Yjs
    EN_EDICION --> SINCRONIZADO: guardar snapshot (debounce)
    SINCRONIZADO --> EN_EDICION: nuevo update Yjs
    SINCRONIZADO --> EXPORTADO: POST /api/generate
    EXPORTADO --> [*]
```

**Regla de transformación Estado → Relacional.** Un estado del autómata se transforma en un dominio enumerado y una columna de la tabla que representa la entidad. Las transiciones se implementan en los servicios de aplicación; no se almacenan como filas independientes.

```sql
CREATE TYPE core.diagram_state AS ENUM (
  'BORRADOR',
  'EN_EDICION',
  'SINCRONIZADO',
  'EXPORTADO'
);

ALTER TABLE core.diagrams
  ADD COLUMN state core.diagram_state NOT NULL DEFAULT 'BORRADOR';
```

| Estado UML | Significado | Mapeo relacional propuesto | Implementación actual |
|---|---|---|---|
| `BORRADOR` | Fila creada, aún sin snapshot | `state = 'BORRADOR'`; `yjs_snapshot IS NULL` | Derivado de `yjs_snapshot IS NULL` |
| `EN_EDICION` | Documento Yjs activo con clientes conectados | `state = 'EN_EDICION'` | Estado efímero de la sala; no se persiste |
| `SINCRONIZADO` | Snapshot guardado en PostgreSQL | `state = 'SINCRONIZADO'`; `updated_at` actualizado | Derivado de `yjs_snapshot IS NOT NULL` y `updated_at` |
| `EXPORTADO` | Backend generado y descargado | `state = 'EXPORTADO'` o `exported_at` | Se registra en la respuesta; no se persiste actualmente |

> **Trazabilidad de diseño:** el esquema aprobado de `core.diagrams` no incluye actualmente la columna `state`. El autómata documenta el comportamiento y la regla de transformación; la columna y el tipo ENUM se presentan como la materialización relacional prevista. Si se incorpora una migración, `createDiagramWithOwner` debe inicializar `BORRADOR`, el guardado de snapshot debe promover a `SINCRONIZADO` y la exportación debe registrar `EXPORTADO` o `exported_at`.

**Justificación:** persistir el estado como ENUM evita valores inválidos, reduce el costo de comparación frente a texto libre y mantiene una correspondencia directa con el autómata. Los estados efímeros (`EN_EDICION`) se derivan de la presencia de conexiones WebSocket para no generar escrituras innecesarias en cada apertura del lienzo.

## 9. Diseño de API

| Método | Ruta | Entrada | Salida | Seguridad |
|---|---|---|---|---|
| POST | `/api/auth/register` | username, email, password | token, user | Pública |
| POST | `/api/auth/login` | username, password | token, user | Pública |
| GET | `/api/auth/me` | — | user | JWT |
| GET | `/api/diagrams` | — | owned, shared | JWT |
| POST | `/api/diagrams` | name | id, name | JWT |
| GET | `/api/diagrams/:id` | — | name, chat | Miembro |
| POST | `/api/diagrams/:id` | name | ok | Escritura |
| PUT | `/api/diagrams/:id/rename` | name | ok, name | Escritura |
| DELETE | `/api/diagrams/:id` | — | 204 | OWNER |
| GET | `/api/diagrams/:id/role` | — | role | Miembro |
| POST | `/api/diagrams/:id/members` | username, role | ACL | OWNER |
| PATCH | `/api/diagrams/:id/members/:userId` | role | ACL | OWNER |
| DELETE | `/api/diagrams/:id/members/:userId` | — | ACL | OWNER o self |
| POST | `/api/ai/command` | command, currentState, diagramId | mutations, response | JWT |
| POST | `/api/ai/transcribe` | audio | text | JWT |
| POST | `/api/ai/from-image` | image, currentState | mutations | JWT |
| POST | `/api/generate` | currentState | ZIP | JWT |
| GET | `/health` | — | OK | Pública |
| WS | `/diagram-room-<id>?token=` | protocolo Yjs | updates | Gate 4401/4403/4404 |

## 10. Diseño de seguridad

### 10.1 Flujo de autenticación

```text
Credenciales
   │
   ▼
userService.verifyPassword
   │ bcrypt.compare
   ▼
signToken({ userId, username })
   │
   ▼
Cliente: localStorage
   │
   ├─ REST: Authorization: Bearer
   └─ WS: ?token=
```

### 10.2 Reglas de autorización

| Operación | OWNER | EDITOR | VIEWER |
|---|---|---|---|
| Ver diagrama | Sí | Sí | Sí |
| Editar nodos | Sí | Sí | No |
| Renombrar | Sí | Sí | No |
| Eliminar | Sí | No | No |
| Gestionar miembros | Sí | No | No |
| Usar IA | Sí | Sí | No |

### 10.3 Controles

- El token se verifica en cada petición protegida.
- El WebSocket cierra con `4401` si falta token.
- El WebSocket cierra con `4403` si no hay rol.
- El WebSocket cierra con `4404` si el diagrama no existe.
- El WebSocket espera el snapshot antes de aceptar mensajes del cliente.
- La IA exige autenticación.
- Los secretos se mantienen fuera del repositorio.

## 11. Diseño de errores y transacciones

| Escenario | Comportamiento |
|---|---|
| Falla la IA | Error `502` si el formato es inválido; no se aplican mutaciones sin validar |
| Falla la persistencia del mensaje assistant | Se registra el error; la respuesta puede emitirse igualmente |
| Falla la carga del snapshot | El WebSocket se rechaza con `1011`; no se abre un documento vacío |
| Falla la persistencia del snapshot | Se registra el error; el documento vivo conserva el estado |
| Borrado de diagrama | Transacción: ACL y diagrama |
| Creación de diagrama | Transacción única: diagrama + ACL OWNER |
| Rol inválido | Error de validación |
| ID de usuario inválido en ACL | Se rechaza; no se normaliza a anónimo |
| ID inválido | Se valida; si no cumple el formato, se rechaza |
| Token expirado | `401` |

### 11.1 Atomicidad de creación de diagrama y ACL

La creación ya no se ejecuta en dos pasos independientes. `POST /api/diagrams` usa `createDiagramWithOwner`, que abre una transacción PostgreSQL, inserta `core.diagrams` y la fila `OWNER` en `auth.diagram_acl`; si cualquiera de las dos operaciones falla, se hace `ROLLBACK`.

`POST /api/diagrams/:id` usa `createDiagramWithOwnerIfAbsent` para el caso de un id nuevo. Si el diagrama ya existe, no se crea una ACL nueva: se consulta el rol y solo `OWNER` o `EDITOR` pueden modificarlo. Un diagrama existente sin ACL se rechaza; ya no puede ser reclamado por el primer usuario que lo abra.

La validación de ACL dejó de tener efectos secundarios: `requireDiagramMember`, `requireDiagramRole`, `requireDiagramWrite` y la autenticación WebSocket solo consultan `getRoleForUser`. La creación de ACL es exclusiva de la creación del diagrama o de una migración explícita.

```mermaid
sequenceDiagram
    participant U as Usuario
    participant API as Express
    participant DB as PostgreSQL
    U->>API: POST /api/diagrams
    API->>DB: BEGIN
    API->>DB: INSERT core.diagrams
    API->>DB: INSERT auth.diagram_acl (OWNER)
    alt ambas correctas
        API->>DB: COMMIT
        API-->>U: 201 { id, name }
    else error
        API->>DB: ROLLBACK
        API-->>U: 500
    end
```

### 11.2 Carga del snapshot antes de aceptar clientes Yjs

El adaptador de persistencia carga `core.diagrams.yjs_snapshot` y expone `ydoc.readyPromise`. El servidor pausa el socket al recibir la conexión, valida token, rol y existencia del diagrama, y solo entonces espera `ensureDocumentReady()`.

Flujo:

1. `wss.on('connection')` ejecuta `ws.pause()`.
2. Se valida el JWT y la ACL sin crear filas.
3. `ensureDocumentReady()` crea o recupera el `Y.Doc` y espera la carga del snapshot.
4. Si la carga falla, se cierra con `1011`; no se permite escribir sobre un documento vacío.
5. Solo después se llama `setupWSConnection()` y se hace `ws.resume()`.

Además, `writeState` espera a `readyPromise` y `bindState` espera cualquier escritura final pendiente. Así se evita que una nueva conexión cargue un snapshot anterior mientras la conexión previa todavía está persistiendo el suyo.

```mermaid
sequenceDiagram
    participant C as Cliente
    participant WS as Servidor WS
    participant Y as Y.Doc
    participant DB as PostgreSQL
    C->>WS: connect ?token=
    WS->>WS: ws.pause()
    WS->>DB: validar ACL y diagrama
    WS->>Y: getYDoc()
    Y->>DB: SELECT yjs_snapshot
    DB-->>Y: snapshot
    Y-->>WS: readyPromise resuelta
    WS->>WS: setupWSConnection()
    WS->>C: ws.resume()
    C->>Y: sync step 1
```

### 11.3 Validación de entradas y mutaciones

Se incorporó `backend/validation.js` con validadores manuales sin dependencias nuevas:

- Comandos IA: texto máximo, AST con límites de entidades, relaciones y atributos.
- Mutaciones IA: allowlist de acciones y campos, tipos de relación, cardinalidades y atributos.
- Generación: AST con al menos una entidad y límites de tamaño.
- Imagen/voz: MIME esperado y tamaño máximo de `multer`.
- Autenticación: longitudes de username, email y password.
- ACL: UUID estricto para `userId`; un valor inválido no se convierte en anónimo.

Los errores de validación responden `400`. Si la IA devuelve una mutación no permitida, la API responde `502` y no aplica cambios parciales.

### 11.4 Cierre ordenado

`SIGTERM` y `SIGINT` ejecutan un apagado controlado: cancelan timers de debounce, hacen flush de snapshots, cierran clientes WebSocket, esperan escrituras pendientes, cierran el pool y terminan. Existe un timeout de seguridad de 15 segundos.

La generación de backends también usa un directorio temporal único por petición (`fs.mkdtempSync`) y guarda el ZIP dentro de ese directorio; la limpieza elimina solo el directorio de esa petición, no todo `generator/output`.

### 11.5 Manejo centralizado de errores

`errors.js` define `AppError`, `httpError` y `asyncHandler`. Las rutas se declaran como:

```js
router.post('/command', requireAuth, asyncHandler(async (req, res) => {
  // validar, delegar, responder
}));
```

`middleware/errorHandler.js` recibe cualquier rechazo, multer o JSON inválido y construye una respuesta uniforme:

- `400` para validación o JSON inválido.
- `401/403/404` para autenticación y permisos.
- `502/503/504` para fallos seguros del proveedor de IA.
- `500` genérico para errores desconocidos, con log interno.
- `404` JSON para rutas inexistentes.

Los servicios lanzan `httpError` para reglas de negocio; no construyen respuestas HTTP. Esto elimina los `try/catch` repetidos y respeta SRP.

## 12. Decisiones de diseño

| ID | Decisión | Consecuencia |
|---|---|---|
| DD-01 | `Y.Map` anidados para nodos y aristas | Updates finos y menor conflicto |
| DD-02 | Snapshot completo en `bytea` | Persistencia fiel del CRDT |
| DD-03 | Chat en Yjs y en SQL | Tiempo real y memoria durable |
| DD-04 | Identidad derivada del token | Seguridad y personalización |
| DD-05 | Historial de 15 mensajes | Contexto acotado |
| DD-06 | Emisión de respuesta por el backend | Consistencia entre colaboradores |
| DD-07 | Mutaciones ordenadas | Evita referencias colgadas |
| DD-08 | Esquemas separados | Aislamiento y claridad |
| DD-09 | Generador con plantillas | Código mantenible y testeable |
| DD-10 | Un solo proceso REST+WS | Simplicidad operativa |
| DD-11 | Diagrama + ACL en una transacción | No quedan diagramas sin propietario |
| DD-12 | Snapshot cargado antes de `setupWSConnection` | Elimina la ventana de escritura sobre un documento vacío |
| DD-13 | ACL de solo lectura en middleware | Evita el auto-claim de diagramas existentes sin ACL |
| DD-14 | Validación runtime antes de PostgreSQL/Groq | Rechaza datos malformados y mutaciones no permitidas |
| DD-15 | `app.js` separado de `server.js` | Express se prueba sin abrir puerto ni WebSocket |
| DD-16 | `realtime/yjs.js` encapsula WebSocket y snapshots | Bootstrap y tiempo real evolucionan por separado |
| DD-17 | `AppError` + `asyncHandler` + error handler | Un solo formato de error y rutas sin try/catch repetidos |
| DD-18 | `useDiagramMembers` para MembersPanel | La vista no conoce URLs, fetch ni estados de red |

## 13. Trazabilidad de diseño

| Requisito               | Componente de diseño                                   | Tabla / archivo                              |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------- |
| RF-12 Identidad IA      | `requireAuth` + `aiUsername`                           | `backend/services/aiService.js`              |
| RF-13 Memoria           | `ChatService`                                          | `chat.messages`                              |
| RF-14 Chat colaborativo | `emitChatMessage` + Yjs                                | `realtime/yjs.js`, `useCollaborativeFlow.ts` |
| RF-05 Edición           | `useCollaborativeFlow`                                 | `Y.Doc`                                      |
| RF-07 Roles             | `aclService` + `diagramAuth`                           | `auth.diagram_acl`                           |
| RF-15 Generación        | `generateProject`                                      | `backend/generator`                          |
| RNF-02 Durabilidad      | `saveSnapshot`                                         | `core.diagrams`                              |
| RNF-03 Seguridad        | JWT + bcrypt + ACL                                     | `auth`                                       |
| RNF-04 Rendimiento      | Límite de historial y debounce                         | `chatService`, `realtime/yjs.js`             |
| RNF-05 Mantenibilidad   | `app.js` + `server.js` + rutas + middleware de errores | `backend/`                                   |

## 14. Conclusión del diseño

El diseño mantiene dos planos deliberadamente separados:

- **Plano colaborativo:** Yjs, WebSocket y awareness.
- **Plano durable y de negocio:** PostgreSQL, JWT y servicios.

El asistente IA atraviesa ambos planos: usa la identidad y la memoria del plano durable, y publica su respuesta en el plano colaborativo. Esa intersección es la aportación central del Segundo Parcial y la razón por la que el diseño no puede reducirse a un simple endpoint de chat.

Continuar con [[05_Implementacion_y_Pruebas]].
