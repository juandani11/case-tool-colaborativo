export function genId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getAttr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

export function getLocalName(el: Element): string {
  const tag = el.tagName;
  const idx = tag.indexOf(':');
  return idx >= 0 ? tag.substring(idx + 1) : tag;
}

export function resolveTypeName(
  typeEl: Element | null,
  dataTypeMap: Map<string, string>
): string {
  if (!typeEl) return 'String';
  const idref = typeEl.getAttribute('xmi:idref') || typeEl.textContent || '';
  if (dataTypeMap.has(idref)) return dataTypeMap.get(idref)!;
  if (idref.includes('int')) return 'Integer';
  if (idref.includes('String')) return 'String';
  if (idref.includes('Date')) return 'Date';
  if (idref.includes('UUID')) return 'UUID';
  if (idref.includes('BigDecimal') || idref.includes('decimal')) return 'BigDecimal';
  if (idref.includes('Boolean') || idref.includes('bool')) return 'Boolean';
  return idref || 'String';
}

export function getMultiplicity(endEl: Element): { lower: string; upper: string } {
  const lowerEl = endEl.querySelector(':scope > lowerValue');
  const upperEl = endEl.querySelector(':scope > upperValue');
  const lower = lowerEl?.getAttribute('value') || '1';
  const upper = upperEl?.getAttribute('value') || '1';
  return { lower, upper };
}

export function multiplicityToString(lower: string, upper: string): string {
  if (lower === upper) return lower;
  if (upper === '*' || upper === '-1') return `${lower}..*`;
  if (lower === '1' && upper === '1') return '1';
  if (lower === '0' && upper === '1') return '0..1';
  return `${lower}..${upper}`;
}

export function resolveVisibility(eaVisibility: string | undefined): 'public' | 'private' | 'protected' {
  if (!eaVisibility) return 'public';
  const v = eaVisibility.toLowerCase();
  if (v === 'private' || v === 'priv') return 'private';
  if (v === 'protected' || v === 'protect') return 'protected';
  return 'public';
}

export function resolveAttributeType(
  propertiesEl: Element | null,
  typeChildEl: Element | null,
  dataTypeMap: Map<string, string>
): string {
  if (typeChildEl) {
    return resolveTypeName(typeChildEl, dataTypeMap);
  }
  if (propertiesEl) {
    const t = propertiesEl.getAttribute('type');
    if (t) {
      if (dataTypeMap.has(t)) return dataTypeMap.get(t)!;
      return t;
    }
  }
  return 'String';
}
