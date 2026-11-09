'use strict';

// Test de herencia JPA: Account (raiz) <- SavingAccount / CurrentAccount.
// Uso: node backend/generator/tests/inheritance.test.js
// Verifica que:
//  1. El padre use @Inheritance(JOINED) y NO @OneToOne hacia los hijos.
//  2. Los hijos usen extends, @PrimaryKeyJoinColumn y NO @Id propio.
//  3. La PK natural String del padre no lleve @GeneratedValue.
//  4. El ZIP incluya clean.sql y application.properties con DDL/logging.

const fs = require('fs');
const path = require('path');
const { generateProject } = require('../generate');

const MODEL_PKG = ['src', 'main', 'java', 'com', 'example', 'demo'];

function attr(id, name, type, isPk) {
  return {
    id,
    name,
    type,
    isPk: !!isPk,
    nullable: !isPk,
    unique: !!isPk,
  };
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
        name: 'Account',
        attributes: [
          attr('a1', 'number', 'String', true),
          attr('a2', 'balance', 'BigDecimal', false),
        ],
      },
      {
        id: 'e2',
        name: 'Saving Account',
        attributes: [attr('a3', 'interestRate', 'BigDecimal', false)],
      },
      {
        id: 'e3',
        name: 'Current Account',
        attributes: [attr('a4', 'overdraftLimit', 'BigDecimal', false)],
      },
    ],
    relationships: [
      {
        id: 'r1',
        source: { id: 'e2', entityName: 'Saving Account' },
        target: { id: 'e1', entityName: 'Account' },
        fromEntity: 'Saving Account',
        toEntity: 'Account',
        type: 'INHERITANCE',
      },
      {
        id: 'r2',
        source: { id: 'e3', entityName: 'Current Account' },
        target: { id: 'e1', entityName: 'Account' },
        fromEntity: 'Current Account',
        toEntity: 'Account',
        type: 'INHERITANCE',
      },
    ],
  };

  const zipPath = await generateProject(ast);
  const outDir = path.dirname(zipPath);
  const root = path.join(outDir, 'project');

  try {
    const modelDir = path.join(root, ...MODEL_PKG, 'model');
    const parent = fs.readFileSync(path.join(modelDir, 'Account.java'), 'utf8');
    const saving = fs.readFileSync(path.join(modelDir, 'SavingAccount.java'), 'utf8');
    const current = fs.readFileSync(path.join(modelDir, 'CurrentAccount.java'), 'utf8');
    const props = fs.readFileSync(
      path.join(root, 'src', 'main', 'resources', 'application.properties'),
      'utf8'
    );

    check(/@Inheritance\(strategy = InheritanceType\.JOINED\)/.test(parent), 'Account: @Inheritance(JOINED)');
    check(!/extends\s+\w+/.test(parent), 'Account: no extiende de otra entidad');
    check(!/@OneToOne/.test(parent), 'Account: sin @OneToOne hacia hijos');
    check(!/@GeneratedValue/.test(parent), 'Account: PK String natural sin @GeneratedValue');
    check(/@Id/.test(parent), 'Account: conserva @Id');

    for (const [label, src] of [['SavingAccount', saving], ['CurrentAccount', current]]) {
      check(new RegExp(`extends Account`).test(src), `${label}: extends Account`);
      check(
        /@PrimaryKeyJoinColumn\(name = "account_number"\)/.test(src),
        `${label}: @PrimaryKeyJoinColumn(account_number)`
      );
      check(!/@Inheritance/.test(src), `${label}: sin @Inheritance propio`);
      check(!/@Id/.test(src), `${label}: sin PK/@Id propio`);
      check(!/@OneToOne/.test(src), `${label}: sin @OneToOne hacia Account`);
    }

    check(
      /spring\.jpa\.hibernate\.ddl-auto=update/.test(props),
      'application.properties: ddl-auto=update'
    );
    check(
      /spring\.jpa\.properties\.hibernate\.auto_quote_keyword=true/.test(props),
      'application.properties: auto_quote_keyword=true'
    );
    check(
      /logging\.level\.org\.hibernate\.tool\.schema=DEBUG/.test(props),
      'application.properties: logging DDL activo'
    );
    check(fs.existsSync(path.join(root, 'clean.sql')), 'ZIP: clean.sql presente');
    check(
      /DROP SCHEMA public CASCADE;/.test(fs.readFileSync(path.join(root, 'clean.sql'), 'utf8')),
      'clean.sql: DROP SCHEMA public CASCADE'
    );
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\nINHERITANCE TESTS FAILED (${failures.length})`);
    process.exit(1);
  }
  console.log('\nINHERITANCE TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
