'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../lib/apiClient';

export type DiagramRole = 'OWNER' | 'EDITOR' | 'VIEWER' | 'NONE';

export function useDiagramRole(diagramId: string | null) {
  const [role, setRole] = useState<DiagramRole>('NONE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!diagramId) {
      setRole('NONE');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/api/diagrams/${diagramId}/role`);
        if (!res.ok) {
          if (!cancelled) setRole('NONE');
        } else {
          const { role } = await res.json();
          if (!cancelled) setRole(role);
        }
      } catch {
        if (!cancelled) setRole('NONE');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagramId]);

  return { role, loading };
}
