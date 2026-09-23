// Identidad de presencia colaborativa (avatares en toolbar).
// - Autenticado: username real + color determinista por user.id
//   (estable entre reconexiones y pestañas, sin storage).
// - Anónimo (AUTH_ENABLED=false o sin sesión): 'Anónimo' con color
//   aleatorio por pestaña (sessionStorage), como antes.

export interface PresenceIdentity {
  id: string;
  name: string;
  color: string;
}

const PALETTE = [
  '#3b82f6', // azul
  '#10b981', // verde
  '#f59e0b', // ámbar
  '#ef4444', // rojo
  '#8b5cf6', // violeta
  '#ec4899', // rosa
  '#06b6d4', // cyan
  '#84cc16', // lima
];

const SESSION_KEY = 'uml-editor-presence';

/** Color consistente para un seed: mismo seed, mismo color, siempre. */
export function generateUserColor(seed: string): string {
  let hash = 0;
  const s = String(seed || '?');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function randomAnonColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Identidad anónima estable por pestaña (sessionStorage). */
export function getOrCreateSessionIdentity(): PresenceIdentity {
  if (typeof window === 'undefined') {
    return { id: 'anonymous-ssr', name: 'Anónimo', color: PALETTE[0] };
  }
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.id && parsed.color) {
        return { id: String(parsed.id), name: 'Anónimo', color: String(parsed.color) };
      }
    }
  } catch {}
  const identity: PresenceIdentity = {
    id: randomId('anon'),
    name: 'Anónimo',
    color: randomAnonColor(),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  } catch {}
  return identity;
}

/**
 * Resuelve la identidad a publicar en el awareness de Yjs.
 * Usuario autenticado -> username real; si no, identidad anónima.
 */
export function resolvePresenceIdentity(
  user: { id: string; username: string } | null | undefined,
  sessionFallback?: PresenceIdentity
): PresenceIdentity {
  if (user && user.id && user.username) {
    return { id: user.id, name: user.username, color: generateUserColor(user.id) };
  }
  return sessionFallback || getOrCreateSessionIdentity();
}
