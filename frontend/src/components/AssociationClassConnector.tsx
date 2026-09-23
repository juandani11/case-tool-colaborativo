import { memo } from 'react';
import { useStore } from 'reactflow';
import { computeConnectorLines } from '../utils/associationClass';

// Overlay SVG (Bloque 2, notación UML 2.5): una sola línea punteada desde el
// punto medio de cada arista * a * con clase asociativa hasta el borde del
// nodo. Se re-dibuja solo (B2-B/C) porque se suscribe a las posiciones de
// los nodos y al viewport. No intercepta eventos (pointerEvents none).
function AssociationClassConnector() {
  const nodeInternals = useStore((s) => s.nodeInternals);
  const edges = useStore((s) => s.edges);
  const transform = useStore((s) => s.transform);
  // Suscripción a posiciones/tamaños: nueva cadena en cada cambio -> re-render.
  useStore((s) =>
    [...s.nodeInternals.values()]
      .map((n: any) => `${n.id}:${n.positionAbsolute?.x},${n.positionAbsolute?.y},${n.width},${n.height}`)
      .join('|')
  );

  const nodes = [...nodeInternals.values()].map((n: any) => ({
    id: n.id,
    x: n.positionAbsolute?.x ?? n.position?.x ?? 0,
    y: n.positionAbsolute?.y ?? n.position?.y ?? 0,
    w: n.width ?? 240,
    h: n.height ?? 120,
  }));

  const lines = computeConnectorLines(nodes, edges || []);
  if (lines.length === 0) return null;

  const [tx, ty, k] = transform || [0, 0, 1];

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <g transform={`translate(${tx},${ty}) scale(${k})`}>
        {lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5,5"
          />
        ))}
      </g>
    </svg>
  );
}

export default memo(AssociationClassConnector);
