# Índice General

> **Proyecto:** Herramienta CASE Colaborativa con IA  
> **Documento:** Ingeniería de software del Segundo Parcial  
> **Versión:** 1.0  
> **Fecha:** 31 de octubre de 2026  
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
| 5 | [[05_Implementacion]] | Organización del código, cuatro capas del backend, CU-06, pruebas, despliegue y limitaciones |

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

### 5.2 Fuera de alcance

- Exportación a PlantUML o SQL.
- Invitaciones y solicitudes de acceso pendientes de aprobación.
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
| Arquitectura | Documentada |
| Proceso y casos de uso | Documentado |
| Análisis BCE | Documentado |
| Diseño de datos | Documentado con esquema real |
| Implementación | Documentada |
| Pruebas | Documentadas |
| Limitaciones | Documentadas |

## 10. Enlaces de continuidad

- Comenzar la lectura técnica en [[01_Arquitectura]].
- Revisar el proceso y los casos de uso en [[02_Proceso]].
- Estudiar el análisis del asistente IA en [[03_Analisis]].
- Consultar el modelo relacional y las secuencias en [[04_Diseno]].
- Verificar la implementación y las pruebas en [[05_Implementacion]].
