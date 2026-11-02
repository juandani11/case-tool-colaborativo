'use strict';

const { isPlainObject, stringValue, ok, fail } = require('./core');

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

module.exports = {
  validateRegisterBody,
  validateLoginBody,
};
