'use client';

import React from 'react';
import { Node, Edge } from 'reactflow';
import { EntityNodeData, RelationshipData } from '../types/diagram';

interface SidebarProps {
  nodes: Node<EntityNodeData>[];
  edges: Edge<RelationshipData>[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  diagramSelector?: React.ReactNode;
}

const RELATION_LABELS: Record<RelationshipData['type'], string> = {
  ASSOCIATION: 'Asoc',
  INHERITANCE: 'Herencia',
  AGGREGATION: 'Agreg',
  COMPOSITION: 'Compos',
  ONE_TO_ONE: '1:1',
  ONE_TO_MANY: '1:N',
  MANY_TO_ONE: 'N:1',
  MANY_TO_MANY: 'N:M',
};

const RELATION_COLORS: Record<RelationshipData['type'], string> = {
  ASSOCIATION: 'bg-gray-100 text-gray-600',
  INHERITANCE: 'bg-amber-50 text-amber-700',
  AGGREGATION: 'bg-blue-50 text-blue-700',
  COMPOSITION: 'bg-purple-50 text-purple-700',
  ONE_TO_ONE: 'bg-gray-100 text-gray-600',
  ONE_TO_MANY: 'bg-blue-50 text-blue-700',
  MANY_TO_ONE: 'bg-blue-50 text-blue-700',
  MANY_TO_MANY: 'bg-purple-50 text-purple-700',
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  class: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  interface: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 1.5"/>
      <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 1.5"/>
    </svg>
  ),
};

export default function Sidebar({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  collapsed,
  onToggleCollapse,
  diagramSelector,
}: SidebarProps) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  if (collapsed) {
    return (
      <div className="w-10 h-full flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col items-center pt-2 gap-3 transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 transition-colors"
          title="Expandir panel"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="w-5 h-px bg-gray-300" />
        <div className="text-[10px] text-gray-400 font-medium writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>
          EXPLORADOR
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 h-full flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col text-sm transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-400">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1"/>
          </svg>
          <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Explorador</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Colapsar panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 4l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Diagram Selector */}
      {diagramSelector}

      {/* Entities */}
      <div className="px-2 py-2">
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entidades</span>
          <span className="text-[10px] font-mono text-gray-300 bg-gray-100 px-1.5 rounded">{nodes.length}</span>
        </div>
        {nodes.length === 0 ? (
          <p className="text-gray-300 text-xs italic px-1">Sin entidades</p>
        ) : (
          <ul className="space-y-px">
            {nodes.map(node => {
              const isInterface = node.data?.stereotype === 'interface';
              return (
                <li key={node.id}>
                  <button
                    onClick={() => onSelectNode(node.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 transition-all duration-150 group ${
                      selectedNodeId === node.id
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'hover:bg-gray-200/70 text-gray-600'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${selectedNodeId === node.id ? 'text-blue-100' : isInterface ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-500'}`}>
                      {isInterface ? ENTITY_ICONS.interface : ENTITY_ICONS.class}
                    </span>
                    <span className="truncate text-xs font-medium">
                      {node.data?.label || '(sin nombre)'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mx-2 h-px bg-gray-200" />

      {/* Relations */}
      <div className="px-2 py-2 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Relaciones</span>
          <span className="text-[10px] font-mono text-gray-300 bg-gray-100 px-1.5 rounded">{edges.length}</span>
        </div>
        {edges.length === 0 ? (
          <p className="text-gray-300 text-xs italic px-1">Sin relaciones</p>
        ) : (
          <ul className="space-y-px">
            {edges.map(edge => {
              const srcNode = nodeMap.get(edge.source);
              const tgtNode = nodeMap.get(edge.target);
              const srcLabel = srcNode?.data?.label || edge.source;
              const tgtLabel = tgtNode?.data?.label || edge.target;
              const relType = edge.data?.type || 'ASSOCIATION';
              const relLabel = RELATION_LABELS[relType] || relType;
              const colorClass = RELATION_COLORS[relType] || RELATION_COLORS.ASSOCIATION;

              return (
                <li key={edge.id}>
                  <button
                    onClick={() => onSelectEdge(edge.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-all duration-150 ${
                      selectedEdgeId === edge.id
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'hover:bg-gray-200/70 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{srcLabel}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`flex-shrink-0 ${selectedEdgeId === edge.id ? 'text-blue-200' : 'text-gray-300'}`}>
                        <path d="M2 5h6m0 0L6 3m2 2L6 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="truncate text-xs font-medium">{tgtLabel}</span>
                    </div>
                    <div className="mt-0.5">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${selectedEdgeId === edge.id ? 'bg-blue-400/30 text-blue-100' : colorClass}`}>
                        {relLabel}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
