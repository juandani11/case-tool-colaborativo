'use client';

import { useCallback } from 'react';
import { useReactFlow, OnSelectionChangeParams, Edge } from 'reactflow';

export function usePanelSelection(params: {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  isViewer: boolean;
}) {
  const { setSelectedNodeId, setSelectedEdgeId, isViewer } = params;
  const reactFlow = useReactFlow();

  const handleSelectNodeFromSidebar = useCallback((nodeId: string) => {
    if (isViewer) return;
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
    reactFlow.setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, [reactFlow, isViewer, setSelectedNodeId, setSelectedEdgeId]);

  const handleSelectEdgeFromSidebar = useCallback((edgeId: string) => {
    if (isViewer) return;
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    reactFlow.setEdges(eds => eds.map(e => ({ ...e, selected: e.id === edgeId })));
  }, [reactFlow, isViewer, setSelectedNodeId, setSelectedEdgeId]);

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    if (selection.nodes.length > 0) {
      setSelectedNodeId(selection.nodes[0].id);
      setSelectedEdgeId(null);
    }
  }, [setSelectedNodeId, setSelectedEdgeId]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, [setSelectedEdgeId, setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  const handleCloseEntityPanel = useCallback(() => {
    setSelectedNodeId(null);
    reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: false })));
  }, [reactFlow, setSelectedNodeId]);

  const handleCloseEdgePanel = useCallback(() => {
    setSelectedEdgeId(null);
    reactFlow.setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, [reactFlow, setSelectedEdgeId]);

  return {
    handleSelectNodeFromSidebar,
    handleSelectEdgeFromSidebar,
    onSelectionChange,
    onEdgeClick,
    onPaneClick,
    handleCloseEntityPanel,
    handleCloseEdgePanel,
  };
}
