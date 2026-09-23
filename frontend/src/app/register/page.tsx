'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import AppLogo from '../../components/AppLogo';
import { DS } from '../../styles/design-system';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password);
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
        <h1 className="text-xl font-bold text-center text-gray-900">Crear cuenta</h1>
        {error && (
          <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>
        )}
        <input
          type="text"
          placeholder="Usuario (minimo 3 caracteres)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`w-full ${DS.input.base}`}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full ${DS.input.base}`}
          required
        />
        <input
          type="password"
          placeholder="Contrasena (minimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full ${DS.input.base}`}
          required
        />
        <input
          type="password"
          placeholder="Confirmar contrasena"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={`w-full ${DS.input.base}`}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className={`w-full ${DS.button.base} ${DS.button.primary}`}
        >
          {loading ? 'Cargando...' : 'Registrarse'}
        </button>
        <p className="text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </form>
    </div>
  );
}
