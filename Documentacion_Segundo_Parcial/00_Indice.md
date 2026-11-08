# Índice General

> **Proyecto:** Herramienta CASE Colaborativa con IA
> **Documento:** Ingeniería de software del Segundo Parcial
> **Versión:** 3.0 (entrega final C4 + PUDS)
> **Fecha:** 3 de noviembre de 2026
> **Repositorio:** `case-tool`
> **Alcance:** requisitos, análisis, arquitectura Clean, diseño UML, implementación, pruebas y anexos del asistente IA colaborativo con identidad y memoria contextual.

## 1. Propósito del vault

Este vault concentra la documentación técnica y académica del Segundo Parcial. Su contenido está organizado siguiendo el orden lógico de PUDS/RUP: requisitos y proceso, análisis, arquitectura, diseño UML, implementación/pruebas y anexos.

La documentación describe el sistema **realmente implementado**, no una propuesta teórica. Cuando una decisión queda pendiente o una limitación es conocida, se indica explícitamente para evitar ambigüedad entre el estado actual y el trabajo futuro.

## Metodología Aplicada

La bóveda combina dos estándares complementarios:

- **PUDS/RUP:** organiza el ciclo de vida en Inicio, Elaboración, Construcción y Transición, con los hitos **LCO, LAM, IOC y PRM**. Los requisitos, el análisis, la arquitectura, el diseño UML, la implementación/pruebas y los anexos quedan trazados a esas fases.
- **Modelo C4:** documenta la arquitectura en cuatro niveles: **Contexto**, **Contenedores**, **Componentes** y **Código/Clases**. El nivel 3 refleja Clean Architecture y el nivel 4 se apoya en los diagramas UML de clases.

Los diagramas se escriben en Mermaid para que sean versionables y renderizables en Obsidian. Los estereotipos UML 2.5 (`<<boundary>>`, `<<control>>`, `<<entity>>`, `<<component>>`) se usan cuando aportan semántica.

## 2. Navegación

| Sección | Documento | Contenido principal |
|---|---|---|
| 0 | [[00_Indice]] | Alcance, navegación, correspondencia con el informe y exportación |
| 1 | [[01_Requisitos_y_Proceso]] | PUDS, actores, requisitos, ocho CU, `<<include>>`/`<<extend>>`, UAT y CU-06 |
| 2 | [[02_Analisis]] | Modelo conceptual, paquetes, BCE, actividad de generación, contratos y trazabilidad |
| 3 | [[03_Diseno_Arquitectura]] | Clean Architecture, C4 niveles 1–3, monolito modular, Strategy, datos y seguridad |
| 4 | [[04_Diseno_UML]] | Casos de uso, clases, paquetes, componentes, despliegue, secuencia, actividad, estados y comunicación |
| 5 | [[05_Implementacion_y_Pruebas]] | Capas, seis iteraciones de construcción, V&V, refactorización, QA y limitaciones |
| 6 | [[06_Anexos_y_Glosario]] | Trazabilidad, manual de despliegue, manual de usuario, conclusiones, glosario y bibliografía |

## 3. Resumen ejecutivo

La herramienta permite construir diagramas UML de forma colaborativa en tiempo real, autenticar usuarios, administrar permisos por diagrama y generar un backend Spring Boot con PostgreSQL a partir del modelo. El Segundo Parcial incorpora dos cambios estructurales:

1. **Asistente IA con identidad y memoria contextual.** La identidad se obtiene del JWT y no del cuerpo de la petición. La memoria conversacional se recupera desde PostgreSQL, con los últimos 15 mensajes del diagrama, y la respuesta se persiste y se emite por el chat colaborativo Yjs.
2. **Persistencia en PostgreSQL sectorizado.** Se reemplazó la persistencia basada en archivos JSON por los esquemas `auth`, `core` y `chat` en Neon. El grafo vivo continúa en Yjs; su estado binario se guarda en `core.diagrams.yjs_snapshot`.

La arquitectura resultante aplica **Clean Architecture en capas**: `routes/` → `middleware/` → `services/` → `db.js` → PostgreSQL. El backend es un único proceso Node que sirve REST y WebSocket, pero su código mantiene separación estricta de responsabilidades y dependencias dirigidas hacia el dominio y la persistencia.

## 4. Correspondencia con el informe

| Bloques del informe | Archivo |
|---|---|
| Índice, introducción, alcance y resumen | [[00_Indice]] |
| Proceso de desarrollo, requisitos y casos de uso | [[01_Requisitos_y_Proceso]] |
| Análisis de requisitos y modelo BCE | [[02_Analisis]] |
| Arquitectura Clean, componentes y decisiones | [[03_Diseno_Arquitectura]] |
| Diseño UML: clases, secuencia, comunicación, actividad, estados, componentes y despliegue | [[04_Diseno_UML]] |
| Implementación, refactorización, pruebas y QA | [[05_Implementacion_y_Pruebas]] |
| Trazabilidad, despliegue, manual, conclusiones, glosario y bibliografía | [[06_Anexos_y_Glosario]] |

## 5. Alcance documentado

### 5.1 Incluido

- Arquitectura Clean del backend por capas y separación frontend, backend e IA.
- Ocho casos de uso del sistema, con énfasis en `CU-06 Usar asistente IA`.
- Proceso Unificado de Desarrollo de Software y sus fases.
- Análisis de paquetes y diagramas de frontera-control-entidad.
- Modelo relacional de los esquemas `auth`, `core` y `chat`.
- Aplicación de las reglas de transformación de Rumbaugh.
- Diagramas UML de casos de uso, clases, secuencia, comunicación, actividad, estados, componentes y despliegue.
- Implementación real, pruebas ejecutadas y limitaciones conocidas.
- Solicitudes de acceso de Fase 3 y aprobación transaccional.
- Configuración dinámica de IA Groq/Ollama y auto-detección de modelos.
- Trazabilidad formal, guía de despliegue, manual de usuario, conclusiones y anexos.

### 5.2 Fuera de alcance

- Exportación a PlantUML o SQL nativo.
- Integración directa con Enterprise Architect más allá de XMI.
- Despliegue en microservicios con adaptador Yjs distribuido.
- Read-only transaccional en el protocolo Yjs.
- Aplicación móvil funcional; existe únicamente como stub.
- Facturación, auditoría avanzada o alta disponibilidad multirregión.

## 6. Fuentes de verdad

La documentación se construyó a partir de:

- `README.md`, como descripción funcional del producto.
- `docs/FLUJOS_Y_ARQUITECTURA.md`, como referencia de flujos y archivos.
- Código del frontend en `frontend/src`.
- Código del backend en `backend`.
- Esquema real consultado en Neon para los esquemas `auth`, `core` y `chat`.
- Resultados de compilación, pruebas de integración y verificación manual.

> **Nota:** el `README.md` conserva afirmaciones históricas sobre persistencia en archivos JSON porque el proyecto evolucionó durante el parcial. Para el estado actual, prevalecen el código, el esquema Neon y este vault.

## 7. Convenciones

- Los casos de uso se identifican como `CU-01` a `CU-08`.
- Los requisitos funcionales se identifican como `RF-xx` y los no funcionales como `RNF-xx`.
- Las reglas de negocio se identifican como `RN-xx.y`.
- Los enlaces internos usan la sintaxis de doble corchete de Obsidian.
- Los diagramas se expresan en Mermaid o en ASCII para que sean legibles sin plugins adicionales.
- Las rutas de archivo son relativas a la raíz del repositorio.
- No se incluyen secretos, cadenas de conexión ni claves de API.

## 8. Exportación a Word o PDF

### 8.1 PDF desde Obsidian

1. Abrir el archivo que se desea exportar.
2. Usar la paleta de comandos y ejecutar **Export to PDF**.
3. Verificar que los enlaces internos y los bloques Mermaid se hayan renderizado.
4. Repetir por sección o exportar una nota maestra que incluya el contenido completo.

### 8.2 Word

Obsidian no exporta `.docx` de forma nativa. Opciones recomendadas:

1. **Pandoc:** exportar cada Markdown a `.docx` y unir los documentos en Word.
2. **Copia y pega enriquecido:** abrir la vista previa de Obsidian, copiar el contenido y pegarlo en Word.
3. **Plugin de exportación:** usar un plugin comunitario de exportación a Word, verificando previamente su compatibilidad.

### 8.3 Orden de ensamblaje

1. Portada.
2. Índice general.
3. Introducción y resumen ejecutivo.
4. Requisitos y proceso.
5. Análisis.
6. Arquitectura.
7. Diseño UML.
8. Implementación y pruebas.
9. Conclusiones y trabajo futuro.
10. Anexos: trazabilidad, despliegue, manual, glosario y bibliografía.

## 9. Estado de la documentación

| Elemento | Estado |
|---|---|
| Clean Architecture | Documentada con capas `routes/` → `middleware/` → `services/` → `db.js` → PostgreSQL |
| Modelo C4 | Niveles 1–3 documentados en arquitectura; nivel 4 en clases UML |
| Proceso PUDS | Cuatro fases con hitos LCO/LAM/IOC/PRM y seis iteraciones de construcción |
| Casos de uso UML | Documentados con actores, flujos y diagramas Mermaid |
| Análisis BCE | Documentado con frontera, control, servicio y entidad |
| Diseño de datos y Rumbaugh | Documentado con ERD y coincidencia con el esquema real |
| UML 2.5 | Casos de uso, clases, secuencia, comunicación, actividad, estados, componentes y despliegue |
| Implementación y refactorización | Documentada con P0/P1, regla de dependencia y trazas de código |
| Fase 3: solicitudes de acceso | Documentada con endpoints, tabla `auth.access_requests` y aprobación transaccional |
| Configuración IA Groq/Ollama | Documentada con Strategy, BYOK y persistencia local de URL/modelo |
| Dashboard UI/UX | Documentado con CRUD de tarjetas, fechas y empty states |
| Verificación y validación | Documentadas con pruebas manuales, build, tsc y regresión IA |
| Limitaciones | Documentadas |

## 10. Enlaces de continuidad

- Comenzar por requisitos y proceso en [[01_Requisitos_y_Proceso]].
- Estudiar el análisis BCE en [[02_Analisis]].
- Revisar Clean Architecture en [[03_Diseno_Arquitectura]].
- Consultar los diagramas UML en [[04_Diseno_UML]].
- Verificar la implementación y las pruebas en [[05_Implementacion_y_Pruebas]].
- Consultar trazabilidad, despliegue, manual y glosario en [[06_Anexos_y_Glosario]].

## 11. Matriz de Trazabilidad

| Requisito (CU) | Módulo de Diseño (Componente) | Endpoint de API / Función | Prueba de Verificación (Estado) |
|---|---|---|---|
| CU-01 Autenticarse | `AuthContext`, `routes/auth.js`, `userService` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Integración PostgreSQL 23/23 PASS |
| CU-02 Gestionar diagramas | `dashboard/page.tsx`, `routes/diagrams.js`, `diagramService` | `GET/POST /api/diagrams`, `POST /api/diagrams/:id`, `PUT /rename`, `DELETE /:id` | Integración PostgreSQL 23/23 PASS |
| CU-03 Editar colaborativamente | `useCollaborativeFlow`, `realtime/yjs.js`, helpers Yjs | WebSocket `diagram-room-<id>`, `GET /api/diagrams/:id` | Prueba manual A/B y recarga PASS |
| CU-04 Gestionar miembros | `MembersPanel`, `useDiagramMembers`, `routes/acl.js`, `aclService` | `GET /api/diagrams/:id/acl`, `POST/PATCH/DELETE /members` | Integración PostgreSQL 23/23 PASS |
| CU-05 Exportar/importar | `Toolbar`, `diagramExportImport`, `xmiExporter`, `xmiImporter` | Funciones locales JSON/XMI | Prueba manual de exportación e importación PASS |
| CU-06 Interactuar con Agente IA | `ChatPanel`, `useAICommand`, `routes/ai.js`, `aiService`, `chatService` | `POST /api/ai/command`, `/transcribe`, `/from-image` | Regresión IA 32/32 PASS |
| CU-07 Generar backend | `Toolbar`, `routes/ai.js`, `generator/generate.js` | `POST /api/generate` | ZIP generado y compilación de plantillas PASS |
| CU-08 Consultar manual | `HelpModal`, `useHelpModal`, `data/manual.ts` | Botón Ayuda / `F1` | Prueba manual de apertura, búsqueda y cierre PASS |
