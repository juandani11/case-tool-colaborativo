'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, authEnabled } = require('../middleware/auth');
const upload = require('../middleware/upload');
const aclService = require('../services/aclService');
const diagramService = require('../services/diagramService');
const chatService = require('../services/chatService');
const {
  GROQ_API_BASE,
  aiUsername,
  formatChatHistory,
  getMutationsFromAI,
} = require('../services/aiService');
const { emitChatMessage } = require('../realtime/yjs');
const { generateProject } = require('../generator/generate');
const { asyncHandler, httpError } = require('../errors');
const {
  validateCommandPayload,
  validateAstState,
  validateMutations,
} = require('../validation');

const router = express.Router();

router.post('/command', requireAuth, asyncHandler(async (req, res) => {
  const checked = validateCommandPayload(req.body);
  if (!checked.ok) throw httpError(400, checked.error);

  const { command, currentState, diagramId } = checked.value;
  const username = aiUsername(req.user);
  let historyPrompt = '';

  if (diagramId) {
    if (authEnabled()) {
      const role = await aclService.getRoleForUser(diagramId, req.user?.userId);
      if (role === 'NONE') throw httpError(403, 'No tienes acceso a este diagrama');
    }

    const diagram = await diagramService.getDiagram(diagramId);
    if (!diagram) {
      if (authEnabled()) throw httpError(404, 'Diagrama no encontrado');
      await diagramService.ensureDiagram({
        id: diagramId,
        ownerId: req.user?.userId,
      });
    }

    const dbHistory = await chatService.getRecentMessages(diagramId, 15);
    historyPrompt = formatChatHistory(dbHistory);

    await chatService.addMessage({
      diagramId,
      author: username,
      role: 'user',
      content: command,
    });
  }

  const { mutations, response } = await getMutationsFromAI(
    command,
    currentState,
    null,
    null,
    username,
    historyPrompt
  );
  const checkedMutations = validateMutations(mutations);
  if (!checkedMutations.ok) throw httpError(502, 'La IA devolvió un formato inválido');

  let chatEmitted = false;
  if (response && diagramId) {
    try {
      await chatService.addMessage({
        diagramId,
        author: 'IA',
        role: 'assistant',
        content: response,
      });
    } catch (err) {
      console.error('No se pudo persistir la respuesta de la IA:', err.message);
    }

    chatEmitted = await emitChatMessage(diagramId, {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      sender: 'ia',
      author: 'IA',
      text: response,
      timestamp: Date.now(),
    });
  }

  res.json({
    mutations: checkedMutations.value,
    response,
    username,
    chatEmitted,
  });
}));

router.post('/transcribe', requireAuth, upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'No se envió archivo de audio');
  if (!String(req.file.mimetype || '').startsWith('audio/')) {
    throw httpError(400, 'El archivo debe ser de audio');
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw httpError(503, 'El servicio de transcripción no está configurado');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const ext = req.file.mimetype.split('/')[1] || 'webm';
    const file = new File([req.file.buffer], `recording.${ext}`, { type: req.file.mimetype });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es');
    formData.append('response_format', 'json');

    const response = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq Whisper respondió ${response.status}: ${errorText.slice(0, 300)}`);
      throw httpError(502, 'El proveedor de transcripción no pudo procesar el audio');
    }

    const data = await response.json();
    const text = typeof data.text === 'string' ? data.text.trim().slice(0, 10000) : '';
    if (!text) throw httpError(502, 'La transcripción no devolvió texto válido');
    res.json({ text });
  } catch (err) {
    if (err.name === 'AbortError') throw httpError(504, 'La transcripción tardó demasiado');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}));

router.post('/from-image', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'No se envió imagen');
  if (!String(req.file.mimetype || '').startsWith('image/')) {
    throw httpError(400, 'El archivo debe ser una imagen');
  }

  let currentState;
  try {
    currentState = req.body.currentState
      ? JSON.parse(req.body.currentState)
      : { entities: [], relationships: [] };
  } catch {
    throw httpError(400, 'currentState no es JSON válido');
  }

  const stateCheck = validateAstState(currentState);
  if (!stateCheck.ok) throw httpError(400, stateCheck.error);

  const username = aiUsername(req.user);
  const { mutations } = await getMutationsFromAI(
    'Analiza esta imagen de un diagrama UML o entidad-relación. Extrae todas las entidades, sus atributos y las relaciones entre ellas. Devuelve las mutaciones en el formato estándar.',
    stateCheck.value,
    req.file.buffer,
    req.file.mimetype,
    username
  );

  const checkedMutations = validateMutations(mutations);
  if (!checkedMutations.ok) throw httpError(502, 'La IA devolvió un formato inválido');

  res.json({ mutations: checkedMutations.value, username });
}));

router.post('/generate', requireAuth, asyncHandler(async (req, res) => {
  const stateCheck = validateAstState(req.body?.currentState, { requireEntities: true });
  if (!stateCheck.ok) throw httpError(400, stateCheck.error);

  const zipPath = await generateProject(stateCheck.value);
  res.download(zipPath, 'backend-generado.zip', (err) => {
    if (err) console.error('Error al descargar ZIP:', err);
    fs.rmSync(path.dirname(zipPath), { recursive: true, force: true });
  });
}));

module.exports = router;
