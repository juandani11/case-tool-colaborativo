// CRUD de usuarios persistido en PostgreSQL (schema auth).
// Los passwords NUNCA se guardan en claro: solo password_hash (bcrypt).
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { httpError } = require('../errors');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

// Quita el hash antes de responder: el passwordHash JAMÁS sale del backend.
function safe(user) {
  if (!user) return null;
  const { passwordHash: _, ...userSafe } = user;
  return userSafe;
}

async function findByUsername(username) {
  const q = String(username || '').trim();
  if (!q) return null;
  const { rows } = await pool.query(
    'SELECT id, username, email, password_hash, created_at FROM auth.users WHERE lower(username) = lower($1) LIMIT 1',
    [q]
  );
  return mapUser(rows[0]);
}

async function findByEmail(email) {
  const q = String(email || '').trim().toLowerCase();
  if (!q) return null;
  const { rows } = await pool.query(
    'SELECT id, username, email, password_hash, created_at FROM auth.users WHERE lower(email) = lower($1) LIMIT 1',
    [q]
  );
  return mapUser(rows[0]);
}

async function findById(id) {
  const q = String(id || '').trim();
  if (!q) return null;
  const { rows } = await pool.query(
    'SELECT id, username, email, password_hash, created_at FROM auth.users WHERE id = $1 LIMIT 1',
    [q]
  );
  return mapUser(rows[0]);
}

async function createUser({ username, email, password }) {
  const name = String(username || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  if (!name || name.length < 3) throw httpError(400, 'Username muy corto (mínimo 3 caracteres)');
  if (!mail || !mail.includes('@')) throw httpError(400, 'Email inválido');
  if (!password || String(password).length < 6) throw httpError(400, 'Password muy corta (mínimo 6 caracteres)');

  if (await findByUsername(name)) throw httpError(400, 'Username ya existe');
  if (await findByEmail(mail)) throw httpError(400, 'Email ya existe');

  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO auth.users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [name, mail, passwordHash]
    );
    return safe(mapUser(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(400, err.detail?.includes('email') ? 'Email ya existe' : 'Username ya existe');
    }
    throw err;
  }
}

async function verifyPassword(username, password) {
  const user = await findByUsername(username);
  if (!user || !password) return null;
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return null;
  return safe(user);
}

module.exports = {
  createUser,
  findByUsername,
  findByEmail,
  findById,
  verifyPassword,
};
