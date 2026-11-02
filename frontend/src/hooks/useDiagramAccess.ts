'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, API_BASE } from '../lib/apiClient';
import { useDiagramRole } from './useDiagramRole';

export type AccessRequestState = 'idle' | 'sending' | 'sent' | 'error';

export function useDiagramAccess(currentDiagramId: string | null) {
  const [accessRequestState, setAccessRequestState] = useState<AccessRequestState>('idle');
  const [accessRequestMessage, setAccessRequestMessage] = useState('');
  const { role: diagramRole, loading: roleLoading } = useDiagramRole(currentDiagramId);
  const { authEnabled, user } = useAuth();
  const isViewer = authEnabled && diagramRole === 'VIEWER';
  const noAccess = authEnabled && !roleLoading && diagramRole === 'NONE';

  const handleRequestAccess = useCallback(async () => {
    if (!currentDiagramId || accessRequestState === 'sending' || accessRequestState === 'sent') return;
    setAccessRequestState('sending');
    setAccessRequestMessage('');
    try {
      const res = await apiFetch(
        `${API_BASE}/api/diagrams/${encodeURIComponent(currentDiagramId)}/request-access`,
        { method: 'POST' }
      );
      if (res.ok) {
        setAccessRequestState('sent');
        setAccessRequestMessage('Solicitud enviada. Espera la aprobación del dueño.');
        return;
      }
      const data = await res.json().catch(() => null);
      const message = typeof data?.error === 'string'
        ? data.error
        : 'No se pudo enviar la solicitud.';
      if (res.status === 409 && message.toLowerCase().includes('pendiente')) {
        setAccessRequestState('sent');
        setAccessRequestMessage('Ya tienes una solicitud pendiente. Espera la respuesta del dueño.');
        return;
      }
      setAccessRequestState('error');
      setAccessRequestMessage(message);
    } catch {
      setAccessRequestState('error');
      setAccessRequestMessage('No se pudo conectar con el servidor.');
    }
  }, [currentDiagramId, accessRequestState]);

  return {
    authEnabled,
    user,
    diagramRole,
    roleLoading,
    isViewer,
    noAccess,
    accessRequestState,
    accessRequestMessage,
    handleRequestAccess,
  };
}
