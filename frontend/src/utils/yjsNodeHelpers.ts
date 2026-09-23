'use client';

import * as Y from 'yjs';

export interface NodePosition {
  x: number;
  y: number;
}

export function createNodeMap(node: any): Y.Map<any> {
  const nodeMap = new Y.Map();
  nodeMap.set('id', node.id);
  nodeMap.set('type', node.type || 'entity');

  const posMap = new Y.Map();
  posMap.set('x', node.position.x);
  posMap.set('y', node.position.y);
  nodeMap.set('position', posMap);

  const dataMap = new Y.Map();
  dataMap.set('label', node.data?.label || '');
  dataMap.set('stereotype', node.data?.stereotype || 'class');
  // Clase asociativa (Opción A): flag + respaldo de la arista original.
  if (node.data?.isAssociationClass !== undefined) {
    dataMap.set('isAssociationClass', node.data.isAssociationClass);
  }
  if (node.data?.associationOf && typeof node.data.associationOf === 'object') {
    const assocMap = new Y.Map();
    Object.entries(node.data.associationOf).forEach(([key, value]) => {
      if (value !== undefined) assocMap.set(key, value);
    });
    dataMap.set('associationOf', assocMap);
  }

  const attrsArray = new Y.Array();
  (node.data?.attributes || []).forEach((attr: any) => {
    const attrMap = new Y.Map();
    Object.entries(attr).forEach(([key, value]) => attrMap.set(key, value));
    attrsArray.push([attrMap]);
  });
  dataMap.set('attributes', attrsArray);

  const methodsArray = new Y.Array();
  (node.data?.methods || []).forEach((method: any) => {
    const methodMap = new Y.Map();
    Object.entries(method).forEach(([key, value]) => {
      if (key !== 'parameters') methodMap.set(key, value);
    });
    const paramsArray = new Y.Array();
    (method.parameters || []).forEach((param: any) => {
      const paramMap = new Y.Map();
      Object.entries(param).forEach(([key, value]) => paramMap.set(key, value));
      paramsArray.push([paramMap]);
    });
    methodMap.set('parameters', paramsArray);
    methodsArray.push([methodMap]);
  });
  dataMap.set('methods', methodsArray);

  nodeMap.set('data', dataMap);
  return nodeMap;
}

export function addNode(yNodes: Y.Map<any>, node: any): void {
  const nodeMap = createNodeMap(node);
  yNodes.set(node.id, nodeMap);
}

export function updateNode(yNodes: Y.Map<any>, id: string, changes: any): void {
  const nodeMap = yNodes.get(id);
  if (!nodeMap) return;

  if (changes.position) {
    const posMap = nodeMap.get('position');
    if (posMap) {
      posMap.set('x', changes.position.x);
      posMap.set('y', changes.position.y);
    } else {
      const newPosMap = new Y.Map();
      newPosMap.set('x', changes.position.x);
      newPosMap.set('y', changes.position.y);
      nodeMap.set('position', newPosMap);
    }
  }

  if (changes.data) {
    const dataMap = nodeMap.get('data');
    if (dataMap) {
      if (changes.data.label !== undefined) dataMap.set('label', changes.data.label);
    if (changes.data.stereotype !== undefined) dataMap.set('stereotype', changes.data.stereotype);

      // Clase asociativa: sincronizar o eliminar (undefined explícito elimina).
      for (const key of ['isAssociationClass', 'associationOf']) {
        if (!(key in changes.data)) continue;
        const value = changes.data[key];
        if (value === undefined) {
          dataMap.delete(key);
          continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const assocMap = new Y.Map();
          Object.entries(value).forEach(([k, v]) => {
            if (v !== undefined) assocMap.set(k, v);
          });
          dataMap.set(key, assocMap);
        } else {
          dataMap.set(key, value);
        }
      }

      if (changes.data.attributes) {
        const attrsArray = dataMap.get('attributes');
        if (attrsArray) {
          attrsArray.delete(0, attrsArray.length);
          (changes.data.attributes || []).forEach((attr: any) => {
            const attrMap = new Y.Map();
            Object.entries(attr).forEach(([key, value]) => attrMap.set(key, value));
            attrsArray.push([attrMap]);
          });
        }
      }

      if (changes.data.methods) {
        const methodsArray = dataMap.get('methods');
        if (methodsArray) {
          methodsArray.delete(0, methodsArray.length);
          (changes.data.methods || []).forEach((method: any) => {
            const methodMap = new Y.Map();
            Object.entries(method).forEach(([key, value]) => {
              if (key !== 'parameters') methodMap.set(key, value);
            });
            const paramsArray = new Y.Array();
            (method.parameters || []).forEach((param: any) => {
              const paramMap = new Y.Map();
              Object.entries(param).forEach(([key, value]) => paramMap.set(key, value));
              paramsArray.push([paramMap]);
            });
            methodMap.set('parameters', paramsArray);
            methodsArray.push([methodMap]);
          });
        }
      }
    }
  }

  if (changes.type) {
    nodeMap.set('type', changes.type);
  }
}

export function removeNode(yNodes: Y.Map<any>, yEdges: Y.Map<any>, id: string): void {
  yNodes.delete(id);
  yEdges.forEach((edgeMap: any, edgeId: string) => {
    const edge = edgeMap.toJSON() as any;
    if (edge.source === id || edge.target === id) {
      yEdges.delete(edgeId);
    }
  });
}

export function nodesToArray(yNodes: Y.Map<any>): any[] {
  const result: any[] = [];
  yNodes.forEach((nodeMap: any) => {
    result.push(nodeMap.toJSON());
  });
  return result;
}
