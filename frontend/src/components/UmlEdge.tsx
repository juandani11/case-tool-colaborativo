import { memo } from 'react';
import { getSmoothStepPath, EdgeProps, Position } from 'reactflow';

export interface UmlEdgeData {
  type?: string;
  cardinalityFrom?: string;
  cardinalityTo?: string;
}

// Parámetros de routing ortogonal estilo Enterprise Architect.
export const UML_EDGE_BORDER_RADIUS = 8;
export const UML_EDGE_OFFSET = 20;

// Dirección de LLEGADA al nodo destino con routing ortogonal: el último
// segmento siempre es perpendicular al handle (eje de targetPosition),
// no el vector recto source->target. Los marcadores (triángulo, rombos)
// deben orientarse con este vector o quedarían girados en los codos (R6).
export function getEdgeEndVector(
  targetPosition?: Position | string | null,
  dx = 0,
  dy = 0
): { ux: number; uy: number } {
  switch (targetPosition) {
    case Position.Left:
    case 'left':
      return { ux: 1, uy: 0 };
    case Position.Right:
    case 'right':
      return { ux: -1, uy: 0 };
    case Position.Top:
    case 'top':
      return { ux: 0, uy: 1 };
    case Position.Bottom:
    case 'bottom':
      return { ux: 0, uy: -1 };
    default: {
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return { ux: dx / len, uy: dy / len };
    }
  }
}

interface UmlEdgeProps extends EdgeProps<UmlEdgeData> {
  children?: React.ReactNode;
  strokeStyle?: string;
}

const LABEL_FONT_SIZE = 12;
const MIN_EDGE_LENGTH = 30;
const PERP_OFFSET = 24;
const ALONG_OFFSET = 28;

function UmlEdgeInner({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  children,
  strokeStyle,
  selected,
}: UmlEdgeProps) {
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

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);

  const cardinalityFrom = data?.cardinalityFrom;
  const cardinalityTo = data?.cardinalityTo;

  const showLabels = length >= MIN_EDGE_LENGTH;

  // Compute unit vectors
  const ux = length > 0 ? dx / length : 0;
  const uy = length > 0 ? dy / length : 0;

  // Perpendicular unit vector (rotated 90° CCW)
  const px = -uy;
  const py = ux;

  // From label: offset along the edge direction (away from source) + perpendicular
  const fromX = sourceX + ux * ALONG_OFFSET + px * PERP_OFFSET;
  const fromY = sourceY + uy * ALONG_OFFSET + py * PERP_OFFSET;

  // To label: offset opposite to the edge direction (away from target) + perpendicular
  const toX = targetX - ux * ALONG_OFFSET + px * PERP_OFFSET;
  const toY = targetY - uy * ALONG_OFFSET + py * PERP_OFFSET;

  const fromAnchor = length > 0
    ? (dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle')
    : 'middle';
  const toAnchor = length > 0
    ? (dx > 0 ? 'end' : dx < 0 ? 'start' : 'middle')
    : 'middle';

  const stroke = selected ? '#3b82f6' : style?.stroke || '#374151';
  const strokeWidth = selected ? 2.5 : style?.strokeWidth || 2;

  return (
    <g>
      <path
        d={edgePath}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={strokeStyle}
        strokeLinejoin="round"
        strokeLinecap="round"
        markerEnd={markerEnd}
      />

      {children}

      {showLabels && cardinalityFrom && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={fromX - (fromAnchor === 'start' ? 1 : fromAnchor === 'end' ? cardinalityFrom.length * 7.2 + 5 : cardinalityFrom.length * 3.6 + 3)}
            y={fromY - 10}
            width={cardinalityFrom.length * 7.2 + 6}
            height={20}
            rx={3}
            fill="white"
            stroke="#94a3b8"
            strokeWidth={1}
          />
          <text
            x={fromX}
            y={fromY}
            textAnchor={fromAnchor}
            dominantBaseline="central"
            fontSize={LABEL_FONT_SIZE}
            fontWeight={600}
            fill="#1e293b"
            style={{ userSelect: 'none' }}
          >
            {cardinalityFrom}
          </text>
        </g>
      )}

      {showLabels && cardinalityTo && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={toX - (toAnchor === 'start' ? 1 : toAnchor === 'end' ? cardinalityTo.length * 7.2 + 5 : cardinalityTo.length * 3.6 + 3)}
            y={toY - 10}
            width={cardinalityTo.length * 7.2 + 6}
            height={20}
            rx={3}
            fill="white"
            stroke="#94a3b8"
            strokeWidth={1}
          />
          <text
            x={toX}
            y={toY}
            textAnchor={toAnchor}
            dominantBaseline="central"
            fontSize={LABEL_FONT_SIZE}
            fontWeight={600}
            fill="#1e293b"
            style={{ userSelect: 'none' }}
          >
            {cardinalityTo}
          </text>
        </g>
      )}
    </g>
  );
}

const UmlEdge = memo(UmlEdgeInner);

export default UmlEdge;
