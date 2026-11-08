import * as Y from 'yjs';
import { addNode as yAddNode } from './yjsNodeHelpers';
import { dedupeChatMessages } from './chatMessage';
import { addEdge as yAddEdge } from './yjsEdgeHelpers';

interface ImportedNode {
  id: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  [key: string]: unknown;
}

interface ImportedEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

function docTransact(doc: Y.Doc | null, fn: () => void) {
  if (!doc) { fn(); return; }
  doc.transact(fn);
}

export function exportDiagramData(nodes: any[], edges: any[]) {
  const data = { nodes, edges };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagrama.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importDiagramFile(
  file: File,
  target: { yn: Y.Map<any> | null; ye: Y.Map<any> | null; doc: Y.Doc | null }
) {
  const { yn, ye, doc } = target;
  if (!yn || !ye) return;
  const reader = new FileReader();
  reader.onload = (e: any) => {
    try {
      const data = JSON.parse(e.target.result) as { nodes: unknown; edges: unknown };
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        alert('Formato JSON inválido: se esperaban arreglos nodes y edges.');
        return;
      }
      const importedNodes = data.nodes as ImportedNode[];
      const importedEdges = data.edges as ImportedEdge[];

      const nodeIds = new Set<string>();
      const nodesAreValid = importedNodes.every((node: ImportedNode) => {
        const valid = node
          && typeof node.id === 'string'
          && node.id.length > 0
          && node.position
          && typeof node.position.x === 'number'
          && typeof node.position.y === 'number'
          && node.data
          && typeof node.data === 'object'
          && !nodeIds.has(node.id);
        if (valid) nodeIds.add(node.id);
        return valid;
      });
      if (!nodesAreValid) {
        alert('JSON inválido: hay nodos sin id, posición o datos, o ids duplicados.');
        return;
      }

      const edgeIds = new Set<string>();
      const edgesAreValid = importedEdges.every((edge: ImportedEdge) => {
        const valid = edge
          && typeof edge.id === 'string'
          && edge.id.length > 0
          && !edgeIds.has(edge.id)
          && typeof edge.source === 'string'
          && typeof edge.target === 'string'
          && nodeIds.has(edge.source)
          && nodeIds.has(edge.target);
        if (valid) edgeIds.add(edge.id);
        return valid;
      });
      if (!edgesAreValid) {
        alert('JSON inválido: hay aristas sin id o con extremos inexistentes.');
        return;
      }

      docTransact(doc, () => {
        yn.clear();
        ye.clear();
        importedNodes.forEach((node) => yAddNode(yn, node));
        importedEdges.forEach((edge) => yAddEdge(ye, edge));
      });
    } catch (error) {
      alert('Error al importar: ' + (error as Error).message);
    }
  };
  reader.readAsText(file);
}

export function loadDiagramDataToYjs(
  data: { nodes: any[]; edges: any[]; chat?: any[] },
  target: {
    yn: Y.Map<any> | null;
    ye: Y.Map<any> | null;
    ychat: Y.Array<any> | null;
    doc: Y.Doc | null;
  }
) {
  const { yn, ye, ychat, doc } = target;
  if (!yn || !ye || !ychat) return;
  const hasGraph = yn.size > 0 || ye.size > 0;
  const hasChat = ychat.length > 0;
  if (hasGraph && hasChat) return;

  docTransact(doc, () => {
    if (!hasGraph) {
      yn.clear();
      ye.clear();
      if (Array.isArray(data.nodes)) {
        data.nodes.forEach((node: any) => yAddNode(yn, node));
      }
      if (Array.isArray(data.edges)) {
        data.edges.forEach((edge: any) => yAddEdge(ye, edge));
      }
    }
    if (!hasChat && Array.isArray(data.chat)) {
      // Merge idempotente: no reinsertar mensajes que otro cliente ya
      // hidrato desde PostgreSQL (ids `db_*`) en esta misma Y.Array.
      const existingIds = new Set(
        dedupeChatMessages(ychat.toArray()).map((msg) => msg.id)
      );
      const incoming = dedupeChatMessages(data.chat).filter(
        (msg) => !existingIds.has(msg.id)
      );
      if (incoming.length > 0) ychat.push(incoming);
    }
  });
}
