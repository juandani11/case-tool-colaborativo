const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const archiver = require('archiver');
const { getSqlType, getJavaType } = require('./typeMapper');

// Registrar helpers de Handlebars
Handlebars.registerHelper('pascalCase', (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('camelCase', (str) => {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
});

Handlebars.registerHelper('plural', (str) => {
  if (!str) return '';
  return str.endsWith('s') ? str + 'es' : str + 's';
});

Handlebars.registerHelper('pluralLowerCase', (str) => {
  if (!str) return '';
  let plural;
  if (str.endsWith('s')) plural = str + 'es';
  else if (str.endsWith('y')) plural = str.slice(0, -1) + 'ies';
  else plural = str + 's';
  return plural.toLowerCase();
});

Handlebars.registerHelper('jsonExample', (entityContext) => {
  const attrs = entityContext.attributes || [];
  const fields = attrs
    .filter(a => !a.isPk)
    .map(a => {
      let value;
      if (a.javaType === 'String') value = `\"valor_${a.name}\"`;
      else if (a.javaType === 'Integer' || a.javaType === 'Long') value = '1';
      else if (a.javaType === 'BigDecimal') value = '9.99';
      else if (a.javaType === 'Boolean') value = 'true';
      else if (a.javaType === 'LocalDate') value = '\"2024-01-01\"';
      else if (a.javaType === 'UUID') value = '\"00000000-0000-0000-0000-000000000000\"';
      else value = '\"valor\"';
      return `\"${a.name}\": ${value}`;
    })
    .join(', ');
  return `{${fields}}`;
});

Handlebars.registerHelper('firstEntityName', (entities) => {
  if (!entities || entities.length === 0) return '';
  return entities[0].entityName;
});

Handlebars.registerHelper('eq', (a, b) => a === b);

// Helper para tipos SQL de clave primaria
Handlebars.registerHelper('sqlPkType', (sqlType, isUuid) => {
  if (isUuid) return 'UUID';
  if (sqlType === 'INTEGER') return 'SERIAL';
  if (sqlType === 'BIGINT') return 'BIGSERIAL';
  return sqlType;
});

// Helper para nombres de tabla seguros (comillas dobles para PostgreSQL)
Handlebars.registerHelper('safeTableName', (name) => {
  const reservedWords = [
    'user', 'group', 'order', 'table', 'column', 'index',
    'select', 'insert', 'update', 'delete', 'from', 'where', 'join',
    'create', 'drop', 'alter', 'primary', 'key', 'foreign', 'references',
    'constraint', 'default', 'values', 'and', 'or', 'not', 'null',
    'true', 'false', 'like', 'between', 'case', 'when', 'then', 'else',
    'end', 'as', 'into', 'on', 'off', 'with', 'without'
  ];

  const lowerName = name.toLowerCase();
  if (reservedWords.includes(lowerName)) {
    return `"${name}"`;
  }
  return name;
});

// Helper para determinar si una relación es ManyToMany
Handlebars.registerHelper('isManyToMany', (cardFrom, cardTo) => {
  return (cardFrom === 'N' || cardFrom === '*') && (cardTo === 'N' || cardTo === '*');
});

// Helper para determinar si es OneToMany
Handlebars.registerHelper('isOneToMany', (cardFrom, cardTo) => {
  return cardFrom === '1' && (cardTo === 'N' || cardTo === '*');
});

// Helper para determinar si es ManyToOne
Handlebars.registerHelper('isManyToOne', (cardFrom, cardTo) => {
  return (cardFrom === 'N' || cardFrom === '*') && cardTo === '1';
});

// Helper para determinar si es OneToOne
Handlebars.registerHelper('isOneToOne', (cardFrom, cardTo) => {
  return cardFrom === '1' && cardTo === '1';
});

// Helper para obtener el lado propietario
Handlebars.registerHelper('isOwnerSide', (cardFrom) => {
  return cardFrom === '1';
});

// Helper para el nombre del mappedBy (lado inverso)
Handlebars.registerHelper('mappedByName', (entityName) => {
  return entityName + 'Entities';
});

// Cargar plantillas (puede ser dinámico, como ya tenías)
const templateDir = path.join(__dirname, 'templates');
const templates = {
  'pom.xml': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'pom.xml.hbs'), 'utf8')),
  'application.properties': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'application.properties.hbs'), 'utf8')),
  'entity': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'entity.java.hbs'), 'utf8')),
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
};

function generateProject(ast) {
  return new Promise((resolve, reject) => {
    try {
      const projectName = 'generated-backend';
      const outputRoot = path.join(__dirname, 'output');
      const outputDir = path.join(outputRoot, projectName + '-' + Date.now());
      fs.mkdirSync(outputDir, { recursive: true });

      // 1. pom.xml
      writeFile('pom.xml', templates['pom.xml']({ projectName }));

      // 2. application.properties
      writeFile('src/main/resources/application.properties', templates['application.properties']({}));

      // 3. Clase principal
      writeFile('src/main/java/com/example/demo/DemoApplication.java', templates['mainApp']({}));

      // 4. Entidades, repositorios, servicios, controladores, DTOs
      const entities = ast.entities || [];
      const entityContexts = [];

      // Construir un mapa de relaciones por entidad
      const relationshipsMap = {};
      const relationships = ast.relationships || [];
      relationships.forEach(rel => {
        const key = rel.source.entityName + '-' + rel.target.entityName;
        if (!relationshipsMap[key]) {
          relationshipsMap[key] = [];
        }
        relationshipsMap[key].push(rel);
      });

      for (const entity of entities) {
        let primaryKeyAttr = entity.attributes.find(a => a.isPk);
        let primaryKey;
        if (primaryKeyAttr) {
          primaryKey = {
            name: primaryKeyAttr.name,
            namePascal: Handlebars.helpers.pascalCase(primaryKeyAttr.name),
            nameCamel: Handlebars.helpers.camelCase(primaryKeyAttr.name),
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

        // Obtener relaciones de esta entidad (como source y como target)
        const relsAsSource = (relationshipsMap[entity.name] || []).filter(r => r.source.entityName === entity.name);
        const relsAsTarget = (relationshipsMap[entity.name + '-'] || []).filter(r => r.target.entityName === entity.name);
        // Note: the above assumes a specific format; let's adjust

        // Better: collect all relationships where entity is source or target
        const allRels = relationships.filter(r => r.source.entityName === entity.name || r.target.entityName === entity.name);

        const relations = allRels.map(rel => {
          const isSource = rel.source.entityName === entity.name;
          const otherEntity = isSource ? rel.target.entityName : rel.source.entityName;
          const otherIsSource = rel.source.entityName === otherEntity;
          const otherEntityIsOther = !otherIsSource;

          let jpaType = 'none';
          let mappedBy = null;

          // Determinar tipo JPA basado en cardinalidades
          const cardFrom = rel.cardinalityFrom;
          const cardTo = rel.cardinalityTo;

          if (cardFrom === '1' && cardTo === '1') {
            jpaType = 'oneToOne';
          } else if ((cardFrom === 'N' || cardFrom === '*') && (cardTo === 'N' || cardTo === '*')) {
            jpaType = 'manyToMany';
          } else if (cardFrom === '1' && (cardTo === 'N' || cardTo === '*')) {
            jpaType = 'oneToMany';
          } else if ((cardFrom === 'N' || cardFrom === '*') && cardTo === '1') {
            jpaType = 'manyToOne';
          }

          // Determinar mappedBy para el lado no propietario
          if (jpaType === 'oneToMany') {
            // El lado manyToOne tiene mappedBy pointing to the oneToMany side
            mappedBy = isSource ? null : rel.source.entityName + 'Entities';
          } else if (jpaType === 'manyToOne') {
            mappedBy = isSource ? rel.target.entityName + 'Entities' : null;
          }

          return {
            jpaType,
            mappedBy,
            otherEntity,
            otherEntityPascal: Handlebars.helpers.pascalCase(otherEntity),
            otherEntityCamel: Handlebars.helpers.camelCase(otherEntity),
            relationshipType: rel.type,
            cardinalityFrom: rel.cardinalityFrom,
            cardinalityTo: rel.cardinalityTo,
            isSource: isSource,
            relationshipLabel: rel.label,
          };
        });

        const context = {
          entityName: entity.name,
          entityNamePascal: Handlebars.helpers.pascalCase(entity.name),
          entityNameCamel: Handlebars.helpers.camelCase(entity.name),
          entityNamePlural: Handlebars.helpers.plural(entity.name),
          primaryKey,
          attributes: entity.attributes.map(attr => ({
            name: attr.name,
            namePascal: Handlebars.helpers.pascalCase(attr.name),
            nameCamel: Handlebars.helpers.camelCase(attr.name),
            javaType: getJavaType(attr.type),
            sqlType: getSqlType(attr.type),
            isPk: attr.isPk || false,
            nullable: attr.nullable !== false,
            unique: attr.unique || false,
            isString: getJavaType(attr.type) === 'String',
          })),
          relations: relations,  // NUEVO: información de relaciones para la plantilla
        };
        entityContexts.push(context);

        writeFile(`src/main/java/com/example/demo/entity/${context.entityNamePascal}.java`, templates['entity'](context));
        writeFile(`src/main/java/com/example/demo/repository/${context.entityNamePascal}Repository.java`, templates['repository'](context));
        writeFile(`src/main/java/com/example/demo/service/${context.entityNamePascal}Service.java`, templates['service'](context));
        writeFile(`src/main/java/com/example/demo/controller/${context.entityNamePascal}Controller.java`, templates['controller'](context));
        writeFile(`src/main/java/com/example/demo/dto/${context.entityNamePascal}DTO.java`, templates['dto'](context));
      }

      // 5. Seguridad
      writeFile('src/main/java/com/example/demo/security/SecurityConfig.java', templates['securityConfig']({}));
      writeFile('src/main/java/com/example/demo/security/JwtService.java', templates['jwtService']({}));
      writeFile('src/main/java/com/example/demo/security/JwtAuthenticationFilter.java', templates['jwtFilter']({}));
      writeFile('src/main/java/com/example/demo/security/AuthController.java', templates['authController']({}));
      writeFile('src/main/java/com/example/demo/security/UserService.java', templates['userService']({}));

      // 5b. Manejo global de excepciones
      writeFile('src/main/java/com/example/demo/config/GlobalExceptionHandler.java', templates['globalExceptionHandler']({}));

      // 5c. README.md
      writeFile('README.md', templates['readme']({
        projectName,
        entities: entityContexts
      }));

      // 6. Migraciones Flyway
      writeFile('src/main/resources/db/migration/V1__init.sql', templates['migration']({ entities: entityContexts }));

      // 7. Empaquetar ZIP
      const zipPath = path.join(outputRoot, projectName + '.zip');
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(outputDir, false);
      archive.finalize();

      function writeFile(relativePath, content) {
        const fullPath = path.join(outputDir, relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateProject };