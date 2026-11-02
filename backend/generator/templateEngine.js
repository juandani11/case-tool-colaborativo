'use strict';

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

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
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
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

Handlebars.registerHelper('capitalize', (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

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
  'entityIntermediate': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'entity-intermediate.java.hbs'), 'utf8')),
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
  'intentClassifier': Handlebars.compile(fs.readFileSync(path.join(templateDir, 'ai', 'IntentClassifier.java.hbs'), 'utf8')),
};

function renderTemplate(name, context) {
  const template = templates[name];
  if (!template) throw new Error(`Plantilla desconocida: ${name}`);
  return template(context);
}

module.exports = { templates, renderTemplate };
