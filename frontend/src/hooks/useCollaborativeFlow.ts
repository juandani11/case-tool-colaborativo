'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getWsParams } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import {
  resolvePresenceIdentity,
  getOrCreateSessionIdentity,
  PresenceIdentity,
} from '../lib/presence';
import { applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  addNode as yAddNode,
  updateNode as yUpdateNode,
  removeNode as yRemoveNode,
  nodesToArray,
} from '../utils/yjsNodeHelpers';
import {
  addEdge as yAddEdge,
  updateEdge as yUpdateEdge,
  removeEdge as yRemoveEdge,
  edgesToArray,
} from '../utils/yjsEdgeHelpers';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ia' | 'system';
  // Quién habla (username del JWT). Permite que el chat público muestre el
  // nombre real de cada participante, no solo "Tú".
  author?: string;
  // Identidad estable del emisor (user.id o anon por pestaña). Permite
  // distinguir los mensajes propios incluso cuando todos se llaman "Anónimo".
  clientId?: string;
  text: string;
  timestamp: number;
}

// Usuario visible en PresencePanel. clientId = conexion (cambia al
// reconectar); id = identidad estable (user.id o anon por pestana).
// Deduplicar SIEMPRE por id, no por clientId (2 pestanas = 1 avatar).
export interface ConnectedUser {
  clientId: number;
  id: string;
  name: string;
  color: string;
}

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

function teardown(
  provider: WebsocketProvider | null,
  doc: Y.Doc | null
) {
  if (provider) {
    try { provider.destroy(); } catch {}
  }
  if (doc) {
    try { doc.destroy(); } catch {}
  }
}

export function useCollaborativeFlow(roomName: string, enabled = true) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);

  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ychatRef = useRef<Y.Array<ChatMessage> | null>(null);
  const sessionIdentity = useRef<PresenceIdentity>(getOrCreateSessionIdentity());
  const { user } = useAuth();
  // Ref para usar el usuario actual dentro de callbacks registrados una vez
  // (p. ej. el handler de 'status' del provider).
  const userRef = useRef(user);
  userRef.current = user;

  // Refs to current Yjs maps (used by callbacks without stale closures)
  const yNodesRef = useRef<Y.Map<any> | null>(null);
  const yEdgesRef = useRef<Y.Map<any> | null>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const isDraggingRef = useRef(false);

  useEffect(() => {
    // ── 1. Tear down any previous connection ────────────────────────
    const prevProvider = providerRef.current;
    const prevDoc = ydocRef.current;
    providerRef.current = null;
    ydocRef.current = null;

    if (!enabled) {
      teardown(prevProvider, prevDoc);
      return;
    }

    // ── 2. Create fresh doc + provider ──────────────────────────────
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234',
      roomName,
      doc,
      // Fase 1: el JWT viaja como ?token= (el servidor lo adjunta sin bloquear)
      { params: getWsParams() }
    );

    providerRef.current = provider;
    ydocRef.current = doc;
    setProvider(provider);

    const yn = doc.getMap('nodes');
    const ye = doc.getMap('edges');
    const ychat = doc.getArray<ChatMessage>('chat');
    yNodesRef.current = yn;
    yEdgesRef.current = ye;
    ychatRef.current = ychat;

    provider.on('status', (event: any) => {
      setIsConnected(event.status === 'connected');
      if (event.status === 'connected') {
        // Republicar identidad con reloj fresco: tras un corte de red el
        // servidor puede haber marcado el estado como obsoleto y ignoraría
        // el estado anterior (mismo reloj). Así el avatar siempre vuelve.
        try {
          provider.awareness.setLocalStateField(
            'user',
            resolvePresenceIdentity(userRef.current, sessionIdentity.current)
          );
        } catch {}
      }
    });

    // ── Awareness (presence) ──────────────────────────────────────
    // La identidad se publica aquí y se ACTUALIZA en el efecto de abajo
    // cuando el usuario autenticado termina de cargar (sin recrear el
    // provider, para no romper la conexión Yjs).
    const awareness = provider.awareness;
    awareness.setLocalStateField(
      'user',
      resolvePresenceIdentity(user, sessionIdentity.current)
    );

    const onAwarenessChange = () => {
      const states = awareness.getStates() as Map<
        number,
        { user?: { id?: string; name?: string; color?: string } }
      >;
      const seen = new Set<string>();
      const users: ConnectedUser[] = [];
      states.forEach((state, clientId) => {
        const u = state.user;
        if (!u || !u.name) return;
        // Deduplicar por usuario (mismo user en 2 pestañas = 1 avatar)
        const key = u.id || `client-${clientId}`;
        if (seen.has(key)) return;
        seen.add(key);
        users.push({
          clientId,
          id: u.id || key,
          name: u.name,
          color: u.color || '#9ca3af',
        });
      });
      setConnectedUsers(users);
    };
    awareness.on('change', onAwarenessChange);
    onAwarenessChange();

    // ── Yjs observers ─────────────────────────────────────────────
    //    observeDeep catches nested mutations (position.set, data.set,
    //    attribute array changes, etc.) which plain observe() misses.
    const onNodesDeepChange = () => {
      if (!isDraggingRef.current) {
        setNodes(nodesToArray(yn));
      }
    };

    const onEdgesDeepChange = () => {
      setEdges(edgesToArray(ye));
    };

    const onChatChange = () => {
      setMessages(ychat.toArray());
    };

    yn.observeDeep(onNodesDeepChange);
    ye.observeDeep(onEdgesDeepChange);
    ychat.observe(onChatChange);

    // Initial load
    setNodes(nodesToArray(yn));
    setEdges(edgesToArray(ye));
    setMessages(ychat.toArray());

    // ── 3. Cleanup ──────────────────────────────────────────────────
    teardown(prevProvider, prevDoc);

    // IMPORTANTE: capturar referencias locales para el cleanup.
    // Si leemos providerRef.current dentro del cleanup, obtendremos
    // el provider NUEVO (porque el efecto ya lo reasignó arriba) y
    // destruiríamos la conexión ACTIVA en vez de la anterior.
    const cleanupProvider = provider;
    const cleanupDoc = doc;

    return () => {
      try { yn.unobserveDeep(onNodesDeepChange); } catch {}
      try { ye.unobserveDeep(onEdgesDeepChange); } catch {}
      try { ychat.unobserve(onChatChange); } catch {}
      try { awareness.off('change', onAwarenessChange); } catch {}
      // Anular el estado local ANTES de desconectar: si el WS sigue abierto
      // y nos llega nuestra propia remoción, la protección anti-takeover de
      // y-protocols la reinterpretaría como "sigo vivo" y resucitaría el
      // avatar como zombie permanente. Con estado local nulo no hay nada
      // que resucitar.
      try { awareness.setLocalState(null); } catch {}

      providerRef.current = null;
      ydocRef.current = null;
      setProvider(null);
      yNodesRef.current = null;
      yEdgesRef.current = null;
      ychatRef.current = null;
      setConnectedUsers([]);
      teardown(cleanupProvider, cleanupDoc);
    };
  }, [roomName, enabled]);

  // ── Soft-lock: publicar nodo seleccionado en awareness ───────────
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    const selectedNodeId = nodes.find((n: any) => n.selected)?.id || null;
    try {
      provider.awareness.setLocalStateField('editing', {
        nodeId: selectedNodeId,
        timestamp: Date.now(),
      });
    } catch {}
  }, [nodes]);

  // Actualizar la identidad publicada cuando cambia la sesión (login,
  // logout o carga inicial), sin recrear el provider ni el documento.
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.awareness.setLocalStateField(
      'user',
      resolvePresenceIdentity(user, sessionIdentity.current)
    );
  }, [user]);

  // ── Yjs write helpers ──────────────────────────────────────────
  //    These write to Yjs. The observeDeep callback handles updating
  //    React state, so we do NOT call setNodes/setEdges here.
  //    For drag operations we DO call setNodes immediately so that
  //    React Flow's internal state stays in sync during the drag.

  const addNode = useCallback((node: any) => {
    const yn = yNodesRef.current;
    if (!yn) return;
    yAddNode(yn, node);
  }, []);

  const updateNode = useCallback((id: string, changes: any) => {
    const yn = yNodesRef.current;
    if (!yn) return;
    yUpdateNode(yn, id, changes);
  }, []);

  const removeNode = useCallback((id: string) => {
    const yn = yNodesRef.current;
    const ye = yEdgesRef.current;
    if (!yn || !ye) return;
    yRemoveNode(yn, ye, id);
  }, []);

  const addEdge = useCallback((edge: any) => {
    const ye = yEdgesRef.current;
    if (!ye) return;
    yAddEdge(ye, edge);
  }, []);

  const updateEdge = useCallback((id: string, changes: any) => {
    const ye = yEdgesRef.current;
    if (!ye) return;
    yUpdateEdge(ye, id, changes);
  }, []);

  const removeEdgeById = useCallback((id: string) => {
    const ye = yEdgesRef.current;
    if (!ye) return;
    yRemoveEdge(ye, id);
  }, []);

  // ── React Flow change handlers ──────────────────────────────────
  //    onNodesChange / onEdgesChange are called by React Flow for
  //    drag, select, remove, etc. We apply the changes locally for
  //    immediate UI feedback, and write removes to Yjs.

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    const hasPosition = changes.some(c => c.type === 'position' && c.dragging);
    if (hasPosition) isDraggingRef.current = true;
    changes.forEach((change) => {
      if (change.type === 'remove') {
        removeNode(change.id);
      }
    });
  }, [removeNode]);

  const onNodeDragStop = useCallback((_event: any, node: any) => {
    isDraggingRef.current = false;
    const yn = yNodesRef.current;
    if (!yn) return;
    yUpdateNode(yn, node.id, { position: node.position });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    changes.forEach((change) => {
      if (change.type === 'remove') {
        removeEdgeById(change.id);
      }
    });
  }, [removeEdgeById]);

  const onConnect = useCallback((connection: any) => {
    const newEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: connection.source,
      target: connection.target,
      type: 'association',
      data: { type: 'ASSOCIATION' },
    };
    addEdge(newEdge);
  }, [addEdge]);

  const exportDiagram = useCallback(() => {
    const data = { nodes: nodesRef.current, edges: edgesRef.current };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagrama.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importDiagram = useCallback((file: File) => {
    const yn = yNodesRef.current;
    const ye = yEdgesRef.current;
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

        // Clear and repopulate in a single Yjs transaction only after validation.
        docTransact(ydocRef.current, () => {
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
  }, []);

  /**
   * Load diagram data directly from a parsed JSON object (from server REST API).
   */
  const loadDiagramData = useCallback((data: { nodes: any[]; edges: any[]; chat?: ChatMessage[] }) => {
    const yn = yNodesRef.current;
    const ye = yEdgesRef.current;
    const ychat = ychatRef.current;
    if (!yn || !ye || !ychat) return;
    // Siembra por canal: si el grafo ya está vivo (otro peer) no lo tocamos,
    // pero un chat huérfano (p. ej. mensaje emitido por el backend antes de
    // que entrara nadie) no debe impedir cargar nodos/aristas desde el REST.
    const hasGraph = yn.size > 0 || ye.size > 0;
    const hasChat = ychat.length > 0;
    if (hasGraph && hasChat) return;

    docTransact(ydocRef.current, () => {
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
        data.chat.forEach((msg) => ychat.push([msg]));
      }
    });
  }, []);

  const addMessage = useCallback(
    (sender: 'user' | 'ia' | 'system', text: string, author?: string) => {
      const ychat = ychatRef.current;
      if (!ychat) return;
      // El autor de los mensajes de usuario sale de la sesión (JWT), no del
      // llamador, para que cada peer vea el nombre real de quien preguntó.
      const resolvedAuthor =
        author ||
        (sender === 'user'
          ? userRef.current?.username || sessionIdentity.current.name || 'Usuario'
          : sender === 'ia'
          ? 'IA'
          : undefined);
      const msg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sender,
        author: resolvedAuthor,
        text,
        timestamp: Date.now(),
      };
      if (sender === 'user') {
        msg.clientId = userRef.current?.id || sessionIdentity.current.id;
      }
      ychat.push([msg]);
    },
    []
  );

  const currentUsername = user?.username || 'Anónimo';
  const [anonymousClientId] = useState(() => getOrCreateSessionIdentity().id);
  const currentClientId = user?.id || anonymousClientId;

  return {
    nodes,
    edges,
    messages,
    addMessage,
    currentUsername,
    currentClientId,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onConnect,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge: removeEdgeById,
    updateEdge,
    exportDiagram,
    importDiagram,
    loadDiagramData,
    isConnected,
    connectedUsers,
    provider,
    providerRef,
  };
}

/**
 * Run a set of Yjs mutations inside a single transaction.
 * This batches all changes into one update, reducing the number of
 * observer notifications and WebSocket messages.
 */
function docTransact(doc: Y.Doc | null, fn: () => void) {
  if (!doc) { fn(); return; }
  doc.transact(fn);
}
