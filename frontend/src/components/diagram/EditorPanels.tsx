'use client';

import { Edge, Node } from 'reactflow';
import EntityEditorPanel from '../EntityEditorPanel';
import EdgeEditorPanel from '../EdgeEditorPanel';
import { EntityNodeData, RelationshipData, UmlRelationshipType } from '../../types/diagram';
import { typeMap as relationshipToReactFlow } from '../../utils/yjsEdgeHelpers';

interface EditorPanelsProps {
  nodes: Node<EntityNodeData>[];
  selectedNodeId: string | null;
  selectedData?: EntityNodeData;
  selectedEdgeId: string | null;
  selectedEdgeData?: RelationshipData;
  associationInfo: { fromName: string; toName: string; isLegacy: boolean } | null;
  duplicateName: boolean;
  onSaveNode: (id: string, data: EntityNodeData) => void;
  onDeleteNode: () => void;
  onDissolveAssociation: () => void;
  onCloseEntity: () => void;
  onCloseEdge: () => void;
  onUpdateEdge: (id: string, changes: any) => void;
  onConvertToAssociationClass: () => void;
}

export default function EditorPanels({
  nodes,
  selectedNodeId,
  selectedData,
  selectedEdgeId,
  selectedEdgeData,
  associationInfo,
  duplicateName,
  onSaveNode,
  onDeleteNode,
  onDissolveAssociation,
  onCloseEntity,
  onCloseEdge,
  onUpdateEdge,
  onConvertToAssociationClass,
}: EditorPanelsProps) {
  return (
    <>
      {selectedNodeId && selectedData && (
        <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
          <EntityEditorPanel
            nodeId={selectedNodeId}
            initialData={selectedData}
            onSave={onSaveNode}
            onClose={onCloseEntity}
            associationInfo={associationInfo}
            onDissolveAssociation={onDissolveAssociation}
            duplicateName={duplicateName}
          />
          <button
            onClick={onDeleteNode}
            className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl border border-red-200 transition-colors"
          >
            Eliminar entidad
          </button>
        </div>
      )}

      {selectedEdgeId && selectedEdgeData && (
        <div className="absolute right-4 top-4 z-30">
          <EdgeEditorPanel
            key={selectedEdgeId}
            edgeId={selectedEdgeId}
            initialData={{
              type: (['ASSOCIATION', 'AGGREGATION', 'COMPOSITION', 'INHERITANCE'].includes(
                selectedEdgeData.type || ''
              )
                ? selectedEdgeData.type
                : 'ASSOCIATION') as UmlRelationshipType,
              cardinalityFrom: selectedEdgeData.cardinalityFrom || '1',
              cardinalityTo: selectedEdgeData.cardinalityTo || '1',
            }}
            onSave={(data) => {
              const reactFlowEdgeType = relationshipToReactFlow[data.type] || 'association';
              onUpdateEdge(selectedEdgeId, {
                type: reactFlowEdgeType,
                cardinalityFrom: data.cardinalityFrom,
                cardinalityTo: data.cardinalityTo,
                data: {
                  type: data.type,
                  cardinalityFrom: data.cardinalityFrom,
                  cardinalityTo: data.cardinalityTo,
                  associationClassId: selectedEdgeData.associationClassId,
                },
              });
            }}
            associationClassName={
              selectedEdgeData.associationClassId
                ? nodes.find((n: any) => n.id === selectedEdgeData.associationClassId)?.data?.label || null
                : null
            }
            onConvertToAssociationClass={onConvertToAssociationClass}
            onClose={onCloseEdge}
          />
        </div>
      )}
    </>
  );
}
