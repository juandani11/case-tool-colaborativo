// Pool de PostgreSQL (Neon). Toda la persistencia del backend pasa por aquí.
const { Pool } = require('pg');

const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function isValidUserId(userId) {
  return isValidUuid(userId);
}

function normalizeUserId(userId) {
  const value = String(userId || '').trim();
  return UUID_RE.test(value) ? value : ANONYMOUS_USER_ID;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL no está configurada: el backend no podrá persistir datos.');
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Neon exige TLS. El connection string ya incluye sslmode=require.
  ssl: connectionString && connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// Usuario técnico para el modo AUTH_ENABLED=false. Permite que las ACL y los
// owners sigan siendo UUID válidos sin inventar usuarios anónimos por request.
async function ensureAnonymousUser() {
  await pool.query(
    `INSERT INTO auth.users (id, username, email, password_hash)
     VALUES ($1, 'anonymous', 'anonymous@local.invalid', '!')
     ON CONFLICT (username) DO NOTHING`,
    [ANONYMOUS_USER_ID]
  );
}

async function initializeDatabase() {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada');
  }
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  await ensureAnonymousUser();
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  withTransaction,
  initializeDatabase,
  isValidUuid,
  isValidUserId,
  normalizeUserId,
  ANONYMOUS_USER_ID,
};
