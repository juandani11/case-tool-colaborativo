'use client';

import Link from 'next/link';

interface Props {
  diagram: {
    id: string;
    name: string;
    entityCount: number;
    relationshipCount: number;
    updatedAt: string;
    role: 'OWNER' | 'EDITOR' | 'VIEWER';
    ownerUsername?: string;
  };
}

export function DiagramCard({ diagram }: Props) {
  const roleColor =
    diagram.role === 'OWNER'
      ? 'bg-blue-100 text-blue-700'
      : diagram.role === 'EDITOR'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-700';

  return (
    <Link href={`/diagram/${diagram.id}`}>
      <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
            {diagram.name}
          </h3>
          <span
            className={`text-xs px-2 py-1 rounded ml-2 whitespace-nowrap ${roleColor}`}
          >
            {diagram.role}
          </span>
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
          {formatRelative(diagram.updatedAt)}
        </p>
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `Hace ${diffD} d`;
  return date.toLocaleDateString();
}
