'use client';

import { useState, useEffect, useCallback } from 'react';

// Estado del manual de ayuda: open/close/toggle + atajo global F1.
// Cada pantalla (toolbar, dashboard) usa su propia instancia; el F1 abre
// la de la pantalla visible. Escape y click-fuera los maneja HelpModal.
export function useHelpModal() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { isOpen, open, close, toggle };
}
