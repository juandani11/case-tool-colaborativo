import { Node, Edge } from 'reactflow';
import { EntityNodeData, RelationshipData, Attribute, Method } from '../types/diagram';

const XMI_NS = 'http://www.omg.org/spec/XMI/20131001';
const UML_NS = 'http://www.omg.org/spec/UML/20131001';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseMultiplicity(card?: string): { lower: string; upper: string } {
  if (!card || card === '') return { lower: '1', upper: '1' };
  switch (card) {
    case '0':    return { lower: '0', upper: '0' };
    case '1':    return { lower: '1', upper: '1' };
    case '0..1': return { lower: '0', upper: '1' };
    case '*':    return { lower: '0', upper: '*' };
    case '0..*': return { lower: '0', upper: '*' };
    case '1..*': return { lower: '1', upper: '*' };
    case '1..':  return { lower: '1', upper: '*' };
    default:     return { lower: '1', upper: '1' };
  }
}

function upperValueXml(id: string, val: string): string {
  return val === '*'
    ? `<upperValue xmi:id="${id}" xmi:type="uml:LiteralUnlimitedNatural" value="*"/>`
    : `<upperValue xmi:id="${id}" xmi:type="uml:LiteralUnlimitedNatural" value="${val}"/>`;
}

function collectUsedTypes(
  nodes: Node<EntityNodeData>[],
  edges: Edge<RelationshipData>[]
): string[] {
  const set = new Set<string>();
  for (const node of nodes) {
    if (!node.data) continue;
    for (const attr of node.data.attributes || []) {
      if (attr.type) set.add(attr.type);
    }
    for (const method of node.data.methods || []) {
      for (const param of method.parameters || []) {
        if (param.type) set.add(param.type);
      }
      if (method.returnType && method.returnType !== 'void') {
        set.add(method.returnType);
      }
    }
  }
  for (const edge of edges) {
    const data = edge.data;
    if (!data) continue;
    for (const param of (data as any).parameters || []) {
      if (param?.type) set.add(param.type);
    }
  }
  return Array.from(set).sort();
}

function buildDataTypes(types: string[]): string {
  let xml = '';
  for (const t of types) {
    xml += `    <packagedElement xmi:type="uml:DataType" xmi:id="DT_${escapeXml(t)}" name="${escapeXml(t)}"/>\n`;
  }
  return xml;
}

function buildAttribute(
  attr: Attribute,
  classPrefix: string,
  attrIndex: number
): string {
  const id = `A_${classPrefix}_${attrIndex}`;
  const vis = attr.isPk ? 'private' : 'public';
  return `      <ownedAttribute xmi:id="${id}" name="${escapeXml(attr.name)}" visibility="${vis}" type="DT_${escapeXml(attr.type)}"/>\n`;
}

function buildMethod(
  method: Method,
  classPrefix: string,
  methodIndex: number
): string {
  const opId = `O_${classPrefix}_${methodIndex}`;
  let xml = `      <ownedOperation xmi:id="${opId}" name="${escapeXml(method.name)}" visibility="${method.visibility}">\n`;

  method.parameters.forEach((param, pi) => {
    const paramId = `P_${classPrefix}_${methodIndex}_param${pi}`;
    xml += `        <ownedParameter xmi:id="${paramId}" name="${escapeXml(param.name)}" direction="in" type="DT_${escapeXml(param.type)}"/>\n`;
  });

  if (method.returnType && method.returnType !== 'void') {
    const retId = `P_${classPrefix}_${methodIndex}_ret`;
    xml += `        <ownedParameter xmi:id="${retId}" direction="return" type="DT_${escapeXml(method.returnType)}"/>\n`;
  }

  xml += `      </ownedOperation>\n`;
  return xml;
}

function buildClass(node: Node<EntityNodeData>, index: number): string {
  const data = node.data;
  const prefix = data.label.replace(/[^a-zA-Z0-9]/g, '_');
  const isInterface = data.stereotype === 'interface';
  const elementType = isInterface ? 'uml:Interface' : 'uml:Class';
  const id = isInterface ? `I_${prefix}` : `C_${prefix}`;

  let xml = `    <packagedElement xmi:type="${elementType}" xmi:id="${id}" name="${escapeXml(data.label)}" visibility="public">\n`;

  (data.attributes || []).forEach((attr, ai) => {
    xml += buildAttribute(attr, prefix, ai);
  });

  (data.methods || []).forEach((method, mi) => {
    xml += buildMethod(method, prefix, mi);
  });

  xml += `    </packagedElement>\n`;
  return xml;
}

function buildAssociation(
  edge: Edge<RelationshipData>,
  nodes: Node<EntityNodeData>[],
  index: number
): string {
  const data = edge.data;
  const edgeType = data?.type ?? 'ASSOCIATION';

  const sourceIdx = nodes.findIndex(n => n.id === edge.source);
  const targetIdx = nodes.findIndex(n => n.id === edge.target);
  if (sourceIdx < 0 || targetIdx < 0) {
    console.warn(
      `[XMI] Edge ${edge.id} skipped: source="${edge.source}" (idx=${sourceIdx}) or target="${edge.target}" (idx=${targetIdx}) not found in nodes`
    );
    return '';
  }

  const sourceNode = nodes[sourceIdx];
  const targetNode = nodes[targetIdx];
  const srcPrefix = sourceNode.data?.label?.replace(/[^a-zA-Z0-9]/g, '_') || `N${sourceIdx}`;
  const tgtPrefix = targetNode.data?.label?.replace(/[^a-zA-Z0-9]/g, '_') || `N${targetIdx}`;
  const isSrcIface = sourceNode.data?.stereotype === 'interface';
  const isTgtIface = targetNode.data?.stereotype === 'interface';
  const srcId = isSrcIface ? `I_${srcPrefix}` : `C_${srcPrefix}`;
  const tgtId = isTgtIface ? `I_${tgtPrefix}` : `C_${tgtPrefix}`;

  // Generalization (inheritance)
  if (edgeType === 'INHERITANCE') {
    const genId = `Gen_${srcPrefix}_${tgtPrefix}_${index}`;
    let xml = `    <packagedElement xmi:type="uml:Generalization" xmi:id="${genId}" specific="${srcId}" general="${tgtId}"/>\n`;
    return xml;
  }

  const sourceMult = parseMultiplicity(data?.cardinalityFrom);
  const targetMult = parseMultiplicity(data?.cardinalityTo);
  const assocId = `Ass_${srcPrefix}_${tgtPrefix}_${index}`;

  let aggAttr = ' aggregation="none"';
  if (edgeType === 'AGGREGATION') {
    aggAttr = ' aggregation="shared"';
  } else if (edgeType === 'COMPOSITION') {
    aggAttr = ' aggregation="composite"';
  }

  const name = escapeXml(data?.label || '');

  let xml = `    <packagedElement xmi:type="uml:Association" xmi:id="${assocId}" name="${name}" visibility="public">\n`;
  xml += `      <ownedEnd xmi:id="E_${assocId}_src" type="${srcId}"${aggAttr}>\n`;
  xml += `        <lowerValue xmi:id="LV_${assocId}_src" xmi:type="uml:LiteralInteger" value="${sourceMult.lower}"/>\n`;
  xml += `        ${upperValueXml(`UV_${assocId}_src`, sourceMult.upper)}\n`;
  xml += `      </ownedEnd>\n`;
  xml += `      <ownedEnd xmi:id="E_${assocId}_tgt" type="${tgtId}" aggregation="none">\n`;
  xml += `        <lowerValue xmi:id="LV_${assocId}_tgt" xmi:type="uml:LiteralInteger" value="${targetMult.lower}"/>\n`;
  xml += `        ${upperValueXml(`UV_${assocId}_tgt`, targetMult.upper)}\n`;
  xml += `      </ownedEnd>\n`;
  xml += `      <memberEnd xmi:idref="E_${assocId}_src"/>\n`;
  xml += `      <memberEnd xmi:idref="E_${assocId}_tgt"/>\n`;
  xml += `    </packagedElement>\n`;
  return xml;
}

export function exportToXmi(nodes: Node<EntityNodeData>[], edges: Edge<RelationshipData>[]): string {
  const usedTypes = collectUsedTypes(nodes, edges);

  let xmi = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xmi += `<xmi:XMI xmlns:xmi="${XMI_NS}" xmlns:uml="${UML_NS}" xmi:version="2.5.1">\n`;
  xmi += `  <uml:Model xmi:id="ModeloPrincipal" name="ModeloExportado" visibility="public">\n`;

  // DataType elements
  xmi += buildDataTypes(usedTypes);

  // Classes
  nodes.forEach((node, i) => {
    if (node.data) {
      xmi += buildClass(node, i);
    }
  });

  // Associations and generalizations
  edges.forEach((edge, i) => {
    xmi += buildAssociation(edge, nodes, i);
  });

  xmi += `  </uml:Model>\n`;
  xmi += `</xmi:XMI>\n`;

  return xmi;
}

export function downloadXmi(xmiContent: string, filename: string = 'diagrama.xmi'): void {
  const blob = new Blob([xmiContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
