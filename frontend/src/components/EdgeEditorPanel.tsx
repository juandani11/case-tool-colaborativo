'use client';

import { useState, useEffect } from 'react';

interface EdgeData {
  type: 'ASSOCIATION' | 'INHERITANCE' | 'AGGREGATION' | 'COMPOSITION';
  cardinalityFrom: string;
  cardinalityTo: string;
}

interface EdgeEditorPanelProps {
  edgeId: string;
  initialData: EdgeData;
  onSave: (data: EdgeData) => void;
  onClose: () => void;
  // Clase asociativa (solo * a *): nombre del nodo vinculado (si existe,
  // modelo legacy) y acción para crearla (Opción A). Desvincular/restaurar
  // se hace desde el panel del nodo. Opcionales por compatibilidad.
  associationClassName?: string | null;
  onConvertToAssociationClass?: () => void;
}

function isMany(card?: string): boolean {
  if (!card) return false;
  const c = card.trim();
  return c === '*' || c === 'N' || c === 'M' || c === 'n' || c === 'm' || c.includes('*');
}

const RELATION_OPTIONS = [
  { value: 'ASSOCIATION', label: 'Asociacion', icon: (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5"/><path d="M14 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
  )},
  { value: 'INHERITANCE', label: 'Herencia', icon: (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 1.5"/><polygon points="15,3 18,6 15,9" fill="white" stroke="currentColor" strokeWidth="1.2"/></svg>
  )},
  { value: 'AGGREGATION', label: 'Agregacion', icon: (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5"/><polygon points="14,3 17,6 14,9 11,6" fill="white" stroke="currentColor" strokeWidth="1.2"/></svg>
  )},
  { value: 'COMPOSITION', label: 'Composicion', icon: (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5"/><polygon points="14,3 17,6 14,9 11,6" fill="currentColor" stroke="currentColor" strokeWidth="1.2"/></svg>
  )},
];

export default function EdgeEditorPanel({
  edgeId,
  initialData,
  onSave,
  onClose,
  associationClassName,
  onConvertToAssociationClass,
}: EdgeEditorPanelProps) {
  const [state, setState] = useState<EdgeData>({
    type: initialData.type,
    cardinalityFrom: initialData.cardinalityFrom,
    cardinalityTo: initialData.cardinalityTo,
  });

  const isManyToMany = isMany(state.cardinalityFrom) && isMany(state.cardinalityTo);

  useEffect(() => {
    setState({
      type: initialData.type,
      cardinalityFrom: initialData.cardinalityFrom,
      cardinalityTo: initialData.cardinalityTo,
    });
  }, [initialData, edgeId]);

  const cardinalityOptions = ['1', '0..1', '*', '1..*', '0..*', '0', '1..'];

  const handleChange = (
    field: 'cardinalityFrom' | 'cardinalityTo' | 'type',
    value: string
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave({
      type: state.type,
      cardinalityFrom: state.cardinalityFrom,
      cardinalityTo: state.cardinalityTo,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-80 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="3" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <circle cx="13" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          <span className="font-semibold text-sm">Editar Relacion</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-indigo-500 transition-colors"
          title="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Relation Type */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Tipo de relacion</label>
          <div className="grid grid-cols-2 gap-1.5">
            {RELATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleChange('type', opt.value)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  state.type === opt.value
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300 shadow-sm'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <span className={state.type === opt.value ? 'text-indigo-600' : 'text-gray-400'}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cardinality From */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cardinalidad origen</label>
          <select
            value={state.cardinalityFrom}
            onChange={(e) => handleChange('cardinalityFrom', e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          >
            {cardinalityOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Cardinality To */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cardinalidad destino</label>
          <select
            value={state.cardinalityTo}
            onChange={(e) => handleChange('cardinalityTo', e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          >
            {cardinalityOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Clase asociativa (solo * a *) */}
        {(onConvertToAssociationClass || associationClassName) && (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Clase asociativa
            </label>
            {associationClassName ? (
              <p className="text-[11px] text-gray-500">
                Vinculada a <span className="font-medium text-amber-800">{associationClassName}</span>.
                Selecciónala para editarla o desvincularla.
              </p>
            ) : isManyToMany ? (
              <button
                onClick={onConvertToAssociationClass}
                className="w-full px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-lg border border-amber-200 transition-colors"
              >
                Convertir en clase asociativa
              </button>
            ) : (
              <p className="text-[11px] text-gray-400">
                Requiere * en ambos extremos. Guarda primero las cardinalidades.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
