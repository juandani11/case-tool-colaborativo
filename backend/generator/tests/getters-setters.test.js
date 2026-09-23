// Test de verificación: getters/setters explícitos en el código generado.
// Uso: node backend/generator/tests/getters-setters.test.js
// Genera un backend con 3 entidades (Customer, User, OrderDetails) + una
// relación ManyToOne con atributo duplicado (customerId), y verifica:
//  1. Cada modelo/DTO/intermedia tiene >= N getters y N setters.
//  2. Cada getter tiene su setter correspondiente.
//  3. Ningún DTO declara un campo dos veces.
//  4. AiQueryRequest tiene getQuery/setQuery y AiQueryResponse el ctor de 2 args.
const fs = require('fs');
const path = require('path');
const { generateProject } = require('../generate');

const MODEL_PKG = ['src', 'main', 'java', 'com', 'example', 'demo'];

function getters(src) {
  const re = /public\s+[\w<>\[\], ?]+\s+(get[A-Z]\w*)\s*\(\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function setters(src) {
  const re = /public\s+void\s+(set[A-Z]\w*)\s*\(/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function fieldDeclarations(src) {
  const re = /private\s+[\w<>\[\], ?]+\s+(\w+)\s*(=|;)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  const ast = {
    entities: [
      {
        id: 'e1',
        name: 'Customer',
        attributes: [
          { id: 'a1', name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
          { id: 'a2', name: 'email', type: 'String', isPk: false, nullable: false, unique: true },
        ],
      },
      {
        id: 'e2',
        name: 'User',
        attributes: [
          { id: 'a3', name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
          { id: 'a4', name: 'username', type: 'String', isPk: false, nullable: false, unique: true },
        ],
      },
      {
        id: 'e3',
        name: 'OrderDetails',
        attributes: [
          { id: 'a5', name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
          // Atributo que colisiona con el FK auto-generado de la relación:
          // el MODELO lo omite (lo mapea el @ManyToOne) pero el DTO lo expone
          { id: 'a6', name: 'customerId', type: 'UUID', isPk: false, nullable: true, unique: false },
          { id: 'a7', name: 'total', type: 'BigDecimal', isPk: false, nullable: false, unique: false },
        ],
      },
    ],
    relationships: [
      {
        id: 'r1',
        source: { id: 'e3', entityName: 'OrderDetails' },
        target: { id: 'e1', entityName: 'Customer' },
        fromEntity: 'OrderDetails',
        toEntity: 'Customer',
        type: 'ASSOCIATION',
        cardinalityFrom: '*',
        cardinalityTo: '1',
      },
    ],
  };

  const zipPath = await generateProject(ast);
  const outDir = path.dirname(zipPath);
  // generateProject crea un directorio con timestamp: elegir el más reciente
  // (pueden existir restos de ejecuciones anteriores).
  const projDir = fs.readdirSync(outDir)
    .filter(f => fs.statSync(path.join(outDir, f)).isDirectory())
    .sort((a, b) =>
      fs.statSync(path.join(outDir, b)).mtimeMs - fs.statSync(path.join(outDir, a)).mtimeMs
    )[0];
  const root = path.join(outDir, projDir);
  const modelDir = path.join(root, ...MODEL_PKG, 'model');
  const dtoDir = path.join(root, ...MODEL_PKG, 'dto');
  const aiDir = path.join(root, ...MODEL_PKG, 'ai');

  // 1-3. Modelos y DTOs
  for (const dir of [modelDir, dtoDir]) {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.java'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const gs = getters(src);
      const ss = setters(src);
      const fields = fieldDeclarations(src);
      check(gs.length >= fields.length, `${f}: getters (${gs.length}) >= campos (${fields.length})`);
      check(ss.length >= fields.length, `${f}: setters (${ss.length}) >= campos (${fields.length})`);
      for (const g of gs) {
        const expected = 'set' + g.slice(3);
        check(ss.includes(expected), `${f}: ${g} tiene su ${expected}`);
      }
      const dupes = fields.filter((x, i) => fields.indexOf(x) !== i);
      check(dupes.length === 0, `${f}: sin campos duplicados${dupes.length ? ' (' + dupes.join(',') + ')' : ''}`);
    }
  }

  // Caso específico: OrderDetailsDTO declara customerId una sola vez
  // (el atributo del diagrama reutiliza el FK auto-generado de la relación)
  const dtoSrc = fs.readFileSync(path.join(dtoDir, 'OrderDetailsDTO.java'), 'utf8');
  const decls = dtoSrc.match(/private\s+[\w<>\[\]]+\s+customerId\s*;/g) || [];
  check(decls.length === 1, `OrderDetailsDTO: customerId declarado ${decls.length} vez (esperado 1)`);

  // 4. Módulo AI
  const reqSrc = fs.readFileSync(path.join(aiDir, 'AiQueryRequest.java'), 'utf8');
  check(/getQuery\s*\(\s*\)/.test(reqSrc), 'AiQueryRequest tiene getQuery()');
  check(/setQuery\s*\(/.test(reqSrc), 'AiQueryRequest tiene setQuery()');
  const resSrc = fs.readFileSync(path.join(aiDir, 'AiQueryResponse.java'), 'utf8');
  check(/public\s+AiQueryResponse\s*\(\s*String\s+\w+\s*,\s*String\s+\w+\s*\)/.test(resSrc), 'AiQueryResponse tiene ctor de 2 args');

  // Limpieza
  fs.rmSync(outDir, { recursive: true, force: true });
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nGETTERS-SETTERS TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
