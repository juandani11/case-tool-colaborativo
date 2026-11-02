'use strict';

const { MAX_NAME, isPlainObject, stringValue, ok, fail } = require('./core');

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
  validateDiagramId,
  validateDiagramName,
  validateSaveDiagramBody,
};
