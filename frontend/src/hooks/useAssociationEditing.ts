'use client';

import { useCallback } from 'react';
import { Edge, Node } from 'reactflow';
import { EntityNodeData, RelationshipData } from '../types/diagram';
import {
  AssociationDeletePlan,
  buildAssociationNode,
  isAssociationLinkEdge,
  planAssociationDelete,
} from '../utils/associationClass';

type AddNode = (node: any) => void;
type UpdateNode = (id: string, changes: any) => void;
type RemoveNode = (id: string) => void;
type UpdateEdge = (id: string, changes: any) => void;
type RemoveEdge = (id: string) => void;
type OnNodesChange = (changes: any[]) => void;

export function useAssociationEditing(params: {
  nodes: Node<EntityNodeData>[];
  edges: Edge<RelationshipData>[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  addNode: AddNode;
  updateNode: UpdateNode;
  removeNode: RemoveNode;
  updateEdge: UpdateEdge;
  removeEdge: RemoveEdge;
  onNodesChange: OnNodesChange;
}) {
  const {
    nodes,
    edges,
    selectedNodeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    addNode,
    updateNode,
    removeNode,
    updateEdge,
    removeEdge,
    onNodesChange,
  } = params;

  const handleSaveNode = useCallback((id: string, data: EntityNodeData) => {
    const existing: any = nodes.find((n: any) => n.id === id)?.data;
    updateNode(id, { data: { ...existing, ...data } });
  }, [updateNode, nodes]);

  const applyAssociationDeletePlan = useCallback((plan: AssociationDeletePlan) => {
    plan.linkIdsToRemove.forEach((linkId: string) => removeEdge(linkId));
    plan.edgeFieldClears.forEach(({ edgeId, field }: { edgeId: string; field: string }) =>
      updateEdge(edgeId, { data: { [field]: undefined } })
    );
  }, [removeEdge, updateEdge]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (selectedNodeId) {
      applyAssociationDeletePlan(planAssociationDelete(nodes, edges, selectedNodeId));
      removeNode(selectedNodeId);
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, removeNode, nodes, edges, applyAssociationDeletePlan, setSelectedNodeId]);

  const handleDissolveAssociationClass = useCallback((nodeId: string) => {
    const node: any = nodes.find((n: any) => n.id === nodeId);
    if (!node) return;
    applyAssociationDeletePlan(planAssociationDelete(nodes, edges, nodeId));
    removeNode(nodeId);
    setSelectedNodeId(null);
  }, [nodes, edges, applyAssociationDeletePlan, removeNode, setSelectedNodeId]);

  const handleNodesChange = useCallback((changes: any[]) => {
    (changes || [])
      .filter((c: any) => c.type === 'remove' && c.id)
      .forEach((c: any) => {
        applyAssociationDeletePlan(planAssociationDelete(nodes, edges, c.id));
      });
    onNodesChange(changes);
  }, [nodes, edges, applyAssociationDeletePlan, onNodesChange]);

  const handleConvertToAssociationClass = useCallback((edgeId: string) => {
    const edge: any = edges.find((e: any) => e.id === edgeId);
    if (!edge) return;
    if (edge.data?.associationClassNodeId || edge.data?.associationClassId) return;
    if (isAssociationLinkEdge(edge)) return;
    const fromNode = nodes.find((n: any) => n.id === edge.source);
    const toNode = nodes.find((n: any) => n.id === edge.target);
    if (!fromNode || !toNode) return;
    const assocNode = buildAssociationNode(fromNode, toNode, edge);
    addNode(assocNode);
    updateEdge(edgeId, { data: { associationClassNodeId: assocNode.id } });
    setSelectedEdgeId(null);
    setSelectedNodeId(assocNode.id);
  }, [edges, nodes, addNode, updateEdge, setSelectedEdgeId, setSelectedNodeId]);

  return {
    handleSaveNode,
    handleDeleteSelectedNode,
    handleDissolveAssociationClass,
    handleNodesChange,
    handleConvertToAssociationClass,
  };
}
