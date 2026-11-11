# Auditoría del Generador de Código — Nombres Mixtos y Compilación

**Fecha:** 2026-11-01  
**Motor:** Node.js + Handlebars + Archiver  
**Java:** OpenJDK 21.0.12.1  
**Maven:** Apache Maven 3.9.16  
**Prueba:** AST con nombres mixtos, relación N:M y relación N:1; generación, inspección del proyecto y `mvn clean package -DskipTests`.

---

## 1. AST de estrés utilizado

| Elemento | Nombre |
|---|---|
| Entidad | `Order Details` |
| Entidad | `Shopping Cart` |
| Entidad | `Cliente` |
| Entidad | `Pedido_Especial` |
| Atributo compuesto | `fecha_de_creacion` (`Date`) |
| Relación N:1 | `Pedido_Especial` → `Cliente` |
| Relación N:M | `Order Details` ↔ `Shopping Cart` |

La prueba se ejecutó con el generador real (`backend/generator/generate.js`), no con mocks.

---

## 2. Matriz de resultados

| Verificación | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Archivos `.java` sin espacios | `OrderDetails.java`, `ShoppingCart.java`, `Cliente.java`, `PedidoEspecial.java` | Los cuatro archivos existen con esos nombres | PASS |
| PascalCase en clases | `public class OrderDetails`, `ShoppingCart`, `PedidoEspecial` | Generado correctamente | PASS |
| `@Table` en snake_case | `@Table(name = "order_details")` | `@Table(name = "order_details")` | PASS |
| Ruta de `Order Details` | `/api/order_details` | `@RequestMapping("/api/order_details")` | PASS |
| Ruta de `Cliente` | `/api/clientes` | `@RequestMapping("/api/clientes")` | PASS |
| Tabla intermedia N:M | `order_details_shopping_cart` | `CREATE TABLE IF NOT EXISTS order_details_shopping_cart` | PASS |
| Entidad intermedia explícita | Archivo Java generado | `OrderDetailsShoppingCart.java` | PASS |
| `@ManyToMany` JPA | No usar `@ManyToMany` | No aparece en el código generado | PASS |
| Atributo `fecha_de_creacion` | Columna `fecha_de_creacion` y Java `LocalDate` | `@Column(name = "fecha_de_creacion")` + `private LocalDate fechaDeCreacion;` | PASS |
| Columna SQL de fecha | `fecha_de_creacion DATE NOT NULL` | Generada como `fecha_de_creacion DATE NOT NULL` | PASS |
| Relación N:1 | `@ManyToOne` + `@JoinColumn(name = "cliente_id")` | `PedidoEspecial` apunta a `Cliente` con `@JoinColumn(name = "cliente_id")` | PASS |
| Handlebars y genéricos | Sin `&lt;` ni entidades HTML | No se encontraron `&lt;` en el código Java | PASS |
| Estructura del ZIP | `pom.xml`, properties, controller, service, repository y model | Todos presentes | PASS |
| Compilación Java 21 | `BUILD SUCCESS` | `mvn clean package -DskipTests` → `BUILD SUCCESS` | PASS |

---

## 3. Corrección aplicada

### 3.1 Rutas plurales duplicadas

`toPluralRoute` añadía siempre una `s`, produciendo rutas como `order_detailss` cuando el nombre ya terminaba en `s`. Se corrigió para no duplicar la marca de plural:

```js
function toPluralRoute(name) {
  const snake = toSnakeCase(name);
  // Evita duplicar la marca de plural cuando el nombre ya termina en s:
  // "Order Details" -> "order_details", no "order_detailss".
  return snake.endsWith('s') ? snake : snake + 's';
}
```

También se actualizó `sanitizeEntities` para usar `toPluralRoute(name)` en la ruta REST de cada entidad, en lugar de concatenar `s` directamente.

---

## 4. Compilación

Comando ejecutado dentro del proyecto generado:

```bash
mvn clean package -DskipTests
```

Resultado:

```text
Compiling 37 source files with javac [debug parameters release 21]
...
[INFO] Building jar: target/generated-backend-0.0.1-SNAPSHOT.jar
[INFO] BUILD SUCCESS
[INFO] Total time: 9.672 s
MAVEN_EXIT 0
```

El proyecto compiló sin errores de Handlebars, sintaxis Java, JPA ni HTML escapado.

---

## 5. Conclusiones

- El sanitizador convierte correctamente nombres con espacios, guiones bajos y mezcla de idiomas a identificadores Java válidos.
- Las tablas, rutas y columnas usan `snake_case`.
- El atributo `fecha_de_creacion` conserva el nombre de columna y se mapea a `LocalDate`.
- La relación N:M se expande como entidad intermedia explícita; no se emite `@ManyToMany`.
- La relación N:1 genera `@ManyToOne` y `@JoinColumn(name = "cliente_id")`.
- El ZIP generado contiene la estructura mínima de Spring Boot y compila con Java 21.

**Veredicto:** el generador está listo para la demostración con nombres mixtos; la prueba terminó en `BUILD SUCCESS`.
