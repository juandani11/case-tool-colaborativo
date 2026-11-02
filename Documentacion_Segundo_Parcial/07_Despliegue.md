# Guía de Despliegue

## 1. Arquitectura de despliegue

| Nodo | Plataforma | Artefacto |
|---|---|---|
| Frontend | Vercel | Next.js 16 (App Router) |
| Backend | Railway | Node.js + Express + `y-websocket` |
| Base de datos | Neon | PostgreSQL 18 sectorizado |
| IA cloud | Groq | API compatible con OpenAI |
| IA local | Ollama | Servicio local o túnel Ngrok |

## 2. Frontend en Vercel

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

## 3. Backend en Railway

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

## 4. Base de datos en Neon

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

## 5. IA local con Ollama

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

## 6. Seguridad operativa

- Las claves `GROQ_API_KEY`, `JWT_SECRET` y `DATABASE_URL` **nunca** se suben al repositorio.
- `.env` y `.env.local` están ignorados por Git.
- Las variables reales se configuran en Railway, Vercel o Neon.
- La URL de Ollama se valida para aceptar solo `http://` o `https://`, sin credenciales embebidas.
- Si una clave se expone, debe rotarse antes de continuar.

## 7. Orden de despliegue recomendado

1. Crear la base en Neon y aplicar el DDL.
2. Desplegar el backend en Railway y verificar `/health` y `/ready`.
3. Desplegar el frontend en Vercel con las URLs del backend.
4. Configurar Groq en el backend o Ollama en el equipo local.
5. Verificar registro, creación de diagrama, colaboración, solicitud de acceso y generación de backend.

Volver al [[00_Indice]].
