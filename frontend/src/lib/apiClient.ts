// Cliente HTTP con JWT (Fase 1). Sin dependencias externas.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1234';

const TOKEN_KEY = 'case-tool:token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// fetch que añade Authorization: Bearer <token> si hay sesión.
// Solo fija Content-Type JSON cuando el body es string (nunca para FormData).
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

// URL del WebSocket con ?token= (el servidor la acepta sin romper rooms).
// y-websocket añade el room como path y los params como query.
export function getWsParams(): Record<string, string> {
  const token = getToken();
  return token ? { token } : {};
}
