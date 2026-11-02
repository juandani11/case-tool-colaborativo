'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDiagramDate } from '../lib/formatDate';

// Card del dashboard: nombre, conteos, fecha relativa, badge de rol
// (OWNER azul, EDITOR verde, VIEWER gris) y dueño si es compartido.
// Las acciones rápidas delegan en Dashboard; la card no conoce la API.
export interface DiagramCardData {
  id: string;
  name: string;
  entityCount: number;
  relationshipCount: number;
  updatedAt: string | number;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  ownerUsername?: string;
}

interface Props {
  diagram: DiagramCardData;
  onRename?: (diagram: DiagramCardData) => void;
  onDelete?: (diagram: DiagramCardData) => void;
}

export function DiagramCard({ diagram, onRename, onDelete }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canRename = diagram.role !== 'VIEWER' && Boolean(onRename);
  const canDelete = diagram.role === 'OWNER' && Boolean(onDelete);
  const hasMenu = canRename || canDelete;

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [menuOpen]);

  const navigate = () => router.push(`/diagram/${diagram.id}`);

  const roleColor =
    diagram.role === 'OWNER'
      ? 'bg-blue-100 text-blue-700'
      : diagram.role === 'EDITOR'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-700';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate();
    }
  };

  const handleRename = (event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(false);
    onRename?.(diagram);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuOpen(false);
    onDelete?.(diagram);
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={handleKeyDown}
      aria-label={`Abrir diagrama ${diagram.name}`}
      className="relative bg-white border border-gray-200 rounded-lg p-4 transition-all cursor-pointer h-full flex flex-col hover:shadow-lg hover:border-blue-500"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 line-clamp-2 min-w-0 flex-1">
          {diagram.name}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${roleColor}`}>
            {diagram.role}
          </span>
          {hasMenu && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Opciones del diagrama"
                aria-label="Opciones del diagrama"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="3" r="1.3" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.3" fill="currentColor" />
                  <circle cx="8" cy="13" r="1.3" fill="currentColor" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {canRename && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleRename}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Renombrar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDelete}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-500 space-y-1 flex-1">
        <p>
          {diagram.entityCount}{' '}
          {diagram.entityCount === 1 ? 'entidad' : 'entidades'}
        </p>
        <p>
          {diagram.relationshipCount}{' '}
          {diagram.relationshipCount === 1 ? 'relación' : 'relaciones'}
        </p>
        {diagram.ownerUsername && (
          <p className="text-xs">
            De: <span className="font-medium">{diagram.ownerUsername}</span>
          </p>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {formatDiagramDate(diagram.updatedAt)}
      </p>
    </div>
  );
}
