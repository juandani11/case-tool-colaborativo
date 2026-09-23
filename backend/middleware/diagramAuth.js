// Autorización por diagrama (Fase 2A).
// La ACL se crea SIEMPRE al acceder (incluso con AUTH_ENABLED=false),
// pero solo se VALIDA cuando está activo. Así los .acl.json existen
// aunque no se apliquen.
const aclService = require('../services/aclService');

function enabled() {
  return process.env.AUTH_ENABLED === 'true';
}

function diagramIdOf(req) {
  return req.params.diagramId || req.params.id;
}

/**
 * Exige ser miembro (OWNER, EDITOR o VIEWER). Crea la ACL al vuelo
 * (migración de diagramas legacy) con el usuario actual como OWNER.
 */
async function requireDiagramMember(req, res, next) {
  const diagramId = diagramIdOf(req);
  if (!diagramId) return res.status(400).json({ error: 'Falta diagramId' });

  try {
    await aclService.getOrCreateACL(diagramId, req.user?.userId);
    if (!enabled()) return next();
    const role = await aclService.getRoleForUser(diagramId, req.user?.userId);
    if (role === 'NONE') {
      return res.status(403).json({ error: 'No tienes acceso a este diagrama' });
    }
    req.userRole = role;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Exige uno de los roles indicados. Uso: requireDiagramRole('OWNER', 'EDITOR').
 * También auto-crea la ACL (migración), igual que requireDiagramMember.
 */
function requireDiagramRole(...allowedRoles) {
  return async (req, res, next) => {
    const diagramId = diagramIdOf(req);
    if (!diagramId) return res.status(400).json({ error: 'Falta diagramId' });

    try {
      await aclService.getOrCreateACL(diagramId, req.user?.userId);
      if (!enabled()) return next();
      const role = await aclService.getRoleForUser(diagramId, req.user?.userId);
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          error: 'Permiso insuficiente',
          required: allowedRoles,
          current: role,
        });
      }
      req.userRole = role;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

/**
 * Permiso de escritura: si el diagrama no tiene ACL, el que lo crea es
 * OWNER (getOrCreateACL idempotente). Si ya existe, exige OWNER o EDITOR.
 * Los VIEWER reciben 403 al intentar guardar.
 */
async function requireDiagramWrite(req, res, next) {
  const diagramId = diagramIdOf(req);
  if (!diagramId) return res.status(400).json({ error: 'Falta diagramId' });

  try {
    await aclService.getOrCreateACL(diagramId, req.user?.userId);
    if (!enabled()) return next();
    const role = await aclService.getRoleForUser(diagramId, req.user?.userId);
    if (role !== 'OWNER' && role !== 'EDITOR') {
      return res.status(403).json({ error: 'Solo OWNER o EDITOR pueden modificar este diagrama' });
    }
    req.userRole = role;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { requireDiagramMember, requireDiagramRole, requireDiagramWrite };
