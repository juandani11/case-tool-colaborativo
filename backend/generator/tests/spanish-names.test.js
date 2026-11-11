'use strict';

// Verifica que el generador respete el idioma del AST: Libro/titulo deben
// llegar a Java como Libro/titulo, sin traducciones automáticas.
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
        name: 'Libro',
        attributes: [attr('a1', 'id', 'UUID', true), attr('a2', 'titulo', 'String', false)],
      },
      {
        id: 'e2',
        name: 'Autor',
        attributes: [attr('a3', 'id', 'UUID', true), attr('a4', 'nombre', 'String', false)],
      },
    ],
    relationships: [
      {
        id: 'r1',
        source: { id: 'e1', entityName: 'Libro' },
        target: { id: 'e2', entityName: 'Autor' },
        fromEntity: 'Libro',
        toEntity: 'Autor',
        type: 'MANY_TO_ONE',
        cardinalityFrom: '*',
        cardinalityTo: '1',
      },
    ],
  };

  const zipPath = await generateProject(ast);
  const outDir = path.dirname(zipPath);
  const root = path.join(outDir, 'project');
  const javaRoot = path.join(root, 'src', 'main', 'java', 'com', 'example', 'demo');

  try {
    const modelDir = path.join(javaRoot, 'model');
    const libro = fs.readFileSync(path.join(modelDir, 'Libro.java'), 'utf8');
    const autor = fs.readFileSync(path.join(modelDir, 'Autor.java'), 'utf8');
    const controller = fs.readFileSync(path.join(javaRoot, 'controller', 'LibroController.java'), 'utf8');
    const dto = fs.readFileSync(path.join(javaRoot, 'dto', 'LibroDTO.java'), 'utf8');

    check(fs.existsSync(path.join(modelDir, 'Libro.java')), 'Existe Libro.java');
    check(fs.existsSync(path.join(modelDir, 'Autor.java')), 'Existe Autor.java');
    check(/class Libro\b/.test(libro), 'Libro conserva su nombre');
    check(/private String titulo;/.test(libro), 'Campo titulo conserva su nombre');
    check(/getTitulo\(\)/.test(libro), 'Getter getTitulo()');
    check(/setTitulo\(/.test(libro), 'Setter setTitulo()');
    check(!/getTitle\(\)/.test(libro), 'No traduce titulo a title');
    check(/class Autor\b/.test(autor), 'Autor conserva su nombre');
    check(/class LibroController\b/.test(controller), 'LibroController conserva su nombre');
    check(/\/api\/libros/.test(controller), 'Ruta derivada del nombre español');
    check(/getTitulo\(\)/.test(dto), 'DTO usa getTitulo()');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\nSPANISH NAME TESTS FAILED (${failures.length})`);
    process.exit(1);
  }
  console.log('\nSPANISH NAME TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
