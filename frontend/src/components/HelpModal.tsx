'use client';

import { useState, useEffect } from 'react';
import { MANUAL_SECTIONS } from '../data/manual';
import ReactMarkdown from 'react-markdown';

// Manual de usuario embebido: indice lateral + buscador (titulo y contenido)
// + render Markdown. Cierra con Escape, click-fuera (el overlay) y la X;
// el click DENTRO se frena con stopPropagation para no cerrar al leer.
// `if (!isOpen) return null`: desmontado cuando esta cerrado (sin listeners).
interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeSection, setActiveSection] = useState(MANUAL_SECTIONS[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSection = MANUAL_SECTIONS.find(s => s.id === activeSection);
  const filteredSections = searchQuery
    ? MANUAL_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : MANUAL_SECTIONS;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📘</span>
            <h2 className="text-xl font-bold">Manual de Usuario</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none px-2"
            aria-label="Cerrar manual"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 border-r overflow-y-auto p-3 bg-gray-50 flex-shrink-0">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 mb-3 text-sm border rounded"
            />
            <nav className="space-y-1">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span>{section.title}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {currentSection ? (
              <article className="prose prose-sm max-w-none">
                <ReactMarkdown>{currentSection.content}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-gray-500">Selecciona una seccion.</p>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Herramienta CASE Colaborativa v1.0</span>
          <span>Presiona Escape para cerrar</span>
        </div>
      </div>
    </div>
  );
}
