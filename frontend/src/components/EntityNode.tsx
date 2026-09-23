import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { EntityNodeData, Method } from '../types/diagram';

const visibilitySymbol = (visibility: Method['visibility']) => {
  switch (visibility) {
    case 'public': return '+';
    case 'private': return '-';
    case 'protected': return '#';
  }
};

const formatParameters = (parameters: Method['parameters']) => {
  return parameters.map(p => `${p.name}: ${p.type}`).join(', ');
};

const EntityNode = ({ data, selected }: NodeProps<EntityNodeData>) => {
  const hasMethods = data.methods && data.methods.length > 0;
  const hasAttributes = data.attributes && data.attributes.length > 0;
  const isInterface = data.stereotype === 'interface';
  const isAssociationClass = !isInterface && !!data.isAssociationClass;
  const isAbstract = !!data.isAbstract;
  const isNote = !!data.isNote;

  // Nota: fondo amarillo, solo texto
  if (isNote) {
    return (
      <div
        style={{ position: 'relative', zIndex: 0 }}
        className={`group min-w-[180px] max-w-[260px] transition-shadow duration-200 ${
          selected
            ? 'shadow-lg ring-2 ring-blue-500 ring-offset-1'
            : 'shadow-md hover:shadow-lg'
        } bg-yellow-50 border border-yellow-200 rounded-lg`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !-top-1.5 opacity-40 group-hover:opacity-100 transition-opacity"
        />
        <div className="px-3 py-2">
          <div className="text-xs text-yellow-800 italic whitespace-pre-wrap">
            {data.label || 'Nota'}
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !-bottom-1.5 opacity-40 group-hover:opacity-100 transition-opacity"
        />
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', zIndex: 0 }}
      className={`group bg-white rounded-lg min-w-[220px] max-w-[300px] transition-shadow duration-200 ${
        selected
          ? 'shadow-lg ring-2 ring-blue-500 ring-offset-1'
          : 'shadow-md hover:shadow-lg'
      } ${isInterface ? 'border-2 border-dashed border-purple-300' : isAssociationClass ? 'border-2 border-dashed border-amber-400' : 'border border-gray-200'}`}
    >
      {/* Soft-lock label */}
      {data.lockedBy && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-[10px] font-bold whitespace-nowrap z-10"
          style={{ backgroundColor: data.lockedBy.color }}
        >
          {data.lockedBy.name}
        </div>
      )}
      {/* Sutiles pero funcionales: crear conexiones arrastrando desde ellos */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !-top-1.5 opacity-40 group-hover:opacity-100 transition-opacity"
      />

      {/* Header */}
      <div
        className={`px-3 py-2 rounded-t-lg ${
          isInterface
            ? 'bg-purple-50 border-b border-purple-100'
            : 'bg-blue-600'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {isInterface && (
            <span className="text-[9px] font-mono text-purple-500 bg-purple-100 px-1 py-0.5 rounded">
              {'<<interface>>'}
            </span>
          )}
          {isAbstract && (
            <span className="text-[9px] font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
              {'<<abstract>>'}
            </span>
          )}
          {isAssociationClass && (
            <span className="text-[9px] font-mono text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
              {'<<association>>'}
            </span>
          )}
        </div>
        <div className={`font-bold text-sm mt-0.5 ${isInterface ? 'text-purple-800 italic' : isAbstract ? 'text-white italic' : 'text-white'}`}>
          {data.label}
        </div>
      </div>

      {/* Attributes */}
      {hasAttributes && (
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Atributos
          </div>
          <div className="space-y-0.5">
            {data.attributes.map(attr => (
              <div key={attr.id} className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400 font-mono text-[10px] w-3 text-center flex-shrink-0">
                  {attr.isPk ? (
                    <span className="text-amber-500" title="Primary Key">&#9670;</span>
                  ) : attr.nullable ? (
                    <span className="text-gray-300">&#9671;</span>
                  ) : (
                    <span className="text-gray-300">&#9670;</span>
                  )}
                </span>
                <span className="text-gray-800 font-medium truncate">{attr.name}</span>
                <span className="text-gray-400 text-[10px] ml-auto flex-shrink-0">{attr.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Methods */}
      {hasMethods && (
        <div className="px-3 py-2">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Métodos
          </div>
          <div className="space-y-0.5">
            {data.methods.map(method => (
              <div key={method.id} className="flex items-center gap-1 text-xs font-mono">
                <span className={`w-3 text-center flex-shrink-0 ${
                  method.visibility === 'public' ? 'text-emerald-500' :
                  method.visibility === 'private' ? 'text-red-400' :
                  'text-amber-500'
                }`}>
                  {visibilitySymbol(method.visibility)}
                </span>
                <span className="text-gray-800 truncate">{method.name}</span>
                <span className="text-gray-400 text-[10px]">({formatParameters(method.parameters)})</span>
                <span className="text-gray-400 text-[10px]">: {method.returnType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAttributes && !hasMethods && (
        <div className="px-3 py-2 text-gray-300 text-xs italic text-center">
          Sin contenido
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !-bottom-1.5 opacity-40 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
};

export default memo(EntityNode);
