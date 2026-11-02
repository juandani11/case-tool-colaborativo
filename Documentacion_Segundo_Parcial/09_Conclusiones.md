# Conclusiones y Trabajo Futuro

## 1. Conclusiones

La Herramienta CASE Colaborativa con IA cumplió los objetivos planteados para el Segundo Parcial. Se consolidó una arquitectura frontend/backend desacoplada, con Next.js y React Flow en la interfaz, Node.js + Express en el servidor y Yjs como mecanismo de colaboración en tiempo real. La aplicación de una Clean Architecture pragmática permitió separar rutas, middleware, servicios, acceso a datos y tiempo real, reduciendo el acoplamiento y facilitando la verificación por capas.

La persistencia se resolvió con PostgreSQL en Neon, sectorizado en `auth`, `core` y `chat`. Esta decisión permitió separar identidad y permisos, metadatos/snapshots del diagrama e historial conversacional, manteniendo a Yjs como estado canónico del grafo y a PostgreSQL como fuente durable. Las transacciones atómicas, la carga previa del snapshot y la validación de ACL eliminaron riesgos de huérfanos y escrituras sobre documentos vacíos.

El Agente IA evolucionó de un generador de mutaciones a un tutor contextual capaz de explicar UML, interpretar el elemento seleccionado, recordar los últimos 15 mensajes y adaptar el tono al interlocutor. La incorporación del patrón Strategy permite alternar Groq y Ollama sin reiniciar el backend, mientras la configuración local se conserva en el navegador y la clave de Groq permanece en el servidor.

La generación automática de backend Spring Boot, la exportación/importación JSON/XMI, el dashboard con CRUD y las solicitudes de acceso completan un flujo de trabajo que reduce tareas repetitivas y mejora la productividad frente a un editor UML tradicional. El valor principal no está en una función aislada, sino en la integración coherente entre modelado, colaboración, tutoría, persistencia y generación de código.

## 2. Trabajo futuro

1. **Integración con más herramientas CASE y estándares:** exportación/importación directa con PlantUML, Enterprise Architect y SQL, además de una API pública versionada para intercambio de modelos.
2. **Modelos de IA más grandes y multimodales:** soporte para modelos locales de mayor capacidad, imágenes y audio con proveedores alternativos, manteniendo la configuración por usuario y las políticas de privacidad.
3. **Escalabilidad distribuida:** separar el servicio WebSocket/Yjs del API REST, usar un adaptador compartido de salas y desplegar en microservicios con observabilidad, métricas y trazas.

Volver al [[00_Indice]].
