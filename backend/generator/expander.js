'use strict';

const { snakeCase, camelCase, toJavaClassName, isValidJavaIdentifier } = require('./naming');

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

// Un extremo es "muchos" si su cardinalidad lo dice ("*", "0..*", "1..*",
// "N", "M"). Se usa en dos lugares: para clasificar JPA y para detectar
// * a * (ambos extremos "muchos" -> entidad intermedia, nunca @ManyToMany).
function isManySide(card) {
  if (!card) return false;
  const c = String(card).trim();
  return c === '*' || c === 'N' || c === 'M' || c === 'n' || c === 'm' || c.includes('*');
}

// Resuelve el NOMBRE de entidad de un extremo de relacion.
// Acepta string (id, nombre visible o ya sanitizado) u objeto
// { entityName } / { name }: los diagramas viejos y nuevos guardan
// formatos distintos y esto los unifica. Devuelve null si no hay nada.
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

// ¿Esta relacion es * a *? Vale el tipo explicito MANY_TO_MANY o que
// AMBOS extremos sean "muchos". Si es true, expandManyToMany() la reemplaza
// por una intermedia + dos * a 1 (jamas se emite @ManyToMany).
function isManyToManyRel(rel) {
  if (!rel) return false;
  if (rel.type === 'MANY_TO_MANY') return true;
  return isManySide(rel.cardinalityFrom) && isManySide(rel.cardinalityTo);
}

function toLowerFirst(str) {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Expande cada * a * en: entidad intermedia (PK UUID propia + atributos de
// la relacion) + dos relaciones sinteticas intermedia(*) -> original(1).
// Devuelve { allEntities, allRelationships, intermediates }.
// Por que no @ManyToMany: dos colecciones bidireccionales serializan en loop
// JSON y @JoinTable no admite columnas extra (cantidad, fecha, ...).
// Respeta el nombre de la clase asociativa del editor si es valido; si
// colisiona con una entidad existente agrega sufijo numerico.
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


module.exports = { resolveCardinality, isManySide, relEndName, relFromName, relToName, isManyToManyRel, toLowerFirst, expandManyToMany, generateConfigJson };
