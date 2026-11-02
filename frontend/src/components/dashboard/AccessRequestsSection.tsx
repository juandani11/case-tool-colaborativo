'use client';

import { DS } from '../../styles/design-system';
import { formatDiagramDate } from '../../lib/formatDate';
import { AccessRequest } from '../../types/dashboard';

interface AccessRequestsSectionProps {
  requests: AccessRequest[];
  loading: boolean;
  error: string;
  busyId: string | null;
  onRetry: () => void;
  onReject: (request: AccessRequest) => void;
  onApprove: (request: AccessRequest) => void;
}

export default function AccessRequestsSection({
  requests,
  loading,
  error,
  busyId,
  onRetry,
  onReject,
  onApprove,
}: AccessRequestsSectionProps) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Solicitudes pendientes ({requests.length})
        </h2>
        {loading && <span className="text-xs text-gray-400">Cargando...</span>}
      </div>

      {error && requests.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="font-medium text-amber-800 hover:text-amber-950 underline disabled:opacity-50"
          >
            Reintentar
          </button>
        </div>
      ) : !loading && requests.length === 0 ? (
        <div className={`${DS.card.base} border-dashed p-6 text-center`}>
          <p className="text-sm text-gray-400">No hay solicitudes pendientes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{request.requesterUsername}</span>{' '}
                  solicita acceso a{' '}
                  <span className="font-semibold">{request.diagramName}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDiagramDate(request.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onReject(request)}
                  disabled={busyId === request.id}
                  className={`${DS.button.base} ${DS.button.ghost} !py-1.5 !px-3 text-xs disabled:opacity-50`}
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(request)}
                  disabled={busyId === request.id}
                  className={`${DS.button.base} ${DS.button.primary} !py-1.5 !px-3 text-xs disabled:opacity-50`}
                >
                  Aprobar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
