'use client';

import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Edge,
  Node,
  OnSelectionChangeParams,
} from 'reactflow';
import 'reactflow/dist/style.css';
import EntityNode from '../EntityNode';
import InheritanceEdge from '../InheritanceEdge';
import AggregationEdge from '../AggregationEdge';
import CompositionEdge from '../CompositionEdge';
import AssociationEdge from '../AssociationEdge';
import DashedEdge from '../DashedEdge';
import SelfLoopEdge from '../edges/SelfLoopEdge';
import AssociationClassConnector from '../AssociationClassConnector';
import { EntityNodeData, RelationshipData } from '../../types/diagram';
import type { NodeLock } from '../../hooks/useNodeLocks';

const nodeTypes = { entity: EntityNode };
const edgeTypes = {
  association: AssociationEdge,
  inheritance: InheritanceEdge,
  aggregation: AggregationEdge,
  composition: CompositionEdge,
  dashed: DashedEdge,
  selfloop: SelfLoopEdge,
};

interface EditorFlowProps {
  nodes: Node<EntityNodeData>[];
  edges: Edge<RelationshipData>[];
  nodeLocks: Map<string, NodeLock>;
  localClientId: number | null;
  isViewer: boolean;
  pendingSource: string | null;
  isConnecting: boolean;
  activeRelationType: string | null;
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (connection: any) => void;
  onConnectStart: () => void;
  onConnectEnd: () => void;
  onNodeClick: (event: React.MouseEvent, node: any) => void;
  onNodeDragStop: (...args: any[]) => void;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onPaneClick: () => void;
}

export default function EditorFlow({
  nodes,
  edges,
  nodeLocks,
  localClientId,
  isViewer,
  pendingSource,
  isConnecting,
  activeRelationType,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectStart,
  onConnectEnd,
  onNodeClick,
  onNodeDragStop,
  onSelectionChange,
  onEdgeClick,
  onPaneClick,
}: EditorFlowProps) {
  return (
    <div className={`w-full h-full ${activeRelationType ? 'cursor-crosshair' : ''}`}>
      <ReactFlow
        nodes={nodes.map(n => {
          const lock = nodeLocks.get(n.id);
          const isOwnLock = !!lock && lock.clientId === localClientId;
          const isPendingSource = pendingSource === n.id;
          return {
            ...n,
            draggable: isViewer ? false : !lock || !!isOwnLock,
            style: {
              ...(lock ? { boxShadow: `0 0 0 3px ${lock.color}` } : {}),
              ...(isPendingSource ? { boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)' } : {}),
              ...(isConnecting && !isPendingSource ? {
                outline: '2px dashed #60a5fa',
                outlineOffset: '4px',
              } : {}),
            },
            data: { ...n.data, lockedBy: lock || undefined },
          };
        })}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={isViewer ? undefined : onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={isViewer ? undefined : onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={isViewer ? undefined : onSelectionChange}
        onEdgeClick={isViewer ? undefined : onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!isViewer}
        nodesConnectable={!isViewer}
        elementsSelectable={!isViewer}
        connectionRadius={40}
        deleteKeyCode={isViewer ? [] : ['Backspace', 'Delete']}
        defaultEdgeOptions={{ type: 'association', style: { strokeWidth: 2 } }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls className="!bg-white !border-gray-200 !shadow-md !rounded-lg" />
        <MiniMap
          className="!bg-gray-50 !border-gray-200 !shadow-md !rounded-lg"
          nodeColor="#94a3b8"
          maskColor="rgba(0,0,0,0.05)"
        />
        <AssociationClassConnector />
      </ReactFlow>
    </div>
  );
}
