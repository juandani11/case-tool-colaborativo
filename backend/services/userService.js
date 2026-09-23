// CRUD de usuarios persistido en backend/data/users.json (Fase 1: JWT).
// Los passwords NUNCA se guardan en claro: solo passwordHash (bcrypt).
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

async function ensureFile() {
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.writeFile(USERS_FILE, '[]', 'utf-8');
  }
}

async function readUsers() {
  await ensureFile();
  const content = await fs.readFile(USERS_FILE, 'utf-8');
  const parsed = JSON.parse(content || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

async function writeUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function safe(user) {
  if (!user) return null;
  const { passwordHash: _, ...userSafe } = user;
  return userSafe;
}

async function findByUsername(username) {
  const users = await readUsers();
  const q = String(username || '').toLowerCase();
  return users.find(u => String(u.username).toLowerCase() === q) || null;
}

async function findByEmail(email) {
  const users = await readUsers();
  const q = String(email || '').toLowerCase();
  return users.find(u => String(u.email).toLowerCase() === q) || null;
}

async function findById(id) {
  const users = await readUsers();
  return users.find(u => u.id === id) || null;
}

async function createUser({ username, email, password }) {
  const name = String(username || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  if (!name || name.length < 3) throw new Error('Username muy corto (mínimo 3 caracteres)');
  if (!mail || !mail.includes('@')) throw new Error('Email inválido');
  if (!password || String(password).length < 6) throw new Error('Password muy corta (mínimo 6 caracteres)');

  if (await findByUsername(name)) throw new Error('Username ya existe');
  if (await findByEmail(mail)) throw new Error('Email ya existe');

  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = {
    id: randomUUID(),
    username: name,
    email: mail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const users = await readUsers();
  users.push(user);
  await writeUsers(users);

  return safe(user);
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
