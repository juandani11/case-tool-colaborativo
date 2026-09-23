'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { apiFetch } from '../../../lib/apiClient';
import { useDiagramRole } from '../../../hooks/useDiagramRole';
import MembersPanel from '../../../components/MembersPanel';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Node,
  OnSelectionChangeParams,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import EntityNode from '../../../components/EntityNode';
import InheritanceEdge from '../../../components/InheritanceEdge';
import AggregationEdge from '../../../components/AggregationEdge';
import CompositionEdge from '../../../components/CompositionEdge';
import AssociationEdge from '../../../components/AssociationEdge';
import Toolbar from '../../../components/Toolbar';
import Sidebar from '../../../components/Sidebar';
import DiagramSelector, { DiagramInfo } from '../../../components/DiagramSelector';
import EntityEditorPanel from '../../../components/EntityEditorPanel';
import EdgeEditorPanel from '../../../components/EdgeEditorPanel';
import ChatPanel from '../../../components/ChatPanel';
// PresencePanel se renderiza dentro de Toolbar, no directamente en page
import { useCollaborativeFlow } from '../../../hooks/useCollaborativeFlow';
import { useAICommand } from '../../../hooks/useAICommand';
import { EntityNodeData, RelationshipData, UmlRelationshipType } from '../../../types/diagram';
import { nodesToAST } from '../../../utils/ast';
import { importFromXmi } from '../../../utils/xmiImporter';
import { exportToXmi, downloadXmi } from '../../../utils/xmiExporter';
import { typeMap as relationshipToReactFlow } from '../../../utils/yjsEdgeHelpers';
import DashedEdge from '../../../components/DashedEdge';
import SelfLoopEdge from '../../../components/edges/SelfLoopEdge';
import AssociationClassConnector from '../../../components/AssociationClassConnector';
import Palette, { RELATIONSHIPS } from '../../../components/Palette';
import { useNodeLocks } from '../../../hooks/useNodeLocks';
import {
  AssociationDeletePlan,
  buildAssociationNode,
  isAssociationLinkEdge,
  planAssociationDelete,
} from '../../../utils/associationClass';

const nodeTypes = { entity: EntityNode };
const edgeTypes = {
  association: AssociationEdge,
  inheritance: InheritanceEdge,
  aggregation: AggregationEdge,
  composition: CompositionEdge,
  dashed: DashedEdge,
  selfloop: SelfLoopEdge,
};

const DIAGRAMS_STORAGE_KEY = 'uml-editor-diagrams';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1234';

function humanizeDiagramId(id: string): string {
  // "diagram-1788128550848" -> "Diagrama 1788128550848"
  // "diagram-1" -> "Diagrama 1"
  const num = id.replace(/^diagram-/, '');
  return `Diagrama ${num}`;
}

function EditorContent({ initialDiagramId }: { initialDiagramId?: string }) {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramInfo[]>([]);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [diagramsLoaded, setDiagramsLoaded] = useState(false);
  const initializedRef = useRef(false);

  // Navegar entre diagramas recarga la ruta (el key del padre remonts todo)
  const navigateToDiagram = useCallback((id: string) => {
    router.push(`/diagram/${id}`);
  }, [router]);

  // Step 1: Fetch diagram list from server on mount.
  // Acepta tanto el formato legacy (array) como el nuevo ({ owned, shared }).
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const lastId = localStorage.getItem('uml-editor-current-diagram');

    apiFetch(`${API_BASE}/api/diagrams`)
      .then(r => r.json())
      .then((payload: { id: string; name?: string; updatedAt?: number }[] | { owned?: { id: string; name?: string; updatedAt?: number }[]; shared?: { id: string; name?: string; updatedAt?: number }[] }) => {
        const serverDiagrams = Array.isArray(payload)
          ? payload
          : [...(payload.owned || []), ...(payload.shared || [])];
        if (serverDiagrams.length === 0) {
          if (initialDiagramId) {
            // Link directo a un diagrama aún no creado: abrirlo vacío
            setDiagrams([{ id: initialDiagramId, name: humanizeDiagramId(initialDiagramId) }]);
            setCurrentDiagramId(initialDiagramId);
            setDiagramsLoaded(true);
            return;
          }
          // No diagrams on server — create default and save it
          const defaultList: DiagramInfo[] = [{ id: 'diagram-1', name: 'Diagrama 1' }];
          setDiagrams(defaultList);
          setCurrentDiagramId('diagram-1');
          setDiagramsLoaded(true);
          apiFetch(`${API_BASE}/api/diagrams/diagram-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Diagrama 1', nodes: [], edges: [], chat: [] }),
          }).catch(() => {});
          return;
        }

        // Build DiagramInfo[] from server IDs
        const sorted = [...serverDiagrams].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        const list: DiagramInfo[] = sorted.map(d => ({
          id: d.id,
          name: (d as any).name || humanizeDiagramId(d.id),
        }));

        setDiagrams(list);

        // La URL manda; si no, último abierto; si no, el primero
        if (initialDiagramId) {
          setCurrentDiagramId(initialDiagramId);
          if (!list.some(d => d.id === initialDiagramId)) {
            setDiagrams(prev => [...prev, { id: initialDiagramId, name: humanizeDiagramId(initialDiagramId) }]);
          }
        } else if (lastId && list.some(d => d.id === lastId)) {
          setCurrentDiagramId(lastId);
        } else {
          setCurrentDiagramId(list[0].id);
        }
        setDiagramsLoaded(true);
      })
      .catch(() => {
        // Server unavailable — fall back to localStorage
        try {
          const stored = localStorage.getItem(DIAGRAMS_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDiagrams(parsed);
              if (initialDiagramId) {
                setCurrentDiagramId(initialDiagramId);
              } else {
                setCurrentDiagramId(lastId && parsed.some((d: DiagramInfo) => d.id === lastId) ? lastId : parsed[0].id);
              }
              setDiagramsLoaded(true);
              return;
            }
          }
        } catch {}
        // Ultimate fallback
        const fallbackId = initialDiagramId || 'diagram-1';
        setDiagrams([{ id: fallbackId, name: humanizeDiagramId(fallbackId) }]);
        setCurrentDiagramId(fallbackId);
        setDiagramsLoaded(true);
      });
  }, []);

  const currentRoom = `diagram-room-${currentDiagramId || 'diagram-1'}`;

  // Persist current diagram selection (client only)
  useEffect(() => {
    if (typeof window === 'undefined' || !currentDiagramId) return;
    localStorage.setItem('uml-editor-current-diagram', currentDiagramId);
  }, [currentDiagramId]);

  // Persist diagrams list (client only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DIAGRAMS_STORAGE_KEY, JSON.stringify(diagrams));
  }, [diagrams]);

  const handleSelectDiagram = useCallback((id: string) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    navigateToDiagram(id);
  }, [navigateToDiagram]);

  const handleCreateDiagram = useCallback(() => {
    // Crear en el servidor (devuelve id + crea ACL con el usuario como OWNER)
    apiFetch(`${API_BASE}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo diagrama' }),
    })
      .then(r => r.json())
      .then((data: { id?: string }) => {
        if (data && data.id) {
          navigateToDiagram(data.id);
        }
      })
      .catch(() => {});
  }, [navigateToDiagram]);

  const handleDeleteDiagram = useCallback((id: string) => {
    const wasCurrent = id === currentDiagramId;
    // Delete from server
    apiFetch(`${API_BASE}/api/diagrams/${id}`, { method: 'DELETE' }).catch(() => {});

    setDiagrams(prev => prev.filter(d => d.id !== id));

    if (wasCurrent) {
      // Volver al dashboard; si no quedaba nada, el dashboard permite crear
      router.push('/dashboard');
    }
  }, [currentDiagramId, router]);

  const handleRenameDiagram = useCallback((id: string, name: string) => {
    setDiagrams(prev => prev.map(d => d.id === id ? { ...d, name } : d));
    // Persist to server
    apiFetch(`${API_BASE}/api/diagrams/${id}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => {});
  }, []);

  const {
    nodes,
    edges,
    messages,
    addMessage,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    exportDiagram,
    importDiagram,
    loadDiagramData,
    isConnected,
    connectedUsers,
    providerRef,
    updateEdge,
    getSnapshot,
  } = useCollaborativeFlow(currentRoom);

  const nodeLocks = useNodeLocks(providerRef.current);

  // Load diagram data from server when switching diagrams (or on first load)
  useEffect(() => {
    if (!diagramsLoaded || !currentDiagramId) return;
    let cancelled = false;
    apiFetch(`${API_BASE}/api/diagrams/${currentDiagramId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.nodes && data.edges) {
          loadDiagramData({ nodes: data.nodes, edges: data.edges, chat: data.chat });
        }
        // Update diagram name from server if available
        if (data.name) {
          setDiagrams(prev => prev.map(d => d.id === currentDiagramId ? { ...d, name: data.name } : d));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentDiagramId, diagramsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resetear modo conexion al cambiar de diagrama
  useEffect(() => {
    setActiveRelationType(null);
    setPendingSource(null);
  }, [currentDiagramId]);

  // Debounce save to server (1 second after last change)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0 && messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const snapshot = getSnapshot();
      const diagram = diagrams.find(d => d.id === currentDiagramId);
      apiFetch(`${API_BASE}/api/diagrams/${currentDiagramId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...snapshot, name: diagram?.name }),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, messages, currentDiagramId, getSnapshot, diagrams]);

  const {
    command,
    setCommand,
    isProcessing,
    isRecording,
    isFromImage,
    handleSendCommand,
    handleVoiceCommand,
    handleFromImage,
  } = useAICommand({
    nodes,
    edges,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    addMessage,
  });

  const reactFlow = useReactFlow();

  // ── Palette drag-and-drop ────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow');
      if (!raw) return;
      try {
        const { defaultData } = JSON.parse(raw);
        const position = reactFlow.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const newNode = {
          id: `entity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'entity',
          position,
          data: {
            label: defaultData.label || 'Nueva',
            attributes: defaultData.attributes || [],
            methods: defaultData.methods || [],
            stereotype: defaultData.stereotype || 'class',
            isAbstract: defaultData.isAbstract,
            isNote: defaultData.isNote,
          },
        };
        addNode(newNode);
      } catch {}
    },
    [reactFlow, addNode]
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<UmlRelationshipType>('ASSOCIATION');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  // ── Modo conexion (paleta de relaciones) ─────────────────────────
  const [activeRelationType, setActiveRelationType] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Cancelar modo conexion con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeRelationType) {
        setActiveRelationType(null);
        setPendingSource(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeRelationType]);

  // Rol en el diagrama actual (Fase 2A). Con AUTH_ENABLED=false el
  // backend devuelve OWNER y todo funciona como antes.
  const { role: diagramRole, loading: roleLoading } = useDiagramRole(currentDiagramId);
  const { authEnabled, user } = useAuth();
  const isViewer = authEnabled && diagramRole === 'VIEWER';
  const noAccess = authEnabled && !roleLoading && diagramRole === 'NONE';

  // Responsive: auto-collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectNodeFromSidebar = useCallback((nodeId: string) => {
    if (isViewer) return;
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
    reactFlow.setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, [reactFlow, isViewer]);

  const handleSelectEdgeFromSidebar = useCallback((edgeId: string) => {
    if (isViewer) return;
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    reactFlow.setEdges(eds => eds.map(e => ({ ...e, selected: e.id === edgeId })));
  }, [reactFlow, isViewer]);

  const handleAddEntity = useCallback(() => {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: Node<EntityNodeData> = {
      id,
      type: 'entity',
      position: { x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 },
      data: {
        label: 'NuevaEntidad',
        attributes: [],
        methods: [],
        stereotype: 'class',
      },
    };
    addNode(newNode);
  }, [addNode]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.nodes.length > 0) {
      setSelectedNodeId(params.nodes[0].id);
      setSelectedEdgeId(null);
    }
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // ── Click en nodo: modo conexion o seleccion normal ──────────────
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      if (!activeRelationType) return;

      if (!pendingSource) {
        setPendingSource(node.id);
        return;
      }

      // Crear arista. Si source === target es un self-loop → type='selfloop'.
      const rel = RELATIONSHIPS.find(r => r.id === activeRelationType);
      const isSelfLoop = pendingSource === node.id;
      addEdge({
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: pendingSource,
        target: node.id,
        type: isSelfLoop ? 'selfloop' : activeRelationType,
        data: {
          type: rel ? rel.relationshipType : 'ASSOCIATION',
          cardinalityFrom: '1',
          cardinalityTo: '1',
          isSelfLoop,
        },
      });

      setPendingSource(null);
      setActiveRelationType(null);
    },
    [activeRelationType, pendingSource, addEdge]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedData = selectedNode?.data as EntityNodeData | undefined;

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const selectedEdgeData = selectedEdge?.data as RelationshipData | undefined;

  // Info de clase asociativa para el panel de entidad (nuevo modelo con
  // stash o legacy con associationClassId en la arista).
  const selectedNodeAssociationInfo = (() => {
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
  })();

  const handleSaveNode = useCallback((id: string, data: EntityNodeData) => {
    // Fusionar con los datos existentes: el panel no conoce los campos de
    // clase asociativa (isAssociationClass, associationOf) y no debe borrarlos.
    const existing: any = nodes.find((n: any) => n.id === id)?.data;
    updateNode(id, { data: { ...existing, ...data } });
  }, [updateNode, nodes]);

  // Aplica el plan de borrado/disolución de un nodo asociativo.
  // La arista original se conserva siempre: solo se limpian vínculos.
  const applyAssociationDeletePlan = useCallback((plan: AssociationDeletePlan) => {
    plan.linkIdsToRemove.forEach((linkId: string) => removeEdge(linkId));
    plan.edgeFieldClears.forEach(({ edgeId, field }: { edgeId: string; field: string }) =>
      updateEdge(edgeId, { data: { [field]: undefined } })
    );
  }, [removeEdge, updateEdge]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (selectedNodeId) {
      applyAssociationDeletePlan(planAssociationDelete(nodes, edges, selectedNodeId));
      removeNode(selectedNodeId);
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, removeNode, nodes, edges, applyAssociationDeletePlan]);

  // Disolver desde el panel del nodo (caso B2-D): limpia el vínculo en la
  // arista (que queda * a * normal) y elimina el nodo asociativo.
  const handleDissolveAssociationClass = useCallback((nodeId: string) => {
    const node: any = nodes.find((n: any) => n.id === nodeId);
    if (!node) return;
    applyAssociationDeletePlan(planAssociationDelete(nodes, edges, nodeId));
    removeNode(nodeId);
    setSelectedNodeId(null);
  }, [nodes, edges, applyAssociationDeletePlan, removeNode]);

  // Borrado por teclado (Supr/Backspace): misma cascada que el botón.
  // Se planifica con el estado previo y luego se delega al hook.
  const handleNodesChange = useCallback((changes: any[]) => {
    (changes || [])
      .filter((c: any) => c.type === 'remove' && c.id)
      .forEach((c: any) => {
        applyAssociationDeletePlan(planAssociationDelete(nodes, edges, c.id));
      });
    onNodesChange(changes);
  }, [nodes, edges, applyAssociationDeletePlan, onNodesChange]);

  // Bloque 2: la arista * a * SE CONSERVA y apunta al nodo
  // (edge.data.associationClassNodeId). El overlay AssociationClassConnector
  // dibuja la línea punteada al punto medio. Sin aristas punteadas reales.
  const handleConvertToAssociationClass = useCallback((edgeId: string) => {
    const edge: any = edges.find((e: any) => e.id === edgeId);
    if (!edge) return;
    if (edge.data?.associationClassNodeId || edge.data?.associationClassId) return;
    if (isAssociationLinkEdge(edge)) return;
    const fromNode = nodes.find((n: any) => n.id === edge.source);
    const toNode = nodes.find((n: any) => n.id === edge.target);
    if (!fromNode || !toNode) return;
    const assocNode = buildAssociationNode(fromNode, toNode, edge);
    addNode(assocNode);
    updateEdge(edgeId, { data: { associationClassNodeId: assocNode.id } });
    // Seleccionar el nuevo nodo para editarlo inmediatamente
    setSelectedEdgeId(null);
    setSelectedNodeId(assocNode.id);
  }, [edges, nodes, addNode, updateEdge]);

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
    // Las aristas punteadas son internas del editor: no se exportan.
    const xmiContent = exportToXmi(nodes, edges.filter((e: any) => !isAssociationLinkEdge(e)));
    downloadXmi(xmiContent, 'diagrama.xmi');
  }, [nodes, edges]);

  const handleOnConnect = useCallback((connection: any) => {
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

    const newEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: connection.source,
      target: connection.target,
      type: edgeType,
      data: {
        type: relationshipType,
        cardinalityFrom: '1',
        cardinalityTo: '1',
      },
    };
    addEdge(newEdge);
  }, [addEdge, connectionType]);

  const handleCloseEntityPanel = useCallback(() => {
    setSelectedNodeId(null);
    reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: false })));
  }, [reactFlow]);

  const handleCloseEdgePanel = useCallback(() => {
    setSelectedEdgeId(null);
    reactFlow.setEdges(eds => eds.map(e => ({ ...e, selected: false })));
  }, [reactFlow]);

  const handleImportXmi = useCallback((file: File) => {
    importFromXmi(file, { addNode, addEdge });
  }, [addNode, addEdge]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden">
      <Toolbar
        isConnected={isConnected}
        onAddEntity={handleAddEntity}
        onExport={exportDiagram}
        onExportXmi={handleExportXmi}
        onImport={importDiagram}
        onImportXmi={handleImportXmi}
        onGenerateBackend={handleGenerateBackend}
        onFromImage={handleFromImage}
        isFromImage={isFromImage}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
        connectionType={connectionType}
        onConnectionTypeChange={setConnectionType}
        connectedUsers={connectedUsers}
        readOnly={isViewer}
        showMembersButton={authEnabled && diagramRole === 'OWNER'}
        onToggleMembers={() => setIsMembersOpen(!isMembersOpen)}
        isMembersOpen={isMembersOpen}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 1. Explorador (colapsable) */}
        <Sidebar
          nodes={nodes}
          edges={edges.filter((e: any) => !isAssociationLinkEdge(e))}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onSelectNode={handleSelectNodeFromSidebar}
          onSelectEdge={handleSelectEdgeFromSidebar}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          diagramSelector={
            <DiagramSelector
              diagrams={diagrams}
              currentDiagramId={currentDiagramId}
              onSelect={handleSelectDiagram}
              onCreate={handleCreateDiagram}
              onDelete={handleDeleteDiagram}
              onRename={handleRenameDiagram}
            />
          }
        />

        {/* 2. Paleta (fija) */}
        {!isViewer && (
          <Palette
            activeRelationType={activeRelationType}
            onSelectRelationType={(type) => {
              setActiveRelationType(type);
              setPendingSource(null);
            }}
          />
        )}

        {/* 3. Canvas */}
        <div className="flex-1 min-h-0 relative" onDragOver={onDragOver} onDrop={onDrop}>
          {/* Floating Entity Editor Panel */}
          {selectedNodeId && selectedData && (
            <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
              <EntityEditorPanel
                nodeId={selectedNodeId}
                initialData={selectedData}
                onSave={handleSaveNode}
                onClose={handleCloseEntityPanel}
                associationInfo={selectedNodeAssociationInfo}
                onDissolveAssociation={() => handleDissolveAssociationClass(selectedNodeId)}
              />
              <button
                onClick={handleDeleteSelectedNode}
                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl border border-red-200 transition-colors"
              >
                Eliminar entidad
              </button>
            </div>
          )}

          {/* Floating Edge Editor Panel */}
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
                  updateEdge(selectedEdgeId, {
                    type: reactFlowEdgeType,
                    cardinalityFrom: data.cardinalityFrom,
                    cardinalityTo: data.cardinalityTo,
                    data: {
                      type: data.type,
                      cardinalityFrom: data.cardinalityFrom,
                      cardinalityTo: data.cardinalityTo,
                      // Preservar el vínculo a clase asociativa (si existe)
                      associationClassId: selectedEdgeData.associationClassId,
                    },
                  });
                }}
                associationClassName={
                  selectedEdgeData.associationClassId
                    ? nodes.find((n: any) => n.id === selectedEdgeData.associationClassId)?.data?.label || null
                    : null
                }
                onConvertToAssociationClass={() => handleConvertToAssociationClass(selectedEdgeId)}
                onClose={handleCloseEdgePanel}
              />
            </div>
          )}

          {/* Muro de acceso + badges de rol (Fase 2A, solo con auth activo) */}
          {noAccess && (
            <div className="absolute inset-0 z-40 bg-gray-100/95 flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 max-w-sm text-center space-y-3">
                <h2 className="font-bold text-gray-800">No tienes acceso a este diagrama</h2>
                <p className="text-sm text-gray-500">
                  Pide al owner que te invite como editor o lector.
                </p>
                <button
                  disabled
                  title="Disponible en Fase 3"
                  className="w-full py-2 bg-gray-200 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
                >
                  Solicitar acceso (Fase 3)
                </button>
              </div>
            </div>
          )}
          {authEnabled && !noAccess && !roleLoading && diagramRole !== 'NONE' && (
            <div className="absolute left-3 bottom-3 z-30 flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  diagramRole === 'OWNER'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : diagramRole === 'EDITOR'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {diagramRole === 'OWNER' ? 'Owner' : diagramRole === 'EDITOR' ? 'Editor' : 'Solo lectura'}
              </span>
            </div>
          )}

          {/* Panel de miembros (solo OWNER) */}
          {isMembersOpen && authEnabled && diagramRole === 'OWNER' && currentDiagramId && (
            <div className="absolute right-4 top-4 z-30">
              <MembersPanel
                key={currentDiagramId}
                diagramId={currentDiagramId}
                onClose={() => setIsMembersOpen(false)}
              />
            </div>
          )}

          {/* Banner de modo conexion */}
          {activeRelationType && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-50 border border-blue-300 rounded-lg px-4 py-2 shadow-md flex items-center gap-3">
              <span className="text-sm text-blue-800">
                {!pendingSource
                  ? `Modo: ${RELATIONSHIPS.find(r => r.id === activeRelationType)?.label}. Click en el nodo origen.`
                  : `Click en el destino (o en el mismo nodo para self-loop).`}
              </span>
              <button
                onClick={() => { setActiveRelationType(null); setPendingSource(null); }}
                className="text-sm text-blue-700 hover:underline font-medium"
              >
                Cancelar (Esc)
              </button>
            </div>
          )}

          <div className={`w-full h-full ${activeRelationType ? 'cursor-crosshair' : ''}`}>
          <ReactFlow
            nodes={nodes.map(n => {
              const lock = nodeLocks.get(n.id);
              const isOwnLock = lock && user && connectedUsers.some(
                u => u.id === user.id && u.name === lock.name
              );
              const isPendingSource = pendingSource === n.id;
              return {
                ...n,
                draggable: isViewer ? false : !lock || !!isOwnLock,
                style: {
                  ...(lock ? { boxShadow: `0 0 0 3px ${lock.color}` } : {}),
                  ...(isPendingSource ? { boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.5)' } : {}),
                  ...(isConnecting && !isPendingSource ? {
                    outline: '2px dashed #60a5fa',
                    outlineOffset: '4px',
                  } : {}),
                },
                data: { ...n.data, lockedBy: lock || undefined },
              };
            })}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={isViewer ? undefined : handleOnConnect}
            onConnectStart={() => setIsConnecting(true)}
            onConnectEnd={() => setIsConnecting(false)}
            onNodeClick={isViewer ? undefined : onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={isViewer ? undefined : onSelectionChange}
            onEdgeClick={isViewer ? undefined : onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={!isViewer}
            nodesConnectable={!isViewer}
            elementsSelectable={!isViewer}
            connectionRadius={40}
            deleteKeyCode={isViewer ? [] : ['Backspace', 'Delete']}
            defaultEdgeOptions={{ type: 'association', style: { strokeWidth: 2 } }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e5e7eb" gap={20} size={1} />
            <Controls className="!bg-white !border-gray-200 !shadow-md !rounded-lg" />
            <MiniMap
              className="!bg-gray-50 !border-gray-200 !shadow-md !rounded-lg"
              nodeColor="#94a3b8"
              maskColor="rgba(0,0,0,0.05)"
            />
            {/* Bloque 2: línea punteada nodo -> punto medio de la arista */}
            <AssociationClassConnector />
          </ReactFlow>
          </div>
        </div>

        <ChatPanel
          messages={messages}
          command={command}
          setCommand={setCommand}
          onSendCommand={handleSendCommand}
          isProcessing={isProcessing}
          isRecording={isRecording}
          onVoiceCommand={handleVoiceCommand}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
          readOnly={isViewer}
        />
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, authEnabled } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && authEnabled && !user) {
      router.push('/login');
    }
  }, [user, loading, authEnabled, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-gray-500">
        Cargando...
      </div>
    );
  }
  if (authEnabled && !user) return null;
  return <>{children}</>;
}

export default function DiagramPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  return (
    <ReactFlowProvider>
      <AuthGate>
        {/* key = remount limpio al navegar entre diagramas (Yjs + rol) */}
        <EditorContent key={id} initialDiagramId={id} />
      </AuthGate>
    </ReactFlowProvider>
  );
}
