// Test Presencia colaborativa con username real.
// Uso: node backend/tests/presence.test.js
//  1. Puro: lib/presence.ts REAL (transpilado): color determinista,
//     identidad auth/anónima.
//  2. Vivo: 2 WebsocketProvider REALES contra server.js REAL (auth on):
//     A y B se ven por username; al salir B, A lo deja de ver (<8s).
//  3. Cuatro clientes distintos se ven entre sí.
//  4. Modo sin auth: 2 clientes anónimos se ven como 'Anónimo'.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const PORT = 23461;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DIAGRAMS_DIR = path.join(DATA_DIR, 'diagrams');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function loadPresenceLib() {
  const ts = require(path.join(FRONTEND_DIR, 'node_modules', 'typescript'));
  const src = fs.readFileSync(
    path.join(FRONTEND_DIR, 'src', 'lib', 'presence.ts'),
    'utf8'
  );
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const tmp = path.join(__dirname, '.tmp-presence-lib.js');
  fs.writeFileSync(tmp, js);
  try {
    return require(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
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

// Cliente Yjs real (simula una pestaña del editor con su identidad).
function connectClient(room, identity, token) {
  const Y = require('yjs');
  const { WebsocketProvider } = require('y-websocket');
  const WS = require('ws');
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(
    `ws://localhost:${PORT}`,
    room,
    doc,
    { params: token ? { token } : {}, WebSocketPolyfill: WS }
  );
  provider.awareness.setLocalStateField('user', identity);
  return { doc, provider };
}

function visibleUsers(provider) {
  const out = [];
  provider.awareness.getStates().forEach((state) => {
    if (state.user && state.user.name) out.push(state.user);
  });
  return out;
}

async function waitFor(label, fn, timeoutMs = 8000) {
  const start = Date.now();
  for (;;) {
    const got = fn();
    if (got) return { ok: true, ms: Date.now() - start };
    if (Date.now() - start > timeoutMs) return { ok: false, ms: Date.now() - start };
    await sleep(200);
  }
}

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  // ── 1. Puro: identidad y color ──
  const presence = loadPresenceLib();
  {
    const c1 = presence.generateUserColor('user-abc');
    const c2 = presence.generateUserColor('user-abc');
    check(c1 === c2, `Test 3: mismo seed -> mismo color (${c1})`);
    const palette = new Set([
      presence.generateUserColor('a'),
      presence.generateUserColor('b'),
      presence.generateUserColor('c'),
      presence.generateUserColor('d'),
    ]);
    check(palette.size > 1, 'Test 5: seeds distintos reparten colores');
    const id = presence.resolvePresenceIdentity({ id: 'u1', username: 'ana' });
    check(id.name === 'ana' && id.id === 'u1' && id.color === presence.generateUserColor('u1'), 'Test 1(puro): identidad auth con username real');
    const anon = presence.resolvePresenceIdentity(null);
    check(anon.name === 'Anónimo', 'Test 4(puro): sin sesión -> Anónimo');
  }

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
    // ── 2. Vivo con auth: A y B se ven por username ──
    {
      if (fs.existsSync(USERS_FILE)) fs.rmSync(USERS_FILE);
      const srv = await startServer(true);
      const clients = [];
      try {
        const a = await register('presA', 'pa@t.co', '123456');
        const b = await register('presB', 'pb@t.co', '123456');
        const id = 'test-presence-d1';
        track(id);
        await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'P', nodes: [], edges: [], chat: [] }),
        });
        await fetch(`${BASE}/api/diagrams/${id}/members`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'presB', role: 'EDITOR' }),
        });

        const room = `diagram-room-${id}`;
        const idA = presence.resolvePresenceIdentity({ id: a.user.id, username: a.user.username });
        const idB = presence.resolvePresenceIdentity({ id: b.user.id, username: b.user.username });
        const cA = connectClient(room, idA, a.token);
        const cB = connectClient(room, idB, b.token);
        clients.push(cA, cB);

        const both = await waitFor('both', () => {
          const namesA = visibleUsers(cA.provider).map(u => u.name).sort().join(',');
          const namesB = visibleUsers(cB.provider).map(u => u.name).join(',');
          return namesA.includes('presA') && namesA.includes('presB') &&
            namesB.includes('presA') && namesB.includes('presB');
        });
        check(both.ok, `Test 1: A y B se ven por username (${both.ms}ms)`);

        // Test 2: B sale -> A lo deja de ver
        cB.provider.disconnect();
        try { cB.doc.destroy(); } catch {}
        const gone = await waitFor('gone', () =>
          !visibleUsers(cA.provider).some(u => u.name === 'presB')
        );
        check(gone.ok, `Test 2: avatar de B desaparece en A (${gone.ms}ms)`);
        clients.splice(clients.indexOf(cB), 1);

        // Test 5: 4 clientes distintos se ven entre sí
        const c = await register('presC', 'pc@t.co', '123456');
        const d = await register('presD', 'pd@t.co', '123456');
        for (const u of [c, d]) {
          await fetch(`${BASE}/api/diagrams/${id}/members`, {
            method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u.user.username, role: 'VIEWER' }),
          });
        }
        const mk = (u, token) => {
          const cc = connectClient(
            room,
            presence.resolvePresenceIdentity({ id: u.user.id, username: u.user.username }),
            token
          );
          clients.push(cc);
          return cc;
        };
        const cC = mk(c, c.token);
        const cD = mk(d, d.token);
        const four = await waitFor(
          'four',
          () => ['presA', 'presC', 'presD'].every(n => visibleUsers(cA.provider).some(u => u.name === n)) &&
            visibleUsers(cA.provider).length >= 4
        );
        check(four.ok, `Test 5: 4 avatares visibles (${four.ms}ms)`);
        void cC;
        void cD;
      } finally {
        for (const c of clients) {
          try { c.provider.disconnect(); } catch {}
          try { c.doc.destroy(); } catch {}
        }
        await stopServer(srv);
      }
    }

    // ── 4. Vivo sin auth: anónimos ──
    {
      const srv = await startServer(false);
      const clients = [];
      try {
        const room = 'diagram-room-anon-test';
        const mkAnon = () => {
          const cc = connectClient(room, { id: `anon-${Math.random()}`, name: 'Anónimo', color: '#3b82f6' }, null);
          clients.push(cc);
          return cc;
        };
        const c1 = mkAnon();
        const c2 = mkAnon();
        const r = await waitFor(
          'anon',
          () => visibleUsers(c1.provider).filter(u => u.name === 'Anónimo').length === 2 &&
            visibleUsers(c2.provider).filter(u => u.name === 'Anónimo').length === 2
        );
        check(r.ok, `Test 4: 2 pestañas anónimas se ven como 'Anónimo' (${r.ms}ms)`);
      } finally {
        for (const c of clients) {
          try { c.provider.disconnect(); } catch {}
          try { c.doc.destroy(); } catch {}
        }
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
  console.log('\nPRESENCE TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
