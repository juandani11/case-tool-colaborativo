// Test Dashboard: GET /api/diagrams ({owned,shared}) + POST /api/diagrams.
// Uso: node backend/tests/dashboard.test.js
//  Test 1 (flag off): todo en owned, POST crea + ACL anonymous.
//  Test 2 (flag on): A crea (OWNER) -> B no ve -> invitado VIEWER ->
//    B ve en shared con ownerUsername, rol y conteos; POST sin name;
//    legacy excluido hasta migrar; .acl.json jamás listados.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const PORT = 23460;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DIAGRAMS_DIR = path.join(DATA_DIR, 'diagrams');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function startServer(authEnabled) {
  const secret = require('crypto').randomBytes(32).toString('hex');
  const child = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), AUTH_ENABLED: authEnabled ? 'true' : 'false', JWT_SECRET: secret, JWT_EXPIRATION: '7d' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return child;
    } catch {}
    await sleep(200);
  }
  child.kill();
  throw new Error('el servidor no arrancó');
}

function stopServer(child) {
  return new Promise(resolve => {
    child.on('exit', () => resolve());
    child.kill();
    setTimeout(resolve, 2000);
  });
}

async function register(username, email, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw new Error(`register ${username}: ${res.status}`);
  return res.json();
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  const backupUsers = fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf8') : null;
  const created = [];
  const track = (id) => created.push(id);

  function cleanup() {
    for (const id of created) {
      const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
      for (const f of [`${safe}.json`, `${safe}.acl.json`]) {
        try { fs.rmSync(path.join(DIAGRAMS_DIR, f), { force: true }); } catch {}
      }
    }
    if (backupUsers !== null) {
      fs.writeFileSync(USERS_FILE, backupUsers);
    } else if (fs.existsSync(USERS_FILE)) {
      fs.rmSync(USERS_FILE);
    }
  }

  try {
    // ── Test 1: flag off ──
    {
      const srv = await startServer(false);
      try {
        const list = await fetch(`${BASE}/api/diagrams`).then(r => r.json());
        check(Array.isArray(list.owned) && Array.isArray(list.shared), 'T1: forma {owned, shared}');
        check(list.shared.length === 0, 'T1: shared vacío sin auth');
        const before = list.owned.length;
        const created1 = await fetch(`${BASE}/api/diagrams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Dash T1' }),
        });
        check(created1.status === 201, `T1: POST crea -> 201 (fue ${created1.status})`);
        const { id, name } = await created1.json();
        track(id);
        check(typeof id === 'string' && name === 'Dash T1', 'T1: devuelve {id, name}');
        const aclRaw = JSON.parse(fs.readFileSync(path.join(DIAGRAMS_DIR, `${id}.acl.json`), 'utf8'));
        check(aclRaw.ownerId === 'anonymous', 'T1: ACL anonymous sin auth');
        const list2 = await fetch(`${BASE}/api/diagrams`).then(r => r.json());
        check(list2.owned.length === before + 1, 'T1: el nuevo aparece en owned');
        check(!list2.owned.concat(list2.shared).some(d => d.id.endsWith('.acl')), 'T1: .acl.json jamás listados');
      } finally {
        await stopServer(srv);
      }
    }

    // ── Test 2: flag on ──
    {
      if (fs.existsSync(USERS_FILE)) fs.rmSync(USERS_FILE);
      const srv = await startServer(true);
      try {
        const a = await register('dashA', 'da@t.co', '123456');
        const b = await register('dashB', 'db@t.co', '123456');

        // Sin token -> 401 (también el POST)
        const noAuth = await fetch(`${BASE}/api/diagrams`);
        check(noAuth.status === 401, 'T2: GET sin token -> 401');
        const noAuthPost = await fetch(`${BASE}/api/diagrams`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'X' }),
        });
        check(noAuthPost.status === 401, 'T2: POST sin token -> 401');

        // A crea con nodos para verificar conteos
        const c1 = await fetch(`${BASE}/api/diagrams`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Proyecto A' }),
        });
        check(c1.status === 201, 'T2: A crea -> 201');
        const { id: idA } = await c1.json();
        track(idA);
        await fetch(`${BASE}/api/diagrams/${idA}`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Proyecto A', nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ id: 'e1' }], chat: [] }),
        });
        const aclA = JSON.parse(fs.readFileSync(path.join(DIAGRAMS_DIR, `${idA}.acl.json`), 'utf8'));
        check(aclA.ownerId === a.user.id, 'T2: creador queda OWNER');

        // POST sin name -> default
        const c2 = await fetch(`${BASE}/api/diagrams`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const { id: idB2, name: nameB2 } = await c2.json();
        track(idB2);
        check(c2.status === 201 && !!nameB2, 'T2: POST sin name usa default');

        // Listas: A ve 2 en owned; B no ve nada
        const listA = await fetch(`${BASE}/api/diagrams`, { headers: auth(a.token) }).then(r => r.json());
        check(listA.owned.length >= 2 && listA.shared.length === 0, `T2: A ve owned>=2, shared=0 (fue ${listA.owned.length}/${listA.shared.length})`);
        const cardA = listA.owned.find(d => d.id === idA);
        check(
          cardA && cardA.role === 'OWNER' && cardA.entityCount === 2 && cardA.relationshipCount === 1 && typeof cardA.updatedAt === 'number',
          `T2: card con rol+conteos+updatedAt (${JSON.stringify(cardA)})`
        );
        const listB = await fetch(`${BASE}/api/diagrams`, { headers: auth(b.token) }).then(r => r.json());
        check(listB.owned.length === 0 && listB.shared.length === 0, 'T2: B no ve nada ajeno');

        // A comparte como VIEWER -> B lo ve en shared con ownerUsername
        await fetch(`${BASE}/api/diagrams/${idA}/members`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'dashB', role: 'VIEWER' }),
        });
        const listB2 = await fetch(`${BASE}/api/diagrams`, { headers: auth(b.token) }).then(r => r.json());
        const sharedCard = listB2.shared.find(d => d.id === idA);
        check(
          !!sharedCard && sharedCard.role === 'VIEWER' && sharedCard.ownerUsername === 'dashA',
          `T2: B ve shared con rol+owner (${JSON.stringify(sharedCard)})`
        );

        // Legacy: archivo sin ACL excluido hasta migrar
        const legacyId = 'dash-legacy-x';
        track(legacyId);
        fs.writeFileSync(
          path.join(DIAGRAMS_DIR, `${legacyId}.json`),
          JSON.stringify({ name: 'Legacy', nodes: [{ id: 'n' }], edges: [] })
        );
        const listA2 = await fetch(`${BASE}/api/diagrams`, { headers: auth(a.token) }).then(r => r.json());
        check(![...listA2.owned, ...listA2.shared].some(d => d.id === legacyId), 'T2: legacy excluido antes de migrar');
        await fetch(`${BASE}/api/diagrams/${legacyId}`, { headers: auth(a.token) });
        const listA3 = await fetch(`${BASE}/api/diagrams`, { headers: auth(a.token) }).then(r => r.json());
        const mig = listA3.owned.find(d => d.id === legacyId);
        check(!!mig && mig.role === 'OWNER', 'T2: tras abrir, legacy migra a Mis diagramas');
      } finally {
        await stopServer(srv);
      }
    }
  } finally {
    cleanup();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nDASHBOARD TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
