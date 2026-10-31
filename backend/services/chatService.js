// Historial del chat por diagrama en PostgreSQL (schema chat).
const { pool } = require('../db');
const { safeId } = require('./diagramService');
const { httpError } = require('../errors');

const VALID_ROLES = new Set(['user', 'assistant', 'system']);

function toWireMessage(row) {
  const sender = row.role === 'assistant' ? 'ia' : row.role === 'system' ? 'system' : 'user';
  const createdAt = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: `db_${row.id}`,
    sender,
    author: row.author,
    text: row.text,
    timestamp: Number.isNaN(createdAt.getTime()) ? Date.now() : createdAt.getTime(),
  };
}

async function addMessage({ diagramId, author, role, content }) {
  const id = safeId(diagramId);
  if (!id) throw httpError(400, 'diagramId inválido');
  if (!VALID_ROLES.has(role)) throw httpError(400, 'Rol de mensaje inválido');
  const text = String(content || '').trim();
  if (!text) return null;
  const messageAuthor = String(author || 'Sistema').trim().slice(0, 50) || 'Sistema';

  const { rows } = await pool.query(
    `INSERT INTO chat.messages (diagram_id, author, role, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, diagram_id, author, role, content, created_at`,
    [id, messageAuthor, role, text]
  );
  return rows[0];
}

// Últimos N mensajes en orden cronológico (más antiguo primero), listos para
// inyectarlos en el prompt. La subconsulta obtiene los recientes y el ORDER
// exterior restaura la lectura natural del historial.
async function getRecentMessages(diagramId, limit = 15) {
  const id = safeId(diagramId);
  if (!id) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 15, 100));
  const { rows } = await pool.query(
    `SELECT id, author, content AS text, role, created_at
     FROM (
       SELECT id, author, content, role, created_at
       FROM chat.messages
       WHERE diagram_id = $1
       ORDER BY created_at DESC
       LIMIT $2
     ) recent
     ORDER BY created_at ASC`,
    [id, safeLimit]
  );
  return rows;
}

module.exports = { addMessage, getRecentMessages, toWireMessage };
