'use client';

import { useState } from 'react';
import { useDiagramMembers } from '../hooks/useDiagramMembers';

// Vista de colaboradores: la logica de API y estado vive en useDiagramMembers.
interface MembersPanelProps {
  diagramId: string;
  onClose: () => void;
}

export default function MembersPanel({ diagramId, onClose }: MembersPanelProps) {
  const {
    owner,
    members,
    loading,
    error,
    busy,
    invite,
    changeRole,
    removeMember,
  } = useDiagramMembers(diagramId);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const username = inviteName.trim();
    if (!username) return;
    const ok = await invite(username, inviteRole);
    if (ok) setInviteName('');
  }

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-80 overflow-hidden flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white flex-shrink-0">
        <span className="font-semibold text-sm">Miembros</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-indigo-500 transition-colors"
          title="Cerrar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        {error && (
          <div className="bg-red-50 text-red-700 p-2 rounded text-xs">{error}</div>
        )}

        {loading ? (
          <p className="text-xs text-gray-400">Cargando...</p>
        ) : (
          <>
            {owner && (
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Owner
                </label>
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
                  {owner.username}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Miembros ({members.length})
              </label>
              {members.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin miembros todavía.</p>
              ) : (
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <span className="flex-1 text-xs font-medium text-gray-700 truncate" title={m.email}>
                        {m.username || 'desconocido'}
                      </span>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value as 'EDITOR' | 'VIEWER')}
                        className="text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Lector</option>
                      </select>
                      <button
                        onClick={() => removeMember(m.userId)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-xs px-1"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <form onSubmit={handleInvite} className="space-y-2">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Invitar por username
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="username"
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
              className="text-[11px] border border-gray-200 rounded-lg px-1.5 bg-white"
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Lector</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !inviteName.trim()}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {busy ? 'Invitando...' : 'Invitar'}
          </button>
        </form>
      </div>
    </div>
  );
}
