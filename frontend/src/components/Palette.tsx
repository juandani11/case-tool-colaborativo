'use client';

import { EntityNodeData } from '../types/diagram';

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
    description: 'Clase UML estandar',
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
  { id: 'association', label: 'Asociacion', icon: '\u2500\u2500\u2500', description: 'Relacion simple', edgeType: 'association', relationshipType: 'ASSOCIATION' },
  { id: 'inheritance', label: 'Herencia', icon: '\u2500\u2500\u25B7', description: 'Generalizacion', edgeType: 'inheritance', relationshipType: 'INHERITANCE' },
  { id: 'composition', label: 'Composicion', icon: '\u2500\u2500\u25C6', description: 'Composicion (rombo lleno)', edgeType: 'composition', relationshipType: 'COMPOSITION' },
  { id: 'aggregation', label: 'Agregacion', icon: '\u2500\u2500\u25C7', description: 'Agregacion (rombo vacio)', edgeType: 'aggregation', relationshipType: 'AGGREGATION' },
];

interface PaletteProps {
  activeRelationType: string | null;
  onSelectRelationType: (type: string | null) => void;
}

export default function Palette({ activeRelationType, onSelectRelationType }: PaletteProps) {
  function handleDragStart(e: React.DragEvent, item: PaletteItem) {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ itemId: item.id, defaultData: item.defaultData })
    );
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="w-52 bg-white border-r border-gray-200 p-3 overflow-y-auto flex-shrink-0">
      {/* Elementos */}
      <h3 className="text-xs uppercase font-semibold text-gray-500 mb-3">
        Elementos
      </h3>
      <div className="space-y-1 mb-6">
        {ITEMS.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 cursor-grab active:cursor-grabbing text-sm"
            title={item.description}
          >
            <span className="text-lg w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Relaciones */}
      <h3 className="text-xs uppercase font-semibold text-gray-500 mb-3">
        Relaciones
      </h3>
      <div className="space-y-1">
        {RELATIONSHIPS.map((rel) => (
          <div
            key={rel.id}
            onClick={() => onSelectRelationType(activeRelationType === rel.id ? null : rel.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
              activeRelationType === rel.id
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title={rel.description}
          >
            <span className="text-lg w-5 text-center font-mono">{rel.icon}</span>
            <span>{rel.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
