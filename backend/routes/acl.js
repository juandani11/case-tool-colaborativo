'use strict';

const express = require('express');
const aclService = require('../services/aclService');
const userService = require('../services/userService');
const { requireAuth, authEnabled } = require('../middleware/auth');
const { requireDiagramMember, requireDiagramRole } = require('../middleware/diagramAuth');
const { asyncHandler, httpError } = require('../errors');

const router = express.Router();

router.get(
  '/diagrams/:diagramId/role',
  requireAuth,
  requireDiagramMember,
  (req, res) => {
    if (!authEnabled()) return res.json({ role: 'OWNER' });
    res.json({ role: req.userRole });
  }
);

router.get(
  '/diagrams/:diagramId/acl',
  requireAuth,
  requireDiagramRole('OWNER'),
  asyncHandler(async (req, res) => {
    const acl = await aclService.readACL(req.params.diagramId);
    if (!acl) {
      return res.json({ diagramId: req.params.diagramId, ownerId: null, members: [], owner: null });
    }

    const members = await Promise.all(
      (acl.members || []).map(async (member) => {
        const user = await userService.findById(member.userId);
        return {
          ...member,
          username: user?.username || 'desconocido',
          email: user?.email,
        };
      })
    );
    const owner = await userService.findById(acl.ownerId);
    res.json({
      ...acl,
      members,
      owner: owner ? { id: owner.id, username: owner.username, email: owner.email } : null,
    });
  })
);

router.post(
  '/diagrams/:diagramId/members',
  requireAuth,
  requireDiagramRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { username, role } = req.body || {};
    const memberUsername = typeof username === 'string' ? username.trim() : '';
    if (!memberUsername || memberUsername.length > 50 || !role) {
      throw httpError(400, 'Falta username o role');
    }
    if (role !== 'EDITOR' && role !== 'VIEWER') {
      throw httpError(400, 'Rol inválido (debe ser EDITOR o VIEWER)');
    }

    const user = await userService.findByUsername(memberUsername);
    if (!user) throw httpError(404, 'Usuario no encontrado');

    const acl = await aclService.addMember(req.params.diagramId, {
      userId: user.id,
      role,
    });
    res.status(201).json(acl);
  })
);

router.patch(
  '/diagrams/:diagramId/members/:userId',
  requireAuth,
  requireDiagramRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { role } = req.body || {};
    if (role !== 'EDITOR' && role !== 'VIEWER') {
      throw httpError(400, 'Rol inválido (debe ser EDITOR o VIEWER)');
    }

    const acl = await aclService.updateMemberRole(
      req.params.diagramId,
      req.params.userId,
      role
    );
    res.json(acl);
  })
);

router.delete(
  '/diagrams/:diagramId/members/:userId',
  requireAuth,
  requireDiagramMember,
  asyncHandler(async (req, res) => {
    const targetId = req.params.userId;
    const isSelf = targetId === req.user.userId;
    const isOwner = req.userRole === 'OWNER';
    if (!isSelf && !isOwner) {
      throw httpError(403, 'Solo el OWNER o el propio usuario');
    }

    const acl = await aclService.removeMember(req.params.diagramId, targetId);
    res.json(acl);
  })
);

module.exports = router;
