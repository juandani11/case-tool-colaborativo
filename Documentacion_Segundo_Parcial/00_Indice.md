# Índice General

> **Proyecto:** Herramienta CASE Colaborativa con IA
> **Documento:** Ingeniería de software del Segundo Parcial
> **Versión:** 1.1 (entrega final)
> **Fecha:** 1 de noviembre de 2026
> **Repositorio:** `case-tool`
> **Alcance:** arquitectura, proceso de desarrollo, análisis, diseño e implementación del asistente IA colaborativo con identidad y memoria contextual, y de la persistencia sectorizada en PostgreSQL.

## 1. Propósito del vault

Este vault concentra la documentación técnica y académica del Segundo Parcial. Su contenido está organizado para poder leerse de forma lineal, como un informe de ingeniería de software, o de forma navegable mediante enlaces de Obsidian.

La documentación describe el sistema **realmente implementado**, no una propuesta teórica. Cuando una decisión queda pendiente o una limitación es conocida, se indica explícitamente para evitar ambigüedad entre el estado actual y el trabajo futuro.

## 2. Navegación

| Sección | Documento | Contenido principal |
|---|---|---|
| 0 | [[00_Indice]] | Alcance, navegación, correspondencia con el documento Word y exportación |
| 1 | [[01_Arquitectura]] | Visión general, stack, componentes, despliegue, seguridad y decisiones arquitectónicas |
| 2 | [[02_Proceso]] | Proceso Unificado, actores, requisitos, ocho casos de uso, iteraciones y CU-06 detallado |
| 3 | [[03_Analisis]] | Modelo conceptual, paquetes, análisis BCE, contratos y trazabilidad |
| 4 | [[04_Diseno]] | Diagramas de despliegue, clases, modelo relacional, Rumbaugh, secuencias y estados |
| 5 | [[05_Implementacion]] | Organización del código, capas del backend, CU-06, pruebas, despliegue y limitaciones |
| 6 | [[06_Trazabilidad]] | Matriz CU → UI → endpoint → tabla → prueba QA |
| 7 | [[07_Despliegue]] | Guía DevOps para Vercel, Railway, Neon, Ollama y Ngrok |
| 8 | [[08_Manual_Usuario]] | Manual rápido para registro, edición, colaboración, IA y generación |
| 9 | [[09_Conclusiones]] | Conclusiones y trabajo futuro |
| 10 | [[10_Anexos]] | Glosario técnico y bibliografía APA 7 |

## 3. Resumen ejecutivo

La herramienta permite construir diagramas UML de forma colaborativa en tiempo real, autenticar usuarios, administrar permisos por diagrama y generar un backend Spring Boot con PostgreSQL a partir del modelo. El Segundo Parcial incorpora dos cambios estructurales:

1. **Asistente IA con identidad y memoria contextual.** La identidad se obtiene del JWT y no del cuerpo de la petición. La memoria conversacional se recupera desde PostgreSQL, con los últimos 15 mensajes del diagrama, y la respuesta se persiste y se emite por el chat colaborativo Yjs.
2. **Persistencia en PostgreSQL sectorizado.** Se reemplazó la persistencia basada en archivos JSON por el esquema `auth`, `core` y `chat` en Neon. El grafo vivo continúa en Yjs; su estado binario se guarda en `core.diagrams.yjs_snapshot`.

La arquitectura resultante combina un frontend Next.js, un backend Express con WebSocket, una base PostgreSQL y servicios externos de IA. Esta combinación permite colaboración en tiempo real sin sacrificar durabilidad, autorización ni trazabilidad de las conversaciones.

## 4. Correspondencia con el documento Word

El orden de este vault replica el índice lógico del informe:

| Bloques del informe | Archivo |
|---|---|
| Índice, introducción, alcance y resumen | [[00_Indice]] |
| Arquitectura del sistema | [[01_Arquitectura]] |
| Proceso de desarrollo, requisitos y casos de uso | [[02_Proceso]] |
| Análisis de requisitos y modelo BCE | [[03_Analisis]] |
| Diseño arquitectónico, de clases, de datos y de secuencias | [[04_Diseno]] |
| Implementación, pruebas, despliegue y conclusiones | [[05_Implementacion]] |
| Trazabilidad formal | [[06_Trazabilidad]] |
| Guía de despliegue | [[07_Despliegue]] |
| Manual de usuario | [[08_Manual_Usuario]] |
| Conclusiones y trabajo futuro | [[09_Conclusiones]] |
| Glosario y bibliografía | [[10_Anexos]] |

## 5. Alcance documentado

### 5.1 Incluido

- Arquitectura de frontend, backend, base de datos y despliegue.
- Ocho casos de uso del sistema, con énfasis en `CU-06 Usar asistente IA`.
- Proceso Unificado de Desarrollo de Software y sus fases.
- Análisis de paquetes y diagramas de frontera-control-entidad.
- Modelo relacional de los esquemas `auth`, `core` y `chat`.
- Aplicación de las reglas de transformación de Rumbaugh.
- Diagramas de secuencia del asistente IA y de la colaboración.
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
4. Arquitectura.
5. Proceso.
6. Análisis.
7. Diseño.
8. Implementación.
9. Conclusiones y trabajo futuro.
10. Anexos: contratos API, modelo de datos y trazabilidad.

## 9. Estado de la documentación

| Elemento | Estado |
|---|---|
| Arquitectura 4+1 | Documentada con vistas lógica, procesos, implementación, despliegue y casos de uso |
| Proceso PUDS | Documentado con seis iteraciones: IA, concurrencia, acceso y configuración |
| Casos de uso UML | Documentados con actores, flujos y diagramas Mermaid |
| Análisis BCE | Documentado con frontera, control y entidad |
| Diseño de datos y Rumbaugh | Documentado con ERD y coincidencia con el esquema real |
| Implementación y refactorización | Documentada con P0/P1 y trazas de código |
| Fase 3: solicitudes de acceso | Documentada con endpoints, tabla `auth.access_requests` y aprobación transaccional |
| Configuración IA Groq/Ollama | Documentada con Strategy, BYOK y persistencia local de URL/modelo |
| Dashboard UI/UX | Documentado con CRUD de tarjetas, fechas y empty states |
| Verificación y validación | Documentadas con pruebas manuales, build, tsc y regresión IA |
| Limitaciones | Documentadas |

## 10. Enlaces de continuidad

- Comenzar la lectura técnica en [[01_Arquitectura]].
- Revisar el proceso y los casos de uso en [[02_Proceso]].
- Estudiar el análisis del asistente IA en [[03_Analisis]].
- Consultar el modelo relacional y las secuencias en [[04_Diseno]].
- Verificar la implementación y las pruebas en [[05_Implementacion]].
- Consultar la matriz formal en [[06_Trazabilidad]].
- Reproducir el entorno con [[07_Despliegue]].
- Seguir la demo con [[08_Manual_Usuario]].
- Revisar el cierre en [[09_Conclusiones]].
- Consultar definiciones y referencias en [[10_Anexos]].

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
