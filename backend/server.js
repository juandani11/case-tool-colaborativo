require('dotenv').config();
const express = require('express');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { generateProject } = require('./generator/generate');

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
async function getMutationsFromAI(command, currentState) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no está configurada');
  }

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  const systemPrompt = `Eres un asistente de diseño de diagramas entidad-relación (DER) o clases UML.
Recibes el estado actual del diagrama en formato JSON y un comando del usuario en lenguaje natural.
Debes devolver ÚNICAMENTE un objeto JSON con una propiedad "mutations" que sea un ARRAY.
Cada elemento del array debe ser un objeto con una propiedad "action" y los campos necesarios.
Las acciones posibles son:
- addEntity: { "action": "addEntity", "entityName": string, "attributes": [{ "name": string, "type": "String"|"Integer"|"UUID"|"BigDecimal"|"Date"|"Boolean"|"etc", "isPk": boolean, "nullable": boolean, "unique": boolean }] }
- addAttribute: { "action": "addAttribute", "entityName": string, "attribute": { "name": string, "type": ..., "isPk": ..., "nullable": ..., "unique": ... } }
- removeEntity: { "action": "removeEntity", "entityName": string }
- addRelationship: { "action": "addRelationship", "sourceEntity": string, "targetEntity": string, "type": "MANY_TO_ONE"|"ONE_TO_MANY"|"MANY_TO_MANY"|"ONE_TO_ONE", "cardinalityFrom": string, "cardinalityTo": string }
- removeRelationship: { "action": "removeRelationship", "sourceEntity": string, "targetEntity": string }

Reglas:
- Devuelve SIEMPRE un array de mutaciones, incluso si solo hay una.
- No uses claves duplicadas; cada mutación debe ser un objeto separado dentro del array.
- No incluyas texto adicional, solo el JSON válido.
- Si el comando pide crear varias entidades o relaciones, inclúyelas todas en el array.`;

  const userPrompt = `Estado actual del diagrama:\n${JSON.stringify(currentState, null, 2)}\n\nComando del usuario: "${command}"`;

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
        { role: 'user', content: userPrompt }
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