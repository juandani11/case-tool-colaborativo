'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch, getToken, setToken, clearToken, API_BASE } from '../lib/apiClient';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authEnabled: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);

  // Al montar: ¿auth activo? Si hay token, validar sesión (/me).
  // Si el backend no responde, se queda en modo abierto (cero regresiones).
  useEffect(() => {
    (async () => {
      try {
        const statusRes = await fetch(`${API_BASE}/api/auth/status`);
        if (!statusRes.ok) throw new Error('status no disponible');
        const { authEnabled } = await statusRes.json();
        setAuthEnabled(!!authEnabled);

        if (!authEnabled) {
          setLoading(false);
          return;
        }

        const token = getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const meRes = await apiFetch(`${API_BASE}/api/auth/me`);
        if (meRes.ok) {
          const { user } = await meRes.json();
          setUser(user);
        } else {
          clearToken();
        }
      } catch (err) {
        console.error('Error al validar sesión:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'Error al iniciar sesión');
    }
    const { token, user } = await res.json();
    setToken(token);
    setUser(user);
  }

  async function register(username: string, email: string, password: string) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'Error al registrar');
    }
    const { token, user } = await res.json();
    setToken(token);
    setUser(user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, authEnabled, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
