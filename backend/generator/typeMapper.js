// Mapeo de tipos del diagrama a tipos SQL y Java
const typeMapper = {
  String: { sql: 'VARCHAR(255)', java: 'String' },
  Integer: { sql: 'INTEGER', java: 'Integer' },
  Long: { sql: 'BIGINT', java: 'Long' },
  UUID: { sql: 'UUID', java: 'UUID' },
  BigDecimal: { sql: 'NUMERIC(19,2)', java: 'BigDecimal' },
  Date: { sql: 'DATE', java: 'LocalDate' },
  Boolean: { sql: 'BOOLEAN', java: 'Boolean' },
};

function getSqlType(diagramType) {
  return typeMapper[diagramType]?.sql || 'VARCHAR(255)';
}

function getJavaType(diagramType) {
  return typeMapper[diagramType]?.java || 'String';
}

module.exports = { getSqlType, getJavaType };