export interface ChatMessage {
  id: string;
  sender: 'user' | 'ia' | 'system';
  author?: string;
  clientId?: string;
  text: string;
  timestamp: number;
}

export interface ConnectedUser {
  clientId: number;
  id: string;
  name: string;
  color: string;
}
