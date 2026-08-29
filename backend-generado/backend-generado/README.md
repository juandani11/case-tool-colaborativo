# generated-backend

Backend generado automáticamente a partir de un diagrama de entidades (AST). Basado en **Spring Boot 4.0.0**, **Java 21**, **PostgreSQL 18**, **Spring Security 7**, **JPA/Hibernate** y **JWT**.

---

## Requisitos

- **Java 21** (JDK)
- **Maven 3.9+**
- **PostgreSQL 18** (base de datos accesible)
- Puerto **8080** libre

---

## Configuración de Base de Datos

Por defecto, la aplicación espera una base de datos PostgreSQL con:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/diagramdb
spring.datasource.username=postgres
spring.datasource.password=postgres
```

Si necesitas cambiar la configuración, edita `src/main/resources/application.properties` o define variables de entorno:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/tu_bd
export DB_USER=tu_usuario
export DB_PASS=tu_password
```

---

## Ejecución

```bash
# Compilar y ejecutar
mvn spring-boot:run
```

La aplicación se inicia en `http://localhost:8080`.

---

## Esquema de Base de Datos

El esquema se crea y actualiza automáticamente con Hibernate (`spring.jpa.hibernate.ddl-auto=update`). No se utilizan migraciones Flyway en esta versión.

---

## Autenticación (JWT)

El backend usa **autenticación stateless con JWT**. El usuario por defecto es:

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin` | `ROLE_USER` |

### Login (Bash con Python)

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | python -c "import sys, json; print(json.load(sys.stdin)['token'])"
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

Incluye el token en el header `Authorization` de cada petición protegida:

```bash
curl -X GET http://localhost:8080/api/entityas \
  -H "Authorization: Bearer <token>"
```

---

## Endpoints Disponibles

### EntityA

| Método | URL | Descripción |
|--------|-----|-------------|
| GET    | `/api/entityas` | Listar todos los registros |
| GET    | `/api/entityas/{id}` | Obtener por ID |
| POST   | `/api/entityas` | Crear nuevo registro |
| PUT    | `/api/entityas/{id}` | Actualizar registro |
| DELETE | `/api/entityas/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `name` (String)

### EntityB

| Método | URL | Descripción |
|--------|-----|-------------|
| GET    | `/api/entitybs` | Listar todos los registros |
| GET    | `/api/entitybs/{id}` | Obtener por ID |
| POST   | `/api/entitybs` | Crear nuevo registro |
| PUT    | `/api/entitybs/{id}` | Actualizar registro |
| DELETE | `/api/entitybs/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `name` (String)

### EntityC

| Método | URL | Descripción |
|--------|-----|-------------|
| GET    | `/api/entitycs` | Listar todos los registros |
| GET    | `/api/entitycs/{id}` | Obtener por ID |
| POST   | `/api/entitycs` | Crear nuevo registro |
| PUT    | `/api/entitycs/{id}` | Actualizar registro |
| DELETE | `/api/entitycs/{id}` | Eliminar registro |

**Campos del DTO:**
- `id` (UUID) — Clave primaria (autogenerada)
- `name` (String)


---

## Autenticación (Pública)

| Método | URL | Descripción |
|--------|-----|-------------|
| POST   | `/api/auth/login` | Autenticar usuario y obtener JWT |

---

## Seguridad

- **CSRF deshabilitado** (API stateless)
- **Sesiones stateless** (JWT)
- **CORS habilitado** para `*`
- **Form login y HTTP Basic deshabilitados**

---

## Estructura del Proyecto

```
src/
├── main/
│   ├── java/com/example/demo/
│   │   ├── config/          # Configuración global (excepciones, CORS)
│   │   ├── controller/      # Controladores REST
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── entity/          # Entidades JPA
│   │   ├── repository/      # Repositorios Spring Data JPA
│   │   ├── security/        # JWT, filtros, configuración de seguridad
│   │   ├── service/         # Lógica de negocio
│   │   └── DemoApplication.java
│   └── resources/
│       └── application.properties
└── test/
```

---

## Pruebas Rápidas

### Opción A: Bash (Linux/macOS/Git Bash/WSL)

```bash
# 1. Login y guardar token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo "Token: $TOKEN"
```

### Opción B: PowerShell (Windows)

```powershell
# 1. Login y guardar token
$body = @{ username = "admin"; password = "admin" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.token
Write-Output "Token: $token"
```

### EntityA (`/api/entityas`)

```bash
# Listar
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entityas

# Crear
curl -X POST http://localhost:8080/api/entityas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entityas/<id>

# Actualizar
curl -X PUT http://localhost:8080/api/entityas/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entityas/<id>
```

### EntityB (`/api/entitybs`)

```bash
# Listar
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entitybs

# Crear
curl -X POST http://localhost:8080/api/entitybs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entitybs/<id>

# Actualizar
curl -X PUT http://localhost:8080/api/entitybs/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entitybs/<id>
```

### EntityC (`/api/entitycs`)

```bash
# Listar
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entitycs

# Crear
curl -X POST http://localhost:8080/api/entitycs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Obtener por ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entitycs/<id>

# Actualizar
curl -X PUT http://localhost:8080/api/entitycs/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "valor_name"}'

# Eliminar
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/entitycs/<id>
```


---

*Generado automáticamente por **CASE Tool** — Generador de Backends Colaborativo*