// Test Fase 1: autenticación JWT con flag de compatibilidad.
// Uso: node backend/tests/auth-phase1.test.js
// Levanta el server.js REAL en un puerto de prueba con AUTH_ENABLED=false
// (Test A: todo abierto) y true (Tests B: registro/login/401s), usando un
// JWT_SECRET y users.json temporales (USERS_FILE no es configurable, así
// que se respalda y restaura backend/data/users.json si existe).
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const PORT = 23457;
const BASE = `http://localhost:${PORT}`;
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const BACKUP = USERS_FILE + '.test-bak';

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

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  const hadUsers = fs.existsSync(USERS_FILE);
  const backupContent = hadUsers ? fs.readFileSync(USERS_FILE, 'utf8') : null;
  if (hadUsers) fs.copyFileSync(USERS_FILE, BACKUP);

  try {
    // ── Test A: AUTH_ENABLED=false -> todo abierto ──
    {
      let srv = await startServer(false);
      try {
        const status = await fetch(`${BASE}/api/auth/status`).then(r => r.json());
        check(status.authEnabled === false, 'A: /status dice authEnabled=false');
        const diagrams = await fetch(`${BASE}/api/diagrams`);
        check(diagrams.ok, 'A: GET /api/diagrams sin token -> 200');
        const gen = await fetch(`${BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentState: { entities: [] } }),
        });
        check(gen.status === 400, `A: POST /api/generate sin token pasa auth (400 por falta de entidades, fue ${gen.status})`);
        const me = await fetch(`${BASE}/api/auth/me`).then(r => r.json());
        check(me.anonymous === true && me.user === null, 'A: /me anónimo sin bloquear');
      } finally {
        await stopServer(srv);
      }
    }

    // ── Test B: AUTH_ENABLED=true ──
    {
      if (fs.existsSync(USERS_FILE)) fs.rmSync(USERS_FILE);
      let srv = await startServer(true);
      try {
        const status = await fetch(`${BASE}/api/auth/status`).then(r => r.json());
        check(status.authEnabled === true, 'B: /status dice authEnabled=true');

        const noAuth = await fetch(`${BASE}/api/diagrams`);
        check(noAuth.status === 401, `B: GET /api/diagrams sin token -> 401 (fue ${noAuth.status})`);
        const noAuthGen = await fetch(`${BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentState: { entities: [{ name: 'X', attributes: [] }] } }),
        });
        check(noAuthGen.status === 401, `B: POST /api/generate sin token -> 401 (fue ${noAuthGen.status})`);
        const badToken = await fetch(`${BASE}/api/diagrams`, {
          headers: { Authorization: 'Bearer token-invalido' },
        });
        check(badToken.status === 401, 'B: token inválido -> 401');

        // Registro bootstrap (primer usuario, sin invitación)
        const reg = await fetch(`${BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', email: 'admin@test.com', password: 'admin123' }),
        });
        check(reg.status === 201, `B: register -> 201 (fue ${reg.status})`);
        const regData = await reg.json();
        check(!!regData.token && regData.user.username === 'admin', 'B: register devuelve token + user');
        check(!('passwordHash' in regData.user), 'B: user sin passwordHash');
        const token = regData.token;

        // users.json con hash, nunca en claro
        const stored = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        check(
          stored.length === 1 && !!stored[0].passwordHash && !('password' in stored[0]),
          'B: users.json con passwordHash (nunca en claro)'
        );

        // Duplicados y validaciones -> 400
        const dup = await fetch(`${BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', email: 'otro@test.com', password: 'admin123' }),
        });
        check(dup.status === 400, 'B: username duplicado -> 400');
        const short = await fetch(`${BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'ab', email: 'x@y.z', password: '12345' }),
        });
        check(short.status === 400, 'B: validación corta -> 400');

        // Login bueno y malo
        const login = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });
        check(login.ok, 'B: login correcto -> 200');
        const badLogin = await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'incorrecta' }),
        });
        check(badLogin.status === 401, 'B: login incorrecto -> 401');

        // Endpoints protegidos con token
        const withToken = await fetch(`${BASE}/api/diagrams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(withToken.ok, 'B: GET /api/diagrams con token -> 200');
        const me = await fetch(`${BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());
        check(me.user && me.user.username === 'admin' && !('passwordHash' in me.user), 'B: /me devuelve user sanitizado');

        // Rutas públicas con auth activo
        const health = await fetch(`${BASE}/health`);
        check(health.ok, 'B: /health público con auth activo');
      } finally {
        await stopServer(srv);
      }
    }

    // ── Test D: diagrams existentes intactos ──
    // (los .acl.json hermanos no son diagramas: se excluyen como en el servidor)
    {
      const dir = path.join(__dirname, '..', 'data', 'diagrams');
      const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.acl.json'))
        : [];
      let okCount = 0;
      for (const f of files) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          if (Array.isArray(d.nodes) || Array.isArray(d.edges)) okCount++;
        } catch {}
      }
      check(files.length === 0 || okCount === files.length, `D: ${okCount}/${files.length} diagramas parseables`);
    }
  } finally {
    if (hadUsers && backupContent !== null) {
      fs.writeFileSync(USERS_FILE, backupContent);
      if (fs.existsSync(BACKUP)) fs.rmSync(BACKUP);
    } else if (fs.existsSync(USERS_FILE)) {
      fs.rmSync(USERS_FILE);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nAUTH-PHASE1 TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
