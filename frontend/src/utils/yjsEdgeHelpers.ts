'use client';

import * as Y from 'yjs';

export const typeMap: Record<string, string> = {
  'INHERITANCE': 'inheritance',
  'AGGREGATION': 'aggregation',
  'COMPOSITION': 'composition',
  'ASSOCIATION': 'association',
  // Tipos ER: se dibujan como asociación simple (sin rombo).
  // La semántica * a * la resuelve el AST con entidad intermedia.
  'ONE_TO_ONE': 'association',
  'ONE_TO_MANY': 'association',
  'MANY_TO_ONE': 'association',
  'MANY_TO_MANY': 'association',
};

export const reverseTypeMap: Record<string, string> = {
  'inheritance': 'INHERITANCE',
  'aggregation': 'AGGREGATION',
  'composition': 'COMPOSITION',
  'association': 'ASSOCIATION',
  'default': 'ASSOCIATION',
};

export function createEdgeMap(edge: any): Y.Map<any> {
  const edgeMap = new Y.Map();
  edgeMap.set('id', edge.id);
  edgeMap.set('source', edge.source);
  edgeMap.set('target', edge.target);
  edgeMap.set('type', edge.type);

  if (edge.data) {
    const dataMap = new Y.Map();
    Object.entries(edge.data).forEach(([key, value]) => dataMap.set(key, value));
    edgeMap.set('data', dataMap);
  }
  return edgeMap;
}

export function addEdge(yEdges: Y.Map<any>, edge: any): void {
  const edgeMap = createEdgeMap(edge);
  yEdges.set(edge.id, edgeMap);
}

export function updateEdge(yEdges: Y.Map<any>, id: string, changes: any): void {
  let edgeMap = yEdges.get(id);

  if (!edgeMap) {
    yEdges.forEach((map: any) => {
      const data = map.toJSON() as { id: string };
      if (data.id === id) {
        edgeMap = map;
      }
    });
  }

  if (!edgeMap) {
    console.warn(`[updateEdge] Arista no encontrada: "${id}"`);
    return;
  }

  const rawEdge = edgeMap.toJSON() as any;
  const rawData = rawEdge.data;
  let currentData: any = {
    type: 'ASSOCIATION',
    cardinalityFrom: '1',
    cardinalityTo: '1',
  };

  if (rawData) {
    if (typeof rawData === 'object') {
      currentData = rawData;
    }
  }

  // Update the edge's React Flow type (e.g., 'association', 'inheritance')
  if (changes.type !== undefined) {
    edgeMap.set('type', changes.type);
  }

  // Merge data fields: se parte de TODOS los campos existentes (para no
  // perder associationClassId, label, intermediateAttributes, etc.),
  // se aplican changes.data y las cardinalidades de nivel superior.
  // Un valor `undefined` explícito en changes.data elimina la clave.
  const mergedData: any = { ...currentData };
  if (changes.data && typeof changes.data === 'object') {
    for (const [key, value] of Object.entries(changes.data)) {
      if (value === undefined) {
        delete mergedData[key];
      } else {
        mergedData[key] = value;
      }
    }
  }
  if (changes.cardinalityFrom !== undefined) mergedData.cardinalityFrom = changes.cardinalityFrom;
  if (changes.cardinalityTo !== undefined) mergedData.cardinalityTo = changes.cardinalityTo;
  if (mergedData.type === undefined) mergedData.type = 'ASSOCIATION';
  if (mergedData.cardinalityFrom === undefined) mergedData.cardinalityFrom = '1';
  if (mergedData.cardinalityTo === undefined) mergedData.cardinalityTo = '1';

  const newDataMap = new Y.Map();
  for (const [key, value] of Object.entries(mergedData)) {
    if (value !== undefined) newDataMap.set(key, value);
  }

  edgeMap.set('data', newDataMap);
}

export function removeEdge(yEdges: Y.Map<any>, id: string): void {
  yEdges.delete(id);
}

export function edgesToArray(yEdges: Y.Map<any>): any[] {
  const result: any[] = [];
  yEdges.forEach((edgeMap: any) => {
    const edge = edgeMap.toJSON();
    if (edge.type === 'default') {
      edge.type = 'association';
    }
    result.push(edge);
  });
  return result;
}
