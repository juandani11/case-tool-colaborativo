# Anexos: Glosario y Bibliografía

## 1. Glosario

| Término | Definición |
|---|---|
| **CRDT** (Conflict-free Replicated Data Type) | Tipo de dato replicado cuyas operaciones son conmutativas, asociativas e idempotentes. Permite que varios clientes converjan sin coordinación central. En el proyecto se implementa con Yjs para nodos, aristas, chat y presencia. |
| **SSRF** (Server-Side Request Forgery) | Vulnerabilidad en la que un servidor realiza peticiones a destinos controlados por el usuario. En el proyecto se mitiga validando protocolo `http(s)`, host, credenciales y longitud de `ollamaUrl`. |
| **BYOK** (Bring Your Own Key) | Modelo de configuración en el que el usuario aporta sus credenciales o parámetros de proveedor. En esta aplicación el proveedor, URL y modelo de Ollama se guardan en el navegador; la clave de Groq permanece en el backend. |
| **Service Discovery** | Mecanismo por el cual un consumidor consulta el catálogo de servicios o recursos disponibles. El frontend consulta `GET /api/ai/ollama-models`, que a su vez descubre los modelos instalados mediante `/api/tags`. |
| **Clean Architecture** | Estilo arquitectónico que separa políticas de negocio y detalles de infraestructura mediante dependencias dirigidas hacia el dominio. En el backend se aplica de forma pragmática con rutas, servicios, acceso a datos y middleware transversal. |
| **PUDS / RUP** | Proceso Unificado de Desarrollo de Software, iterativo e incremental, dirigido por casos de uso, centrado en la arquitectura y orientado a riesgos. Se organiza en Inicio, Elaboración, Construcción y Transición. |
| **JWT** (JSON Web Token) | Token firmado que transporta claims de identidad. En la aplicación contiene `userId` y `username`, se verifica en REST y en el handshake WebSocket y no incluye `password_hash`. |
| **BCE** (Boundary-Control-Entity) | Patrón de análisis UML que separa la interfaz, la coordinación del caso de uso y el estado persistente. Se aplica al chat con `ChatPanel`, `useAICommand`/`aiService` y `chat.messages`. |
| **Yjs** | Implementación de CRDT para colaboración en tiempo real. El documento vivo contiene `Y.Map` de nodos/aristas y `Y.Array` de chat; PostgreSQL conserva snapshots binarios. |
| **ACL** (Access Control List) | Lista de control de acceso por diagrama. Los roles `OWNER`, `EDITOR` y `VIEWER` se almacenan en `auth.diagram_acl`. |

## 2. Bibliografía

Jacobson, I., Booch, G., & Rumbaugh, J. (1999). *The unified software development process*. Addison-Wesley.

Kleppmann, M. (2017). *Designing data-intensive applications: The big ideas behind reliable, scalable, and maintainable systems*. O’Reilly Media.

Pressman, R. S., & Maxim, B. R. (2020). *Software engineering: A practitioner’s approach* (9th ed.). McGraw-Hill Education.

Rumbaugh, J., Jacobson, I., & Booch, G. (2004). *The unified modeling language reference manual* (2nd ed.). Addison-Wesley.

Sommerville, I. (2016). *Software engineering* (10th ed.). Pearson.

Spring. (2024). *Spring Boot reference documentation*. https://docs.spring.io/spring-boot/

OWASP Foundation. (2024). *Server-side request forgery prevention cheat sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

Volver al [[00_Indice]].
