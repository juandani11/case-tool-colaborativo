// Migración única: backend/data/*.json -> PostgreSQL (auth/core/chat).
// No borra los JSON originales. Es idempotente: si un diagrama ya existe,
// no se sobrescribe su snapshot actual.
require('../loadEnv');
const fs = require('fs');
const path = require('path');
const Y = require('yjs');
const {
  pool,
  withTransaction,
  initializeDatabase,
  normalizeUserId,
  ANONYMOUS_USER_ID,
} = require('../db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DIAGRAMS_DIR = path.join(DATA_DIR, 'diagrams');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function yMapFromObject(value) {
  const map = new Y.Map();
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) map.set(key, item);
    }
  }
  return map;
}

function nodeToY(node) {
  const nodeMap = new Y.Map();
  nodeMap.set('id', node.id);
  nodeMap.set('type', node.type || 'entity');

  const position = new Y.Map();
  position.set('x', Number(node.position?.x) || 0);
  position.set('y', Number(node.position?.y) || 0);
  nodeMap.set('position', position);

  const data = new Y.Map();
  data.set('label', node.data?.label || '');
  data.set('stereotype', node.data?.stereotype || 'class');
  if (node.data?.isAssociationClass !== undefined) {
    data.set('isAssociationClass', node.data.isAssociationClass);
  }
  if (node.data?.associationOf && typeof node.data.associationOf === 'object') {
    data.set('associationOf', yMapFromObject(node.data.associationOf));
  }

  const attributes = new Y.Array();
  for (const attr of node.data?.attributes || []) {
    attributes.push([yMapFromObject(attr)]);
  }
  data.set('attributes', attributes);

  const methods = new Y.Array();
  for (const method of node.data?.methods || []) {
    const methodMap = new Y.Map();
    for (const [key, value] of Object.entries(method || {})) {
      if (key !== 'parameters') methodMap.set(key, value);
    }
    const parameters = new Y.Array();
    for (const param of method?.parameters || []) {
      parameters.push([yMapFromObject(param)]);
    }
    methodMap.set('parameters', parameters);
    methods.push([methodMap]);
  }
  data.set('methods', methods);

  nodeMap.set('data', data);
  return nodeMap;
}

function edgeToY(edge) {
  const edgeMap = new Y.Map();
  edgeMap.set('id', edge.id);
  edgeMap.set('source', edge.source);
  edgeMap.set('target', edge.target);
  edgeMap.set('type', edge.type);
  if (edge.data) edgeMap.set('data', yMapFromObject(edge.data));
  return edgeMap;
}

function buildSnapshot(diagram) {
  const doc = new Y.Doc();
  const nodes = doc.getMap('nodes');
  const edges = doc.getMap('edges');
  const chat = doc.getArray('chat');

  Y.transact(doc, () => {
    for (const node of diagram.nodes || []) {
      if (node?.id) nodes.set(node.id, nodeToY(node));
    }
    for (const edge of diagram.edges || []) {
      if (edge?.id) edges.set(edge.id, edgeToY(edge));
    }
    for (const message of diagram.chat || []) {
      if (!message || typeof message !== 'object') continue;
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      if (!text) continue;
      chat.push([{
        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sender: message.sender === 'ia' ? 'ia' : message.sender === 'system' ? 'system' : 'user',
        author: typeof message.author === 'string' ? message.author : undefined,
        text,
        timestamp: Number(message.timestamp) || Date.now(),
      }]);
    }
  });

  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return update;
}

function validDateOrNow(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

async function migrate() {
  await initializeDatabase();

  const users = readJson(path.join(DATA_DIR, 'users.json'), []);
  const knownUserIds = new Set([ANONYMOUS_USER_ID]);

  for (const user of Array.isArray(users) ? users : []) {
    if (!user?.id || !user?.username || !user?.email || !user?.passwordHash) continue;
    await pool.query(
      `INSERT INTO auth.users (id, username, email, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        user.id,
        user.username,
        user.email,
        user.passwordHash,
        validDateOrNow(user.createdAt),
      ]
    );
    knownUserIds.add(user.id);
  }
  console.log(`Usuarios procesados: ${knownUserIds.size - 1}`);

  if (!fs.existsSync(DIAGRAMS_DIR)) return;

  const files = fs.readdirSync(DIAGRAMS_DIR)
    .filter(name => name.endsWith('.json') && !name.endsWith('.acl.json'));

  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const diagramId = file.replace(/\.json$/, '');
    const diagram = readJson(path.join(DIAGRAMS_DIR, file), null);
    if (!diagram) continue;

    const acl = readJson(path.join(DIAGRAMS_DIR, `${diagramId}.acl.json`), null);
    const rawOwner = acl?.ownerId || 'anonymous';
    const ownerId = knownUserIds.has(rawOwner) ? normalizeUserId(rawOwner) : ANONYMOUS_USER_ID;
    const createdAt = validDateOrNow(acl?.createdAt);
    const updatedAt = validDateOrNow(acl?.updatedAt, createdAt);
    const snapshot = buildSnapshot(diagram);

    const inserted = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO core.diagrams (id, name, owner_id, yjs_snapshot, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          diagramId,
          diagram.name || `Diagrama ${diagramId.replace(/^diagram-/, '')}`,
          ownerId,
          Buffer.from(snapshot),
          createdAt,
          updatedAt,
        ]
      );
      if (result.rowCount === 0) return false;

      await client.query(
        `INSERT INTO auth.diagram_acl (diagram_id, user_id, role, granted_at)
         VALUES ($1, $2, 'OWNER', $3)
         ON CONFLICT (diagram_id, user_id) DO NOTHING`,
        [diagramId, ownerId, createdAt]
      );

      for (const member of acl?.members || []) {
        if (!knownUserIds.has(member?.userId)) continue;
        if (member.role !== 'EDITOR' && member.role !== 'VIEWER') continue;
        await client.query(
          `INSERT INTO auth.diagram_acl (diagram_id, user_id, role, granted_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (diagram_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [diagramId, normalizeUserId(member.userId), member.role, validDateOrNow(member.addedAt, createdAt)]
        );
      }

      for (const message of diagram.chat || []) {
        const text = typeof message?.text === 'string' ? message.text.trim() : '';
        if (!text) continue;
        const role = message.sender === 'ia' ? 'assistant' : message.sender === 'system' ? 'system' : 'user';
        await client.query(
          `INSERT INTO chat.messages (diagram_id, author, role, content, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            diagramId,
            String(message.author || (role === 'assistant' ? 'IA' : 'Sistema')).slice(0, 50),
            role,
            text,
            validDateOrNow(message.timestamp ? new Date(message.timestamp) : null, createdAt),
          ]
        );
      }

      return true;
    });

    if (inserted) {
      migrated += 1;
      console.log(`Migrado: ${diagramId} (${diagram.name || 'sin nombre'})`);
    } else {
      skipped += 1;
      console.log(`Omitido (ya existía): ${diagramId}`);
    }
  }

  console.log(`Diagramas migrados: ${migrated}; omitidos: ${skipped}`);
}

migrate()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error('Error migrando JSON a PostgreSQL:', err);
    try { await pool.end(); } catch {}
    process.exitCode = 1;
  });
