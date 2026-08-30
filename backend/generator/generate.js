const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const archiver = require('archiver');
const { getSqlType, getJavaType } = require('./typeMapper');

// ── Handlebars helpers ──────────────────────────────────────────────

Handlebars.registerHelper('pascalCase', (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('camelCase', (str) => {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
});

Handlebars.registerHelper('snakeCase', (str) => {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
});

Handlebars.registerHelper('plural', (str) => {
  if (!str) return '';
  return str.endsWith('s') ? str + 'es' : str + 's';
});

Handlebars.registerHelper('pluralLowerCase', (str) => {
  if (!str) return '';
  const lower = str.toLowerCase();
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) return lower + 'es';
  if (lower.endsWith('ch') || lower.endsWith('sh')) return lower + 'es';
  if (lower.endsWith('y') && !/[aeiou]$/.test(lower.slice(0, -1))) return lower.slice(0, -1) + 'ies';
  return lower + 's';
});

Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('ne', (a, b) => a !== b);

Handlebars.registerHelper('or', (...args) => {
  const opts = args.pop();
  return args.some(Boolean);
});

Handlebars.registerHelper('and', (...args) => {
  const opts = args.pop();
  return args.every(Boolean);
});

Handlebars.registerHelper('firstEntityName', (entities) => {
  if (!entities || entities.length === 0) return '';
  return entities[0].entityName;
});

Handlebars.registerHelper('sqlPkType', (sqlType, isUuid) => {
  if (isUuid) return 'UUID';
  if (sqlType === 'INTEGER') return 'SERIAL';
  if (sqlType === 'BIGINT') return 'BIGSERIAL';
  return sqlType;
});

Handlebars.registerHelper('safeTableName', (name) => {
  const reservedWords = [
    'user', 'group', 'order', 'table', 'column', 'index',
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join',
    'create', 'drop', 'alter', 'primary', 'key', 'foreign', 'references',
    'constraint', 'default', 'values', 'and', 'or', 'not', 'null',
  ];
  return reservedWords.includes(name.toLowerCase()) ? `"${name}"` : name;
});

Handlebars.registerHelper('jsonExample', (entityContext) => {
  const attrs = entityContext.attributes || [];
  const fields = attrs
    .filter(a => !a.isPk)
    .map(a => {
      let value;
      if (a.javaType === 'String') value = `"valor_${a.name}"`;
      else if (a.javaType === 'Integer' || a.javaType === 'Long') value = '1';
      else if (a.javaType === 'BigDecimal') value = '9.99';
      else if (a.javaType === 'Boolean') value = 'true';
      else if (a.javaType === 'LocalDate') value = '"2024-01-01"';
      else value = '"valor"';
      return `"${a.name}": ${value}`;
    })
    .join(', ');
  return `{${fields}}`;
});

// ── Template loading ────────────────────────────────────────────────

const templateDir = path.join(__dirname, 'templates');
const templates = {
  'pom.xml': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'pom.xml.hbs'), 'utf8')),
  'application.properties': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'application.properties.hbs'), 'utf8')),
  'model': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'model.java.hbs'), 'utf8')),
  'repository': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'repository.java.hbs'), 'utf8')),
  'service': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'service.java.hbs'), 'utf8')),
  'controller': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'controller.java.hbs'), 'utf8')),
  'dto': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'dto.java.hbs'), 'utf8')),
  'migration': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'migration.sql.hbs'), 'utf8')),
  'mainApp': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'DemoApplication.java.hbs'), 'utf8')),
  'readme': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'README.md.hbs'), 'utf8')),
  'globalExceptionHandler': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'GlobalExceptionHandler.java.hbs'), 'utf8')),
  'securityConfig': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'SecurityConfig.java.hbs'), 'utf8')),
  'jwtService': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'JwtService.java.hbs'), 'utf8')),
  'jwtFilter': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'JwtAuthenticationFilter.java.hbs'), 'utf8')),
  'authController': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'AuthController.java.hbs'), 'utf8')),
  'userService': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'security', 'UserService.java.hbs'), 'utf8')),
  'aiQueryRequest': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiQueryRequest.java.hbs'), 'utf8')),
  'aiQueryResponse': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiQueryResponse.java.hbs'), 'utf8')),
  'aiQueryService': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiQueryService.java.hbs'), 'utf8')),
  'aiController': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'AiController.java.hbs'), 'utf8')),
};

// ── Core generation ─────────────────────────────────────────────────

const BASE_PACKAGE = 'com.example.demo';
const BASE_PATH = `src/main/java/${BASE_PACKAGE.replace(/\./g, '/')}`;

function resolveCardinality(cardFrom, cardTo) {
  const isFromMany = cardFrom === 'N' || cardFrom === '*' || cardFrom === 'M';
  const isToMany = cardTo === 'N' || cardTo === '*' || cardTo === 'M';
  const isFromOne = cardFrom === '1' || cardFrom === '0..1';
  const isToOne = cardTo === '1' || cardTo === '0..1';

  if (isFromMany && isToMany) return 'manyToMany';
  if (isFromOne && isToOne) return 'oneToOne';
  if (isFromOne && isFromMany) return 'oneToMany';
  if (isFromMany && isToOne) return 'manyToOne';
  // fallback: treat ?..N as many
  if (isFromMany) return 'manyToOne';
  return 'oneToMany';
}

function snakeCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function pascalCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function camelCase(str) {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function buildEntityRelations(entity, allEntities, allRelationships) {
  const entityName = entity.name;
  const results = [];

  for (const rel of allRelationships) {
    const isSource = rel.source.entityName === entityName;
    const isTarget = rel.target.entityName === entityName;
    if (!isSource && !isTarget) continue;

    const otherName = isSource ? rel.target.entityName : rel.source.entityName;
    const otherEntity = allEntities.find(e => e.name === otherName);

    const cardFrom = rel.cardinalityFrom || '1';
    const cardTo = rel.cardinalityTo || '1';

    // Determine JPA type from THIS entity's perspective
    let jpaType;
    if (isSource) {
      jpaType = resolveCardinality(cardFrom, cardTo);
    } else {
      jpaType = resolveCardinality(cardTo, cardFrom);
    }

    const otherNamePascal = pascalCase(otherName);
    const otherNameCamel = camelCase(otherName);
    const thisNameCamel = camelCase(entityName);

    // FK column name (snake_case for SQL)
    const fkColumn = snakeCase(otherName) + '_id';

    // ManyToMany metadata
    const mtmTableName = snakeCase(thisNameCamel) + '_' + snakeCase(otherNameCamel);
    const mtmJoinCol = snakeCase(otherNameCamel) + '_id';
    const mtmInverseJoinCol = snakeCase(thisNameCamel) + '_id';

    // Determine if this side is the OWNING side
    // JPA rule: the side with the @JoinColumn is the owner
    // For OneToOne: the side with FK is owner
    // For OneToMany/ManyToOne: the Many side is owner
    // For ManyToMany: the source side is owner (by convention)
    let isOwner = false;
    let mappedBy = null;

    switch (jpaType) {
      case 'oneToOne':
        // If the other side also has a OneToOne, the one with FK is owner
        // Since we're generating from AST, we make the source the owner
        isOwner = isSource;
        mappedBy = isOwner ? null : otherNameCamel;
        break;
      case 'manyToOne':
        isOwner = true;
        break;
      case 'oneToMany':
        isOwner = false;
        mappedBy = otherNameCamel;
        break;
      case 'manyToMany':
        isOwner = isSource;
        mappedBy = isOwner ? null : otherNameCamel + 'Set';
        break;
    }

    results.push({
      jpaType,
      otherEntity: otherName,
      otherEntityPascal: otherNamePascal,
      otherEntityCamel: otherNameCamel,
      otherEntityCamelPlural: otherNameCamel + 's',
      otherEntityPkType: otherEntity ? (otherEntity.attributes.find(a => a.isPk) ? getJavaType(otherEntity.attributes.find(a => a.isPk).type) : 'Long') : 'Long',
      fkColumn,
      isOwner,
      mappedBy,
      relationshipType: rel.type,
      cardinalityFrom: cardFrom,
      cardinalityTo: cardTo,
      isSource,
      // ManyToMany metadata
      mtmTableName,
      mtmJoinCol,
      mtmInverseJoinCol,
      // Labels for display
      fieldLabel: otherNameCamel,
      fieldLabelPlural: otherNameCamel + 's',
    });
  }

  return results;
}

function buildInheritanceInfo(entity, allEntities, allRelationships) {
  const rel = allRelationships.find(
    r => r.type === 'INHERITANCE' && r.target.entityName === entity.name
  );
  if (!rel) return null;
  return {
    parentEntity: rel.source.entityName,
    parentEntityPascal: pascalCase(rel.source.entityName),
  };
}

function generateProject(ast) {
  return new Promise((resolve, reject) => {
    try {
      const projectName = 'generated-backend';
      const outputRoot = path.join(__dirname, 'output');
      const outputDir = path.join(outputRoot, projectName + '-' + Date.now());
      fs.mkdirSync(outputDir, { recursive: true });

      const entities = ast.entities || [];
      const relationships = ast.relationships || [];

      function writeFile(relativePath, content) {
        const fullPath = path.join(outputDir, relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }

      // ── 1. pom.xml ──
      writeFile('pom.xml', templates['pom.xml']({ projectName }));

      // ── 2. application.properties ──
      writeFile('src/main/resources/application.properties', templates['application.properties']({}));

      // ── 3. Main app ──
      writeFile(`${BASE_PATH}/DemoApplication.java`, templates['mainApp']({}));

      // ── 4. Entity contexts ──
      const entityContexts = [];

      for (const entity of entities) {
        // Primary key
        let primaryKeyAttr = entity.attributes.find(a => a.isPk);
        let primaryKey;
        if (primaryKeyAttr) {
          primaryKey = {
            name: primaryKeyAttr.name,
            namePascal: pascalCase(primaryKeyAttr.name),
            nameCamel: camelCase(primaryKeyAttr.name),
            javaType: getJavaType(primaryKeyAttr.type),
            sqlType: getSqlType(primaryKeyAttr.type),
            isUuid: primaryKeyAttr.type === 'UUID',
          };
        } else {
          primaryKey = {
            name: 'id',
            namePascal: 'Id',
            nameCamel: 'id',
            javaType: 'Long',
            sqlType: 'BIGSERIAL',
            isUuid: false,
          };
        }

        // Relations for this entity
        const relations = buildEntityRelations(entity, entities, relationships);

        // Inheritance info
        const inheritance = buildInheritanceInfo(entity, entities, relationships);

        // Check if this entity is a parent (has children)
        const isParent = relationships.some(
          r => r.type === 'INHERITANCE' && r.source.entityName === entity.name
        );
        const children = relationships
          .filter(r => r.type === 'INHERITANCE' && r.source.entityName === entity.name)
          .map(r => ({
            childEntity: r.target.entityName,
            childEntityPascal: pascalCase(r.target.entityName),
          }));

        const context = {
          entityName: entity.name,
          entityNamePascal: pascalCase(entity.name),
          entityNameCamel: camelCase(entity.name),
          entityNamePlural: entity.name + 's',
          entityNamePluralCamel: camelCase(entity.name) + 's',
          primaryKey,
          attributes: (entity.attributes || []).map(attr => ({
            name: attr.name,
            namePascal: pascalCase(attr.name),
            nameCamel: camelCase(attr.name),
            nameSnake: snakeCase(attr.name),
            javaType: getJavaType(attr.type),
            sqlType: getSqlType(attr.type),
            isPk: attr.isPk || false,
            nullable: attr.nullable !== false,
            unique: attr.unique || false,
            isString: getJavaType(attr.type) === 'String',
          })),
          relations,
          inheritance,
          isParent,
          children,
          // Flags for template conditionals
          hasOwnRelations: relations.length > 0,
          hasManyToOne: relations.some(r => r.jpaType === 'manyToOne'),
          hasOneToMany: relations.some(r => r.jpaType === 'oneToMany'),
          hasManyToMany: relations.some(r => r.jpaType === 'manyToMany'),
          hasOneToOne: relations.some(r => r.jpaType === 'oneToOne'),
          hasInheritance: !!inheritance,
        };

        entityContexts.push(context);

        // Generate model (entity), repository, service, controller, DTO
        writeFile(
          `${BASE_PATH}/model/${context.entityNamePascal}.java`,
          templates['model'](context)
        );
        writeFile(
          `${BASE_PATH}/repository/${context.entityNamePascal}Repository.java`,
          templates['repository'](context)
        );
        writeFile(
          `${BASE_PATH}/service/${context.entityNamePascal}Service.java`,
          templates['service'](context)
        );
        writeFile(
          `${BASE_PATH}/controller/${context.entityNamePascal}Controller.java`,
          templates['controller'](context)
        );
        writeFile(
          `${BASE_PATH}/dto/${context.entityNamePascal}DTO.java`,
          templates['dto'](context)
        );
      }

      // ── 5. Security ──
      writeFile(`${BASE_PATH}/security/SecurityConfig.java`, templates['securityConfig']({}));
      writeFile(`${BASE_PATH}/security/JwtService.java`, templates['jwtService']({}));
      writeFile(`${BASE_PATH}/security/JwtAuthenticationFilter.java`, templates['jwtFilter']({}));
      writeFile(`${BASE_PATH}/security/AuthController.java`, templates['authController']({}));
      writeFile(`${BASE_PATH}/security/AppUserDetailsService.java`, templates['userService']({}));

      // ── 6. AI Local Query ──
      const entityNamesStr = entityContexts.map(e => `"${e.entityNamePascal}"`).join(', ');
      writeFile(`${BASE_PATH}/ai/AiQueryRequest.java`, templates['aiQueryRequest']({}));
      writeFile(`${BASE_PATH}/ai/AiQueryResponse.java`, templates['aiQueryResponse']({}));
      writeFile(`${BASE_PATH}/ai/AiQueryService.java`, templates['aiQueryService']({ entityNames: entityNamesStr }));
      writeFile(`${BASE_PATH}/ai/AiController.java`, templates['aiController']({}));

      // ── 7. Global exception handler ──
      writeFile(`${BASE_PATH}/config/GlobalExceptionHandler.java`, templates['globalExceptionHandler']({}));

      // ── 7. README ──
      writeFile('README.md', templates['readme']({
        projectName,
        entities: entityContexts,
      }));

      // ── 8. Flyway migration ──
      writeFile(
        'src/main/resources/db/migration/V1__init.sql',
        templates['migration']({ entities: entityContexts })
      );

      // ── 9. ZIP ──
      const zipPath = path.join(outputRoot, projectName + '.zip');
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(outputDir, false);
      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateProject };
