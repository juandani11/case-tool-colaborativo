'use client';

import { useEffect } from 'react';
import { apiFetch, API_BASE } from '../lib/apiClient';

export function useDiagramLoader(params: {
  currentDiagramId: string | null;
  diagramsLoaded: boolean;
  initialDiagramId?: string;
  loadDiagramData: (data: { nodes: any[]; edges: any[]; chat?: any[] }) => void;
  updateDiagramName: (id: string, name: string) => void;
}) {
  const {
    currentDiagramId,
    diagramsLoaded,
    initialDiagramId,
    loadDiagramData,
    updateDiagramName,
  } = params;

  useEffect(() => {
    if (!diagramsLoaded || !currentDiagramId) return;
    let cancelled = false;
    apiFetch(`${API_BASE}/api/diagrams/${currentDiagramId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.nodes && data.edges) {
          loadDiagramData({ nodes: data.nodes, edges: data.edges, chat: data.chat });
        }
        if (data.name) {
          updateDiagramName(currentDiagramId, data.name);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentDiagramId, diagramsLoaded, initialDiagramId]); // eslint-disable-line react-hooks/exhaustive-deps
}
