# Reporte de Ingeniería Inversa: Modelo Lógico Real

**Fase:** 1 — Investigación y reporte previo a la creación del diagrama EA.  
**Fuentes revisadas:** `backend/scripts/access_requests.sql`, `backend/services/userService.js`, `aclService.js`, `diagramService.js`, `chatService.js`, `accessRequestService.js`, `backend/realtime/yjs.js`, `backend/db.js`, `backend/generator/templates/model.java.hbs`, `04_Diseno_UML.md`.

## 1. Hallazgo principal

El esquema real de la herramienta **no** contiene tablas `Project`, `Class` ni `Relation`. El modelo físico implementado en PostgreSQL/Neon es:

```text
auth.users
auth.diagram_acl
auth.access_requests
core.diagrams
chat.messages
```

El lienzo colaborativo no se normaliza en filas de clases y relaciones: se guarda como un documento CRDT binario en `core.diagrams.yjs_snapshot` de tipo `BYTEA`.

## 2. Tablas reales y columnas

### `auth.users`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `username` | `varchar` | `NOT NULL`, `UNIQUE` |
| `email` | `varchar` | `NOT NULL`, `UNIQUE` |
| `password_hash` | `varchar` | `NOT NULL` |
| `created_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

No existe columna `rol` en `auth.users`. El rol es por diagrama y vive en `auth.diagram_acl`.

### `auth.diagram_acl`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `diagram_id` | `varchar` | `NOT NULL`; **sin FK física** en el DDL entregado |
| `user_id` | `uuid` | FK a `auth.users(id)` con `ON DELETE CASCADE` |
| `role` | `varchar` | `NOT NULL`, CHECK `OWNER/EDITOR/VIEWER` |
| `granted_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

Restricción única: `(diagram_id, user_id)`.

> La integridad de `diagram_id` se garantiza en `deleteDiagram` mediante una transacción que elimina primero la ACL y luego el diagrama. No es una FK física.

### `auth.access_requests`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `diagram_id` | `varchar` | `NOT NULL`, FK a `core.diagrams(id)` con `ON DELETE CASCADE` |
| `requester_id` | `uuid` | `NOT NULL`, FK a `auth.users(id)` con `ON DELETE CASCADE` |
| `status` | `varchar` | `NOT NULL`, `DEFAULT 'PENDING'`, CHECK `PENDING/APPROVED/REJECTED` |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

Índices:
- único parcial `(diagram_id, requester_id) WHERE status = 'PENDING'`;
- índice `(diagram_id, status)`;
- índice `(requester_id)`.

### `core.diagrams`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `varchar` | PK (generado por la aplicación, ej. `diagram-...`) |
| `name` | `varchar` | `NOT NULL` |
| `owner_id` | `uuid` | FK a `auth.users(id)` con `ON DELETE CASCADE` |
| `yjs_snapshot` | `bytea` | Estado binario del CRDT Yjs |
| `created_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

### `chat.messages`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT uuid_generate_v4()` |
| `diagram_id` | `varchar` | FK a `core.diagrams(id)` con `ON DELETE CASCADE` |
| `author` | `varchar` | `NOT NULL` |
| `role` | `varchar` | `NOT NULL`, CHECK `user/assistant/system` |
| `content` | `text` | `NOT NULL` |
| `created_at` | `timestamptz` | `DEFAULT CURRENT_TIMESTAMP` |

## 3. Relaciones reales

| Origen | Destino | FK física |
|---|---|---|
| `core.diagrams.owner_id` | `auth.users.id` | Sí, `ON DELETE CASCADE` |
| `auth.diagram_acl.user_id` | `auth.users.id` | Sí, `ON DELETE CASCADE` |
| `auth.access_requests.requester_id` | `auth.users.id` | Sí, `ON DELETE CASCADE` |
| `auth.access_requests.diagram_id` | `core.diagrams.id` | Sí, `ON DELETE CASCADE` |
| `chat.messages.diagram_id` | `core.diagrams.id` | Sí, `ON DELETE CASCADE` |
| `auth.diagram_acl.diagram_id` | `core.diagrams.id` | **No**; integridad en servicio/transacción |

## 4. Diferencia con el modelo ideal

| Modelo ideal | Modelo real |
|---|---|
| Tabla `Project` | No existe; proyecto es una abstracción de `auth.users + core.diagrams` |
| Tabla `Class` | No existe; las clases viven dentro del snapshot Yjs |
| Tabla `Relation` | No existe; las relaciones viven dentro del snapshot Yjs |
| `User.rol` | El rol es por diagrama en `auth.diagram_acl` |
| `Diagram` con muchos `Class` y `Relation` | `core.diagrams.yjs_snapshot BYTEA` contiene el CRDT completo |
| Multiplicidades relacionales clásicas | ACL normalizada + snapshot binario |

## 5. Por qué el modelo real es superior

1. **Sectorización:** `auth` separa identidad/ACL, `core` guarda el ciclo de vida del diagrama y `chat` conserva el historial de IA. Cada esquema tiene una responsabilidad clara.
2. **BYTEA para Yjs:** normalizar cada clase y relación generaría miles de filas y rompería la semántica del CRDT (relojes lógicos e identificadores internos). El snapshot binario preserva la colaboración en tiempo real.
3. **Rendimiento:** la escritura del snapshot usa debounce de 2 segundos, no una escritura por cada clic.
4. **Integridad:** las relaciones durables (usuarios, ACL, chat) usan FKs reales; el grafo colaborativo queda como documento opaco.
5. **Auditoría:** `chat.messages` y `auth.access_requests` sí se normalizan porque requieren consultas y trazabilidad.

> **Corrección importante:** no se encontraron columnas `JSON` ni `JSONB` para atributos. El modelo real no usa JSON para los atributos del lienzo; usa `BYTEA` para el CRDT y columnas relacionales para las tablas normalizadas.

## 6. Generador Spring Boot

`backend/generator/templates/model.java.hbs` no forma parte del esquema Neon de la herramienta. El generador produce un proyecto Spring Boot independiente a partir del AST del usuario:

- `@Entity` y `@Table(name = "{{tableName}}")` por entidad.
- `@Id` con `@GeneratedValue` para UUID o PK numérica, y PK natural sin generación cuando corresponde.
- `@Column`, `@ManyToOne`, `@OneToMany`, `@Inheritance(JOINED)` y `@PrimaryKeyJoinColumn` según el diagrama.
- `application.properties` generado con `spring.jpa.hibernate.ddl-auto=update` y `auto_quote_keyword=true`.

Por tanto, las tablas `Cliente`, `Pedido`, etc. se crean dinámicamente en la base del **backend generado**, no en la base Neon de la herramienta CASE.

## 7. Propuesta para la Fase 2 en EA

Diagrama: `05_Modelo_Logico_Real_Codigo`.

Tablas a dibujar:
- `auth.users`
- `auth.diagram_acl`
- `auth.access_requests`
- `core.diagrams`
- `chat.messages`

Contenedores de esquema:
- `Schema: auth`
- `Schema: core`
- `Schema: chat`

Relaciones a dibujar:
- `users → diagram_acl` por `user_id`.
- `users → access_requests` por `requester_id`.
- `users → diagrams` por `owner_id`.
- `diagrams → access_requests` por `diagram_id`.
- `diagrams → messages` por `diagram_id`.
- `diagrams → diagram_acl` por `diagram_id` como **relación lógica**, no FK física.

Además, crear un paquete separado `Backend Generado` para mostrar que `Cliente`, `Pedido`, etc. se generan dinámicamente desde el AST y no pertenecen al esquema Neon de la herramienta.

**Estado:** Fase 1 completada. No se ha creado todavía `05_Modelo_Logico_Real_Codigo` en EA.
