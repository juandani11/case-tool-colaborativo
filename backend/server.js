'use strict';

require('./loadEnv');

const http = require('http');
const { createApp } = require('./app');
const { initializeDatabase, pool } = require('./db');
const { attachRealtime } = require('./realtime/yjs');

const PORT = process.env.PORT || 1234;
const app = createApp();
const server = http.createServer(app);
const realtime = attachRealtime(server);

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recibido ${signal}: cerrando servidor`);

  const forceExit = setTimeout(() => process.exit(1), 15000);
  forceExit.unref();

  await realtime.shutdown();

  if (server.listening) {
    await new Promise((resolve) => server.close(() => resolve()));
  }

  await pool.end().catch(() => {});
  clearTimeout(forceExit);
  process.exit(0);
}

process.once('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error('Error durante el apagado:', err);
    process.exit(1);
  });
});

process.once('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error('Error durante el apagado:', err);
    process.exit(1);
  });
});

initializeDatabase()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor escuchando en 0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo inicializar PostgreSQL:', err.message);
    process.exit(1);
  });
