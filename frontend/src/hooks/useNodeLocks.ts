'use client';

import { useState, useEffect } from 'react';
import { WebsocketProvider } from 'y-websocket';

interface NodeLock {
  name: string;
  color: string;
  timestamp: number;
}

export function useNodeLocks(provider: WebsocketProvider | null) {
  const [locks, setLocks] = useState<Map<string, NodeLock>>(new Map());

  useEffect(() => {
    if (!provider) return;

    const update = () => {
      const newLocks = new Map<string, NodeLock>();
      const now = Date.now();
      provider.awareness.getStates().forEach((state: any) => {
        const editing = state.editing;
        const user = state.user;
        if (editing?.nodeId && user && now - editing.timestamp < 30000) {
          newLocks.set(editing.nodeId, {
            name: user.name,
            color: user.color,
            timestamp: editing.timestamp,
          });
        }
      });
      setLocks(newLocks);
    };

    provider.awareness.on('change', update);
    update();
    return () => { provider.awareness.off('change', update); };
  }, [provider]);

  return locks;
}
