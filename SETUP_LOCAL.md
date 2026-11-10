# SETUP LOCAL — Herramienta CASE Colaborativa

Guía para levantar el proyecto en una máquina limpia: PostgreSQL/Neon, backend Node.js, frontend Next.js y pruebas básicas de autenticación, diagramas e IA.

> **Importante:** `.env` y `.env.local` no se versionan. No subas claves reales. Si ya existe un `backend/.env.local`, sus valores tienen prioridad sobre `backend/.env` porque `backend/loadEnv.js` carga primero `.env.local` y después `.env`.

---

## 1. Requisitos

### Obligatorios

| Herramienta | Versión mínima | Versión probada | Nota |
|---|---:|---:|---|
| Node.js | `20.9.0` | `24.16.0` | Next.js 16 declara `engines.node >=20.9.0`. |
| npm | `10.x` | `11.13.0` | Los `package-lock.json` usan `lockfileVersion: 3`. |
| Git | reciente | — | Para clonar el repo. |
| Docker Desktop o Docker Engine | reciente | `29.5.3` | Solo si usarás PostgreSQL local. |
| PostgreSQL | `14+` | `16` | Si no usas Docker, instala localmente. |
| Navegador moderno | — | Chrome/Edge/Firefox | Requiere WebSocket y `localStorage`. |

### Opcionales

| Herramienta | Versión | Para qué |
|---|---:|---|
| Java JDK | `21` | Compilar el backend Spring Boot generado. |
| Maven | `3.9+` | `mvn clean package -DskipTests` del backend generado. |
| Ollama | reciente | IA local si no usas Groq. |
| Cuenta Groq | — | IA en la nube; requiere `GROQ_API_KEY`. |
| Cuenta Neon | — | PostgreSQL gestionado alternativo a Docker. |

### No se necesita

- Redis.
- Prisma/TypeORM.
- Un servidor separado para WebSocket: usa el mismo puerto `1234`.
- `psql` instalado en el host si usas Docker (se ejecuta dentro del contenedor).

Comprobación rápida:

```powershell
node -v
npm -v
docker --version
```

Resultado esperado (ejemplo):

```text
v24.16.0
11.13.0
Docker version 29.5.3, build ...
```

---

## 2. Base de Datos

El backend usa PostgreSQL con tres esquemas:

- `auth`: usuarios, ACL y solicitudes de acceso.
- `core`: diagramas y snapshot binario de Yjs.
- `chat`: historial de mensajes de IA.

### Opción A — PostgreSQL local con Docker (recomendada)

Ejecuta este comando exacto:

```powershell
docker run --name case-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=case_tool -p 5432:5432 -v case_pgdata:/var/lib/postgresql/data -d postgres:16
```

Explicación:

- `case-postgres`: nombre del contenedor.
- `POSTGRES_USER=postgres` / `POSTGRES_PASSWORD=postgres`: credenciales locales.
- `POSTGRES_DB=case_tool`: crea la base automáticamente.
- `-p 5432:5432`: expone PostgreSQL en `localhost:5432`.
- `-v case_pgdata:/var/lib/postgresql/data`: conserva datos al reiniciar el contenedor.
- `postgres:16`: imagen usada.

Verifica que esté listo:

```powershell
docker ps --filter name=case-postgres
docker exec -it case-postgres pg_isready -U postgres -d case_tool
```

Si el puerto `5432` está ocupado, usa `-p 5433:5432` y cambia la URL a `localhost:5433`.

### Opción B — Neon

1. Crea un proyecto en Neon.
2. Copia la cadena de conexión (usa la cadena directa o la pooled, según tu configuración).
3. En el SQL Editor de Neon, ejecuta el DDL de la sección 2.2.
4. Usa una URL con `sslmode=require`:

```text
postgresql://USUARIO:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Si tu contraseña tiene caracteres especiales (`@`, `#`, `:`, `/`), codifícala en URL. No pegues una cadena real en Git.

### 2.1. `DATABASE_URL` exacta

**Docker local:**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/case_tool
```

**Neon:**

```env
DATABASE_URL=postgresql://USUARIO:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> `backend/db.js` solo activa SSL si la cadena contiene `sslmode=require`. No agregues `sslmode=require` a Docker local salvo que hayas configurado TLS.

### 2.2. DDL exacto

El siguiente DDL coincide con las consultas de:

- `backend/services/userService.js`
- `backend/services/diagramService.js`
- `backend/services/aclService.js`
- `backend/services/chatService.js`
- `backend/services/accessRequestService.js`
- `backend/scripts/migrate-json-to-postgres.js`

Ejecútalo completo en la base `case_tool`. La extensión `uuid-ossp` es necesaria porque el esquema usa `uuid_generate_v4()`.

```sql
-- Extension para uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Esquemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS chat;

-- Usuarios
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar NOT NULL UNIQUE,
  email varchar NOT NULL UNIQUE,
  password_hash varchar NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Diagramas (el grafo vive en yjs_snapshot)
CREATE TABLE core.diagrams (
  id varchar PRIMARY KEY,
  name varchar NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  yjs_snapshot bytea,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- ACL por diagrama: rol OWNER/EDITOR/VIEWER
CREATE TABLE auth.diagram_acl (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  granted_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (diagram_id, user_id)
);

-- Historial de chat por diagrama
CREATE TABLE chat.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar REFERENCES core.diagrams(id) ON DELETE CASCADE,
  author varchar NOT NULL,
  role varchar NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Solicitudes de acceso (Fase 3)
CREATE TABLE auth.access_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id varchar NOT NULL REFERENCES core.diagrams(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Una sola solicitud PENDING por usuario y diagrama
CREATE UNIQUE INDEX access_requests_pending_unique
  ON auth.access_requests (diagram_id, requester_id)
  WHERE status = 'PENDING';

CREATE INDEX access_requests_diagram_status_idx
  ON auth.access_requests (diagram_id, status);

CREATE INDEX access_requests_requester_idx
  ON auth.access_requests (requester_id);
```

> **Nota de diseño:** `auth.diagram_acl.diagram_id` no tiene FK física hacia `core.diagrams.id` en este esquema. La integridad se mantiene en `diagramService.deleteDiagram` con una transacción que borra primero la ACL y luego el diagrama.

### 2.3. Ejecutar el DDL

**Docker, forma interactiva:**

```powershell
docker exec -it case-postgres psql -U postgres -d case_tool
```

Dentro de `psql`, pega el bloque DDL completo y termina con `\q`.

**Docker, desde archivo (Linux/macOS/Git Bash):**

```bash
docker exec -i case-postgres psql -U postgres -d case_tool < init.sql
```

**Neon:**

1. Abre **SQL Editor**.
2. Selecciona la base `neondb` (o la que hayas creado).
3. Pega el DDL completo y ejecuta.

### 2.4. Verificar tablas

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('auth', 'core', 'chat')
ORDER BY table_schema, table_name;
```

Debes ver:

```text
auth    access_requests
auth    diagram_acl
auth    users
chat    messages
core    diagrams
```

También puedes usar:

```text
\dt auth.*
\dt core.*
\dt chat.*
```

### 2.5. Datos iniciales

No necesitas insertar usuarios manualmente:

- `initializeDatabase()` en `backend/db.js` crea el usuario técnico `anonymous` si no existe.
- El registro normal crea usuarios reales con bcrypt.
- Si quieres migrar los JSON antiguos de `backend/data/`, ejecuta después:

```powershell
cd backend
npm run migrate-json
```

Esto es opcional. No borra los JSON originales.

---

## 3. Variables de Entorno

### 3.1. Backend: `backend/.env`

Copia el ejemplo:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edita `backend/.env` con estos valores funcionales:

```env
# ── PostgreSQL local ─────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/case_tool

# ── Servidor ─────────────────────────────────────────────────────
PORT=1234

# ── Autenticación JWT ────────────────────────────────────────────
AUTH_ENABLED=true
JWT_SECRET=reemplaza-esto-por-un-secreto-de-64-caracteres-generado-con-node
JWT_EXPIRATION=7d

# ── IA en la nube (Groq) ─────────────────────────────────────────
AI_PROVIDER=groq
GROQ_API_KEY=tu_api_key_de_groq
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=qwen/qwen3.8-27b

# ── IA local (Ollama, opcional) ──────────────────────────────────
OLLAMA_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3
# OLLAMA_VISION_MODEL=llava

# ── Pool PostgreSQL (opcional) ───────────────────────────────────
# PG_POOL_MAX=10
```

Genera un `JWT_SECRET` real:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y pégalo en `JWT_SECRET`. Debe tener al menos 32 caracteres; el ejemplo genera 64 hexadecimales.

**Si usas Neon**, cambia solo:

```env
DATABASE_URL=postgresql://USUARIO:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Si usas Ollama**, cambia:

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3
```

`GROQ_API_KEY` puede quedar vacío si `AI_PROVIDER=ollama`.

### 3.2. Frontend: `frontend/.env.local`

Crea el archivo:

```powershell
New-Item -ItemType File -Path frontend\.env.local -Force
```

Contenido exacto:

```env
NEXT_PUBLIC_API_URL=http://localhost:1234
NEXT_PUBLIC_WS_URL=ws://localhost:1234
```

Explicación:

- `NEXT_PUBLIC_API_URL`: base para `fetch` REST. `apiClient.ts` le agrega `/api/...`.
- `NEXT_PUBLIC_WS_URL`: base del WebSocket. `useCollaborativeFlow` le pasa la sala `diagram-room-<id>`.
- No pongas una barra final: `http://localhost:1234`, no `http://localhost:1234/`.
- Si el backend está en otro host, usa su URL pública. Si el frontend está en HTTPS, el WS debe ser `wss://`.

> Las variables `NEXT_PUBLIC_*` son visibles en el navegador. Nunca pongas secretos ahí.

### 3.3. Prioridad de archivos

`backend/loadEnv.js`:

```javascript
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
```

`dotenv` no sobreescribe variables ya definidas. Por eso:

1. Variables del proceso (`$env:DATABASE_URL`) ganan.
2. `backend/.env.local` gana sobre `backend/.env`.
3. `backend/.env` es el fallback.

Si tienes un `.env.local` viejo apuntando a otra base, bórralo o actualízalo. No lo commitees.

---

## 4. Instalación

Desde la raíz del repo:

### Backend

```powershell
cd backend
npm ci
```

Si no existe `package-lock.json` o estás actualizando dependencias:

```powershell
npm install
```

### Frontend

```powershell
cd frontend
npm ci
```

Alternativa:

```powershell
npm install
```

> `npm ci` es preferible en una máquina limpia porque respeta exactamente `package-lock.json`.

### Verificación opcional

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

```powershell
cd backend
node --check server.js
node --check app.js
node --check realtime/yjs.js
```

---

## 5. Ejecución

Usa dos terminales separadas.

### Terminal 1 — Backend

```powershell
cd backend
npm start
```

Salida esperada:

```text
Servidor escuchando en el puerto 1234
```

Si la base no está disponible, el proceso sale con un mensaje como:

```text
No se pudo inicializar PostgreSQL: ...
```

En ese caso revisa `DATABASE_URL`, que el contenedor esté corriendo y que el DDL se haya ejecutado.

### Terminal 2 — Frontend

```powershell
cd frontend
npm run dev
```

Salida esperada:

```text
 ▲ Next.js 16.3.3
 - Local: http://localhost:3000
```

Abre:

```text
http://localhost:3000
```

### Orden recomendado

1. Levantar PostgreSQL.
2. Ejecutar DDL.
3. Configurar `backend/.env`.
4. Configurar `frontend/.env.local`.
5. `npm ci` en backend y frontend.
6. `npm start` en backend.
7. `npm run dev` en frontend.

---

## 6. Pruebas Básicas

### 6.1. Health y readiness

```powershell
Invoke-RestMethod http://localhost:1234/health
```

Esperado:

```text
OK
```

```powershell
Invoke-RestMethod http://localhost:1234/ready
```

Esperado:

```json
{ "ok": true }
```

Si `/ready` devuelve 503, PostgreSQL no responde.

### 6.2. Crear usuario

```powershell
$body = @{
  username = "demo"
  email    = "demo@example.com"
  password = "demo1234"
} | ConvertTo-Json

$register = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:1234/api/auth/register `
  -ContentType "application/json" `
  -Body $body

$token = $register.token
$register.user
```

Esperado: un objeto `user` con `id`, `username`, `email` y un `token` JWT. No debe aparecer `passwordHash`.

Si el usuario ya existe, cambia `username`/`email` o elimina la fila correspondiente.

### 6.3. Login

```powershell
$loginBody = @{
  username = "demo"
  password = "demo1234"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:1234/api/auth/login `
  -ContentType "application/json" `
  -Body $loginBody

$token = $login.token
```

### 6.4. Crear diagrama

```powershell
$headers = @{ Authorization = "Bearer $token" }

$diagram = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:1234/api/diagrams `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ name = "Diagrama de prueba" } | ConvertTo-Json)

$diagram
```

Esperado:

```json
{ "id": "diagram-...", "name": "Diagrama de prueba" }
```

Abre el editor:

```text
http://localhost:3000/diagram/<id-del-diagrama>
```

### 6.5. Verificar el diagrama por REST

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:1234/api/diagrams/$($diagram.id)" `
  -Headers $headers
```

Esperado:

```json
{
  "name": "Diagrama de prueba",
  "nodes": [],
  "edges": [],
  "chat": []
}
```

El grafo real no viene por REST: se carga desde `yjs_snapshot` por WebSocket.

### 6.6. Probar colaboración en tiempo real

1. Abre el mismo diagrama en dos pestañas o dos navegadores.
2. Inicia sesión con el mismo usuario o con dos usuarios con acceso.
3. Mueve una clase en una pestaña.
4. Debe moverse en la otra.
5. Si no ocurre, revisa `NEXT_PUBLIC_WS_URL`, el token y la consola del navegador.

### 6.7. Probar la IA

Con `AI_PROVIDER=groq` y `GROQ_API_KEY` configurada:

```powershell
$aiBody = @{
  command        = "Crea una clase Pedido con id UUID y total BigDecimal"
  currentState   = @{ entities = @(); relationships = @() }
  diagramId      = $diagram.id
  selectedElement = $null
  provider       = "groq"
} | ConvertTo-Json -Depth 10

$ai = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:1234/api/ai/command `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $aiBody

$ai
```

Esperado:

- `response`: texto dirigido al usuario.
- `mutations`: una o más acciones `addEntity`, `addAttribute`, `addRelationship`.
- `username`: el usuario del JWT.
- `chatEmitted`: `true` si la respuesta se publicó en Yjs.

Si no hay `GROQ_API_KEY`, el backend responde `503` con un mensaje controlado. Eso es esperado, no un crash.

### 6.8. Probar XMI y generación de backend

Desde la UI del editor:

1. Abre el menú de exportación.
2. Exporta XMI.
3. Importa el `.xmi` en Enterprise Architect.
4. Verifica clases, relaciones, multiplicidades y codos.

Para generar el backend:

1. En el editor, usa la acción de generar backend.
2. Descarga el ZIP.
3. Descomprime.
4. Opcional, si tienes Java 21 y Maven:

```powershell
mvn clean package -DskipTests
```

### 6.9. Pruebas automáticas útiles

Generador (no requieren PostgreSQL):

```powershell
node backend/generator/tests/inheritance.test.js
node backend/generator/tests/association-class.test.js
```

Frontend:

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

> `association-class.test.js` compila archivos del frontend con `tsc` y puede tardar. No requiere que el backend esté levantado.

---

## 7. Problemas comunes

### `DATABASE_URL no está configurada`

El backend no encontró la variable. Revisa que `backend/.env` exista y que estés ejecutando `npm start` desde `backend/`.

### `relation "auth.users" does not exist`

El DDL no se ejecutó o se ejecutó en otra base. Verifica con:

```sql
SELECT current_database();
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_schema IN ('auth','core','chat');
```

### `function uuid_generate_v4() does not exist`

Falta la extensión:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

En Neon, ejecútalo en el SQL Editor con un rol propietario.

### `ECONNREFUSED 127.0.0.1:5432`

PostgreSQL no está corriendo o el puerto es distinto. Verifica:

```powershell
docker ps --filter name=case-postgres
docker exec -it case-postgres pg_isready -U postgres -d case_tool
```

### `password authentication failed`

La URL no coincide con las credenciales del contenedor. Para el comando Docker de esta guía debe ser:

```text
postgresql://postgres:postgres@localhost:5432/case_tool
```

### `JWT_SECRET no configurado o muy corto`

Genera uno nuevo:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

y reinicia el backend.

### El frontend no conecta al backend

Revisa `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:1234
NEXT_PUBLIC_WS_URL=ws://localhost:1234
```

Reinicia `npm run dev` después de cambiarlas; Next.js las lee al arrancar.

### El WebSocket cierra con 4401/4403/4404

- `4401`: token faltante o inválido.
- `4403`: sin acceso al diagrama o sala desconocida.
- `4404`: diagrama no encontrado en `core.diagrams`.

Revisa login, ACL y que el diagrama exista.

### La IA responde 503

- `AI_PROVIDER=groq` sin `GROQ_API_KEY`: configura la key o cambia a Ollama.
- `AI_PROVIDER=ollama` y Ollama apagado: ejecuta `ollama serve` y verifica `http://localhost:11434`.
- URL de Ollama en la nube con `localhost`: usa una URL pública (Ngrok) o Groq.

### Next.js falla por versión de Node

Next.js 16 exige Node `>=20.9.0`. Actualiza Node; no intentes forzar una versión anterior.

---

## 8. Resumen mínimo

```powershell
# 1. Base de datos
docker run --name case-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=case_tool -p 5432:5432 -v case_pgdata:/var/lib/postgresql/data -d postgres:16

# 2. DDL: pegar el bloque de la sección 2.2
docker exec -it case-postgres psql -U postgres -d case_tool

# 3. Backend
cd backend
Copy-Item .env.example .env
# editar DATABASE_URL, JWT_SECRET y GROQ_API_KEY
npm ci
npm start

# 4. Frontend (otra terminal)
cd frontend
# crear .env.local con NEXT_PUBLIC_API_URL y NEXT_PUBLIC_WS_URL
npm ci
npm run dev

# 5. Abrir
# http://localhost:3000
```
