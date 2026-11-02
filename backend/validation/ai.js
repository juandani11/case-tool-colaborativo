'use strict';

const { AI_PROVIDERS, ok, fail } = require('./core');

function validateAiProvider(value) {
  if (value === undefined || value === null) return ok(null);
  if (typeof value !== 'string') return fail('provider debe ser groq u ollama');
  const provider = value.trim().toLowerCase();
  if (!AI_PROVIDERS.has(provider)) return fail('provider debe ser groq u ollama');
  return ok(provider);
}

function validateOllamaUrl(value) {
  if (value === undefined || value === null || value === '') return ok(null);
  if (typeof value !== 'string') return fail('ollamaUrl debe ser una URL http(s) válida');
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
    return fail('ollamaUrl debe ser una URL http(s) válida');
  }
  return ok(raw.replace(/\/+$/, ''));
}

function validateOllamaModel(value) {
  if (value === undefined || value === null || value === '') return ok(null);
  if (typeof value !== 'string') return fail('ollamaModel inválido');
  const model = value.trim();
  if (!model) return ok(null);
  if (model.length > 120) return fail('ollamaModel es demasiado largo');
  return ok(model);
}

module.exports = {
  validateAiProvider,
  validateOllamaUrl,
  validateOllamaModel,
};
