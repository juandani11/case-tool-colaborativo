import { memo } from 'react';
import { EdgeProps, getSmoothStepPath } from 'reactflow';
import { UML_EDGE_BORDER_RADIUS, UML_EDGE_OFFSET } from './UmlEdge';

// Arista punteada ámbar para el conector de clase asociativa (UML 2.5).
// Las crea/gestiona page.tsx; nodesToAST las excluye del AST.
// Se crean con selectable:false para que no abran el panel de edición.
function DashedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: UML_EDGE_BORDER_RADIUS,
    offset: UML_EDGE_OFFSET,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      style={{
        stroke: '#f59e0b',
        strokeWidth: 2,
        strokeDasharray: '5,5',
        fill: 'none',
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
        pointerEvents: 'none',
      }}
    />
  );
}

export default memo(DashedEdge);
