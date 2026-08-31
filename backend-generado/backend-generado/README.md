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
curl -X GET http://localhost:8080/api/users \
  -H "Authorization: Bearer <token>"
```

---

## Autenticacion (Publica)

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| POST | `/api/auth/login` | Autenticar usuario y obtener JWT |

---

## Endpoints Disponibles

### User

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/users` | Listar todos (paginado) |
| GET    | `/api/users/all` | Listar todos (sin paginacion) |
| GET    | `/api/users/{id}` | Obtener por ID |
| POST   | `/api/users` | Crear nuevo registro |
| PUT    | `/api/users/{id}` | Actualizar registro |
| DELETE | `/api/users/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `name` (String) — Obligatorio
- `email` (String) — Obligatorio
- `createdAt` (LocalDate) — Obligatorio

### Product

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/products` | Listar todos (paginado) |
| GET    | `/api/products/all` | Listar todos (sin paginacion) |
| GET    | `/api/products/{id}` | Obtener por ID |
| POST   | `/api/products` | Crear nuevo registro |
| PUT    | `/api/products/{id}` | Actualizar registro |
| DELETE | `/api/products/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `name` (String) — Obligatorio
- `price` (BigDecimal) — Obligatorio
- `categoryId` (UUID) — Obligatorio

### Order

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/orders` | Listar todos (paginado) |
| GET    | `/api/orders/all` | Listar todos (sin paginacion) |
| GET    | `/api/orders/{id}` | Obtener por ID |
| POST   | `/api/orders` | Crear nuevo registro |
| PUT    | `/api/orders/{id}` | Actualizar registro |
| DELETE | `/api/orders/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `userId` (UUID) — Obligatorio
- `orderDate` (LocalDate) — Obligatorio
- `totalAmount` (BigDecimal) — Obligatorio

### OrderItem

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/orderitems` | Listar todos (paginado) |
| GET    | `/api/orderitems/all` | Listar todos (sin paginacion) |
| GET    | `/api/orderitems/{id}` | Obtener por ID |
| POST   | `/api/orderitems` | Crear nuevo registro |
| PUT    | `/api/orderitems/{id}` | Actualizar registro |
| DELETE | `/api/orderitems/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `orderId` (UUID) — Obligatorio
- `productId` (UUID) — Obligatorio
- `quantity` (Integer) — Obligatorio
- `unitPrice` (BigDecimal) — Obligatorio

### Category

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET    | `/api/categories` | Listar todos (paginado) |
| GET    | `/api/categories/all` | Listar todos (sin paginacion) |
| GET    | `/api/categories/{id}` | Obtener por ID |
| POST   | `/api/categories` | Crear nuevo registro |
| PUT    | `/api/categories/{id}` | Actualizar registro |
| DELETE | `/api/categories/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `name` (String) — Obligatorio


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

### User (`/api/users`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users/all

# Crear
curl -X POST http://localhost:8080/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name", "email": "valor_email", "createdAt": "2024-01-01"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/users/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name", "email": "valor_email", "createdAt": "2024-01-01"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users/<uuid>
```

### Product (`/api/products`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/products

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/products/all

# Crear
curl -X POST http://localhost:8080/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name", "price": 9.99, "categoryId": "valor"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/products/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/products/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name", "price": 9.99, "categoryId": "valor"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/products/<uuid>
```

### Order (`/api/orders`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orders

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orders/all

# Crear
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "valor", "orderDate": "2024-01-01", "totalAmount": 9.99}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orders/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/orders/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "valor", "orderDate": "2024-01-01", "totalAmount": 9.99}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orders/<uuid>
```

### OrderItem (`/api/orderitems`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orderitems

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orderitems/all

# Crear
curl -X POST http://localhost:8080/api/orderitems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "valor", "productId": "valor", "quantity": 1, "unitPrice": 9.99}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orderitems/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/orderitems/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "valor", "productId": "valor", "quantity": 1, "unitPrice": 9.99}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/orderitems/<uuid>
```

### Category (`/api/categories`)

```bash
# Listar (paginado)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/categories

# Listar todos
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/categories/all

# Crear
curl -X POST http://localhost:8080/api/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/categories/<uuid>

# Actualizar
curl -X PUT http://localhost:8080/api/categories/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/categories/<uuid>
```


---

*Generado automaticamente por **CASE Tool** — Generador de Backends Colaborativo*
