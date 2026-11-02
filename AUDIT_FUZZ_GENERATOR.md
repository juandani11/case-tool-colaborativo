# Fuzz Testing del Generador de Código — Nombres Extremos

**Fecha:** 2026-11-01  
**Generador:** `backend/generator/generate.js`  
**Java:** OpenJDK 21.0.12.1  
**Maven:** 3.9.16  
**Prueba:** generación real, inspección del proyecto y `mvn clean package -DskipTests`.

---

## 1. Reglas de sanitización implementadas

| Regla | Implementación | Ejemplo |
|---|---|---|
| Quitar acentos y separar palabras | Normalización NFD + eliminación de diacríticos + separación por no alfanuméricos | `Canción` → `Cancion` |
| Transliterar la ñ | `ñ` → `ni`, `Ñ` → `Ni` antes de quitar diacríticos | `AñoFiscal` → `AnioFiscal`; tabla `anio_fiscal` |
| Inicio con número | Prefijo `V` cuando el identificador comienza con dígito | `1Order` → `V1Order` |
| Palabra reservada Java | Sufijo `Entity` si el identificador coincide con una keyword Java | `Class` → `ClassEntity`; `Public` → `PublicEntity` |
| Nombre vacío o solo símbolos | Fallback `Entidad` para entidades y `Atributo` para atributos | `!!!` → `Entidad`; `___` → `Entidad2` |
| Colisión de entidades | Sufijo numérico incremental | `Entidad`, `Entidad2` |
| Colisión de rutas | Sufijo numérico sobre la ruta base | `/api/unnamed`, `/api/unnamed2` |
| Snake case con dígitos | Separación entre dígito y mayúscula | `V1Order` → `v1_order` |
| Ruta plural | No duplica la `s` si el nombre ya termina en `s` | `Order Details` → `/api/order_details` |
| Fallback de ruta | `unnamed` si no hay palabras | `!!!` → `/api/unnamed` |
| Atributo inválido | Prefijo `V` y fallback `Atributo` | `2da_vez` → `v2daVez` / `v2da_vez` |
| Atributo keyword | Sufijo `Entity` | `class` → `classEntity` / `class_entity` |

La metadata `originalName` conserva el nombre visible; React Flow sigue mostrando `AñoFiscal`, `Class`, etc. Solo se sanitiza el código generado.

---

## 2. AST de fuzz utilizado

Entidades:

- `1Order`
- `Class`
- `Interface`
- `Public`
- `Cliente@Local`
- `Producto#1`
- `Usuario&Pass`
- `AñoFiscal`
- `Canción`
- `Niño`
- `!!!`
- `___`
- `  Orden   de   Compra  `
- Cadena de 100 caracteres `A...`

Relaciones:

- `1Order` → `Cliente@Local` (`MANY_TO_ONE`).
- `AñoFiscal` ↔ `!!!` (`MANY_TO_MANY`).

Atributos problemáticos:

- `2da_vez` (`Date`).
- `class` (`String`).

---

## 3. Resultados de sanitización

| Entrada | Clase generada | Tabla generada | Ruta generada |
|---|---|---|---|
| `1Order` | `V1Order` | `v1_order` | `/api/v1_orders` |
| `Class` | `ClassEntity` | `class_entity` | `/api/class_entitys` |
| `Interface` | `InterfaceEntity` | `interface_entity` | `/api/interface_entitys` |
| `Public` | `PublicEntity` | `public_entity` | `/api/public_entitys` |
| `Cliente@Local` | `ClienteLocal` | `cliente_local` | `/api/cliente_locals` |
| `Producto#1` | `Producto1` | `producto1` | `/api/producto1s` |
| `Usuario&Pass` | `UsuarioPass` | `usuario_pass` | `/api/usuario_pass` |
| `AñoFiscal` | `AnioFiscal` | `anio_fiscal` | `/api/anio_fiscals` |
| `Canción` | `Cancion` | `cancion` | `/api/cancions` |
| `Niño` | `Ninio` | `ninio` | `/api/ninios` |
| `!!!` | `Entidad` | `entidad` | `/api/unnamed` |
| `___` | `Entidad2` | `entidad2` | `/api/unnamed2` |
| `  Orden   de   Compra  ` | `OrdenDeCompra` | `orden_de_compra` | `/api/orden_de_compras` |
| 100 caracteres `A...` | `Aaaaa...` | `aaaa...` | `/api/aaaa...s` |

Atributos:

| Entrada | Campo Java | Columna SQL |
|---|---|---|
| `2da_vez` | `v2daVez` | `v2da_vez` |
| `class` | `classEntity` | `class_entity` |

---

## 4. Matriz de verificación

| Escenario | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|
| Clase que inicia con número | Identificador Java válido | `V1Order.java` | PASS |
| Keyword Java como clase | Nombre válido | `ClassEntity`, `InterfaceEntity`, `PublicEntity` | PASS |
| Símbolos especiales | Identificador limpio | `ClienteLocal`, `Producto1`, `UsuarioPass` | PASS |
| Acentos y ñ | Sin diacríticos y tabla snake_case | `AnioFiscal` / `anio_fiscal`, `Cancion`, `Ninio` | PASS |
| Solo símbolos | Fallback no vacío | `Entidad`, `Entidad2` | PASS |
| Fallback de rutas único | Sin colisión de `@RequestMapping` | `/api/unnamed`, `/api/unnamed2` | PASS |
| Espacios múltiples | PascalCase limpio | `OrdenDeCompra` | PASS |
| Nombre de 100 caracteres | Archivo y clase válidos | Archivo generado con nombre sanitizado | PASS |
| Atributo `2da_vez` | Campo y columna válidos | `v2daVez` / `v2da_vez` | PASS |
| Atributo `class` | Campo y columna válidos | `classEntity` / `class_entity` | PASS |
| Relación N:1 | JPA válido | `@ManyToOne` generado; compilación correcta | PASS |
| Relación N:M | Tabla intermedia | `anio_fiscal_entidad` | PASS |
| Handlebars | Sin entidades HTML | No se encontraron `&lt;` ni `&gt;` | PASS |
| Compilación | `BUILD SUCCESS` | `mvn clean package -DskipTests` | PASS |

---

## 5. Evidencia de compilación

```text
Compiling ... source files with javac [debug parameters release 21]
[INFO] Building jar: target/generated-backend-0.0.1-SNAPSHOT.jar
[INFO] BUILD SUCCESS
[INFO] Total time: 10.884 s
MAVEN_EXIT 0
```

La compilación se ejecutó sobre el proyecto generado por el AST de fuzz, no sobre un proyecto de ejemplo separado.

---

## 6. Correcciones aplicadas

| Archivo | Corrección |
|---|---|
| `backend/generator/generate.js` | `JAVA_KEYWORDS`, prefijo `V` para inicio numérico, sufijo `Entity` para keywords y fallback `Entidad` |
| `backend/generator/generate.js` | Fallback `Atributo` para atributos y prefijo `V` en campos inválidos |
| `backend/generator/generate.js` | Transliteración `ñ` → `ni`; `AñoFiscal` genera `anio_fiscal` |
| `backend/generator/generate.js` | Snake case entre dígito y mayúscula; `V1Order` genera `v1_order` |
| `backend/generator/generate.js` | `toPluralRoute` no duplica `s`; fallback `unnamed` |
| `backend/generator/generate.js` | Unicidad de rutas en `sanitizeEntities`; evita `@RequestMapping` duplicados |
| `backend/generator/generate.js` | Fallbacks de nombre para PK y atributos |

---

## 7. Conclusión

El generador resistió nombres con números iniciales, keywords Java, símbolos, acentos, ñ, espacios múltiples, cadenas largas y atributos inválidos. El proyecto generado compiló con Java 21 y Maven sin errores. Las rutas, tablas, columnas y clases quedaron en formatos válidos, mientras los nombres visibles se conservan en `originalName` para React Flow.

**Veredicto:** `BUILD SUCCESS` en la prueba de fuzz; el generador está preparado para nombres extremos en la demostración.
