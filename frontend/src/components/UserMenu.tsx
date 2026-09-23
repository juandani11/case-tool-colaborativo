'use client';

import { useAuth } from '../contexts/AuthContext';

export default function UserMenu() {
  const { user, logout, authEnabled, loading } = useAuth();
  if (loading || !authEnabled || !user) return null;

  const initial = (user.username || '?').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 pl-2 border-l border-gray-200 ml-1">
      <span
        title={user.email}
        className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center"
      >
        {initial}
      </span>
      <span className="text-xs text-gray-700 font-medium hidden md:inline max-w-24 truncate">
        {user.username}
      </span>
      <button
        onClick={logout}
        title="Cerrar sesión"
        className="text-[11px] text-gray-400 hover:text-red-600 transition-colors"
      >
        Salir
      </button>
    </div>
  );
}
