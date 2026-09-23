import { memo } from 'react';
import { EdgeProps } from 'reactflow';
import UmlEdge from './UmlEdge';
import { useFloatingEdgeGeometry } from '../utils/floatingEdges';

function AssociationEdge(props: EdgeProps) {
  // Arista flotante: extremos en el borde (centro-a-centro recortado).
  // Sin geometría (self-loop, nodos ausentes) -> coords de React Flow.
  const geom = useFloatingEdgeGeometry(props.source, props.target);
  return (
    <UmlEdge
      {...props}
      sourceX={geom?.sourceX ?? props.sourceX}
      sourceY={geom?.sourceY ?? props.sourceY}
      targetX={geom?.targetX ?? props.targetX}
      targetY={geom?.targetY ?? props.targetY}
      sourcePosition={geom?.sourcePosition ?? props.sourcePosition}
      targetPosition={geom?.targetPosition ?? props.targetPosition}
    />
  );
}

export default memo(AssociationEdge);
