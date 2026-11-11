'use strict';

// Verifica que el PUT actualice por ID y que el DTO/servicio del hijo
// incluyan atributos heredados del padre.
const fs = require('fs');
const path = require('path');
const { generateProject } = require('../generate');

function attr(id, name, type, isPk) {
  return { id, name, type, isPk: !!isPk, nullable: !isPk, unique: !!isPk };
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
        name: 'Persona',
        attributes: [attr('a1', 'id', 'UUID', true), attr('a2', 'nombre', 'String', false)],
      },
      {
        id: 'e2',
        name: 'Autor',
        attributes: [attr('a3', 'pais', 'String', false)],
      },
    ],
    relationships: [
      {
        id: 'r1',
        source: { id: 'e2', entityName: 'Autor' },
        target: { id: 'e1', entityName: 'Persona' },
        fromEntity: 'Autor',
        toEntity: 'Persona',
        type: 'INHERITANCE',
      },
    ],
  };

  const zipPath = await generateProject(ast);
  const outDir = path.dirname(zipPath);
  const root = path.join(outDir, 'project', 'src', 'main', 'java', 'com', 'example', 'demo');

  try {
    const dto = fs.readFileSync(path.join(root, 'dto', 'AutorDTO.java'), 'utf8');
    const service = fs.readFileSync(path.join(root, 'service', 'AutorService.java'), 'utf8');
    const controller = fs.readFileSync(path.join(root, 'controller', 'AutorController.java'), 'utf8');
    const handler = fs.readFileSync(path.join(root, 'config', 'GlobalExceptionHandler.java'), 'utf8');

    check(/private String nombre;/.test(dto), 'AutorDTO incluye atributo heredado nombre');
    check(/private String pais;/.test(dto), 'AutorDTO incluye atributo propio pais');
    check(/public AutorDTO update\(UUID id, AutorDTO dto\)/.test(service), 'AutorService tiene update(id,dto)');
    check(/repository\.findById\(id\)/.test(service), 'update busca la entidad existente por id');
    check(/orElseThrow\(\(\) -> new EntityNotFoundException/.test(service), 'update lanza EntityNotFoundException');
    check(/entity\.setNombre\(dto\.getNombre\(\)\)/.test(service), 'update actualiza nombre heredado');
    check(/entity\.setPais\(dto\.getPais\(\)\)/.test(service), 'update actualiza pais propio');
    check(/service\.update\(id, dto\)/.test(controller), 'PUT delega en service.update');
    check(!/dto\.setId\(id\)/.test(controller), 'PUT no fuerza un ID en un DTO nuevo');
    check(/handleEntityNotFound/.test(handler), 'GlobalExceptionHandler responde 404');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\nUPDATE INHERITANCE TESTS FAILED (${failures.length})`);
    process.exit(1);
  }
  console.log('\nUPDATE INHERITANCE TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
