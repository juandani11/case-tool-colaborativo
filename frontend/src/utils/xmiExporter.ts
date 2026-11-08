import { Node, Edge } from 'reactflow';
import { EntityNodeData, RelationshipData, Attribute, Method } from '../types/diagram';

// Exporta el diagrama a XMI (UML 2.5) para abrirlo en Enterprise Architect.
// Solo viajan clases, atributos y relaciones: el vinculo de clase asociativa
// se pierde (limitacion conocida) y reimporta como entidad standalone.
const XMI_NS = 'http://www.omg.org/spec/XMI/20131001';
const UML_NS = 'http://www.omg.org/spec/UML/20131001';
const UMLDI_NS = 'http://www.omg.org/spec/UML/20131001/UMLDI';
const DC_NS = 'http://www.omg.org/spec/UML/20131001/UMLDC';
const DIAGRAM_ID = 'EAID_DiagramaExportado';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmiId(value: string): string {
  const raw = String(value || '').trim() || 'ID_unknown';
  const safe = raw.replace(/[^A-Za-z0-9_.-]/g, '_');
  return /^[A-Za-z_]/.test(safe) ? safe : `ID_${safe}`;
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
  classId: string,
  attrIndex: number
): string {
  const id = `A_${classId}_${attrIndex}`;
  const vis = attr.isPk ? 'private' : 'public';
  let xml = `      <ownedAttribute xmi:type="uml:Property" xmi:id="${id}" name="${escapeXml(attr.name)}" visibility="${vis}">\n`;
  xml += `        <type xmi:idref="DT_${escapeXml(attr.type)}"/>\n`;
  // 1..1 evita que EA interprete el atributo simple como coleccion ({bag}).
  xml += `        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="LV_${id}" value="1"/>\n`;
  xml += `        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="UV_${id}" value="1"/>\n`;
  xml += `      </ownedAttribute>\n`;
  return xml;
}

function buildMethod(
  method: Method,
  classId: string,
  methodIndex: number
): string {
  const opId = `O_${classId}_${methodIndex}`;
  let xml = `      <ownedOperation xmi:id="${opId}" name="${escapeXml(method.name)}" visibility="${method.visibility}">\n`;

  method.parameters.forEach((param, pi) => {
    const paramId = `P_${classId}_${methodIndex}_param${pi}`;
    xml += `        <ownedParameter xmi:id="${paramId}" name="${escapeXml(param.name)}" direction="in" type="DT_${escapeXml(param.type)}"/>\n`;
  });

  if (method.returnType && method.returnType !== 'void') {
    const retId = `P_${classId}_${methodIndex}_ret`;
    xml += `        <ownedParameter xmi:id="${retId}" direction="return" type="DT_${escapeXml(method.returnType)}"/>\n`;
  }

  xml += `      </ownedOperation>\n`;
  return xml;
}

function buildClass(node: Node<EntityNodeData>, index: number): string {
  const data = node.data;
  const classId = xmiId(node.id || `node_${index}`);
  const isInterface = data.stereotype === 'interface';
  const elementType = isInterface ? 'uml:Interface' : 'uml:Class';

  let xml = `    <packagedElement xmi:type="${elementType}" xmi:id="${classId}" name="${escapeXml(data.label)}" visibility="public">\n`;

  (data.attributes || []).forEach((attr, ai) => {
    xml += buildAttribute(attr, classId, ai);
  });

  (data.methods || []).forEach((method, mi) => {
    xml += buildMethod(method, classId, mi);
  });

  xml += `    </packagedElement>\n`;
  return xml;
}

interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeBox(node: Node<EntityNodeData>): NodeBox {
  const raw = node as Node<EntityNodeData> & {
    width?: number;
    height?: number;
    style?: { width?: number; height?: number };
  };
  const width = Number(raw.width ?? raw.style?.width ?? 200);
  const height = Number(raw.height ?? raw.style?.height ?? 100);
  return {
    x: Number(node.position?.x ?? 0),
    y: Number(node.position?.y ?? 0),
    width: Number.isFinite(width) && width > 0 ? width : 200,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  };
}

function relationSubject(edge: Edge<RelationshipData>, index: number): string {
  const edgeId = xmiId(edge.id || `edge_${index}`);
  return (edge.data?.type ?? 'ASSOCIATION') === 'INHERITANCE'
    ? `Gen_${edgeId}`
    : `Ass_${edgeId}`;
}

interface EdgeGeometry {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  sourceId: string;
  targetId: string;
  subject: string;
}

function getEdgeGeometry(
  edge: Edge<RelationshipData>,
  nodes: Node<EntityNodeData>[],
  index: number
): EdgeGeometry | null {
  const sourceIdx = nodes.findIndex(n => n.id === edge.source);
  const targetIdx = nodes.findIndex(n => n.id === edge.target);
  if (sourceIdx < 0 || targetIdx < 0) return null;

  const source = getNodeBox(nodes[sourceIdx]);
  const target = getNodeBox(nodes[targetIdx]);
  let sx = Math.max(10, Math.round(source.x + source.width / 2));
  let sy = Math.max(10, Math.round(source.y + source.height / 2));
  let ex = Math.max(10, Math.round(target.x + target.width / 2));
  let ey = Math.max(10, Math.round(target.y + target.height / 2));

  if (sx === ex && sy === ey) {
    ex += 60;
    ey += 40;
  }

  return {
    sx,
    sy,
    ex,
    ey,
    sourceId: xmiId(nodes[sourceIdx].id || `node_${sourceIdx}`),
    targetId: xmiId(nodes[targetIdx].id || `node_${targetIdx}`),
    subject: relationSubject(edge, index),
  };
}

function geometryString(edge: EdgeGeometry): string {
  return `SX=${edge.sx};SY=${edge.sy};EX=${edge.ex};EY=${edge.ey};`;
}

function cardinalityLabel(value?: string): string {
  return value && value.trim() ? value.trim() : '1';
}

function orthogonalMidX(edge: EdgeGeometry): number {
  return Math.round((edge.sx + edge.ex) / 2);
}

function waypointsString(edge: EdgeGeometry): string {
  if (edge.sy === edge.ey) return '';
  const midX = orthogonalMidX(edge);
  return `Waypoints=${midX}:${edge.sy},${midX}:${edge.ey}`;
}

function pathString(edge: EdgeGeometry): string {
  if (edge.sy === edge.ey) return '';
  const midX = orthogonalMidX(edge);
  return `Path=${midX}:${edge.sy};${midX}:${edge.ey};`;
}

function umlDiGeometry(edge: EdgeGeometry): string {
  const waypoints = waypointsString(edge);
  return `${geometryString(edge)}${waypoints ? `${waypoints};` : ''}`;
}

function buildDiagramInterchange(
  nodes: Node<EntityNodeData>[],
  edges: Edge<RelationshipData>[]
): string {
  let xml = `    <umldi:Diagram xmi:type="umldi:UMLClassDiagram" xmi:id="${DIAGRAM_ID}" isFrame="false" modelElement="PackageRoot">\n`;

  nodes.forEach((node, index) => {
    const nodeId = xmiId(node.id || `node_${index}`);
    const box = getNodeBox(node);
    const x = Math.max(10, Math.round(box.x));
    const y = Math.max(10, Math.round(box.y));
    const w = Math.max(30, Math.round(box.width));
    const h = Math.max(30, Math.round(box.height));
    const label = escapeXml(node.data?.label || nodeId);

    xml += `      <ownedElement xmi:type="umldi:UMLClassifierShape" xmi:id="DE_${nodeId}" modelElement="${nodeId}">\n`;
    xml += `        <ownedElement xmi:type="umldi:UMLNameLabel" xmi:id="NL_${nodeId}" text="${label}"/>\n`;
    xml += `        <bounds xmi:type="dc:bounds" xmi:id="DB_${nodeId}" x="${x}" y="${y}" width="${w}" height="${h}"/>\n`;
    xml += `      </ownedElement>\n`;
  });

  edges.forEach((edge, index) => {
    const geom = getEdgeGeometry(edge, nodes, index);
    if (!geom) return;

    const label = escapeXml(edge.data?.label || '');
    xml += `      <ownedElement xmi:type="umldi:UMLEdge" xmi:id="DE_${geom.subject}" source="${geom.sourceId}" target="${geom.targetId}" modelElement="${geom.subject}" geometry="${umlDiGeometry(geom)}">\n`;
    if (label) {
      xml += `        <ownedElement xmi:type="umldi:UMLNameLabel" xmi:id="NL_${geom.subject}" text="${label}">\n`;
      xml += `          <bounds xmi:type="dc:bounds" xmi:id="DB_${geom.subject}" x="${Math.min(geom.sx, geom.ex)}" y="${Math.min(geom.sy, geom.ey) - 16}" width="${Math.max(60, Math.abs(geom.ex - geom.sx))}" height="15"/>\n`;
      xml += `        </ownedElement>\n`;
    }
    xml += `        <waypoint xmi:type="dc:waypoint" xmi:id="WP_${geom.subject}_0" x="${geom.sx}" y="${geom.sy}"/>\n`;
    xml += `        <waypoint xmi:type="dc:waypoint" xmi:id="WP_${geom.subject}_1" x="${geom.ex}" y="${geom.ey}"/>\n`;
    xml += `      </ownedElement>\n`;
  });

  xml += `    </umldi:Diagram>\n`;
  return xml;
}

function relationshipEaType(edge: Edge<RelationshipData>): string {
  const type = edge.data?.type ?? 'ASSOCIATION';
  if (type === 'INHERITANCE') return 'Generalization';
  if (type === 'AGGREGATION' || type === 'COMPOSITION') return 'Aggregation';
  return 'Association';
}

function buildEaExtension(
  nodes: Node<EntityNodeData>[],
  edges: Edge<RelationshipData>[]
): string {
  let xml = `  <xmi:Extension extender="Enterprise Architect" extenderID="6.5">\n`;
  xml += `    <elements>\n`;
  xml += `      <element xmi:idref="PackageRoot" xmi:type="uml:Package" name="ModeloExportado" scope="public">\n`;
  xml += `        <model package2="PackageRoot" package="PackageRoot" tpos="0" ea_localid="1" ea_eleType="package"/>\n`;
  xml += `        <properties isSpecification="false" sType="Package" nType="0" scope="public"/>\n`;
  xml += `        <project version="1.0" phase="1.0" created="2026-11-07 00:00:00" modified="2026-11-07 00:00:00" complexity="1" status="Proposed"/>\n`;
  xml += `        <code gentype="Java"/>\n`;
  xml += `        <style appearance="BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;"/>\n`;
  xml += `        <tags/><xrefs/><extendedProperties tagged="0" package_name="ModeloExportado"/>\n`;
  xml += `        <packageproperties tpos="0"/><paths/><times created="2026-11-07 00:00:00" modified="2026-11-07 00:00:00"/>\n`;
  xml += `        <flags iscontrolled="FALSE" isprotected="FALSE" batchsave="0" batchload="0" usedtd="FALSE" logxml="FALSE"/>\n`;
  xml += `      </element>\n`;

  nodes.forEach((node, index) => {
    const nodeId = xmiId(node.id || `node_${index}`);
    const elementType = node.data?.stereotype === 'interface' ? 'uml:Interface' : 'uml:Class';
    const sType = node.data?.stereotype === 'interface' ? 'Interface' : 'Class';
    const label = escapeXml(node.data?.label || nodeId);
    xml += `      <element xmi:idref="${nodeId}" xmi:type="${elementType}" name="${label}" scope="public">\n`;
    xml += `        <model package="PackageRoot" tpos="0" ea_localid="${index + 2}" ea_eleType="element"/>\n`;
    xml += `        <properties isSpecification="false" sType="${sType}" nType="0" scope="public" isRoot="false" isLeaf="false" isAbstract="false" isActive="false"/>\n`;
    xml += `        <project version="1.0" phase="1.0" created="2026-11-07 00:00:00" modified="2026-11-07 00:00:00" complexity="1" status="Proposed"/>\n`;
    xml += `        <code gentype="Java"/>\n`;
    xml += `        <style appearance="BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;"/>\n`;
    xml += `        <tags/><xrefs/><extendedProperties tagged="0" package_name="ModeloExportado"/>\n`;
    xml += `        <attributes>\n`;
    (node.data?.attributes || []).forEach((attr, attrIndex) => {
      const attrId = `A_${nodeId}_${attrIndex}`;
      const scope = attr.isPk ? 'Private' : 'Public';
      xml += `          <attribute xmi:idref="${attrId}" name="${escapeXml(attr.name)}" scope="${scope}">\n`;
      xml += `            <initial/><documentation/><model ea_localid="${index * 100 + attrIndex + 1}"/>\n`;
      xml += `            <properties type="${escapeXml(attr.type)}" derived="0" collection="false" static="0" duplicates="0" changeability="changeable"/>\n`;
      xml += `            <coords ordered="0"/><containment position="${attrIndex}"/><stereotype/>\n`;
      xml += `            <bounds lower="1" upper="1"/><options/><style/><styleex value="IsLiteral=0;"/><tags/><xrefs/>\n`;
      xml += `          </attribute>\n`;
    });
    xml += `        </attributes>\n`;
    xml += `        <links>\n`;
    edges.forEach((edge, edgeIndex) => {
      if (edge.source !== node.id && edge.target !== node.id) return;
      const geom = getEdgeGeometry(edge, nodes, edgeIndex);
      if (!geom) return;
      const linkType = relationshipEaType(edge);
      xml += `          <${linkType} xmi:id="${geom.subject}" start="${geom.sourceId}" end="${geom.targetId}"/>\n`;
    });
    xml += `        </links>\n`;
    xml += `      </element>\n`;
  });

  xml += `    </elements>\n`;
  xml += `    <connectors>\n`;

  edges.forEach((edge, index) => {
    const geom = getEdgeGeometry(edge, nodes, index);
    if (!geom) return;
    const type = relationshipEaType(edge);
    if (type === 'Generalization') return;

    const label = escapeXml(edge.data?.label || '');
    const sourceCard = escapeXml(cardinalityLabel(edge.data?.cardinalityFrom));
    const targetCard = escapeXml(cardinalityLabel(edge.data?.cardinalityTo));
    const sourceIdx = nodes.findIndex(n => n.id === edge.source);
    const targetIdx = nodes.findIndex(n => n.id === edge.target);
    const sourceLabel = escapeXml(nodes[sourceIdx].data?.label || geom.sourceId);
    const targetLabel = escapeXml(nodes[targetIdx].data?.label || geom.targetId);

    xml += `      <connector xmi:idref="${geom.subject}" name="${label}">\n`;
    xml += `        <source xmi:idref="${geom.sourceId}"><model type="Class" name="${sourceLabel}"/><role visibility="Public"/><type multiplicity="${sourceCard}" aggregation="none"/><constraints/><modifiers isOrdered="false" isNavigable="false"/><style value="Derived=0;Union=0;Owned=0;Navigable=Unspecified;"/><documentation/><xrefs/><tags/></source>\n`;
    xml += `        <target xmi:idref="${geom.targetId}"><model type="Class" name="${targetLabel}"/><role visibility="Public"/><type multiplicity="${targetCard}" aggregation="none"/><constraints/><modifiers isOrdered="false" isNavigable="false"/><style value="Derived=0;Union=0;Owned=0;Navigable=Unspecified;"/><documentation/><xrefs/><tags/></target>\n`;
    xml += `        <model ea_localid="${100 + index}"/>\n`;
    xml += `        <properties ea_type="${type}" direction="Unspecified"/>\n`;
    xml += `        <modifiers isRoot="false" isLeaf="false"/>\n`;
    xml += `        <documentation/><appearance linemode="3" linecolor="-1" linewidth="0" seqno="0" headStyle="0" lineStyle="0"/><labels mt="${label}" lb="${sourceCard}" rb="${targetCard}"/><extendedProperties/><style/><xrefs/><tags/>\n`;
    xml += `      </connector>\n`;
  });

  xml += `    </connectors>\n`;
  xml += `    <primitivetypes><packagedElement xmi:type="uml:Package" xmi:id="EAPrimitiveTypesPackage" name="EA_PrimitiveTypes_Package"/></primitivetypes>\n`;
  xml += `    <profiles/>\n`;
  xml += `    <diagrams>\n`;
  xml += `      <diagram xmi:id="${DIAGRAM_ID}">\n`;
  xml += `        <model package="PackageRoot" localID="500" owner="PackageRoot" tpos="0"/>\n`;
  xml += `        <properties name="DiagramaExportado" type="Logical"/>\n`;
  xml += `        <project version="1" created="2026-11-07 00:00:00" modified="2026-11-07 00:00:00"/>\n`;
  xml += `        <style1 value="ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;PPgs.cy=0;DocSize.cx=800;DocSize.cy=1100;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=9;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AllDockable=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;SPT=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;"/>\n`;
  xml += `        <style2/>\n`;
  xml += `        <swimlanes value="locked=false;orientation=0;width=0;inbar=false;names=false;color=-1;bold=false;fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=1;ufh=0;hh=0;cls=0;bw=0;hli=0;SwimlaneFont=lfh:-13,lfw:0,lfi:0,lfu:0,lfs:0,lfface=Calibri,lfe:0,lfo:0,lfchar:1,lfop:0,lfcp:0,lfq:0,lfpf=0,lfWidth=0;"/>\n`;
  xml += `        <matrixitems value="locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;"/>\n`;
  xml += `        <extendedProperties/>\n`;
  xml += `        <elements>\n`;

  nodes.forEach((node, index) => {
    const nodeId = xmiId(node.id || `node_${index}`);
    const box = getNodeBox(node);
    const x = Math.max(10, Math.round(box.x));
    const y = Math.max(10, Math.round(box.y));
    const w = Math.max(30, Math.round(box.width));
    const h = Math.max(30, Math.round(box.height));
    xml += `          <element geometry="Left=${x};Top=${y};Right=${x + w};Bottom=${y + h};" subject="${nodeId}" seqno="${index + 1}" style="DUID=${nodeId};"/>\n`;
  });

  edges.forEach((edge, index) => {
    const geom = getEdgeGeometry(edge, nodes, index);
    if (!geom) return;
    const linkPath = pathString(geom) || 'Path=;';
    xml += `          <element geometry="SX=0;SY=0;EX=0;EY=0;${linkPath}" subject="${geom.subject}" style="Mode=3;TREE=OS;Hidden=0;"/>\n`;
  });

  xml += `        </elements>\n`;
  xml += `      </diagram>\n`;
  xml += `    </diagrams>\n`;
  xml += `  </xmi:Extension>\n`;
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
  const srcId = xmiId(sourceNode.id || `node_${sourceIdx}`);
  const tgtId = xmiId(targetNode.id || `node_${targetIdx}`);
  const edgeId = xmiId(edge.id || `edge_${index}`);

  // Generalization (inheritance)
  if (edgeType === 'INHERITANCE') {
    const genId = `Gen_${edgeId}`;
    let xml = `    <packagedElement xmi:type="uml:Generalization" xmi:id="${genId}" specific="${srcId}" general="${tgtId}"/>\n`;
    return xml;
  }

  const sourceMult = parseMultiplicity(data?.cardinalityFrom);
  const targetMult = parseMultiplicity(data?.cardinalityTo);
  const assocId = `Ass_${edgeId}`;

  let aggAttr = ' aggregation="none"';
  if (edgeType === 'AGGREGATION') {
    aggAttr = ' aggregation="shared"';
  } else if (edgeType === 'COMPOSITION') {
    aggAttr = ' aggregation="composite"';
  }

  const name = escapeXml(data?.label || '');

  let xml = `      <packagedElement xmi:type="uml:Association" xmi:id="${assocId}" name="${name}" visibility="public">\n`;
  // EA 2.5.1 exige: memberEnd -> ownedEnd, xmi:type Property,
  // association como back-reference y <type xmi:idref> (no atributo type).
  xml += `        <memberEnd xmi:idref="E_${assocId}_src"/>\n`;
  xml += `        <memberEnd xmi:idref="E_${assocId}_tgt"/>\n`;
  xml += `        <ownedEnd xmi:type="uml:Property" xmi:id="E_${assocId}_src" association="${assocId}" isReadOnly="true"${aggAttr}>\n`;
  xml += `          <type xmi:idref="${srcId}"/>\n`;
  xml += `          <lowerValue xmi:id="LV_${assocId}_src" xmi:type="uml:LiteralInteger" value="${sourceMult.lower}"/>\n`;
  xml += `          ${upperValueXml(`UV_${assocId}_src`, sourceMult.upper)}\n`;
  xml += `        </ownedEnd>\n`;
  xml += `        <ownedEnd xmi:type="uml:Property" xmi:id="E_${assocId}_tgt" association="${assocId}" isReadOnly="true" aggregation="none">\n`;
  xml += `          <type xmi:idref="${tgtId}"/>\n`;
  xml += `          <lowerValue xmi:id="LV_${assocId}_tgt" xmi:type="uml:LiteralInteger" value="${targetMult.lower}"/>\n`;
  xml += `          ${upperValueXml(`UV_${assocId}_tgt`, targetMult.upper)}\n`;
  xml += `        </ownedEnd>\n`;
  xml += `      </packagedElement>\n`;
  return xml;
}

export function exportToXmi(nodes: Node<EntityNodeData>[], edges: Edge<RelationshipData>[]): string {
  const usedTypes = collectUsedTypes(nodes, edges);

  let xmi = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  // EA ignora xmi:Extension si xmi:version esta en el nodo raiz.
  // La version 2.5.1 se declara en el encabezado xmi:Documentation.
  xmi += `<xmi:XMI xmlns:xmi="${XMI_NS}" xmlns:uml="${UML_NS}" xmlns:umldi="${UMLDI_NS}" xmlns:dc="${DC_NS}">\n`;
  xmi += `  <xmi:Documentation exporter="Enterprise Architect" exporterVersion="6.5" xmi:version="2.5.1"/>\n`;
  xmi += `  <uml:Model xmi:type="uml:Model" xmi:id="ModeloPrincipal" name="ModeloExportado">\n`;
  xmi += `    <packagedElement xmi:type="uml:Package" xmi:id="PackageRoot" name="ModeloExportado">\n`;

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

  xmi += `    </packagedElement>\n`;

  // UMLDI: geometria estandar del diagrama (formas, bounds y waypoints).
  xmi += buildDiagramInterchange(nodes, edges);

  xmi += `  </uml:Model>\n`;

  // EA usa ademas su extension propietaria para reconstruir conectores y diagrama.
  xmi += buildEaExtension(nodes, edges);

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
