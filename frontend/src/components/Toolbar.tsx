'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RelationTypeSelector from './RelationTypeSelector';
import PresencePanel from './PresencePanel';
import UserMenu from './UserMenu';
import { ConnectedUser } from '../hooks/useCollaborativeFlow';
import { DS } from '../styles/design-system';
import AppLogo from './AppLogo';

interface ToolbarProps {
  isConnected: boolean;
  onAddEntity: () => void;
  onExport: () => void;
  onExportXmi: () => void;
  onImport: (file: File) => void;
  onImportXmi: (file: File) => void;
  onGenerateBackend: () => void;
  onFromImage: (file: File) => void;
  isFromImage: boolean;
  onToggleChat: () => void;
  isChatOpen: boolean;
  connectionType: 'ASSOCIATION' | 'INHERITANCE' | 'AGGREGATION' | 'COMPOSITION';
  onConnectionTypeChange: (value: 'ASSOCIATION' | 'INHERITANCE' | 'AGGREGATION' | 'COMPOSITION') => void;
  connectedUsers?: ConnectedUser[];
  readOnly?: boolean;
  showMembersButton?: boolean;
  onToggleMembers?: () => void;
  isMembersOpen?: boolean;
}

export default function Toolbar({
  isConnected,
  onAddEntity,
  onExport,
  onExportXmi,
  onImport,
  onImportXmi,
  onGenerateBackend,
  onFromImage,
  isFromImage,
  onToggleChat,
  isChatOpen,
  connectionType,
  onConnectionTypeChange,
  connectedUsers,
  readOnly,
  showMembersButton,
  onToggleMembers,
  isMembersOpen,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const xmiInputRef = useRef<HTMLInputElement>(null);
  const [showRelationSelector, setShowRelationSelector] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFromImage(file);
    }
    e.target.value = '';
  };

  const handleXmiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportXmi(file);
    }
    e.target.value = '';
  };

  return (
    <div className="h-11 bg-white border-b border-gray-200 flex items-center px-3 gap-1 text-sm relative z-20 flex-shrink-0">
      {/* Logo / Title */}
      <div className="flex items-center gap-2 pr-3 border-r border-gray-200 mr-1">
        <div className="hidden sm:block">
          <AppLogo size="sm" showSubtitle={false} />
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          title="Volver al dashboard"
          className={`text-[11px] ${DS.button.ghost} !py-0.5 !px-1.5 hidden sm:inline`}
        >
          ← Dashboard
        </button>
      </div>

      {/* Diagram Actions (ocultas en solo lectura) */}
      {!readOnly && (
        <>
          <ToolGroup>
            <ToolButton onClick={onAddEntity} tooltip="Agregar entidad">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span className="hidden md:inline">Entidad</span>
            </ToolButton>
            <div className="relative">
              <ToolButton
                onClick={() => setShowRelationSelector(!showRelationSelector)}
                active={showRelationSelector}
                tooltip="Tipo de conexión"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="3" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="11" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/><line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1.3"/></svg>
                <span className="hidden md:inline">Conexión</span>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="ml-0.5"><path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </ToolButton>
              {showRelationSelector && (
                <div className="absolute top-full left-0 mt-1 z-50">
                  <RelationTypeSelector
                    value={connectionType}
                    onChange={(v) => {
                      onConnectionTypeChange(v);
                      setShowRelationSelector(false);
                    }}
                  />
                </div>
              )}
            </div>
          </ToolGroup>

          <div className="w-px h-5 bg-gray-200 mx-1" />
        </>
      )}

      {/* File Actions */}
      <ToolGroup>
        <ToolButton onClick={onExport} tooltip="Exportar JSON">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7m0 0L4 6m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span className="hidden lg:inline">JSON</span>
        </ToolButton>
        <ToolButton onClick={onExportXmi} tooltip="Exportar XMI (Enterprise Architect)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v7m0 0L4 6m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span className="hidden lg:inline">XMI</span>
        </ToolButton>
        {!readOnly && (
          <>
            <ToolButton onClick={() => fileInputRef.current?.click()} tooltip="Importar JSON">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9V2m0 7L4 6m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span className="hidden lg:inline">Importar</span>
        </ToolButton>
        <ToolButton onClick={() => xmiInputRef.current?.click()} tooltip="Importar XMI (Enterprise Architect)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9V2m0 7L4 6m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1.5A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span className="hidden lg:inline">XMI</span>
        </ToolButton>
        <ToolButton
          onClick={() => imageInputRef.current?.click()}
          tooltip="Generar diagrama desde imagen"
          disabled={isFromImage}
        >
          {isFromImage ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="16 8" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="5" r="1.2" stroke="currentColor" strokeWidth="1"/><path d="M1 9.5l3-2.5 2 1.5 3-3 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
          <span className="hidden lg:inline">Desde imagen</span>
        </ToolButton>
        <ToolButton onClick={onGenerateBackend} tooltip="Generar backend" variant="primary">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L2 7l3 4M9 3l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="hidden lg:inline">Generar</span>
        </ToolButton>
          </>
        )}
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          onChange={handleImageChange}
          className="hidden"
        />
        <input
          type="file"
          accept=".xmi,.xml"
          ref={xmiInputRef}
          onChange={handleXmiChange}
          className="hidden"
        />
      </ToolGroup>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      {/* Chat Toggle */}
      <div className="flex items-center gap-1.5">
        <ToolButton
          onClick={onToggleChat}
          active={isChatOpen}
          tooltip={isChatOpen ? 'Cerrar chat' : 'Abrir chat'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3h10a1 1 0 011 1v5a1 1 0 01-1 1H5l-3 2.5V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="hidden md:inline">Chat</span>
        </ToolButton>
        {showMembersButton && onToggleMembers && (
          <ToolButton
            onClick={onToggleMembers}
            active={isMembersOpen}
            tooltip="Gestionar miembros"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="5" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1.5 12c.5-2.3 1.9-3.5 3.5-3.5S7.9 9.7 8.5 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="10" cy="5.5" r="1.7" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M9.5 8.7c1.4.2 2.4 1.2 2.9 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <span className="hidden md:inline">Miembros</span>
          </ToolButton>
        )}
      </div>

      <div className="flex-1" />

      {/* Presence */}
      {connectedUsers && connectedUsers.length > 0 && (
        <>
          <PresencePanel users={connectedUsers} />
          <div className="w-px h-5 bg-gray-200 mx-1" />
        </>
      )}

      {/* Connection Status */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200 ml-1">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <span className="text-[11px] text-gray-500 hidden sm:inline">
          {isConnected ? 'Conectado' : 'Sin conexión'}
        </span>
      </div>

      {/* Usuario (solo visible con AUTH_ENABLED=true y sesión) */}
      <UserMenu />
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolButton({
  onClick,
  children,
  tooltip,
  active,
  variant,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tooltip?: string;
  active?: boolean;
  variant?: 'default' | 'primary';
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : active
          ? 'bg-blue-100 text-blue-700'
          : variant === 'primary'
          ? `bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800`
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}
