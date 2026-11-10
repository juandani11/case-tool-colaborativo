'use client';

import { useRef, useEffect, useMemo, useState, memo } from 'react';
import { ChatMessage } from '../hooks/useCollaborativeFlow';
import { AiProvider } from '../types/diagram';
import { AiConfig } from '../hooks/useAiProvider';
import AiConfigModal from './AiConfigModal';
import { BotIcon } from './Icons';
import { dedupeChatMessages } from '../utils/chatMessage';
import { mentionsUser } from '../utils/chatMentions';

// UI del asistente de IA: historial + input de texto + microfono. Pura vista:
// la logica vive en useAICommand (texto/voz/imagen). Los mensajes llegan por
// Yjs (chat colaborativo), por eso otro peer ve lo que escribes. readOnly
// (VIEWER) oculta el input pero muestra el historial.
interface ChatPanelProps {
  messages: ChatMessage[];
  command: string;
  setCommand: (value: string) => void;
  onSendCommand: () => void;
  onCancel?: () => void;
  isProcessing: boolean;
  isRecording: boolean;
  onVoiceCommand: () => void;
  isOpen: boolean;
  onToggle: () => void;
  readOnly?: boolean;
  currentUsername?: string;
  currentClientId?: string;
  aiConfig: AiConfig;
  onAiConfigChange: (config: AiConfig) => void;
}

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 560;
const DEFAULT_PANEL_WIDTH = 340;

const authorStyles = [
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];

function clampWidth(value: number) {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(value)));
}

function authorStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return authorStyles[Math.abs(hash) % authorStyles.length];
}

function authorInitial(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function ChatPanelInner({
  messages,
  command,
  setCommand,
  onSendCommand,
  onCancel,
  isProcessing,
  isRecording,
  onVoiceCommand,
  isOpen,
  onToggle,
  readOnly,
  currentUsername,
  currentClientId,
  aiConfig,
  onAiConfigChange,
}: ChatPanelProps) {
  const visibleMessages = useMemo(() => dedupeChatMessages(messages), [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [configOpen, setConfigOpen] = useState(false);
  const stopResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (stopResizeRef.current) stopResizeRef.current();
    };
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 64;
  };

  useEffect(() => {
    if (isOpen) stickToBottomRef.current = true;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [visibleMessages, isProcessing, isOpen]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [command, isOpen]);

  const handleSend = () => {
    stickToBottomRef.current = true;
    onSendCommand();
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;

    const onMove = (moveEvent: PointerEvent) => {
      setPanelWidth(clampWidth(startWidth + (startX - moveEvent.clientX)));
    };

    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    stopResizeRef.current = stop;
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-4 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
        title="Abrir chat"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-3 3V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    );
  }

  return (
    <div
      className="relative w-[var(--chat-width)] max-w-[100vw] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full max-h-full overflow-hidden text-gray-900 max-sm:fixed max-sm:inset-y-0 max-sm:right-0 max-sm:z-40 max-sm:w-screen max-sm:shadow-2xl"
      style={{ '--chat-width': `${panelWidth}px` } as React.CSSProperties}
    >
      <div
        onPointerDown={handleResizeStart}
        className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize touch-none hover:bg-blue-400/40 transition-colors max-sm:hidden"
        title="Arrastra para redimensionar el chat"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Header */}
      <div className="h-11 border-b border-gray-200 flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-600 flex-shrink-0">
            <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-semibold text-gray-700 truncate">Chat IA</span>
          <span className="text-[10px] text-gray-400 truncate">
            {currentUsername && currentUsername !== 'Anónimo' ? `como ${currentUsername}` : ''}
          </span>
          <select
            value={aiConfig.provider}
            onChange={(event) => onAiConfigChange({
              ...aiConfig,
              provider: event.target.value as AiProvider,
            })}
            className="ml-1 text-[10px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
            title="Groq y Gemini son rápidos y requieren internet. Ollama es local y requiere que el servidor esté activo."
            aria-label="Motor de IA"
          >
            <option value="groq">Groq (Nube)</option>
            <option value="gemini">Google Gemini (Nube)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
            title="Configuración avanzada de IA"
            aria-label="Configuración avanzada de IA"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M7 1.2v1.5M7 11.3v1.5M1.2 7h1.5M11.3 7h1.5M2.9 2.9l1.1 1.1M10 10l1.1 1.1M11.1 2.9L10 4M4 10l-1.1 1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          title="Cerrar chat"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3"
      >
        {visibleMessages.length === 0 && !isProcessing && (
          <div className="text-center text-gray-400 text-xs mt-8">
            Escribe un comando o usa @usuario para chatear.
          </div>
        )}
        {visibleMessages.map((msg) => {
          const isAI = msg.sender === 'ia';
          const isOwn =
            msg.sender === 'user' &&
            ((!!msg.clientId && msg.clientId === currentClientId) ||
              (!msg.clientId &&
                !!currentUsername &&
                currentUsername !== 'Anónimo' &&
                !!msg.author &&
                msg.author === currentUsername));
          const author = msg.author || (isAI ? 'Asistente' : 'Usuario');
          const isMentionForMe = msg.sender === 'user' && mentionsUser(msg.text, currentUsername);

          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="w-full text-center text-[11px] text-gray-400 italic px-2">
                {msg.text}
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex w-full gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {!isOwn && (
                isAI ? (
                  <div
                    className="w-6 h-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-[11px] flex-shrink-0"
                    aria-hidden="true"
                  >
                    <BotIcon className="h-4 w-4 text-violet-600" />
                  </div>
                ) : (
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${authorStyle(author)}`}
                    title={author}
                  >
                    {authorInitial(author)}
                  </div>
                )
              )}
              <div className={`flex flex-col min-w-0 max-w-[85%] ${isOwn ? 'items-end' : 'items-start'}`}>
                <span
                  className={`text-[10px] font-medium mb-0.5 max-w-full truncate ${
                    isOwn ? 'text-blue-600' : isAI ? 'text-violet-600' : 'text-gray-500'
                  }`}
                >
                  {isOwn ? 'Tú' : isAI ? 'Asistente' : author}
                </span>
                <div
                  title={isMentionForMe ? 'Te mencionaron en este mensaje' : undefined}
                  className={`px-3 py-2 rounded-xl border text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full ${
                    isMentionForMe
                      ? 'bg-amber-50 border-amber-300 text-amber-950 rounded-bl-sm ring-2 ring-amber-200'
                      : isAI
                      ? 'bg-violet-50 border-violet-200 text-violet-900 rounded-bl-sm'
                      : isOwn
                      ? 'bg-blue-50 border-blue-200 text-blue-900 rounded-br-sm'
                      : 'bg-white border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex w-full gap-2 justify-start" aria-live="polite">
            <div
              className="w-6 h-6 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center text-[11px] flex-shrink-0"
              aria-hidden="true"
            >
              <BotIcon className="h-4 w-4 text-violet-600" />
            </div>
            <div className="flex flex-col min-w-0 max-w-[85%] items-start">
              <span className="text-[10px] font-medium text-violet-600 mb-0.5">Asistente</span>
              <div className="px-3 py-2 rounded-xl rounded-bl-sm border bg-violet-50 border-violet-200 text-violet-900 text-xs flex items-center gap-1.5">
                <BotIcon className="h-3.5 w-3.5" />
                <span>Asistente está pensando</span>
                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="w-1 h-1 rounded-full bg-violet-500 animate-bounce"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-2 flex-shrink-0">
        {readOnly && (
          <p className="text-[11px] text-gray-400 italic px-1 pb-1.5">
            Solo lectura: no puedes enviar comandos.
          </p>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isProcessing ? 'La IA está pensando...' : isRecording ? 'Grabando...' : 'Escribe un comando o usa @usuario para chatear...'}
            rows={1}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors min-w-0 resize-none min-h-[32px] max-h-[120px] disabled:bg-gray-100 disabled:text-gray-400"
            style={{ height: 'auto', overflowY: 'hidden' }}
            disabled={isProcessing || isRecording || readOnly}
          />
          <button
            onClick={isProcessing ? onCancel : handleSend}
            disabled={readOnly || isRecording || (!isProcessing && !command.trim())}
            className={`px-2.5 py-1.5 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors flex-shrink-0 ${
              isProcessing
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            title={isProcessing ? 'Detener operación' : 'Enviar comando'}
            aria-label={isProcessing ? 'Detener operación' : 'Enviar comando'}
          >
            {isProcessing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3.5-4v2.5h3.5v3H5.5V10z" fill="currentColor"/>
              </svg>
            )}
          </button>
          <button
            onClick={onVoiceCommand}
            disabled={isProcessing || readOnly}
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
              isRecording
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
            title={isRecording ? 'Detener grabación' : 'Dictar comando por voz'}
            aria-label={isRecording ? 'Detener grabación' : 'Dictar comando por voz'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M3 6a4 4 0 008 0M7 10v2.5M5.5 12.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {configOpen && (
        <AiConfigModal
          aiConfig={aiConfig}
          onAiConfigChange={onAiConfigChange}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}

const ChatPanel = memo(ChatPanelInner);
export default ChatPanel;
