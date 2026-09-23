'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../lib/apiClient';

interface Member {
  userId: string;
  role: 'EDITOR' | 'VIEWER';
  username?: string;
  email?: string;
  addedAt?: string;
}

interface Owner {
  id: string;
  username: string;
  email?: string;
}

interface MembersPanelProps {
  diagramId: string;
  onClose: () => void;
}

export default function MembersPanel({ diagramId, onClose }: MembersPanelProps) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/acl`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo cargar la lista');
      }
      const data = await res.json();
      setOwner(data.owner || null);
      setMembers(data.members || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/members`, {
        method: 'POST',
        body: JSON.stringify({ username: inviteName.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo invitar');
      }
      setInviteName('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: string, role: 'EDITOR' | 'VIEWER') {
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo cambiar el rol');
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRemove(userId: string) {
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo eliminar');
      }
      await load();
    } catch (err: any) {
      setError(err.message);
    }
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
                        onChange={(e) => handleRoleChange(m.userId, e.target.value as 'EDITOR' | 'VIEWER')}
                        className="text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Lector</option>
                      </select>
                      <button
                        onClick={() => handleRemove(m.userId)}
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
