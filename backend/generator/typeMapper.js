// Traduce los tipos del editor (ej. "String") a SQL y Java.
// Es la UNICA tabla de tipos del generador: si agregas un tipo nuevo,
// agregalo aqui y llega solo a entidades, DTOs y migraciones.
// Tipos desconocidos caen a VARCHAR/String para no romper la generacion.
const typeMapper = {
  String: { sql: 'VARCHAR(255)', java: 'String' },
  Integer: { sql: 'INTEGER', java: 'Integer' },
  Long: { sql: 'BIGINT', java: 'Long' },
  UUID: { sql: 'UUID', java: 'UUID' },
  BigDecimal: { sql: 'NUMERIC(19,2)', java: 'BigDecimal' },
  Date: { sql: 'DATE', java: 'LocalDate' },
  Boolean: { sql: 'BOOLEAN', java: 'Boolean' },
};

// Tipo SQL para la migracion (ej. "String" -> "VARCHAR(255)").
// Fallback VARCHAR: un tipo raro genera columna de texto, no un crash.
function getSqlType(diagramType) {
  return typeMapper[diagramType]?.sql || 'VARCHAR(255)';
}

// Tipo Java para entidades y DTOs (ej. "Date" -> "LocalDate").
// Fallback String por la misma razon que arriba.
function getJavaType(diagramType) {
  return typeMapper[diagramType]?.java || 'String';
}

module.exports = { getSqlType, getJavaType };