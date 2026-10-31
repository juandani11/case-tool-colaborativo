// Persistencia de diagramas en PostgreSQL (schema core).
// El grafo/chat vivo sigue en Yjs; yjs_snapshot guarda el estado binario.
const Y = require('yjs');
const { pool, withTransaction, normalizeUserId } = require('../db');
const { httpError } = require('../errors');

function safeId(diagramId) {
  return String(diagramId || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function timestampMs(value) {
  if (!value) return Date.now();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function summarizeSnapshot(snapshot) {
  if (!snapshot) return { entityCount: 0, relationshipCount: 0 };
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, new Uint8Array(snapshot));
    return {
      entityCount: doc.getMap('nodes').size,
      relationshipCount: doc.getMap('edges').size,
    };
  } catch (err) {
    console.error('No se pudo leer el snapshot Yjs:', err.message);
    return { entityCount: 0, relationshipCount: 0 };
  } finally {
    doc.destroy();
  }
}

function toCard(row) {
  const counts = summarizeSnapshot(row.yjs_snapshot);
  return {
    id: row.id,
    name: row.name || 'Sin nombre',
    role: row.role || 'OWNER',
    entityCount: counts.entityCount,
    relationshipCount: counts.relationshipCount,
    updatedAt: timestampMs(row.updated_at),
    ...(row.owner_username ? { ownerUsername: row.owner_username } : {}),
  };
}

async function listVisibleForUser(userId, includeAll = false) {
  if (includeAll) {
    const { rows } = await pool.query(
      `SELECT d.*, 'OWNER'::text AS role, owner.username AS owner_username
       FROM core.diagrams d
       LEFT JOIN auth.users owner ON owner.id = d.owner_id
       ORDER BY d.updated_at DESC`
    );
    return rows.map(toCard);
  }

  const { rows } = await pool.query(
    `SELECT d.*, acl.role, owner.username AS owner_username
     FROM auth.diagram_acl acl
     JOIN core.diagrams d ON d.id = acl.diagram_id
     LEFT JOIN auth.users owner ON owner.id = d.owner_id
     WHERE acl.user_id = $1
     ORDER BY d.updated_at DESC`,
    [normalizeUserId(userId)]
  );
  return rows.map(toCard);
}

async function getDiagram(diagramId) {
  const id = safeId(diagramId);
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT d.*, owner.username AS owner_username
     FROM core.diagrams d
     LEFT JOIN auth.users owner ON owner.id = d.owner_id
     WHERE d.id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createDiagram({ id, name, ownerId }) {
  const diagramId = safeId(id);
  if (!diagramId) throw httpError(400, 'ID de diagrama inválido');
  const diagramName = String(name || '').trim() || 'Nuevo diagrama';
  const { rows } = await pool.query(
    `INSERT INTO core.diagrams (id, name, owner_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [diagramId, diagramName, normalizeUserId(ownerId)]
  );
  return rows[0];
}

async function createDiagramWithOwner({ id, name, ownerId }) {
  const diagramId = safeId(id);
  if (!diagramId) throw httpError(400, 'ID de diagrama inválido');
  const diagramName = String(name || '').trim() || 'Nuevo diagrama';
  const owner = normalizeUserId(ownerId);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO core.diagrams (id, name, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [diagramId, diagramName, owner]
    );
    await client.query(
      `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
       VALUES ($1, $2, 'OWNER')
       ON CONFLICT (diagram_id, user_id) DO UPDATE SET role = 'OWNER'`,
      [diagramId, owner]
    );
    return rows[0];
  });
}

async function createDiagramWithOwnerIfAbsent({ id, name, ownerId }) {
  const diagramId = safeId(id);
  if (!diagramId) throw httpError(400, 'ID de diagrama inválido');
  const diagramName = String(name || '').trim() || `Diagrama ${diagramId.replace(/^diagram-/, '')}`;
  const owner = normalizeUserId(ownerId);

  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO core.diagrams (id, name, owner_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [diagramId, diagramName, owner]
    );

    if (inserted.rowCount === 0) {
      const existing = await client.query(
        'SELECT * FROM core.diagrams WHERE id = $1 LIMIT 1',
        [diagramId]
      );
      return { created: false, diagram: existing.rows[0] || null };
    }

    await client.query(
      `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
       VALUES ($1, $2, 'OWNER')
       ON CONFLICT (diagram_id, user_id) DO UPDATE SET role = 'OWNER'`,
      [diagramId, owner]
    );
    return { created: true, diagram: inserted.rows[0] };
  });
}

async function ensureDiagram({ id, name, ownerId }) {
  const diagramId = safeId(id);
  if (!diagramId) throw httpError(400, 'ID de diagrama inválido');
  const diagramName = String(name || '').trim() || `Diagrama ${diagramId.replace(/^diagram-/, '')}`;
  const { rows } = await pool.query(
    `INSERT INTO core.diagrams (id, name, owner_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [diagramId, diagramName, normalizeUserId(ownerId)]
  );
  return rows[0] || getDiagram(diagramId);
}

async function upsertDiagram({ id, name, ownerId }) {
  const diagramId = safeId(id);
  if (!diagramId) throw httpError(400, 'ID de diagrama inválido');
  const diagramName = String(name || '').trim() || `Diagrama ${diagramId.replace(/^diagram-/, '')}`;
  const { rows } = await pool.query(
    `INSERT INTO core.diagrams (id, name, owner_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [diagramId, diagramName, normalizeUserId(ownerId)]
  );
  return rows[0];
}

async function renameDiagram(diagramId, name) {
  const id = safeId(diagramId);
  const diagramName = String(name || '').trim();
  if (!id || !diagramName) return null;
  const { rows } = await pool.query(
    `UPDATE core.diagrams
     SET name = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, diagramName]
  );
  return rows[0] || null;
}

async function touchDiagram(diagramId) {
  const id = safeId(diagramId);
  if (!id) return;
  await pool.query('UPDATE core.diagrams SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

async function deleteDiagram(diagramId) {
  const id = safeId(diagramId);
  if (!id) return false;
  return withTransaction(async (client) => {
    // auth.diagram_acl no tiene FK a core.diagrams en el esquema entregado.
    await client.query('DELETE FROM auth.diagram_acl WHERE diagram_id = $1', [id]);
    const result = await client.query('DELETE FROM core.diagrams WHERE id = $1', [id]);
    return result.rowCount > 0;
  });
}

async function getSnapshot(diagramId) {
  const id = safeId(diagramId);
  if (!id) return null;
  const { rows } = await pool.query('SELECT yjs_snapshot FROM core.diagrams WHERE id = $1', [id]);
  return rows[0]?.yjs_snapshot || null;
}

async function saveSnapshot(diagramId, update) {
  const id = safeId(diagramId);
  if (!id || !update) return;
  await pool.query(
    `UPDATE core.diagrams
     SET yjs_snapshot = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, Buffer.from(update)]
  );
}

module.exports = {
  safeId,
  listVisibleForUser,
  getDiagram,
  createDiagram,
  createDiagramWithOwner,
  createDiagramWithOwnerIfAbsent,
  ensureDiagram,
  upsertDiagram,
  renameDiagram,
  touchDiagram,
  deleteDiagram,
  getSnapshot,
  saveSnapshot,
};
