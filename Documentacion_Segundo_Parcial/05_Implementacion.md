# Implementación

## 1. Estado de la implementación

El Segundo Parcial quedó implementado sobre el repositorio `case-tool` con estos cambios principales:

- Persistencia del backend migrada de archivos JSON a PostgreSQL en Neon.
- Nuevo acceso a datos con `pg`, pool y transacciones.
- Servicios de usuarios, ACL, diagramas y chat reescritos sobre SQL.
- Snapshots Yjs persistidos en `core.diagrams.yjs_snapshot`.
- Historial del chat persistido en `chat.messages`.
- Asistente IA con identidad derivada del JWT.
- Memoria contextual de los últimos 15 mensajes.
- Respuesta del asistente emitida al chat colaborativo Yjs.
- Frontend adaptado para no enviar historial ni guardar el grafo por REST.
- Script de migración de datos legacy.
- Verificación de build, tipos, pruebas de integración y snapshots.

## 2. Organización del repositorio

```text
case-tool/
├── frontend/
│   ├── src/app/                    Páginas y rutas
│   ├── src/components/             Canvas, paneles, chat y ayuda
│   ├── src/hooks/                  Colaboración, IA, roles y sesión
│   ├── src/lib/                    Cliente HTTP y presencia
│   ├── src/utils/                  AST, Yjs, XMI y aristas
│   └── src/types/                  Contratos TypeScript
├── backend/
│   ├── server.js                   Bootstrap HTTP, DB, señales y apagado
│   ├── app.js                      Composición Express, rutas y middleware
│   ├── realtime/                   WebSocket, snapshots Yjs y chat
│   ├── db.js                       Pool PostgreSQL y transacciones
│   ├── errors.js                   AppError, httpError y asyncHandler
│   ├── loadEnv.js                  Carga de variables de entorno
│   ├── validation.js               Validación runtime de entrada
│   ├── routes/                     auth, diagrams, acl, ai
│   ├── middleware/                 JWT, ACL, upload y error handler
│   ├── services/                   user, acl, diagram, chat, ai
│   ├── scripts/                    Migración JSON → PostgreSQL
│   ├── generator/                  Generador Spring Boot
│   └── tests/                      Pruebas legacy
├── docs/                           Documentación de ingeniería
└── Documentacion_Segundo_Parcial/  Este vault
```

## 3. Las cuatro capas internas del backend

### 3.1 Capa 1: transporte

**Archivos:** `app.js`, `server.js`, `routes/auth.js`, `routes/diagrams.js`, `routes/acl.js`, `routes/ai.js`.

**Responsabilidades:**

- `server.js` compone HTTP, base de datos, WebSocket y apagado.
- `app.js` compone Express y monta rutas.
- Las rutas definen endpoints, validan parámetros y delegan.
- `middleware/errorHandler.js` centraliza respuestas de error.
- `realtime/yjs.js` monta el WebSocket y la persistencia de snapshots.

**Endpoints principales:**

| Método | Ruta | Implementación |
|---|---|---|
| POST | `/api/auth/register` | `routes/auth.js` |
| POST | `/api/auth/login` | `routes/auth.js` |
| GET | `/api/auth/me` | `routes/auth.js` |
| GET | `/api/diagrams` | `routes/diagrams.js` |
| POST | `/api/diagrams` | `routes/diagrams.js` |
| GET | `/api/diagrams/:id` | `routes/diagrams.js` |
| POST | `/api/diagrams/:id` | `routes/diagrams.js` |
| PUT | `/api/diagrams/:id/rename` | `routes/diagrams.js` |
| DELETE | `/api/diagrams/:id` | `routes/diagrams.js` |
| POST | `/api/ai/command` | `routes/ai.js` |
| POST | `/api/ai/transcribe` | `routes/ai.js` |
| POST | `/api/ai/from-image` | `routes/ai.js` |
| POST | `/api/generate` | `routes/ai.js` |

### 3.2 Capa 2: seguridad

**Archivos:** `middleware/auth.js`, `middleware/diagramAuth.js`.

**Responsabilidades:**

- Extraer y verificar el Bearer token.
- Adjuntar `req.user`.
- Resolver el rol del usuario en el diagrama.
- Bloquear operaciones de lectura, escritura o administración.
- Validar el token del WebSocket.

**Comportamiento:**

- `AUTH_ENABLED=true`: se exige token.
- `AUTH_ENABLED=false`: se inyecta el usuario anónimo para desarrollo.
- Sin token en WS: cierre `4401`.
- Sin rol en WS: cierre `4403`.
- Sala desconocida: cierre `4403`.

### 3.3 Capa 3: dominio y servicios

**Archivos:** `services/userService.js`, `services/aclService.js`, `services/diagramService.js`, `services/chatService.js`.

**Responsabilidades:**

| Servicio | Funciones principales |
|---|---|
| `userService` | `createUser`, `findByUsername`, `findByEmail`, `findById`, `verifyPassword` |
| `aclService` | `readACL`, `writeACL`, `getOrCreateACL`, `getRoleForUser`, `addMember`, `updateMemberRole`, `removeMember`, `deleteACL` |
| `diagramService` | `listVisibleForUser`, `getDiagram`, `createDiagram`, `ensureDiagram`, `upsertDiagram`, `renameDiagram`, `deleteDiagram`, `getSnapshot`, `saveSnapshot` |
| `chatService` | `addMessage`, `getRecentMessages` |

### 3.4 Capa 4: persistencia y generación

**Archivos:** `db.js`, `scripts/migrate-json-to-postgres.js`, `generator/*`.

**Persistencia:**

- Pool de conexiones PostgreSQL.
- Transacciones con `BEGIN`, `COMMIT` y `ROLLBACK`.
- Normalización de identificadores de usuario.
- Usuario anónimo técnico.
- Consultas parametrizadas.

**Generación:**

- Normalización del AST.
- Expansión de relaciones muchos-a-muchos.
- Renderizado con Handlebars.
- Empaquetado ZIP.
- Limpieza de temporales.

## 4. Arranque del backend

`server.js` importa primero `loadEnv.js` y delega la composición de Express a `app.js`:

```js
require('./loadEnv');
```

`loadEnv.js` establece la prioridad:

1. Variables del proceso.
2. `backend/.env.local`.
3. `backend/.env`.

El secreto real de `DATABASE_URL` se guarda en `backend/.env.local`, que está ignorado por git. `backend/.env.example` sirve como plantilla sin secretos.

## 5. Pool y transacciones

`db.js` crea un pool con:

- Máximo de 10 conexiones por defecto, configurable con `PG_POOL_MAX`.
- `idleTimeoutMillis` de 30 segundos.
- `connectionTimeoutMillis` de 10 segundos.
- TLS cuando la cadena incluye `sslmode=require`.

```js
const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: connectionString && connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});
```

La función `withTransaction` garantiza:

- `BEGIN` antes de la operación.
- `COMMIT` si todo sale bien.
- `ROLLBACK` ante error.
- Liberación del cliente en `finally`.

### 5.1 Usuario anónimo

Cuando `AUTH_ENABLED=false`, el sistema necesita un UUID válido para propietarios y ACL. Se crea de forma idempotente:

```text
id: 00000000-0000-0000-0000-000000000001
username: anonymous
email: anonymous@local.invalid
password_hash: !
```

`normalizeUserId` convierte cualquier identificador inválido en ese UUID técnico. Esto evita errores de tipo en PostgreSQL y mantiene la compatibilidad del modo abierto.

## 6. Servicios implementados

### 6.1 Usuarios

`userService.createUser`:

1. Valida username de al menos 3 caracteres.
2. Valida email con `@`.
3. Exige contraseña de al menos 6 caracteres.
4. Verifica duplicados.
5. Genera el hash con bcrypt y 10 rondas.
6. Inserta en `auth.users`.
7. Devuelve el usuario sin `password_hash`.

`verifyPassword` busca por username y compara con bcrypt. Nunca devuelve el hash.

### 6.2 ACL

Las rutas de lectura y el WebSocket usan `aclService.getRoleForUser` y `readACL`; no crean filas. La creación de la ACL ocurre únicamente dentro de la transacción de creación del diagrama.

`getOrCreateACL` se conserva solo para scripts de migración explícitos. Ya no se invoca desde middleware, lectura REST ni conexión WebSocket, por lo que un diagrama existente sin ACL no puede ser reclamado por el primer usuario que lo abra.

`addMember` valida que el rol sea `EDITOR` o `VIEWER`, exige un UUID de usuario válido, verifica que el diagrama exista y aplica un upsert sobre `(diagram_id, user_id)`.

### 6.3 Diagramas

`diagramService`:

- Lista diagramas visibles mediante `JOIN` con ACL.
- Cuenta entidades y relaciones decodificando el snapshot.
- Crea el diagrama y su ACL `OWNER` en una sola transacción (`createDiagramWithOwner`).
- Crea un diagrama si el id no existe (`createDiagramWithOwnerIfAbsent`) sin reclamar diagramas existentes sin ACL.
- Renombra y actualiza `updated_at`.
- Elimina ACL y diagrama en una transacción.
- Recupera y guarda el snapshot binario.

La lectura del snapshot usa un `Y.Doc` temporal para contar nodos y aristas:

```js
const doc = new Y.Doc();
Y.applyUpdate(doc, new Uint8Array(snapshot));
const entityCount = doc.getMap('nodes').size;
const relationshipCount = doc.getMap('edges').size;
```

### 6.4 Chat

`chatService.addMessage`:

- Valida el diagrama.
- Valida que el rol sea `user`, `assistant` o `system`.
- Recorta el contenido y el autor.
- Inserta y devuelve la fila creada.

`chatService.getRecentMessages`:

- Sanea el límite entre 1 y 100.
- Selecciona los más recientes en orden descendente.
- Los devuelve en orden ascendente.
- Alias `content AS text` para el prompt.

## 7. Persistencia Yjs

`realtime/yjs.js` configura `setPersistence` de `y-websocket` y encapsula el WebSocket:

1. `attachRealtime(server)` crea el `WebSocket.Server`.
2. Al enlazar un documento, obtiene el `diagramId` del room.
3. Carga `yjs_snapshot` y expone `readyPromise`.
4. El servidor pausa el socket y espera el snapshot antes de `setupWSConnection`.
5. Aplica el snapshot con `Y.applyUpdate`.
6. Escucha los updates y programa un guardado con debounce de 2 segundos.
7. Guarda `Y.encodeStateAsUpdate(ydoc)` en `core.diagrams`.
8. En `writeState`, espera el snapshot y el turno de escrituras pendientes.
9. `SIGTERM`/`SIGINT` ejecutan flush y cierran clientes.

```text
update Yjs
   │
   ▼
scheduleSnapshot(2000 ms)
   │
   ▼
Y.encodeStateAsUpdate(ydoc)
   │
   ▼
UPDATE core.diagrams SET yjs_snapshot = $2
```

El debounce reduce la carga sobre Neon durante ráfagas de cambios, por ejemplo al arrastrar o al aplicar varias mutaciones de IA.

## 8. Implementación de CU-06

### 8.1 Frontend: `useAICommand`

El hook:

1. Mantiene el texto del comando.
2. Evita envíos duplicados con `processingRef`.
3. Agrega el mensaje del usuario al chat.
4. Convierte el canvas en AST.
5. Envía el comando con `apiFetch`.
6. Aplica las mutaciones.
7. Agrega la respuesta local solo si el backend no la emitió.
8. Limpia el campo y restaura el estado de procesamiento.

Fragmento conceptual:

```ts
const ast = nodesToAST(opts.nodes, opts.edges);
const response = await apiFetch(`${API_BASE}/api/ai/command`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: trimmed,
    currentState: ast,
    diagramId: opts.diagramId,
  }),
});

if (Array.isArray(data.mutations) && data.mutations.length > 0) {
  applyMutations(data.mutations, context);
}

if (data.chatEmitted !== true) {
  opts.addMessage('ia', aiText || fallbackText, 'IA');
}
```

### 8.2 Identidad en el backend

La identidad no se toma del body:

```js
const username = aiUsername(req.user);
```

`aiUsername` lee `req.user.username`, que proviene del JWT verificado. Si el usuario es `anonymous`, usa `Usuario`.

El prompt exige:

- Dirigirse al usuario por su nombre.
- No inventar otro nombre.
- Comenzar la respuesta con ese nombre.

### 8.3 Memoria contextual

Antes de llamar a Groq:

```js
const dbHistory = await chatService.getRecentMessages(safeDiagramId, 15);
historyPrompt = formatChatHistory(dbHistory);

await chatService.addMessage({
  diagramId: safeDiagramId,
  author: username,
  role: 'user',
  content: command,
});
```

`formatChatHistory`:

- Ignora entradas vacías.
- Normaliza espacios.
- Recorta el autor a 80 caracteres.
- Recorta cada mensaje a 600 caracteres.
- Limita el bloque total a 6000 caracteres.
- Devuelve el historial en orden cronológico.

### 8.4 Llamada a Groq

`getMutationsFromAI`:

1. Comprueba `GROQ_API_KEY`.
2. Elige el modelo de texto o visión.
3. Construye el system prompt con identidad, estado e historial.
4. Envía el comando como mensaje de usuario.
5. Limpia bloques Markdown de la respuesta.
6. Parsea el JSON.
7. Si falta `mutations`, acepta una respuesta teórica con `mutations: []`.
8. Si el JSON es inválido, intenta recuperar mutaciones del texto.
9. Si solo hay prosa, la devuelve como respuesta del tutor.
10. Si no puede recuperar nada, lanza error.

### 8.5 Persistencia de la respuesta y emisión Yjs

```js
await chatService.addMessage({
  diagramId: safeDiagramId,
  author: 'IA',
  role: 'assistant',
  content: response,
});

chatEmitted = emitChatMessage(safeDiagramId, {
  id: `msg_${Date.now()}_...`,
  sender: 'ia',
  author: 'IA',
  text: response,
  timestamp: Date.now(),
});
```

La respuesta HTTP incluye `chatEmitted`. El frontend usa esa bandera para no duplicar el mensaje en el chat.

### 8.6 Aplicación de mutaciones

`applyMutations` respeta el orden:

1. `addEntity`
2. `addAttribute`
3. `addRelationship`
4. `removeEntity`
5. `removeRelationship`

Cada mutación se traduce a operaciones sobre Yjs. Las entidades deben existir antes de crear relaciones, y las eliminaciones se hacen al final para no dejar referencias colgadas.

### 8.7 Voz

1. `MediaRecorder` captura audio webm/opus.
2. Se envía como `FormData` a `/api/ai/transcribe`.
3. Multer lo mantiene en memoria.
4. El backend llama a Groq Whisper con `whisper-large-v3`.
5. El texto se coloca en el input.
6. Se autoenvía después de 400 ms.
7. El usuario puede editar antes del envío.

### 8.8 Imagen

1. El usuario selecciona una imagen.
2. Se envía como `FormData` junto con el AST.
3. Multer limita a 10 MB.
4. El backend usa el modelo de visión.
5. Se devuelven mutaciones.
6. El frontend las aplica y resume el resultado.

## 9. Implementación del frontend

### 9.1 `useCollaborativeFlow`

Responsabilidades:

- Crear `Y.Doc` y `WebsocketProvider`.
- Suscribirse a `nodes`, `edges` y `chat`.
- Convertir `Y.Map` a arreglos de React Flow.
- Exponer writers para nodos, aristas y mensajes.
- Cargar el snapshot inicial.
- Publicar presencia y soft-lock.
- Limpiar awareness antes de destruir el provider.

### 9.2 Identidad y presencia

`resolvePresenceIdentity` usa el usuario autenticado si existe. Para anónimos, genera una identidad estable por sesión. El color se deriva del identificador para mantener consistencia entre reconexiones.

### 9.3 Chat

`ChatPanel`:

- Muestra autor, inicial y color.
- Distingue mensajes propios, de otros usuarios y de la IA.
- Permite texto, micrófono e imagen.
- Se desactiva en modo `VIEWER`.
- No aplica reglas de negocio.

### 9.4 Miembros del diagrama

`MembersPanel` es una vista controlada. La lógica de red y estado vive en `useDiagramMembers`:

- `load`: `GET /api/diagrams/:id/acl`.
- `invite`: `POST /api/diagrams/:id/members`.
- `changeRole`: `PATCH /api/diagrams/:id/members/:userId`.
- `removeMember`: `DELETE /api/diagrams/:id/members/:userId`.
- Expone `owner`, `members`, `loading`, `error` y `busy`.

`ChatPanel` y `Toolbar` son componentes de presentación: reciben mensajes, comandos, estado de conexión y callbacks; no llaman a la API ni aplican reglas de negocio.

### 9.5 Cambios de compatibilidad

- `useAICommand` ya no envía `history` al backend.
- `page.tsx` ya no guarda el grafo por REST periódicamente.
- `useCollaborativeFlow` ya no expone `getSnapshot`.
- Se eliminó `frontend/src/lib/chatHistory.ts` por quedar obsoleto.

## 10. Migración de datos legacy

El script `backend/scripts/migrate-json-to-postgres.js` se ejecuta con:

```bash
npm run migrate-json
```

Proceso:

1. Lee los archivos de `backend/data/diagrams`.
2. Omite archivos ACL.
3. Migra usuarios de `users.json`.
4. Migra diagramas y snapshots.
5. Migra ACL.
6. Es idempotente mediante `ON CONFLICT`.
7. Verifica conteos al finalizar.

Resultado de la ejecución:

- 11 diagramas migrados.
- 2 usuarios migrados.
- Verificación posterior: 3 usuarios, 13 ACL, 11 diagramas y 0 mensajes tras limpiar datos de prueba.
- El usuario adicional es el usuario técnico anónimo.

## 11. Pruebas y verificación

### 11.1 Pruebas de integración PostgreSQL

Se ejecutó una suite de integración contra Neon con 23 verificaciones aprobadas:

- Conexión y usuario anónimo.
- Registro y login.
- Búsqueda de usuario.
- Creación de diagrama.
- ACL y roles.
- Actualización de miembro.
- Eliminación de miembro.
- Persistencia de mensajes.
- Lectura del historial.
- Aislamiento por diagrama.
- Guardado y recuperación de snapshot.
- Conteo de entidades y relaciones.
- Borrado en cascada.

### 11.2 Verificación de Yjs

Se comprobó:

- Persistencia del snapshot tras cambios.
- Recarga en un cliente nuevo.
- Reconstrucción de nodos y aristas.
- Conservación del chat.
- Recuperación del documento tras reconexión.

### 11.3 Verificación del frontend

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Correcto |
| ESLint dirigido a `useAICommand.ts` | Errores preexistentes de `any`/refs, sin regresiones nuevas |
| Carga del editor | Correcta |
| Chat IA | Correcto |
| Aplicación de mutaciones | Correcta |
| Exportación/importación | Sin cambios funcionales |

### 11.4 Verificación de la refactorización Fase 2

- `node --check` sobre 22 archivos backend.
- `npx tsc --noEmit` sin errores.
- `npm run build` correcto.
- Smoke de `/health`, `/ready`, 404 JSON, `400` de validación y `401` de autenticación.
- El lint del frontend bajó de 154 a 150 problemas preexistentes.
- `server.js` quedó en 59 líneas, solo con bootstrap.
- No se modificaron los contratos de API ni el formato de las mutaciones.

### 11.5 Pruebas legacy

Los archivos `backend/tests/*.js` basados en persistencia de archivos quedaron obsoletos. No deben ejecutarse como validación del backend actual porque esperan archivos JSON y un modelo anterior.

Las pruebas del generador en `backend/generator/tests/` siguen siendo útiles para las reglas de transformación y el routing visual.

## 12. Despliegue

### 12.1 Frontend en Vercel

- `vercel.json` define install, build y output.
- El directorio raíz del proyecto en Vercel es `frontend`.
- `NEXT_PUBLIC_API_URL` apunta al backend.
- `NEXT_PUBLIC_WS_URL` apunta al WebSocket.
- `types/y-websocket.d.ts` evita el error TS7016 sin desactivar el typecheck.

### 12.2 Backend en Railway

El backend necesita un proceso persistente porque mantiene conexiones WebSocket. Variables requeridas:

```text
DATABASE_URL
GROQ_API_KEY
GROQ_MODEL
GROQ_VISION_MODEL
JWT_SECRET
JWT_EXPIRATION
AUTH_ENABLED
PORT
```

El puerto debe coincidir con el configurado por el proveedor.

### 12.3 Base de datos en Neon

- Proyecto: `snowy-tooth-15591961`.
- Base: `neondb`.
- Esquemas del proyecto: `auth`, `core`, `chat`.
- Conexión con TLS.
- Las tablas ajenas permanecen en `public`.

### 12.4 Consideraciones de producción

- No versionar `.env.local`.
- Configurar CORS para el dominio real.
- Verificar que el WebSocket use `wss://` en producción.
- Revisar el tiempo de expiración del JWT.
- Supervisar el tamaño de `yjs_snapshot` y `chat.messages`.
- Programar respaldos o snapshots de Neon.

## 13. Seguridad implementada

| Control | Implementación |
|---|---|
| Hash de contraseñas | bcrypt, 10 rondas |
| Token | JWT firmado, expiración configurable |
| REST | `Authorization: Bearer` |
| WebSocket | `?token=` |
| ACL | `auth.diagram_acl`, consulta sin efectos secundarios |
| Gate WS | `4401` sin token, `4403` sin rol, `4404` diagrama inexistente |
| Snapshot | Cargado antes de `setupWSConnection`; error de carga rechaza el WS |
| Validación | `backend/validation.js` para comandos, AST, mutaciones, auth y ACL |
| Transacciones | Diagrama + ACL y borrado de ACL + diagrama |
| Sanitización de ID | `safeId` + validación de formato |
| Consultas | Parámetros SQL |
| Archivos | Multer en memoria, 10 MB y MIME esperado |
| Secretos | `.env.local` y variables del proveedor |

## 14. Limitaciones conocidas

1. El soft-lock es visual, no un bloqueo transaccional.
2. El modo `VIEWER` no descarta updates Yjs a nivel de protocolo.
3. `auth.diagram_acl.diagram_id` no tiene FK física a `core.diagrams`.
4. La IA depende de Groq y de la red.
5. El historial se limita a 15 mensajes y a un recorte de caracteres.
6. No hay pruebas automatizadas permanentes para toda la integración; parte de la verificación fue manual.
7. El backend WebSocket no escala horizontalmente sin un adaptador de rooms compartido.
8. El generador cubre el subconjunto UML implementado, no todo UML 2.5.
9. No hay observabilidad distribuida.
10. El lint del frontend conserva 154 problemas preexistentes, principalmente `any`.

## 15. Trabajo futuro

- Añadir FK de `auth.diagram_acl.diagram_id` y migración controlada.
- Implementar read-only real en Yjs.
- Añadir invitaciones y solicitudes de acceso.
- Incorporar pruebas automatizadas de integración al repositorio.
- Añadir rate limiting a autenticación e IA.
- Añadir métricas y trazas.
- Exportar a PlantUML y SQL.
- Mejorar la memoria de IA con resúmenes o recuperación semántica.
- Añadir paginación y limpieza de mensajes antiguos.
- Endurecer CORS y límites de tasa.

## 16. Trazabilidad de implementación

| Caso de uso | Implementación principal | Verificación |
|---|---|---|
| CU-01 | `routes/auth.js`, `userService`, `AuthContext` | Login, registro y `/me` |
| CU-02 | `routes/diagrams.js`, `diagramService` | Listado, creación y borrado |
| CU-03 | `useCollaborativeFlow`, helpers Yjs | Sincronización y snapshot |
| CU-04 | `routes/acl.js`, `aclService` | Roles y actualización |
| CU-05 | `diagramExportImport`, XMI | Exportación e importación |
| CU-06 | `useAICommand`, `routes/ai.js`, `aiService`, `chatService` | 23/23 checks y prueba manual |
| CU-07 | `generator/generate.js` | ZIP y plantillas |
| CU-08 | `HelpModal`, `manual.ts` | Apertura, búsqueda y cierre |

## 17. Conclusión

La implementación cumple el objetivo del Segundo Parcial: el asistente IA dejó de ser una llamada aislada y pasó a ser un participante del espacio colaborativo, con identidad verificable, memoria durable y respuestas visibles para todos. La migración a PostgreSQL aportó persistencia, autorización y trazabilidad sin romper el modelo de colaboración basado en Yjs.

La solución no está exenta de compromisos. El más importante es la convivencia de dos estados: el documento CRDT vivo y las tablas relacionales durables. Esa convivencia está documentada, justificada y acotada. Las limitaciones restantes son mejoras concretas, no fallos ocultos.

Volver al [[00_Indice]].
