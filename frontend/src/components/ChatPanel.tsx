'use client';

import { useRef, useEffect, memo } from 'react';
import { ChatMessage } from '../hooks/useCollaborativeFlow';

interface ChatPanelProps {
  messages: ChatMessage[];
  command: string;
  setCommand: (value: string) => void;
  onSendCommand: () => void;
  isProcessing: boolean;
  isRecording: boolean;
  onVoiceCommand: () => void;
  isOpen: boolean;
  onToggle: () => void;
  readOnly?: boolean;
}

const senderStyles: Record<string, string> = {
  user: 'bg-blue-50 border-blue-200 text-blue-800',
  ia: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  system: 'bg-gray-100 border-gray-200 text-gray-600',
};

const senderLabels: Record<string, string> = {
  user: 'Tú',
  ia: 'IA',
  system: 'Sistema',
};

function ChatPanelInner({
  messages,
  command,
  setCommand,
  onSendCommand,
  isProcessing,
  isRecording,
  onVoiceCommand,
  isOpen,
  onToggle,
  readOnly,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="h-11 border-b border-gray-200 flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-600">
            <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-semibold text-gray-700">Chat IA</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Cerrar chat"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-xs mt-8">
            Escribe un comando para comenzar.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <span className="text-[10px] font-medium text-gray-400 mb-0.5">
              {senderLabels[msg.sender] || msg.sender}
            </span>
            <div
              className={`px-3 py-2 rounded-lg border text-xs leading-relaxed whitespace-pre-wrap ${senderStyles[msg.sender] || senderStyles.system}`}
            >
              {msg.text}
            </div>
          </div>
        ))}
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
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendCommand();
              }
            }}
            placeholder={isRecording ? 'Grabando...' : 'Comando IA...'}
            rows={1}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors min-w-0 resize-none min-h-[32px] max-h-[120px]"
            style={{ height: 'auto', overflowY: 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
            disabled={isProcessing || isRecording || readOnly}
          />
          <button
            onClick={onSendCommand}
            disabled={isProcessing || isRecording || !command.trim() || readOnly}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors flex-shrink-0"
            title="Enviar comando"
          >
            {isProcessing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 10" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3.5-4v2.5h3.5v3H5.5V10z" fill="currentColor"/>
              </svg>
            )}
          </button>
          <button
            onClick={onVoiceCommand}
            disabled={readOnly}
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
              isRecording
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
            title={isRecording ? 'Detener grabación' : 'Dictar comando por voz'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M3 6a4 4 0 008 0M7 10v2.5M5.5 12.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const ChatPanel = memo(ChatPanelInner);
export default ChatPanel;
