'use client';

import { EntityNodeData } from '../types/diagram';

// Paleta lateral con DOS modos (solo visible en modo edicion, no VIEWER):
// - Elementos: drag-and-drop al canvas (ITEMS de abajo).
// - Relaciones: click en el tipo -> modo conexion (click origen, click
//   destino). El estado del modo vive en page.tsx, no aqui: la paleta
//   solo emite la seleccion via RELATIONSHIPS.
interface PaletteItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  defaultData: Partial<EntityNodeData>;
}

const ITEMS: PaletteItem[] = [
  {
    id: 'class',
    label: 'Clase',
    icon: '\u25A1',
    description: 'Clase UML estándar',
    defaultData: { label: 'NuevaClase', attributes: [], methods: [], stereotype: 'class' },
  },
  {
    id: 'interface',
    label: 'Interfaz',
    icon: '\u25CB',
    description: 'Interfaz UML (<<interface>>)',
    defaultData: { label: 'NuevaInterfaz', attributes: [], methods: [], stereotype: 'interface' },
  },
  {
    id: 'abstract',
    label: 'Clase abstracta',
    icon: '\u25C7',
    description: 'Clase abstracta UML',
    defaultData: { label: 'NuevaAbstracta', attributes: [], methods: [], stereotype: 'class', isAbstract: true },
  },
  {
    id: 'note',
    label: 'Nota',
    icon: '\uD83D\uDCDD',
    description: 'Nota de texto libre',
    defaultData: { label: 'Nota', attributes: [], methods: [], stereotype: 'class', isNote: true },
  },
];

export interface RelationshipOption {
  id: string;
  label: string;
  icon: string;
  description: string;
  edgeType: string;
  relationshipType: string;
}

export const RELATIONSHIPS: RelationshipOption[] = [
  { id: 'association', label: 'Asociación', icon: '\u2500\u2500\u2500', description: 'Relación simple', edgeType: 'association', relationshipType: 'ASSOCIATION' },
  { id: 'inheritance', label: 'Herencia', icon: '\u2500\u2500\u25B7', description: 'Generalización', edgeType: 'inheritance', relationshipType: 'INHERITANCE' },
  { id: 'composition', label: 'Composición', icon: '\u2500\u2500\u25C6', description: 'Composición (rombo lleno)', edgeType: 'composition', relationshipType: 'COMPOSITION' },
  { id: 'aggregation', label: 'Agregación', icon: '\u2500\u2500\u25C7', description: 'Agregación (rombo vacío)', edgeType: 'aggregation', relationshipType: 'AGGREGATION' },
];

interface PaletteProps {
  activeRelationType: string | null;
  onSelectRelationType: (type: string | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Palette({
  activeRelationType,
  onSelectRelationType,
  collapsed,
  onToggleCollapse,
}: PaletteProps) {
  function handleDragStart(e: React.DragEvent, item: PaletteItem) {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ itemId: item.id, defaultData: item.defaultData })
    );
    e.dataTransfer.effectAllowed = 'move';
  }

  if (collapsed) return null;

  return (
    <aside className="w-52 bg-white border-r border-gray-200 p-3 overflow-y-auto flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase font-semibold text-gray-500">Paleta</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Ocultar paleta"
          aria-label="Ocultar paleta"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 4l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <section className="border-b border-gray-200 pb-3 mb-3">
        <h3 className="text-xs uppercase font-semibold text-gray-500 mb-2">
          Elementos
        </h3>
        <div className="space-y-1">
          {ITEMS.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-gray-100 cursor-grab active:cursor-grabbing text-sm"
              title={item.description}
            >
              <span className="w-6 flex-shrink-0 text-center text-lg leading-none">{item.icon}</span>
              <span className="min-w-0 truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase font-semibold text-gray-500 mb-2">
          Relaciones
        </h3>
        <div className="space-y-1">
          {RELATIONSHIPS.map((rel) => (
            <button
              key={rel.id}
              type="button"
              onClick={() => onSelectRelationType(activeRelationType === rel.id ? null : rel.id)}
              aria-pressed={activeRelationType === rel.id}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-sm transition-colors ${
                activeRelationType === rel.id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              title={rel.description}
            >
              <span className="w-6 flex-shrink-0 text-center font-mono text-base leading-none">{rel.icon}</span>
              <span className="min-w-0 truncate">{rel.label}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
