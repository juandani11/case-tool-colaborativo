# Propuesta de Diseño Detalle Procedimental (PUDS)

**Fase:** 1 — Investigación y propuesta  
**Estado:** Pendiente de aprobación; no se ha creado ningún diagrama en Enterprise Architect.  
**Fuentes revisadas:** `backend/routes/`, `backend/services/`, `backend/generator/`, `backend/realtime/`, `frontend/src/hooks/`, `frontend/src/components/`, `frontend/src/app/` y `Documentacion_Segundo_Parcial/01_Requisitos_y_Proceso.md`.

## 1. Criterios de la propuesta

- Se respeta la estructura real de EA: `/Model/FT: Diseño/Diagrama de Clases/CU1…CU8`.
- Cada CU tendrá un diagrama de clases `DP_*` dentro de su paquete existente.
- Las dependencias se dibujarán de izquierda a derecha:
  `<<view>> → <<controller>> → <<service>> → <<repository>>`.
- El código actual usa módulos funcionales, no clases de repositorio separadas. En el diagrama, `<<repository>>` representa la capa de acceso a PostgreSQL o a Yjs; la fuente real se indica en cada CU.
- Los métodos se presentan como firmas de diseño; los nombres corresponden a funciones reales del código cuando existen.

## 2. Resumen de los 8 diagramas

| CU | Paquete EA | PackageID | Diagrama propuesto | Cadena principal |
|---|---|---:|---|---|
| CU1 | CU1 Registrarse | 29 | `DP_CU1_Registrarse` | RegisterView → AuthController → UserService → UserRepository |
| CU2 | CU2 Iniciar sesión | 30 | `DP_CU2_IniciarSesion` | LoginView → AuthController → UserService → UserRepository |
| CU3 | CU3 Gestionar diagramas | 31 | `DP_CU3_GestionarDiagramas` | DashboardView → DiagramController → DiagramService → DiagramRepository |
| CU4 | CU4 Modelar diagrama colaborativamente | 32 | `DP_CU4_ModelarColaborativamente` | EditorView → CollaborationGateway → CollaborationService → YjsDocument |
| CU5 | CU5 Gestionar colaboradores | 33 | `DP_CU5_GestionarColaboradores` | MembersView → AclController → AclService → AclRepository |
| CU6 | CU6 Usar asistente de IA | 34 | `DP_CU6_UsarAsistenteIA` | ChatView → AiCommandController → AiController → AiService → ChatService |
| CU7 | CU7 Exportar/Importar diagrama | 35 | `DP_CU7_ExportarImportar` | ToolbarView → DiagramIoController → XmiExporter/XmiImporter → YjsGraphRepository |
| CU8 | CU8 Generar backend Spring Boot | 36 | `DP_CU8_GenerarBackend` | ToolbarView → GeneratorController → GeneratorService → TemplateEngine/FileSystemRepository |

---

## 3. CU1 Registrarse

**Dependencia:** RegisterView → AuthController → UserService → UserRepository; AuthController → JwtService.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `RegisterView` | `<<view>>` | `+onSubmit(username, email, password, confirm): void`<br>`+validatePasswords(): boolean`<br>`+showError(message): void` | `frontend/src/app/register/page.tsx` |
| `AuthController` | `<<controller>>` | `+register(dto): Promise<AuthResponse>`<br>`+signSession(user): string` | `backend/routes/auth.js` |
| `UserService` | `<<service>>` | `+createUser(dto): Promise<User>`<br>`+findByUsername(username): Promise<User \| null>`<br>`+findByEmail(email): Promise<User \| null>` | `backend/services/userService.js` |
| `UserRepository` | `<<repository>>` | `+insert(user): Promise<User>`<br>`+findByUsername(username): Promise<User \| null>`<br>`+findByEmail(email): Promise<User \| null>` | SQL en `userService` + `db.js` |
| `JwtService` | `<<service>>` | `+signToken(user): string`<br>`+verifyToken(token): Payload \| null` | `backend/middleware/auth.js` |

**Trazabilidad:** `POST /api/auth/register`, `AuthContext.register()`, validación de username/email/password, bcrypt y JWT.

---

## 4. CU2 Iniciar sesión

**Dependencia:** LoginView → AuthController → UserService → UserRepository; AuthController → JwtService.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `LoginView` | `<<view>>` | `+onSubmit(username, password): void`<br>`+showError(message): void`<br>`+redirectToDashboard(): void` | `frontend/src/app/login/page.tsx` |
| `AuthController` | `<<controller>>` | `+login(dto): Promise<AuthResponse>`<br>`+me(token): Promise<User>`<br>`+status(): Promise<{ authEnabled: boolean }>` | `backend/routes/auth.js` |
| `UserService` | `<<service>>` | `+verifyPassword(username, password): Promise<User \| null>`<br>`+findById(id): Promise<User \| null>` | `backend/services/userService.js` |
| `UserRepository` | `<<repository>>` | `+findByUsername(username): Promise<User \| null>`<br>`+findById(id): Promise<User \| null>` | SQL en `userService` + `db.js` |
| `JwtService` | `<<service>>` | `+signToken(user): string`<br>`+verifyToken(token): Payload \| null` | `backend/middleware/auth.js` |

**Trazabilidad:** `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/status`, bcrypt.compare y JWT.

---

## 5. CU3 Gestionar diagramas

**Dependencia:** DashboardView → DiagramController → DiagramService → DiagramRepository/AclRepository.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `DashboardView` | `<<view>>` | `+loadDiagrams(): Promise<void>`<br>`+search(query): Diagram[]`<br>`+openCreate(): void`<br>`+openRename(diagram): void`<br>`+openDelete(diagram): void`<br>`+handleDialogSubmit(): Promise<void>` | `frontend/src/app/dashboard/page.tsx` |
| `DiagramController` | `<<controller>>` | `+list(): Promise<{ owned, shared }>`<br>`+create(name): Promise<Diagram>`<br>`+get(id): Promise<Diagram>`<br>`+save(id, data): Promise<void>`<br>`+rename(id, name): Promise<void>`<br>`+delete(id): Promise<void>` | `backend/routes/diagrams.js` |
| `DiagramService` | `<<service>>` | `+listVisibleForUser(userId, includeAll): Promise<Diagram[]>`<br>`+createDiagramWithOwner(dto): Promise<Diagram>`<br>`+getDiagram(id): Promise<Diagram \| null>`<br>`+renameDiagram(id, name): Promise<Diagram \| null>`<br>`+deleteDiagram(id): Promise<boolean>`<br>`+saveSnapshot(id, update): Promise<void>` | `backend/services/diagramService.js` |
| `DiagramRepository` | `<<repository>>` | `+selectVisible(userId): Row[]`<br>`+insertWithOwner(diagram, ownerId): Row`<br>`+updateName(id, name): Row`<br>`+deleteWithAcl(id): boolean` | SQL en `diagramService` + `db.js` |
| `AclRepository` | `<<repository>>` | `+grantOwner(diagramId, userId): void`<br>`+deleteByDiagram(diagramId): void` | `backend/services/aclService.js` |

**Trazabilidad:** `GET/POST /api/diagrams`, `POST /api/diagrams/:id`, `PUT /api/diagrams/:id/rename`, `DELETE /api/diagrams/:id`, transacción diagrama + ACL.

---

## 6. CU4 Modelar diagrama colaborativamente

**Dependencia:** EditorView → CollaborationGateway → CollaborationService → YjsDocument → DiagramRepository; PresenceService como apoyo.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `EditorView` | `<<view>>` | `+onDrop(node): void`<br>`+onNodeDragStop(node): void`<br>`+onConnect(connection): void`<br>`+saveEntity(dto): void`<br>`+deleteEntity(id): void`<br>`+updateEdge(id, data): void` | `EditorFlow`, `EntityEditorPanel`, `EdgeEditorPanel`, `page.tsx` |
| `CollaborationGateway` | `<<controller>>` | `+attachRealtime(server): void`<br>`+ensureDocumentReady(room): Promise<Y.Doc>`<br>`+setupWSConnection(ws, req): void`<br>`+scheduleSnapshot(room, doc): void`<br>`+emitChatMessage(diagramId, message): Promise<boolean>` | `backend/realtime/yjs.js` |
| `CollaborationService` | `<<service>>` | `+addNode(node): void`<br>`+updateNode(id, changes): void`<br>`+removeNode(id): void`<br>`+addEdge(edge): void`<br>`+updateEdge(id, changes): void`<br>`+removeEdge(id): void`<br>`+onNodesChange(changes): void`<br>`+onEdgesChange(changes): void`<br>`+loadDiagramData(data): void`<br>`+addMessage(sender, text, author): void` | `frontend/src/hooks/useCollaborativeFlow.ts` |
| `YjsDocument` | `<<repository>>` | `+applyUpdate(update): void`<br>`+encodeStateAsUpdate(): Uint8Array`<br>`+getMap(name): Y.Map`<br>`+getArray(name): Y.Array`<br>`+transact(fn): void` | `Yjs`, `yjsNodeHelpers`, `yjsEdgeHelpers` |
| `DiagramRepository` | `<<repository>>` | `+getSnapshot(id): Uint8Array \| null`<br>`+saveSnapshot(id, update): Promise<void>` | `backend/services/diagramService.js` |
| `PresenceService` | `<<service>>` | `+publishIdentity(user, session): void`<br>`+getConnectedUsers(): ConnectedUser[]`<br>`+publishEditing(nodeId): void` | `useCollaborativeFlow` + `presence.ts` |

**Trazabilidad:** WebSocket `diagram-room-<id>`, `GET /api/diagrams/:id`, snapshots Yjs con debounce, soft-lock y presencia.

---

## 7. CU5 Gestionar colaboradores

**Dependencia:** MembersView → AclController → AclService → AclRepository/UserRepository; AccessRequestService para solicitudes.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `MembersView` | `<<view>>` | `+loadMembers(): Promise<void>`<br>`+invite(username, role): Promise<boolean>`<br>`+changeRole(userId, role): Promise<void>`<br>`+removeMember(userId): Promise<void>` | `MembersPanel.tsx`, `useDiagramMembers.ts` |
| `AccessRequestView` | `<<view>>` | `+handleRequestAccess(): Promise<void>`<br>`+respondToRequest(action, role): Promise<boolean>` | `useDiagramAccess.ts`, `AccessRequestsSection.tsx` |
| `AclController` | `<<controller>>` | `+getRole(diagramId): Promise<{ role }>`<br>`+getAcl(diagramId): Promise<AclResponse>`<br>`+addMember(diagramId, dto): Promise<AclResponse>`<br>`+updateMemberRole(diagramId, userId, role): Promise<AclResponse>`<br>`+removeMember(diagramId, userId): Promise<AclResponse>` | `backend/routes/acl.js` |
| `AclService` | `<<service>>` | `+readACL(diagramId): Promise<Acl \| null>`<br>`+getRoleForUser(diagramId, userId): Promise<Role>`<br>`+addMember(diagramId, member): Promise<Acl>`<br>`+updateMemberRole(diagramId, userId, role): Promise<Acl>`<br>`+removeMember(diagramId, userId): Promise<Acl>`<br>`+deleteACL(diagramId): Promise<void>` | `backend/services/aclService.js` |
| `AclRepository` | `<<repository>>` | `+selectRows(diagramId): Row[]`<br>`+upsertMember(diagramId, userId, role): void`<br>`+deleteMember(diagramId, userId): void`<br>`+deleteByDiagram(diagramId): void` | SQL en `aclService` + `db.js` |
| `UserRepository` | `<<repository>>` | `+findById(id): Promise<User \| null>`<br>`+findByUsername(username): Promise<User \| null>` | `backend/services/userService.js` |
| `AccessRequestService` | `<<service>>` | `+createRequest(diagramId, requesterId): Promise<Request>`<br>`+listPendingForOwner(ownerId): Promise<Request[]>`<br>`+respondToRequest({ requestId, ownerId, action, role }): Promise<Request>` | `backend/services/accessRequestService.js` |

**Trazabilidad:** `GET /api/diagrams/:id/role`, `GET /api/diagrams/:id/acl`, `POST/PATCH/DELETE /members`, `POST /api/diagrams/:id/request-access`, `GET /api/access-requests/pending`, `POST /api/access-requests/:id/respond`.

---

## 8. CU6 Usar asistente de IA

**Dependencia:** ChatView → AiCommandController → AiController → AiService → ChatService → ChatRepository; AiController → CollaborationGateway; AiService → GroqClient.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `ChatView` | `<<view>>` | `+onSendCommand(): void`<br>`+onVoiceCommand(): Promise<void>`<br>`+onFromImage(file): Promise<void>`<br>`+renderMessages(): void` | `ChatPanel.tsx` |
| `AiCommandController` | `<<controller>>` | `+sendCommandText(text): Promise<void>`<br>`+handleSendCommand(): void`<br>`+handleVoiceCommand(): Promise<void>`<br>`+handleFromImage(file): Promise<void>` | `frontend/src/hooks/useAICommand.ts` |
| `AiController` | `<<controller>>` | `+command(dto): Promise<AiResponse>`<br>`+transcribe(file): Promise<{ text }>`<br>`+fromImage(file, currentState): Promise<{ mutations }>`<br>`+listOllamaModels(url): Promise<string[]>` | `backend/routes/ai.js` |
| `AiService` | `<<service>>` | `+getMutationsFromAI(command, state, image, history, selected, provider): Promise<AiResult>`<br>`+formatChatHistory(history): string`<br>`+aiUsername(user): string`<br>`+ensureAddressed(text, username): string` | `backend/services/aiService.js` |
| `ChatService` | `<<service>>` | `+addMessage(dto): Promise<Message>`<br>`+getRecentMessages(diagramId, limit): Promise<Message[]>`<br>`+toWireMessage(row): ChatMessage` | `backend/services/chatService.js` |
| `ChatRepository` | `<<repository>>` | `+insertMessage(dto): Promise<Row>`<br>`+selectRecent(diagramId, limit): Promise<Row[]>` | SQL en `chatService` + `db.js` |
| `CollaborationGateway` | `<<controller>>` | `+emitChatMessage(diagramId, message): Promise<boolean>` | `backend/realtime/yjs.js` |
| `GroqClient` | `<<service>>` | `+complete(prompt, options): Promise<AiResult>`<br>`+transcribe(audio): Promise<string>`<br>`+analyzeImage(image): Promise<AiResult>` | `aiService` + Groq/Ollama |

**Trazabilidad:** `POST /api/ai/command`, `/transcribe`, `/from-image`, `/ollama-models`; identidad desde JWT; últimos 15 mensajes; respuesta persistida y emitida por Yjs; mutaciones aplicadas por `useAICommand`.

---

## 9. CU7 Exportar/Importar diagrama

**Dependencia:** ToolbarView → DiagramIoController → XmiExporter/XmiImporter → YjsGraphRepository.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `ToolbarView` | `<<view>>` | `+handleExportXmi(): void`<br>`+handleImportXmi(file): void` | `Toolbar.tsx` |
| `DiagramIoController` | `<<controller>>` | `+handleExportXmi(): void`<br>`+handleImportXmi(file): Promise<void>` | `frontend/src/hooks/useDiagramIo.ts` |
| `XmiExporter` | `<<service>>` | `+exportToXmi(nodes, edges): string`<br>`+downloadXmi(content, filename): void`<br>`-buildDiagramInterchange(nodes, edges): string`<br>`-buildEaExtension(nodes, edges): string` | `frontend/src/utils/xmiExporter.ts` |
| `XmiImporter` | `<<service>>` | `+importFromXmi(file, hooks): Promise<void>`<br>`-parseClasses(doc): Node[]`<br>`-parseAssociations(doc): Edge[]`<br>`-parseGeneralizations(doc): Edge[]` | `frontend/src/utils/xmiImporter.ts` |
| `YjsGraphRepository` | `<<repository>>` | `+addNode(node): void`<br>`+addEdge(edge): void`<br>`+replaceGraph(nodes, edges): void` | `yjsNodeHelpers`, `yjsEdgeHelpers`, `yjsDiagramIo` |

**Trazabilidad:** exportación XMI 2.5.1 + UMLDI, importación EA/estándar, repoblación de Yjs. La exportación/importación JSON se retiró de la toolbar; XMI es el estándar principal.

---

## 10. CU8 Generar backend Spring Boot

**Dependencia:** ToolbarView → GeneratorController → GeneratorService → TemplateEngine/FileSystemRepository; GeneratorController → ValidationService.

| Clase | Estereotipo | Métodos propuestos | Fuente real |
|---|---|---|---|
| `ToolbarView` | `<<view>>` | `+onGenerateBackend(): void` | `Toolbar.tsx` |
| `GeneratorController` | `<<controller>>` | `+generate(currentState): Promise<Zip>`<br>`+downloadZip(path): void` | `backend/routes/generator.js` |
| `GeneratorService` | `<<service>>` | `+generateProject(ast): Promise<string>`<br>`+sanitizeEntities(entities): Entity[]`<br>`+normalizeRelationshipEndpoints(rel, lookup): Rel`<br>`+expandManyToMany(entities, rels, names): Expanded`<br>`+buildEntityRelations(entity, entities, rels): Relation[]`<br>`+buildInheritanceInfo(entity, entities, rels): Inheritance` | `backend/generator/generate.js`, `contextBuilder.js`, `expander.js` |
| `TemplateEngine` | `<<service>>` | `+compile(name): Template`<br>`+render(name, context): string` | `backend/generator/templateEngine.js` |
| `FileSystemRepository` | `<<repository>>` | `+writeFile(path, content): void`<br>`+createZip(outputDir, workDir, name): Promise<string>`<br>`+removeTemp(path): void` | `generate.js`, `packager.js` |
| `ValidationService` | `<<service>>` | `+validateAstState(ast): ValidationResult` | `backend/validation.js` |

**Trazabilidad:** `POST /api/generate`, validación del AST, normalización de nombres, expansión de `* a *`, herencia `JOINED`, render Handlebars, ZIP, `clean.sql` y limpieza de temporales.

---

## 11. Criterios para la Fase 2

1. Crear cada `DP_*` dentro de su paquete CU existente.
2. Tipo de diagrama: **Class Diagram**.
3. Incluir las clases de las tablas anteriores con sus estereotipos `<<view>>`, `<<controller>>`, `<<service>>`, `<<repository>>`.
4. Dibujar dependencias punteadas en orden horizontal `View → Controller → Service → Repository`.
5. No eliminar ni mover los diagramas de clases existentes.
6. Mantener los nombres de métodos sin ambigüedad y con tipo de retorno.
7. Validar que cada diagrama tenga al menos una cadena completa de dependencias.

**Estado:** propuesta lista. Se espera aprobación para ejecutar la Fase 2 en Enterprise Architect.
