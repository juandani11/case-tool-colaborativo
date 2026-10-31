'use strict';

const aclService = require('../services/aclService');
const { asyncHandler, httpError } = require('../errors');

function enabled() {
  return process.env.AUTH_ENABLED === 'true';
}

function diagramIdOf(req) {
  return req.params.diagramId || req.params.id;
}

async function resolveRole(req) {
  const diagramId = diagramIdOf(req);
  if (!diagramId) throw httpError(400, 'Falta diagramId');
  if (!enabled()) return { role: 'OWNER', diagramId };

  const role = await aclService.getRoleForUser(diagramId, req.user?.userId);
  return { role, diagramId };
}

const requireDiagramMember = asyncHandler(async (req, res, next) => {
  const access = await resolveRole(req);
  if (access.role === 'NONE') throw httpError(403, 'No tienes acceso a este diagrama');
  req.userRole = access.role;
  next();
});

function requireDiagramRole(...allowedRoles) {
  return asyncHandler(async (req, res, next) => {
    const access = await resolveRole(req);
    if (!allowedRoles.includes(access.role)) {
      throw httpError(403, 'Permiso insuficiente', {
        required: allowedRoles,
        current: access.role,
      });
    }
    req.userRole = access.role;
    next();
  });
}

const requireDiagramWrite = asyncHandler(async (req, res, next) => {
  const access = await resolveRole(req);
  if (access.role !== 'OWNER' && access.role !== 'EDITOR') {
    throw httpError(403, 'Solo OWNER o EDITOR pueden modificar este diagrama');
  }
  req.userRole = access.role;
  next();
});

module.exports = { requireDiagramMember, requireDiagramRole, requireDiagramWrite };
