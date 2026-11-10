'use strict';

const MAX_NAME = 120;
const MAX_TEXT = 4000;
const MAX_ID = 128;
const MAX_ENTITIES = 300;
const MAX_RELATIONSHIPS = 600;
const MAX_ATTRIBUTES = 100;
const MAX_MUTATIONS = 200;
const AI_PROVIDERS = new Set(['groq', 'ollama', 'gemini']);

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

module.exports = {
  MAX_NAME,
  MAX_TEXT,
  MAX_ID,
  MAX_ENTITIES,
  MAX_RELATIONSHIPS,
  MAX_ATTRIBUTES,
  MAX_MUTATIONS,
  AI_PROVIDERS,
  RELATIONSHIP_TYPES,
  MUTATION_ACTIONS,
  isPlainObject,
  stringValue,
  ok,
  fail,
};
