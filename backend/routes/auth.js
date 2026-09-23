// Rutas de autenticación (Fase 1). Públicas siempre (incluso con AUTH_ENABLED=true).
const express = require('express');
const userService = require('../services/userService');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register — Body: { username, email, password }
 * El primer usuario se registra sin invitación (bootstrap).
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const user = await userService.createUser({ username, email, password });
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login — Body: { username, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await userService.verifyPassword(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me — Header: Authorization: Bearer <token>
 */
router.get('/me', requireAuth, async (req, res) => {
  if (req.user.userId === 'anonymous') {
    return res.json({ user: null, anonymous: true });
  }
  const user = await userService.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe });
});

/**
 * GET /api/auth/status — indica si AUTH_ENABLED está activo.
 */
router.get('/status', (req, res) => {
  res.json({ authEnabled: process.env.AUTH_ENABLED === 'true' });
});

module.exports = router;
