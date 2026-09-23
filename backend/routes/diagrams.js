// Listado y creación de diagramas para el dashboard (Fase dashboard).
// GET /api/diagrams -> { owned, shared } (con AUTH_ENABLED=false todo va en owned).
// POST /api/diagrams { name } -> 201 { id, name } (creador = OWNER).
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const aclService = require('../services/aclService');
const userService = require('../services/userService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const DIAGRAMS_DIR = path.join(__dirname, '..', 'data', 'diagrams');

function safeId(diagramId) {
  return String(diagramId || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

async function readDiagramSummary(file) {
  try {
    const content = await fs.readFile(path.join(DIAGRAMS_DIR, file), 'utf-8');
    const data = JSON.parse(content);
    const stat = await fs.stat(path.join(DIAGRAMS_DIR, file));
    return {
      id: file.replace(/\.json$/, ''),
      name: data.name || 'Sin nombre',
      entityCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
      relationshipCount: Array.isArray(data.edges) ? data.edges.length : 0,
      updatedAt: stat.mtimeMs,
    };
  } catch (err) {
    console.error(`Error leyendo ${file}:`, err.message);
    return null;
  }
}

router.get('/diagrams', requireAuth, async (req, res) => {
  try {
    await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
    const files = await fs.readdir(DIAGRAMS_DIR);
    const diagramFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.acl.json'));

    const owned = [];
    const shared = [];

    // Sin auth: todos como owned (compatibilidad total con el modo abierto)
    if (process.env.AUTH_ENABLED !== 'true') {
      for (const file of diagramFiles) {
        const summary = await readDiagramSummary(file);
        if (summary) owned.push({ ...summary, role: 'OWNER' });
      }
      return res.json({ owned, shared });
    }

    const userId = req.user?.userId;
    for (const file of diagramFiles) {
      const diagramId = file.replace(/\.json$/, '');
      const role = await aclService.getRoleForUser(diagramId, userId);
      if (role === 'NONE') continue;
      const summary = await readDiagramSummary(file);
      if (!summary) continue;
      if (role === 'OWNER') {
        owned.push({ ...summary, role });
      } else {
        const acl = await aclService.readACL(diagramId);
        const owner = acl ? await userService.findById(acl.ownerId) : null;
        shared.push({
          ...summary,
          role,
          ownerUsername: owner?.username || 'desconocido',
        });
      }
    }

    res.json({ owned, shared });
  } catch (err) {
    console.error('Error en GET /api/diagrams:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/diagrams', requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    const diagramId = `diagram-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const diagram = {
      name: (typeof name === 'string' && name.trim()) || 'Nuevo diagrama',
      nodes: [],
      edges: [],
      chat: [],
    };

    await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(DIAGRAMS_DIR, `${safeId(diagramId)}.json`),
      JSON.stringify(diagram, null, 2),
      'utf-8'
    );

    // El creador queda como OWNER (anónimo si auth está desactivado)
    await aclService.getOrCreateACL(diagramId, req.user?.userId || 'anonymous');

    res.status(201).json({ id: diagramId, name: diagram.name });
  } catch (err) {
    console.error('Error en POST /api/diagrams:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
