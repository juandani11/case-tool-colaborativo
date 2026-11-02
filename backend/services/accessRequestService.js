'use strict';

const { pool, withTransaction, isValidUuid, normalizeUserId } = require('../db');
const { httpError } = require('../errors');
const aclService = require('./aclService');

const ALLOWED_ACTIONS = new Set(['APPROVE', 'REJECT']);
const ALLOWED_ROLES = new Set(['EDITOR', 'VIEWER']);
const DIAGRAM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function toRequest(row) {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : row.created_at;
  return {
    id: row.id,
    diagramId: row.diagram_id,
    diagramName: row.diagram_name,
    requesterId: row.requester_id,
    requesterUsername: row.requester_username,
    requesterEmail: row.requester_email,
    status: row.status,
    createdAt,
  };
}

async function createRequest(diagramId, requesterId) {
  const id = String(diagramId || '').trim();
  if (!DIAGRAM_ID_RE.test(id)) throw httpError(400, 'ID de diagrama inválido');
  const requester = normalizeUserId(requesterId);

  const diagram = await pool.query(
    'SELECT id, owner_id FROM core.diagrams WHERE id = $1 LIMIT 1',
    [id]
  );
  if (!diagram.rowCount) throw httpError(404, 'Diagrama no encontrado');
  if (diagram.rows[0].owner_id === requester) {
    throw httpError(409, 'Ya eres el propietario de este diagrama');
  }

  const role = await aclService.getRoleForUser(id, requester);
  if (role !== 'NONE') {
    throw httpError(409, 'Ya tienes acceso a este diagrama');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO auth.access_requests (diagram_id, requester_id, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING id, diagram_id, requester_id, status, created_at`,
      [id, requester]
    );
    return {
      id: rows[0].id,
      diagramId: rows[0].diagram_id,
      requesterId: rows[0].requester_id,
      status: rows[0].status,
      createdAt: rows[0].created_at instanceof Date
        ? rows[0].created_at.toISOString()
        : rows[0].created_at,
    };
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'Ya existe una solicitud pendiente para este diagrama');
    }
    throw err;
  }
}

async function listPendingForOwner(ownerId) {
  const owner = normalizeUserId(ownerId);
  const { rows } = await pool.query(
    `SELECT ar.id, ar.diagram_id, d.name AS diagram_name,
            ar.requester_id, u.username AS requester_username, u.email AS requester_email,
            ar.status, ar.created_at
     FROM auth.access_requests ar
     JOIN core.diagrams d ON d.id = ar.diagram_id
     JOIN auth.users u ON u.id = ar.requester_id
     WHERE ar.status = 'PENDING' AND d.owner_id = $1
     ORDER BY ar.created_at ASC`,
    [owner]
  );
  return rows.map(toRequest);
}

async function respondToRequest({ requestId, ownerId, action, role = 'VIEWER' }) {
  if (!isValidUuid(requestId)) throw httpError(400, 'ID de solicitud inválido');
  if (!ALLOWED_ACTIONS.has(action)) {
    throw httpError(400, 'Acción inválida (debe ser APPROVE o REJECT)');
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw httpError(400, 'Rol inválido (debe ser EDITOR o VIEWER)');
  }
  const owner = normalizeUserId(ownerId);

  return withTransaction(async (client) => {
    const requestResult = await client.query(
      `SELECT id, diagram_id, requester_id, status
       FROM auth.access_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    if (!requestResult.rowCount) throw httpError(404, 'Solicitud no encontrada');

    const request = requestResult.rows[0];
    if (request.status !== 'PENDING') {
      throw httpError(409, 'La solicitud ya fue respondida');
    }

    const diagramResult = await client.query(
      'SELECT owner_id FROM core.diagrams WHERE id = $1',
      [request.diagram_id]
    );
    if (!diagramResult.rowCount) throw httpError(404, 'Diagrama no encontrado');
    if (diagramResult.rows[0].owner_id !== owner) {
      throw httpError(403, 'Solo el propietario puede responder esta solicitud');
    }

    if (action === 'APPROVE') {
      await client.query(
        `INSERT INTO auth.diagram_acl (diagram_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (diagram_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [request.diagram_id, request.requester_id, role]
      );
      await client.query(
        `UPDATE auth.access_requests
         SET status = 'APPROVED'
         WHERE id = $1`,
        [requestId]
      );
    } else {
      await client.query(
        `UPDATE auth.access_requests
         SET status = 'REJECTED'
         WHERE id = $1`,
        [requestId]
      );
    }

    return {
      id: request.id,
      diagramId: request.diagram_id,
      requesterId: request.requester_id,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      role: action === 'APPROVE' ? role : null,
    };
  });
}

module.exports = {
  createRequest,
  listPendingForOwner,
  respondToRequest,
};
