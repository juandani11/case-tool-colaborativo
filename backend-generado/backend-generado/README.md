# generated-backend

Backend generado automaticamente a partir de un diagrama de entidades. Basado en **Spring Boot 4.0.0**, **Java 21**, **PostgreSQL 18**, **Spring Security 7**, **JPA/Hibernate** y **JWT**.

---

## Requisitos

- **Java 21** (JDK)
- **Maven 3.9+**
- **PostgreSQL 18** (base de datos accesible)
- Puerto **8080** libre

---

## Configuracion de Base de Datos

Por defecto, la aplicacion espera una base de datos PostgreSQL con:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/diagramdb
spring.datasource.username=postgres
spring.datasource.password=postgres
```

Si necesitas cambiar la configuracion, edita `src/main/resources/application.properties` o define variables de entorno:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/tu_bd
export DB_USER=tu_usuario
export DB_PASS=tu_password
```

---

## Ejecucion

```bash
mvn spring-boot:run
```

La aplicacion se inicia en `http://localhost:8080`.

---

## Esquema de Base de Datos

El esquema se crea y actualiza automaticamente con Hibernate (`spring.jpa.hibernate.ddl-auto=update`).

---

## Autenticacion (JWT)

El backend usa **autenticacion stateless con JWT**. El usuario por defecto es:

| Usuario | Contrasena | Rol |
|---------|------------|-----|
| `admin` | `admin` | `ROLE_USER` |

### Login (Bash)

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])"
```

### Login (PowerShell)

```powershell
$body = @{ username = "admin"; password = "admin" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.token
Write-Output "Token: $token"
```

Respuesta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

### Uso del token

Incluye el token en el header `Authorization` de cada peticion protegida:

```bash
curl -X GET http://localhost:8080/api/pedidos \
  -H "Authorization: Bearer <token>"
```

---

## Autenticacion (Publica)

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| POST | `/api/auth/login` | Autenticar usuario y obtener JWT |

---

## Endpoints Disponibles

### Pedido

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/pedidos` | Listar todos (paginado) |
| GET    | `/api/pedidos/all` | Listar todos (sin paginacion) |
| GET    | `/api/pedidos/{id}` | Obtener por ID |
| POST   | `/api/pedidos` | Crear nuevo registro |
| PUT    | `/api/pedidos/{id}` | Actualizar registro |
| DELETE | `/api/pedidos/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `fecha` (LocalDate) — Obligatorio
- `total` (BigDecimal) — Obligatorio

### Cliente

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/clientes` | Listar todos (paginado) |
| GET    | `/api/clientes/all` | Listar todos (sin paginacion) |
| GET    | `/api/clientes/{id}` | Obtener por ID |
| POST   | `/api/clientes` | Crear nuevo registro |
| PUT    | `/api/clientes/{id}` | Actualizar registro |
| DELETE | `/api/clientes/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `email` (String) — Obligatorio
- `telefono` (Integer) — Obligatorio

### Producto

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/productos` | Listar todos (paginado) |
| GET    | `/api/productos/all` | Listar todos (sin paginacion) |
| GET    | `/api/productos/{id}` | Obtener por ID |
| POST   | `/api/productos` | Crear nuevo registro |
| PUT    | `/api/productos/{id}` | Actualizar registro |
| DELETE | `/api/productos/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `nombre` (String) — Obligatorio
- `precio` (BigDecimal) — Obligatorio

### Empleado

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/empleados` | Listar todos (paginado) |
| GET    | `/api/empleados/all` | Listar todos (sin paginacion) |
| GET    | `/api/empleados/{id}` | Obtener por ID |
| POST   | `/api/empleados` | Crear nuevo registro |
| PUT    | `/api/empleados/{id}` | Actualizar registro |
| DELETE | `/api/empleados/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `salario` (BigDecimal) — Obligatorio
- `cargo` (String) — Obligatorio

### Persona

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/personas` | Listar todos (paginado) |
| GET    | `/api/personas/all` | Listar todos (sin paginacion) |
| GET    | `/api/personas/{id}` | Obtener por ID |
| POST   | `/api/personas` | Crear nuevo registro |
| PUT    | `/api/personas/{id}` | Actualizar registro |
| DELETE | `/api/personas/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `nombre` (String) — Obligatorio
- `fechaNacimiento` (String) — Obligatorio

### PedidoProducto

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/pedido_productos` | Listar todos (paginado) |
| GET    | `/api/pedido_productos/all` | Listar todos (sin paginacion) |
| GET    | `/api/pedido_productos/{id}` | Obtener por ID |
| POST   | `/api/pedido_productos` | Crear nuevo registro |
| PUT    | `/api/pedido_productos/{id}` | Actualizar registro |
| DELETE | `/api/pedido_productos/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `cantidad` (Integer) — Obligatorio
- `subtotal` (BigDecimal) — Obligatorio


---

## Seguridad

- **CSRF deshabilitado** (API stateless)
- **Sesiones stateless** (JWT)
- **CORS habilitado** para `*`
- **Form login y HTTP Basic deshabilitados**

---

## IA Local (Motor de Reglas)

El backend incluye un endpoint de IA local basado en un motor de reglas simple, sin dependencias externas. Funciona 100% offline.

### Como funciona

1. **AiQueryService** analiza la consulta del usuario con coincidencia de keywords.
2. Detecta la intencion (saludo, listar entidades, ayuda, etc.) y genera una respuesta contextual.
3. Usa los nombres de entidades del diagrama para personalizar las respuestas.

### Endpoints

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| POST | `/api/ai/query` | Enviar consulta en lenguaje natural |

### Intenciones Soportadas

| Intencion | Ejemplo | Respuesta |
|-----------|---------|-----------|
| Saludo | "hola", "buenos dias" | Saludo amigable y presentacion |
| Listar entidades | "entidades", "que hay" | Lista las entidades del sistema |
| Ayuda | "ayuda", "help" | Muestra comandos disponibles |
| Crear registro | "crear", "nuevo" | Instrucciones POST con ejemplos |
| Consultar registro | "buscar", "ver detalle" | Instrucciones GET por ID |
| Eliminar registro | "eliminar", "borrar" | Instrucciones DELETE |
| Estadisticas | "cuantos", "metricas" | Metricas del sistema |
| Desconocido | (cualquier otra cosa) | Mensaje de ayuda con sugerencias |

### Ejemplo de Uso (Bash)

```bash
# Login y guardar token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# Saludo
curl -X POST http://localhost:8080/api/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "hola"}'

# Listar entidades
curl -X POST http://localhost:8080/api/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "listar entidades"}'

# Ayuda
curl -X POST http://localhost:8080/api/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "ayuda"}'

# Crear registro
curl -X POST http://localhost:8080/api/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "crear registro"}'
```

### Ejemplo de Uso (PowerShell)

```powershell
$body = @{ query = "hola" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/api/ai/query" -Method Post -Body $body -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" }
```

### Arquitectura IA

```
ai/
├── AiQueryService.java      # Motor de reglas + logica de negocio
├── AiController.java        # Endpoint REST
└── AiQueryRequest.java      # DTO de entrada
```

---

## Estructura del Proyecto

```
src/
├── main/
│   ├── java/com/example/demo/
│   │   ├── ai/              # IA local (motor de reglas)
│   │   ├── config/          # Configuracion global (excepciones, CORS)
│   │   ├── controller/      # Controladores REST
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── model/           # Entidades JPA
│   │   ├── repository/      # Repositorios Spring Data JPA
│   │   ├── security/        # JWT, filtros, configuracion de seguridad
│   │   ├── service/         # Logica de negocio
│   │   └── DemoApplication.java
│   └── resources/
│       └── application.properties
└── test/
```

---

## Pruebas Rapidas

### Opcion A: Bash (Linux/macOS/Git Bash/WSL)

```bash
# 1. Login y guardar token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo "Token: $TOKEN"
```

### Opcion B: PowerShell (Windows)

```powershell
# 1. Login y guardar token
$body = @{ username = "admin"; password = "admin" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.token
Write-Output "Token: $token"
```

> **Nota:** Los IDs en los ejemplos usan `<uuid>` como placeholder. Reemplazalo con el UUID real al probar.

### Pedido (`/api/pedidos`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedidos

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedidos/all

# Crear
curl -X POST http://localhost:8080/api/pedidos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fecha": "2024-01-01", "total": 9.99}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedidos/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/pedidos/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fecha": "2024-01-01", "total": 9.99}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedidos/<uuid>
```

### Cliente (`/api/clientes`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/clientes

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/clientes/all

# Crear
curl -X POST http://localhost:8080/api/clientes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "valor_email", "telefono": 1}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/clientes/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/clientes/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "valor_email", "telefono": 1}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/clientes/<uuid>
```

### Producto (`/api/productos`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/productos

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/productos/all

# Crear
curl -X POST http://localhost:8080/api/productos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "valor_nombre", "precio": 9.99}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/productos/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/productos/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "valor_nombre", "precio": 9.99}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/productos/<uuid>
```

### Empleado (`/api/empleados`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/empleados

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/empleados/all

# Crear
curl -X POST http://localhost:8080/api/empleados \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"salario": 9.99, "cargo": "valor_cargo"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/empleados/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/empleados/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"salario": 9.99, "cargo": "valor_cargo"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/empleados/<uuid>
```

### Persona (`/api/personas`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/personas

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/personas/all

# Crear
curl -X POST http://localhost:8080/api/personas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "valor_nombre", "fechaNacimiento": "valor_fechaNacimiento"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/personas/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/personas/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "valor_nombre", "fechaNacimiento": "valor_fechaNacimiento"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/personas/<uuid>
```

### PedidoProducto (`/api/pedido_productos`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedido_productos

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedido_productos/all

# Crear
curl -X POST http://localhost:8080/api/pedido_productos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 1, "subtotal": 9.99}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedido_productos/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/pedido_productos/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cantidad": 1, "subtotal": 9.99}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/pedido_productos/<uuid>
```


---

*Generado automaticamente por **CASE Tool** — Generador de Backends Colaborativo*
