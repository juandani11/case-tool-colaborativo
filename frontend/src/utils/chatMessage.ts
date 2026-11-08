import { ChatMessage } from '../types/collaboration';

// El chat vive en Yjs y ademas se hidrata desde PostgreSQL. Varios clientes
// (o dos montajes de React) pueden insertar el mismo mensaje `db_*` en la
// Y.Array; React no permite keys repetidas. Deduplicamos por id conservando
// el primer mensaje (orden cronologico original).
export function dedupeChatMessages<T extends { id?: string }>(messages: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const message of messages) {
    if (!message) continue;
    const id = typeof message.id === 'string' ? message.id : '';
    if (!id) {
      unique.push(message);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(message);
  }
  return unique;
}

export function buildChatMessage(
  sender: ChatMessage['sender'],
  text: string,
  author: string | undefined,
  user: { id?: string; username?: string } | null,
  sessionIdentity: { id: string; name: string }
): ChatMessage {
  const resolvedAuthor =
    author ||
    (sender === 'user'
      ? user?.username || sessionIdentity.name || 'Usuario'
      : sender === 'ia'
      ? 'IA'
      : undefined);
  const msg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sender,
    author: resolvedAuthor,
    text,
    timestamp: Date.now(),
  };
  if (sender === 'user') {
    msg.clientId = user?.id || sessionIdentity.id;
  }
  return msg;
}
