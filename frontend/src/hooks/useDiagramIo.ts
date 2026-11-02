'use client';

import { useCallback } from 'react';
import { Edge, Node } from 'reactflow';
import { apiFetch, API_BASE } from '../lib/apiClient';
import { EntityNodeData, RelationshipData } from '../types/diagram';
import { nodesToAST } from '../utils/ast';
import { importFromXmi } from '../utils/xmiImporter';
import { exportToXmi, downloadXmi } from '../utils/xmiExporter';
import { isAssociationLinkEdge } from '../utils/associationClass';

export function useDiagramIo(params: {
  nodes: Node<EntityNodeData>[];
  edges: Edge<RelationshipData>[];
  addNode: (node: any) => void;
  addEdge: (edge: any) => void;
}) {
  const { nodes, edges, addNode, addEdge } = params;

  const handleGenerateBackend = useCallback(async () => {
    try {
      const ast = nodesToAST(nodes, edges);
      const response = await apiFetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentState: ast }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error || 'Error al generar el backend';
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backend-generado.zip';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error(error);
      alert('Error generando backend: ' + error.message);
    }
  }, [nodes, edges]);

  const handleExportXmi = useCallback(() => {
    const xmiContent = exportToXmi(nodes, edges.filter((e: any) => !isAssociationLinkEdge(e)));
    downloadXmi(xmiContent, 'diagrama.xmi');
  }, [nodes, edges]);

  const handleImportXmi = useCallback((file: File) => {
    importFromXmi(file, { addNode, addEdge }).catch((error) => {
      console.error('Error al importar XMI:', error);
    });
  }, [addNode, addEdge]);

  return { handleGenerateBackend, handleExportXmi, handleImportXmi };
}
