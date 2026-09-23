// Autenticación JWT (Fase 1).
// Si AUTH_ENABLED=false: requireAuth deja pasar como 'anonymous',
// optionalAuth deja req.user = null. Cero cambios de comportamiento.
const jwt = require('jsonwebtoken');

function authEnabled() {
  return process.env.AUTH_ENABLED === 'true';
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET no configurado o muy corto (mínimo 32 caracteres)');
  }
  return secret;
}

/**
 * Exige JWT válido en Authorization: Bearer <token>.
 */
function requireAuth(req, res, next) {
  if (!authEnabled()) {
    req.user = { userId: 'anonymous', username: 'anonymous' };
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(auth.slice(7), getSecret());
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Adjunta el usuario si hay token válido, sin bloquear si no hay.
 */
function optionalAuth(req, res, next) {
  if (!authEnabled()) {
    req.user = null;
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(auth.slice(7), getSecret());
    req.user = { userId: payload.userId, username: payload.username };
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Firma un JWT para un usuario (ya sanitizado, sin passwordHash).
 */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
  );
}

/**
 * Valida un token de query param (WebSocket). Devuelve el payload o null.
 * En Fase 1 no bloquea: solo se adjunta a la conexión.
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

module.exports = { requireAuth, optionalAuth, signToken, verifyToken, authEnabled };
