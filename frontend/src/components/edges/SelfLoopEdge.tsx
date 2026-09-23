import { memo } from 'react';
import { EdgeProps } from 'reactflow';

/**
 * Edge custom para self-loops (relaciones de una entidad consigo misma).
 * Dibuja un bucle cerrado que sale del nodo, hace una curva semicircular
 * hacia la derecha y vuelve a entrar al mismo nodo.
 *
 * Forma del bucle:
 *        ╭───╮
 *        │   │
 *   ┌────┴───┴────┐
 *   │   Entidad   │
 *   └─────────────┘
 */
function SelfLoopEdgeInner({
  id,
  sourceX,
  sourceY,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  // Geometría del bucle: sale por arriba-derecha, curva a la derecha, vuelve
  const loopWidth = 70;   // cuánto se aleja horizontalmente
  const loopHeight = 50;  // cuánto sube verticalmente
  const entryGap = 24;    // distancia vertical entre salida y entrada

  // Punto de salida: arriba-derecha del nodo
  const startX = sourceX + 20;
  const startY = sourceY - 2;

  // Punto de entrada: un poco más abajo, misma X
  const endX = sourceX + 20;
  const endY = sourceY + entryGap;

  // Puntos de control para la curva Bezier (semicírculo a la derecha)
  const ctrl1X = startX + loopWidth;
  const ctrl1Y = startY - loopHeight;
  const ctrl2X = endX + loopWidth;
  const ctrl2Y = endY + loopHeight * 0.3;

  const path = `M ${startX},${startY} C ${ctrl1X},${ctrl1Y} ${ctrl2X},${ctrl2Y} ${endX},${endY}`;

  const stroke = selected ? '#3b82f6' : '#374151';
  const strokeWidth = selected ? 2.5 : 2;

  return (
    <g>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        style={{
          stroke,
          strokeWidth,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
        markerEnd={markerEnd}
      />
    </g>
  );
}

const SelfLoopEdge = memo(SelfLoopEdgeInner);
export default SelfLoopEdge;
