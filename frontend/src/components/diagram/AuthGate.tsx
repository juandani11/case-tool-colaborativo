'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, authEnabled } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && authEnabled && !user) router.push('/login');
  }, [user, loading, authEnabled, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-gray-500">
        Cargando...
      </div>
    );
  }
  if (authEnabled && !user) return null;
  return <>{children}</>;
}
