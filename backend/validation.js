'use strict';

const MAX_NAME = 120;
const MAX_TEXT = 4000;
const MAX_ID = 128;
const MAX_ENTITIES = 300;
const MAX_RELATIONSHIPS = 600;
const MAX_ATTRIBUTES = 100;
const MAX_MUTATIONS = 200;
const AI_PROVIDERS = new Set(['groq', 'ollama']);

const RELATIONSHIP_TYPES = new Set([
  'ASSOCIATION',
  'AGGREGATION',
  'COMPOSITION',
  'INHERITANCE',
  'ONE_TO_ONE',
  'ONE_TO_MANY',
  'MANY_TO_ONE',
  'MANY_TO_MANY',
]);

const MUTATION_ACTIONS = new Set([
  'addEntity',
  'addAttribute',
  'removeEntity',
  'addRelationship',
  'removeRelationship',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value, { min = 1, max = MAX_NAME, trim = true } = {}) {
  if (typeof value !== 'string') return null;
  const text = trim ? value.trim() : value;
  if (text.length < min || text.length > max) return null;
  return text;
}

function ok(value) {
  return { ok: true, value };
}

function fail(error) {
  return { ok: false, error };
}

function validateAttribute(raw) {
  if (!isPlainObject(raw)) return fail('Atributo inválido');
  const name = stringValue(raw.name);
  if (!name) return fail('El atributo necesita un nombre válido');

  const attribute = { name };
  if (raw.type !== undefined) {
    const type = stringValue(raw.type, { max: 40 });
    if (!type) return fail('El atributo tiene un tipo inválido');
    attribute.type = type;
  }

  for (const field of ['isPk', 'nullable', 'unique']) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== 'boolean') return fail(`El campo ${field} debe ser booleano`);
    attribute[field] = raw[field];
  }

  if (raw.id !== undefined) {
    const id = stringValue(raw.id, { max: MAX_ID });
    if (!id) return fail('El atributo tiene un id inválido');
    attribute.id = id;
  }

  return ok(attribute);
}

function validateAttributeList(raw, { required = false } = {}) {
  if (raw === undefined) {
    return required ? fail('Falta la lista de atributos') : ok([]);
  }
  if (!Array.isArray(raw)) return fail('attributes debe ser un arreglo');
  if (raw.length > MAX_ATTRIBUTES) return fail('Demasiados atributos');

  const attributes = [];
  for (const item of raw) {
    const checked = validateAttribute(item);
    if (!checked.ok) return checked;
    attributes.push(checked.value);
  }
  return ok(attributes);
}

function validateAstState(raw, { requireEntities = false } = {}) {
  if (!isPlainObject(raw)) return fail('currentState debe ser un objeto');
  if (!Array.isArray(raw.entities)) return fail('currentState.entities debe ser un arreglo');
  if (raw.entities.length > MAX_ENTITIES) return fail('Demasiadas entidades en el diagrama');
  if (requireEntities && raw.entities.length === 0) {
    return fail('El diagrama no tiene entidades para generar');
  }

  for (const entity of raw.entities) {
    if (!isPlainObject(entity)) return fail('Entidad inválida');
    if (!stringValue(entity.name)) return fail('Una entidad no tiene nombre válido');
    if (entity.id !== undefined && !stringValue(entity.id, { max: MAX_ID })) {
      return fail('Una entidad tiene un id inválido');
    }
    const attributes = validateAttributeList(entity.attributes);
    if (!attributes.ok) return attributes;
  }

  const relationships = raw.relationships === undefined ? [] : raw.relationships;
  if (!Array.isArray(relationships)) return fail('currentState.relationships debe ser un arreglo');
  if (relationships.length > MAX_RELATIONSHIPS) return fail('Demasiadas relaciones en el diagrama');

  for (const relationship of relationships) {
    if (!isPlainObject(relationship)) return fail('Relación inválida');
    if (relationship.id !== undefined && !stringValue(relationship.id, { max: MAX_ID })) {
      return fail('Una relación tiene un id inválido');
    }

    const ends = [relationship.source, relationship.target, relationship.fromEntity, relationship.toEntity];
    for (const end of ends) {
      if (end === undefined) continue;
      if (typeof end === 'string') {
        if (!stringValue(end)) return fail('Una relación tiene un extremo inválido');
        continue;
      }
      if (!isPlainObject(end)) return fail('Una relación tiene un extremo inválido');
      const name = end.entityName ?? end.name;
      if (name !== undefined && !stringValue(name)) {
        return fail('Una relación tiene un extremo inválido');
      }
    }

    if (relationship.type !== undefined) {
      const type = stringValue(relationship.type, { max: 40 });
      if (!type) return fail('Una relación tiene un tipo inválido');
    }
    if (relationship.cardinalityFrom !== undefined && !stringValue(relationship.cardinalityFrom, { max: 20 })) {
      return fail('Cardinalidad inválida');
    }
    if (relationship.cardinalityTo !== undefined && !stringValue(relationship.cardinalityTo, { max: 20 })) {
      return fail('Cardinalidad inválida');
    }
    const intermediateAttributes = validateAttributeList(relationship.intermediateAttributes);
    if (!intermediateAttributes.ok) return intermediateAttributes;
  }

  return ok(raw);
}

function validateSelectedEndpoint(raw, label) {
  if (!isPlainObject(raw)) return fail(`El extremo ${label} del elemento seleccionado es inválido`);
  const id = stringValue(raw.id, { max: MAX_ID });
  const name = stringValue(raw.name);
  if (!id || !name) return fail(`El extremo ${label} del elemento seleccionado es inválido`);
  return ok({ id, name });
}

function validateSelectedMethod(raw) {
  if (!isPlainObject(raw)) return fail('Método seleccionado inválido');
  const name = stringValue(raw.name);
  if (!name) return fail('El método seleccionado necesita un nombre válido');
  const method = { name };

  if (raw.returnType !== undefined) {
    const returnType = stringValue(raw.returnType, { max: 40 });
    if (!returnType) return fail('El método seleccionado tiene un tipo de retorno inválido');
    method.returnType = returnType;
  }
  if (raw.visibility !== undefined) {
    const visibility = stringValue(raw.visibility, { max: 20 });
    if (!visibility) return fail('El método seleccionado tiene una visibilidad inválida');
    method.visibility = visibility;
  }
  if (raw.parameters !== undefined) {
    if (!Array.isArray(raw.parameters) || raw.parameters.length > 20) {
      return fail('El método seleccionado tiene parámetros inválidos');
    }
    const parameters = [];
    for (const parameter of raw.parameters) {
      if (!isPlainObject(parameter)) return fail('Parámetro seleccionado inválido');
      const parameterName = stringValue(parameter.name);
      const parameterType = stringValue(parameter.type, { max: 40 });
      if (!parameterName || !parameterType) return fail('Parámetro seleccionado inválido');
      parameters.push({ name: parameterName, type: parameterType });
    }
    method.parameters = parameters;
  }
  return ok(method);
}

function validateSelectedElement(raw) {
  if (raw === undefined || raw === null) return ok(null);
  if (!isPlainObject(raw)) return fail('selectedElement debe ser un objeto o null');

  if (raw.kind !== 'node' && raw.kind !== 'edge') {
    return fail('selectedElement.kind debe ser node o edge');
  }
  const id = stringValue(raw.id, { max: MAX_ID });
  if (!id) return fail('selectedElement.id es inválido');

  if (raw.kind === 'node') {
    const name = stringValue(raw.name);
    if (!name) return fail('La clase seleccionada no tiene un nombre válido');

    const selected = { kind: 'node', id, name };
    if (raw.stereotype !== undefined) {
      const stereotype = stringValue(raw.stereotype, { max: 40 });
      if (!stereotype) return fail('La clase seleccionada tiene un estereotipo inválido');
      selected.stereotype = stereotype;
    }

    const attributes = validateAttributeList(raw.attributes);
    if (!attributes.ok) return attributes;
    selected.attributes = attributes.value;

    if (raw.methods !== undefined) {
      if (!Array.isArray(raw.methods) || raw.methods.length > 50) {
        return fail('La clase seleccionada tiene demasiados métodos');
      }
      const methods = [];
      for (const method of raw.methods) {
        const checked = validateSelectedMethod(method);
        if (!checked.ok) return checked;
        methods.push(checked.value);
      }
      selected.methods = methods;
    }

    return ok(selected);
  }

  const type = stringValue(raw.type, { max: 40 });
  if (!type || !RELATIONSHIP_TYPES.has(type)) {
    return fail('La relación seleccionada tiene un tipo inválido');
  }
  const source = validateSelectedEndpoint(raw.source, 'origen');
  if (!source.ok) return source;
  const target = validateSelectedEndpoint(raw.target, 'destino');
  if (!target.ok) return target;

  const selected = {
    kind: 'edge',
    id,
    type,
    source: source.value,
    target: target.value,
  };
  if (raw.label !== undefined) {
    const label = stringValue(raw.label, { max: MAX_NAME });
    if (!label) return fail('La relación seleccionada tiene una etiqueta inválida');
    selected.label = label;
  }
  if (raw.cardinalityFrom !== undefined) {
    const cardinalityFrom = stringValue(raw.cardinalityFrom, { max: 20 });
    if (!cardinalityFrom) return fail('La cardinalidad de origen es inválida');
    selected.cardinalityFrom = cardinalityFrom;
  }
  if (raw.cardinalityTo !== undefined) {
    const cardinalityTo = stringValue(raw.cardinalityTo, { max: 20 });
    if (!cardinalityTo) return fail('La cardinalidad de destino es inválida');
    selected.cardinalityTo = cardinalityTo;
  }
  return ok(selected);
}

function validateDiagramId(value) {
  if (value === undefined || value === null || value === '') return ok('');
  if (typeof value !== 'string') return fail('diagramId inválido');
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return fail('diagramId inválido');
  return ok(id);
}

function validateDiagramName(value, fallback = 'Nuevo diagrama') {
  if (value === undefined || value === null || value === '') return ok(fallback);
  const name = stringValue(value, { max: MAX_NAME });
  if (!name) return fail('El nombre del diagrama es inválido');
  return ok(name);
}

function validateAiProvider(value) {
  if (value === undefined || value === null) return ok(null);
  if (typeof value !== 'string') return fail('provider debe ser groq u ollama');
  const provider = value.trim().toLowerCase();
  if (!AI_PROVIDERS.has(provider)) return fail('provider debe ser groq u ollama');
  return ok(provider);
}

function validateOllamaUrl(value) {
  if (value === undefined || value === null || value === '') return ok(null);
  if (typeof value !== 'string') return fail('ollamaUrl debe ser una URL http(s) v�lida');
  const raw = value.trim();
  if (!raw) return ok(null);
  if (raw.length > 2048) return fail('ollamaUrl es demasiado larga');
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fail('ollamaUrl debe usar http o https');
    }
    if (!parsed.hostname) return fail('ollamaUrl no tiene host');
    if (parsed.username || parsed.password) {
      return fail('ollamaUrl no puede incluir credenciales');
    }
  } catch {
    return fail('ollamaUrl debe ser una URL http(s) v�lida');
  }
  return ok(raw.replace(/\/+$/, ''));
}

function validateOllamaModel(value) {
  if (value === undefined || value === null || value === '') return ok(null);
  if (typeof value !== 'string') return fail('ollamaModel inv�lido');
  const model = value.trim();
  if (!model) return ok(null);
  if (model.length > 120) return fail('ollamaModel es demasiado largo');
  return ok(model);
}

function validateCommandPayload(body) {
  if (!isPlainObject(body)) return fail('Cuerpo inválido');
  const command = stringValue(body.command, { min: 1, max: MAX_TEXT });
  if (!command) return fail('El comando es inválido o demasiado largo');

  const state = validateAstState(body.currentState);
  if (!state.ok) return state;

  const diagram = validateDiagramId(body.diagramId);
  if (!diagram.ok) return diagram;

  const selectedElement = validateSelectedElement(body.selectedElement);
  if (!selectedElement.ok) return selectedElement;

  const provider = validateAiProvider(body.provider);
  if (!provider.ok) return provider;

  let ollamaUrl = ok(null);
  let ollamaModel = ok(null);
  if (provider.value === 'ollama') {
    ollamaUrl = validateOllamaUrl(body.ollamaUrl);
    if (!ollamaUrl.ok) return ollamaUrl;
    ollamaModel = validateOllamaModel(body.ollamaModel);
    if (!ollamaModel.ok) return ollamaModel;
  }

  return ok({
    command,
    currentState: state.value,
    diagramId: diagram.value,
    selectedElement: selectedElement.value,
    provider: provider.value,
    ollamaUrl: ollamaUrl.value,
    ollamaModel: ollamaModel.value,
  });
}

function validateMutations(raw) {
  if (!Array.isArray(raw)) return fail('mutations debe ser un arreglo');
  if (raw.length > MAX_MUTATIONS) return fail('La IA devolvió demasiadas mutaciones');

  const mutations = [];
  for (const item of raw) {
    if (!isPlainObject(item) || !MUTATION_ACTIONS.has(item.action)) {
      return fail('La IA devolvió una acción no permitida');
    }

    if (item.action === 'addEntity') {
      const entityName = stringValue(item.entityName);
      if (!entityName) return fail('addEntity necesita entityName');
      const attributes = validateAttributeList(item.attributes);
      if (!attributes.ok) return attributes;
      mutations.push({ action: item.action, entityName, attributes: attributes.value });
      continue;
    }

    if (item.action === 'addAttribute') {
      const entityName = stringValue(item.entityName);
      if (!entityName) return fail('addAttribute necesita entityName');
      const attribute = validateAttribute(item.attribute);
      if (!attribute.ok) return attribute;
      mutations.push({ action: item.action, entityName, attribute: attribute.value });
      continue;
    }

    if (item.action === 'removeEntity') {
      const entityName = stringValue(item.entityName);
      if (!entityName) return fail('removeEntity necesita entityName');
      mutations.push({ action: item.action, entityName });
      continue;
    }

    if (item.action === 'addRelationship') {
      const sourceEntity = stringValue(item.sourceEntity);
      const targetEntity = stringValue(item.targetEntity);
      const type = stringValue(item.type, { max: 40 });
      if (!sourceEntity || !targetEntity) return fail('addRelationship necesita ambos extremos');
      if (!type || !RELATIONSHIP_TYPES.has(type)) return fail('addRelationship tiene un tipo inválido');

      const cardinalityFrom = item.cardinalityFrom === undefined
        ? undefined
        : stringValue(item.cardinalityFrom, { max: 20 });
      const cardinalityTo = item.cardinalityTo === undefined
        ? undefined
        : stringValue(item.cardinalityTo, { max: 20 });
      if (item.cardinalityFrom !== undefined && !cardinalityFrom) return fail('Cardinalidad inválida');
      if (item.cardinalityTo !== undefined && !cardinalityTo) return fail('Cardinalidad inválida');

      const intermediateAttributes = validateAttributeList(item.intermediateAttributes);
      if (!intermediateAttributes.ok) return intermediateAttributes;

      mutations.push({
        action: item.action,
        sourceEntity,
        targetEntity,
        type,
        ...(cardinalityFrom ? { cardinalityFrom } : {}),
        ...(cardinalityTo ? { cardinalityTo } : {}),
        ...(intermediateAttributes.value.length ? { intermediateAttributes: intermediateAttributes.value } : {}),
      });
      continue;
    }

    const sourceEntity = stringValue(item.sourceEntity);
    const targetEntity = stringValue(item.targetEntity);
    if (!sourceEntity || !targetEntity) return fail('removeRelationship necesita ambos extremos');
    mutations.push({ action: item.action, sourceEntity, targetEntity });
  }

  return ok(mutations);
}

function validateRegisterBody(body) {
  if (!isPlainObject(body)) return fail('Cuerpo inválido');
  const username = stringValue(body.username, { min: 3, max: 50 });
  const email = stringValue(body.email, { min: 3, max: 254 });
  const password = stringValue(body.password, { min: 6, max: 200, trim: false });
  if (!username) return fail('Username inválido');
  if (!email || !email.includes('@')) return fail('Email inválido');
  if (!password) return fail('Password inválida');
  return ok({ username, email, password });
}

function validateLoginBody(body) {
  if (!isPlainObject(body)) return fail('Cuerpo inválido');
  const username = stringValue(body.username, { min: 1, max: 254 });
  const password = stringValue(body.password, { min: 1, max: 200, trim: false });
  if (!username || !password) return fail('Credenciales inválidas');
  return ok({ username, password });
}

function validateSaveDiagramBody(body) {
  if (!isPlainObject(body)) return fail('Cuerpo inválido');
  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return fail('nodes y edges deben ser arreglos');
  }
  if (body.nodes.length > 2000 || body.edges.length > 2000) {
    return fail('El diagrama supera el tamaño permitido');
  }
  const name = validateDiagramName(body.name, '');
  if (!name.ok) return name;
  return ok({ name: name.value, nodes: body.nodes, edges: body.edges });
}

module.exports = {
  isPlainObject,
  validateAttribute,
  validateAttributeList,
  validateAstState,
  validateSelectedElement,
  validateAiProvider,
  validateOllamaUrl,
  validateOllamaModel,
  validateDiagramId,
  validateDiagramName,
  validateCommandPayload,
  validateMutations,
  validateRegisterBody,
  validateLoginBody,
  validateSaveDiagramBody,
  MAX_NAME,
  MAX_TEXT,
};
