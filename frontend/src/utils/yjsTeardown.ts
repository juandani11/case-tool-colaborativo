import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function teardown(
  provider: WebsocketProvider | null,
  doc: Y.Doc | null
) {
  if (provider) {
    try { provider.destroy(); } catch {}
  }
  if (doc) {
    try { doc.destroy(); } catch {}
  }
}
