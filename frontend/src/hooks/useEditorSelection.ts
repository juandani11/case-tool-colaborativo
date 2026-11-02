'use client';

import { useMemo } from 'react';
import { Edge, Node } from 'reactflow';
import {
  EntityNodeData,
  RelationshipData,
  SelectedElementContext,
} from '../types/diagram';
import { isAssociationLinkEdge } from '../utils/associationClass';

export function useEditorSelection(
  nodes: Node<EntityNodeData>[],
  edges: Edge<RelationshipData>[],
  selectedNodeId: string | null,
  selectedEdgeId: string | null
) {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedData = selectedNode?.data as EntityNodeData | undefined;
  const selectedLabel = selectedData?.label?.trim().toLocaleLowerCase() || '';
  const duplicateNodeName = Boolean(selectedNodeId && selectedLabel) && nodes.some(
    (node) => node.id !== selectedNodeId
      && (((node.data as EntityNodeData)?.label || '').trim().toLocaleLowerCase() === selectedLabel)
  );

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeData = selectedEdge?.data as RelationshipData | undefined;

  const selectedNodeAssociationInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    const stash = (selectedData as any)?.associationOf;
    if (stash?.sourceId && stash?.targetId) {
      const from = nodes.find((n: any) => n.id === stash.sourceId)?.data?.label;
      const to = nodes.find((n: any) => n.id === stash.targetId)?.data?.label;
      if (from && to) return { fromName: from, toName: to, isLegacy: false };
    }
    const legacyEdge: any = edges.find(
      (e: any) => !isAssociationLinkEdge(e) && e?.data?.associationClassId === selectedNodeId
    );
    if (legacyEdge) {
      const from = nodes.find((n: any) => n.id === legacyEdge.source)?.data?.label;
      const to = nodes.find((n: any) => n.id === legacyEdge.target)?.data?.label;
      if (from && to) return { fromName: from, toName: to, isLegacy: true };
    }
    return null;
  }, [selectedNodeId, selectedData, nodes, edges]);

  const selectedElementForAI: SelectedElementContext | null = useMemo(() => {
    if (selectedNode) {
      return {
        kind: 'node',
        id: selectedNode.id,
        name: selectedNode.data.label,
        stereotype: selectedNode.data.stereotype,
        attributes: (selectedNode.data.attributes || []).map((attribute) => ({
          name: attribute.name,
          type: attribute.type,
          isPk: attribute.isPk,
          nullable: attribute.nullable,
          unique: attribute.unique,
        })),
        methods: (selectedNode.data.methods || []).map((method) => ({
          name: method.name,
          returnType: method.returnType,
          visibility: method.visibility,
          parameters: (method.parameters || []).map((parameter) => ({
            name: parameter.name,
            type: parameter.type,
          })),
        })),
      };
    }

    if (!selectedEdge) return null;

    const source = nodes.find((item) => item.id === selectedEdge.source);
    const target = nodes.find((item) => item.id === selectedEdge.target);
    return {
      kind: 'edge',
      id: selectedEdge.id,
      type: selectedEdge.data?.type || 'ASSOCIATION',
      source: {
        id: selectedEdge.source,
        name: source?.data.label || selectedEdge.source,
      },
      target: {
        id: selectedEdge.target,
        name: target?.data.label || selectedEdge.target,
      },
      ...(selectedEdge.data?.label ? { label: selectedEdge.data.label } : {}),
      ...(selectedEdge.data?.cardinalityFrom ? { cardinalityFrom: selectedEdge.data.cardinalityFrom } : {}),
      ...(selectedEdge.data?.cardinalityTo ? { cardinalityTo: selectedEdge.data.cardinalityTo } : {}),
    };
  }, [selectedNode, selectedEdge, nodes]);

  return {
    selectedNode,
    selectedData,
    duplicateNodeName,
    selectedEdge,
    selectedEdgeData,
    selectedNodeAssociationInfo,
    selectedElementForAI,
  };
}
