// Test de verificación: routing ortogonal estilo Enterprise Architect.
// Uso: node backend/generator/tests/edge-routing.test.js
//  1. getEdgeEndVector REAL (UmlEdge.tsx compilado con tsc): el marcador se
//     orienta por el segmento final (eje del handle), no por el vector recto.
//  2. getSmoothStepPath REAL (reactflow): R1/R2 rectas sin curvas, R3 con
//     codos redondeados (borderRadius 8, offset 20).
//  3. Invariantes estáticos: ningún getBezierPath en frontend/src;
//     UmlEdge + DashedEdge usan getSmoothStepPath.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { getSmoothStepPath, Position } = require('../../../frontend/node_modules/reactflow');

const FRONTEND_DIR = path.join(__dirname, '..', '..', '..', 'frontend');
const FRONTEND_SRC = path.join(FRONTEND_DIR, 'src');
const TMP = path.join(__dirname, '.tmp-routing-test');

const PARAMS = { borderRadius: 8, offset: 20 };

function compileUmlEdge() {
  // Transpila el UmlEdge.tsx REAL (sin typecheck: la seguridad de tipos la
  // cubre `tsc --noEmit` del frontend). Stubs mínimos para require().
  const ts = require(path.join(FRONTEND_DIR, 'node_modules', 'typescript'));
  fs.rmSync(TMP, { recursive: true, force: true });
  const nm = path.join(TMP, 'node_modules');
  fs.mkdirSync(path.join(nm, 'react'), { recursive: true });
  fs.mkdirSync(path.join(nm, 'reactflow'), { recursive: true });
  fs.writeFileSync(
    path.join(nm, 'react', 'package.json'),
    JSON.stringify({ name: 'react-stub', version: '0.0.0', main: 'index.js' })
  );
  fs.writeFileSync(path.join(nm, 'react', 'index.js'), 'module.exports = { memo: (x) => x };');
  fs.writeFileSync(
    path.join(nm, 'reactflow', 'package.json'),
    JSON.stringify({ name: 'reactflow-stub', version: '0.0.0', main: 'index.js' })
  );
  fs.writeFileSync(
    path.join(nm, 'reactflow', 'index.js'),
    'module.exports = { Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" } };'
  );
  const src = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'UmlEdge.tsx'), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, jsx: ts.JsxEmit.React },
  }).outputText;
  const outFile = path.join(TMP, 'UmlEdge.compiled.js');
  fs.writeFileSync(outFile, js);
  return require(outFile);
}

function allSourceFiles(dir, out) {
  out = out || [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (f === 'node_modules' || f === 'dist' || f === '.next') continue;
      allSourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(f)) {
      out.push(p);
    }
  }
  return out;
}

function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  // ── 1. Vector de llegada ──
  const { getEdgeEndVector, UML_EDGE_BORDER_RADIUS, UML_EDGE_OFFSET } = compileUmlEdge();
  check(UML_EDGE_BORDER_RADIUS === 8, 'params: borderRadius 8');
  check(UML_EDGE_OFFSET === 20, 'params: offset 20');
  const vecCases = [
    [Position.Left, 'left', { ux: 1, uy: 0 }],
    [Position.Right, 'right', { ux: -1, uy: 0 }],
    [Position.Top, 'top', { ux: 0, uy: 1 }],
    [Position.Bottom, 'bottom', { ux: 0, uy: -1 }],
  ];
  for (const [pos, name, exp] of vecCases) {
    const v = getEdgeEndVector(pos, 200, 150);
    check(v.ux === exp.ux && v.uy === exp.uy, `vector final ${name} (ignora diagonal ${200},${150})`);
  }
  const fb = getEdgeEndVector(undefined, 3, 4);
  check(Math.abs(fb.ux - 0.6) < 1e-9 && Math.abs(fb.uy - 0.8) < 1e-9, 'fallback a vector recto sin handle');

  // ── 2. Geometría R1/R2/R3 con el path generator real ──
  const hasCurve = (d) => /[QCTSA]/i.test(d);
  const r1 = getSmoothStepPath({
    sourceX: 0, sourceY: 0, sourcePosition: Position.Right,
    targetX: 200, targetY: 0, targetPosition: Position.Left,
    ...PARAMS,
  })[0];
  check(!hasCurve(r1), `R1 horizontal alineada es recta (${r1})`);
  const r2 = getSmoothStepPath({
    sourceX: 0, sourceY: 0, sourcePosition: Position.Bottom,
    targetX: 0, targetY: 200, targetPosition: Position.Top,
    ...PARAMS,
  })[0];
  check(!hasCurve(r2), `R2 vertical alineada es recta (${r2})`);
  const r3 = getSmoothStepPath({
    sourceX: 0, sourceY: 0, sourcePosition: Position.Right,
    targetX: 200, targetY: 150, targetPosition: Position.Left,
    ...PARAMS,
  })[0];
  check(r3.startsWith('M0 0') && r3.endsWith('200 150'), 'R3 une origen y destino exactos');
  check(/Q/.test(r3), `R3 desalineada con codo redondeado (${r3})`);

  // ── 3. Invariantes estáticos ──
  const files = allSourceFiles(FRONTEND_SRC);
  const withBezier = files.filter(f => /getBezierPath/.test(fs.readFileSync(f, 'utf8')));
  check(withBezier.length === 0, `sin getBezierPath en frontend/src (${withBezier.join(', ') || 'ok'})`);
  for (const name of ['UmlEdge.tsx', 'DashedEdge.tsx']) {
    const src = fs.readFileSync(path.join(FRONTEND_SRC, 'components', name), 'utf8');
    check(/getSmoothStepPath/.test(src), `${name} usa getSmoothStepPath`);
  }
  for (const name of ['InheritanceEdge.tsx', 'AggregationEdge.tsx', 'CompositionEdge.tsx']) {
    const src = fs.readFileSync(path.join(FRONTEND_SRC, 'components', name), 'utf8');
    check(/getEdgeEndVector/.test(src), `${name} orienta por segmento final`);
  }

  fs.rmSync(TMP, { recursive: true, force: true });

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nEDGE-ROUTING TESTS PASSED');
}

try {
  main();
} catch (err) {
  console.error('ERROR:', err);
  process.exit(1);
}
