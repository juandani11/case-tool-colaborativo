// Test de verificación: clase asociativa en relaciones * a *.
// Uso: node backend/generator/tests/association-class.test.js
// Compila el nodesToAST REAL del frontend (tsc) y verifica:
//  Caso A: User *---* Customer sin clase asociativa
//    -> intermedia auto-generada UserCustomer, entidades intactas.
//  Caso B: con clase asociativa Asignacion (fechaInicio, rol)
//    -> intermedia Asignacion con esos atributos; el nodo NO se cuenta
//       como entidad (sin doble generación); flag isAssociationClass.
//  Caso C: clase asociativa SIN atributos
//    -> intermedia Asignacion con solo 2 FKs + ID.
//  Extra: vínculo roto o atributo PK en el nodo -> degradación segura.
// Después verifica el backend: Asignacion.java contiene los 2 @ManyToOne
// más fechaInicio y rol (caso B).
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { generateProject } = require('../generate');

const FRONTEND_DIR = path.join(__dirname, '..', '..', '..', 'frontend');
const TMP = path.join(__dirname, '.tmp-assoc-test');

function compileFrontend() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'src', 'utils'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'src', 'types'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'stub', 'reactflow'), { recursive: true });
  fs.writeFileSync(
    path.join(TMP, 'stub', 'reactflow', 'index.js'),
    'module.exports = {};'
  );
  for (const f of ['utils/ast.ts', 'utils/yjsEdgeHelpers.ts', 'utils/associationClass.ts', 'types/diagram.ts']) {
    fs.copyFileSync(path.join(FRONTEND_DIR, 'src', f), path.join(TMP, 'src', f));
  }
  fs.writeFileSync(
    path.join(TMP, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'commonjs',
        target: 'es2019',
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: 'node',
        outDir: './dist',
        rootDir: './src',
        baseUrl: '.',
        paths: {
          reactflow: ['./stub/reactflow/index.js'],
          yjs: [path.join(FRONTEND_DIR, 'node_modules', 'yjs').replace(/\\/g, '/')],
        },
      },
      include: ['src/**/*'],
    })
  );
  cp.execSync(`npx --prefix "${FRONTEND_DIR}" tsc -p "${path.join(TMP, 'tsconfig.json')}"`, {
    stdio: 'pipe',
  });
  return {
    nodesToAST: require(path.join(TMP, 'dist', 'utils', 'ast.js')).nodesToAST,
    assoc: require(path.join(TMP, 'dist', 'utils', 'associationClass.js')),
  };
}

function node(id, label, attributes, extra) {
  return {
    id,
    type: 'entity',
    position: { x: 0, y: 0 },
    data: {
      label,
      attributes: attributes || [],
      methods: [],
      stereotype: 'class',
      ...(extra || {}),
    },
  };
}

function attr(id, name, type) {
  return { id, name, type, isPk: false, nullable: true, unique: false };
}

function mtmEdge(id, source, target, associationClassId) {
  return {
    id,
    source,
    target,
    type: 'association',
    data: {
      type: 'ASSOCIATION',
      cardinalityFrom: '*',
      cardinalityTo: '*',
      ...(associationClassId ? { associationClassId } : {}),
    },
  };
}

async function main() {
  const failures = [];
  const check = (cond, msg) => {
    console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg);
    if (!cond) failures.push(msg);
  };

  const { nodesToAST, assoc } = compileFrontend();

  const user = () => node('n-user', 'User', [attr('a-u1', 'email', 'String')]);
  const customer = () => node('n-cust', 'Customer', [attr('a-c1', 'email', 'String')]);

  // ── Caso A: sin clase asociativa ──
  {
    const ast = nodesToAST([user(), customer()], [mtmEdge('e1', 'n-user', 'n-cust')]);
    check(ast.entities.length === 2, 'A: 2 entidades');
    const r = ast.relationships[0];
    check(r.intermediateEntity === 'UserCustomer', `A: intermedia auto UserCustomer (fue ${r.intermediateEntity})`);
    check(r.isAssociationClass !== true, 'A: sin flag isAssociationClass');
    check((r.intermediateAttributes || []).length === 0, 'A: sin atributos intermedios');
  }

  // ── Caso B: clase asociativa con atributos ──
  const asignacion = () =>
    node('n-asig', 'Asignacion', [attr('a-f1', 'fechaInicio', 'Date'), attr('a-r1', 'rol', 'String')], {
      isAssociationClass: true,
    });
  let astB;
  {
    astB = nodesToAST(
      [user(), customer(), asignacion()],
      [mtmEdge('e1', 'n-user', 'n-cust', 'n-asig')]
    );
    const names = astB.entities.map(e => e.name);
    check(!names.includes('Asignacion'), `B: Asignacion NO es entidad (entidades: ${names.join(',')})`);
    const r = astB.relationships[0];
    check(r.intermediateEntity === 'Asignacion', `B: intermedia Asignacion (fue ${r.intermediateEntity})`);
    check(r.intermediateTable === 'asignacion', `B: tabla asignacion (fue ${r.intermediateTable})`);
    check(r.isAssociationClass === true, 'B: flag isAssociationClass');
    const anames = (r.intermediateAttributes || []).map(a => `${a.name}:${a.type}`).sort();
    check(
      anames.join(',') === 'fechaInicio:Date,rol:String',
      `B: atributos fechaInicio+rol (fueron ${anames.join(',')})`
    );
  }

  // ── Caso C: clase asociativa sin atributos ──
  {
    const ast = nodesToAST(
      [user(), customer(), node('n-asig', 'Asignacion', [], { isAssociationClass: true })],
      [mtmEdge('e1', 'n-user', 'n-cust', 'n-asig')]
    );
    check(!ast.entities.some(e => e.name === 'Asignacion'), 'C: Asignacion NO es entidad');
    const r = ast.relationships[0];
    check(r.intermediateEntity === 'Asignacion', 'C: intermedia Asignacion');
    check((r.intermediateAttributes || []).length === 0, 'C: sin atributos');
  }

  // ── Extra: vínculo roto -> degradación a auto-generado ──
  {
    const ast = nodesToAST(
      [user(), customer()],
      [mtmEdge('e1', 'n-user', 'n-cust', 'n-inexistente')]
    );
    check(ast.relationships[0].intermediateEntity === 'UserCustomer', 'Extra: vínculo roto -> auto UserCustomer');
  }

  // ── Extra: atributo PK del nodo se ignora (la intermedia ya tiene su UUID) ──
  {
    const withPk = node(
      'n-asig',
      'Asignacion',
      [
        { id: 'a-id', name: 'id', type: 'UUID', isPk: true, nullable: false, unique: true },
        attr('a-r1', 'rol', 'String'),
      ],
      { isAssociationClass: true }
    );
    const ast = nodesToAST([user(), customer(), withPk], [mtmEdge('e1', 'n-user', 'n-cust', 'n-asig')]);
    const anames = (ast.relationships[0].intermediateAttributes || []).map(a => a.name);
    check(anames.join(',') === 'rol', `Extra: PK del nodo ignorada (fueron ${anames.join(',')})`);
  }

  // ── Nuevo modelo (Bloque 2): la arista SE CONSERVA y apunta al nodo ──
  // Caso A2: convertir crea el nodo con nombre derivado, sin links
  let assocNode, keptEdge;
  {
    const fromNode = { ...user(), position: { x: 0, y: 0 } };
    const toNode = { ...customer(), position: { x: 200, y: 100 } };
    const origEdge = mtmEdge('e1', 'n-user', 'n-cust');
    assocNode = assoc.buildAssociationNode(fromNode, toNode, origEdge);
    check(assocNode.data.label === 'UserCustomer', `A2: nombre por defecto UserCustomer (fue ${assocNode.data.label})`);
    check(assocNode.data.isAssociationClass === true, 'A2: flag isAssociationClass');
    check(
      assocNode.data.associationOf.edgeId === 'e1' &&
        assocNode.data.associationOf.sourceId === 'n-user' &&
        assocNode.data.associationOf.targetId === 'n-cust',
      'A2: associationOf apunta a la arista conservada'
    );
    check(
      assocNode.position.x === 100 && assocNode.position.y === 50,
      `A2: punto medio (fue ${assocNode.position.x},${assocNode.position.y})`
    );
    // La arista conservada apunta al nodo (lo que hace el handler tras convertir)
    keptEdge = {
      ...origEdge,
      data: { ...origEdge.data, associationClassNodeId: assocNode.id },
    };
    check(keptEdge.data.associationClassNodeId === assocNode.id, 'A2: arista apunta al nodo');
  }

  // ── Caso B2: arista conservada + nodo renombrado -> intermedia Asignacion ──
  let astB2;
  {
    const renamed = {
      ...assocNode,
      data: {
        ...assocNode.data,
        label: 'Asignacion',
        attributes: [attr('a-f1', 'fechaInicio', 'Date'), attr('a-r1', 'rol', 'String')],
      },
    };
    astB2 = nodesToAST([user(), customer(), renamed], [keptEdge]);
    const names = astB2.entities.map(e => e.name);
    check(names.join(',') === 'User,Customer', `B2: entidades sin Asignacion (fueron ${names.join(',')})`);
    check(astB2.relationships.length === 1, `B2: 1 sola relación (fueron ${astB2.relationships.length})`);
    const r = astB2.relationships[0];
    check(r.intermediateEntity === 'Asignacion', `B2: intermedia Asignacion (fue ${r.intermediateEntity})`);
    check(r.isAssociationClass === true, 'B2: flag isAssociationClass');
    check(r.cardinalityFrom === '*' && r.cardinalityTo === '*', 'B2: cardinalidades de la arista (no del stash)');
    const anames = (r.intermediateAttributes || []).map(a => `${a.name}:${a.type}`).sort();
    check(anames.join(',') === 'fechaInicio:Date,rol:String', `B2: atributos del nodo (fueron ${anames.join(',')})`);
  }

  // ── Caso C2: nodo nuevo sin atributos ──
  {
    const empty = { ...assocNode, data: { ...assocNode.data, attributes: [] } };
    const edge2 = { ...keptEdge };
    const ast = nodesToAST([user(), customer(), empty], [edge2]);
    check(ast.relationships[0].intermediateEntity === 'UserCustomer', 'C2: intermedia con nombre del nodo');
    check((ast.relationships[0].intermediateAttributes || []).length === 0, 'C2: sin atributos');
  }

  // ── Caso D: disolver limpia el vínculo y la arista queda * a * normal ──
  {
    const renamed = {
      ...assocNode,
      data: {
        ...assocNode.data,
        label: 'Asignacion',
        attributes: [attr('a-f1', 'fechaInicio', 'Date')],
      },
    };
    const plan = assoc.planAssociationDelete(
      [user(), customer(), renamed],
      [keptEdge],
      renamed.id
    );
    check(plan.linkIdsToRemove.length === 0, 'D: sin links que quitar');
    check(
      plan.edgeFieldClears.length === 1 && plan.edgeFieldClears[0].field === 'associationClassNodeId',
      'D: plan limpia associationClassNodeId de la arista'
    );
    // Simular disolución: campo limpio + nodo fuera
    const dissolvedEdge = {
      ...keptEdge,
      data: { ...keptEdge.data, associationClassNodeId: undefined },
    };
    const ast = nodesToAST([user(), customer()], [dissolvedEdge]);
    check(ast.relationships[0].intermediateEntity === 'UserCustomer', 'D: disuelta genera auto UserCustomer');
    check(ast.entities.length === 2, 'D: 2 entidades tras disolver');
  }

  // ── Conector overlay: geometría pura medio-arista -> borde ──
  {
    const clsNodes = [
      { id: 'n-user', x: 0, y: 0, w: 240, h: 120 },
      { id: 'n-cust', x: 400, y: 0, w: 240, h: 120 },
      { id: assocNode.id, x: 200, y: 200, w: 240, h: 120 },
    ];
    const lines = assoc.computeConnectorLines(clsNodes, [keptEdge]);
    check(lines.length === 1, 'Overlay: 1 línea para la arista con clase');
    const l = lines[0];
    // Medio de centros (120,60)-(520,60) = (320,60); borde sup. del nodo (320,200)
    check(
      l.x1 === 320 && l.y1 === 60 && l.x2 === 320 && l.y2 === 200,
      `Overlay: medio (320,60) -> borde (320,200) (fue ${l.x1},${l.y1} -> ${l.x2},${l.y2})`
    );
    check(
      assoc.computeConnectorLines(clsNodes, [mtmEdge('e9', 'n-user', 'n-cust')]).length === 0,
      'Overlay: nada sin vínculo'
    );
  }

  // ── Extra: borrar un extremo limpia links legacy huérfanos ──
  {
    const legacyLink = {
      id: 'l1', source: 'n-asig', target: 'n-user', type: 'dashed',
      data: { isAssociationClassLink: true },
    };
    const renamed = { ...assocNode, data: { ...assocNode.data, label: 'Asignacion' } };
    const plan = assoc.planAssociationDelete([user(), customer(), renamed], [keptEdge, legacyLink], 'n-user');
    check(
      plan.linkIdsToRemove.join(',') === 'l1',
      'Extra: borrar extremo quita su link legacy'
    );
  }

  // ── Backend caso B (nuevo modelo): Asignacion.java con 2 FKs + fechaInicio + rol ──
  {
    const zipPath = await generateProject(astB2);
    const outDir = path.dirname(zipPath);
    const projDir = fs.readdirSync(outDir)
      .filter(f => fs.statSync(path.join(outDir, f)).isDirectory())
      .sort((a, b) =>
        fs.statSync(path.join(outDir, b)).mtimeMs - fs.statSync(path.join(outDir, a)).mtimeMs
      )[0];
    const root = path.join(outDir, projDir);
    const modelDir = path.join(root, 'src', 'main', 'java', 'com', 'example', 'demo', 'model');
    try {
      const src = fs.readFileSync(path.join(modelDir, 'Asignacion.java'), 'utf8');
      check(/private User user;/.test(src), 'Backend B: @ManyToOne User');
      check(/private Customer customer;/.test(src), 'Backend B: @ManyToOne Customer');
      check(/private LocalDate fechaInicio;/.test(src), 'Backend B: LocalDate fechaInicio');
      check(/private String rol;/.test(src), 'Backend B: String rol');
      check(/private UUID id;/.test(src), 'Backend B: UUID id propio');
      check(!/ManyToMany/.test(src), 'Backend B: sin @ManyToMany');
      // La clase asociativa NO debe existir también como entidad normal:
      // solo hay UNA Asignacion.java (la intermedia).
      const models = fs.readdirSync(modelDir).filter(f => f === 'Asignacion.java');
      check(models.length === 1, 'Backend B: Asignacion generada una sola vez');
      console.log('ZIP caso B (para mvn compile manual):', zipPath, '| dir:', root);
    } finally {
      // No se borra: se usa para el mvn compile manual de verificación.
      console.log('NOTA: proyecto de prueba conservado en', root);
    }
  }

  fs.rmSync(TMP, { recursive: true, force: true });

  if (failures.length > 0) {
    console.error(`\n${failures.length} FALLOS`);
    process.exit(1);
  }
  console.log('\nASSOCIATION-CLASS TESTS PASSED');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
