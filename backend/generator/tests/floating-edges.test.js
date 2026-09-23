// Test de verificación: aristas flotantes estilo Enterprise Architect.
// Uso: node backend/generator/tests/floating-edges.test.js
// Transpila el floatingEdges.ts REAL (sin typecheck: lo cubre tsc --noEmit)
// y verifica la geometría pura + invariantes de integración:
//  F1: nodos alineados horizontalmente -> sale por right, entra por left.
//  F2: nodos alineados verticalmente -> sale por bottom, entra por top.
//  F3: nodos en diagonal -> el punto cae en el borde del rectángulo.
//  F4/F5: mover nodos o superponerlos / dims indefinidas -> sin crash.
//  F6/F7: los lados son Position válidos para orientar marcadores.
//  F8: el overlay de clase asociativa sigue basado en centros (intacto).
//  F9: estilo de selección presente en UmlEdge.
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', '..', '..', 'frontend');
const FRONTEND_SRC = path.join(FRONTEND_DIR, 'src');
const TMP = path.join(__dirname, '.tmp-floating-test');

function loadFloatingEdges() {
  const ts = require(path.join(FRONTEND_DIR, 'node_modules', 'typescript'));
  fs.rmSync(TMP, { recursive: true, force: true });
  const nm = path.join(TMP, 'node_modules');
  fs.mkdirSync(path.join(nm, 'reactflow'), { recursive: true });
  fs.writeFileSync(
    path.join(nm, 'reactflow', 'package.json'),
    JSON.stringify({ name: 'reactflow-stub', version: '0.0.0', main: 'index.js' })
  );
  fs.writeFileSync(
    path.join(nm, 'reactflow', 'index.js'),
    'module.exports = { useStore: () => ({}), Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" } };'
  );
  const src = fs.readFileSync(path.join(FRONTEND_SRC, 'utils', 'floatingEdges.ts'), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const outFile = path.join(TMP, 'floatingEdges.compiled.js');
  fs.writeFileSync(outFile, js);
  return require(outFile);
}

function node(x, y, w, h) {
  const n = { position: { x, y } };
  if (w !== undefined) n.width = w;
  if (h !== undefined) n.height = h;
  return n;
}

function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  const { getNodeIntersection } = loadFloatingEdges();

  // ── F1: horizontal ──
  {
    const a = node(0, 0, 200, 100);
    const b = node(400, 0, 200, 100);
    const s = getNodeIntersection(a, b);
    const t = getNodeIntersection(b, a);
    check(s.side === 'right' && t.side === 'left', 'F1: sale por right, entra por left');
    check(s.point.x === 200 && s.point.y === 50, `F1: punto en borde derecho (fue ${s.point.x},${s.point.y})`);
    check(t.point.x === 400 && t.point.y === 50, `F1: punto en borde izquierdo (fue ${t.point.x},${t.point.y})`);
  }

  // ── F2: vertical ──
  {
    const a = node(0, 0, 200, 100);
    const b = node(0, 300, 200, 100);
    const s = getNodeIntersection(a, b);
    const t = getNodeIntersection(b, a);
    check(s.side === 'bottom' && t.side === 'top', 'F2: sale por bottom, entra por top');
    check(s.point.x === 100 && s.point.y === 100, `F2: punto en borde inferior (fue ${s.point.x},${s.point.y})`);
  }

  // ── F3: diagonal (el punto cae en el borde) ──
  {
    const a = node(0, 0, 200, 100); // centro (100,50)
    const b = node(400, 300, 200, 100); // centro (500,350)
    const s = getNodeIntersection(a, b);
    const onBorder =
      Math.abs(s.point.x - 100) === 100 || Math.abs(s.point.y - 50) === 50;
    check(onBorder, `F3: punto en el borde (fue ${s.point.x},${s.point.y})`);
    check(['left', 'right', 'top', 'bottom'].includes(s.side), `F3: lado válido (${s.side})`);
  }

  // ── F4: mover un nodo recalcula (misma función, nuevas coords) ──
  {
    const a = node(0, 0, 200, 100);
    const b1 = node(400, 0, 200, 100);
    const b2 = node(0, 300, 200, 100);
    const s1 = getNodeIntersection(a, b1);
    const s2 = getNodeIntersection(a, b2);
    check(s1.side === 'right' && s2.side === 'bottom', 'F4: al mover, el lado se recalcula');
  }

  // ── F5: superpuestos o sin dims -> sin crash, valores por defecto ──
  {
    const a = node(0, 0);
    const b = node(0, 0);
    const s = getNodeIntersection(a, b);
    check(s.point.x === 100 && s.point.y === 50, 'F5: centros coincidentes -> centro por defecto 200x100');
    const c = node(0, 0);
    const d = node(500, 0);
    const s2 = getNodeIntersection(c, d);
    check(s2.side === 'right' && s2.point.x === 200, 'F5: dims indefinidas usan 200x100');
  }

  // ── F6/F7: lados compatibles con la orientación de marcadores ──
  {
    const sides = new Set();
    const pairs = [
      [node(0, 0, 200, 100), node(400, 0, 200, 100)],
      [node(0, 0, 200, 100), node(0, 300, 200, 100)],
      [node(0, 0, 200, 100), node(400, 300, 200, 100)],
      [node(400, 300, 200, 100), node(0, 0, 200, 100)],
    ];
    for (const [x, y] of pairs) {
      sides.add(getNodeIntersection(x, y).side);
      sides.add(getNodeIntersection(y, x).side);
    }
    const valid = [...sides].every(s => ['left', 'right', 'top', 'bottom'].includes(s));
    check(valid, `F6/F7: lados siempre Position válidos (${[...sides].join(',')})`);
  }

  // ── F8: overlay intacto (sigue basado en centros, no en handles) ──
  {
    const src = fs.readFileSync(
      path.join(FRONTEND_SRC, 'components', 'AssociationClassConnector.tsx'),
      'utf8'
    );
    check(/computeConnectorLines/.test(src), 'F8: overlay usa computeConnectorLines (centros)');
    check(/positionAbsolute/.test(src), 'F8: overlay lee posiciones absolutas');
  }

  // ── F9: estilo de selección + integración en wrappers ──
  {
    const uml = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'UmlEdge.tsx'), 'utf8');
    check(/#3b82f6/.test(uml), 'F9: UmlEdge resalta selección en azul');
    for (const name of ['AssociationEdge.tsx', 'InheritanceEdge.tsx', 'AggregationEdge.tsx', 'CompositionEdge.tsx']) {
      const src = fs.readFileSync(path.join(FRONTEND_SRC, 'components', name), 'utf8');
      check(/useFloatingEdgeGeometry/.test(src), `${name} usa geometría flotante`);
    }
    const entity = fs.readFileSync(path.join(FRONTEND_SRC, 'components', 'EntityNode.tsx'), 'utf8');
    check(/group-hover:opacity-100/.test(entity), 'EntityNode: handles sutiles con hover');
    check(/type="source"/.test(entity) && /type="target"/.test(entity), 'EntityNode: handles source+target intactos');
  }

  fs.rmSync(TMP, { recursive: true, force: true });

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nFLOATING-EDGES TESTS PASSED');
}

try {
  main();
} catch (err) {
  console.error('ERROR:', err);
  process.exit(1);
}
