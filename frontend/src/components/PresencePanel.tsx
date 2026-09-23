'use client';

import React, { useState } from 'react';
import { ConnectedUser } from '../hooks/useCollaborativeFlow';

interface PresencePanelProps {
  users: ConnectedUser[];
}

const MAX_VISIBLE = 5;

export default function PresencePanel({ users }: PresencePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - visible.length;
  const overflowNames = users.slice(MAX_VISIBLE).map((u) => u.name).join(', ');

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        title={`${users.length} usuario(s) conectado(s): ${users.map((u) => u.name).join(', ')}`}
      >
        {/* Stacked avatars with initials */}
        <div className="flex -space-x-1.5">
          {visible.map((u) => (
            <div
              key={u.id}
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm cursor-default"
              style={{ backgroundColor: u.color }}
              title={u.name}
            >
              {(u.name || '?').charAt(0).toUpperCase()}
            </div>
          ))}
          {overflow > 0 && (
            <div
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center bg-gray-400 text-white text-[10px] font-bold shadow-sm cursor-default"
              title={overflowNames}
            >
              +{overflow}
            </div>
          )}
        </div>
        <span className="hidden sm:inline ml-1">{users.length}</span>
      </button>

      {expanded && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] py-1">
          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
            Conectados
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
              title={u.name}
            >
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: u.color }}
              >
                {(u.name || '?').charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-gray-700 truncate">{u.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
