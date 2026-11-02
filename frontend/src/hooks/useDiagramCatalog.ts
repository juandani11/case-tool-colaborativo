'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '../lib/apiClient';
import type { DiagramInfo } from '../components/DiagramSelector';

const DIAGRAMS_STORAGE_KEY = 'uml-editor-diagrams';

function humanizeDiagramId(id: string): string {
  const num = id.replace(/^diagram-/, '');
  return `Diagrama ${num}`;
}

type ServerDiagram = { id: string; name?: string; updatedAt?: number };

export function useDiagramCatalog(initialDiagramId?: string) {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramInfo[]>([]);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [diagramsLoaded, setDiagramsLoaded] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const lastId = localStorage.getItem('uml-editor-current-diagram');

    apiFetch(`${API_BASE}/api/diagrams`)
      .then(r => r.json())
      .then((payload: ServerDiagram[] | { owned?: ServerDiagram[]; shared?: ServerDiagram[] }) => {
        const serverDiagrams = Array.isArray(payload)
          ? payload
          : [...(payload.owned || []), ...(payload.shared || [])];
        if (serverDiagrams.length === 0) {
          if (initialDiagramId) {
            setDiagrams([{ id: initialDiagramId, name: humanizeDiagramId(initialDiagramId) }]);
            setCurrentDiagramId(initialDiagramId);
            setDiagramsLoaded(true);
            return;
          }
          apiFetch(`${API_BASE}/api/diagrams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Diagrama 1' }),
          })
            .then(r => r.json())
            .then((created: { id?: string; name?: string }) => {
              if (!created?.id) throw new Error('El servidor no devolvió el diagrama creado');
              const defaultList: DiagramInfo[] = [{ id: created.id, name: created.name || 'Diagrama 1' }];
              setDiagrams(defaultList);
              setCurrentDiagramId(created.id);
              setDiagramsLoaded(true);
            })
            .catch(() => {
              const fallbackList: DiagramInfo[] = [{ id: 'diagram-1', name: 'Diagrama 1' }];
              setDiagrams(fallbackList);
              setCurrentDiagramId('diagram-1');
              setDiagramsLoaded(true);
            });
          return;
        }

        const sorted = [...serverDiagrams].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        const list: DiagramInfo[] = sorted.map(d => ({
          id: d.id,
          name: d.name || humanizeDiagramId(d.id),
        }));

        setDiagrams(list);

        if (initialDiagramId) {
          setCurrentDiagramId(initialDiagramId);
          if (!list.some(d => d.id === initialDiagramId)) {
            setDiagrams(prev => [...prev, { id: initialDiagramId, name: humanizeDiagramId(initialDiagramId) }]);
          }
        } else if (lastId && list.some(d => d.id === lastId)) {
          setCurrentDiagramId(lastId);
        } else {
          setCurrentDiagramId(list[0].id);
        }
        setDiagramsLoaded(true);
      })
      .catch(() => {
        try {
          const stored = localStorage.getItem(DIAGRAMS_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDiagrams(parsed);
              if (initialDiagramId) {
                setCurrentDiagramId(initialDiagramId);
              } else {
                setCurrentDiagramId(lastId && parsed.some((d: DiagramInfo) => d.id === lastId) ? lastId : parsed[0].id);
              }
              setDiagramsLoaded(true);
              return;
            }
          }
        } catch {}
        const fallbackId = initialDiagramId || 'diagram-1';
        setDiagrams([{ id: fallbackId, name: humanizeDiagramId(fallbackId) }]);
        setCurrentDiagramId(fallbackId);
        setDiagramsLoaded(true);
      });
  }, [initialDiagramId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentDiagramId) return;
    localStorage.setItem('uml-editor-current-diagram', currentDiagramId);
  }, [currentDiagramId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DIAGRAMS_STORAGE_KEY, JSON.stringify(diagrams));
  }, [diagrams]);

  const navigateToDiagram = useCallback((id: string) => {
    router.push(`/diagram/${id}`);
  }, [router]);

  const handleCreateDiagram = useCallback(() => {
    apiFetch(`${API_BASE}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo diagrama' }),
    })
      .then(r => r.json())
      .then((data: { id?: string }) => {
        if (data && data.id) navigateToDiagram(data.id);
      })
      .catch(() => {});
  }, [navigateToDiagram]);

  const handleDeleteDiagram = useCallback((id: string) => {
    const wasCurrent = id === currentDiagramId;
    apiFetch(`${API_BASE}/api/diagrams/${id}`, { method: 'DELETE' }).catch(() => {});
    setDiagrams(prev => prev.filter(d => d.id !== id));
    if (wasCurrent) router.push('/dashboard');
  }, [currentDiagramId, router]);

  const handleRenameDiagram = useCallback((id: string, name: string) => {
    setDiagrams(prev => prev.map(d => d.id === id ? { ...d, name } : d));
    apiFetch(`${API_BASE}/api/diagrams/${id}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => {});
  }, []);

  const updateDiagramName = useCallback((id: string, name: string) => {
    setDiagrams(prev => prev.map(d => d.id === id ? { ...d, name } : d));
  }, []);

  return {
    diagrams,
    currentDiagramId,
    diagramsLoaded,
    currentRoom: `diagram-room-${currentDiagramId || 'diagram-1'}`,
    navigateToDiagram,
    handleCreateDiagram,
    handleDeleteDiagram,
    handleRenameDiagram,
    updateDiagramName,
  };
}
