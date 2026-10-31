// CRUD de ACLs por diagrama persistido en PostgreSQL (auth.diagram_acl).
// Cada fila es (diagram_id, user_id, role). El OWNER también es una fila.
const { pool, withTransaction, normalizeUserId, isValidUserId } = require('../db');
const { httpError } = require('../errors');

function safeId(diagramId) {
  return String(diagramId || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function requireUserId(userId) {
  const id = String(userId || '').trim();
  if (!isValidUserId(id)) throw httpError(400, 'ID de usuario inválido');
  return id;
}

async function readACLWith(queryable, diagramId) {
  const id = safeId(diagramId);
  if (!id) return null;
  const { rows } = await queryable.query(
    `SELECT user_id, role, granted_at
     FROM auth.diagram_acl
     WHERE diagram_id = $1
     ORDER BY granted_at ASC`,
    [id]
  );
  if (!rows.length) return null;

  const ownerRow = rows.find(row => row.role === 'OWNER') || rows[0];
  const members = rows
    .filter(row => row.user_id !== ownerRow.user_id)
    .map(row => ({
      userId: row.user_id,
      role: row.role,
      addedAt: row.granted_at instanceof Date ? row.granted_at.toISOString() : row.granted_at,
    }));
  const dates = rows
    .map(row => (row.granted_at instanceof Date ? row.granted_at : new Date(row.granted_at)))
    .filter(date => !Number.isNaN(date.getTime()));

  return {
    diagramId: id,
    ownerId: ownerRow.user_id,
    members,
    createdAt: dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString() : null,
    updatedAt: dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString() : null,
  };
}

async function readACL(diagramId) {
  return readACLWith(pool, diagramId);
}

// Reemplaza el ACL completo. Se conserva por compatibilidad con llamadas
// antiguas, aunque las rutas nuevas usan addMember/removeMember.
async function writeACL(diagramId, acl) {
  const id = safeId(diagramId);
  if (!id) throw httpError(400, 'ID de diagrama inválido');
  const ownerId = normalizeUserId(acl?.ownerId);
  const members = Array.isArray(acl?.members) ? acl.members : [];

  return withTransaction(async (client) => {
    await client.query('DELETE FROM auth.diagram_acl WHERE diagram_id = $1', [id]);
    await client.query(
      `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [id, ownerId]
    );
    for (const member of members) {
      if (!member?.userId || !member?.role) continue;
      if (!['EDITOR', 'VIEWER'].includes(member.role)) continue;
      await client.query(
        `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (diagram_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [id, requireUserId(member.userId), member.role]
      );
    }
    return readACLWith(client, id);
  });
}

// Idempotente: si el diagrama ya tiene ACL, la devuelve sin recrearla.
async function getOrCreateACL(diagramId, userId = 'anonymous') {
  const id = safeId(diagramId);
  if (!id) throw httpError(400, 'ID de diagrama inválido');
  const ownerId = normalizeUserId(userId);

  return withTransaction(async (client) => {
    // Evita que dos primeras conexiones simultáneas creen dos OWNER.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
    const { rowCount } = await client.query(
      'SELECT 1 FROM auth.diagram_acl WHERE diagram_id = $1 LIMIT 1',
      [id]
    );
    if (rowCount === 0) {
      await client.query(
        `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
         VALUES ($1, $2, 'OWNER')
         ON CONFLICT (diagram_id, user_id) DO NOTHING`,
        [id, ownerId]
      );
    }
    return readACLWith(client, id);
  });
}

async function getRoleForUser(diagramId, userId) {
  const id = safeId(diagramId);
  if (!id) return 'NONE';
  const { rows } = await pool.query(
    'SELECT role FROM auth.diagram_acl WHERE diagram_id = $1 AND user_id = $2 LIMIT 1',
    [id, normalizeUserId(userId)]
  );
  return rows[0]?.role || 'NONE';
}

function assertValidRole(role) {
  if (role !== 'EDITOR' && role !== 'VIEWER') {
    throw httpError(400, 'Rol inválido (debe ser EDITOR o VIEWER)');
  }
}

async function addMember(diagramId, { userId, role }) {
  const id = safeId(diagramId);
  if (!id) throw httpError(400, 'ID de diagrama inválido');
  assertValidRole(role);
  const memberId = requireUserId(userId);

  const diagram = await pool.query('SELECT 1 FROM core.diagrams WHERE id = $1 LIMIT 1', [id]);
  if (diagram.rowCount === 0) throw httpError(404, 'Diagrama no encontrado');

  const existing = await pool.query(
    'SELECT role FROM auth.diagram_acl WHERE diagram_id = $1 AND user_id = $2 LIMIT 1',
    [id, memberId]
  );
  if (existing.rows[0]?.role === 'OWNER') {
    throw httpError(400, 'El owner ya es miembro');
  }

  await pool.query(
    `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (diagram_id, user_id) DO UPDATE
       SET role = EXCLUDED.role`,
    [id, memberId, role]
  );
  return readACL(id);
}

async function updateMemberRole(diagramId, userId, role) {
  return addMember(diagramId, { userId, role });
}

async function removeMember(diagramId, userId) {
  const id = safeId(diagramId);
  if (!id) throw httpError(400, 'ID de diagrama inválido');
  const memberId = requireUserId(userId);

  const existing = await pool.query(
    'SELECT role FROM auth.diagram_acl WHERE diagram_id = $1 AND user_id = $2 LIMIT 1',
    [id, memberId]
  );
  if (!existing.rowCount) throw httpError(404, 'Diagrama no encontrado');
  if (existing.rows[0].role === 'OWNER') {
    throw httpError(400, 'No se puede eliminar al owner');
  }

  await pool.query(
    'DELETE FROM auth.diagram_acl WHERE diagram_id = $1 AND user_id = $2',
    [id, memberId]
  );
  return readACL(id);
}

async function deleteACL(diagramId) {
  const id = safeId(diagramId);
  if (!id) return;
  await pool.query('DELETE FROM auth.diagram_acl WHERE diagram_id = $1', [id]);
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
