'use strict';

function snakeCase(str) {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
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

// ── Sanitización de nombres para generar Java válido ────────────────────
// El diagrama muestra el nombre visible ("Order Details"), pero el código
// generado debe usar identificadores Java válidos ("OrderDetails").
// A diferencia de pascalCase/camelCase (que solo tocan la primera letra),
// estas funciones parten el nombre en palabras por separadores, por lo que
// son idempotentes: sanitizar "OrderDetails" devuelve "OrderDetails".

function splitWords(name) {
  if (!name) return [];
  return name
    // Transliteración hispana de la ñ antes de quitar diacríticos:
    // "AñoFiscal" -> "AnioFiscal" -> tabla "anio_fiscal".
    .replace(/ñ/g, 'ni')
    .replace(/Ñ/g, 'Ni')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capWord(w, lowerRest) {
  if (!w) return '';
  const rest = lowerRest ? w.slice(1).toLowerCase() : w.slice(1);
  return w.charAt(0).toUpperCase() + rest;
}

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'record', 'return', 'sealed',
  'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'var', 'void', 'volatile', 'while',
  'yield', 'true', 'false', 'null', '_',
]);

// "Order Details" -> "OrderDetails", "USER_ACCOUNT" -> "UserAccount",
// "producto" -> "Producto", "" -> "Entidad".
// Las palabras TODO-MAYÚSCULAS se normalizan ("USER"->"User") pero se
// conserva la capitalización interna ("OrderDetails" no cambia).
function toJavaClassName(name, fallback = 'Entidad') {
  const words = splitWords(name);
  let identifier = words.length === 0
    ? fallback
    : words
      .map(w => (/^[A-Z0-9_]+$/.test(w) ? capWord(w, true) : capWord(w, false)))
      .join('');

  if (/^[0-9]/.test(identifier)) identifier = `V${identifier}`;
  if (JAVA_KEYWORDS.has(identifier.toLowerCase())) identifier += 'Entity';
  return identifier;
}

function toJavaFieldName(name, fallback = 'Atributo') {
  const cls = toJavaClassName(name, fallback);
  return cls.charAt(0).toLowerCase() + cls.slice(1);
}

function toSnakeCase(name, fallback = 'Entidad') {
  return snakeCase(toJavaClassName(name, fallback));
}

function toPluralRoute(name, fallback = 'Entidad') {
  const snake = toSnakeCase(name, fallback);
  if (splitWords(name).length === 0) return 'unnamed';
  // Evita duplicar la marca de plural cuando el nombre ya termina en s:
  // "Order Details" -> "order_details", no "order_detailss".
  return snake.endsWith('s') ? snake : snake + 's';
}

function isValidJavaIdentifier(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name || '');
}

module.exports = { snakeCase, pascalCase, camelCase, splitWords, capWord, toJavaClassName, toJavaFieldName, toSnakeCase, toPluralRoute, isValidJavaIdentifier };
