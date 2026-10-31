'use strict';

const express = require('express');
const userService = require('../services/userService');
const { requireAuth, signToken } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../errors');
const { validateRegisterBody, validateLoginBody } = require('../validation');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const checked = validateRegisterBody(req.body);
  if (!checked.ok) throw httpError(400, checked.error);

  const user = await userService.createUser(checked.value);
  res.status(201).json({ token: signToken(user), user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const checked = validateLoginBody(req.body);
  if (!checked.ok) throw httpError(401, 'Credenciales inválidas');

  const user = await userService.verifyPassword(checked.value.username, checked.value.password);
  if (!user) throw httpError(401, 'Credenciales inválidas');

  res.json({ token: signToken(user), user });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.userId === 'anonymous') {
    return res.json({ user: null, anonymous: true });
  }

  const user = await userService.findById(req.user.userId);
  if (!user) throw httpError(404, 'Usuario no encontrado');

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe });
}));

router.get('/status', (req, res) => {
  res.json({ authEnabled: process.env.AUTH_ENABLED === 'true' });
});

module.exports = router;
