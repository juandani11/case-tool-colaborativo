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
import {
  exportDiagramData,
  importDiagramFile,
  loadDiagramDataToYjs,
} from '../utils/yjsDiagramIo';
import { teardown } from '../utils/yjsTeardown';
import { buildChatMessage, dedupeChatMessages } from '../utils/chatMessage';

import type { ChatMessage, ConnectedUser } from '../types/collaboration';
export type { ChatMessage, ConnectedUser } from '../types/collaboration';

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
      setMessages(dedupeChatMessages(ychat.toArray()));
    };

    yn.observeDeep(onNodesDeepChange);
    ye.observeDeep(onEdgesDeepChange);
    ychat.observe(onChatChange);

    // Initial load
    setNodes(nodesToArray(yn));
    setEdges(edgesToArray(ye));
    setMessages(dedupeChatMessages(ychat.toArray()));

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
    exportDiagramData(nodesRef.current, edgesRef.current);
  }, []);

  const importDiagram = useCallback((file: File) => {
    importDiagramFile(file, {
      yn: yNodesRef.current,
      ye: yEdgesRef.current,
      doc: ydocRef.current,
    });
  }, []);

  /**
   * Load diagram data directly from a parsed JSON object (from server REST API).
   */
  const loadDiagramData = useCallback((data: { nodes: any[]; edges: any[]; chat?: ChatMessage[] }) => {
    loadDiagramDataToYjs(data, {
      yn: yNodesRef.current,
      ye: yEdgesRef.current,
      ychat: ychatRef.current,
      doc: ydocRef.current,
    });
  }, []);

  const addMessage = useCallback(
    (sender: 'user' | 'ia' | 'system', text: string, author?: string) => {
      const ychat = ychatRef.current;
      if (!ychat) return;
      const msg = buildChatMessage(sender, text, author, userRef.current, sessionIdentity.current);
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
