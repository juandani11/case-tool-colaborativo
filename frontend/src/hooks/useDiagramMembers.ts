'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../lib/apiClient';

export interface DiagramMember {
  userId: string;
  role: 'EDITOR' | 'VIEWER';
  username?: string;
  email?: string;
  addedAt?: string;
}

export interface DiagramOwner {
  id: string;
  username: string;
  email?: string;
}

interface AclResponse {
  owner?: DiagramOwner | null;
  members?: DiagramMember[];
}

interface ApiErrorBody {
  error?: string;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as ApiErrorBody;
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export function useDiagramMembers(diagramId: string) {
  const [owner, setOwner] = useState<DiagramOwner | null>(null);
  const [members, setMembers] = useState<DiagramMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/acl`);
      if (!response.ok) {
        throw new Error(await readError(response, 'No se pudo cargar la lista'));
      }
      const data = (await response.json()) as AclResponse;
      setOwner(data.owner || null);
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista');
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = useCallback(async (username: string, role: 'EDITOR' | 'VIEWER') => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/members`, {
        method: 'POST',
        body: JSON.stringify({ username, role }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'No se pudo invitar'));
      }
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo invitar');
      return false;
    } finally {
      setBusy(false);
    }
  }, [diagramId, load]);

  const changeRole = useCallback(async (userId: string, role: 'EDITOR' | 'VIEWER') => {
    setError('');
    try {
      const response = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'No se pudo cambiar el rol'));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el rol');
    }
  }, [diagramId, load]);

  const removeMember = useCallback(async (userId: string) => {
    setError('');
    try {
      const response = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'No se pudo eliminar'));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }, [diagramId, load]);

  return {
    owner,
    members,
    loading,
    error,
    busy,
    invite,
    changeRole,
    removeMember,
    reload: load,
  };
}
