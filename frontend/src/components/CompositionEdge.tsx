import { memo } from 'react';
import { EdgeProps } from 'reactflow';
import UmlEdge, { getEdgeEndVector } from './UmlEdge';
import { useFloatingEdgeGeometry } from '../utils/floatingEdges';

function CompositionEdge(props: EdgeProps) {
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

  const cx = targetX - ux * 14;
  const cy = targetY - uy * 14;

  const hw = 8;
  const hl = 12;

  const tipX = cx + ux * hl;
  const tipY = cy + uy * hl;
  const leftX = cx + uy * hw;
  const leftY = cy - ux * hw;
  const tailX = cx - ux * hl;
  const tailY = cy - uy * hl;
  const rightX = cx - uy * hw;
  const rightY = cy + ux * hw;

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
        points={`${tipX},${tipY} ${leftX},${leftY} ${tailX},${tailY} ${rightX},${rightY}`}
        fill="#374151"
        stroke="#374151"
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
    </UmlEdge>
  );
}

export default memo(CompositionEdge);
