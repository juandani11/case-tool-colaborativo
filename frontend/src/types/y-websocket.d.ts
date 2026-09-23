declare module 'y-websocket' {
  import { Observable } from 'lib0/observable';
  import * as Y from 'yjs';
  import * as awarenessProtocol from 'y-protocols/awareness';

  export class WebsocketProvider extends Observable<string> {
    constructor(
      serverUrl: string,
      roomname: string,
      doc: Y.Doc,
      opts?: {
        connect?: boolean;
        awareness?: awarenessProtocol.Awareness;
        params?: Record<string, string>;
        WebSocketPolyfill?: typeof WebSocket;
        resyncInterval?: number;
        maxBackoffTime?: number;
      }
    );

    awareness: awarenessProtocol.Awareness;
    doc: Y.Doc;
    ws: WebSocket | null;
    wsconnected: boolean;
    shouldConnect: boolean;
    synced: boolean;
    url: string;
    roomname: string;

    connect(): void;
    disconnect(): void;
    connectBc(): void;
    disconnectBc(): void;
  }
}
