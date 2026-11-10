'use strict';

const { getSqlType, getJavaType } = require('./typeMapper');
const { snakeCase, camelCase, toJavaClassName, toJavaFieldName, toSnakeCase, toPluralRoute } = require('./naming');
const { relFromName, relToName, resolveCardinality, isInheritanceRel } = require('./expander');

// Convierte nombres visibles ("Order Details") en identificadores Java
// validos ("OrderDetails"); el visible se conserva en `originalName`.
// Si dos entidades colisionan tras sanitizar, la segunda lleva sufijo
// numerico. Tambien calcula tableName (snake), fieldName (camel) y route.
// Debe correr ANTES de resolver relaciones: todo lo demas usa estos nombres.
function sanitizeEntities(rawEntities) {
  const taken = new Set();
  const takenRoutes = new Set();
  return (rawEntities || []).map((raw, idx) => {
    const base = toJavaClassName(raw.name, 'Entidad');
    let name = base;
    let n = 2;
    while (taken.has(name)) {
      name = base + n;
      n++;
    }
    taken.add(name);

    const baseRoute = toPluralRoute(raw.name);
    let route = baseRoute;
    let routeSuffix = 2;
    while (takenRoutes.has(route)) {
      route = `${baseRoute}${routeSuffix}`;
      routeSuffix++;
    }
    takenRoutes.add(route);

    return {
      ...raw,
      id: raw.id || `entity_${idx}`,
      name,
      originalName: raw.name,
      tableName: snakeCase(name),
      fieldName: camelCase(name),
      route,
      attributes: raw.attributes || [],
    };
  });
}

// Reescribe los extremos de cada relacion a los nombres YA sanitizados
// (via lookup byId/byOriginal/bySanitized). Corre despues de
// sanitizeEntities() y antes de expandManyToMany(): sin esto, una relacion
// que apunta al id o al nombre visible no matchea ninguna entidad.
function normalizeRelationshipEndpoints(rel, lookup) {
  const resolve = (end, flat) => {
    if (flat && lookup.bySanitized[flat]) return flat;
    if (typeof end === 'string') {
      if (lookup.byId[end]) return lookup.byId[end];
      if (lookup.byOriginal[end]) return lookup.byOriginal[end];
      if (lookup.bySanitized[end]) return lookup.bySanitized[end];
      return end;
    }
    if (end && typeof end === 'object') {
      const raw = end.entityName || end.name;
      if (raw) {
        if (lookup.byOriginal[raw]) return lookup.byOriginal[raw];
        if (lookup.bySanitized[raw]) return lookup.bySanitized[raw];
        return raw;
      }
    }
    return null;
  };
  const from = resolve(rel.source, rel.fromEntity);
  const to = resolve(rel.target, rel.toEntity);
  return { ...rel, fromEntity: from, toEntity: to };
}

function buildEntityLookup(sanitizedEntities) {
  const byId = {};
  const byOriginal = {};
  const bySanitized = {};
  for (const e of sanitizedEntities || []) {
    if (e.id) byId[e.id] = e.name;
    if (e.originalName) byOriginal[e.originalName] = e.name;
    bySanitized[e.name] = e.name;
  }
  return { byId, byOriginal, bySanitized };
}

// Calcula TODAS las relaciones de UNA entidad desde su propia perspectiva.
// Cada entrada describe: jpaType (manyToOne/oneToMany/...), la otra entidad,
// la columna FK (cliente_id), quien es dueño (owner = lleva @JoinColumn) y
// el mappedBy del lado inverso. Las plantillas solo interpolan estos datos:
// no deciden nada de JPA aqui. La rama manyToMany es legacy (las * a *
// ya se expandieron antes de llegar).
function buildEntityRelations(entity, allEntities, allRelationships) {
  const entityName = entity.name;
  const results = [];

  for (const rel of allRelationships) {
    // La herencia se mapea con @Inheritance/@PrimaryKeyJoinColumn.
    // No debe generar ademas @OneToOne/@ManyToOne entre padre e hijo.
    // Acepta también "GENERALIZATION" o el tipo visual "inheritance".
    if (isInheritanceRel(rel)) continue;

    const fromName = relFromName(rel, allEntities);
    const toName = relToName(rel, allEntities);
    const isSource = fromName === entityName;
    const isTarget = toName === entityName;
    if (!isSource && !isTarget) continue;

    const otherName = isSource ? toName : fromName;
    const otherEntity = allEntities.find(e => e.name === otherName);

    const cardFrom = rel.cardinalityFrom || '1';
    const cardTo = rel.cardinalityTo || '1';

    // Determine JPA type from THIS entity's perspective
    let jpaType;
    if (isSource) {
      jpaType = resolveCardinality(cardFrom, cardTo);
    } else {
      jpaType = resolveCardinality(cardTo, cardFrom);
    }

    const otherNamePascal = toJavaClassName(otherName);
    const otherNameCamel = toJavaFieldName(otherName);
    const thisNameCamel = toJavaFieldName(entityName);

    // FK column name (snake_case for SQL, sanitized)
    const fkColumn = toSnakeCase(otherName) + '_id';

    // ManyToMany metadata
    const mtmTableName = snakeCase(thisNameCamel) + '_' + snakeCase(otherNameCamel);
    const mtmJoinCol = snakeCase(otherNameCamel) + '_id';
    const mtmInverseJoinCol = snakeCase(thisNameCamel) + '_id';

    // Determine if this side is the OWNING side
    // JPA rule: the side with the @JoinColumn is the owner
    // For OneToOne: the side with FK is owner
    // For OneToMany/ManyToOne: the Many side is owner
    // For ManyToMany: the source side is owner (by convention)
    let isOwner = false;
    let mappedBy = null;

    switch (jpaType) {
      case 'oneToOne':
        // If the other side also has a OneToOne, the one with FK is owner
        // Since we're generating from AST, we make the source the owner.
        // mappedBy en el lado inverso apunta al campo de la entidad dueña,
        // que lleva el nombre de ESTA entidad en minúsculas.
        isOwner = isSource;
        mappedBy = isOwner ? null : thisNameCamel;
        break;
      case 'manyToOne':
        isOwner = true;
        break;
      case 'oneToMany':
        // mappedBy apunta al campo @ManyToOne del hijo, que se llama
        // como esta entidad (el padre) en minúsculas.
        isOwner = false;
        mappedBy = thisNameCamel;
        break;
      case 'manyToMany':
        // Obsoleto: las relaciones * a * se expanden a entidad intermedia
        // antes de llegar aquí (ver expandManyToMany). Se conserva por
        // compatibilidad pero no debe generarse código nuevo con @ManyToMany.
        isOwner = isSource;
        mappedBy = isOwner ? null : otherNameCamel + 'Set';
        break;
    }

    const otherPkAttr = otherEntity ? otherEntity.attributes.find(a => a.isPk) : null;
    const otherPkSqlType = otherPkAttr ? getSqlType(otherPkAttr.type) : 'BIGINT';
    // Tipo SQL de la columna FK según el PK referenciado (UUID -> UUID, resto -> BIGINT)
    const fkSqlType = otherPkSqlType === 'UUID' ? 'UUID' : 'BIGINT';

    // Deduplicación para el DTO: si la entidad ya declara un atributo con el
    // mismo nombre que el campo FK auto-generado (ej. atributo "customerId"
    // + @ManyToOne Customer), el DTO reutiliza el atributo y NO emite otro.
    let dtoFkTaken = false;
    if (jpaType === 'manyToOne' || jpaType === 'oneToOne') {
      const attrNames = new Set(
        (entity.attributes || []).map(a => toJavaFieldName(a.name, 'Atributo'))
      );
      dtoFkTaken = attrNames.has(`${otherNameCamel}Id`);
    }

    results.push({
      jpaType,
      otherEntity: otherName,
      otherEntityPascal: otherNamePascal,
      otherEntityCamel: otherNameCamel,
      otherEntityCamelPlural: otherNameCamel + 's',
      otherEntityTable: (otherEntity && otherEntity.tableName) || snakeCase(otherName),
      otherEntityPkType: otherPkAttr ? getJavaType(otherPkAttr.type) : 'Long',
      fkColumn,
      fkSqlType,
      dtoFkTaken,
      isOwner,
      mappedBy,
      relationshipType: isInheritanceRel(rel) ? 'INHERITANCE' : rel.type,
      cardinalityFrom: cardFrom,
      cardinalityTo: cardTo,
      isSource,
      // ManyToMany metadata
      mtmTableName,
      mtmJoinCol,
      mtmInverseJoinCol,
      // Labels for display
      fieldLabel: otherNameCamel,
      fieldLabelPlural: otherNameCamel + 's',
    });
  }

  return results;
}

// Clasifica la entidad en la jerarquia de herencia (o null si no hereda).
// - Hijo (source de INHERITANCE): { parentEntity } -> la plantilla emite
//   `extends Padre` + @PrimaryKeyJoinColumn, SIN @Inheritance.
// - Raiz (target de INHERITANCE, tiene hijos): { isRoot: true } -> la
//   plantilla emite @Inheritance(JOINED) + @DiscriminatorColumn.
// JPA exige UNA sola estrategia por jerarquia: @Inheritance en el hijo
// rompe el arranque en PostgreSQL ("may not override SINGLE_TABLE").
function buildInheritanceInfo(entity, allEntities, allRelationships) {
  // ¿Es hijo? (tiene relación INHERITANCE donde él es el target)
  const childRel = allRelationships.find(
    r => isInheritanceRel(r) && relFromName(r, allEntities) === entity.name
  );
  // ¿Es raíz? (tiene hijos, es decir INHERITANCE donde él es el source)
  const hasChildren = allRelationships.some(
    r => isInheritanceRel(r) && relToName(r, allEntities) === entity.name
  );

  if (childRel) {
    // Hijo: solo extends + @PrimaryKeyJoinColumn (NO @Inheritance, NO @Id).
    const parentName = relToName(childRel, allEntities);
    const parentEntity = (allEntities || []).find(e => e.name === parentName);
    const parentPk = parentEntity
      ? (parentEntity.attributes || []).find(a => a.isPk)
      : null;
    const parentPkColumn = parentPk ? toSnakeCase(parentPk.name, 'id') : 'id';
    const parentTable = (parentEntity && parentEntity.tableName) || snakeCase(parentName);
    return {
      isRoot: false,
      parentEntity: parentName,
      parentEntityPascal: toJavaClassName(parentName),
      parentTable,
      parentPkColumn,
      parentPkJoinColumn: `${parentTable}_${parentPkColumn}`,
    };
  }

  if (hasChildren) {
    // Raíz: @Inheritance + @DiscriminatorColumn (NO @PrimaryKeyJoinColumn)
    return {
      isRoot: true,
    };
  }

  return null;
}

// Campos que llevan getter/setter EXPLICITOS en la entidad (ademas de Lombok):
// PK + atributos (sin PK repetida ni colisiones FK) + campos de relaciones.
// Cada entrada es { javaType, name }. Si falta un campo aqui, el test
// getters-setters.test.js lo detecta (cuenta getters >= campos).
function buildModelAccessors(primaryKey, mappedAttributes, relations, inheritance) {
  const accessors = [];
  // El hijo hereda la PK del padre; no debe declarar otro campo @Id.
  if (!inheritance || !inheritance.parentEntity) {
    accessors.push({ javaType: primaryKey.javaType, name: primaryKey.nameCamel });
  }
  for (const attr of mappedAttributes || []) {
    if (attr.isPk || attr.isFkCollision) continue;
    accessors.push({ javaType: attr.javaType, name: attr.nameCamel });
  }
  for (const r of relations || []) {
    if (r.jpaType === 'manyToOne' || r.jpaType === 'oneToOne') {
      accessors.push({ javaType: r.otherEntityPascal, name: r.fieldLabel });
    } else if (r.jpaType === 'oneToMany') {
      accessors.push({ javaType: `Set<${r.otherEntityPascal}>`, name: r.fieldLabelPlural });
    }
  }
  return accessors;
}

// Lista de campos para los getters/setters explícitos del DTO.
// Deduplica: si un atributo del diagrama ya se llama como el FK
// auto-generado de una relación (ej. "customerId"), NO se emite dos veces
// (el DTO reutiliza el campo del atributo).
function buildDtoAccessors(primaryKey, mappedAttributes, relations) {
  const seen = new Set();
  const accessors = [];
  const push = (javaType, name) => {
    if (seen.has(name)) return;
    seen.add(name);
    accessors.push({ javaType, name });
  };
  push(primaryKey.javaType, primaryKey.nameCamel);
  for (const attr of mappedAttributes || []) {
    if (attr.isPk) continue;
    push(attr.javaType, attr.nameCamel);
  }
  for (const r of relations || []) {
    if (r.jpaType === 'manyToOne' || r.jpaType === 'oneToOne') {
      push(`${r.otherEntityPascal}DTO`, r.fieldLabel);
      push(r.otherEntityPkType, `${r.fieldLabel}Id`);
    } else if (r.jpaType === 'oneToMany') {
      push(`List<${r.otherEntityPascal}DTO>`, r.fieldLabelPlural);
    }
  }
  return accessors;
}

function safeTableNameJs(name) {
  const reservedWords = [
    'user', 'group', 'order', 'table', 'column', 'index',
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join',
    'create', 'drop', 'alter', 'primary', 'key', 'foreign', 'references',
    'constraint', 'default', 'values', 'and', 'or', 'not', 'null',
  ];
  return reservedWords.includes(String(name).toLowerCase()) ? `"${name}"` : name;
}

// Lineas del CREATE TABLE para la migracion Flyway.
// Omite atributos en colision FK (la columna la aporta la relacion) para no
// duplicar columnas. Cada entrada es una linea SQL completa; la plantilla
// migration.sql.hbs las une con comas. Las reserved words van entrecomilladas.
function buildSqlColumns(mappedAttributes, relations, tableName) {
  const lines = [];
  const sqlPkType = (sqlType, isUuid) => {
    if (isUuid) return 'UUID';
    if (sqlType === 'INTEGER') return 'SERIAL';
    if (sqlType === 'BIGINT') return 'BIGSERIAL';
    return sqlType;
  };
  for (const a of mappedAttributes || []) {
    if (a.isFkCollision) continue;
    let line = `${a.nameSnake} ${a.isPk ? sqlPkType(a.sqlType, a.isUuid) : a.sqlType}`;
    if (a.isPk) line += ' PRIMARY KEY';
    if (!a.nullable) line += ' NOT NULL';
    if (a.unique) line += ' UNIQUE';
    lines.push(line);
  }
  for (const r of relations || []) {
    if (r.jpaType === 'manyToOne' || (r.jpaType === 'oneToOne' && r.isOwner)) {
      lines.push(`${r.fkColumn} ${r.fkSqlType}`);
      lines.push(
        `CONSTRAINT fk_${tableName}_${r.fkColumn} FOREIGN KEY (${r.fkColumn}) REFERENCES ${safeTableNameJs(r.otherEntityTable)}(id)`
      );
    }
  }
  return lines;
}

module.exports = { sanitizeEntities, normalizeRelationshipEndpoints, buildEntityLookup, buildEntityRelations, buildInheritanceInfo, buildModelAccessors, buildDtoAccessors, safeTableNameJs, buildSqlColumns };
