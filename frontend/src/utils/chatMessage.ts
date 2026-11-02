import { ChatMessage } from '../types/collaboration';

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
