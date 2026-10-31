'use strict';

const express = require('express');
const diagramService = require('../services/diagramService');
const aclService = require('../services/aclService');
const chatService = require('../services/chatService');
const { requireAuth, authEnabled } = require('../middleware/auth');
const { requireDiagramMember, requireDiagramRole, requireDiagramWrite } = require('../middleware/diagramAuth');
const { asyncHandler, httpError } = require('../errors');
const {
  validateSaveDiagramBody,
  validateDiagramId,
  validateDiagramName,
} = require('../validation');

const router = express.Router();

router.get('/diagrams', requireAuth, asyncHandler(async (req, res) => {
  const includeAll = !authEnabled();
  const diagrams = await diagramService.listVisibleForUser(req.user?.userId, includeAll);
  const owned = [];
  const shared = [];

  for (const diagram of diagrams) {
    if (includeAll || diagram.role === 'OWNER') {
      owned.push({ ...diagram, role: 'OWNER' });
    } else {
      shared.push(diagram);
    }
  }

  res.json({ owned, shared });
}));

router.post('/diagrams', requireAuth, asyncHandler(async (req, res) => {
  const checkedName = validateDiagramName(req.body?.name);
  if (!checkedName.ok) throw httpError(400, checkedName.error);

  const diagramId = `diagram-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const diagram = await diagramService.createDiagramWithOwner({
    id: diagramId,
    name: checkedName.value,
    ownerId: req.user?.userId || 'anonymous',
  });

  res.status(201).json({ id: diagram.id, name: diagram.name });
}));

router.get('/diagrams/:id', requireAuth, requireDiagramMember, asyncHandler(async (req, res) => {
  const diagram = await diagramService.getDiagram(req.params.id);
  if (!diagram) throw httpError(404, 'Diagrama no encontrado');

  const messages = await chatService.getRecentMessages(req.params.id, 200);
  res.json({
    name: diagram.name || `Diagrama ${req.params.id.replace(/^diagram-/, '')}`,
    nodes: [],
    edges: [],
    chat: messages.map(chatService.toWireMessage),
  });
}));

router.post('/diagrams/:id', requireAuth, asyncHandler(async (req, res) => {
  const idCheck = validateDiagramId(req.params.id);
  if (!idCheck.ok || !idCheck.value) throw httpError(400, 'ID de diagrama inválido');

  const checked = validateSaveDiagramBody(req.body);
  if (!checked.ok) throw httpError(400, checked.error);

  const { created, diagram } = await diagramService.createDiagramWithOwnerIfAbsent({
    id: idCheck.value,
    name: checked.value.name,
    ownerId: req.user?.userId,
  });

  if (!created) {
    if (!diagram) throw httpError(404, 'Diagrama no encontrado');
    if (authEnabled()) {
      const role = await aclService.getRoleForUser(idCheck.value, req.user?.userId);
      if (role !== 'OWNER' && role !== 'EDITOR') {
        throw httpError(403, 'Sin permiso para guardar este diagrama');
      }
    }
    if (checked.value.name && checked.value.name !== diagram.name) {
      await diagramService.renameDiagram(idCheck.value, checked.value.name);
    } else {
      await diagramService.touchDiagram(idCheck.value);
    }
  }

  res.json({ ok: true });
}));

router.put('/diagrams/:id/rename', requireAuth, requireDiagramWrite, asyncHandler(async (req, res) => {
  const checked = validateDiagramName(req.body?.name, '');
  if (!checked.ok || !checked.value) throw httpError(400, 'name is required');

  const updated = await diagramService.renameDiagram(req.params.id, checked.value);
  if (!updated) throw httpError(404, 'Diagrama no encontrado');
  res.json({ ok: true, name: updated.name });
}));

router.delete('/diagrams/:id', requireAuth, requireDiagramRole('OWNER'), asyncHandler(async (req, res) => {
  const deleted = await diagramService.deleteDiagram(req.params.id);
  if (!deleted) throw httpError(404, 'Diagrama no encontrado');
  res.status(204).send();
}));

module.exports = router;
