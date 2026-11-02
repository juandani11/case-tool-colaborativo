'use client';

import { AccessRequestState } from '../../hooks/useDiagramAccess';

interface EditorAccessStatusProps {
  authEnabled: boolean;
  diagramRole: string;
  roleLoading: boolean;
  noAccess: boolean;
  accessRequestState: AccessRequestState;
  accessRequestMessage: string;
  onRequestAccess: () => void;
}

export default function EditorAccessStatus({
  authEnabled,
  diagramRole,
  roleLoading,
  noAccess,
  accessRequestState,
  accessRequestMessage,
  onRequestAccess,
}: EditorAccessStatusProps) {
  return (
    <>
      {noAccess && (
        <div className="absolute inset-0 z-40 bg-gray-100/95 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 max-w-sm text-center space-y-3">
            <h2 className="font-bold text-gray-800">No tienes acceso a este diagrama</h2>
            <p className="text-sm text-gray-500">
              Envía una solicitud al propietario para que te conceda acceso como lector o editor.
            </p>
            <button
              type="button"
              onClick={onRequestAccess}
              disabled={accessRequestState === 'sending' || accessRequestState === 'sent'}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {accessRequestState === 'sending'
                ? 'Enviando solicitud...'
                : accessRequestState === 'sent'
                ? 'Solicitud enviada'
                : 'Solicitar Acceso'}
            </button>
            {accessRequestMessage && (
              <p
                className={`text-xs rounded-md px-3 py-2 ${
                  accessRequestState === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {accessRequestMessage}
              </p>
            )}
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
    </>
  );
}
