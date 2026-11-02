# Manual de Usuario Rápido

## 1. Registro e inicio de sesión

1. Abrir la aplicación y pulsar **Registrarse**.
2. Completar username, email y contraseña.
3. Confirmar el registro; la sesión se inicia automáticamente.
4. Si ya existe una cuenta, usar **Iniciar sesión** con username y contraseña.

El token JWT se guarda en el navegador y se usa en REST y WebSocket. Si la sesión expira, el sistema redirige al login.

## 2. Crear un diagrama

1. En el Dashboard, pulsar **+ Nuevo diagrama**.
2. Escribir el nombre en el modal y confirmar.
3. El editor se abre en `/diagram/<id>`.
4. El diagrama aparece en “Mis diagramas” con su rol, fecha y conteos.

Desde el menú **⋮** de la tarjeta se puede **Renombrar** o **Eliminar**; la eliminación solo aparece para el `OWNER`.

## 3. Agregar entidades y relaciones

1. Usar la paleta izquierda para arrastrar **Clase**, **Interfaz**, **Clase abstracta** o **Nota** al lienzo.
2. Hacer clic en una entidad para editar nombre, estereotipo, atributos y métodos.
3. Para conectar, seleccionar un tipo de relación en **Relaciones** y hacer clic en origen y destino.
4. Un clic en el mismo nodo crea un **self-loop**.
5. Arrastrar un nodo actualiza su posición y se sincroniza por Yjs.

## 4. Invitar a un colaborador (Fase 2A)

1. Abrir el diagrama como `OWNER`.
2. Pulsar **Miembros** en la barra superior.
3. Escribir el username del colaborador.
4. Elegir **Editor** o **Lector** e invitar.
5. El colaborador verá el diagrama en “Compartidos conmigo”.

Roles:

- **OWNER:** administra miembros, renombra y elimina.
- **EDITOR:** edita el diagrama, no elimina ni administra miembros.
- **VIEWER:** solo lectura.

## 5. Solicitar acceso a un diagrama (Fase 3)

1. Abrir un enlace `/diagram/<id>` sin permisos.
2. Pulsar **Solicitar Acceso**.
3. Esperar la confirmación “Solicitud enviada”.
4. El `OWNER` verá la solicitud en **Solicitudes pendientes** del Dashboard.
5. El `OWNER` pulsa **Aprobar**, elige `VIEWER` o `EDITOR`, y confirma.
6. El solicitante recarga el editor y accede con el rol concedido.

## 6. Usar el Agente IA

### Texto

1. Abrir el chat **Chat IA**.
2. Escribir una pregunta o un comando, por ejemplo:
   - “¿Qué diferencia hay entre agregación y composición?”
   - “Crea la entidad Factura con id y total”.
3. Pulsar enviar o Enter.
4. La respuesta se publica en el chat colaborativo.

### Voz

1. Pulsar el micrófono.
2. Hablar.
3. Detener la grabación.
4. El texto se transcribe y se envía automáticamente.

La transcripción requiere Groq Whisper y `GROQ_API_KEY`.

### Motor de IA

En el encabezado del chat se puede elegir Groq u Ollama. El engranaje abre **Configuración Avanzada de IA**:

- **Groq:** rápido, requiere internet y la clave se configura en el backend.
- **Ollama:** local; indicar URL y modelo. El botón **Detectar** consulta los modelos instalados.

## 7. Generar el backend Spring Boot

1. Pulsar **Generar** en la barra superior.
2. El sistema convierte el canvas en AST.
3. Se valida el diagrama; si no hay entidades, se informa el error.
4. Se descarga un ZIP con:
   - `pom.xml`
   - `application.properties`
   - entidades, repositorios, servicios y controladores
   - DTO, seguridad, migración SQL y README
5. Descomprimir y ejecutar `mvn clean package`.

## 8. Buenas prácticas durante la demostración

- Confirmar que el backend esté en `/ready`.
- Verificar que el WebSocket muestre “Conectado”.
- Si se usa Ollama, probar **Detectar** antes de enviar comandos.
- Si se usa Groq, confirmar que `GROQ_API_KEY` esté configurada en Railway.
- No exponer claves en pantalla ni en el repositorio.

Volver al [[00_Indice]].
