import { Node, Edge } from 'reactflow';
import { EntityNodeData, RelationshipData } from '../types/diagram';

interface ImportHooks {
  addNode: (node: Node<EntityNodeData>) => void;
  addEdge: (edge: Edge<RelationshipData>) => void;
}

function genId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getAttr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

function getLocalName(el: Element): string {
  const tag = el.tagName;
  const idx = tag.indexOf(':');
  return idx >= 0 ? tag.substring(idx + 1) : tag;
}

function resolveTypeName(
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

function getMultiplicity(endEl: Element): { lower: string; upper: string } {
  const lowerEl = endEl.querySelector(':scope > lowerValue');
  const upperEl = endEl.querySelector(':scope > upperValue');
  const lower = lowerEl?.getAttribute('value') || '1';
  const upper = upperEl?.getAttribute('value') || '1';
  return { lower, upper };
}

function multiplicityToString(lower: string, upper: string): string {
  if (lower === upper) return lower;
  if (upper === '*' || upper === '-1') return `${lower}..*`;
  if (lower === '1' && upper === '1') return '1';
  if (lower === '0' && upper === '1') return '0..1';
  return `${lower}..${upper}`;
}

function resolveVisibility(eaVisibility: string | undefined): 'public' | 'private' | 'protected' {
  if (!eaVisibility) return 'public';
  const v = eaVisibility.toLowerCase();
  if (v === 'private' || v === 'priv') return 'private';
  if (v === 'protected' || v === 'protect') return 'protected';
  return 'public';
}

function resolveAttributeType(
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

export function importFromXmi(file: File, hooks: ImportHooks): Promise<void> {
  return file.text().then((text) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      alert('Error: El archivo no es un XML válido.');
      throw new Error('Invalid XML');
    }

    // ─── 1. Collect ALL elements recursively (EA nests packagedElements) ───
    const allElements = doc.querySelectorAll('*');
    const allPe: Element[] = [];
    allElements.forEach((el) => {
      if (getLocalName(el) === 'packagedElement') allPe.push(el);
    });

    // ─── 2. Build dataType map: xmi:id -> name ───
    const dataTypeMap = new Map<string, string>();
    allPe.forEach((pe) => {
      const type = getAttr(pe, 'xmi:type');
      if (type === 'uml:DataType' || type === 'uml:PrimitiveType') {
        const id = getAttr(pe, 'xmi:id');
        const name = getAttr(pe, 'name');
        if (id && name) dataTypeMap.set(id, name);
      }
    });

    console.log('[XMI Import] DataTypes encontrados:', dataTypeMap.size);

    // ─── 3. Map EA element IDs to internal IDs ───
    const eaIdToInternal = new Map<string, string>();
    const nodes: Node<EntityNodeData>[] = [];
    const edges: Edge<RelationshipData>[] = [];

    // ─── 4. Find classes and interfaces (recursive) ───
    let nodeIndex = 0;
    allPe.forEach((pe) => {
      const xmiType = getAttr(pe, 'xmi:type');
      if (xmiType !== 'uml:Class' && xmiType !== 'uml:Interface') return;

      const name = getAttr(pe, 'name');
      if (!name) return;

      const internalId = genId();
      const eaId = getAttr(pe, 'xmi:id');
      if (eaId) eaIdToInternal.set(eaId, internalId);

      // Attributes (only direct children ownedAttribute without association)
      const attributes: EntityNodeData['attributes'] = [];
      pe.querySelectorAll(':scope > ownedAttribute').forEach((attrEl) => {
        if (attrEl.getAttribute('association')) return;
        const attrName = getAttr(attrEl, 'name');
        if (!attrName) return;

        const propertiesEl = attrEl.querySelector(':scope > properties');
        const typeChildEl = attrEl.querySelector(':scope > type');
        const attrType = resolveAttributeType(propertiesEl, typeChildEl, dataTypeMap);

        const isPk = attrName.toLowerCase() === 'id';
        const mult = getMultiplicity(attrEl);
        const nullable = mult.lower === '0';

        attributes.push({
          id: genId(),
          name: attrName,
          type: attrType as any,
          isPk,
          nullable,
          unique: false,
        });
      });

      // Methods
      const methods: EntityNodeData['methods'] = [];
      pe.querySelectorAll(':scope > ownedOperation').forEach((opEl) => {
        const opName = getAttr(opEl, 'name');
        if (!opName) return;

        const opVisibility = getAttr(opEl, 'visibility') || 'public';
        const parameters: { name: string; type: string }[] = [];
        let returnType = 'void';

        opEl.querySelectorAll(':scope > ownedParameter').forEach((paramEl) => {
          const paramName = getAttr(paramEl, 'name') || '';
          const direction = getAttr(paramEl, 'direction');
          const paramTypeEl = paramEl.querySelector(':scope > type');
          const paramType = resolveTypeName(paramTypeEl, dataTypeMap);

          if (direction === 'return') {
            returnType = paramType;
          } else if (paramName) {
            parameters.push({ name: paramName, type: paramType });
          }
        });

        methods.push({
          id: genId(),
          name: opName,
          returnType,
          parameters,
          visibility: resolveVisibility(opVisibility),
        });
      });

      const isInterface = xmiType === 'uml:Interface';
      const col = nodeIndex % 4;
      const row = Math.floor(nodeIndex / 4);

      nodes.push({
        id: internalId,
        type: 'entity',
        position: { x: 100 + col * 280, y: 100 + row * 220 },
        data: {
          label: name,
          stereotype: isInterface ? 'interface' : 'class',
          attributes,
          methods,
        },
      });

      nodeIndex++;
    });

    console.log('[XMI Import] Clases/Interfaces encontradas:', nodes.length);

    // ─── 5. Build maps for fast lookup ───
    //    Map: ownedAttribute xmi:id -> Element (for memberEnd resolution)
    const ownedAttrById = new Map<string, Element>();
    allPe.forEach((pe) => {
      pe.querySelectorAll(':scope > ownedAttribute').forEach((attrEl) => {
        const id = attrEl.getAttribute('xmi:id');
        if (id) ownedAttrById.set(id, attrEl);
      });
    });

    //    Map: associationEaId -> [{ eaAttrId, typeId, lower, upper }]
    //    EA puts one end of an association inside the class as an
    //    <ownedAttribute association="..."> element.
    const assocAttrsByAssocId = new Map<string, Array<{
      eaAttrId: string;
      typeId: string;
      lower: string;
      upper: string;
    }>>();

    allPe.forEach((pe) => {
      const xmiType = getAttr(pe, 'xmi:type');
      if (xmiType !== 'uml:Class' && xmiType !== 'uml:Interface') return;

      pe.querySelectorAll(':scope > ownedAttribute').forEach((attrEl) => {
        const assocRef = attrEl.getAttribute('association');
        if (!assocRef) return;

        const typeEl = attrEl.querySelector(':scope > type');
        const typeId = typeEl?.getAttribute('xmi:idref') || '';
        const mult = getMultiplicity(attrEl);
        const eaAttrId = getAttr(attrEl, 'xmi:id') || '';

        if (!assocAttrsByAssocId.has(assocRef)) {
          assocAttrsByAssocId.set(assocRef, []);
        }
        assocAttrsByAssocId.get(assocRef)!.push({
          eaAttrId,
          typeId,
          lower: mult.lower,
          upper: mult.upper,
        });
      });
    });

    // ─── 6. Find associations (recursive) ───
    let assocCount = 0;
    allPe.forEach((pe) => {
      const xmiType = getAttr(pe, 'xmi:type');
      if (xmiType !== 'uml:Association') return;
      assocCount++;

      const assocId = getAttr(pe, 'xmi:id') || '';

      // Collect ends from both ownedEnd and ownedAttribute (EA uses both)
      const ends: Array<{
        typeId: string;
        aggregation: string;
        lower: string;
        upper: string;
        source: boolean;
      }> = [];

      // 6a. Get ends from <ownedEnd> elements
      pe.querySelectorAll(':scope > ownedEnd').forEach((endEl) => {
        const typeEl = endEl.querySelector(':scope > type');
        const typeId = typeEl?.getAttribute('xmi:idref') || '';
        const aggregation = endEl.getAttribute('aggregation') || 'none';
        const mult = getMultiplicity(endEl);

        ends.push({
          typeId,
          aggregation,
          lower: mult.lower,
          upper: mult.upper,
          source: false,
        });
      });

      // 6b. Get ends from <ownedAttribute> in classes that reference this association
      const attrEnds = assocAttrsByAssocId.get(assocId) || [];
      // Only add attr ends that are NOT already covered by ownedEnd
      const ownedEndTypeIds = new Set(ends.map(e => e.typeId));
      attrEnds.forEach((ae) => {
        if (!ownedEndTypeIds.has(ae.typeId)) {
          ends.push({
            typeId: ae.typeId,
            aggregation: 'none',
            lower: ae.lower,
            upper: ae.upper,
            source: false,
          });
        }
      });

      // 6c. Also check <memberEnd> references to ownedAttribute elements
      pe.querySelectorAll(':scope > memberEnd').forEach((meRef) => {
        const meId = meRef.getAttribute('xmi:idref');
        if (!meId) return;
        const ownedAttr = ownedAttrById.get(meId);
        if (!ownedAttr) return;

        const assocRef = ownedAttr.getAttribute('association');
        if (assocRef !== assocId) return;

        const typeEl = ownedAttr.querySelector(':scope > type');
        const typeId = typeEl?.getAttribute('xmi:idref') || '';
        const mult = getMultiplicity(ownedAttr);
        const aggregation = ownedAttr.getAttribute('aggregation') || 'none';

        if (!ownedEndTypeIds.has(typeId)) {
          ends.push({
            typeId,
            aggregation,
            lower: mult.lower,
            upper: mult.upper,
            source: false,
          });
        }
      });

      if (ends.length < 2) return;

      // Determine source and target: first end = source, second = target
      const sourceTypeId = ends[0].typeId;
      const targetTypeId = ends[1].typeId;
      const sourceInternalId = eaIdToInternal.get(sourceTypeId);
      const targetInternalId = eaIdToInternal.get(targetTypeId);

      if (!sourceInternalId || !targetInternalId) return;

      // Determine relationship type from aggregation
      const sourceAgg = ends[0].aggregation;
      const targetAgg = ends[1].aggregation;

      let relType: RelationshipData['type'] = 'ASSOCIATION';
      if (sourceAgg === 'composite' || targetAgg === 'composite') {
        relType = 'COMPOSITION';
      } else if (sourceAgg === 'shared' || targetAgg === 'shared') {
        relType = 'AGGREGATION';
      }

      const cardFrom = multiplicityToString(ends[0].lower, ends[0].upper);
      const cardTo = multiplicityToString(ends[1].lower, ends[1].upper);
      const assocName = getAttr(pe, 'name') || '';

      const rfEdgeType = relType === 'AGGREGATION'
        ? 'aggregation'
        : relType === 'COMPOSITION'
        ? 'composition'
        : 'association';

      edges.push({
        id: genId(),
        source: sourceInternalId,
        target: targetInternalId,
        type: rfEdgeType,
        data: {
          type: relType,
          label: assocName || undefined,
          cardinalityFrom: cardFrom,
          cardinalityTo: cardTo,
        },
      });
    });

    console.log('[XMI Import] Asociaciones encontradas:', assocCount, '→ aristas creadas:', edges.length);

    // ─── 7. Find generalizations (inheritance) ───
    const generalizations: Array<{ specific: string; general: string }> = [];

    // 7a. <generalization> inside classes/interfaces
    allPe.forEach((pe) => {
      const xmiType = getAttr(pe, 'xmi:type');
      if (xmiType !== 'uml:Class' && xmiType !== 'uml:Interface') return;

      const specificEaId = getAttr(pe, 'xmi:id');
      if (!specificEaId) return;

      pe.querySelectorAll(':scope > generalization').forEach((genEl) => {
        const generalEaId = genEl.getAttribute('general');
        if (generalEaId) {
          generalizations.push({ specific: specificEaId, general: generalEaId });
        }
      });
    });

    // 7b. Top-level <packagedElement xmi:type="uml:Generalization">
    allPe.forEach((pe) => {
      const xmiType = getAttr(pe, 'xmi:type');
      if (xmiType !== 'uml:Generalization') return;

      const specificEaId = getAttr(pe, 'specific');
      const generalEaId = pe.getAttribute('general');
      if (specificEaId && generalEaId) {
        generalizations.push({ specific: specificEaId, general: generalEaId });
      }
    });

    // 7c. Standalone <generalization> elements (not inside packagedElement)
    allElements.forEach((el) => {
      if (getLocalName(el) !== 'generalization') return;
      // Skip if it's inside a packagedElement (already handled in 7a)
      if (el.parentElement && getLocalName(el.parentElement) === 'packagedElement') return;

      const specificEaId = el.getAttribute('specific');
      const generalEaId = el.getAttribute('general');
      if (specificEaId && generalEaId) {
        generalizations.push({ specific: specificEaId, general: generalEaId });
      }
    });

    let genCount = 0;
    generalizations.forEach(({ specific, general }) => {
      const specificInternalId = eaIdToInternal.get(specific);
      const generalInternalId = eaIdToInternal.get(general);
      if (!specificInternalId || !generalInternalId) return;

      edges.push({
        id: genId(),
        source: specificInternalId,
        target: generalInternalId,
        type: 'inheritance',
        data: { type: 'INHERITANCE' },
      });
      genCount++;
    });

    console.log('[XMI Import] Generalizaciones encontradas:', generalizations.length, '→ aristas creadas:', genCount);
    console.log('[XMI Import] Total nodos:', nodes.length, 'Total aristas:', edges.length);

    // ─── 8. Insert into diagram ───
    if (nodes.length === 0) {
      alert('No se encontraron clases ni interfaces en el archivo XMI.');
      return;
    }

    nodes.forEach((node) => hooks.addNode(node));
    edges.forEach((edge) => hooks.addEdge(edge));
  });
}
