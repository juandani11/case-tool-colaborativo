'use client';

import { Method } from '../types/diagram';

interface EntityMethodsEditorProps {
  methods: Method[];
  onAdd: () => void;
  onRemove: (methodId: string) => void;
  onUpdate: (methodId: string, field: keyof Method, value: any) => void;
  onAddParameter: (methodId: string) => void;
  onRemoveParameter: (methodId: string, paramIndex: number) => void;
  onUpdateParameter: (
    methodId: string,
    paramIndex: number,
    field: 'name' | 'type',
    value: any
  ) => void;
}

export default function EntityMethodsEditor({
  methods,
  onAdd,
  onRemove,
  onUpdate,
  onAddParameter,
  onRemoveParameter,
  onUpdateParameter,
}: EntityMethodsEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Metodos</span>
        <button
          onClick={onAdd}
          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Agregar
        </button>
      </div>
      {methods.length === 0 ? (
        <p className="text-gray-300 text-xs italic">Sin metodos</p>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <div key={method.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              <div className="flex gap-1.5 mb-1.5">
                <select
                  value={method.visibility}
                  onChange={(e) => onUpdate(method.id, 'visibility', e.target.value)}
                  className="px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="public">+</option>
                  <option value="private">-</option>
                  <option value="protected">#</option>
                </select>
                <input
                  type="text"
                  value={method.name}
                  onChange={(e) => onUpdate(method.id, 'name', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nombre"
                />
                <input
                  type="text"
                  value={method.returnType}
                  onChange={(e) => onUpdate(method.id, 'returnType', e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Retorno"
                />
                <button
                  onClick={() => onRemove(method.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="ml-4 mt-1 space-y-1">
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <span>Parametros</span>
                  <button
                    onClick={() => onAddParameter(method.id)}
                    className="text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    + agregar
                  </button>
                </div>
                {method.parameters.map((param, paramIndex) => (
                  <div key={paramIndex} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => onUpdateParameter(method.id, paramIndex, 'name', e.target.value)}
                      className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nombre"
                    />
                    <select
                      value={param.type}
                      onChange={(e) => onUpdateParameter(method.id, paramIndex, 'type', e.target.value)}
                      className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="String">String</option>
                      <option value="Integer">Integer</option>
                      <option value="UUID">UUID</option>
                      <option value="BigDecimal">BigDecimal</option>
                      <option value="Date">Date</option>
                      <option value="Boolean">Boolean</option>
                    </select>
                    <button
                      onClick={() => onRemoveParameter(method.id, paramIndex)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
