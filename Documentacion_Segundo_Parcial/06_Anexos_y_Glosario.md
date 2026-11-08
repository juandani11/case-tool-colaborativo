# Anexos y Glosario

> Documento consolidado de trazabilidad, despliegue, manual de usuario, conclusiones, glosario y bibliografía.

## 1. Matriz de Trazabilidad

### 1. Propósito

La matriz demuestra que cada caso de uso tiene un componente de interfaz, un endpoint o función de backend, una tabla de persistencia y una evidencia de verificación. Se incluyen dos filas adicionales para las capacidades transversales de Fase 3: solicitudes de acceso y configuración del motor de IA.

### 2. Matriz principal

| Código CU | Nombre del Caso de Uso | Componente UI | Endpoint Backend | Tabla BD | Prueba QA (Estado) |
|---|---|---|---|---|---|
| CU-01 | Autenticarse | `LoginPage`, `RegisterPage`, `AuthContext` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | `auth.users` | Integración JWT, login, registro y `/me` (PASS) |
| CU-02 | Gestionar diagramas | `dashboard/page.tsx`, `DiagramCard` | `GET/POST /api/diagrams`, `POST /api/diagrams/:id`, `PUT /api/diagrams/:id/rename`, `DELETE /api/diagrams/:id` | `core.diagrams`, `auth.diagram_acl` | Integración CRUD y borrado transaccional (PASS) |
| CU-03 | Editar colaborativamente | Editor UML, `Toolbar`, `useCollaborativeFlow` | WebSocket `diagram-room-<id>`, `GET /api/diagrams/:id` | `core.diagrams.yjs_snapshot` | Prueba A/B, snapshot y recarga (PASS) |
| CU-04 | Gestionar miembros | `MembersPanel`, `useDiagramMembers` | `GET /api/diagrams/:id/acl`, `POST/PATCH/DELETE /api/diagrams/:id/members` | `auth.diagram_acl`, `auth.users` | Prueba de roles y ACL (PASS) |
| CU-05 | Exportar/importar | `Toolbar`, utilidades JSON/XMI | Funciones locales de serialización e importación | `core.diagrams` (snapshot) | JSON válido, XMI inválido y IDs estables (PASS) |
| CU-06 | Interactuar con Agente IA | `ChatPanel`, `useAICommand` | `POST /api/ai/command`, `POST /api/ai/transcribe`, `POST /api/ai/from-image` | `chat.messages` | Regresión IA 32/32 y prompt contextual (PASS) |
| CU-07 | Generar backend Spring Boot | `Toolbar` | `POST /api/generate` | `core.diagrams` (AST de entrada) | ZIP generado y `mvn clean package` (PASS) |
| CU-08 | Consultar manual | `HelpModal`, `useHelpModal` | Función local `data/manual.ts` | N/A | Apertura, búsqueda y cierre (PASS) |
| CU-04-F3 | Solicitar y aprobar acceso | Editor sin acceso, `dashboard/page.tsx` | `POST /api/diagrams/:id/request-access`, `GET /api/access-requests/pending`, `POST /api/access-requests/:id/respond` | `auth.access_requests`, `auth.diagram_acl` | Solicitud, aprobación, rechazo y `403` (PASS) |
| CU-06-F3 | Configurar motor de IA | `ChatPanel`, modal de configuración | `GET /api/ai/ollama-models`, `POST /api/ai/command` con `provider` | N/A | Mock `/api/tags`, `503` y `400` SSRF (PASS) |

### 3. Trazabilidad de pruebas

| Evidencia | Cobertura |
|---|---|
| `AUDIT_QA_FULL.md` | Auth, ACL, Yjs, generador, JSON/XMI y cascadas |
| `AUDIT_FUZZ_GENERATOR.md` | Nombres extremos, keywords, acentos, ñ y compilación Java 21 |
| `AUDIT_AI_MASTER.md` | 15 escenarios de tutoría, contexto y seguridad |
| `AUDIT_QA.md` | Tutoría contextual, self-loop, nombres y posiciones |

### 4. Criterio de cierre

No existe un caso de uso sin componente, endpoint o evidencia. Las capacidades de Fase 3 quedaron integradas en la misma matriz para evitar documentación huérfana.

## 2. Manual de Despliegue

Este manual cubre el despliegue en **Vercel**, **Railway** y **Neon**, además de la configuración de Groq/Ollama y las comprobaciones de producción.

### 1. Arquitectura de despliegue

| Nodo | Plataforma | Artefacto |
|---|---|---|
| Frontend | Vercel | Next.js 16 (App Router) |
| Backend | Railway | Node.js + Express + `y-websocket` |
| Base de datos | Neon | PostgreSQL 18 sectorizado |
| IA cloud | Groq | API compatible con OpenAI |
| IA local | Ollama | Servicio local o túnel Ngrok |

### 2. Frontend en Vercel

1. Importar el repositorio en Vercel.
2. Configurar **Root Directory** como `frontend`.
3. Definir variables de entorno:

```env
NEXT_PUBLIC_API_URL=https://<backend>.up.railway.app
NEXT_PUBLIC_WS_URL=wss://<backend>.up.railway.app
```

4. Build command: `npm run build`.
5. Output: `.next`.

`NEXT_PUBLIC_API_URL` se usa en `apiClient.ts` y en el editor. `NEXT_PUBLIC_WS_URL` se usa para el `WebsocketProvider` de Yjs. Ambas deben apuntar al backend público; la URL del WebSocket debe usar `wss://` en producción.

### 3. Backend en Railway

1. Crear un servicio desde el repositorio.
2. Configurar **Root Directory** como `backend`.
3. Start command: `npm start`.
4. Variables obligatorias:

```env
DATABASE_URL=postgresql://usuario:password@host/db?sslmode=require
JWT_SECRET=<secreto-de-al-menos-32-caracteres>
AUTH_ENABLED=true
GROQ_API_KEY=<clave-de-groq>
PORT=1234
```

5. Variables opcionales:

```env
PG_POOL_MAX=10
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=qwen/qwen3.8-27b
AI_PROVIDER=groq
OLLAMA_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen2.5-coder:7b
```

El backend debe ejecutarse como proceso persistente porque mantiene WebSocket y documentos Yjs en memoria. No debe desplegarse como función serverless pura.

### 4. Base de datos en Neon

1. Crear un proyecto PostgreSQL en Neon.
2. Copiar la cadena TLS a `DATABASE_URL`.
3. Ejecutar el DDL base en el SQL Editor de Neon o con `psql`:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar NOT NULL UNIQUE,
  email varchar NOT NULL UNIQUE,
  password_hash varchar NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS core.diagrams (
  id varchar PRIMARY KEY,
  name varchar NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  yjs_snapshot bytea,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth.diagram_acl (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  granted_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (diagram_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar REFERENCES core.diagrams(id) ON DELETE CASCADE,
  author varchar NOT NULL,
  role varchar NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth.access_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL REFERENCES core.diagrams(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_unique
  ON auth.access_requests (diagram_id, requester_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS access_requests_diagram_status_idx
  ON auth.access_requests (diagram_id, status);
CREATE INDEX IF NOT EXISTS access_requests_requester_idx
  ON auth.access_requests (requester_id);
```

El script equivalente se conserva en `backend/scripts/access_requests.sql`.

4. Verificar la conectividad con `GET /ready` del backend.

### 5. IA local con Ollama

1. Instalar Ollama desde el sitio oficial.
2. Iniciar el servicio:

```bash
ollama serve
```

3. Descargar el modelo:

```bash
ollama pull qwen2.5-coder:7b
```

4. Comprobar modelos instalados:

```bash
curl http://localhost:11434/api/tags
```

5. En el modal **Configuración Avanzada de IA**, seleccionar Ollama, usar `http://localhost:11434/v1` y pulsar **Detectar**.

6. Para exponer Ollama desde otra máquina:

```bash
ngrok http 11434
```

Usar la URL pública terminada en `/v1` en el campo de configuración. El backend consulta `/api/tags` y el endpoint de chat usa `/chat/completions`.

### 6. Seguridad operativa

- Las claves `GROQ_API_KEY`, `JWT_SECRET` y `DATABASE_URL` **nunca** se suben al repositorio.
- `.env` y `.env.local` están ignorados por Git.
- Las variables reales se configuran en Railway, Vercel o Neon.
- La URL de Ollama se valida para aceptar solo `http://` o `https://`, sin credenciales embebidas.
- Si una clave se expone, debe rotarse antes de continuar.

### 7. Orden de despliegue recomendado

1. Crear la base en Neon y aplicar el DDL.
2. Desplegar el backend en Railway y verificar `/health` y `/ready`.
3. Desplegar el frontend en Vercel con las URLs del backend.
4. Configurar Groq en el backend o Ollama en el equipo local.
5. Verificar registro, creación de diagrama, colaboración, solicitud de acceso y generación de backend.

## 3. Manual de usuario

### 1. Registro e inicio de sesión

1. Abrir la aplicación y pulsar **Registrarse**.
2. Completar username, email y contraseña.
3. Confirmar el registro; la sesión se inicia automáticamente.
4. Si ya existe una cuenta, usar **Iniciar sesión** con username y contraseña.

El token JWT se guarda en el navegador y se usa en REST y WebSocket. Si la sesión expira, el sistema redirige al login.

### 2. Crear un diagrama

1. En el Dashboard, pulsar **+ Nuevo diagrama**.
2. Escribir el nombre en el modal y confirmar.
3. El editor se abre en `/diagram/<id>`.
4. El diagrama aparece en “Mis diagramas” con su rol, fecha y conteos.

Desde el menú **⋮** de la tarjeta se puede **Renombrar** o **Eliminar**; la eliminación solo aparece para el `OWNER`.

### 3. Agregar entidades y relaciones

1. Usar la paleta izquierda para arrastrar **Clase**, **Interfaz**, **Clase abstracta** o **Nota** al lienzo.
2. Hacer clic en una entidad para editar nombre, estereotipo, atributos y métodos.
3. Para conectar, seleccionar un tipo de relación en **Relaciones** y hacer clic en origen y destino.
4. Un clic en el mismo nodo crea un **self-loop**.
5. Arrastrar un nodo actualiza su posición y se sincroniza por Yjs.

### 4. Invitar a un colaborador (Fase 2A)

1. Abrir el diagrama como `OWNER`.
2. Pulsar **Miembros** en la barra superior.
3. Escribir el username del colaborador.
4. Elegir **Editor** o **Lector** e invitar.
5. El colaborador verá el diagrama en “Compartidos conmigo”.

Roles:

- **OWNER:** administra miembros, renombra y elimina.
- **EDITOR:** edita el diagrama, no elimina ni administra miembros.
- **VIEWER:** solo lectura.

### 5. Solicitar acceso a un diagrama (Fase 3)

1. Abrir un enlace `/diagram/<id>` sin permisos.
2. Pulsar **Solicitar Acceso**.
3. Esperar la confirmación “Solicitud enviada”.
4. El `OWNER` verá la solicitud en **Solicitudes pendientes** del Dashboard.
5. El `OWNER` pulsa **Aprobar**, elige `VIEWER` o `EDITOR`, y confirma.
6. El solicitante recarga el editor y accede con el rol concedido.

### 6. Usar el Agente IA

#### Texto

1. Abrir el chat **Chat IA**.
2. Escribir una pregunta o un comando, por ejemplo:
   - “¿Qué diferencia hay entre agregación y composición?”
   - “Crea la entidad Factura con id y total”.
3. Pulsar enviar o Enter.
4. La respuesta se publica en el chat colaborativo.

#### Voz

1. Pulsar el micrófono.
2. Hablar.
3. Detener la grabación.
4. El texto se transcribe y se envía automáticamente.

La transcripción requiere Groq Whisper y `GROQ_API_KEY`.

#### Motor de IA

En el encabezado del chat se puede elegir Groq u Ollama. El engranaje abre **Configuración Avanzada de IA**:

- **Groq:** rápido, requiere internet y la clave se configura en el backend.
- **Ollama:** local; indicar URL y modelo. El botón **Detectar** consulta los modelos instalados.

### 7. Generar el backend Spring Boot

1. Pulsar **Generar** en la barra superior.
2. El sistema convierte el canvas en AST.
3. Se valida el diagrama; si no hay entidades, se informa el error.
4. Se descarga un ZIP con:
   - `pom.xml`
   - `application.properties`
   - entidades, repositorios, servicios y controladores
   - DTO, seguridad, migración SQL y README
5. Descomprimir y ejecutar `mvn clean package`.

### 8. Buenas prácticas durante la demostración

- Confirmar que el backend esté en `/ready`.
- Verificar que el WebSocket muestre “Conectado”.
- Si se usa Ollama, probar **Detectar** antes de enviar comandos.
- Si se usa Groq, confirmar que `GROQ_API_KEY` esté configurada en Railway.
- No exponer claves en pantalla ni en el repositorio.

## 4. Conclusiones y trabajo futuro

### 1. Conclusiones

La Herramienta CASE Colaborativa con IA cumplió los objetivos planteados para el Segundo Parcial. Se consolidó una arquitectura frontend/backend desacoplada, con Next.js y React Flow en la interfaz, Node.js + Express en el servidor y Yjs como mecanismo de colaboración en tiempo real. La aplicación de una Clean Architecture pragmática permitió separar rutas, middleware, servicios, acceso a datos y tiempo real, reduciendo el acoplamiento y facilitando la verificación por capas.

La persistencia se resolvió con PostgreSQL en Neon, sectorizado en `auth`, `core` y `chat`. Esta decisión permitió separar identidad y permisos, metadatos/snapshots del diagrama e historial conversacional, manteniendo a Yjs como estado canónico del grafo y a PostgreSQL como fuente durable. Las transacciones atómicas, la carga previa del snapshot y la validación de ACL eliminaron riesgos de huérfanos y escrituras sobre documentos vacíos.

El Agente IA evolucionó de un generador de mutaciones a un tutor contextual capaz de explicar UML, interpretar el elemento seleccionado, recordar los últimos 15 mensajes y adaptar el tono al interlocutor. La incorporación del patrón Strategy permite alternar Groq y Ollama sin reiniciar el backend, mientras la configuración local se conserva en el navegador y la clave de Groq permanece en el servidor.

La generación automática de backend Spring Boot, la exportación/importación JSON/XMI, el dashboard con CRUD y las solicitudes de acceso completan un flujo de trabajo que reduce tareas repetitivas y mejora la productividad frente a un editor UML tradicional. El valor principal no está en una función aislada, sino en la integración coherente entre modelado, colaboración, tutoría, persistencia y generación de código.

### 2. Trabajo futuro

1. **Integración con más herramientas CASE y estándares:** exportación/importación directa con PlantUML, Enterprise Architect y SQL, además de una API pública versionada para intercambio de modelos.
2. **Modelos de IA más grandes y multimodales:** soporte para modelos locales de mayor capacidad, imágenes y audio con proveedores alternativos, manteniendo la configuración por usuario y las políticas de privacidad.
3. **Escalabilidad distribuida:** separar el servicio WebSocket/Yjs del API REST, usar un adaptador compartido de salas y desplegar en microservicios con observabilidad, métricas y trazas.

## 5. Glosario y bibliografía

### 1. Glosario

| Término | Definición |
|---|---|
| **CRDT** (Conflict-free Replicated Data Type) | Tipo de dato replicado cuyas operaciones son conmutativas, asociativas e idempotentes. Permite que varios clientes converjan sin coordinación central. En el proyecto se implementa con Yjs para nodos, aristas, chat y presencia. |
| **SSRF** (Server-Side Request Forgery) | Vulnerabilidad en la que un servidor realiza peticiones a destinos controlados por el usuario. En el proyecto se mitiga validando protocolo `http(s)`, host, credenciales y longitud de `ollamaUrl`. |
| **BYOK** (Bring Your Own Key) | Modelo de configuración en el que el usuario aporta sus credenciales o parámetros de proveedor. En esta aplicación el proveedor, URL y modelo de Ollama se guardan en el navegador; la clave de Groq permanece en el backend. |
| **Service Discovery** | Mecanismo por el cual un consumidor consulta el catálogo de servicios o recursos disponibles. El frontend consulta `GET /api/ai/ollama-models`, que a su vez descubre los modelos instalados mediante `/api/tags`. |
| **Clean Architecture** | Estilo arquitectónico que separa políticas de negocio y detalles de infraestructura mediante dependencias dirigidas hacia el dominio. En el backend se aplica de forma pragmática con rutas, servicios, acceso a datos y middleware transversal. |
| **PUDS / RUP** | Proceso Unificado de Desarrollo de Software, iterativo e incremental, dirigido por casos de uso, centrado en la arquitectura y orientado a riesgos. Se organiza en Inicio, Elaboración, Construcción y Transición. |
| **JWT** (JSON Web Token) | Token firmado que transporta claims de identidad. En la aplicación contiene `userId` y `username`, se verifica en REST y en el handshake WebSocket y no incluye `password_hash`. |
| **BCE** (Boundary-Control-Entity) | Patrón de análisis UML que separa la interfaz, la coordinación del caso de uso y el estado persistente. Se aplica al chat con `ChatPanel`, `useAICommand`/`aiService` y `chat.messages`. |
| **Yjs** | Implementación de CRDT para colaboración en tiempo real. El documento vivo contiene `Y.Map` de nodos/aristas y `Y.Array` de chat; PostgreSQL conserva snapshots binarios. |
| **ACL** (Access Control List) | Lista de control de acceso por diagrama. Los roles `OWNER`, `EDITOR` y `VIEWER` se almacenan en `auth.diagram_acl`. |

### 2. Bibliografía

Jacobson, I., Booch, G., & Rumbaugh, J. (1999). *The unified software development process*. Addison-Wesley.

Kleppmann, M. (2017). *Designing data-intensive applications: The big ideas behind reliable, scalable, and maintainable systems*. O’Reilly Media.

Pressman, R. S., & Maxim, B. R. (2020). *Software engineering: A practitioner’s approach* (9th ed.). McGraw-Hill Education.

Rumbaugh, J., Jacobson, I., & Booch, G. (2004). *The unified modeling language reference manual* (2nd ed.). Addison-Wesley.

Sommerville, I. (2016). *Software engineering* (10th ed.). Pearson.

Spring. (2024). *Spring Boot reference documentation*. https://docs.spring.io/spring-boot/

OWASP Foundation. (2024). *Server-side request forgery prevention cheat sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

Volver al [[00_Indice]].
