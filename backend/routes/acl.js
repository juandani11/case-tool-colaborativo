// Gestión de miembros por diagrama (Fase 2A). Se monta en /api,
// con rutas /diagrams/:diagramId/{role,acl,members...}.
const express = require('express');
const aclService = require('../services/aclService');
const userService = require('../services/userService');
const { requireAuth, authEnabled } = require('../middleware/auth');
const { requireDiagramMember, requireDiagramRole } = require('../middleware/diagramAuth');

const router = express.Router();

/**
 * GET /api/diagrams/:diagramId/role — rol del usuario actual.
 * Con AUTH_ENABLED=false devuelve OWNER (acceso total, como antes).
 */
router.get(
  '/diagrams/:diagramId/role',
  requireAuth,
  requireDiagramMember,
  (req, res) => {
    if (!authEnabled()) {
      return res.json({ role: 'OWNER' });
    }
    res.json({ role: req.userRole });
  }
);

/**
 * GET /api/diagrams/:diagramId/acl — ACL enriquecida (solo OWNER).
 */
router.get(
  '/diagrams/:diagramId/acl',
  requireAuth,
  requireDiagramRole('OWNER'),
  async (req, res) => {
    try {
      const acl = await aclService.getOrCreateACL(req.params.diagramId, req.user.userId);
      const members = await Promise.all(
        (acl.members || []).map(async m => {
          const user = await userService.findById(m.userId);
          return {
            ...m,
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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /api/diagrams/:diagramId/members — invitar por username (solo OWNER).
 * Body: { username, role }
 */
router.post(
  '/diagrams/:diagramId/members',
  requireAuth,
  requireDiagramRole('OWNER'),
  async (req, res) => {
    try {
      const { username, role } = req.body || {};
      if (!username || !role) {
        return res.status(400).json({ error: 'Falta username o role' });
      }
      const user = await userService.findByUsername(username);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      const acl = await aclService.addMember(req.params.diagramId, {
        userId: user.id,
        role,
      });
      res.status(201).json(acl);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * PATCH /api/diagrams/:diagramId/members/:userId — cambiar rol (solo OWNER).
 */
router.patch(
  '/diagrams/:diagramId/members/:userId',
  requireAuth,
  requireDiagramRole('OWNER'),
  async (req, res) => {
    try {
      const { role } = req.body || {};
      if (!role) return res.status(400).json({ error: 'Falta role' });
      const acl = await aclService.updateMemberRole(
        req.params.diagramId,
        req.params.userId,
        role
      );
      res.json(acl);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * DELETE /api/diagrams/:diagramId/members/:userId — eliminar miembro.
 * El OWNER elimina a cualquiera; cualquiera puede eliminarse a sí mismo.
 */
router.delete(
  '/diagrams/:diagramId/members/:userId',
  requireAuth,
  requireDiagramMember,
  async (req, res) => {
    try {
      const targetId = req.params.userId;
      const isSelf = targetId === req.user.userId;
      const isOwner = req.userRole === 'OWNER';
      if (!isSelf && !isOwner) {
        return res.status(403).json({ error: 'Solo el OWNER o el propio usuario' });
      }
      const acl = await aclService.removeMember(req.params.diagramId, targetId);
      res.json(acl);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;
