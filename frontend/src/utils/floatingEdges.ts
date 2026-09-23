import { useStore, Position } from 'reactflow';

// Aristas flotantes estilo Enterprise Architect: la línea apunta al CENTRO
// del nodo y se recorta al borde del rectángulo, en vez de usar handles
// fijos. Solo visual: no toca edge.type, edge.data, AST ni backend.

export interface FlowPoint {
  x: number;
  y: number;
}

// Subconjunto estructural de nodo que necesita la geometría (evita acoplar
// la versión exacta de InternalNode de React Flow; testeable con objetos).
export interface MeasurableNode {
  width?: number | null;
  height?: number | null;
  positionAbsolute?: { x: number; y: number } | null;
  position: { x: number; y: number };
}

export interface FloatingGeometry {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}

const DEFAULT_W = 200;
const DEFAULT_H = 100;

function getNodeCenter(node: MeasurableNode): FlowPoint {
  const w = node.width || DEFAULT_W;
  const h = node.height || DEFAULT_H;
  return {
    x: (node.positionAbsolute?.x ?? node.position.x) + w / 2,
    y: (node.positionAbsolute?.y ?? node.position.y) + h / 2,
  };
}

// Punto donde la línea centroA -> centroB cruza el borde del rectángulo
// del nodo A, más el lado por el que sale ('left'|'right'|'top'|'bottom',
// compatible con Position de React Flow).
export function getNodeIntersection(
  nodeA: MeasurableNode,
  nodeB: MeasurableNode
): { point: FlowPoint; side: Position } {
  const w = (nodeA.width || DEFAULT_W) / 2;
  const h = (nodeA.height || DEFAULT_H) / 2;

  const centerA = getNodeCenter(nodeA);
  const centerB = getNodeCenter(nodeB);

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;

  // Centros coincidentes (nodos superpuestos): devolver el centro.
  if (dx === 0 && dy === 0) {
    return { point: centerA, side: Position.Top };
  }

  const scaleX = dx !== 0 ? Math.abs(w / dx) : Infinity;
  const scaleY = dy !== 0 ? Math.abs(h / dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  const point = {
    x: centerA.x + dx * scale,
    y: centerA.y + dy * scale,
  };

  let side: Position;
  if (scaleX < scaleY) {
    side = dx > 0 ? Position.Right : Position.Left;
  } else {
    side = dy > 0 ? Position.Bottom : Position.Top;
  }

  return { point, side };
}

// Hook compartido por los 4 edge components: calcula los extremos flotantes
// y se re-suscribe a posiciones/tamaños para re-dibujar al mover (F4).
// Devuelve null si falta un extremo o es self-loop -> el componente usa las
// coordenadas de React Flow (comportamiento anterior, sin regresión).
export function useFloatingEdgeGeometry(
  sourceId: string | null | undefined,
  targetId: string | null | undefined
): FloatingGeometry | null {
  // Suscripción a posiciones/tamaños: nueva cadena en cada cambio -> re-render.
  useStore((s: any) =>
    [...s.nodeInternals.values()]
      .map(
        (n: any) =>
          `${n.id}:${n.positionAbsolute?.x},${n.positionAbsolute?.y},${n.width},${n.height}`
      )
      .join('|')
  );
  const nodeInternals = useStore((s: any) => s.nodeInternals);

  if (!sourceId || !targetId || sourceId === targetId) return null;
  const sourceNode = nodeInternals.get(sourceId);
  const targetNode = nodeInternals.get(targetId);
  if (!sourceNode || !targetNode) return null;

  const src = getNodeIntersection(sourceNode, targetNode);
  const tgt = getNodeIntersection(targetNode, sourceNode);

  return {
    sourceX: src.point.x,
    sourceY: src.point.y,
    sourcePosition: src.side,
    targetX: tgt.point.x,
    targetY: tgt.point.y,
    targetPosition: tgt.side,
  };
}
