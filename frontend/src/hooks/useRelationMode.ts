'use client';

import { useCallback, useEffect, useState } from 'react';
import { RELATIONSHIPS } from '../components/Palette';

export function useRelationMode(addEdge: (edge: any) => void) {
  const [activeRelationType, setActiveRelationType] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<string | null>(null);

  const selectRelationType = useCallback((type: string | null) => {
    setActiveRelationType(type);
    setPendingSource(null);
  }, []);

  const cancelRelationMode = useCallback(() => {
    setActiveRelationType(null);
    setPendingSource(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeRelationType) cancelRelationMode();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeRelationType, cancelRelationMode]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    if (!activeRelationType) return;
    if (!pendingSource) {
      setPendingSource(node.id);
      return;
    }
    const rel = RELATIONSHIPS.find(r => r.id === activeRelationType);
    const isSelfLoop = pendingSource === node.id;
    addEdge({
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: pendingSource,
      target: node.id,
      type: isSelfLoop ? 'selfloop' : activeRelationType,
      data: {
        type: rel ? rel.relationshipType : 'ASSOCIATION',
        cardinalityFrom: '1',
        cardinalityTo: '1',
        isSelfLoop,
      },
    });
    setPendingSource(null);
    setActiveRelationType(null);
  }, [activeRelationType, pendingSource, addEdge]);

  const activeRelationLabel = activeRelationType
    ? RELATIONSHIPS.find(r => r.id === activeRelationType)?.label
    : null;

  return {
    activeRelationType,
    pendingSource,
    activeRelationLabel,
    selectRelationType,
    cancelRelationMode,
    onNodeClick,
  };
}
