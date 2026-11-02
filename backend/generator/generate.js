'use strict';

const fs = require('fs');
const path = require('path');
const { createZip } = require('./packager');
const { templates } = require('./templateEngine');
const { getSqlType, getJavaType } = require('./typeMapper');
const {
  snakeCase, pascalCase, camelCase, toJavaClassName, toJavaFieldName, toSnakeCase, toPluralRoute, isValidJavaIdentifier,
} = require('./naming');
const {
  resolveCardinality, isManySide, relFromName, relToName, isManyToManyRel, expandManyToMany, generateConfigJson,
} = require('./expander');
const {
  sanitizeEntities, normalizeRelationshipEndpoints, buildEntityLookup, buildEntityRelations,
  buildInheritanceInfo, buildModelAccessors, buildDtoAccessors, buildSqlColumns,
} = require('./contextBuilder');

const BASE_PACKAGE = 'com.example.demo';
const BASE_PATH = `src/main/java/${BASE_PACKAGE.replace(/\./g, '/')}`;

function generateProject(ast) {
  return new Promise((resolve, reject) => {
    let workDir = null;
    try {
      const projectName = 'generated-backend';
      const outputRoot = path.join(__dirname, 'output');
      fs.mkdirSync(outputRoot, { recursive: true });
      workDir = fs.mkdtempSync(path.join(outputRoot, 'generated-backend-'));
      const outputDir = path.join(workDir, 'project');
      fs.mkdirSync(outputDir, { recursive: true });

      // ── 0. Sanitizar nombres: el diagrama muestra "Order Details" pero el
      // código generado debe usar identificadores Java válidos ("OrderDetails").
      const sanitizedEntities = sanitizeEntities(ast.entities || []);
      const lookup = buildEntityLookup(sanitizedEntities);
      const normalizedRelationships = (ast.relationships || []).map(
        rel => normalizeRelationshipEndpoints(rel, lookup)
      );

      // Expansión * a *: cada MANY_TO_MANY genera una entidad intermedia
      // explícita (UUID + 2x @ManyToOne) y NUNCA @ManyToMany.
      const takenNames = new Set(sanitizedEntities.map(e => e.name));
      const expanded = expandManyToMany(sanitizedEntities, normalizedRelationships, takenNames);
      const entities = expanded.allEntities;
      const relationships = expanded.allRelationships;

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
            name: toJavaFieldName(primaryKeyAttr.name, 'Atributo'),
            namePascal: toJavaClassName(primaryKeyAttr.name, 'Atributo'),
            nameCamel: toJavaFieldName(primaryKeyAttr.name, 'Atributo'),
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
          r => r.type === 'INHERITANCE' && relFromName(r, entities) === entity.name
        );
        const children = relationships
          .filter(r => r.type === 'INHERITANCE' && relFromName(r, entities) === entity.name)
          .map(r => ({
            childEntity: relToName(r, entities),
            childEntityPascal: toJavaClassName(relToName(r, entities)),
          }));

        // ¿Es una entidad intermedia de una relación * a *?
        const intermediateInfo = expanded.intermediates.find(i => i.name === entity.name) || null;

        // Reconciliación de FK: si un atributo del diagrama mapea la misma
        // columna que el @JoinColumn de una relación @ManyToOne/@OneToOne
        // (ej. atributo "customerId" + relación hacia Customer), la fuente
        // de verdad es la relación: el atributo NO se renderiza como columna
        // propia (evita "Column duplicated in mapping" de Hibernate).
        const fkColumns = new Set(
          relations
            .filter(r => r.jpaType === 'manyToOne' || r.jpaType === 'oneToOne')
            .map(r => r.fkColumn)
        );
        const mappedAttributes = (entity.attributes || []).map(attr => {
          const nameSnake = toSnakeCase(attr.name, 'Atributo');
          const isFkCollision = !attr.isPk && fkColumns.has(nameSnake);
          return {
            name: toJavaFieldName(attr.name, 'Atributo'),
            originalName: attr.name,
            namePascal: toJavaClassName(attr.name, 'Atributo'),
            nameCamel: toJavaFieldName(attr.name, 'Atributo'),
            nameSnake,
            javaType: getJavaType(attr.type),
            sqlType: getSqlType(attr.type),
            isPk: attr.isPk || false,
            nullable: attr.nullable !== false,
            unique: attr.unique || false,
            isString: getJavaType(attr.type) === 'String',
            isFkCollision,
          };
        });

        const context = {
          entityName: entity.name,
          originalName: entity.originalName || entity.name,
          tableName: entity.tableName || snakeCase(entity.name),
          route: entity.route || `${snakeCase(entity.name)}s`,
          entityNamePascal: pascalCase(entity.name),
          entityNameCamel: camelCase(entity.name),
          entityNamePlural: entity.name + 's',
          entityNamePluralCamel: camelCase(entity.name) + 's',
          isIntermediate: !!intermediateInfo,
          intermediateTable: intermediateInfo ? intermediateInfo.tableName : null,
          fromEntityPascal: intermediateInfo ? pascalCase(intermediateInfo.fromEntity) : null,
          fromEntityLower: intermediateInfo ? intermediateInfo.fromEntityLower : null,
          fromEntitySnake: intermediateInfo ? intermediateInfo.fromEntitySnake : null,
          toEntityPascal: intermediateInfo ? pascalCase(intermediateInfo.toEntity) : null,
          toEntityLower: intermediateInfo ? intermediateInfo.toEntityLower : null,
          toEntitySnake: intermediateInfo ? intermediateInfo.toEntitySnake : null,
          primaryKey,
          attributes: mappedAttributes,
          // Campos para getters/setters explícitos del modelo:
          // PK + atributos (sin colisiones FK) + campos de relaciones.
          accessors: buildModelAccessors(primaryKey, mappedAttributes, relations),
          // Campos para getters/setters explícitos del DTO (sin duplicados:
          // si un atributo ya se llama como el FK auto-generado, se reutiliza).
          dtoAccessors: buildDtoAccessors(primaryKey, mappedAttributes, relations),
          relations,
          sqlColumns: buildSqlColumns(mappedAttributes, relations, entity.tableName || snakeCase(entity.name)),
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

        // Generate model (entity), repository, service, controller, DTO.
        // Las intermedias usan su plantilla explícita (UUID + 2x @ManyToOne);
        // repositorio, servicio, controlador y DTO son los genéricos.
        writeFile(
          `${BASE_PATH}/model/${context.entityNamePascal}.java`,
          templates[context.isIntermediate ? 'entityIntermediate' : 'model'](context)
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
      writeFile(`${BASE_PATH}/ai/IntentClassifier.java`, templates['intentClassifier']({}));
      writeFile(`${BASE_PATH}/ai/AiQueryService.java`, templates['aiQueryService']({ entityNames: entityNamesStr }));
      writeFile(`${BASE_PATH}/ai/AiController.java`, templates['aiController']({}));

      // ── 7. Global exception handler ──
      writeFile(`${BASE_PATH}/config/GlobalExceptionHandler.java`, templates['globalExceptionHandler']({}));

      // ── 7. README ──
      writeFile('README.md', templates['readme']({
        projectName,
        entities: entityContexts,
        firstRoute: entityContexts.length > 0 ? entityContexts[0].route : '',
      }));

      // ── 8. Flyway migration ──
      writeFile(
        'src/main/resources/db/migration/V1__init.sql',
        templates['migration']({ entities: entityContexts })
      );

      // ── 8b. config.json para la app Flutter ──
      // Incluye las entidades intermedias de relaciones * a * como una más.
      writeFile(
        'config.json',
        JSON.stringify(generateConfigJson(entityContexts), null, 2)
      );

      // ── 9. ZIP ──
      createZip({ outputDir, workDir, projectName }).then(resolve).catch(reject);
    } catch (error) {
      if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
      reject(error);
    }
  });
}

module.exports = {
  generateProject,
  expandManyToMany,
  generateConfigJson,
  buildEntityRelations,
  sanitizeEntities,
  normalizeRelationshipEndpoints,
  buildEntityLookup,
  toJavaClassName,
  toJavaFieldName,
  toSnakeCase,
  toPluralRoute,
  isValidJavaIdentifier,
  isManyToManyRel,
  isManySide,
  resolveCardinality,
};
