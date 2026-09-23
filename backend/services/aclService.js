// CRUD de ACLs por diagrama (Fase 2A).
// Cada <diagramId>.json tiene un hermano <diagramId>.acl.json con
// { diagramId, ownerId, members: [{ userId, role, addedAt }] }.
const fs = require('fs').promises;
const path = require('path');

const DIAGRAMS_DIR = path.join(__dirname, '..', 'data', 'diagrams');

function safeId(diagramId) {
  // Misma sanitización que diagramPath() en server.js
  return String(diagramId || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function aclPath(diagramId) {
  return path.join(DIAGRAMS_DIR, `${safeId(diagramId)}.acl.json`);
}

async function readACL(diagramId) {
  try {
    const content = await fs.readFile(aclPath(diagramId), 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeACL(diagramId, acl) {
  acl.updatedAt = new Date().toISOString();
  await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
  await fs.writeFile(aclPath(diagramId), JSON.stringify(acl, null, 2), 'utf-8');
}

// Idempotente: si ya existe, la devuelve sin recrear.
async function getOrCreateACL(diagramId, userId = 'anonymous') {
  const existing = await readACL(diagramId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const acl = {
    diagramId: safeId(diagramId),
    ownerId: userId || 'anonymous',
    members: [],
    createdAt: now,
    updatedAt: now,
  };
  await writeACL(diagramId, acl);
  return acl;
}

async function getRoleForUser(diagramId, userId) {
  if (!userId) return 'NONE';
  const acl = await readACL(diagramId);
  if (!acl) return 'NONE';
  if (acl.ownerId === userId) return 'OWNER';
  const member = (acl.members || []).find(m => m.userId === userId);
  return member ? member.role : 'NONE';
}

function assertValidRole(role) {
  if (role !== 'EDITOR' && role !== 'VIEWER') {
    throw new Error('Rol inválido (debe ser EDITOR o VIEWER)');
  }
}

async function addMember(diagramId, { userId, role }) {
  const acl = await readACL(diagramId);
  if (!acl) throw new Error('Diagrama no encontrado');
  assertValidRole(role);
  if (acl.ownerId === userId) {
    throw new Error('El owner ya es miembro');
  }
  const existing = acl.members.find(m => m.userId === userId);
  if (existing) {
    existing.role = role;
  } else {
    acl.members.push({ userId, role, addedAt: new Date().toISOString() });
  }
  await writeACL(diagramId, acl);
  return acl;
}

async function updateMemberRole(diagramId, userId, role) {
  return addMember(diagramId, { userId, role });
}

async function removeMember(diagramId, userId) {
  const acl = await readACL(diagramId);
  if (!acl) throw new Error('Diagrama no encontrado');
  if (acl.ownerId === userId) {
    throw new Error('No se puede eliminar al owner');
  }
  acl.members = acl.members.filter(m => m.userId !== userId);
  await writeACL(diagramId, acl);
  return acl;
}

async function deleteACL(diagramId) {
  try {
    await fs.unlink(aclPath(diagramId));
  } catch {
    // No existía: nada que borrar
  }
}

module.exports = {
  readACL,
  writeACL,
  getOrCreateACL,
  getRoleForUser,
  addMember,
  updateMemberRole,
  removeMember,
  deleteACL,
};
