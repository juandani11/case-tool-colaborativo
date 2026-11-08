# Auditoría XMI y compatibilidad con Enterprise Architect

Fecha: 2026-11-07  
Archivo corregido: `frontend/src/utils/xmiExporter.ts`  
Prueba generada: `C:\Users\HP\AppData\Local\Temp\opencode\xmi-export-test.xmi`

## 1. Hallazgos de la auditoría

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | El encabezado no declaraba `xmlns:umldi` ni `xmlns:dc`. | No había sección de Diagram Interchange. |
| 2 | No existía bloque UMLDI ni geometría de elementos/conectores. | EA importaba clases, pero no dibujaba relaciones. |
| 3 | Los `ownedEnd` no tenían `association` como back-reference. | EA podía ignorar las asociaciones estándar. |
| 4 | El `type` del extremo se enviaba como atributo; EA 2.5.1 espera `<type xmi:idref="..."/>`. | Riesgo de no resolver el extremo de la asociación. |
| 5 | EA no procesa su extensión propietaria si `xmi:version` está en el nodo raíz `xmi:XMI`. | El diagrama y los conectores se importaban sin geometría o no se dibujaban. |
| 6 | La extensión EA necesita `exporter="Enterprise Architect"` y `exporterVersion="6.5"`. | Sin esos valores, EA no reconstruye el diagrama desde `xmi:Extension`. |
| 7 | La geometría de conector en la extensión EA debe ir en `SX=0;SY=0;EX=0;EY=0;Path=;` para que EA auto-route. | Valores absolutos no alineados dejaban las líneas fuera de los nodos. |

## 2. Correcciones aplicadas

### Encabezado

Se mantienen los namespaces XMI/UML 2.5.1 y se agregan:

```xml
xmlns:umldi="http://www.omg.org/spec/UML/20131001/UMLDI"
xmlns:dc="http://www.omg.org/spec/UML/20131001/UMLDC"
```

La versión 2.5.1 se declara en el encabezado:

```xml
<xmi:Documentation exporter="Enterprise Architect"
                    exporterVersion="6.5"
                    xmi:version="2.5.1"/>
```

> Limitación real de EA: si `xmi:version="2.5.1"` se coloca en `<xmi:XMI>`, EA ignora la extensión propietaria y no reconstruye el diagrama. Por eso la versión queda declarada en `xmi:Documentation`, conservando la semántica XMI 2.5.1.

### Modelo UML

- Clases: `<packagedElement xmi:type="uml:Class">`.
- Interfaces: `<packagedElement xmi:type="uml:Interface">`.
- Asociaciones: `<packagedElement xmi:type="uml:Association">`.
- Herencia: `<packagedElement xmi:type="uml:Generalization">`.
- Orden correcto: `<memberEnd>` antes de `<ownedEnd>`.
- Cada `ownedEnd` incluye:
  - `xmi:type="uml:Property"`.
  - `association="<id-asociacion>"`.
  - `<type xmi:idref="<id-clase>"/>`.
  - Multiplicidades `lowerValue`/`upperValue`.

### UMLDI

Se agrega un bloque `umldi:Diagram` con:

- `umldi:UMLClassifierShape` y `dc:bounds` por clase.
- `umldi:UMLEdge` por relación, con `source`, `target`, `modelElement` y `geometry`.
- `dc:waypoint` de inicio y fin.
- Geometría no cero en UMLDI:

```text
realiza:  SX=180;SY=130;EX=520;EY=130;
contiene: SX=520;SY=130;EX=860;EY=130;
```

### Extensión EA

Se agrega `xmi:Extension` con:

- `<elements>` para paquete y clases.
- `<links>` por clase.
- `<connectors>` con origen, destino, tipo, modificadores, apariencia y etiqueta.
- `<diagrams>` con:
  - geometría `Left/Top/Right/Bottom` de cada clase;
  - geometría `SX=0;SY=0;EX=0;EY=0;Path=;` de cada conector para auto-routing de EA;
  - `subject` apuntando al ID real de la asociación.

## 3. Prueba generada

Diagrama de prueba:

- 3 clases: `Cliente`, `Pedido`, `Producto`.
- 1 asociación: `Cliente -> Pedido` (`realiza`, `1 -> 0..*`).
- 1 composición: `Pedido -> Producto` (`contiene`, `1 -> 0..*`).

Resultados automáticos:

```text
associations:       2
memberEnds:         4
ownedEnds:          4
uml:Property:       4
umldi diagrams:     1
classifier shapes:  3
uml edges:          2
waypoints:          4
EA extension:       true
XML:                WELL_FORMED
```

## 4. Verificación de importación en Enterprise Architect

Importación realizada con `Project.ImportPackageXMI(..., ImportDiagrams=1, StripGUID=1)` en el proyecto de prueba `docs/import example.eapx`.

Resultado:

```text
Paquete importado:   ModeloExportado
Clases:              3
DataTypes:           3
Conectores:          2
Diagramas:           1
Objetos de diagrama: 3
Enlaces de diagrama: 2
```

Verificación visual:

- Se abrió el diagrama importado en EA.
- Se confirmaron las líneas `Cliente -> Pedido` y `Pedido -> Producto`.
- Se confirmó el rombo de composición en el extremo de `Producto`.
- Se confirmaron las etiquetas `realiza` y `contiene`.
- Se confirmaron las multiplicidades `1` y `0..*`.

El paquete temporal de verificación se elimina después de la prueba para no contaminar el modelo.

## 5. Limitaciones conocidas

- EA no importa diagramas desde UMLDI estándar por sí solo; necesita su bloque `xmi:Extension`.
- La geometría de la extensión EA se deja en cero para que EA auto-route; la geometría no cero exigida queda en la sección UMLDI.
- El vínculo de clase asociativa sigue siendo una limitación conocida del exportador.
- Los diagramas de secuencia/comunicación no forman parte de este exportador de clases.

## 6. Conclusión

El exportador ahora genera:

1. Modelo UML 2.5.1 con clases, atributos, asociaciones, composiciones y herencia.
2. Sección UMLDI con formas, bounds, waypoints y geometría no cero de relaciones.
3. Extensión EA compatible para que las relaciones se dibujen al importar.
4. Documento de auditoría reproducible.

La importación en EA dibuja las relaciones correctamente.

## 7. Refinamiento visual y semántico

### 7.1 Atributos sin `{bag}`

Se corrigió `buildAttribute` para exportar atributos simples como propiedades UML completas:

```xml
<ownedAttribute xmi:type="uml:Property" ...>
  <type xmi:idref="DT_UUID"/>
  <lowerValue ... value="1"/>
  <upperValue ... value="1"/>
</ownedAttribute>
```

Además, la extensión EA incluye `<attributes>` por clase con:

```xml
<properties type="UUID" derived="0" collection="false" .../>
<bounds lower="1" upper="1"/>
```

Resultado verificado en EA: `id: UUID`, `total: BigDecimal`, `nombre: String`, sin sufijo `{bag}`.

### 7.2 Multiplicidades visibles

Se agregó la multiplicidad a la extensión EA:

```xml
<source ...><type multiplicity="1" aggregation="none"/></source>
<target ...><type multiplicity="0..*" aggregation="none"/></target>
<labels mt="realiza" lb="1" rb="0..*"/>
```

Resultado verificado en EA: `1` y `0..*` visibles en los extremos de las relaciones.

### 7.3 Layout ortogonal

Se agregó geometría ortogonal en dos niveles:

- UMLDI: `geometry="SX=...;SY=...;EX=...;EY=...;Waypoints=X:Y,X:Y;"`
- Extensión EA: `Path=X:Y;X:Y;` y estilo `Mode=3;TREE=OS;`.

Las clases de prueba se desplazaron para forzar codos:

- `Cliente`: (80, 80)
- `Pedido`: (420, 240)
- `Producto`: (760, 80)

Resultado verificado en EA: líneas con codos de 90 grados, sin diagonales.

### 7.4 Evidencia final

```text
Clases:            3
Atributos:         3
Conectores:        2
Diagramas:         1
Objetos diagrama:  3
Enlaces diagrama:  2
Estilo de enlace:  8 (Orthogonal Square)
Atributos:         sin {bag}
Multiplicidades:   1 y 0..*
Layout:            ortogonal con codos
```

