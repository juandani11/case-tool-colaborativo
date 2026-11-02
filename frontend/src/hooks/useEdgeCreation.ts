'use client';

import { useCallback } from 'react';
import { RelationshipData, UmlRelationshipType } from '../types/diagram';

export function useEdgeCreation(
  connectionType: UmlRelationshipType,
  addEdge: (edge: any) => void
) {
  return useCallback((connection: any) => {
    let edgeType = 'association';
    let relationshipType: RelationshipData['type'] = 'ASSOCIATION';

    if (connectionType === 'INHERITANCE') {
      edgeType = 'inheritance';
      relationshipType = 'INHERITANCE';
    } else if (connectionType === 'AGGREGATION') {
      edgeType = 'aggregation';
      relationshipType = 'AGGREGATION';
    } else if (connectionType === 'COMPOSITION') {
      edgeType = 'composition';
      relationshipType = 'COMPOSITION';
    }

    const isSelfLoop = connection.source === connection.target;
    addEdge({
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: connection.source,
      target: connection.target,
      type: isSelfLoop ? 'selfloop' : edgeType,
      data: {
        type: relationshipType,
        cardinalityFrom: '1',
        cardinalityTo: '1',
        isSelfLoop,
      },
    });
  }, [addEdge, connectionType]);
}
