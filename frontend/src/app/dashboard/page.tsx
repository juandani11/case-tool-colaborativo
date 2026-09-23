'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, API_BASE } from '../../lib/apiClient';
import { DiagramCard } from '../../components/DiagramCard';
import { DS } from '../../styles/design-system';
import AppLogo from '../../components/AppLogo';

interface DiagramSummary {
  id: string;
  name: string;
  entityCount: number;
  relationshipCount: number;
  updatedAt: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  ownerUsername?: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading, authEnabled, logout } = useAuth();
  const router = useRouter();
  const [owned, setOwned] = useState<DiagramSummary[]>([]);
  const [shared, setShared] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

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

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/diagrams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nuevo diagrama' }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/diagram/${id}`);
      } else {
        alert('Error al crear diagrama');
      }
    } finally {
      setCreating(false);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className={DS.header.base}>
        <div className={DS.header.inner}>
          <div className="flex items-center gap-3">
            <AppLogo size="sm" showSubtitle={false} />
            <span className="text-sm text-gray-500">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
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
            onClick={handleCreate}
            disabled={creating}
            className={`${DS.button.base} ${DS.button.primary}`}
          >
            {creating ? 'Creando...' : '+ Nuevo diagrama'}
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
              <button onClick={handleCreate} className={`${DS.button.base} ${DS.button.primary} !py-1 !px-3`}>
                Crear el primero →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOwned.map((d) => (
                <DiagramCard key={d.id} diagram={d} />
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
                <DiagramCard key={d.id} diagram={d} />
              ))}
            </div>
          </section>
        )}

        {/* Solicitudes pendientes (placeholder Fase 3) */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Solicitudes pendientes</h2>
          <div className={`${DS.card.base} border-dashed p-6 text-center`}>
            <p className="text-sm text-gray-400">
              Las solicitudes de acceso llegan en la Fase 3.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
