'use client';

import { Node, Edge } from 'reactflow';
import { EntityNodeData, RelationshipData } from '../types/diagram';

export interface DiagramData {
  nodes: Node<any>[];
  edges: Edge<any>[];
}

export function exportDiagramToJson(nodes: any[], edges: any[]): void {
  const data = { nodes, edges };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagrama.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importDiagramFromJson(
  file: File,
  onSuccess: (nodes: any[], edges: any[]) => void,
  onError: (message: string) => void
): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target!.result as string);
      if (!data.nodes || !data.edges) {
        onError('Formato JSON inválido: faltan nodos o aristas');
        return;
      }
      onSuccess(data.nodes, data.edges);
    } catch (error) {
      onError('Error al importar: ' + (error as Error).message);
    }
  };
  reader.readAsText(file);
}

export function parseDiagramJson(jsonString: string): DiagramData | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data.nodes || !data.edges) {
      return null;
    }
    return data as DiagramData;
  } catch {
    return null;
  }
}