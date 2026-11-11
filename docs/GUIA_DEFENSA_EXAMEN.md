# Guía de defensa del Segundo Parcial

**Proyecto:** Herramienta CASE Colaborativa con IA  
**Objetivo:** defender autoría, arquitectura, UML, base de datos sectorizada, Yjs e IA con respuestas técnicas y trazables al código.

> **Cómo usar esta guía:** primero memoriza el guion de 5 minutos; después practica las preguntas por categorías. Cada respuesta tiene tres partes: qué decir, por qué es correcto y dónde está en el código o en Enterprise Architect.

---

## 1. Guion de presentación (5 minutos)

| Tiempo | Pantalla | Qué haces | Frase clave |
|---|---|---|---|
| 0:00–0:30 | Vercel / login | Abres la aplicación y muestras login/registro. | “La identidad se firma con JWT y las contraseñas nunca se guardan en claro; usamos bcrypt.” |
| 0:30–1:15 | Dashboard | Creas o abres un diagrama y muestras las tarjetas propias/compartidas. | “El dashboard separa diagramas propios y compartidos mediante una ACL por diagrama.” |
| 1:15–2:00 | Editor | Arrastras una entidad, agregas atributos y una relación; abres una segunda pestaña para mostrar colaboración. | “El grafo vivo está en Yjs; PostgreSQL guarda el snapshot binario, no una fila por clase.” |
| 2:00–2:40 | Chat IA | Seleccionas una clase, preguntas algo teórico y luego pides una acción. | “La IA recibe el AST, el elemento seleccionado, el historial y la identidad del JWT; su respuesta se valida antes de tocar el diagrama.” |
| 2:40–3:20 | EA | Muestras casos de uso, comunicación, procedimental, modelo lógico real y secuencia. | “Cada artefacto PUDS tiene su vista: requisitos, análisis BCE, diseño por capas y secuencia.” |
| 3:20–4:00 | VS Code | Abres `backend/routes`, `backend/services`, `backend/realtime/yjs.js`, `backend/generator`. | “Las rutas no ejecutan SQL: delegan en servicios; los servicios usan `pg` con parámetros y `db.js`.” |
| 4:00–4:35 | XMI / ZIP | Exportas XMI y generas el backend. | “El XMI incluye UMLDI y extensión EA; el generador valida el AST y produce un ZIP Spring Boot.” |
| 4:35–5:00 | Cierre | Muestras build, pruebas y base de datos. | “La herramienta es Node.js; el backend generado es Spring Boot. No confundimos la herramienta con su salida.” |

**Frases de cierre para impresionar:**
- “La decisión más importante fue separar el estado colaborativo (Yjs) de la persistencia relacional (Neon).”
- “No normalizamos el CRDT porque romperíamos sus relojes lógicos y la convergencia.”
- “El generador no genera a ciegas: valida, sanitiza nombres, expande relaciones y prueba plantillas.”
- “La documentación no es decorativa: los diagramas EA y Obsidian están trazados a archivos y métodos reales.”

---

## 2. Banco de preguntas y respuestas

### Categoría A: Preguntas básicas (Nivel 1)

#### A1. ¿Qué hace la aplicación?
**Respuesta:** Es una herramienta CASE colaborativa para modelar UML en tiempo real. Permite autenticarse, crear y compartir diagramas, editar clases y relaciones, usar un asistente IA, exportar/importar XMI y generar un backend Spring Boot con PostgreSQL.

**Por qué:** integra en un solo flujo análisis, diseño y generación de código; el valor está en pasar del diagrama al backend sin reescribir el modelo.

**Ubicación:** frontend `frontend/src/app/diagram/[id]/page.tsx`; backend `backend/app.js`; generador `backend/generator/generate.js`; EA `FT: Requisitos/Diagrama General de Caso de Uso`.

#### A2. ¿Cuál es la diferencia entre la herramienta Node y el backend generado Spring?
**Respuesta:** La herramienta es la aplicación real: Node.js + Express + Yjs + PostgreSQL/Neon. El backend generado es un artefacto de salida: un proyecto Spring Boot con JPA/Hibernate que se crea a partir del AST del diagrama del usuario.

**Por qué:** son dos productos distintos. La herramienta usa SQL directo con `pg`; el backend generado usa `JpaRepository` y `ddl-auto=update` porque es código Java independiente.

**Ubicación:** herramienta `backend/routes`, `backend/services`, `backend/db.js`; generador `backend/routes/generator.js`, `backend/generator/generate.js`, `backend/generator/templates/model.java.hbs`.

#### A3. ¿Por qué usaron React y no Angular o Vue?
**Respuesta:** La evidencia del proyecto es React 19 + Next.js 16 + React Flow 11. React Flow ya resuelve nodos, aristas, handles, zoom y eventos de canvas; React permitió integrar Yjs y hooks de colaboración sin adaptar un framework de grafo.

**Por qué:** el requisito dominante era un editor de grafos colaborativo, no una aplicación CRUD. React Flow y el ecosistema de hooks redujeron el tiempo de construcción del canvas y de los paneles.

**Ubicación:** `frontend/package.json` (React 19.2.8, React Flow 11.11.4, Next 16.3.3); `frontend/src/components/diagram/EditorFlow.tsx`; `frontend/src/hooks/useCollaborativeFlow.ts`.

> No hay un ADR formal que diga “se descartó Angular”; la justificación se deduce de la arquitectura implementada. Decirlo así demuestra honestidad técnica.

#### A4. ¿Por qué Node.js en lugar de Java para la herramienta principal?
**Respuesta:** Node.js permitió un solo lenguaje TypeScript/JavaScript entre frontend y backend, y un ecosistema directo para WebSocket, Yjs, `pg` y Handlebars. El generador produce Java, pero la herramienta que lo produce no necesita ejecutarse en Java.

**Por qué:** el backend de la herramienta es principalmente I/O concurrente (REST, WebSocket, PostgreSQL, IA); Node encaja bien y evita cambiar de lenguaje en el equipo. Java se reserva para el backend generado, que sí es Spring Boot.

**Ubicación:** `backend/package.json`; `backend/server.js`; `backend/realtime/yjs.js`; `backend/services/aiService.js`.

#### A5. ¿Qué es la base de datos sectorizada y por qué la usaron?
**Respuesta:** Es PostgreSQL/Neon dividido en tres esquemas: `auth` (usuarios, ACL y solicitudes), `core` (diagramas y snapshot Yjs) y `chat` (mensajes e historial de IA). Cada esquema agrupa datos con distinta responsabilidad y ciclo de vida.

**Por qué:** separa seguridad, colaboración e IA; facilita permisos, consultas y mantenimiento. También evita mezclar el historial de chat con la identidad o con el snapshot del diagrama.

**Ubicación:** `backend/db.js`; `backend/scripts/access_requests.sql`; `backend/services/userService.js`, `diagramService.js`, `chatService.js`; EA `04.2_Modelo_Fisico_BD_Neon` y `05_Modelo_Logico_Real_Codigo`.

---

### Categoría B: Arquitectura y código (Nivel 2)

#### B1. Explícame la Clean Architecture del backend Node. ¿Dónde está el controlador y dónde el servicio?
**Respuesta:** `app.js` compone Express y monta routers; `routes/` actúa como controlador HTTP; `middleware/` valida autenticación, ACL y errores; `services/` contiene lógica y SQL; `db.js` encapsula el pool PostgreSQL. La dependencia va de rutas a servicios y de servicios a `db.js`.

**Por qué:** separar HTTP de lógica permite probar y reutilizar servicios sin Express. Las rutas no deberían conocer detalles de tablas.

**Ubicación:** controlador `backend/routes/auth.js` (`router.post('/register')`, `/login`); servicio `backend/services/userService.js` (`createUser`, `verifyPassword`); composición `backend/app.js`; pool `backend/db.js`.

#### B2. ¿Por qué no usaron un ORM como Prisma o TypeORM y prefirieron SQL nativo?
**Respuesta:** La herramienta usa `pg` con SQL parametrizado porque las operaciones son pocas, sectorizadas y necesitan control explícito de transacciones, índices y columnas `BYTEA`. Un ORM añadía una capa de mapeo y dependencia para un esquema pequeño.

**Por qué:** el equipo necesitaba transacciones atómicas (diagrama + ACL), consultas específicas y manejo directo de `yjs_snapshot`; SQL parametrizado reduce magia y latencia. El backend generado sí usa ORM/JPA porque es otra arquitectura.

**Ubicación:** `backend/db.js` (`Pool`, `withTransaction`); `backend/services/diagramService.js`; `backend/services/userService.js`; `backend/services/aclService.js`.

#### B3. ¿Dónde está la seguridad JWT y cómo funciona?
**Respuesta:** `requireAuth` lee `Authorization: Bearer`, verifica el JWT y adjunta `req.user = { userId, username }`. `signToken` firma un token con `userId`, `username` y expiración. `bcryptjs` se usa solo para contraseñas, no para el token.

**Por qué:** el token es stateless: el servidor no guarda sesiones. La identidad viene del token, no del cuerpo, lo que evita suplantación.

**Ubicación:** `backend/middleware/auth.js` (`requireAuth`, `signToken`, `verifyToken`); `backend/routes/auth.js`; `backend/services/userService.js` (`bcrypt.hash`, `bcrypt.compare`).

#### B4. ¿Qué pasa si alguien intenta inyectar SQL en el login?
**Respuesta:** Las consultas usan placeholders `$1` y un arreglo de parámetros. El valor del usuario nunca se concatena al SQL; `pg` lo envía como dato, no como código.

**Por qué:** la parametrización separa estructura SQL de valores y elimina la inyección clásica. Además, `validateLoginBody` limita tipo y longitud.

**Ubicación:** `backend/services/userService.js`: `WHERE lower(username) = lower($1)`; `backend/validation/auth.js`; `backend/routes/auth.js`.

#### B5. ¿Cómo manejan los errores globales en Express?
**Respuesta:** `httpError(status, message)` crea un `AppError`; `asyncHandler` captura promesas rechazadas y las pasa a `next`; `notFound` y `errorHandler` se montan al final de `app.js`. En 5xx se oculta el detalle interno y se registra en consola.

**Por qué:** evita `try/catch` repetido y impide filtrar stacks o SQL al cliente.

**Ubicación:** `backend/errors.js` (`AppError`, `httpError`, `asyncHandler`); `backend/middleware/errorHandler.js`; `backend/app.js`.

#### B6. ¿Cómo se aplica la ACL a una petición?
**Respuesta:** `requireDiagramMember` consulta el rol en `auth.diagram_acl`; `requireDiagramRole('OWNER')` exige un rol concreto; `requireDiagramWrite` permite OWNER o EDITOR. El WebSocket hace la misma validación antes de aceptar la sala.

**Por qué:** autenticación no es autorización. Un usuario autenticado puede no tener acceso a un diagrama ajeno.

**Ubicación:** `backend/middleware/diagramAuth.js`; `backend/services/aclService.js`; `backend/realtime/yjs.js`.

---

### Categoría C: Base de datos y Yjs (Nivel 3)

#### C1. ¿Por qué no hay tablas para `Class` y `Relation`?
**Respuesta:** Porque el lienzo es un CRDT de Yjs. Las clases, atributos y relaciones no se guardan como filas SQL; se serializan completos en `core.diagrams.yjs_snapshot` de tipo `BYTEA`.

**Por qué:** normalizar cada cambio en miles de filas destruiría la convergencia y el rendimiento. El CRDT conserva relojes lógicos, tombstones y orden de operaciones que una tabla relacional no representa directamente.

**Ubicación:** `backend/services/diagramService.js` (`getSnapshot`, `saveSnapshot`); `backend/realtime/yjs.js`; EA `05_Modelo_Logico_Real_Codigo` y `04.0_Modelo_Conceptual_BD_Herramienta`.

#### C2. ¿Cómo se guarda y recupera el snapshot binario?
**Respuesta:** Se serializa con `Y.encodeStateAsUpdate(ydoc)`, se convierte con `Buffer.from(update)` y se ejecuta `UPDATE core.diagrams SET yjs_snapshot = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`. Al reconectar se lee el `BYTEA` y se aplica con `Y.applyUpdate(ydoc, new Uint8Array(snapshot))`.

**Por qué:** `pg` transporta `Buffer` a `BYTEA`; `Uint8Array` es el formato nativo de Yjs. La conversión explícita evita ambigüedad.

**Ubicación:** `backend/services/diagramService.js`; `backend/realtime/yjs.js` (`bindState`); guía `Documentacion_Segundo_Parcial/GUIA_YJS_SNAPSHOT.md`.

#### C3. ¿Qué es el debounce de 2 segundos y por qué es vital?
**Respuesta:** Es un temporizador que reinicia en cada cambio del documento. Yjs actualiza la memoria al instante, pero el `UPDATE` a PostgreSQL solo ocurre cuando pasan 2 segundos sin cambios nuevos.

**Por qué:** mover un nodo genera decenas de eventos; escribir cada uno saturaría la base y la red. El debounce agrupa cambios y conserva solo el snapshot más reciente.

**Ubicación:** `backend/realtime/yjs.js`: `SNAPSHOT_DEBOUNCE_MS = 2000` y `scheduleSnapshot`.

#### C4. ¿Por qué `diagram_acl` no tiene FK física hacia `diagrams`?
**Respuesta:** El esquema entregado no declara esa FK. La integridad se garantiza en la aplicación: `createDiagramWithOwner` crea diagrama y ACL en una transacción; `deleteDiagram` elimina primero la ACL y después el diagrama en otra transacción.

**Por qué:** se evitó una dependencia física entre `auth` y `core`; la aplicación mantiene la consistencia y evita ACL huérfanas. Es una decisión explícita, no un olvido.

**Ubicación:** `backend/services/diagramService.js` (`createDiagramWithOwner`, `deleteDiagram`); `REVERSE_ENGINEERING_REPORT.md`; EA `05_Modelo_Logico_Real_Codigo` (nota).

#### C5. Si se cae el servidor, ¿se pierde el trabajo?
**Respuesta:** No debería perderse el último estado confirmado. Al apagar, `shutdownRealtime` ejecuta `flushSnapshots`, que recorre los documentos activos y guarda `Y.encodeStateAsUpdate(ydoc)` en PostgreSQL.

**Por qué:** el snapshot final reduce la ventana de pérdida. Si el proceso muere de forma abrupta, se pierde solo lo posterior al último debounce o flush.

**Ubicación:** `backend/server.js` (SIGTERM/SIGINT); `backend/realtime/yjs.js` (`shutdownRealtime`, `flushSnapshots`, `writeState`).

#### C6. ¿Por qué usar `BYTEA` y no `JSONB`?
**Respuesta:** Yjs produce un binario opaco con relojes internos y codificación propia. `BYTEA` lo almacena sin reinterpretarlo; `JSONB` obligaría a convertir y podría corromper la semántica del CRDT.

**Por qué:** no consultamos clases individuales en SQL; consultamos el documento completo. El chat y la ACL sí son relacionales porque requieren filtros y auditoría.

**Ubicación:** `backend/services/diagramService.js`; `backend/services/chatService.js`; DDL en `04_Diseno_UML.md` sección 5.7.

#### C7. ¿Cómo evitan mensajes duplicados en el chat?
**Respuesta:** El historial de PostgreSQL se hidrata en Yjs solo si no existe; se deduplica por `id` antes de insertar y antes de renderizar. Además, el backend emite la respuesta de IA y el frontend no la vuelve a agregar si `chatEmitted === true`.

**Por qué:** varios clientes o recargas pueden insertar el mismo mensaje `db_*`; sin deduplicación React mostraría keys repetidas y el chat tendría duplicados.

**Ubicación:** `frontend/src/utils/chatMessage.ts` (`dedupeChatMessages`); `frontend/src/utils/yjsDiagramIo.ts`; `frontend/src/hooks/useCollaborativeFlow.ts`; `frontend/src/components/ChatPanel.tsx`.

---

### Categoría D: Inteligencia Artificial (Nivel 3)

#### D1. ¿Cómo evitan que la IA invente clases o alucine?
**Respuesta:** El prompt exige responder con un JSON `{ response, mutations }`, prohíbe inventar elementos y limita las acciones a una allowlist. El backend valida el AST, las mutaciones, nombres, tipos y relaciones antes de aplicarlas; si el formato es inválido devuelve `502` sin cambios parciales.

**Por qué:** el modelo es probabilístico; la validación determinista es la barrera real. La IA propone, el backend decide.

**Ubicación:** `backend/services/aiService.js` (systemPrompt, `extractMutationsFromText`); `backend/validation.js` (`validateMutations`, `validateAstState`); `backend/routes/ai.js`; `frontend/src/utils/ast.ts` (`applyMutations`).

#### D2. Explícame el Patrón Strategy para Groq y Ollama.
**Respuesta:** `resolveAiProvider` elige una configuración según `provider`: Groq usa API key, URL y modelo de nube; Ollama usa URL/modelo local y no usa API key. Ambos comparten el contrato OpenAI-compatible de `/chat/completions`.

**Por qué:** el resto de `getMutationsFromAI` no cambia según el proveedor; solo cambia la estrategia de conexión. Eso permite alternar en caliente sin duplicar la lógica de prompt.

**Ubicación:** `backend/services/aiService.js` (`resolveAiProvider`, `getMutationsFromAI`); `frontend/src/hooks/useAiProvider.ts`; `frontend/src/components/AiConfigModal.tsx`.

#### D3. ¿Cómo funciona la tutoría contextual?
**Respuesta:** El frontend envía `selectedElement` (tipo, id, nombre, estereotipo, atributos, métodos o extremos de relación). El backend lo valida y lo inserta en el prompt; la IA debe usar ese elemento como ejemplo y nombrarlo.

**Por qué:** sin contexto, la IA respondería genérico. Con el elemento seleccionado, puede explicar “esta composición” o “esta clase” usando datos reales del diagrama.

**Ubicación:** `frontend/src/hooks/useEditorSelection.ts`; `frontend/src/hooks/useAICommand.ts`; `backend/validation.js` (`validateSelectedElement`); `backend/services/aiService.js` (`formatSelectedElement`).

#### D4. ¿Cómo maneja la IA la memoria del chat y distingue quién habla?
**Respuesta:** La identidad del usuario sale del JWT (`req.user.username`); no del cuerpo. `chat.messages` guarda `author`, `role`, `content` y `created_at`. `formatChatHistory` etiqueta cada mensaje con su autor y el prompt indica quién es el usuario actual; así distingue a Carlos de Andrés.

**Por qué:** el historial es contexto compartido, pero la orden actual solo la ejecuta quien envía el mensaje. La autoría persistida evita mezclar intenciones.

**Ubicación:** `backend/middleware/auth.js`; `backend/routes/ai.js`; `backend/services/chatService.js`; `backend/services/aiService.js` (`aiUsername`, `formatChatHistory`, `ensureAddressed`).

#### D5. ¿Qué pasa si Ngrok/Ollama se cae?
**Respuesta:** El backend captura el fallo y devuelve `503` con un mensaje accionable; si el proveedor tarda demasiado devuelve `504`. El frontend muestra el error en el chat y no aplica mutaciones parciales.

**Por qué:** la IA es un servicio externo; su caída no debe corromper el diagrama. La respuesta fallida se trata como error controlado.

**Ubicación:** `backend/services/aiService.js` (catch de `fetch`, `AbortError`); `backend/routes/ai.js`; `frontend/src/hooks/useAICommand.ts`.

#### D6. ¿Por qué `temperature: 0.1`?
**Respuesta:** Baja la creatividad del modelo para que priorice estructura y consistencia sobre variación. No elimina la alucinación, pero reduce respuestas divergentes.

**Por qué:** el asistente debe producir JSON válido y mutaciones predecibles, no texto creativo.

**Ubicación:** `backend/services/aiService.js` (`temperature: 0.1`, `max_tokens: 2000`).

---

### Categoría E: Generación de código y UML (Nivel 4)

#### E1. ¿Cómo evitan que el generador falle si nombro una clase “Class”?
**Respuesta:** `naming.js` tiene una lista `JAVA_KEYWORDS`; si el nombre sanitizado es una palabra reservada, agrega el sufijo `Entity` (por ejemplo `Class` → `ClassEntity`). Las tablas también se protegen con `auto_quote_keyword=true` en el backend generado.

**Por qué:** un identificador Java inválido rompería la compilación. La sanitización convierte nombres visibles del diagrama en identificadores válidos sin perder el nombre original.

**Ubicación:** `backend/generator/naming.js` (`JAVA_KEYWORDS`, `toJavaClassName`); `backend/generator/templates/application.properties.hbs` (`auto_quote_keyword`).

#### E2. ¿Cómo traducen una relación muchos a muchos de UML a Java?
**Respuesta:** No se usa `@ManyToMany`. `expandManyToMany` crea una entidad intermedia explícita con UUID propio y dos relaciones `@ManyToOne`; los atributos de la relación se guardan en esa entidad.

**Por qué:** evita ciclos de serialización JSON y permite columnas extra; una tabla intermedia con atributos no cabe en un `@JoinTable` simple.

**Ubicación:** `backend/generator/expander.js` (`expandManyToMany`); `backend/generator/generate.js`; `backend/generator/templates/entity-intermediate.java.hbs`.

#### E3. ¿Cómo lograron que el XMI se vea bien en EA?
**Respuesta:** Se generan namespaces XMI/UML/UMLDI, se ordenan `memberEnd` antes de `ownedEnd`, se usa `xmi:type="uml:Property"`, `association` como back-reference y `<type xmi:idref>`. Los atributos llevan `lowerValue/upperValue=1` y `collection="false"` para evitar `{bag}`. El diagrama incluye UMLDI con bounds/waypoints y una extensión EA con `Path` y `Mode=3;TREE=OS` para líneas ortogonales.

**Por qué:** EA no dibuja relaciones solo con el modelo; necesita la sección de diagrama y su extensión propietaria. Además, cada herramienta interpreta los extremos de forma distinta.

**Ubicación:** `frontend/src/utils/xmiExporter.ts` (`buildAssociation`, `buildDiagramInterchange`, `buildEaExtension`); `backend/generator/templates/model.java.hbs`; `AUDIT_XMI.md`.

#### E4. ¿Cuál es la diferencia entre el Diagrama de Comunicación y el Procedimental?
**Respuesta:** El de comunicación es de **análisis**: muestra objetos BCE (Boundary, Control, Entity) y mensajes entre ellos. El procedimental es de **diseño**: muestra las clases/capas reales (`View`, `Route`, `Service`, `db.js`) y dependencias de implementación.

**Por qué:** el primero ayuda a entender responsabilidades; el segundo muestra cómo se implementa el flujo en la arquitectura Node/Express.

**Ubicación:** EA `FT: Análisis/Diagrama Comunicación Análisis de CU/...` y `FT: Diseño/Diagrama de Clases/CU*/DP_CU*`.

#### E5. ¿Cómo se genera la herencia JPA?
**Respuesta:** La clase raíz lleva `@Inheritance(strategy = JOINED)`; el hijo usa `extends`, `@PrimaryKeyJoinColumn` y no declara `@Id` propio. La dirección se interpreta como source=hijo y target=padre.

**Por qué:** JPA exige una sola estrategia por jerarquía; repetir `@Inheritance` en el hijo o declarar otra PK rompe el mapeo.

**Ubicación:** `backend/generator/contextBuilder.js` (`buildInheritanceInfo`); `backend/generator/templates/model.java.hbs`; `backend/generator/tests/inheritance.test.js`.

---

### Categoría F: PUDS y metodología

#### F1. ¿Cuáles fueron las 6 iteraciones del proceso?
**Respuesta:** 1) Inicio: identidad del usuario; 2) Elaboración: clasificación de intención; 3) Construcción: concurrencia, ACL y snapshots; 4) Transición: contexto y memoria; 5) Transición: solicitudes de acceso; 6) Transición: panel de configuración de IA.

**Por qué:** cada iteración atacó un riesgo dominante y dejó evidencia verificable. Es un PUDS iterativo e incremental, no una entrega monolítica.

**Ubicación:** `Documentacion_Segundo_Parcial/01_Requisitos_y_Proceso.md`, secciones 2.3.1–2.3.6; `05_Implementacion_y_Pruebas.md`.

#### F2. ¿Cómo aplicaron el modelo C4?
**Respuesta:** Nivel 1: contexto (usuarios, Vercel, Railway, Neon, Groq); Nivel 2: contenedores (frontend, backend, WebSocket, PostgreSQL); Nivel 3: componentes (rutas, servicios, persistencia, generador); Nivel 4: clases/código (diagramas UML y modelos reales).

**Por qué:** C4 permite explicar el sistema a distintos públicos sin mezclar despliegue, componentes y clases en una sola vista.

**Ubicación:** `Documentacion_Segundo_Parcial/03_Diseno_Arquitectura.md`, secciones 1.11.1–1.11.4; `04_Diseno_UML.md`.

#### F3. ¿Por qué quitaron el actor “Visitante”?
**Respuesta:** El modelo se simplificó a dos actores principales: Ingeniero de Software y Colaborador. El registro/login los ejecuta el Ingeniero; el Visitante era un actor artificial que solo existía para autenticarse.

**Por qué:** un actor debe representar un rol con objetivos estables; “no autenticado” es un estado, no un rol de negocio. Mantenerlo duplicaba relaciones y confundía los casos de uso.

**Ubicación:** `Documentacion_Segundo_Parcial/01_Requisitos_y_Proceso.md`; EA `FT: Requisitos/Diagrama General de Caso de Uso`; `DP_CU1_Registrarse`.

#### F4. ¿Cómo justifican que el modelo conceptual no tenga `Project`, `Class` y `Relation` en SQL?
**Respuesta:** Son modelos distintos. El conceptual describe el negocio; el físico usa `core.diagrams.yjs_snapshot` para el CRDT y solo normaliza usuarios, ACL, solicitudes y chat.

**Por qué:** el CRDT necesita conservar su estructura interna; descomponerlo en filas rompería la colaboración. La trazabilidad está en `REVERSE_ENGINEERING_REPORT.md` y `Documentacion_Segundo_Parcial/GUIA_YJS_SNAPSHOT.md`.

**Ubicación:** `REVERSE_ENGINEERING_REPORT.md`; `Documentacion_Segundo_Parcial/GUIA_YJS_SNAPSHOT.md`; EA `04.0`, `04.2`, `05`.

---

## 3. Preguntas trampa o de autoría

#### T1. ¿Por qué esta línea está escrita así?
**Ejemplo real:**

```javascript
if (rel.type === 'INHERITANCE') continue;
```

**Respuesta:** Esa línea está en `buildEntityRelations` para que una generalización no se procese también como relación normal. Sin ella, el generador producía `@OneToOne` entre padre e hijo además de `@Inheritance`, y Hibernate fallaba.

**Por qué:** la herencia ya se representa con `@Inheritance` y `@PrimaryKeyJoinColumn`; tratarla como asociación duplica el vínculo y rompe el mapeo.

**Ubicación:** `backend/generator/contextBuilder.js`, función `buildEntityRelations`; prueba `backend/generator/tests/inheritance.test.js`.

**Segundo ejemplo real:**

```javascript
await client.query('DELETE FROM auth.diagram_acl WHERE diagram_id = $1', [id]);
const result = await client.query('DELETE FROM core.diagrams WHERE id = $1', [id]);
```

**Respuesta:** `deleteDiagram` borra primero la ACL y luego el diagrama dentro de una transacción porque no existe FK física de `diagram_acl.diagram_id` a `core.diagrams.id`.

**Por qué:** si se borrara solo el diagrama, quedarían permisos huérfanos; la transacción garantiza atomicidad.

**Ubicación:** `backend/services/diagramService.js`, función `deleteDiagram`.

#### T2. Si quisiéramos agregar una nueva entidad al sistema, ¿qué pasos seguirían?
**Respuesta:**
1. Definir la tabla y sus columnas en el esquema correcto (`auth`, `core` o `chat`), con PK, FK e índices.
2. Crear el servicio con SQL parametrizado en `backend/services/`.
3. Exponer las rutas/controladores en `backend/routes/` con `requireAuth` y ACL si aplica.
4. Agregar validación de entrada en `backend/validation/`.
5. Crear tipos, hook y UI en `frontend/src/` si el usuario la verá.
6. Agregar pruebas, actualizar EA/Obsidian y, si aplica, el generador.

**Por qué:** cada capa tiene una responsabilidad; saltarse la validación o la ACL deja huecos de seguridad.

**Ubicación:** ejemplo completo en `userService.js` + `routes/auth.js` + `validation/auth.js` + `app/register/page.tsx`.

#### T3. ¿Qué pasa si elimino esta validación en el backend?
**Ejemplo:** quitar `validateMutations` en `backend/routes/ai.js`.

**Respuesta:** La respuesta del LLM llegaría sin allowlist; una acción inventada o un campo mal formado podría intentar aplicarse en `applyMutations`, y el diagrama quedaría inconsistente o el cliente fallaría. La validación es la frontera entre “texto generado” y “orden ejecutable”.

**Por qué:** nunca se confía en el LLM como fuente de verdad. La IA propone; el backend valida.

**Ubicación:** `backend/routes/ai.js`; `backend/validation.js` (`validateMutations`); `frontend/src/utils/ast.ts` (`applyMutations`).

**Otro ejemplo:** quitar `requireDiagramMember` de `routes/diagrams.js`.

**Respuesta:** cualquier usuario autenticado podría leer o modificar un diagrama ajeno con solo conocer el id.

**Por qué:** autenticación no es autorización; la ACL es la que decide el acceso por diagrama.

**Ubicación:** `backend/middleware/diagramAuth.js`; `backend/routes/diagrams.js`.

#### T4. ¿Por qué usaron `Buffer.from(update)` en `saveSnapshot`?
**Respuesta:** Yjs devuelve un `Uint8Array`; el driver `pg` mapea `Buffer` a `BYTEA`. La conversión explícita hace visible el tipo que viaja a PostgreSQL y evita depender de coerciones implícitas.

**Por qué:** el snapshot es binario; convertirlo a string lo corrompería.

**Ubicación:** `backend/services/diagramService.js`, `saveSnapshot`.

#### T5. ¿Por qué el chat usa `dedupeChatMessages`?
**Respuesta:** Porque el historial de PostgreSQL se hidrata en Yjs y varios clientes pueden insertar el mismo `db_*`; deduplicar por id evita keys repetidas en React y mensajes duplicados.

**Por qué:** la vista no debe depender de que todos los clientes lleguen en orden perfecto.

**Ubicación:** `frontend/src/utils/chatMessage.ts`; `frontend/src/utils/yjsDiagramIo.ts`; `frontend/src/components/ChatPanel.tsx`.

#### T6. ¿Por qué el XMI no declara `xmi:version` en la raíz?
**Respuesta:** Porque EA ignora su extensión de diagrama si `xmi:version` está en `<xmi:XMI>`. La versión 2.5.1 se declara en `xmi:Documentation` y los namespaces siguen siendo XMI/UML 2.5.1.

**Por qué:** sin esa decisión, EA importaba clases pero no dibujaba relaciones. La prioridad fue la importación real, documentada en `AUDIT_XMI.md`.

**Ubicación:** `frontend/src/utils/xmiExporter.ts`; `AUDIT_XMI.md`.

---

## 4. Glosario mínimo para no quedarse en blanco

- **CRDT:** estructura que permite que varios clientes editen sin coordinador y converjan al mismo estado.
- **Yjs:** implementación de CRDT usada para el grafo colaborativo.
- **Snapshot:** copia binaria completa del documento Yjs.
- **BYTEA:** tipo binario de PostgreSQL.
- **Debounce:** esperar un tiempo sin cambios antes de ejecutar una acción.
- **JWT:** token firmado que transporta identidad y expiración.
- **ACL:** lista de control de acceso por diagrama y usuario.
- **ORM:** capa que traduce objetos a tablas; la herramienta no la usa, el backend generado sí.
- **AST:** representación estructurada del diagrama (entidades y relaciones) que consume la IA y el generador.
- **Handlebars:** motor de plantillas que genera archivos Java.
- **UMLDI:** sección XMI que describe la geometría del diagrama.
- **PUDS/RUP:** proceso iterativo por fases: Inicio, Elaboración, Construcción, Transición.
- **C4:** modelo de contexto, contenedores, componentes y código.
- **BCE:** Boundary-Control-Entity, patrón de análisis.

---

## 5. Plan de respaldo para la demo

1. Si Vercel falla, abre el frontend local con `npm run dev` en `frontend/`.
2. Si la IA en la nube falla, cambia a Ollama o explica el `503` controlado; no improvises una mutación manual sin decir que es fallback.
3. Si el WebSocket no conecta, muestra los dos navegadores y explica que la persistencia y la colaboración dependen de `diagram-room-<id>`.
4. Si EA no abre un diagrama, usa la vista de modelo y las capturas/documentos; no edites el modelo en vivo.
5. Si te preguntan por un archivo que no recuerdas, abre VS Code y busca el método exacto; es mejor mostrar la fuente que improvisar.

## 6. Checklist final

- [ ] `npm run build` y `npx tsc --noEmit` pasan.
- [ ] `node backend/generator/tests/*.test.js` pasan.
- [ ] Backend generado compila con `mvn -q -DskipTests package`.
- [ ] Login, dashboard, edición, chat, XMI y generación funcionan.
- [ ] Diagramas EA abiertos: general, comunicación CU2, DP CU1, modelo real, SD CU1.
- [ ] Documentos abiertos: `REVERSE_ENGINEERING_REPORT.md`, `Documentacion_Segundo_Parcial/GUIA_YJS_SNAPSHOT.md`, `AUDIT_XMI.md`.
- [ ] Tener claro: **herramienta Node ≠ backend generado Spring**.
- [ ] Tener claro: **clases/relaciones viven en Yjs, no en tablas SQL**.
- [ ] Tener claro: **la IA propone; el backend valida**.
