'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, API_BASE } from '../../lib/apiClient';
import { DiagramCard } from '../../components/DiagramCard';
import { DS } from '../../styles/design-system';
import AppLogo from '../../components/AppLogo';
import { HelpModal } from '../../components/HelpModal';
import { useHelpModal } from '../../hooks/useHelpModal';
import AccessRequestsSection from '../../components/dashboard/AccessRequestsSection';
import DashboardDialog from '../../components/dashboard/DashboardDialog';
import { ArrowRightIcon, HelpCircleIcon } from '../../components/Icons';
import { AccessRequest, AccessRole, DiagramSummary, DialogState } from '../../types/dashboard';

// Dashboard: lista owned/shared (GET /api/diagrams), buscador local, crear,
// renombrar y eliminar. Las cards delegan las acciones rápidas aquí.
export default function DashboardPage() {
  const { user, loading: authLoading, authEnabled, logout } = useAuth();
  const router = useRouter();
  const [owned, setOwned] = useState<DiagramSummary[]>([]);
  const [shared, setShared] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [requestsReloadKey, setRequestsReloadKey] = useState(0);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogName, setDialogName] = useState('');
  const [dialogRole, setDialogRole] = useState<AccessRole>('VIEWER');
  const [dialogError, setDialogError] = useState('');
  const [dialogBusy, setDialogBusy] = useState(false);
  const help = useHelpModal();

  // Redirigir a login si no hay sesión y auth está activo
  useEffect(() => {
    if (!authLoading && authEnabled && !user) {
      router.push('/login');
    }
  }, [authLoading, authEnabled, user, router]);

  // Cargar diagramas
  useEffect(() => {
    if (authLoading) return;
    if (authEnabled && !user) return;

    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/api/diagrams`);
        if (res.ok) {
          const data = await res.json();
          setOwned(data.owned || []);
          setShared(data.shared || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, authEnabled]);

  useEffect(() => {
    if (authLoading || (authEnabled && !user)) return;
    let cancelled = false;
    (async () => {
      setRequestsLoading(true);
      setRequestsError('');
      try {
        const res = await apiFetch(`${API_BASE}/api/access-requests/pending`);
        if (res.status === 401) {
          if (!cancelled) {
            logout();
            router.push('/login');
          }
          return;
        }
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.requests)
            ? data.requests
            : [];
          if (!cancelled) {
            setAccessRequests(list);
            setRequestsError('');
          }
        } else if (!cancelled) {
          setRequestsError('No se pudieron cargar las solicitudes pendientes.');
        }
      } catch (error) {
        console.error('Error cargando solicitudes pendientes:', error);
        if (!cancelled) setRequestsError('No se pudieron cargar las solicitudes pendientes.');
      } finally {
        if (!cancelled) setRequestsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, authEnabled, requestsReloadKey, logout, router]);

  const openCreate = () => {
    setDialogName('');
    setDialogError('');
    setDialog({ mode: 'create' });
  };

  const openRename = (diagram: DiagramSummary) => {
    setDialogName(diagram.name);
    setDialogError('');
    setDialog({ mode: 'rename', diagram });
  };

  const openDelete = (diagram: DiagramSummary) => {
    setDialogError('');
    setDialog({ mode: 'delete', diagram });
  };

  const openApprove = (request: AccessRequest) => {
    setDialogRole('VIEWER');
    setDialogError('');
    setDialog({ mode: 'approve', request });
  };

  const closeDialog = () => {
    if (dialogBusy) return;
    setDialog(null);
    setDialogError('');
  };

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dialogBusy) {
        setDialog(null);
        setDialogError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, dialogBusy]);

  const errorMessage = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  };

  async function respondToRequest(
    request: AccessRequest,
    action: 'APPROVE' | 'REJECT',
    role?: AccessRole
  ): Promise<boolean> {
    setRequestBusyId(request.id);
    setRequestsError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/access-requests/${encodeURIComponent(request.id)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(role ? { role } : {}) }),
      });
      if (!res.ok) {
        const message = await errorMessage(res, 'No se pudo responder la solicitud.');
        setRequestsError(message);
        if (dialog?.mode === 'approve') setDialogError(message);
        return false;
      }
      setAccessRequests((prev) => prev.filter((item) => item.id !== request.id));
      return true;
    } catch {
      const message = 'No se pudo conectar con el servidor.';
      setRequestsError(message);
      if (dialog?.mode === 'approve') setDialogError(message);
      return false;
    } finally {
      setRequestBusyId(null);
    }
  }

  async function handleDialogSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!dialog || dialogBusy) return;

    const needsName = dialog.mode === 'create' || dialog.mode === 'rename';
    const name = dialogName.trim();
    if (needsName && !name) {
      setDialogError('El nombre no puede estar vacío.');
      return;
    }
    if (needsName && name.length > 120) {
      setDialogError('El nombre no puede superar los 120 caracteres.');
      return;
    }

    setDialogBusy(true);
    setDialogError('');
    try {
      if (dialog.mode === 'approve') {
        const ok = await respondToRequest(dialog.request, 'APPROVE', dialogRole);
        if (ok) setDialog(null);
        return;
      }

      if (dialog.mode === 'create') {
        const res = await apiFetch(`${API_BASE}/api/diagrams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          setDialogError(await errorMessage(res, 'No se pudo crear el diagrama.'));
          return;
        }
        const { id } = await res.json();
        setDialog(null);
        router.push(`/diagram/${id}`);
        return;
      }

      if (dialog.mode === 'rename') {
        const res = await apiFetch(`${API_BASE}/api/diagrams/${encodeURIComponent(dialog.diagram.id)}/rename`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          setDialogError(await errorMessage(res, 'No se pudo renombrar el diagrama.'));
          return;
        }
        const updated = (current: DiagramSummary) =>
          current.id === dialog.diagram.id ? { ...current, name } : current;
        setOwned((prev) => prev.map(updated));
        setShared((prev) => prev.map(updated));
        setDialog(null);
        return;
      }

      const res = await apiFetch(`${API_BASE}/api/diagrams/${encodeURIComponent(dialog.diagram.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setDialogError(await errorMessage(res, 'No se pudo eliminar el diagrama.'));
        return;
      }
      setOwned((prev) => prev.filter((item) => item.id !== dialog.diagram.id));
      setShared((prev) => prev.filter((item) => item.id !== dialog.diagram.id));
      setDialog(null);
    } catch {
      setDialogError('No se pudo conectar con el servidor.');
    } finally {
      setDialogBusy(false);
    }
  }

  const q = query.toLowerCase();
  const filteredOwned = useMemo(
    () => owned.filter(d => (d.name || '').toLowerCase().includes(q)),
    [owned, q]
  );
  const filteredShared = useMemo(
    () => shared.filter(d => (d.name || '').toLowerCase().includes(q)),
    [shared, q]
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className={DS.header.base}>
        <div className={DS.header.inner}>
          <div className="flex items-center gap-3">
            <AppLogo size="sm" showSubtitle={false} />
            <span className="text-sm text-gray-500">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={help.open}
              className={`${DS.button.base} text-sm ${DS.button.ghost} !py-1 !px-3 inline-flex items-center gap-1.5`}
              title="Abrir manual de usuario (F1)"
            >
              <HelpCircleIcon className="h-4 w-4" />
              <span>Ayuda</span>
            </button>
            {user ? (
              <>
                <span className="text-sm text-gray-700">{user.username}</span>
                <button onClick={logout} className={`${DS.button.base} text-sm ${DS.button.danger} !py-1 !px-3`}>
                  Salir
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-400">Modo abierto</span>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <input
            type="text"
            placeholder="Buscar diagrama..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`flex-1 max-w-md ${DS.input.base}`}
          />
          <button
            onClick={openCreate}
            className={`${DS.button.base} ${DS.button.primary}`}
          >
            + Nuevo diagrama
          </button>
        </div>

        {/* Mis diagramas */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mis diagramas ({filteredOwned.length})
          </h2>
          {filteredOwned.length === 0 ? (
            <div className={`${DS.card.base} border-dashed p-12 text-center`}>
              <p className="text-gray-500 mb-4">No tienes diagramas todavía.</p>
              <button
                onClick={openCreate}
                className={`${DS.button.base} ${DS.button.primary} !py-1 !px-3 inline-flex items-center gap-1.5`}
              >
                <span>Crear el primero</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOwned.map((d) => (
                <DiagramCard
                  key={d.id}
                  diagram={d}
                  onRename={openRename}
                  onDelete={openDelete}
                />
              ))}
            </div>
          )}
        </section>

        {/* Compartidos conmigo */}
        {filteredShared.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Compartidos conmigo ({filteredShared.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredShared.map((d) => (
                <DiagramCard
                  key={d.id}
                  diagram={d}
                  onRename={openRename}
                  onDelete={openDelete}
                />
              ))}
            </div>
          </section>
        )}

        <AccessRequestsSection
          requests={accessRequests}
          loading={requestsLoading}
          error={requestsError}
          busyId={requestBusyId}
          onRetry={() => setRequestsReloadKey((value) => value + 1)}
          onReject={(request) => respondToRequest(request, 'REJECT')}
          onApprove={openApprove}
        />
      </main>

      <DashboardDialog
        dialog={dialog}
        name={dialogName}
        role={dialogRole}
        error={dialogError}
        busy={dialogBusy}
        onNameChange={setDialogName}
        onRoleChange={setDialogRole}
        onClose={closeDialog}
        onSubmit={handleDialogSubmit}
      />
      <HelpModal isOpen={help.isOpen} onClose={help.close} />
    </div>
  );
}
