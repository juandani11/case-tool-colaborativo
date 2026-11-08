'use strict';

const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const aclRoutes = require('./routes/acl');
const diagramRoutes = require('./routes/diagrams');
const accessRequestRoutes = require('./routes/accessRequests');
const aiRoutes = require('./routes/ai');
const generatorRoutes = require('./routes/generator');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => res.send('OK'));
  app.get('/ready', async (req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch (err) {
      console.error('Readiness check falló:', err.message);
      res.status(503).json({ ok: false });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', aclRoutes);
  app.use('/api', accessRequestRoutes);
  app.use('/api', diagramRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/generate', generatorRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
