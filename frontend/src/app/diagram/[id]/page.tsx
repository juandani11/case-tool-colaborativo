'use client';

import { useCallback, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDiagramCatalog } from '../../../hooks/useDiagramCatalog';
import { useDiagramLoader } from '../../../hooks/useDiagramLoader';
import { useDiagramAccess } from '../../../hooks/useDiagramAccess';
import { useEditorSelection } from '../../../hooks/useEditorSelection';
import { useAssociationEditing } from '../../../hooks/useAssociationEditing';
import { useDiagramIo } from '../../../hooks/useDiagramIo';
import { useRelationMode } from '../../../hooks/useRelationMode';
import { useCanvasInteractions } from '../../../hooks/useCanvasInteractions';
import { usePanelSelection } from '../../../hooks/usePanelSelection';
import { useEdgeCreation } from '../../../hooks/useEdgeCreation';
import MembersPanel from '../../../components/MembersPanel';
import { ReactFlowProvider } from 'reactflow';
import Toolbar from '../../../components/Toolbar';
import Sidebar from '../../../components/Sidebar';
import DiagramSelector from '../../../components/DiagramSelector';
import ChatPanel from '../../../components/ChatPanel';
import EditorFlow from '../../../components/diagram/EditorFlow';
import EditorAccessStatus from '../../../components/diagram/EditorAccessStatus';
import EditorPanels from '../../../components/diagram/EditorPanels';
import AuthGate from '../../../components/diagram/AuthGate';
// PresencePanel se renderiza dentro de Toolbar, no directamente en page
import { useCollaborativeFlow } from '../../../hooks/useCollaborativeFlow';
import { useAICommand } from '../../../hooks/useAICommand';
import { UmlRelationshipType } from '../../../types/diagram';
import { useAiProvider } from '../../../hooks/useAiProvider';
import Palette from '../../../components/Palette';
import { useNodeLocks } from '../../../hooks/useNodeLocks';
import { isAssociationLinkEdge } from '../../../utils/associationClass';

// Orquestador del editor: lista de diagramas, rol (VIEWER = read-only),
// modo conexion de paleta (source -> target, Escape cancela, mismo nodo =
// self-loop), panels (entidad/arista/chat/miembros/ayuda), XMI, generate.
// Se monta con key={diagramId}: al navegar se remonta TODO (Yjs, rol, panels)
// y no se mezclan rooms. La colaboracion real vive en useCollaborativeFlow.
function EditorContent({ initialDiagramId }: { initialDiagramId?: string }) {
  const {
    diagrams,
    currentDiagramId,
    diagramsLoaded,
    currentRoom,
    navigateToDiagram,
    handleCreateDiagram,
    handleDeleteDiagram,
    handleRenameDiagram,
    updateDiagramName,
  } = useDiagramCatalog(initialDiagramId);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<UmlRelationshipType>('ASSOCIATION');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const { config: aiConfig, setConfig: setAiConfig } = useAiProvider();
  const {
    authEnabled,
    user,
    diagramRole,
    roleLoading,
    isViewer,
    noAccess,
    accessRequestState,
    accessRequestMessage,
    handleRequestAccess,
  } = useDiagramAccess(currentDiagramId);

  const [isConnecting, setIsConnecting] = useState(false);

  const handleSelectDiagram = useCallback((id: string) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    navigateToDiagram(id);
  }, [navigateToDiagram]);

  const {
    nodes,
    edges,
    messages,
    addMessage,
    currentUsername,
    currentClientId,
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
    provider,
    updateEdge,
  } = useCollaborativeFlow(currentRoom, diagramsLoaded && Boolean(currentDiagramId));

  const nodeLocks = useNodeLocks(provider);

  useDiagramLoader({
    currentDiagramId,
    diagramsLoaded,
    initialDiagramId,
    loadDiagramData,
    updateDiagramName,
  });

  const {
    selectedData,
    duplicateNodeName,
    selectedEdgeData,
    selectedNodeAssociationInfo,
    selectedElementForAI,
  } = useEditorSelection(nodes, edges, selectedNodeId, selectedEdgeId);

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
    diagramId: currentDiagramId || '',
    nodes,
    edges,
    selectedElement: selectedElementForAI,
    provider: aiConfig.provider,
    ollamaUrl: aiConfig.ollamaUrl,
    ollamaModel: aiConfig.ollamaModel,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    removeEdge,
    addMessage,
  });

  const {
    activeRelationType,
    pendingSource,
    activeRelationLabel,
    selectRelationType,
    cancelRelationMode,
    onNodeClick,
  } = useRelationMode(addEdge);

  const {
    handleSaveNode,
    handleDeleteSelectedNode,
    handleDissolveAssociationClass,
    handleNodesChange,
    handleConvertToAssociationClass,
  } = useAssociationEditing({
    nodes,
    edges,
    selectedNodeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    addNode,
    updateNode,
    removeNode,
    updateEdge,
    removeEdge,
    onNodesChange,
  });

  const { handleGenerateBackend, handleExportXmi, handleImportXmi } = useDiagramIo({
    nodes,
    edges,
    addNode,
    addEdge,
  });

  const { onDragOver, onDrop, handleAddEntity } = useCanvasInteractions(addNode);

  const {
    handleSelectNodeFromSidebar,
    handleSelectEdgeFromSidebar,
    onSelectionChange,
    onEdgeClick,
    onPaneClick,
    handleCloseEntityPanel,
    handleCloseEdgePanel,
  } = usePanelSelection({
    selectedNodeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    isViewer,
  });

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

  const handleOnConnect = useEdgeCreation(connectionType, addEdge);

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
            onSelectRelationType={selectRelationType}
            collapsed={paletteCollapsed}
            onToggleCollapse={() => {
              setPaletteCollapsed(true);
              cancelRelationMode();
            }}
          />
        )}

        {/* 3. Canvas */}
        <div className="flex-1 min-h-0 relative" onDragOver={onDragOver} onDrop={onDrop}>
          {!isViewer && paletteCollapsed && (
            <button
              type="button"
              onClick={() => setPaletteCollapsed(false)}
              className="absolute left-2 top-2 z-30 w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition-colors"
              title="Mostrar paleta"
              aria-label="Mostrar paleta"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <EditorPanels
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            selectedData={selectedData}
            selectedEdgeId={selectedEdgeId}
            selectedEdgeData={selectedEdgeData}
            associationInfo={selectedNodeAssociationInfo}
            duplicateName={duplicateNodeName}
            onSaveNode={handleSaveNode}
            onDeleteNode={handleDeleteSelectedNode}
            onDissolveAssociation={() => selectedNodeId && handleDissolveAssociationClass(selectedNodeId)}
            onCloseEntity={handleCloseEntityPanel}
            onCloseEdge={handleCloseEdgePanel}
            onUpdateEdge={updateEdge}
            onConvertToAssociationClass={() => selectedEdgeId && handleConvertToAssociationClass(selectedEdgeId)}
          />

          <EditorAccessStatus
            authEnabled={authEnabled}
            diagramRole={diagramRole}
            roleLoading={roleLoading}
            noAccess={noAccess}
            accessRequestState={accessRequestState}
            accessRequestMessage={accessRequestMessage}
            onRequestAccess={handleRequestAccess}
          />

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
                  ? `Modo: ${activeRelationLabel}. Click en el nodo origen.`
                  : `Click en el destino (o en el mismo nodo para self-loop).`}
              </span>
              <button
                onClick={cancelRelationMode}
                className="text-sm text-blue-700 hover:underline font-medium"
              >
                Cancelar (Esc)
              </button>
            </div>
          )}

          <EditorFlow
            nodes={nodes}
            edges={edges}
            nodeLocks={nodeLocks}
            user={user}
            connectedUsers={connectedUsers}
            isViewer={isViewer}
            pendingSource={pendingSource}
            isConnecting={isConnecting}
            activeRelationType={activeRelationType}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleOnConnect}
            onConnectStart={() => setIsConnecting(true)}
            onConnectEnd={() => setIsConnecting(false)}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={onSelectionChange}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
          />
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
          currentUsername={currentUsername}
          currentClientId={currentClientId}
          aiConfig={aiConfig}
          onAiConfigChange={setAiConfig}
        />
      </div>
    </div>
  );
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
