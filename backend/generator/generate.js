const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const archiver = require('archiver');
const { getSqlType, getJavaType } = require('./typeMapper');

// ── Handlebars helpers ──────────────────────────────────────────────

Handlebars.registerHelper('pascalCase', (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('camelCase', (str) => {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
});

Handlebars.registerHelper('snakeCase', (str) => {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
});

Handlebars.registerHelper('plural', (str) => {
  if (!str) return '';
  return str.endsWith('s') ? str + 'es' : str + 's';
});

Handlebars.registerHelper('pluralLowerCase', (str) => {
  if (!str) return '';
  const lower = str.toLowerCase();
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) return lower + 'es';
  if (lower.endsWith('ch') || lower.endsWith('sh')) return lower + 'es';
  if (lower.endsWith('y') && !/[aeiou]$/.test(lower.slice(0, -1))) return lower.slice(0, -1) + 'ies';
  return lower + 's';
});

Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('capitalize', (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('ne', (a, b) => a !== b);

Handlebars.registerHelper('or', (...args) => {
  const opts = args.pop();
  return args.some(Boolean);
});

Handlebars.registerHelper('and', (...args) => {
  const opts = args.pop();
  return args.every(Boolean);
});

Handlebars.registerHelper('firstEntityName', (entities) => {
  if (!entities || entities.length === 0) return '';
  return entities[0].entityName;
});

Handlebars.registerHelper('sqlPkType', (sqlType, isUuid) => {
  if (isUuid) return 'UUID';
  if (sqlType === 'INTEGER') return 'SERIAL';
  if (sqlType === 'BIGINT') return 'BIGSERIAL';
  return sqlType;
});

Handlebars.registerHelper('safeTableName', (name) => {
  const reservedWords = [
    'user', 'group', 'order', 'table', 'column', 'index',
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join',
    'create', 'drop', 'alter', 'primary', 'key', 'foreign', 'references',
    'constraint', 'default', 'values', 'and', 'or', 'not', 'null',
  ];
  return reservedWords.includes(name.toLowerCase()) ? `"${name}"` : name;
});

Handlebars.registerHelper('jsonExample', (entityContext) => {
  const attrs = entityContext.attributes || [];
  const fields = attrs
    .filter(a => !a.isPk)
    .map(a => {
      let value;
      if (a.javaType === 'String') value = `"valor_${a.name}"`;
      else if (a.javaType === 'Integer' || a.javaType === 'Long') value = '1';
      else if (a.javaType === 'BigDecimal') value = '9.99';
      else if (a.javaType === 'Boolean') value = 'true';
      else if (a.javaType === 'LocalDate') value = '"2024-01-01"';
      else value = '"valor"';
      return `"${a.name}": ${value}`;
    })
    .join(', ');
  return `{${fields}}`;
});

// ── Template loading ────────────────────────────────────────────────

const templateDir = path.join(__dirname, 'templates');
const templates = {
  'pom.xml': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'pom.xml.hbs'), 'utf8')),
  'application.properties': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'application.properties.hbs'), 'utf8')),
  'model': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'model.java.hbs'), 'utf8')),
  'entityIntermediate': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'entity-intermediate.java.hbs'), 'utf8')),
  'repository': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'repository.java.hbs'), 'utf8')),
  'service': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'service.java.hbs'), 'utf8')),
  'controller': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'controller.java.hbs'), 'utf8')),
  'dto': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'dto.java.hbs'), 'utf8')),
  'migration': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'migration.sql.hbs'), 'utf8')),
  'mainApp': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'DemoApplication.java.hbs'), 'utf8')),
  'readme': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'README.md.hbs'), 'utf8')),
  'globalExceptionHandler': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'GlobalExceptionHandler.java.hbs'), 'utf8')),
  'securityConfig': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'SecurityConfig.java.hbs'), 'utf8')),
  'jwtService': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'JwtService.java.hbs'), 'utf8')),
  'jwtFilter': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'JwtAuthenticationFilter.java.hbs'), 'utf8')),
  'authController': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'AuthController.java.hbs'), 'utf8')),
  'userService': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'UserService.java.hbs'), 'utf8')),
  'aiQueryRequest': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiQueryRequest.java.hbs'), 'utf8')),
  'aiQueryResponse': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiQueryResponse.java.hbs'), 'utf8')),
  'aiQueryService': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiQueryService.java.hbs'), 'utf8')),
  'aiController': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiController.java.hbs'), 'utf8')),
  'intentClassifier': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'IntentClassifier.java.hbs'), 'utf8')),
};

// ── Core generation ─────────────────────────────────────────────────

const BASE_PACKAGE = 'com.example.demo';
const BASE_PATH = `src/main/java/${BASE_PACKAGE.replace(/\./g, '/')}`;

function resolveCardinality(cardFrom, cardTo) {
  const isFromMany = isManySide(cardFrom);
  const isToMany = isManySide(cardTo);
  const isFromOne = cardFrom === '1' || cardFrom === '0..1';
  const isToOne = cardTo === '1' || cardTo === '0..1';

  if (isFromMany && isToMany) return 'manyToMany';
  if (isFromOne && isToOne) return 'oneToOne';
  if (isFromOne && isToMany) return 'oneToMany';
  if (isFromMany && isToOne) return 'manyToOne';
  // fallback: treat ?..N as many
  if (isFromMany) return 'manyToOne';
  return 'oneToMany';
}

function isManySide(card) {
  if (!card) return false;
  const c = String(card).trim();
  return c === '*' || c === 'N' || c === 'M' || c === 'n' || c === 'm' || c.includes('*');
}

// Resuelve el nombre de entidad de un extremo de relación.
// Acepta string (id o nombre) u objeto { entityName } / { name }.
function relEndName(end, allEntities) {
  if (!end) return null;
  if (typeof end === 'string') {
    const byId = (allEntities || []).find(e => e.id === end);
    if (byId) return byId.name;
    return end;
  }
  if (typeof end === 'object') {
    if (end.entityName) return end.entityName;
    if (end.name) return end.name;
  }
  return null;
}

function relFromName(rel, allEntities) {
  return rel.fromEntity || relEndName(rel.source, allEntities);
}

function relToName(rel, allEntities) {
  return rel.toEntity || relEndName(rel.target, allEntities);
}

// ¿La relación es * a *? (tipo explícito o cardinalidades en ambos lados)
function isManyToManyRel(rel) {
  if (!rel) return false;
  if (rel.type === 'MANY_TO_MANY') return true;
  return isManySide(rel.cardinalityFrom) && isManySide(rel.cardinalityTo);
}

function toLowerFirst(str) {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Expande cada relación * a * en una entidad intermedia explícita
// (clase asociativa UML 2.5) + dos relaciones * a 1 sintéticas.
// Devuelve { allEntities, allRelationships, intermediates }.
// NO se genera @ManyToMany en ningún caso.
function expandManyToMany(entities, relationships, takenNames) {
  const allEntities = [...(entities || [])];
  const allRelationships = [];
  const intermediates = [];
  const taken = takenNames instanceof Set ? takenNames : new Set(
    (entities || []).map(e => e.name)
  );

  for (const rel of relationships || []) {
    if (!isManyToManyRel(rel)) {
      allRelationships.push(rel);
      continue;
    }

    const from = relFromName(rel, entities);
    const to = relToName(rel, entities);
    if (!from || !to) {
      allRelationships.push(rel);
      continue;
    }

    // Nombre de la intermedia: si el AST trae uno válido se respeta;
    // si no, "Order Details"+"Product" -> "OrderDetailsProduct".
    // Colisiones ("PedidoProducto" ya existe) -> sufijo numérico.
    let intermediateEntity = isValidJavaIdentifier(rel.intermediateEntity)
      ? rel.intermediateEntity
      : `${toJavaClassName(from)}${toJavaClassName(to)}`;
    if (taken.has(intermediateEntity)) {
      const base = intermediateEntity;
      let n = 2;
      while (taken.has(base + n)) n++;
      intermediateEntity = base + n;
    }
    taken.add(intermediateEntity);
    const intermediateTable = /^[a-z0-9_]+$/.test(rel.intermediateTable || '')
      ? rel.intermediateTable
      : `${snakeCase(intermediateEntity)}`;
    const intermediateAttributes = (rel.intermediateAttributes || []).map(a => ({ ...a }));

    intermediates.push({
      name: intermediateEntity,
      tableName: intermediateTable,
      // true si proviene de una clase asociativa visible del editor
      // (nombre y atributos definidos por el usuario en el nodo).
      isAssociationClass: !!rel.isAssociationClass,
      fromEntity: from,
      toEntity: to,
      fromEntityLower: toLowerFirst(from),
      toEntityLower: toLowerFirst(to),
      fromEntitySnake: snakeCase(from),
      toEntitySnake: snakeCase(to),
      intermediateAttributes,
      sourceRelationshipId: rel.id,
    });

    // La intermedia tiene su propio UUID como PK + atributos de la relación
    allEntities.push({
      id: `intermediate_${rel.id || intermediateEntity}`,
      name: intermediateEntity,
      originalName: intermediateEntity,
      tableName: intermediateTable,
      fieldName: camelCase(intermediateEntity),
      route: `${intermediateTable}s`,
      attributes: [
        { id: `pk_${intermediateEntity}`, name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
        ...intermediateAttributes,
      ],
      intermediateOf: rel.id,
      intermediateTable,
    });

    // Dos relaciones sintéticas: intermedia(*) -> original(1)
    allRelationships.push({
      id: `${rel.id || intermediateEntity}_a`,
      source: { entityName: intermediateEntity },
      target: { entityName: from },
      fromEntity: intermediateEntity,
      toEntity: from,
      type: 'MANY_TO_ONE',
      cardinalityFrom: '*',
      cardinalityTo: '1',
      synthetic: true,
    });
    allRelationships.push({
      id: `${rel.id || intermediateEntity}_b`,
      source: { entityName: intermediateEntity },
      target: { entityName: to },
      fromEntity: intermediateEntity,
      toEntity: to,
      type: 'MANY_TO_ONE',
      cardinalityFrom: '*',
      cardinalityTo: '1',
      synthetic: true,
    });
  }

  return { allEntities, allRelationships, intermediates };
}

// Genera el config.json que consume la app Flutter.
// Incluye las entidades intermedias como una entidad más.
function generateConfigJson(entityContexts) {
  const entidades = (entityContexts || []).map(e => e.entityNamePascal || e.entityName);
  const campos = {};
  for (const ctx of entityContexts || []) {
    const key = ctx.entityNamePascal || ctx.entityName;
    const attrNames = (ctx.attributes || [])
      .filter(a => !a.isPk)
      .map(a => a.nameCamel || a.name);
    const attrSet = new Set(attrNames);
    const fkNames = (ctx.relations || [])
      .filter(r => r.jpaType === 'manyToOne')
      .map(r => `${r.fieldLabel}Id`)
      .filter(n => !attrSet.has(n));
    campos[key] = [...fkNames, ...attrNames];
  }
  return {
    apiBaseUrl: 'http://localhost:8080',
    entidades,
    campos,
  };
}

function snakeCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function pascalCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function camelCase(str) {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// ── Sanitización de nombres para generar Java válido ────────────────────
// El diagrama muestra el nombre visible ("Order Details"), pero el código
// generado debe usar identificadores Java válidos ("OrderDetails").
// A diferencia de pascalCase/camelCase (que solo tocan la primera letra),
// estas funciones parten el nombre en palabras por separadores, por lo que
// son idempotentes: sanitizar "OrderDetails" devuelve "OrderDetails".

function splitWords(name) {
  if (!name) return [];
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capWord(w, lowerRest) {
  if (!w) return '';
  const rest = lowerRest ? w.slice(1).toLowerCase() : w.slice(1);
  return w.charAt(0).toUpperCase() + rest;
}

// "Order Details" -> "OrderDetails", "USER_ACCOUNT" -> "UserAccount",
// "producto" -> "Producto", "" -> "Unnamed".
// Las palabras TODO-MAYÚSCULAS se normalizan ("USER"->"User") pero se
// conserva la capitalización interna ("OrderDetails" no cambia).
function toJavaClassName(name) {
  const words = splitWords(name);
  if (words.length === 0) return 'Unnamed';
  return words
    .map(w => (/^[A-Z0-9_]+$/.test(w) ? capWord(w, true) : capWord(w, false)))
    .join('');
}

function toJavaFieldName(name) {
  const cls = toJavaClassName(name);
  return cls.charAt(0).toLowerCase() + cls.slice(1);
}

function toSnakeCase(name) {
  return snakeCase(toJavaClassName(name));
}

function toPluralRoute(name) {
  const snake = toSnakeCase(name);
  // Plural simple en minúsculas (ver tabla de casos en README).
  return snake + 's';
}

function isValidJavaIdentifier(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name || '');
}

// Sanitiza entidades preservando el nombre visible en `originalName`.
// Si dos entidades colisionan tras sanitizar ("Order-Details" y
// "Order Details" -> "OrderDetails"), la segunda recibe sufijo numérico.
function sanitizeEntities(rawEntities) {
  const taken = new Set();
  return (rawEntities || []).map((raw, idx) => {
    const base = toJavaClassName(raw.name);
    let name = base;
    let n = 2;
    while (taken.has(name)) {
      name = base + n;
      n++;
    }
    taken.add(name);
    return {
      ...raw,
      id: raw.id || `entity_${idx}`,
      name,
      originalName: raw.name,
      tableName: snakeCase(name),
      fieldName: camelCase(name),
      route: snakeCase(name) + 's',
      attributes: raw.attributes || [],
    };
  });
}

// Reescribe los extremos de las relaciones a los nombres sanitizados.
// Acepta endpoints como { entityName }, { name } o string (id, nombre
// original o nombre ya sanitizado).
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

function buildEntityRelations(entity, allEntities, allRelationships) {
  const entityName = entity.name;
  const results = [];

  for (const rel of allRelationships) {
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
        (entity.attributes || []).map(a => toJavaFieldName(a.name))
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
      relationshipType: rel.type,
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

function buildInheritanceInfo(entity, allEntities, allRelationships) {
  // ¿Es hijo? (tiene relación INHERITANCE donde él es el target)
  const parentRel = allRelationships.find(
    r => r.type === 'INHERITANCE' && relToName(r, allEntities) === entity.name
  );
  // ¿Es raíz? (tiene hijos, es decir INHERITANCE donde él es el source)
  const hasChildren = allRelationships.some(
    r => r.type === 'INHERITANCE' && relFromName(r, allEntities) === entity.name
  );

  if (parentRel) {
    // Hijo: solo extends + @PrimaryKeyJoinColumn (NO @Inheritance)
    const parentName = relFromName(parentRel, allEntities);
    return {
      isRoot: false,
      parentEntity: parentName,
      parentEntityPascal: toJavaClassName(parentName),
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

// Lista de campos para los getters/setters explícitos del modelo:
// PK + atributos (no PK, sin colisiones FK) + campos de relaciones
// (@ManyToOne, @OneToOne, @OneToMany). Cada entrada: { javaType, name }.
function buildModelAccessors(primaryKey, mappedAttributes, relations) {
  const accessors = [{ javaType: primaryKey.javaType, name: primaryKey.nameCamel }];
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

// Líneas de columna para el CREATE TABLE de la migración.
// Omite atributos en colisión FK (los mapea la relación) para no duplicar
// columnas. Cada entrada es una línea SQL completa; la plantilla une con comas.
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

function generateProject(ast) {
  return new Promise((resolve, reject) => {
    try {
      const projectName = 'generated-backend';
      const outputRoot = path.join(__dirname, 'output');
      const outputDir = path.join(outputRoot, projectName + '-' + Date.now());
      fs.mkdirSync(outputDir, { recursive: true });

      // ── 0. Sanitizar nombres: el diagrama muestra "Order Details" pero el
      // código generado debe usar identificadores Java válidos ("OrderDetails").
      const sanitizedEntities = sanitizeEntities(ast.entities || []);
      const lookup = buildEntityLookup(sanitizedEntities);
      const normalizedRelationships = (ast.relationships || []).map(
        rel => normalizeRelationshipEndpoints(rel, lookup)
      );

      // Expansión * a *: cada MANY_TO_MANY genera una entidad intermedia
      // explícita (UUID + 2x @ManyToOne) y NUNCA @ManyToMany.
      const takenNames = new Set(sanitizedEntities.map(e => e.name));
      const expanded = expandManyToMany(sanitizedEntities, normalizedRelationships, takenNames);
      const entities = expanded.allEntities;
      const relationships = expanded.allRelationships;

      function writeFile(relativePath, content) {
        const fullPath = path.join(outputDir, relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }

      // ── 1. pom.xml ──
      writeFile('pom.xml', templates['pom.xml']({ projectName }));

      // ── 2. application.properties ──
      writeFile('src/main/resources/application.properties', templates['application.properties']({}));

      // ── 3. Main app ──
      writeFile(`${BASE_PATH}/DemoApplication.java`, templates['mainApp']({}));

      // ── 4. Entity contexts ──
      const entityContexts = [];

      for (const entity of entities) {
        // Primary key
        let primaryKeyAttr = entity.attributes.find(a => a.isPk);
        let primaryKey;
        if (primaryKeyAttr) {
          primaryKey = {
            name: toJavaFieldName(primaryKeyAttr.name),
            namePascal: toJavaClassName(primaryKeyAttr.name),
            nameCamel: toJavaFieldName(primaryKeyAttr.name),
            javaType: getJavaType(primaryKeyAttr.type),
            sqlType: getSqlType(primaryKeyAttr.type),
            isUuid: primaryKeyAttr.type === 'UUID',
          };
        } else {
          primaryKey = {
            name: 'id',
            namePascal: 'Id',
            nameCamel: 'id',
            javaType: 'Long',
            sqlType: 'BIGSERIAL',
            isUuid: false,
          };
        }

        // Relations for this entity
        const relations = buildEntityRelations(entity, entities, relationships);

        // Inheritance info
        const inheritance = buildInheritanceInfo(entity, entities, relationships);

        // Check if this entity is a parent (has children)
        const isParent = relationships.some(
          r => r.type === 'INHERITANCE' && relFromName(r, entities) === entity.name
        );
        const children = relationships
          .filter(r => r.type === 'INHERITANCE' && relFromName(r, entities) === entity.name)
          .map(r => ({
            childEntity: relToName(r, entities),
            childEntityPascal: toJavaClassName(relToName(r, entities)),
          }));

        // ¿Es una entidad intermedia de una relación * a *?
        const intermediateInfo = expanded.intermediates.find(i => i.name === entity.name) || null;

        // Reconciliación de FK: si un atributo del diagrama mapea la misma
        // columna que el @JoinColumn de una relación @ManyToOne/@OneToOne
        // (ej. atributo "customerId" + relación hacia Customer), la fuente
        // de verdad es la relación: el atributo NO se renderiza como columna
        // propia (evita "Column duplicated in mapping" de Hibernate).
        const fkColumns = new Set(
          relations
            .filter(r => r.jpaType === 'manyToOne' || r.jpaType === 'oneToOne')
            .map(r => r.fkColumn)
        );
        const mappedAttributes = (entity.attributes || []).map(attr => {
          const nameSnake = toSnakeCase(attr.name);
          const isFkCollision = !attr.isPk && fkColumns.has(nameSnake);
          return {
            name: toJavaFieldName(attr.name),
            originalName: attr.name,
            namePascal: toJavaClassName(attr.name),
            nameCamel: toJavaFieldName(attr.name),
            nameSnake,
            javaType: getJavaType(attr.type),
            sqlType: getSqlType(attr.type),
            isPk: attr.isPk || false,
            nullable: attr.nullable !== false,
            unique: attr.unique || false,
            isString: getJavaType(attr.type) === 'String',
            isFkCollision,
          };
        });

        const context = {
          entityName: entity.name,
          originalName: entity.originalName || entity.name,
          tableName: entity.tableName || snakeCase(entity.name),
          route: entity.route || `${snakeCase(entity.name)}s`,
          entityNamePascal: pascalCase(entity.name),
          entityNameCamel: camelCase(entity.name),
          entityNamePlural: entity.name + 's',
          entityNamePluralCamel: camelCase(entity.name) + 's',
          isIntermediate: !!intermediateInfo,
          intermediateTable: intermediateInfo ? intermediateInfo.tableName : null,
          fromEntityPascal: intermediateInfo ? pascalCase(intermediateInfo.fromEntity) : null,
          fromEntityLower: intermediateInfo ? intermediateInfo.fromEntityLower : null,
          fromEntitySnake: intermediateInfo ? intermediateInfo.fromEntitySnake : null,
          toEntityPascal: intermediateInfo ? pascalCase(intermediateInfo.toEntity) : null,
          toEntityLower: intermediateInfo ? intermediateInfo.toEntityLower : null,
          toEntitySnake: intermediateInfo ? intermediateInfo.toEntitySnake : null,
          primaryKey,
          attributes: mappedAttributes,
          // Campos para getters/setters explícitos del modelo:
          // PK + atributos (sin colisiones FK) + campos de relaciones.
          accessors: buildModelAccessors(primaryKey, mappedAttributes, relations),
          // Campos para getters/setters explícitos del DTO (sin duplicados:
          // si un atributo ya se llama como el FK auto-generado, se reutiliza).
          dtoAccessors: buildDtoAccessors(primaryKey, mappedAttributes, relations),
          relations,
          sqlColumns: buildSqlColumns(mappedAttributes, relations, entity.tableName || snakeCase(entity.name)),
          inheritance,
          isParent,
          children,
          // Flags for template conditionals
          hasOwnRelations: relations.length > 0,
          hasManyToOne: relations.some(r => r.jpaType === 'manyToOne'),
          hasOneToMany: relations.some(r => r.jpaType === 'oneToMany'),
          hasManyToMany: relations.some(r => r.jpaType === 'manyToMany'),
          hasOneToOne: relations.some(r => r.jpaType === 'oneToOne'),
          hasInheritance: !!inheritance,
        };

        entityContexts.push(context);

        // Generate model (entity), repository, service, controller, DTO.
        // Las intermedias usan su plantilla explícita (UUID + 2x @ManyToOne);
        // repositorio, servicio, controlador y DTO son los genéricos.
        writeFile(
          `${BASE_PATH}/model/${context.entityNamePascal}.java`,
          templates[context.isIntermediate ? 'entityIntermediate' : 'model'](context)
        );
        writeFile(
          `${BASE_PATH}/repository/${context.entityNamePascal}Repository.java`,
          templates['repository'](context)
        );
        writeFile(
          `${BASE_PATH}/service/${context.entityNamePascal}Service.java`,
          templates['service'](context)
        );
        writeFile(
          `${BASE_PATH}/controller/${context.entityNamePascal}Controller.java`,
          templates['controller'](context)
        );
        writeFile(
          `${BASE_PATH}/dto/${context.entityNamePascal}DTO.java`,
          templates['dto'](context)
        );
      }

      // ── 5. Security ──
      writeFile(`${BASE_PATH}/security/SecurityConfig.java`, templates['securityConfig']({}));
      writeFile(`${BASE_PATH}/security/JwtService.java`, templates['jwtService']({}));
      writeFile(`${BASE_PATH}/security/JwtAuthenticationFilter.java`, templates['jwtFilter']({}));
      writeFile(`${BASE_PATH}/security/AuthController.java`, templates['authController']({}));
      writeFile(`${BASE_PATH}/security/AppUserDetailsService.java`, templates['userService']({}));

      // ── 6. AI Local Query ──
      const entityNamesStr = entityContexts.map(e => `"${e.entityNamePascal}"`).join(', ');
      writeFile(`${BASE_PATH}/ai/AiQueryRequest.java`, templates['aiQueryRequest']({}));
      writeFile(`${BASE_PATH}/ai/AiQueryResponse.java`, templates['aiQueryResponse']({}));
      writeFile(`${BASE_PATH}/ai/IntentClassifier.java`, templates['intentClassifier']({}));
      writeFile(`${BASE_PATH}/ai/AiQueryService.java`, templates['aiQueryService']({ entityNames: entityNamesStr }));
      writeFile(`${BASE_PATH}/ai/AiController.java`, templates['aiController']({}));

      // ── 7. Global exception handler ──
      writeFile(`${BASE_PATH}/config/GlobalExceptionHandler.java`, templates['globalExceptionHandler']({}));

      // ── 7. README ──
      writeFile('README.md', templates['readme']({
        projectName,
        entities: entityContexts,
        firstRoute: entityContexts.length > 0 ? entityContexts[0].route : '',
      }));

      // ── 8. Flyway migration ──
      writeFile(
        'src/main/resources/db/migration/V1__init.sql',
        templates['migration']({ entities: entityContexts })
      );

      // ── 8b. config.json para la app Flutter ──
      // Incluye las entidades intermedias de relaciones * a * como una más.
      writeFile(
        'config.json',
        JSON.stringify(generateConfigJson(entityContexts), null, 2)
      );

      // ── 9. ZIP ──
      const zipPath = path.join(outputRoot, projectName + '.zip');
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(outputDir, false);
      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateProject,
  expandManyToMany,
  generateConfigJson,
  buildEntityRelations,
  sanitizeEntities,
  normalizeRelationshipEndpoints,
  buildEntityLookup,
  toJavaClassName,
  toJavaFieldName,
  toSnakeCase,
  toPluralRoute,
  isValidJavaIdentifier,
  isManyToManyRel,
  isManySide,
  resolveCardinality,
};
