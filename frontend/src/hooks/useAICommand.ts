'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { nodesToAST, applyMutations } from '../utils/ast';
import { apiFetch } from '../lib/apiClient';
import { EntityNodeData, RelationshipData } from '../types/diagram';
import { Node, Edge } from 'reactflow';

// Base del backend (misma que apiClient). Los 3 handlers comparten patron:
// nodesToAST -> POST -> si hay mutaciones, applyMutations; si no (consulta
// teórica), solo se publica la respuesta en el chat sin tocar el diagrama.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1234';

// Personaliza un texto con el nombre que el backend extrajo del JWT.
// Fallback por si el LLM no devolvió "explanation": la respuesta igualmente
// se dirige al usuario por su nombre.
function addressUser(username: unknown, text: string): string {
  const name = typeof username === 'string' ? username.trim() : '';
  return name && name !== 'Usuario' ? `${name}, ${text}` : text;
}

function buildMutationSummary(mutations: any[]): string {
  const counts: Record<string, number> = {};
  for (const m of mutations) {
    counts[m.action] = (counts[m.action] || 0) + 1;
  }
  const parts: string[] = [];
  if (counts.addEntity) parts.push(`${counts.addEntity} entidad${counts.addEntity > 1 ? 'es' : ''}`);
  if (counts.addAttribute) parts.push(`${counts.addAttribute} atributo${counts.addAttribute > 1 ? 's' : ''}`);
  if (counts.addRelationship) parts.push(`${counts.addRelationship} relación${counts.addRelationship > 1 ? 'es' : ''}`);
  if (counts.removeEntity) parts.push(`eliminé ${counts.removeEntity} entidad${counts.removeEntity > 1 ? 'es' : ''}`);
  if (counts.removeRelationship) parts.push(`eliminé ${counts.removeRelationship} relación${counts.removeRelationship > 1 ? 'es' : ''}`);
  const total = mutations.length;
  return `Apliqué ${total} cambio${total > 1 ? 's' : ''}: ${parts.join(', ')}.`;
}

interface AICommandOptions {
  // Diagrama actual: el backend emite la respuesta de la IA al chat Yjs de
  // esta sala (`diagram-room-<id>`), para que la vean todos los conectados.
  diagramId: string;
  nodes: Node<EntityNodeData>[];
  edges: Edge<RelationshipData>[];
  addNode: (node: Node<EntityNodeData>) => void;
  updateNode: (id: string, changes: any) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Edge<RelationshipData>) => void;
  removeEdge: (id: string) => void;
  addMessage: (sender: 'user' | 'ia' | 'system', text: string, author?: string) => void;
}

export function useAICommand(options: AICommandOptions) {
  const [command, setCommandState] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFromImage, setIsFromImage] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Espejos sincronos del estado para callbacks diferidos (onstop de
  // MediaRecorder, setTimeout de auto-envio): el state de React llega tarde
  // a esos closures, los refs siempre estan al dia.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const commandRef = useRef('');
  const processingRef = useRef(false);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setter que mantiene commandRef sincronizado (el input lo llama con string).
  const setCommand = useCallback((value: string) => {
    commandRef.current = value;
    setCommandState(value);
  }, []);

  // Limpia el auto-envio pendiente al desmontar (no enviar a un editor cerrado).
  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    };
  }, []);

  // Núcleo de envío: texto explícito + guard anti-doble-envío (vacío o ya
  // procesando). Estable entre renders para que onstop/timeout lo llamen sin
  // closures viejos; lee nodos/aristas vigentes vía optionsRef. processingRef
  // (síncrono) cubre la carrera que el state isProcessing (async) no ve:
  // Enter manual + auto-envío de voz en la misma ventana de tiempo.
  const sendCommandText = useCallback(async (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    const opts = optionsRef.current;
    opts.addMessage('user', trimmed);
    try {
      const ast = nodesToAST(opts.nodes, opts.edges);
      const response = await apiFetch(`${API_BASE}/api/ai/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: trimmed,
          currentState: ast,
          diagramId: opts.diagramId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg = 'Error: ' + (error.error || 'Error desconocido');
        opts.addMessage('ia', errorMsg);
        return;
      }

      const data = await response.json();
      // "response" es la respuesta del tutor; "explanation" se mantiene como
      // fallback por compatibilidad con versiones anteriores del backend.
      const aiText =
        typeof data.response === 'string'
          ? data.response.trim()
          : typeof data.explanation === 'string'
          ? data.explanation.trim()
          : '';

      if (Array.isArray(data.mutations) && data.mutations.length > 0) {
        applyMutations(data.mutations, {
          nodes: opts.nodes,
          edges: opts.edges,
          addNode: opts.addNode,
          updateNode: opts.updateNode,
          addEdge: opts.addEdge,
          removeNode: opts.removeNode,
          removeEdge: opts.removeEdge,
        });
      }

      const hasMutations = Array.isArray(data.mutations) && data.mutations.length > 0;
      const fallbackText = hasMutations
        ? addressUser(data.username, buildMutationSummary(data.mutations))
        : 'No se modificó el diagrama.';
      // El backend ya publicó la respuesta en el chat Yjs de la sala. Solo la
      // añadimos localmente si no pudo emitirla (evita duplicados).
      if (data.chatEmitted !== true) {
        opts.addMessage('ia', aiText || fallbackText, 'IA');
      }
      setCommand('');
    } catch (error) {
      console.error('Error al comunicarse con el servidor:', error);
      opts.addMessage('ia', 'No se pudo conectar con el servidor de IA.');
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [setCommand]);

  // Flujo por texto (Enter/botón): envía lo que hay en el input ahora mismo.
  const handleSendCommand = useCallback(() => {
    sendCommandText(commandRef.current);
  }, [sendCommandText]);

  const handleVoiceCommand = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size === 0) {
          optionsRef.current.addMessage('system', 'No se grabó audio.');
          return;
        }

        setIsProcessing(true);
        optionsRef.current.addMessage('system', 'Transcribiendo audio...');
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await apiFetch(`${API_BASE}/api/ai/transcribe`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            optionsRef.current.addMessage('ia', 'Error de transcripción: ' + (err.error || 'Error desconocido'));
            return;
          }

          const data = await res.json();
          if (data.text && data.text.trim()) {
            const transcript = data.text.trim();
            setCommand(transcript);
            optionsRef.current.addMessage('system', `Transcripción: "${transcript}"`);
            // Auto-envío: el usuario ya habló, no debe presionar Enviar.
            // Delay para que vea el texto antes de que se procese; se lee el
            // input VIGENTE (no el transcript capturado): si lo vació con un
            // Enter manual en esos 400 ms, el guard de sendCommandText no envía.
            // Transcripción vacía o fallida: no se envía nada.
            if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
            autoSendTimerRef.current = setTimeout(() => {
              sendCommandText(commandRef.current);
            }, 400);
          } else {
            optionsRef.current.addMessage('system', 'No se detectó voz en el audio.');
          }
        } catch (err) {
          console.error('Error transcribiendo:', err);
          optionsRef.current.addMessage('ia', 'No se pudo conectar con el servicio de transcripción.');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accediendo al micrófono:', err);
      if (err.name === 'NotAllowedError') {
        optionsRef.current.addMessage('system', 'Permiso de micrófono denegado. Habilita el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        optionsRef.current.addMessage('system', 'No se encontró un micrófono conectado.');
      } else {
        optionsRef.current.addMessage('ia', 'Error al acceder al micrófono: ' + err.message);
      }
    }
  }, [isRecording, sendCommandText]);

  const handleFromImage = useCallback(async (file: File) => {
    if (isProcessing || isFromImage) return;
    setIsFromImage(true);
    setIsProcessing(true);
    options.addMessage('user', `Analizando imagen: ${file.name}`);

    try {
      const ast = nodesToAST(options.nodes, options.edges);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('currentState', JSON.stringify(ast));

      const res = await apiFetch(`${API_BASE}/api/ai/from-image`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        options.addMessage('ia', 'Error al analizar imagen: ' + (err.error || 'Error desconocido'));
        return;
      }

      const data = await res.json();
      if (data.mutations && data.mutations.length > 0) {
        applyMutations(data.mutations, {
          nodes: options.nodes,
          edges: options.edges,
          addNode: options.addNode,
          updateNode: options.updateNode,
          addEdge: options.addEdge,
          removeNode: options.removeNode,
          removeEdge: options.removeEdge,
        });
        const summary = buildMutationSummary(data.mutations);
        options.addMessage('ia', `Desde imagen:\n${summary}`);
      } else {
        options.addMessage('ia', 'No se detectaron entidades en la imagen.');
      }
    } catch (err) {
      console.error('Error procesando imagen:', err);
      options.addMessage('ia', 'No se pudo conectar con el servidor para analizar la imagen.');
    } finally {
      setIsProcessing(false);
      setIsFromImage(false);
    }
  }, [isProcessing, isFromImage, options]);

  return {
    command,
    setCommand,
    isProcessing,
    isRecording,
    isFromImage,
    handleSendCommand,
    handleVoiceCommand,
    handleFromImage,
  };
}
