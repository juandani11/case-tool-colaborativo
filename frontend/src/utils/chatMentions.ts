import type { ConnectedUser } from '../types/collaboration';

export type ChatTarget =
  | { kind: 'ai' }
  | { kind: 'human'; handle: string; known: boolean };

export function parseMentionHandle(text: string): string | null {
  const match = String(text || '').trim().match(/^@([^\s,.;:!?]+)/);
  return match ? match[1] : null;
}

export function classifyChatMessage(
  text: string,
  connectedUsers: Pick<ConnectedUser, 'name'>[] = []
): ChatTarget {
  const handle = parseMentionHandle(text);
  if (!handle) return { kind: 'ai' };

  const normalized = handle.toLowerCase();
  if (normalized === 'ai' || normalized === 'ia') return { kind: 'ai' };

  const known = connectedUsers.some(
    (user) => user.name.trim().toLowerCase() === normalized
  );
  return { kind: 'human', handle, known };
}

export function mentionsUser(text: string, username?: string | null): boolean {
  const handle = parseMentionHandle(text);
  if (!handle || !username || username === 'Anónimo') return false;
  return handle.toLowerCase() === username.trim().toLowerCase();
}
