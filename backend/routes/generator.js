'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { generateProject } = require('../generator/generate');
const { asyncHandler, httpError } = require('../errors');
const { validateAstState } = require('../validation');

const router = express.Router();

// POST /api/generate
// Body: { currentState: { entities: [...], relationships: [...] } }
// Devuelve application/zip con el backend generado.
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const stateCheck = validateAstState(req.body?.currentState, { requireEntities: true });
  if (!stateCheck.ok) throw httpError(400, stateCheck.error);

  const zipPath = await generateProject(stateCheck.value);
  res.download(zipPath, 'backend-generado.zip', (err) => {
    if (err) console.error('Error al descargar ZIP:', err);
    fs.rmSync(path.dirname(zipPath), { recursive: true, force: true });
  });
}));

module.exports = router;
