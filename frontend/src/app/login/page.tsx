'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import AppLogo from '../../components/AppLogo';
import { DS } from '../../styles/design-system';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96 space-y-4">
        <div className="flex justify-center">
          <AppLogo size="lg" showSubtitle={false} />
        </div>
        <h1 className="text-xl font-bold text-center text-gray-900">Iniciar sesion</h1>
        {error && (
          <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>
        )}
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`w-full ${DS.input.base}`}
          required
        />
        <input
          type="password"
          placeholder="Contrasena"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full ${DS.input.base}`}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className={`w-full ${DS.button.base} ${DS.button.primary}`}
        >
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
        <p className="text-sm text-center text-gray-600">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Registrarse
          </Link>
        </p>
      </form>
    </div>
  );
}
