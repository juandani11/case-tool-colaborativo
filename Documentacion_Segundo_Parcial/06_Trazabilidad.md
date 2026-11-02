# Matriz de Trazabilidad

## 1. Propósito

La matriz demuestra que cada caso de uso tiene un componente de interfaz, un endpoint o función de backend, una tabla de persistencia y una evidencia de verificación. Se incluyen dos filas adicionales para las capacidades transversales de Fase 3: solicitudes de acceso y configuración del motor de IA.

## 2. Matriz principal

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

## 3. Trazabilidad de pruebas

| Evidencia | Cobertura |
|---|---|
| `AUDIT_QA_FULL.md` | Auth, ACL, Yjs, generador, JSON/XMI y cascadas |
| `AUDIT_FUZZ_GENERATOR.md` | Nombres extremos, keywords, acentos, ñ y compilación Java 21 |
| `AUDIT_AI_MASTER.md` | 15 escenarios de tutoría, contexto y seguridad |
| `AUDIT_QA.md` | Tutoría contextual, self-loop, nombres y posiciones |

## 4. Criterio de cierre

No existe un caso de uso sin componente, endpoint o evidencia. Las capacidades de Fase 3 quedaron integradas en la misma matriz para evitar documentación huérfana.

Volver al [[00_Indice]].
