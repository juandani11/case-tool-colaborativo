'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../errors');
const accessRequestService = require('../services/accessRequestService');

const router = express.Router();

router.post(
  '/diagrams/:id/request-access',
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await accessRequestService.createRequest(
      req.params.id,
      req.user?.userId
    );
    res.status(201).json({ request });
  })
);

router.get(
  '/access-requests/pending',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requests = await accessRequestService.listPendingForOwner(req.user?.userId);
    // Contrato simple: [] cuando no hay solicitudes.
    res.json(requests);
  })
);

router.post(
  '/access-requests/:id/respond',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
    if (action !== 'APPROVE' && action !== 'REJECT') {
      throw httpError(400, 'action debe ser APPROVE o REJECT');
    }

    const role = body.role === undefined
      ? 'VIEWER'
      : String(body.role).trim().toUpperCase();
    if (role !== 'EDITOR' && role !== 'VIEWER') {
      throw httpError(400, 'role debe ser EDITOR o VIEWER');
    }

    const result = await accessRequestService.respondToRequest({
      requestId: req.params.id,
      ownerId: req.user?.userId,
      action,
      role,
    });
    res.json({ request: result });
  })
);

module.exports = router;
