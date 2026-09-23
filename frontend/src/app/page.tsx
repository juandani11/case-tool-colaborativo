'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

const LAST_DIAGRAM_KEY = 'uml-editor-current-diagram';

export default function RootPage() {
  const router = useRouter();
  const { authEnabled, user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!authEnabled) {
      // Modo sin auth: editor directo, último diagrama o diagrama-1
      let lastId: string | null = null;
      try {
        lastId = localStorage.getItem(LAST_DIAGRAM_KEY);
      } catch {}
      router.replace(`/diagram/${lastId || 'diagram-1'}`);
      return;
    }
    if (!user) {
      router.replace('/login');
    } else {
      router.replace('/dashboard');
    }
  }, [authEnabled, user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Redirigiendo...</div>
    </div>
  );
}
