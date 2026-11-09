# Guía técnica: Snapshot de Yjs en PostgreSQL/Neon

**Objetivo:** documentar cómo el estado colaborativo del lienzo (Yjs/CRDT) se serializa, se guarda como `BYTEA` en `core.diagrams` y se recupera al reconectar un cliente.

## A. ¿Qué es el Snapshot de Yjs?

Yjs mantiene el documento colaborativo en memoria como un **CRDT** (`Y.Doc`). Ese documento contiene los mapas de nodos y aristas, los relojes lógicos y los identificadores internos que permiten resolver cambios concurrentes.

Para que el estado no se pierda cuando el proceso Node.js se reinicia o cuando todos los clientes se desconectan, el documento se serializa con `Y.encodeStateAsUpdate(ydoc)`. El resultado es un **`Uint8Array`**: una secuencia binaria opaca que representa el estado completo del CRDT.

No se guarda una fila SQL por clase o relación. El snapshot conserva el documento completo y mantiene la semántica de colaboración de Yjs.

## B. ¿Cómo se guarda en PostgreSQL?

La persistencia real está en `backend/services/diagramService.js`:

```javascript
// backend/services/diagramService.js
const Y = require('yjs');
const { pool } = require('../db');

async function saveSnapshot(diagramId, update) {
  const id = safeId(diagramId);
  if (!id || !update) return;

  await pool.query(
    `UPDATE core.diagrams
     SET yjs_snapshot = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, Buffer.from(update)]
  );
}
```

El flujo es:

1. `Y.encodeStateAsUpdate(ydoc)` produce el `Uint8Array`.
2. `Buffer.from(update)` lo entrega al driver `pg`.
3. El driver escribe el buffer en la columna `yjs_snapshot` de tipo **`BYTEA`**.
4. `updated_at` se actualiza con `CURRENT_TIMESTAMP`.

El `pg` Pool se configura en `backend/db.js` y usa la `DATABASE_URL` de Neon, incluyendo TLS cuando el connection string tiene `sslmode=require`.

## C. ¿Cómo se recupera?

La lectura real también está en `backend/services/diagramService.js`:

```javascript
// backend/services/diagramService.js
async function getSnapshot(diagramId) {
  const id = safeId(diagramId);
  if (!id) return null;

  const { rows } = await pool.query(
    'SELECT yjs_snapshot FROM core.diagrams WHERE id = $1',
    [id]
  );

  return rows[0]?.yjs_snapshot || null;
}
```

Al cargar la sala, `backend/realtime/yjs.js` aplica el binario al documento Yjs:

```javascript
// backend/realtime/yjs.js
const snapshot = await diagramService.getSnapshot(diagramId);
if (snapshot) {
  Y.applyUpdate(ydoc, new Uint8Array(snapshot));
}
```

El servidor espera a que el snapshot esté aplicado antes de aceptar escrituras de clientes. Esto ocurre dentro de `bindState` y se refleja en `ydoc.readyPromise`; `ensureDocumentReady()` bloquea la conexión hasta que la carga termina o falla.

## D. Estrategia de Persistencia (Debounce)

No se escribe en PostgreSQL en cada clic o movimiento. `backend/realtime/yjs.js` usa un debounce de **2 segundos**:

```javascript
// backend/realtime/yjs.js
const SNAPSHOT_DEBOUNCE_MS = 2000;
const snapshotTimers = new Map();

function scheduleSnapshot(docName, ydoc, diagramId, delay = SNAPSHOT_DEBOUNCE_MS) {
  if (ydoc.snapshotError) return;

  const previous = snapshotTimers.get(docName);
  if (previous) clearTimeout(previous);

  const timer = setTimeout(async () => {
    snapshotTimers.delete(docName);
    if (ydoc.snapshotError) return;

    try {
      await diagramService.saveSnapshot(
        diagramId,
        Y.encodeStateAsUpdate(ydoc)
      );
    } catch (err) {
      console.error(`No se pudo guardar el snapshot de ${diagramId}:`, err.message);
    }
  }, delay);

  snapshotTimers.set(docName, timer);
}
```

El observer de cambios se registra así:

```javascript
// backend/realtime/yjs.js
ydoc.on('update', () => scheduleSnapshot(docName, ydoc, diagramId));
scheduleSnapshot(docName, ydoc, diagramId);
```

Comportamiento:

- Un cambio de nodo actualiza Yjs **inmediatamente en memoria**.
- Cada cambio reinicia el temporizador de 2 segundos.
- Solo se ejecuta el `UPDATE ... SET yjs_snapshot = $2` cuando el usuario deja de producir cambios durante 2 segundos.
- Si llegan más cambios, se conserva únicamente el snapshot más reciente.
- Al apagar el servidor, `flushSnapshots()` y `writeState()` guardan el estado final pendiente.

## E. Trazabilidad con el modelo físico

| Elemento | Implementación |
|---|---|
| Tabla | `core.diagrams` |
| Columna | `yjs_snapshot BYTEA` |
| Serialización | `Y.encodeStateAsUpdate(ydoc)` |
| Conversión para `pg` | `Buffer.from(update)` |
| Lectura | `SELECT yjs_snapshot FROM core.diagrams WHERE id = $1` |
| Aplicación | `Y.applyUpdate(ydoc, new Uint8Array(snapshot))` |
| Debounce | `SNAPSHOT_DEBOUNCE_MS = 2000` |
| Persistencia final | `flushSnapshots()` / `writeState()` |

La columna `yjs_snapshot` es un objeto binario opaco: no se normaliza en tablas de clases y relaciones porque descomponerlo destruiría la semántica del CRDT.
