import { memo } from 'react';
import { EdgeProps } from 'reactflow';
import UmlEdge, { getEdgeEndVector } from './UmlEdge';
import { useFloatingEdgeGeometry } from '../utils/floatingEdges';

function InheritanceEdge(props: EdgeProps) {
  // Arista flotante: extremos en el borde (centro-a-centro recortado).
  // Sin geometría (self-loop, nodos ausentes) -> coords de React Flow.
  const geom = useFloatingEdgeGeometry(props.source, props.target);
  const sourceX = geom?.sourceX ?? props.sourceX;
  const sourceY = geom?.sourceY ?? props.sourceY;
  const targetX = geom?.targetX ?? props.targetX;
  const targetY = geom?.targetY ?? props.targetY;
  const sourcePosition = geom?.sourcePosition ?? props.sourcePosition;
  const targetPosition = geom?.targetPosition ?? props.targetPosition;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;

  // Orientación por segmento final (routing ortogonal), no por vector recto.
  const { ux, uy } = getEdgeEndVector(targetPosition, dx, dy);

  const tipX = targetX - ux * 10;
  const tipY = targetY - uy * 10;

  const baseX = tipX - ux * 14;
  const baseY = tipY - uy * 14;
  const halfW = 7;

  const p1x = tipX + ux * 2;
  const p1y = tipY + uy * 2;
  const p2x = baseX + uy * halfW;
  const p2y = baseY - ux * halfW;
  const p3x = baseX - uy * halfW;
  const p3y = baseY + ux * halfW;

  // UML 2.5 / EA: la generalización usa línea CONTINUA + triángulo hueco.
  return (
    <UmlEdge
      {...props}
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
    >
      <polygon
        points={`${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`}
        fill="white"
        stroke="#374151"
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
    </UmlEdge>
  );
}

export default memo(InheritanceEdge);
