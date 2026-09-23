import { toJavaClassName } from './ast';

// Helpers puros para la clase asociativa (Bloque 2: la arista * a * original
// SE CONSERVA y apunta al nodo con associationClassNodeId; el nodo guarda
// associationOf { edgeId, sourceId, targetId }. Un conector punteado overlay
// une visualmente el nodo con el punto medio de la arista).
// Sin dependencias de React, para poder probarlos en Node.

export interface EdgeFieldClear {
  edgeId: string;
  field: 'associationClassNodeId' | 'associationClassId';
}

export interface AssociationDeletePlan {
  // IDs de aristas punteadas legacy a eliminar
  linkIdsToRemove: string[];
  // Campos de vínculo a limpiar en aristas conservadas
  edgeFieldClears: EdgeFieldClear[];
}

export function isAssociationLinkEdge(edge: any): boolean {
  return !!edge?.data?.isAssociationClassLink;
}

export function findAssociationLinks(edges: any[], assocNodeId: string): any[] {
  return (edges || []).filter(
    (e: any) => isAssociationLinkEdge(e) && (e.source === assocNodeId || e.target === assocNodeId)
  );
}

// Aristas (conservadas) que referencian al nodo como clase asociativa,
// en ambos modelos (associationClassNodeId vigente, associationClassId legacy).
export function findReferencingEdges(edges: any[], assocNodeId: string): any[] {
  return (edges || []).filter(
    (e: any) =>
      !isAssociationLinkEdge(e) &&
      (e?.data?.associationClassNodeId === assocNodeId ||
        e?.data?.associationClassId === assocNodeId)
  );
}

// Nombre por defecto: "User"+"Customer" -> "UserCustomer".
export function defaultAssociationName(fromLabel: string, toLabel: string): string {
  const from = toJavaClassName(fromLabel || 'A');
  const to = toJavaClassName(toLabel || 'B');
  return `${from}${to}`;
}

// Punto medio entre dos puntos (para el conector overlay). Puro y testeable.
export function edgeMidpoint(
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number } {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function buildAssociationNode(
  fromNode: any,
  toNode: any,
  edge: any
): any {
  const mid = edgeMidpoint(
    fromNode.position.x,
    fromNode.position.y,
    toNode.position.x,
    toNode.position.y
  );
  return {
    id: genId('entity'),
    type: 'entity',
    position: { x: mid.x, y: mid.y },
    data: {
      label: defaultAssociationName(fromNode.data?.label, toNode.data?.label),
      attributes: [],
      methods: [],
      stereotype: 'class',
      isAssociationClass: true,
      associationOf: {
        edgeId: edge.id,
        sourceId: fromNode.id,
        targetId: toNode.id,
      },
    },
  };
}

// Línea del conector overlay (Bloque 2): del punto medio de la arista al
// borde del nodo asociativo. Coordenadas de flujo (flow units).
export interface ConnectorLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ConnectorNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeConnectorLines(
  nodes: ConnectorNode[],
  edges: any[]
): ConnectorLine[] {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  const lines: ConnectorLine[] = [];
  for (const e of edges || []) {
    if (isAssociationLinkEdge(e)) continue;
    const classId = e?.data?.associationClassNodeId || e?.data?.associationClassId;
    if (!classId) continue;
    const cls = byId.get(classId);
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!cls || !src || !tgt) continue;
    const mid = edgeMidpoint(
      src.x + src.w / 2, src.y + src.h / 2,
      tgt.x + tgt.w / 2, tgt.y + tgt.h / 2
    );
    // Fijar el extremo al borde del rectángulo de la clase (punto más
    // cercano al medio de la arista) para no dibujar sobre el nodo.
    const cx = cls.x + cls.w / 2;
    const cy = cls.y + cls.h / 2;
    const dx = mid.x - cx;
    const dy = mid.y - cy;
    let s = 0;
    if (dx !== 0 || dy !== 0) {
      const sx = dx !== 0 ? cls.w / 2 / Math.abs(dx) : Infinity;
      const sy = dy !== 0 ? cls.h / 2 / Math.abs(dy) : Infinity;
      s = Math.min(sx, sy);
      if (!isFinite(s)) s = 0;
    }
    lines.push({ key: e.id, x1: mid.x, y1: mid.y, x2: cx + dx * s, y2: cy + dy * s });
  }
  return lines;
}

// Plan de borrado/disolución de un nodo asociativo. Como la arista original
// se conserva, NUNCA hay que recrearla: basta limpiar los vínculos.
// - nodo asociativo (nuevo o legacy): limpiar campo(s) en arista(s).
// - links legacy que tocan al nodo (sea el asociativo o un extremo):
//   eliminarlos (son internos del editor).
// - nodo normal sin vínculos: plan vacío.
export function planAssociationDelete(
  nodes: any[],
  edges: any[],
  nodeId: string
): AssociationDeletePlan {
  const plan: AssociationDeletePlan = {
    linkIdsToRemove: [],
    edgeFieldClears: [],
  };
  const nodeExists = (nodes || []).some((n: any) => n.id === nodeId);
  if (!nodeExists) return plan;

  for (const link of findAssociationLinks(edges, nodeId)) {
    plan.linkIdsToRemove.push(link.id);
  }

  for (const e of findReferencingEdges(edges, nodeId)) {
    if (e?.data?.associationClassNodeId === nodeId) {
      plan.edgeFieldClears.push({ edgeId: e.id, field: 'associationClassNodeId' });
    } else if (e?.data?.associationClassId === nodeId) {
      plan.edgeFieldClears.push({ edgeId: e.id, field: 'associationClassId' });
    }
  }

  return plan;
}
