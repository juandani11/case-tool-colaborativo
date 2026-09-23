'use client';

import { useEffect, useState, memo } from 'react';
import { EntityNodeData, Attribute, Method, MethodParameter } from '../types/diagram';

export interface AssociationInfo {
  fromName: string;
  toName: string;
  // true: vínculo legacy (associationClassId en la arista, la arista sigue
  // existiendo) -> desvincular conserva el nodo. false: modelo nuevo con
  // respaldo -> restaurar recrea la arista y elimina el nodo.
  isLegacy: boolean;
}

interface EntityEditorPanelProps {
  nodeId: string;
  initialData: EntityNodeData;
  onSave: (id: string, data: EntityNodeData) => void;
  onClose: () => void;
  associationInfo?: AssociationInfo | null;
  onDissolveAssociation?: () => void;
}

const initialMethod: Method = {
  id: '',
  name: 'nuevoMetodo',
  returnType: 'void',
  parameters: [],
  visibility: 'public',
};

const initialParameter: MethodParameter = {
  name: 'param',
  type: 'String',
};

const EntityEditorPanel = memo(function EntityEditorPanel({
  nodeId,
  initialData,
  onSave,
  onClose,
  associationInfo,
  onDissolveAssociation,
}: EntityEditorPanelProps) {
  const [label, setLabel] = useState(initialData.label);
  const [attributes, setAttributes] = useState<Attribute[]>(initialData.attributes || []);
  const [methods, setMethods] = useState<Method[]>(initialData.methods || []);
  const [stereotype, setStereotype] = useState<'class' | 'interface'>(initialData.stereotype || 'class');

  useEffect(() => {
    setLabel(initialData.label);
    setAttributes(initialData.attributes || []);
    setMethods(initialData.methods || []);
    setStereotype(initialData.stereotype || 'class');
  }, [nodeId, initialData.label, initialData.attributes, initialData.methods, initialData.stereotype]);

  const handleSave = () => {
    onSave(nodeId, { label, attributes, methods, stereotype });
  };

  const handleAddAttribute = () => {
    const newAttr: Attribute = {
      id: `attr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: 'nuevoAtributo',
      type: 'String',
      isPk: false,
      nullable: true,
      unique: false,
    };
    setAttributes([...attributes, newAttr]);
  };

  const handleRemoveAttribute = (attrId: string) => {
    setAttributes(attributes.filter((a) => a.id !== attrId));
  };

  const handleUpdateAttribute = (attrId: string, field: keyof Attribute, value: any) => {
    setAttributes(
      attributes.map((a) => (a.id === attrId ? { ...a, [field]: value } : a))
    );
  };

  const handleAddMethod = () => {
    const newMethod: Method = {
      id: `method_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: 'nuevoMetodo',
      returnType: 'void',
      parameters: [],
      visibility: 'public',
    };
    setMethods([...methods, newMethod]);
  };

  const handleRemoveMethod = (methodId: string) => {
    setMethods(methods.filter((m) => m.id !== methodId));
  };

  const handleUpdateMethod = (methodId: string, field: keyof Method, value: any) => {
    setMethods(
      methods.map((m) => (m.id === methodId ? { ...m, [field]: value } : m))
    );
  };

  const handleAddParameter = (methodId: string) => {
    const newParam = { name: 'param', type: 'String' };
    setMethods(
      methods.map((m) =>
        m.id === methodId ? { ...m, parameters: [...m.parameters, newParam] } : m
      )
    );
  };

  const handleRemoveParameter = (methodId: string, paramIndex: number) => {
    setMethods(
      methods.map((m) =>
        m.id === methodId
          ? { ...m, parameters: m.parameters.filter((_, i) => i !== paramIndex) }
          : m
      )
    );
  };

  const handleUpdateParameter = (methodId: string, paramIndex: number, field: 'name' | 'type', value: any) => {
    setMethods(
      methods.map((m) =>
        m.id === methodId
          ? {
              ...m,
              parameters: m.parameters.map((p, i) =>
                i === paramIndex ? { ...p, [field]: value } : p
              ),
            }
          : m
      )
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-80 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1"/>
          </svg>
          <span className="font-semibold text-sm">Editar Entidad</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-blue-500 transition-colors"
          title="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Stereotype */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Estereotipo</label>
          <select
            value={stereotype}
            onChange={(e) => setStereotype(e.target.value as 'class' | 'interface')}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="class">Clase</option>
            <option value="interface">Interfaz</option>
          </select>
        </div>

        {/* Clase asociativa */}
        {associationInfo && onDissolveAssociation && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">
              Clase asociativa
            </div>
            <p className="text-[11px] text-amber-800 mb-2">
              Conecta {associationInfo.fromName} *---* {associationInfo.toName} con línea punteada al punto medio.
            </p>
            <button
              onClick={onDissolveAssociation}
              className="w-full px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-lg border border-amber-300 transition-colors"
            >
              Eliminar clase asociativa
            </button>
            <p className="text-[10px] text-amber-600 mt-1">
              La arista * a * queda intacta.
            </p>
          </div>
        )}

        {/* Attributes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Atributos</span>
            <button
              onClick={handleAddAttribute}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Agregar
            </button>
          </div>
          {attributes.length === 0 ? (
            <p className="text-gray-300 text-xs italic">Sin atributos</p>
          ) : (
            <div className="space-y-2">
              {attributes.map((attr) => (
                <div key={attr.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                  <div className="flex gap-1.5 mb-1.5">
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => handleUpdateAttribute(attr.id, 'name', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nombre"
                    />
                    <select
                      value={attr.type}
                      onChange={(e) => handleUpdateAttribute(attr.id, 'type', e.target.value)}
                      className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="String">String</option>
                      <option value="Integer">Integer</option>
                      <option value="UUID">UUID</option>
                      <option value="BigDecimal">BigDecimal</option>
                      <option value="Date">Date</option>
                      <option value="Boolean">Boolean</option>
                      <option value="etc">etc</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attr.isPk}
                        onChange={(e) => handleUpdateAttribute(attr.id, 'isPk', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-600">PK</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attr.nullable}
                        onChange={(e) => handleUpdateAttribute(attr.id, 'nullable', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-600">Nullable</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attr.unique}
                        onChange={(e) => handleUpdateAttribute(attr.id, 'unique', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-600">Unique</span>
                    </label>
                    <button
                      onClick={() => handleRemoveAttribute(attr.id)}
                      className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Methods */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Metodos</span>
            <button
              onClick={handleAddMethod}
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
                      onChange={(e) => handleUpdateMethod(method.id, 'visibility', e.target.value)}
                      className="px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="public">+</option>
                      <option value="private">-</option>
                      <option value="protected">#</option>
                    </select>
                    <input
                      type="text"
                      value={method.name}
                      onChange={(e) => handleUpdateMethod(method.id, 'name', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nombre"
                    />
                    <input
                      type="text"
                      value={method.returnType}
                      onChange={(e) => handleUpdateMethod(method.id, 'returnType', e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Retorno"
                    />
                    <button
                      onClick={() => handleRemoveMethod(method.id)}
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
                        onClick={() => handleAddParameter(method.id)}
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
                          onChange={(e) => handleUpdateParameter(method.id, paramIndex, 'name', e.target.value)}
                          className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Nombre"
                        />
                        <select
                          value={param.type}
                          onChange={(e) => handleUpdateParameter(method.id, paramIndex, 'type', e.target.value)}
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
                          onClick={() => handleRemoveParameter(method.id, paramIndex)}
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
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
});

export default EntityEditorPanel;
