# Herramienta CASE Colaborativa con IA

Herramienta de diseño de software colaborativa en tiempo real, centrada en el modelo conceptual (UML o DER), con asistente de IA para construcción de diagramas y generación de backend Spring Boot + PostgreSQL.

## Estado actual

- ✅ Editor colaborativo de diagramas UML (clases, interfaces, abstractas, notas).
- ✅ Creación de entidades con drag-and-drop desde paleta lateral.
- ✅ Relaciones UML 2.5 (asociación, herencia, agregación, composición).
- ✅ Sincronización en tiempo real mediante Yjs y WebSockets.
- ✅ Exportar/importar diagrama en JSON y XMI (Enterprise Architect).
- ✅ Edición manual de atributos y métodos (panel lateral).
- ✅ Agente IA para comandos en lenguaje natural (texto y voz).
- ✅ Generación de backend Spring Boot + PostgreSQL.
- ✅ Design system + logo consistente (dashboard, login, register, editor).
- ✅ Paleta lateral con drag-and-drop + modo conexion para relaciones.
- ✅ Soft-lock visual de nodos (awareness).
- ✅ Autenticación JWT + ACLs por diagrama + dashboard.
- ❌ Exportación a PlantUML/SQL (Semana 3).
- ❌ Persistencia en base de datos (actualmente Yjs en memoria).

## Requisitos

- Node.js v20+
- npm
- API key de Groq (gratuita) o instalar Ollama local (alternativa)

## Estructura del proyecto
case-tool/
├── backend/ # Servidor WebSocket + API REST para IA
│ ├── server.js
│ ├── .env
│ └── package.json
├── frontend/ # Aplicación Next.js con React Flow
│ └── src/
│ ├── app/
│ │ └── page.tsx
│ ├── components/
│ │ ├── EntityNode.tsx
│ │ ├── Toolbar.tsx
│ │ └── EntityEditorPanel.tsx
│ ├── hooks/
│ │ ├── useCollaborativeFlow.ts
│ │ └── useAICommand.ts
│ ├── types/
│ │ └── diagram.ts
│ └── utils/
│ └── ast.ts
└── README.md

text

## Instalación

1. Clonar repositorio.
2. Backend:
   ```bash
   cd backend
   npm install
Frontend:

bash
cd frontend
npm install
Configuración
Obtener API key de Groq (gratuita) registrándote en console.groq.com.

Crear archivo backend/.env con:

text
GROQ_API_KEY=tu_api_key_aqui
GROQ_MODEL=openai/gpt-oss-20b
Puedes cambiar GROQ_MODEL por otro modelo disponible en tu cuenta (consulta la lista con curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer TU_API_KEY").

(Opcional) Si prefieres usar Ollama local, modifica server.js para usar la API de Ollama (código comentado).

Ejecución
Iniciar backend (WebSocket + API):

bash
cd backend
npm start
El servidor escucha en http://localhost:1234 (WebSocket y API REST).

Iniciar frontend:

bash
cd frontend
npm run dev
Abrir http://localhost:3000 en el navegador.

Para probar colaboración, abrir dos pestañas o navegadores diferentes.

Funcionalidades actuales
Agregar Entidad: botón + Entidad en la barra superior.

Conectar entidades: arrastrar desde el handle inferior de una entidad al superior de otra.

Exportar JSON: descarga el diagrama actual.

Importar JSON: carga un diagrama previamente exportado.

Indicador de conexión: muestra si el cliente está conectado al servidor de colaboración.

Comandos de IA: escribe un comando en lenguaje natural (ej. "Crea entidad Producto con nombre y precio") y presiona Enter o el botón "Enviar". La IA devuelve mutaciones que se aplican al diagrama.

Reconocimiento de voz: haz clic en el botón 🎤 y dicta el comando (requiere Chrome/Edge y conexión segura en localhost).

Edición de atributos: selecciona una entidad para abrir el panel lateral. Renombra la entidad, añade/elimina atributos, cambia tipos y marca PK, nullable, unique. Guarda los cambios con el botón "Guardar cambios".

## Relaciones * a * → entidad intermedia explícita

Cuando una relación tiene multiplicidad de "muchos" en ambos extremos
(ej. `Pedido * --- * Producto`), el generador **nunca** usa `@ManyToMany`.
En su lugar produce una **entidad intermedia explícita** (clase asociativa
UML 2.5), por tres motivos:

1. **Evita referencias circulares en JSON**: dos `@ManyToMany`/`@OneToMany`
   bidireccionales se serializan en loop; la intermedia rompe el ciclo con
   dos `@ManyToOne` unidireccionales hacia los padres.
2. **La app Flutter manipula la pivote directamente**: la intermedia tiene
   su propio `id`, repositorio, servicio, controlador (`/api/pedidoproductos`)
   y aparece en `config.json` como una entidad más.
3. **Permite atributos en la relación**: `cantidad`, `fecha`, etc. viven en
   la intermedia (una `@JoinTable` no admite columnas extra).

### Qué se genera para `Pedido * --- * Producto` (con atributo `cantidad`)

- `PedidoProducto.java` (`backend/generator/templates/entity-intermediate.java.hbs`):
  PK propia `UUID id` + `@ManyToOne pedido` + `@ManyToOne producto` + `cantidad`.
- `Pedido.java` / `Producto.java`: `@OneToMany(mappedBy = "pedido")` /
  `(mappedBy = "producto")` hacia `PedidoProducto` (sin `orphanRemoval`
  cruzado entre ellas).
- `PedidoProductoRepository/Service/Controller/DTO` con CRUD completo.
- `V1__init.sql`: tabla `pedido_producto` con `id UUID PRIMARY KEY` y dos
  FK (`pedido_id`, `producto_id`).
- `config.json`: `{ "entidades": ["Pedido", "Producto", "PedidoProducto"],
  "campos": { "PedidoProducto": ["pedidoId", "productoId", "cantidad"] } }`.

### Detección

- Frontend (`frontend/src/utils/ast.ts::nodesToAST`): si
  `type === 'MANY_TO_MANY'` o ambas cardinalidades son de "muchos"
  (`*`, `0..*`, `1..*`, `N`, `M`), el AST incluye `intermediateEntity`
  (`PedidoProducto`), `intermediateTable` (`pedido_producto`) e
  `intermediateAttributes`.
- Backend (`backend/generator/generate.js::expandManyToMany`): expande cada
  `* a *` en la entidad intermedia + dos relaciones sintéticas `* a 1`
  antes de renderizar. Acepta extremos como `{ entityName }` o como string
  (id o nombre) para compatibilidad con diagramas guardados.

### XMI

La relación se exporta como `uml:Association` con `memberEnd` de
multiplicidad `*`; al importar se reconstruye el `* a *` y el AST vuelve a
generar la intermedia. Los atributos propios de la relación no viajan en
XMI (UML los modelaría como clase asociativa, fuera del alcance actual).

### Si la intermedia NO se genera (diagnóstico 2026-09-21)

Cadena verificada etapa por etapa con código y datos reales — **no hay bug
en el código actual**. Si no aparece la intermedia, revisar en este orden:

1. **Cardinalidades en el editor**: clic en la arista → panel
   `EdgeEditorPanel` → ambos selects en `*` (o `0..*`/`1..*`). Al crear la
   arista los valores por defecto son `1`/`1`: sin cambiarlos no hay `* a *`.
2. **Payload del frontend**: F12 → Network → POST `/api/generate` → la
   relación debe llevar `cardinalityFrom`/`cardinalityTo` de "muchos".
   `nodesToAST` añade `intermediateEntity`/`intermediateTable` solo en ese
   caso (el `type` puede seguir siendo `ASSOCIATION`: el backend también
   detecta por cardinalidades, no solo por `MANY_TO_MANY`).
3. **Servidor backend desactualizado**: `server.js` carga `generate.js` una
   sola vez al arrancar. Tras cualquier cambio en el generador hay que
   reiniciar (`Ctrl+C` → `npm start`); si no, el ZIP sale sin intermedia
   aunque el código ya esté corregido. Esta fue la causa real en dos
   ocasiones (los `.java` de `backend-generado/` lo delataban: traían
   plantillas nuevas pero sin la última corrección).

## Clase asociativa (UML 2.5)

Una relación `* a *` puede llevar atributos propios (ej. un usuario se
asigna a un proyecto **con un rol y una fecha**). En UML 2.5 eso es una
**clase asociativa**: una clase unida a la relación con línea punteada.

### Uso en el editor (notación UML 2.5: arista + línea al punto medio)

1. Dibuja la relación `* --- *` entre dos entidades.
2. Clic en la arista → panel *Editar Relación* → sección **Clase
   asociativa** → *Convertir en clase asociativa*.
3. La arista original **se conserva** y se crea un nodo en el punto medio
   con **nombre derivado de los extremos** (`User` + `Customer` →
   `UserCustomer`; renombrable). Un overlay SVG
   (`AssociationClassConnector`) dibuja **una sola línea punteada ámbar**
   desde el punto medio de la arista hasta el borde del nodo, que se
   re-dibuja sola al mover cualquier extremo (casos B2-B/C):

```ascii
┌──────┐                    ┌──────────┐
│ User │────────────────────│ Customer │
└──────┘         ┊          └──────────┘
                 ┊
        ┌────────┴─────────┐
        │   UserCustomer   │
        │──────────────────│
        │ <<association>>  │
        └──────────────────┘
         (┊ = línea punteada ámbar al punto medio)
```

4. Con el nodo seleccionado, el `EntityEditorPanel` habitual sirve para
   renombrarlo (ej. `Asignacion`) y agregarle atributos
   (`fechaInicio: Date`, `rol: String`). La arista guarda
   `associationClassNodeId` y el nodo `associationOf { edgeId, … }`
   (referencia mutua).
5. Al generar, la intermedia se llama `Asignacion` (no `UserCustomer`) y
   contiene esos atributos. Ruta: `/api/asignacions`.

Disolver (todo desde el panel del **nodo**): *Eliminar clase
asociativa* limpia el vínculo y elimina el nodo; la arista `* a *`
queda intacta. Borrar el nodo (botón o Supr) hace lo mismo
automáticamente. Los diagramas de la etapa intermedia (nodo + 2
`DashedEdge`, arista eliminada) siguen funcionando: sus links se
filtran y la relación se sintetiza del respaldo.

(Nota: no hay captura de pantalla —entorno sin navegador—; el ASCII de
arriba es fiel al render: arista sólida + línea ámbar al punto medio +
nodo con borde ámbar punteado y tag `<<association>>`.)

### Decisión de diseño

- **El nodo aporta nombre y atributos; la arista, la relación**: la
  arista `* a *` se conserva y apunta al nodo (`associationClassNodeId`);
  el nodo guarda `associationOf { edgeId, … }`. No hay sincronización
  doble y nunca hay que reconstruir nada: disolver/borrar solo limpia
  el vínculo (la arista ya está ahí).
- **`nodesToAST` procesa la arista con normalidad** (cardinalidades
  incluidas) y toma nombre/atributos del nodo vinculado: la intermedia se
  genera **una sola vez**. Se mantiene compatibilidad con el modelo
  anterior (`associationClassId`) y con la etapa intermedia (nodo + links
  `isAssociationClassLink`, que se filtran).
- Los atributos PK del nodo se ignoran: la intermedia siempre recibe su
  propio `UUID` como PK en `expandManyToMany`.
- Lógica pura y testeable en `frontend/src/utils/associationClass.ts`
  (`planAssociationDelete`, `computeConnectorLines`, …): el borrado por
  botón y por teclado comparten el mismo plan.
- Helpers de Yjs extendidos (`yjsNodeHelpers`, `yjsEdgeHelpers`) para
  persistir `associationOf`/`isAssociationClass`/`associationClassNodeId`
  y no perder claves extra de `data` al guardar aristas.
- Limitación conocida: al exportar a XMI el nodo viaja como clase normal
  y el vínculo se pierde; al reimportar aparece como entidad standalone
  más una intermedia auto-generada.

## Notación visual UML 2.5 (estilo Enterprise Architect)

Tabla de marcadores por tipo de relación (todos implementados):

| Tipo | Marcador | Componente |
|---|---|---|
| `ASSOCIATION` | línea simple, sin marcador | `AssociationEdge` |
| `INHERITANCE` | triángulo hueco △ hacia el padre, línea continua | `InheritanceEdge` |
| `COMPOSITION` | rombo lleno ◆ en el todo, línea continua | `CompositionEdge` |
| `AGGREGATION` | rombo vacío ◇ en el todo, línea continua | `AggregationEdge` |
| Clase asociativa | 1 línea punteada ámbar al punto medio | `AssociationClassConnector` (overlay) |
| Multiplicidades | etiquetas `1`, `*`, `0..*`… junto a cada extremo, fondo blanco | `UmlEdge` (base de las 4) |

Decisiones:
- **Sin rewrite a `marker` SVG ni tipo único `uml`**: los 4 componentes
  actuales ya dibujan los marcadores como polígonos (más control que
  `<marker>`: el triángulo/rombo no depende de `orient` ni se recorta, y
  el estado seleccionado no exige defs duplicados por color). Migrar a un
  solo tipo `uml` rompería los `edge.type` ya persistidos en Yjs
  (`association`, `inheritance`, …) y la compatibilidad con diagramas
  antiguos —violando las reglas de esta tarea— a cambio de cero mejora
  visual. Los casos B1-A…D se cumplen con lo existente.
- **Sin tipo `DEPENDENCY`**: añadirlo no es “exclusivamente visual”;
  exige tipo nuevo en `RelationshipData`, paneles, `typeMap`, AST,
  backend y XMI. Queda como trabajo futuro.
- **Herencia con línea continua** (antes punteada) para conformidad EA.
- **Multiplicidades (Bloque 3) ya existía**: `UmlEdge` las renderiza
  junto a cada extremo con rectángulo blanco y borde (`PERP_OFFSET`,
  `ALONG_OFFSET`); los `<Handle>` nunca llevaron etiquetas. Sin cambios.

## Routing ortogonal (estilo Enterprise Architect)

Todas las aristas usan `getSmoothStepPath` (React Flow) en vez de
`getBezierPath`: rectas horizontales/verticales con codos de 90°
ligeramente redondeados. El cambio es **exclusivamente visual**
(mismo `edge.type` en Yjs, mismo AST, mismo backend).

```ascii
Antes (bezier):              Ahora (smoothstep, borderRadius 8):

┌──────┐                    ┌──────┐
│  A   │╲                   │  A   │
└──────┘  ╲                └──┬───┘
            ╲                │  <- codo redondeado
          ┌──╲───┐        ┌──┴───┐
          │  B   │        │  B   │
          └──────┘        └──────┘
```

| Parámetro | Valor | Razón |
|---|---|---|
| `borderRadius` | 8 | Codos redondeados sutiles (como Architect; probar 4/0 si se quieren afilados) |
| `offset` | 20 | Separación antes de doblar (evita codos pegados al nodo) |
| `strokeLinejoin` | `'round'` | Suaviza las esquinas |
| `strokeLinecap` | `'round'` | Suaviza los extremos |
| Selección | `#3b82f6` / 2.5px | Resaltado azul al seleccionar (antes siempre gris) |

Detalles de implementación (`frontend/src/components/`):
- `UmlEdge.tsx`: path smoothstep + estilo de selección + constantes
  `UML_EDGE_BORDER_RADIUS`/`UML_EDGE_OFFSET` + helper
  `getEdgeEndVector()` exportado.
- `InheritanceEdge`, `AggregationEdge`, `CompositionEdge`: **mismo**
  polígono, pero orientado por el **segmento final** (eje del handle
  destino) en vez del vector recto: con codos, el vector recto dejaría
  el triángulo/rombo girado (R6). Sin handle, fallback al vector recto.
- `DashedEdge.tsx`: también smoothstep (consistencia; sin marcadores).
- `edge.type` intactos (`association`, `inheritance`, `aggregation`,
  `composition`, `dashed`): compatibilidad Yjs y diagramas antiguos.
- `AssociationClassConnector` no usa estos componentes: intacto (R7).
- Casos R1 (recta horizontal), R2 (recta vertical) y R3 (codo con `Q`)
  verificados contra el `getSmoothStepPath` real en
  `backend/generator/tests/edge-routing.test.js` (17 checks); R4 (mover)
  y R5 (selección) son comportamiento nativo de React Flow.

## Aristas flotantes (líneas al centro, estilo Architect)

Las aristas ya no salen de handles fijos: cada componente calcula la
intersección de la línea centro-a-centro con el borde del rectángulo del
nodo, como hace Enterprise Architect.

```ascii
Antes (handles fijos):       Ahora (flotante al centro):

┌──────┐                     ┌──────┐
│  A   │                     │  A   │
└──┬───┘                     └──┬───┘  <- la línea toca el borde,
   │                         ╭──╯      perpendicular a él
┌──┴───┐                  ┌──┴───┐
│  B   │                  │  B   │
└──────┘                  └──────┘
```

Detalles (`frontend/src/utils/floatingEdges.ts`):
- `getNodeIntersection(nodeA, nodeB)`: pura y testeada (F1/F2/F3);
  coincidencia de centros o dims indefinidas → centro / 200×100 sin
  crash (F5).
- `useFloatingEdgeGeometry(source, target)`: hook compartido por los 4
  wrappers; se re-suscribe a posiciones/tamaños (F4) y devuelve `null`
  en self-loops o nodos ausentes → fallback a coords de React Flow.
- Los wrappers pisan `sourceX/Y`, `targetX/Y` y `source/targetPosition`
  al delegar en `UmlEdge`, así path, marcadores (orientados por
  `getEdgeEndVector` del lado calculado, F6/F7) y cardinalidades usan la
  misma geometría.
- Handles intactos pero sutiles (`opacity-40`, visibles al hover del
  nodo): crear conexiones arrastrando sigue igual.
- `AssociationClassConnector` no se tocó: usa centros, independiente
  del routing (F8). `DashedEdge` tampoco (enlaces cortos).
- Solo visual: `edge.type`, `edge.data`, AST, Yjs y backend intactos
  (verificado: diff de `backend/` vacío; 4 suites verdes).
- Tests en `backend/generator/tests/floating-edges.test.js` (20 checks).

## Autenticación y roles (Fase 1: JWT)

El editor era 100% abierto. La Fase 1 añade registro/login con JWT
detrás de un flag de compatibilidad. Fases 2 (ACLs por diagrama) y 3
(invitaciones/solicitudes) pendientes —NO empezadas—.

### Activar / desactivar

En `backend/.env` (ver `backend/.env.example` como plantilla):

```text
AUTH_ENABLED=false   # todo abierto, como antes (cero regresiones)
JWT_SECRET=<64 hex de openssl rand -hex 32, mínimo 32 caracteres>
JWT_EXPIRATION=7d
```

- `AUTH_ENABLED=false`: sin login, sin validación; `/api/auth/me`
  responde `{ user: null, anonymous: true }`.
- `AUTH_ENABLED=true`: REST exige `Authorization: Bearer <token>`
  (401 sin token o inválido); el WS acepta `?token=` y lo adjunta a la
  conexión (validación por diagrama en Fase 2). Públicos siempre:
  `/health` y `/api/auth/*`. Protegidos: `/api/diagrams/*`,
  `/api/ai/*`, `/api/generate`.

Reiniciar el backend tras cambiar el flag (`Ctrl+C` → `npm start`;
`server.js` lee el `.env` una sola vez al arrancar).

### Flujo

1. El primer usuario se registra sin invitación (bootstrap):
   `POST /api/auth/register { username, email, password }` → `201`
   `{ token, user }` (validaciones → 400; login malo → 401).
2. El frontend guarda el JWT en `localStorage` (`case-tool:token`),
   lo envía vía `apiFetch` (`frontend/src/lib/apiClient.ts`) y como
   `?token=` en el WebSocket (`{ params }` de y-websocket, sin romper
   rooms: el servidor parte por `?`).
3. Al recargar, `AuthProvider` consulta `/api/auth/status` y valida la
   sesión con `/api/auth/me`; si el backend no responde, queda en modo
   abierto. Sin sesión y con auth activo, `/` redirige a `/login`.
4. Usuarios en `backend/data/users.json` (auto-creado; ignorado por git)
   con `passwordHash` bcrypt (10 rounds), nunca en claro; las respuestas
   nunca exponen el hash.

### Decisiones (mejoras sobre el plan)

- Sin `uuid`: `crypto.randomUUID()` nativo (Node 20+).
- Sin `jwt-decode`: la sesión se valida contra `/me`, no decodificando
  en cliente (menos deps, misma UX).
- `apiFetch` solo fija `Content-Type: application/json` con body string
  (nunca para `FormData`: transcripción e imagen usan multer).
- `API_BASE` respeta `NEXT_PUBLIC_API_URL` (antes `/api/generate` iba
  hardcodeado a localhost) y el WS `NEXT_PUBLIC_WS_URL`.
- Tests en `backend/tests/auth-phase1.test.js` (20 checks: Tests A, B, D
  + WS con token; C manual: DevTools → Network → WS → `?token=`).

## Roles y permisos (Fase 2A: ACLs por diagrama)

Cada `<id>.json` tiene un hermano `<id>.acl.json` con
`{ diagramId, ownerId, members: [{ userId, role, addedAt }] }`.
Roles: `OWNER` (todo) > `EDITOR` (ver+editar) > `VIEWER` (solo ver).
Con `AUTH_ENABLED=false` las ACLs se crean pero no se validan.

### Backend

- `services/aclService.js`: CRUD + `getOrCreateACL` idempotente
  (migración: legacy sin ACL → el primero que abre es OWNER;
  sin usuario → `ownerId: "anonymous"`).
- `middleware/diagramAuth.js`: `requireDiagramMember`,
  `requireDiagramRole(...)` y `requireDiagramWrite` (crea si no hay;
  si existe exige OWNER/EDITOR). El rename cuenta como escritura
  (más estricto que el boceto, coherente con el objetivo).
- `routes/acl.js` en `/api`: `GET .../role` (sin auth activo devuelve
  `OWNER`), `GET .../acl`, `POST .../members` (por username),
  `PATCH .../members/:userId`, `DELETE .../members/:userId`
  (OWNER elimina a cualquiera; cualquiera se auto-elimina; el owner
  no puede auto-eliminarse).
- `server.js`: lista `/api/diagrams` filtrada por membresía (los
  legacy sin ACL siguen visibles para migrar; los `.acl.json` nunca
  se listan); `POST` crea-o-guarda con `requireDiagramWrite` (el
  creador queda OWNER); `DELETE` solo OWNER y borra el `.acl.json`;
  WS fail-closed: sin token → 4401, sin rol → 4403, room no
  `diagram-room-*` → 4403 (los rooms usan `?token=` sin romperse:
  el servidor parte por `?`).

### Frontend

- `hooks/useDiagramRole.ts`: rol del diagrama actual.
- `components/MembersPanel.tsx`: gestión (solo OWNER, botón
  *Miembros* en toolbar).
- `page.tsx`: VIEWER → canvas no arrastrable/conectable/seleccionable,
  sin botones de edición, sin IA (ChatPanel `readOnly`), badge de rol
  y muro *"No tienes acceso"* + *Solicitar acceso* (placeholder Fase 3);
  selección por Sidebar bloqueada.
- Tests en `backend/tests/acl-phase2a.test.js` (33 checks: E, F, G, H).

### Pendiente (Fase 2B / 3)

Read-only real en Yjs (descartar updates de VIEWER), invitaciones /
solicitudes, refresh token, presencia con username real.
**No empezado**: esperando aprobación, como en Fase 1.

## Dashboard (`/dashboard` + `/diagram/[id]`)

Tras el login el usuario aterriza en el dashboard (estilo Figma/
Lucidchart) en vez del editor directo:

- **Mis diagramas** (OWNER) y **Compartidos conmigo** (EDITOR/VIEWER
  con `ownerUsername`), cards con conteos, fecha relativa y búsqueda
  en vivo; sección *Solicitudes pendientes* como placeholder de Fase 3.
- `+ Nuevo diagrama` → `POST /api/diagrams` (crea + ACL con el usuario
  como OWNER) → entra a `/diagram/<id>`. Click en card → editor.
- `/` solo redirige: sin auth → `/diagram/<último o diagram-1>`
  (editor directo como antes); con auth → `/login` o `/dashboard`.
- Login/register redirigen a `/dashboard`; botón `← Dashboard` en la
  toolbar del editor.

### Backend (`backend/routes/diagrams.js`)

- `GET /api/diagrams` → `{ owned, shared }` (antes array plano; el
  editor acepta ambos formatos). Sin auth todo va en `owned`; con
  auth filtra por membresía (legacy sin ACL excluidos hasta migrar).
  Los `.acl.json` jamás se listan.
- `POST /api/diagrams { name }` → `201 { id, name }` + ACL del creador
  como OWNER (anónimo sin auth).

### Editor movido sin duplicar

`app/page.tsx` → `app/diagram/[id]/page.tsx` (mismo componente,
`key={id}` para remontar limpio al navegar: Yjs, rol y panels).
El selector interno navega por router (`push`), crear usa el nuevo
POST, borrar el actual vuelve al dashboard. La colaboración Yjs no
cambia (room `diagram-room-<id>`).

### Verificación

`backend/tests/dashboard.test.js` (19 checks: Tests 1–5) +
`tsc` limpio + 6 suites previas verdes. Sin captura (headless).

## Design System + Logo consistente

`frontend/src/styles/design-system.ts` define clases Tailwind reutilizables (`DS.button`, `DS.input`, `DS.card`, `DS.header`).

`frontend/src/components/AppLogo.tsx` es un componente unico usado en dashboard, login, register y toolbar del editor. Misma tipografia (Inter), mismo icono SVG, mismos tamaños en las 4 paginas.

## Paleta lateral (drag-and-drop + modo conexion)

`Palette.tsx` tiene dos secciones:

**Elementos** (drag-and-drop al canvas):
- Clase, Interfaz, Clase abstracta, Nota

**Relaciones** (modo conexion con dos clicks):
- Asociacion, Herencia, Composicion, Agregacion

Al hacer click en un tipo de relacion se activa el "modo conexion": el usuario clickea source y luego target para crear la arista. Se muestra un banner con el estado y se puede cancelar con Escape. El cursor cambia a crosshair. El nodo source se resalta con borde azul.

El modo conexion se resetea al cambiar de diagrama. Es local al cliente (no se sincroniza via Yjs).

La paleta solo aparece en modo editor (no en VIEWER).

## Soft-lock de nodos (awareness)

Cuando un usuario selecciona un nodo, publica `editing: { nodeId, timestamp }` en el awareness de Yjs. Otros usuarios ven:

- Borde del color del usuario que edita (`boxShadow`)
- Etiqueta flotante con el username
- Nodo no arrastrable (`draggable: false`)

Los locks expiran a los 30 segundos. El usuario que tiene el lock puede mover su propio nodo. Si se desconecta, el awareness lo libera automáticamente.

`useNodeLocks.ts` lee los locks activos del awareness.

Próximos pasos (Semana 3)
□ Generación de código Spring Boot + PostgreSQL a partir del diagrama.
□ Exportación a PlantUML y SQL.
□ Persistencia del diagrama en base de datos (actualmente solo Yjs en memoria).
□ Mejoras en el panel de edición (drag & drop de atributos, importación desde JSON de entidades).
□ Aplicación móvil con asistente por voz.
Solución de problemas
La IA no responde: verifica que el backend esté corriendo y que GROQ_API_KEY sea válida. Revisa el modelo en GROQ_MODEL.

El reconocimiento de voz no funciona: asegúrate de usar Chrome o Edge y estar en localhost o HTTPS.

El WebSocket se desconecta: comprueba que NEXT_PUBLIC_WS_URL en frontend/.env.local sea ws://localhost:1234.

Licencia
Este proyecto es de código abierto para fines educativos.