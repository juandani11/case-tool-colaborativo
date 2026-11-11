# Reporte de Auditoría de Base de Datos — Neon PostgreSQL

**Proyecto Neon:** `restobar-db` (`snowy-tooth-15591961`)  
**Rama:** `production` (`br-royal-king-b5yvjo53`)  
**Base de datos:** `neondb`  
**Motor:** PostgreSQL 18.6  
**Usuario de auditoría:** `neondb_owner`  
**Fecha de ejecución:** `2026-11-01T15:44:21.427Z`  
**Tipo de auditoría:** solo lectura (`SELECT`), sin modificaciones de datos.

---

## 1. Estructura general

La base contiene cuatro esquemas visibles: `auth`, `core`, `chat` y `public`. Los tres primeros pertenecen a la persistencia sectorizada de la Herramienta CASE Colaborativa. El esquema `public` contiene tablas de otro dominio de datos; se lista por completitud, pero no forma parte del modelo de la aplicación CASE.

| Esquema | Propietario | Tablas | Pertenencia |
|---|---|---|---|
| `auth` | `neondb_owner` | `users`, `diagram_acl` | Identidad y autorización |
| `core` | `neondb_owner` | `diagrams` | Diagramas y snapshots Yjs |
| `chat` | `neondb_owner` | `messages` | Historial del chat y memoria IA |
| `public` | `pg_database_owner` | 14 tablas | Dominio ajeno a CASE; no se audita su contenido |

### 1.1 Tablas por esquema

**Esquema `auth`**

| Tabla | Propósito |
|---|---|
| `auth.users` | Credenciales y datos de usuario; `password_hash` no se expone en este reporte |
| `auth.diagram_acl` | Roles `OWNER`, `EDITOR`, `VIEWER` por diagrama |

**Esquema `core`**

| Tabla | Propósito |
|---|---|
| `core.diagrams` | Metadatos, propietario y snapshot binario Yjs (`bytea`) |

**Esquema `chat`**

| Tabla | Propósito |
|---|---|
| `chat.messages` | Mensajes del usuario y del asistente; memoria contextual |

**Esquema `public`**

`Alerta`, `ArqueoCaja`, `Auditoria`, `Caja`, `DetallePedido`, `Ingrediente`, `Mesa`, `MovimientoCaja`, `MovimientoStock`, `Pedido`, `Producto`, `Receta`, `Usuario`, `_prisma_migrations`.

> **Observación:** el esquema `public` no contiene tablas de la Herramienta CASE. La aplicación utiliza exclusivamente `auth`, `core` y `chat`.

### 1.2 Columnas de las tablas principales

| Tabla | Columna | Tipo | Nulable | Default |
|---|---|---|---|---|
| `auth.users` | `id` | `uuid` | No | `uuid_generate_v4()` |
| `auth.users` | `username` | `varchar` | No | — |
| `auth.users` | `email` | `varchar` | No | — |
| `auth.users` | `password_hash` | `varchar` | No | — |
| `auth.users` | `created_at` | `timestamptz` | Sí | `CURRENT_TIMESTAMP` |
| `auth.diagram_acl` | `id` | `uuid` | No | `uuid_generate_v4()` |
| `auth.diagram_acl` | `diagram_id` | `varchar` | No | — |
| `auth.diagram_acl` | `user_id` | `uuid` | Sí | — |
| `auth.diagram_acl` | `role` | `varchar` | No | — |
| `auth.diagram_acl` | `granted_at` | `timestamptz` | Sí | `CURRENT_TIMESTAMP` |
| `core.diagrams` | `id` | `varchar` | No | — |
| `core.diagrams` | `name` | `varchar` | No | — |
| `core.diagrams` | `owner_id` | `uuid` | Sí | — |
| `core.diagrams` | `yjs_snapshot` | `bytea` | Sí | — |
| `core.diagrams` | `created_at` | `timestamptz` | Sí | `CURRENT_TIMESTAMP` |
| `core.diagrams` | `updated_at` | `timestamptz` | Sí | `CURRENT_TIMESTAMP` |
| `chat.messages` | `id` | `uuid` | No | `uuid_generate_v4()` |
| `chat.messages` | `diagram_id` | `varchar` | Sí | — |
| `chat.messages` | `author` | `varchar` | No | — |
| `chat.messages` | `role` | `varchar` | No | — |
| `chat.messages` | `content` | `text` | No | — |
| `chat.messages` | `created_at` | `timestamptz` | Sí | `CURRENT_TIMESTAMP` |

---

## 2. Conteo de registros

| Tabla | Filas |
|---|---:|
| `auth.users` | 3 |
| `core.diagrams` | 11 |
| `auth.diagram_acl` | 13 |
| `chat.messages` | 0 |

**Distribución de roles ACL:**

| Rol | Filas |
|---|---:|
| `OWNER` | 11 |
| `EDITOR` | 2 |
| `VIEWER` | 0 |

**Distribución de propietarios de diagramas:**

| Tipo de propietario | Diagramas |
|---|---:|
| Usuario técnico `anonymous` | 7 |
| Usuario humano | 4 |

---

## 3. Usuarios registrados

Se excluyó deliberadamente `password_hash` de la consulta y del reporte.

| ID | Username | Email | Creado |
|---|---|---|---|
| `40097070-2e88-45f5-93cb-5d374e6b8e75` | Juan | jdpa9429@gmail.com | `2026-09-22T01:58:12.060Z` |
| `f9a24f56-11eb-4f1f-b952-bdd4b043c1de` | Daniel | jdpa9430@gmail.com | `2026-09-22T02:47:03.317Z` |
| `00000000-0000-0000-0000-000000000001` | anonymous | anonymous@local.invalid | `2026-10-31T14:26:29.428Z` |

**Lectura:** existen dos usuarios humanos y un usuario técnico anónimo usado por el modo `AUTH_ENABLED=false`.

---

## 4. Diagramas registrados

| ID | Nombre | Owner ID | Creado |
|---|---|---|---|
| `diagram-1790039768510` | f | `00000000-0000-0000-0000-000000000001` | `2026-09-22T01:39:45.268Z` |
| `diagram-1` | Diagrama 1 | `00000000-0000-0000-0000-000000000001` | `2026-09-22T01:52:54.666Z` |
| `diagram-1790042312971-muept2` | Prueba | `40097070-2e88-45f5-93cb-5d374e6b8e75` | `2026-09-22T01:58:32.973Z` |
| `diagram-1790042588122-rvgjwo` | Nuevo diagrama | `40097070-2e88-45f5-93cb-5d374e6b8e75` | `2026-09-22T02:03:08.123Z` |
| `diagram-1790090269593-3658az` | Nuevo diagrama | `f9a24f56-11eb-4f1f-b952-bdd4b043c1de` | `2026-09-22T15:17:49.624Z` |
| `diagram-1790157097319-hdjb7m` | Nuevo diagrama | `40097070-2e88-45f5-93cb-5d374e6b8e75` | `2026-09-23T09:51:37.325Z` |
| `diagram-1788128131982` | Diagrama 2 | `00000000-0000-0000-0000-000000000001` | `2026-10-31T14:29:01.992Z` |
| `diagram-1788128550848` | Diagrama 1788128550848 | `00000000-0000-0000-0000-000000000001` | `2026-10-31T14:29:02.583Z` |
| `diagram-1788196084756` | Diagrama 1788196084756 | `00000000-0000-0000-0000-000000000001` | `2026-10-31T14:29:03.173Z` |
| `diagram-1788202305427` | Diagrama 1788202305427 | `00000000-0000-0000-0000-000000000001` | `2026-10-31T14:29:03.764Z` |
| `diagram-1790004303244` | Diagrama 1790004303244 | `00000000-0000-0000-0000-000000000001` | `2026-10-31T14:29:04.357Z` |

**Lectura:** los 11 diagramas tienen propietario y snapshot. La mayoría proviene de la migración legacy; los nombres genéricos corresponden a datos migrados.

---

## 5. Auditoría de integridad

### 5.1 Diagramas huérfanos

Un diagrama huérfano es una fila de `core.diagrams` sin ninguna fila asociada en `auth.diagram_acl`.

```sql
SELECT d.id, d.name, d.owner_id, d.created_at
FROM core.diagrams d
LEFT JOIN auth.diagram_acl a ON a.diagram_id = d.id
WHERE a.diagram_id IS NULL;
```

**Resultado:** 0 filas. No existen diagramas sin ACL.

### 5.2 ACL huérfanas

```sql
SELECT a.diagram_id, COUNT(*) AS acl_rows
FROM auth.diagram_acl a
LEFT JOIN core.diagrams d ON d.id = a.diagram_id
WHERE d.id IS NULL
GROUP BY a.diagram_id;
```

**Resultado:** 0 filas. No existen ACL que referencien diagramas inexistentes.

### 5.3 Consistencia del propietario

```sql
SELECT d.id, d.owner_id, a.role
FROM core.diagrams d
JOIN auth.diagram_acl a
  ON a.diagram_id = d.id AND a.user_id = d.owner_id
WHERE a.role <> 'OWNER';
```

**Resultado:** 0 filas. Todos los propietarios tienen rol `OWNER` en su diagrama.

### 5.4 Campos obligatorios y snapshot

| Verificación | Resultado |
|---|---:|
| Diagramas sin `owner_id` | 0 |
| ACL sin `user_id` | 0 |
| Diagramas sin `yjs_snapshot` | 0 |

### 5.5 Claves foráneas detectadas

| Tabla origen | Columna | Tabla destino | Regla de borrado |
|---|---|---|---|
| `auth.diagram_acl` | `user_id` | `auth.users(id)` | `CASCADE` |
| `chat.messages` | `diagram_id` | `core.diagrams(id)` | `CASCADE` |
| `core.diagrams` | `owner_id` | `auth.users(id)` | `CASCADE` |

**Observación:** `auth.diagram_acl.diagram_id` no tiene FK física a `core.diagrams`. La integridad se mantiene en la capa de servicio: `deleteDiagram` elimina ACL y diagrama dentro de una transacción. Esta es una desviación conocida y documentada.

---

## 6. Conclusión de la auditoría

| Criterio | Estado |
|---|---|
| Sectorización `auth` / `core` / `chat` | Correcta |
| Persistencia de usuarios | Correcta |
| Persistencia de diagramas y snapshots | Correcta: 11/11 con snapshot |
| Persistencia de ACL | Correcta: 13 filas, 11 `OWNER` y 2 `EDITOR` |
| Diagramas huérfanos | 0 |
| ACL huérfanas | 0 |
| Propietarios con rol distinto de `OWNER` | 0 |
| Mensajes de chat persistidos | 0 (sin actividad de chat en el estado auditado) |
| Modificaciones realizadas por la auditoría | Ninguna |

**Veredicto:** la persistencia sectorizada en Neon es consistente para usuarios, diagramas y ACL. No se detectaron diagramas huérfanos ni inconsistencias de propiedad. El historial de chat está vacío en el momento de la auditoría; esto no invalida el esquema, pero debe considerarse al presentar evidencia de memoria conversacional.

---

## Anexo: consultas ejecutadas

Todas las consultas fueron de solo lectura. Las principales fueron:

```sql
-- Esquemas
SELECT n.nspname AS schema_name, pg_get_userbyid(n.nspowner) AS owner
FROM pg_namespace n
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
ORDER BY n.nspname;

-- Tablas
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema IN ('auth','core','chat','public')
ORDER BY table_schema, table_name;

-- Conteos
SELECT 'auth.users' AS table_name, COUNT(*)::bigint AS row_count FROM auth.users
UNION ALL SELECT 'core.diagrams', COUNT(*)::bigint FROM core.diagrams
UNION ALL SELECT 'auth.diagram_acl', COUNT(*)::bigint FROM auth.diagram_acl
UNION ALL SELECT 'chat.messages', COUNT(*)::bigint FROM chat.messages
ORDER BY table_name;

-- Usuarios sin password_hash
SELECT id, username, email, created_at
FROM auth.users
ORDER BY created_at, username;

-- Diagramas
SELECT id, name, owner_id, created_at
FROM core.diagrams
ORDER BY created_at, id;

-- Diagramas huérfanos
SELECT d.id, d.name, d.owner_id, d.created_at
FROM core.diagrams d
LEFT JOIN auth.diagram_acl a ON a.diagram_id = d.id
WHERE a.diagram_id IS NULL;
```
