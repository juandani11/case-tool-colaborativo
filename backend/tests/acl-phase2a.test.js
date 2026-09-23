// Test Fase 2A: ACLs por diagrama (roles y control de acceso).
// Uso: node backend/tests/acl-phase2a.test.js
// Levanta server.js REAL en puerto de prueba. Cubre:
//  Test E: AUTH_ENABLED=false -> todo abierto, ACLs con owner anonymous.
//  Test F: flujo completo A(owner)/B con invitaciones, roles, 403s.
//  Test G: WebSocket (4401 sin token, 4403 sin acceso, OK con rol).
//  Test H: diagrama legacy sin ACL -> se migra al abrir (opener = OWNER).
// Restaura users.json y limpia diagramas/acls de prueba al terminar.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const PORT = 23459;
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

function wsConnect(room, token) {
  const WS = require('ws');
  const url = `ws://localhost:${PORT}/${room}${token ? `?token=${token}` : ''}`;
  return new Promise(resolve => {
    const ws = new WS(url);
    const done = (result) => {
      try { ws.terminate(); } catch {}
      resolve(result);
    };
    ws.on('open', () => setTimeout(() => done({ open: true }), 600));
    ws.on('close', (code) => done({ open: false, code }));
    ws.on('error', () => {});
    setTimeout(() => done({ open: 'timeout' }), 5000);
  });
}

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  const backupUsers = fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf8') : null;
  const createdDiagrams = [];
  const track = (id) => createdDiagrams.push(id);

  // Limpieza de artefactos de prueba (diagramas + ACLs)
  function cleanup() {
    for (const id of createdDiagrams) {
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
    // ── Test E: flag off -> todo abierto, ACL anonymous ──
    {
      const srv = await startServer(false);
      try {
        const id = 'test-e-diagram';
        track(id);
        const create = await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'E', nodes: [], edges: [], chat: [] }),
        });
        check(create.ok, 'E: crear diagrama sin login -> 200');
        const aclRaw = JSON.parse(fs.readFileSync(path.join(DIAGRAMS_DIR, `${id}.acl.json`), 'utf8'));
        check(aclRaw.ownerId === 'anonymous', 'E: .acl.json creado con owner anonymous');
        const role = await fetch(`${BASE}/api/diagrams/${id}/role`).then(r => r.json());
        check(role.role === 'OWNER', 'E: /role devuelve OWNER (acceso total)');
      } finally {
        await stopServer(srv);
      }
    }

    // ── Test F: flujo A/B ──
    {
      if (fs.existsSync(USERS_FILE)) fs.rmSync(USERS_FILE);
      const srv = await startServer(true);
      try {
        const a = await register('aclA', 'a@t.co', '123456');
        const b = await register('aclB', 'b@t.co', '123456');
        const id = 'test-f-diagram';
        track(id);

        // A crea -> OWNER
        const create = await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'F', nodes: [], edges: [], chat: [] }),
        });
        check(create.ok, 'F: A crea diagrama -> 200');
        const aclRaw = JSON.parse(fs.readFileSync(path.join(DIAGRAMS_DIR, `${id}.acl.json`), 'utf8'));
        check(aclRaw.ownerId === a.user.id, 'F: .acl.json con A como OWNER');

        // B sin acceso
        const bGet = await fetch(`${BASE}/api/diagrams/${id}`, { headers: auth(b.token) });
        check(bGet.status === 403, `F: B abre sin ser miembro -> 403 (fue ${bGet.status})`);
        const bRole = await fetch(`${BASE}/api/diagrams/${id}/role`, { headers: auth(b.token) });
        check(bRole.status === 403, 'F: B consulta rol -> 403');

        // A invita a B como EDITOR
        const inv = await fetch(`${BASE}/api/diagrams/${id}/members`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'aclB', role: 'EDITOR' }),
        });
        check(inv.status === 201, `F: A invita a B EDITOR -> 201 (fue ${inv.status})`);
        const bGet2 = await fetch(`${BASE}/api/diagrams/${id}`, { headers: auth(b.token) });
        check(bGet2.ok, 'F: B abre como EDITOR -> 200');
        const bRole2 = await fetch(`${BASE}/api/diagrams/${id}/role`, { headers: auth(b.token) }).then(r => r.json());
        check(bRole2.role === 'EDITOR', 'F: rol de B es EDITOR');

        // B edita (PUT rename + POST save) pero no borra
        const bRename = await fetch(`${BASE}/api/diagrams/${id}/rename`, {
          method: 'PUT', headers: { ...auth(b.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'F-renamed' }),
        });
        check(bRename.ok, 'F: B renombra (EDITOR) -> 200');
        const bSave = await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'POST', headers: { ...auth(b.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'F-renamed', nodes: [], edges: [], chat: [] }),
        });
        check(bSave.ok, 'F: B guarda (EDITOR) -> 200');
        const bDel = await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'DELETE', headers: auth(b.token),
        });
        check(bDel.status === 403, `F: B borra (EDITOR, solo OWNER) -> 403 (fue ${bDel.status})`);

        // A degrada a B a VIEWER
        const deg = await fetch(`${BASE}/api/diagrams/${id}/members/${b.user.id}`, {
          method: 'PATCH', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'VIEWER' }),
        });
        check(deg.ok, 'F: A degrada a B a VIEWER -> 200');
        const bSaveV = await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'POST', headers: { ...auth(b.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'F-x', nodes: [], edges: [], chat: [] }),
        });
        check(bSaveV.status === 403, `F: B guarda (VIEWER) -> 403 (fue ${bSaveV.status})`);
        const bGetV = await fetch(`${BASE}/api/diagrams/${id}`, { headers: auth(b.token) });
        check(bGetV.ok, 'F: B lee (VIEWER) -> 200');

        // B no puede gestionar miembros; A sí; rol inválido -> 400
        const bInv = await fetch(`${BASE}/api/diagrams/${id}/members`, {
          method: 'POST', headers: { ...auth(b.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'aclA', role: 'EDITOR' }),
        });
        check(bInv.status === 403, 'F: B (VIEWER) invita -> 403');
        const badRole = await fetch(`${BASE}/api/diagrams/${id}/members`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'aclB', role: 'ADMIN' }),
        });
        check(badRole.status === 400, 'F: rol inválido -> 400');
        const selfDelOwner = await fetch(`${BASE}/api/diagrams/${id}/members/${a.user.id}`, {
          method: 'DELETE', headers: auth(a.token),
        });
        check(selfDelOwner.status === 400, 'F: owner no puede auto-eliminarse -> 400');

        // B se auto-elimina -> 403 al reabrir
        const bSelf = await fetch(`${BASE}/api/diagrams/${id}/members/${b.user.id}`, {
          method: 'DELETE', headers: auth(b.token),
        });
        check(bSelf.ok, 'F: B se auto-elimina -> 200');
        const bGone = await fetch(`${BASE}/api/diagrams/${id}`, { headers: auth(b.token) });
        check(bGone.status === 403, 'F: B reabre tras salir -> 403');

        // Listado filtrado: A ve el suyo; C (registrado después) no.
        // El endpoint devuelve { owned, shared } desde el dashboard.
        const flatList = (payload) =>
          Array.isArray(payload) ? payload : [...(payload.owned || []), ...(payload.shared || [])];
        const c = await register('aclC', 'c@t.co', '123456');
        const listA = flatList(await fetch(`${BASE}/api/diagrams`, { headers: auth(a.token) }).then(r => r.json()));
        const listC = flatList(await fetch(`${BASE}/api/diagrams`, { headers: auth(c.token) }).then(r => r.json()));
        check(listA.some(d => d.id === id), 'F: A lista su diagrama');
        check(!listC.some(d => d.id === id), 'F: C no lista el diagrama ajeno');
        check(!listC.some(d => d.id.endsWith('.acl')), 'F: .acl.json no se listan');

        // Crea + borra como OWNER (limpia .acl.json)
        const del = await fetch(`${BASE}/api/diagrams/${id}`, {
          method: 'DELETE', headers: auth(a.token),
        });
        check(del.status === 204, 'F: A borra (OWNER) -> 204');
        check(!fs.existsSync(path.join(DIAGRAMS_DIR, `${id}.acl.json`)), 'F: .acl.json eliminado con el diagrama');

        // ── Test G: WebSocket ──
        const gid = 'test-g-diagram';
        track(gid);
        await fetch(`${BASE}/api/diagrams/${gid}`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'G', nodes: [], edges: [], chat: [] }),
        });
        const noToken = await wsConnect(`diagram-room-${gid}`, null);
        check(noToken.open === false && noToken.code === 4401, `G: WS sin token -> 4401 (fue ${noToken.code})`);
        const outsider = await wsConnect(`diagram-room-${gid}`, c.token);
        check(outsider.open === false && outsider.code === 4403, `G: WS de C (sin acceso) -> 4403 (fue ${outsider.code})`);
        const ownerWs = await wsConnect(`diagram-room-${gid}`, a.token);
        check(ownerWs.open === true, 'G: WS de A (OWNER) conecta');
        // A invita a B como EDITOR y B conecta por WS
        await fetch(`${BASE}/api/diagrams/${gid}/members`, {
          method: 'POST', headers: { ...auth(a.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'aclB', role: 'EDITOR' }),
        });
        const editorWs = await wsConnect(`diagram-room-${gid}`, b.token);
        check(editorWs.open === true, 'G: WS de B (EDITOR) conecta');

        // ── Test H: legacy sin ACL se migra al abrir ──
        const hid = 'test-h-legacy';
        track(hid);
        fs.writeFileSync(
          path.join(DIAGRAMS_DIR, `${hid}.json`),
          JSON.stringify({ name: 'H', nodes: [], edges: [], chat: [] })
        );
        check(!fs.existsSync(path.join(DIAGRAMS_DIR, `${hid}.acl.json`)), 'H: legacy sin .acl.json (precondición)');
        const hOpen = await fetch(`${BASE}/api/diagrams/${hid}`, { headers: auth(a.token) });
        check(hOpen.ok, 'H: A abre legacy -> 200');
        const hAcl = JSON.parse(fs.readFileSync(path.join(DIAGRAMS_DIR, `${hid}.acl.json`), 'utf8'));
        check(hAcl.ownerId === a.user.id, 'H: migrado con A como OWNER');
      } finally {
        await stopServer(srv);
      }
    }
  } finally {
    for (const id of createdDiagrams) {
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

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nACL-PHASE2A TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
