// Test de verificación: sin columnas duplicadas en @ManyToOne.
// Uso: node backend/generator/tests/fk-collision.test.js
// Caso A: Orders con atributo customerId + relación * a 1 con Customer
//   -> solo @ManyToOne @JoinColumn(name="customer_id"), sin campo duplicado.
// Caso B: Orders SIN atributo customerId + relación * a 1 con Customer
//   -> solo @ManyToOne @JoinColumn(name="customer_id").
// En ambos: "customer_id" aparece EXACTAMENTE UNA VEZ en anotaciones
// @Column/@JoinColumn de Orders.java (si apareciera 2+, Hibernate lanzaría
// "Column duplicated in mapping" al arrancar).
const fs = require('fs');
const path = require('path');
const { generateProject } = require('../generate');

const MODEL_PKG = ['src', 'main', 'java', 'com', 'example', 'demo'];

function customerEntity() {
  return {
    id: 'e1',
    name: 'Customer',
    attributes: [
      { id: 'a1', name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
      { id: 'a2', name: 'email', type: 'String', isPk: false, nullable: false, unique: true },
    ],
  };
}

function ordersAttributes(withFkAttr) {
  const attrs = [
    { id: 'a3', name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
  ];
  if (withFkAttr) {
    attrs.push({ id: 'a4', name: 'customerId', type: 'UUID', isPk: false, nullable: true, unique: false });
  }
  return attrs;
}

function customerRelation() {
  return {
    id: 'r1',
    source: { id: 'e2', entityName: 'Orders' },
    target: { id: 'e1', entityName: 'Customer' },
    fromEntity: 'Orders',
    toEntity: 'Customer',
    type: 'ASSOCIATION',
    cardinalityFrom: '*',
    cardinalityTo: '1',
  };
}

async function generateCase(withFkAttr) {
  const ast = {
    entities: [
      customerEntity(),
      { id: 'e2', name: 'Orders', attributes: ordersAttributes(withFkAttr) },
    ],
    relationships: [customerRelation()],
  };
  const zipPath = await generateProject(ast);
  const outDir = path.dirname(zipPath);
  const projDir = fs.readdirSync(outDir)
    .filter(f => fs.statSync(path.join(outDir, f)).isDirectory())
    .sort((a, b) =>
      fs.statSync(path.join(outDir, b)).mtimeMs - fs.statSync(path.join(outDir, a)).mtimeMs
    )[0];
  return { outDir, zipPath, root: path.join(outDir, projDir) };
}

function cleanup(outDir, zipPath) {
  fs.rmSync(outDir, { recursive: true, force: true });
  if (zipPath && fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
}

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  for (const withFkAttr of [true, false]) {
    const label = withFkAttr ? 'Caso A (con atributo customerId)' : 'Caso B (sin atributo customerId)';
    const { outDir, zipPath, root } = await generateCase(withFkAttr);
    try {
      const modelSrc = fs.readFileSync(path.join(root, ...MODEL_PKG, 'model', 'Orders.java'), 'utf8');
      const dtoSrc = fs.readFileSync(path.join(root, ...MODEL_PKG, 'dto', 'OrdersDTO.java'), 'utf8');
      const migSrc = fs.readFileSync(path.join(root, 'src', 'main', 'resources', 'db', 'migration', 'V1__init.sql'), 'utf8');

      // 1. customer_id aparece EXACTAMENTE UNA VEZ en @Column/@JoinColumn
      const anns = modelSrc.match(/@(Column|JoinColumn)\([^)]*customer_id[^)]*\)/g) || [];
      check(anns.length === 1, `${label}: customer_id en anotaciones = ${anns.length} (esperado 1)`);

      // 2. La relación @ManyToOne es la fuente de verdad
      check(/@ManyToOne[^;]*@JoinColumn\(name = "customer_id"\)/s.test(modelSrc), `${label}: @ManyToOne @JoinColumn(name="customer_id") presente`);

      // 3. Sin campo plano duplicado en el modelo
      const modelDupes = modelSrc.match(/private\s+\w+\s+customerId\s*;/g) || [];
      check(modelDupes.length === 0, `${label}: modelo sin campo customerId duplicado`);

      // 4. El DTO SIGUE exponiendo customerId como campo plano (una sola vez)
      const dtoDecls = dtoSrc.match(/private\s+[\w<>\[\]]+\s+customerId\s*;/g) || [];
      check(dtoDecls.length === 1, `${label}: DTO expone customerId ${dtoDecls.length} vez (esperado 1)`);

      // 5. Migración sin comas dobles ni columna duplicada
      check(!/,,/.test(migSrc), `${label}: migración sin comas dobles`);
      const ordersTable = migSrc.split('CREATE TABLE')[2] || '';
      // Una sola DEFINICIÓN de columna (el nombre del constraint también
      // contiene customer_id, por eso se cuenta la definición, no menciones)
      const colDefs = ordersTable.match(/^\s*customer_id\s+\w+/gm) || [];
      check(colDefs.length === 1, `${label}: columna customer_id definida ${colDefs.length} vez (esperado 1)`);
    } finally {
      cleanup(outDir, zipPath);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nFK-COLLISION TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
