require('dotenv').config();
const express = require('express');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { generateProject } = require('./generator/generate');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Conexión WebSocket para colaboración
wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

// Endpoint de salud
app.get('/health', (req, res) => res.send('OK'));

// ── Diagram persistence ─────────────────────────────────────────────
const DIAGRAMS_DIR = path.join(__dirname, 'data', 'diagrams');
fs.mkdirSync(DIAGRAMS_DIR, { recursive: true });

function diagramPath(id) {
  // Prevent path traversal
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DIAGRAMS_DIR, `${safe}.json`);
}

app.get('/api/diagrams', (_req, res) => {
  try {
    if (!fs.existsSync(DIAGRAMS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(DIAGRAMS_DIR).filter(f => f.endsWith('.json'));
    const diagrams = files.map(f => {
      const id = f.replace(/\.json$/, '');
      try {
        const filePath = path.join(DIAGRAMS_DIR, f);
        const stat = fs.statSync(filePath);
        let name = `Diagrama ${id.replace(/^diagram-/, '')}`;
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (data.name) name = data.name;
        } catch {}
        return { id, name, updatedAt: stat.mtimeMs };
      } catch {
        return { id, name: `Diagrama ${id.replace(/^diagram-/, '')}`, updatedAt: 0 };
      }
    });
    res.json(diagrams);
  } catch (err) {
    console.error('Error listing diagrams:', err);
    res.status(500).json({ error: 'Error listing diagrams' });
  }
});

app.get('/api/diagrams/:id', (req, res) => {
  const filePath = diagramPath(req.params.id);
  if (!fs.existsSync(filePath)) {
    const fallbackName = `Diagrama ${req.params.id.replace(/^diagram-/, '')}`;
    return res.json({ name: fallbackName, nodes: [], edges: [], chat: [] });
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.name) {
      data.name = `Diagrama ${req.params.id.replace(/^diagram-/, '')}`;
    }
    res.json(data);
  } catch {
    const fallbackName = `Diagrama ${req.params.id.replace(/^diagram-/, '')}`;
    res.json({ name: fallbackName, nodes: [], edges: [], chat: [] });
  }
});

app.post('/api/diagrams/:id', (req, res) => {
  const { name, nodes, edges, chat } = req.body;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return res.status(400).json({ error: 'nodes and edges arrays are required' });
  }
  try {
    const filePath = diagramPath(req.params.id);
    // Preserve existing name if not provided in request
    let existingName = `Diagrama ${req.params.id.replace(/^diagram-/, '')}`;
    if (fs.existsSync(filePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (existing.name) existingName = existing.name;
      } catch {}
    }
    const diagramName = name || existingName;
    fs.writeFileSync(filePath, JSON.stringify({ name: diagramName, nodes, edges, chat: chat || [] }, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving diagram:', err);
    res.status(500).json({ error: 'Error saving diagram' });
  }
});

app.put('/api/diagrams/:id/rename', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const filePath = diagramPath(req.params.id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Diagram not found' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.name = name.trim();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ ok: true, name: data.name });
  } catch (err) {
    console.error('Error renaming diagram:', err);
    res.status(500).json({ error: 'Error renaming diagram' });
  }
});

app.delete('/api/diagrams/:id', (req, res) => {
  const filePath = diagramPath(req.params.id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Diagram not found' });
  }
  try {
    fs.unlinkSync(filePath);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting diagram:', err);
    res.status(500).json({ error: 'Error deleting diagram' });
  }
});

// Endpoint de IA
app.post('/api/ai/command', async (req, res) => {
  const { command, currentState } = req.body;

  if (!command || !currentState) {
    return res.status(400).json({ error: 'Faltan parámetros: command y currentState son requeridos' });
  }

  try {
    const mutations = await getMutationsFromAI(command, currentState);
    if (!Array.isArray(mutations)) {
      throw new Error('La respuesta no es una lista de mutaciones');
    }
    res.json({ mutations });
  } catch (error) {
    console.error('Error al procesar comando de IA:', error);
    res.status(500).json({ error: 'Error interno al procesar el comando' });
  }
});

// Endpoint de transcripción de voz (Whisper)
app.post('/api/ai/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió archivo de audio' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY no está configurada' });
  }

  try {
    const ext = req.file.mimetype.split('/')[1] || 'webm';
    const filename = `recording.${ext}`;
    const file = new File([req.file.buffer], filename, { type: req.file.mimetype });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq Whisper error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (error) {
    console.error('Error en transcripción:', error);
    res.status(500).json({ error: 'Error al transcribir audio: ' + error.message });
  }
});

// Endpoint de generación de diagrama desde imagen (LLaVA)
app.post('/api/ai/from-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió imagen' });
  }

  const currentState = req.body.currentState ? JSON.parse(req.body.currentState) : { entities: [], relationships: [] };

  try {
    const mutations = await getMutationsFromAI(
      'Analiza esta imagen de un diagrama UML o entidad-relación. Extrae todas las entidades, sus atributos y las relaciones entre ellas. Devuelve las mutaciones en el formato estándar.',
      currentState,
      req.file.buffer,
      req.file.mimetype
    );
    if (!Array.isArray(mutations)) {
      throw new Error('La respuesta no es una lista de mutaciones');
    }
    res.json({ mutations });
  } catch (error) {
    console.error('Error al procesar imagen:', error);
    res.status(500).json({ error: 'Error interno al procesar la imagen: ' + error.message });
  }
});

// Endpoint de generación de backend (asíncrono)
app.post('/api/generate', async (req, res) => {
  const { currentState } = req.body;

  if (!currentState || !currentState.entities || currentState.entities.length === 0) {
    return res.status(400).json({ error: 'El diagrama no tiene entidades para generar' });
  }

  try {
    // Ahora generateProject devuelve una promesa que se resuelve con la ruta del ZIP
    const zipPath = await generateProject(currentState);
    res.download(zipPath, 'backend-generado.zip', (err) => {
      if (err) {
        console.error('Error al descargar ZIP:', err);
        // No se puede enviar otra respuesta aquí, solo limpiar
        const outputDir = path.dirname(zipPath);
        fs.rmSync(outputDir, { recursive: true, force: true });
      } else {
        // Limpiar directorio temporal después de la descarga exitosa
        const outputDir = path.dirname(zipPath);
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    });
  } catch (error) {
    console.error('Error al generar proyecto:', error);
    res.status(500).json({ error: 'Error al generar el proyecto backend' });
  }
});

// Función para llamar a Groq y obtener mutaciones
async function getMutationsFromAI(command, currentState, imageBuffer, imageMime) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no está configurada');
  }

  const model = imageBuffer
    ? (process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b')
    : (process.env.GROQ_MODEL || 'openai/gpt-oss-20b');

  const systemPrompt = `Eres un asistente de diseño de diagramas entidad-relación (DER) o clases UML.
Recibes el estado actual del diagrama en formato JSON y un comando del usuario en lenguaje natural${imageBuffer ? ' o una imagen de un diagrama' : ''}.
Debes devolver ÚNICAMENTE un objeto JSON con una propiedad "mutations" que sea un ARRAY.
Cada elemento del array debe ser un objeto con una propiedad "action" y los campos necesarios.
Las acciones posibles son:
- addEntity: { "action": "addEntity", "entityName": string, "attributes": [{ "name": string, "type": "String"|"Integer"|"UUID"|"BigDecimal"|"Date"|"Boolean"|"etc", "isPk": boolean, "nullable": boolean, "unique": boolean }] }
- addAttribute: { "action": "addAttribute", "entityName": string, "attribute": { "name": string, "type": ..., "isPk": ..., "nullable": ..., "unique": ... } }
- removeEntity: { "action": "removeEntity", "entityName": string }
- addRelationship: { "action": "addRelationship", "sourceEntity": string, "targetEntity": string, "type": "MANY_TO_ONE"|"ONE_TO_MANY"|"MANY_TO_MANY"|"ONE_TO_ONE", "cardinalityFrom": string, "cardinalityTo": string }
- removeRelationship: { "action": "removeRelationship", "sourceEntity": string, "targetEntity": string }

Reglas CRÍTICAS:
- Devuelve SIEMPRE un array de mutaciones, incluso si solo hay una.
- No incluyas texto adicional, solo el JSON válido.
- ORDEN OBLIGATORIO: Primero TODAS las addEntity, luego addAttribute, luego addRelationship, y finalmente removeEntity/removeRelationship.
- NOMBRES CONSISTENTES: El campo entityName en addEntity DEBE ser EXACTAMENTE el mismo valor usado en sourceEntity o targetEntity de addRelationship. Usa los mismos nombres exactos.
- Si el usuario pide "Customer" y "Order", usa "Customer" y "Order" en todas las mutaciones, sin variaciones.
- Si el comando pide crear varias entidades o relaciones, inclúyelas todas en el array.`;

  // Build user message content
  let userContent;
  if (imageBuffer) {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${imageMime};base64,${base64}`;
    userContent = [
      { type: 'text', text: `Estado actual del diagrama:\n${JSON.stringify(currentState, null, 2)}\n\nComando: "${command}"` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ];
  } else {
    userContent = `Estado actual del diagrama:\n${JSON.stringify(currentState, null, 2)}\n\nComando del usuario: "${command}"`;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de Groq: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Limpiar markdown code fences
  let jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.mutations || !Array.isArray(parsed.mutations)) {
      throw new Error('La respuesta no contiene un array de mutaciones');
    }
    return parsed.mutations;
  } catch (parseError) {
    console.error('JSON directo inválido, intentando recuperación...');
    console.error('Contenido original:', jsonStr);
    
    const mutations = extractMutationsFromText(jsonStr);
    if (mutations.length > 0) {
      return mutations;
    }
    throw new Error('La IA devolvió un formato inválido y no se pudo recuperar');
  }
}

// Función de recuperación para extraer objetos de mutación de un JSON malformado
function extractMutationsFromText(text) {
  const mutations = [];
  
  const objectRegex = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.action && isValidMutation(obj)) {
        mutations.push(obj);
      }
    } catch (e) {
      // Ignorar objetos que no se puedan parsear
    }
  }
  
  if (mutations.length === 0) {
    const actionPattern = /"action"\s*:\s*"([^"]+)"/g;
    let actionMatch;
    while ((actionMatch = actionPattern.exec(text)) !== null) {
      const action = actionMatch[1];
      const start = text.lastIndexOf('{', actionMatch.index);
      const end = text.indexOf('}', actionMatch.index);
      if (start !== -1 && end !== -1) {
        const objStr = text.substring(start, end + 1);
        try {
          const obj = JSON.parse(objStr);
          if (obj.action === action && isValidMutation(obj)) {
            mutations.push(obj);
          }
        } catch (e) {
          // No se pudo parsear, omitir
        }
      }
    }
  }

  return mutations;
}

function isValidMutation(mutation) {
  const validActions = ['addEntity', 'addAttribute', 'removeEntity', 'addRelationship', 'removeRelationship'];
  return validActions.includes(mutation.action);
}

const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});