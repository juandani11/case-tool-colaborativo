'use client';

import { useCallback } from 'react';
import { useReactFlow, Node } from 'reactflow';
import { EntityNodeData } from '../types/diagram';

export function useCanvasInteractions(addNode: (node: any) => void) {
  const reactFlow = useReactFlow();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/reactflow');
    if (!raw) return;
    try {
      const { defaultData } = JSON.parse(raw);
      const position = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode = {
        id: `entity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'entity',
        position,
        data: {
          label: defaultData.label || 'Nueva',
          attributes: defaultData.attributes || [],
          methods: defaultData.methods || [],
          stereotype: defaultData.stereotype || 'class',
          isAbstract: defaultData.isAbstract,
          isNote: defaultData.isNote,
        },
      };
      addNode(newNode);
    } catch {}
  }, [reactFlow, addNode]);

  const handleAddEntity = useCallback(() => {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: Node<EntityNodeData> = {
      id,
      type: 'entity',
      position: { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 },
      data: {
        label: 'NuevaEntidad',
        attributes: [],
        methods: [],
        stereotype: 'class',
      },
    };
    addNode(newNode);
  }, [addNode]);

  return { onDragOver, onDrop, handleAddEntity };
}
