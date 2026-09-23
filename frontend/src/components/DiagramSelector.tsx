'use client';

import React, { useState } from 'react';

export interface DiagramInfo {
  id: string;
  name: string;
}

interface DiagramSelectorProps {
  diagrams: DiagramInfo[];
  currentDiagramId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function DiagramSelector({
  diagrams,
  currentDiagramId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: DiagramSelectorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = (diagram: DiagramInfo) => {
    setEditingId(diagram.id);
    setEditValue(diagram.name);
  };

  const handleRenameSubmit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <div className="px-2 py-2 border-b border-gray-200">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Diagramas</span>
        <button
          onClick={onCreate}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-100 text-blue-500 hover:text-blue-600 transition-colors"
          title="Nuevo diagrama"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <ul className="space-y-px">
        {diagrams.map((diagram) => (
          <li key={diagram.id}>
            <div
              className={`group flex items-center gap-1 w-full rounded-md transition-all duration-150 ${
                currentDiagramId === diagram.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'hover:bg-gray-200/70 text-gray-600'
              }`}
            >
              <button
                onClick={() => onSelect(diagram.id)}
                className="flex-1 text-left px-2 py-1.5 flex items-center gap-2 min-w-0"
                onDoubleClick={() => handleDoubleClick(diagram)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`flex-shrink-0 ${currentDiagramId === diagram.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                  <line x1="1" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="0.8"/>
                </svg>
                {editingId === diagram.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(diagram.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(diagram.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 min-w-0 text-xs bg-white text-gray-800 px-1 py-0.5 rounded border border-blue-300 outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate text-xs font-medium">{diagram.name}</span>
                )}
              </button>
              {diagrams.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Eliminar "${diagram.name}"?`)) return;
                    onDelete(diagram.id);
                  }}
                  className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${
                    currentDiagramId === diagram.id
                      ? 'text-blue-200 hover:text-white hover:bg-blue-400'
                      : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title="Eliminar diagrama"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
