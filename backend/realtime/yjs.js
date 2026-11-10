'use strict';

const Y = require('yjs');
const { setupWSConnection, getYDoc, setPersistence, docs } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const { verifyToken, authEnabled } = require('../middleware/auth');
const aclService = require('../services/aclService');
const diagramService = require('../services/diagramService');

const SNAPSHOT_DEBOUNCE_MS = 2000;
const snapshotTimers = new Map();
const pendingWrites = new Map();

function diagramIdFromRoom(docName) {
  const prefix = 'diagram-room-';
  return String(docName || '').startsWith(prefix)
    ? String(docName).slice(prefix.length)
    : null;
}

function scheduleSnapshot(docName, ydoc, diagramId, delay = SNAPSHOT_DEBOUNCE_MS) {
  if (ydoc.snapshotError) return;
  const previous = snapshotTimers.get(docName);
  if (previous) clearTimeout(previous);

  const timer = setTimeout(async () => {
    snapshotTimers.delete(docName);
    if (ydoc.snapshotError) return;
    try {
      await diagramService.saveSnapshot(diagramId, Y.encodeStateAsUpdate(ydoc));
    } catch (err) {
      console.error(`No se pudo guardar el snapshot de ${diagramId}:`, err.message);
    }
  }, delay);
  snapshotTimers.set(docName, timer);
}

async function waitForPendingWrite(docName) {
  const pending = pendingWrites.get(docName);
  if (!pending) return;
  try {
    await pending;
  } catch {}
}

async function ensureDocumentReady(docName) {
  const doc = getYDoc(docName, false);
  if (doc.readyPromise) await doc.readyPromise;
  if (doc.snapshotError) {
    const error = doc.snapshotError;
    try { doc.destroy(); } catch {}
    docs.delete(docName);
    throw error;
  }
  return doc;
}

async function flushDiagramSnapshot(diagramId) {
  const safeId = String(diagramId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return false;

  const roomName = `diagram-room-${safeId}`;
  const ydoc = docs.get(roomName);
  if (!ydoc || ydoc.snapshotError) return false;

  if (ydoc.readyPromise) await ydoc.readyPromise;
  if (ydoc.snapshotError) return false;

  const timer = snapshotTimers.get(roomName);
  if (timer) {
    clearTimeout(timer);
    snapshotTimers.delete(roomName);
  }

  try {
    await diagramService.saveSnapshot(safeId, Y.encodeStateAsUpdate(ydoc));
    return true;
  } catch (err) {
    scheduleSnapshot(roomName, ydoc, safeId);
    throw err;
  }
}

function readFlushControl(raw) {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw[0] !== 0x7b) return null;
  try {
    const data = JSON.parse(raw.toString('utf8'));
    return data?.type === 'flush-snapshot' ? data : null;
  } catch {
    return null;
  }
}

setPersistence({
  provider: null,
  bindState: async (docName, ydoc) => {
    const ready = (async () => {
      await waitForPendingWrite(docName);
      const diagramId = diagramIdFromRoom(docName);
      if (!diagramId) return;

      try {
        const snapshot = await diagramService.getSnapshot(diagramId);
        if (snapshot) Y.applyUpdate(ydoc, new Uint8Array(snapshot));
      } catch (err) {
        ydoc.snapshotError = err;
        console.error(`No se pudo cargar el snapshot de ${diagramId}:`, err.message);
        return;
      }

      ydoc.on('update', () => scheduleSnapshot(docName, ydoc, diagramId));
      scheduleSnapshot(docName, ydoc, diagramId);
    })();

    ydoc.readyPromise = ready;
    await ready;
  },
  writeState: async (docName, ydoc) => {
    const pending = snapshotTimers.get(docName);
    if (pending) {
      clearTimeout(pending);
      snapshotTimers.delete(docName);
    }

    const diagramId = diagramIdFromRoom(docName);
    if (!diagramId || ydoc.snapshotError) return;

    const write = (async () => {
      if (ydoc.readyPromise) await ydoc.readyPromise;
      if (ydoc.snapshotError) return;
      await diagramService.saveSnapshot(diagramId, Y.encodeStateAsUpdate(ydoc));
    })();

    pendingWrites.set(docName, write);
    try {
      await write;
    } catch (err) {
      console.error(`No se pudo guardar el snapshot final de ${diagramId}:`, err.message);
    } finally {
      if (pendingWrites.get(docName) === write) pendingWrites.delete(docName);
    }
  },
});

async function emitChatMessage(diagramId, message) {
  const safeId = String(diagramId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return false;
  try {
    const doc = await ensureDocumentReady(`diagram-room-${safeId}`);
    doc.getArray('chat').push([message]);
    return true;
  } catch (err) {
    console.error('No se pudo emitir el mensaje de chat por Yjs:', err);
    return false;
  }
}

async function flushSnapshots() {
  const entries = [...docs.entries()];
  await Promise.all(entries.map(async ([docName, ydoc]) => {
    const diagramId = diagramIdFromRoom(docName);
    if (!diagramId || ydoc.snapshotError) return;
    try {
      await diagramService.saveSnapshot(diagramId, Y.encodeStateAsUpdate(ydoc));
    } catch (err) {
      console.error(`No se pudo guardar el snapshot de ${diagramId} al apagar:`, err.message);
    }
  }));
}

async function shutdownRealtime(wss) {
  for (const timer of snapshotTimers.values()) clearTimeout(timer);
  snapshotTimers.clear();

  await flushSnapshots();

  for (const client of wss.clients) {
    try {
      client.close(1001, 'Servidor reiniciando');
    } catch {}
  }

  await Promise.all([...pendingWrites.values()].map((pending) => pending.catch(() => {})));
}

function attachRealtime(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    ws.pause();

    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      ws.close(4401, 'URL inválida');
      return;
    }

    const roomName = (url.pathname || '').replace(/^\//, '');
    const token = url.searchParams.get('token');
    const payload = token ? verifyToken(token) : null;
    const prefix = 'diagram-room-';
    const diagramId = roomName.startsWith(prefix) ? roomName.slice(prefix.length) : null;

    if (authEnabled()) {
      if (!token) {
        ws.close(4401, 'Token requerido');
        return;
      }
      if (!payload) {
        ws.close(4401, 'Token inválido');
        return;
      }
      if (!diagramId) {
        ws.close(4403, 'Sala desconocida');
        return;
      }

      try {
        const role = await aclService.getRoleForUser(diagramId, payload.userId);
        if (role === 'NONE') {
          ws.close(4403, 'Sin acceso a este diagrama');
          return;
        }
        const diagram = await diagramService.getDiagram(diagramId);
        if (!diagram) {
          ws.close(4404, 'Diagrama no encontrado');
          return;
        }
        ws.userId = payload.userId;
        ws.username = payload.username;
        ws.userRole = role;
      } catch (err) {
        console.error('Error validando WS:', err);
        ws.close(4500, 'Error interno');
        return;
      }
    } else if (payload) {
      ws.userId = payload.userId;
      ws.username = payload.username;
    }

    try {
      await ensureDocumentReady(roomName);
    } catch (err) {
      console.error(`No se pudo preparar el documento ${roomName}:`, err.message);
      ws.close(1011, 'No se pudo cargar el diagrama');
      return;
    }

    if (ws.readyState !== WebSocket.OPEN) return;

    ws.on('message', (raw) => {
      const control = readFlushControl(raw);
      if (!control) return;

      const requestedId = typeof control.diagramId === 'string' ? control.diagramId : diagramId;
      if (!requestedId || requestedId !== diagramId) return;

      flushDiagramSnapshot(diagramId)
        .then((ok) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'flush-ack', diagramId, ok }));
          }
        })
        .catch((err) => {
          console.error(`No se pudo forzar el guardado de ${diagramId}:`, err.message);
        });
    });

    setupWSConnection(ws, req, { docName: roomName, gc: false });
    ws.resume();
  });

  return { wss, shutdown: () => shutdownRealtime(wss) };
}

module.exports = { attachRealtime, emitChatMessage, flushDiagramSnapshot, flushSnapshots };
