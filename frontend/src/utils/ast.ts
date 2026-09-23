import { Node, Edge } from 'reactflow';
import {
  Attribute,
  EntityNodeData,
  RelationshipData,
  AstRelationship,
} from '../types/diagram';
import { typeMap as relationshipToReactFlow } from '../utils/yjsEdgeHelpers';

function splitWords(name: string): string[] {
  if (!name) return [];
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function capWord(w: string, lowerRest: boolean): string {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + (lowerRest ? w.slice(1).toLowerCase() : w.slice(1));
}

// "Order Details" -> "OrderDetails", "USER_ACCOUNT" -> "UserAccount".
// Idempotente: no altera nombres ya válidos ("PedidoProducto" no cambia).
// Espejo de toJavaClassName en backend/generator/generate.js.
export function toJavaClassName(name: string): string {
  const words = splitWords(name);
  if (words.length === 0) return 'Unnamed';
  return words
    .map(w => (/^[A-Z0-9_]+$/.test(w) ? capWord(w, true) : capWord(w, false)))
    .join('');
}

function snakeCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

// Un extremo es "muchos" si su cardinalidad lo indica
export function isManySide(card?: string): boolean {
  if (!card) return false;
  const c = card.trim();
  return (
    c === '*' ||
    c === 'N' ||
    c === 'M' ||
    c === 'n' ||
    c === 'm' ||
    c.includes('*')
  );
}

// Convierte nodos y aristas de React Flow al AST que espera el backend.
// Las relaciones * a * generan entidad intermedia explícita
// (clase asociativa UML 2.5) en lugar de @ManyToMany.
//
// Las aristas punteadas (isAssociationClassLink) son internas del editor
// y se excluyen: la relación se sintetiza desde el nodo asociativo.
export function nodesToAST(
  nodes: Node<EntityNodeData>[],
  edges: Edge<RelationshipData>[]
) {
  const realEdges = (edges || []).filter((e) => !e?.data?.isAssociationClassLink);

  const idToName = new Map<string, string>();
  const nodeById = new Map<string, Node<EntityNodeData>>();
  nodes.forEach((node) => {
    idToName.set(node.id, node.data.label);
    nodeById.set(node.id, node);
  });

  const isManyRel = (type: string | undefined, cF?: string, cT?: string) =>
    type === 'MANY_TO_MANY' || (isManySide(cF) && isManySide(cT));

  // Nodos vinculados como clase asociativa por aristas * a * (modelo vigente
  // associationClassNodeId y legacy associationClassId: la arista aporta la
  // relación y el nodo el nombre/atributos).
  // Se excluyen de `entities`: el generador los expande una sola vez
  // como entidad intermedia (no debe contarse dos veces).
  const associationNodeIds = new Set<string>();
  realEdges.forEach((edge) => {
    const linkedId = edge.data?.associationClassNodeId || edge.data?.associationClassId;
    if (!linkedId || !nodeById.has(linkedId)) return;
    const t = edge.data?.type || 'ASSOCIATION';
    if (isManyRel(t, edge.data?.cardinalityFrom, edge.data?.cardinalityTo)) {
      associationNodeIds.add(linkedId);
    }
  });

  // Atributos del nodo para la intermedia (sin PKs: la expansión aporta su UUID).
  const nodeAssocAttributes = (node: Node<EntityNodeData>): Attribute[] =>
    (node.data.attributes || [])
      .filter((a: Attribute) => !a.isPk)
      .map((a: Attribute) => ({ ...a }));

  // Nodos asociativos nuevo modelo (flag + respaldo, arista original eliminada).
  // Se sintetiza la relación desde el nodo; si el respaldo está roto o ya no
  // es * a *, el nodo cuenta como entidad normal (sin pérdida de datos).
  const synthesized: AstRelationship[] = [];
  nodes.forEach((node) => {
    const stash = node.data?.associationOf;
    if (!node.data?.isAssociationClass || !stash) return;
    if (associationNodeIds.has(node.id)) return; // consumido por legacy
    const fromEntity = idToName.get(stash.sourceId);
    const toEntity = idToName.get(stash.targetId);
    if (!fromEntity || !toEntity) return;
    const cF = stash.cardinalityFrom || '*';
    const cT = stash.cardinalityTo || '*';
    const type = stash.type || 'ASSOCIATION';
    if (!isManyRel(type, cF, cT)) return;
    associationNodeIds.add(node.id);
    synthesized.push({
      id: `rel_${node.id}`,
      source: { id: stash.sourceId, entityName: fromEntity },
      target: { id: stash.targetId, entityName: toEntity },
      fromEntity,
      toEntity,
      type: type as AstRelationship['type'],
      cardinalityFrom: cF,
      cardinalityTo: cT,
      intermediateEntity: toJavaClassName(node.data.label),
      intermediateTable: snakeCase(toJavaClassName(node.data.label)),
      intermediateAttributes: nodeAssocAttributes(node),
      isAssociationClass: true,
    });
  });

  const entities = nodes
    .filter((node) => !associationNodeIds.has(node.id))
    .map((node) => ({
      id: node.id,
      name: node.data.label,
      attributes: node.data.attributes,
    }));

  const relationships: AstRelationship[] = realEdges.map((edge) => {
    const fromEntity = idToName.get(edge.source) || edge.source;
    const toEntity = idToName.get(edge.target) || edge.target;
    const type = edge.data?.type || 'ASSOCIATION';
    const cardinalityFrom = edge.data?.cardinalityFrom;
    const cardinalityTo = edge.data?.cardinalityTo;

    const rel: AstRelationship = {
      id: edge.id,
      source: { id: edge.source, entityName: fromEntity },
      target: { id: edge.target, entityName: toEntity },
      fromEntity,
      toEntity,
      type,
      cardinalityFrom,
      cardinalityTo,
    };

    // Si es * a *, generar entidad intermedia explícita
    if (isManyRel(type, cardinalityFrom, cardinalityTo)) {
      const linkedId = edge.data?.associationClassNodeId || edge.data?.associationClassId;
      const linkedNode = linkedId ? nodeById.get(linkedId) : undefined;
      if (linkedNode && associationNodeIds.has(linkedNode.id)) {
        // Clase asociativa visible (legacy): el NODO es la fuente de verdad
        // (nombre + atributos editados con EntityEditorPanel).
        rel.intermediateEntity = toJavaClassName(linkedNode.data.label);
        rel.intermediateTable = snakeCase(toJavaClassName(linkedNode.data.label));
        rel.intermediateAttributes = nodeAssocAttributes(linkedNode);
        rel.isAssociationClass = true;
      } else {
        // Comportamiento actual: nombre auto-generado
        // Sanitizado por partes: "Order Details"+"Product" -> "OrderDetailsProduct"
        rel.intermediateEntity = `${toJavaClassName(fromEntity)}${toJavaClassName(toEntity)}`;
        rel.intermediateTable = `${snakeCase(toJavaClassName(fromEntity))}_${snakeCase(toJavaClassName(toEntity))}`;
        rel.intermediateAttributes = (edge.data?.intermediateAttributes || []).map(
          (a: Attribute) => ({ ...a })
        );
      }
    }

    return rel;
  });

  return { entities, relationships: [...relationships, ...synthesized] };
}

// Aplica las mutaciones devueltas por la IA al estado colaborativo
export function applyMutations(mutations: any[], hooks: any) {
  // Mapa local para resolver nombres → IDs de nodos recién creados
  const entityNameToId: Record<string, string> = {};

  // 1. addEntity: crear nodos y poblar el mapa
  for (const mutation of mutations.filter((m: any) => m.action === 'addEntity')) {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const attributes = (mutation.attributes || []).map((attr: any, index: number) => ({
      id: `attr_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      name: attr.name,
      type: attr.type || 'String',
      isPk: attr.isPk || false,
      nullable: attr.nullable !== false,
      unique: attr.unique || false,
    }));
    hooks.addNode({
      id,
      type: 'entity',
      position: { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 },
      data: {
        label: mutation.entityName,
        attributes,
      },
    });
    entityNameToId[mutation.entityName] = id;
  }

  // Helper: resolver nombre de entidad a ID (mapa local → hooks.nodes → null)
  function resolveEntityId(name: string): string | null {
    if (entityNameToId[name]) return entityNameToId[name];
    const node = hooks.nodes.find((n: any) => n.data.label === name);
    return node ? node.id : null;
  }

  // 2. addAttribute
  for (const mutation of mutations.filter((m: any) => m.action === 'addAttribute')) {
    const nodeId = resolveEntityId(mutation.entityName);
    if (!nodeId) {
      console.warn(`Entidad no encontrada: ${mutation.entityName}`);
      continue;
    }
    const node = hooks.nodes.find((n: any) => n.id === nodeId);
    if (!node) continue;
    const newAttr = {
      id: `attr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: mutation.attribute.name,
      type: mutation.attribute.type || 'String',
      isPk: mutation.attribute.isPk || false,
      nullable: mutation.attribute.nullable !== false,
      unique: mutation.attribute.unique || false,
    };
    hooks.updateNode(node.id, { data: { ...node.data, attributes: [...node.data.attributes, newAttr] } });
  }

  // 3. addRelationship
  for (const mutation of mutations.filter((m: any) => m.action === 'addRelationship')) {
    const sourceId = resolveEntityId(mutation.sourceEntity);
    const targetId = resolveEntityId(mutation.targetEntity);
    if (!sourceId || !targetId) {
      console.warn(`No se encontraron entidades para la relación: ${mutation.sourceEntity} -> ${mutation.targetEntity}`);
      continue;
    }
    const relationshipType: string = mutation.type || 'ASSOCIATION';
    const reactFlowEdgeType = relationshipToReactFlow[relationshipType] || 'association';
    hooks.addEdge({
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: sourceId,
      target: targetId,
      type: reactFlowEdgeType,
      data: {
        type: relationshipType,
        cardinalityFrom: mutation.cardinalityFrom,
        cardinalityTo: mutation.cardinalityTo,
        intermediateAttributes: mutation.intermediateAttributes || [],
      },
    });
  }

  // 4. removeRelationship
  for (const mutation of mutations.filter((m: any) => m.action === 'removeRelationship')) {
    const sourceId = resolveEntityId(mutation.sourceEntity);
    const targetId = resolveEntityId(mutation.targetEntity);
    if (!sourceId || !targetId) {
      console.warn(`No se encontraron entidades para eliminar relación: ${mutation.sourceEntity} -> ${mutation.targetEntity}`);
      continue;
    }
    const edge = hooks.edges.find(
      (e: any) => e.source === sourceId && e.target === targetId
    );
    if (edge) {
      hooks.removeEdge(edge.id);
    } else {
      console.warn(`Relación no encontrada: ${mutation.sourceEntity} -> ${mutation.targetEntity}`);
    }
  }

  // 5. removeEntity (al final para no romper referencias)
  for (const mutation of mutations.filter((m: any) => m.action === 'removeEntity')) {
    const nodeId = resolveEntityId(mutation.entityName);
    if (nodeId) {
      hooks.removeNode(nodeId);
    } else {
      console.warn(`Entidad no encontrada para eliminar: ${mutation.entityName}`);
    }
  }
}