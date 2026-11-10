'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { nodesToAST, applyMutations } from '../utils/ast';
import { apiFetch } from '../lib/apiClient';
import { classifyChatMessage } from '../utils/chatMentions';
import { AiProvider, EntityNodeData, RelationshipData, SelectedElementContext } from '../types/diagram';
import type { ConnectedUser } from '../types/collaboration';
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
  selectedElement?: SelectedElementContext | null;
  provider?: AiProvider;
  ollamaUrl?: string;
  ollamaModel?: string;
  connectedUsers?: ConnectedUser[];
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const discardRecordingRef = useRef(false);
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
  const clearRecordingResources = useCallback(() => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) {
      audioContext.close().catch(() => {});
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      clearRecordingResources();
      transcriptionAbortRef.current?.abort('cancel');
      commandAbortRef.current?.abort('cancel');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, [clearRecordingResources]);

  const handleCancel = useCallback(() => {
    discardRecordingRef.current = true;
    transcriptionAbortRef.current?.abort('cancel');
    commandAbortRef.current?.abort('cancel');
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    clearRecordingResources();
    processingRef.current = false;
    setIsProcessing(false);
    setIsRecording(false);
    optionsRef.current.addMessage('system', 'Operación cancelada.');
  }, [clearRecordingResources]);

  // Núcleo de envío: texto explícito + guard anti-doble-envío (vacío o ya
  // procesando). Estable entre renders para que onstop/timeout lo llamen sin
  // closures viejos; lee nodos/aristas vigentes vía optionsRef. processingRef
  // (síncrono) cubre la carrera que el state isProcessing (async) no ve:
  // Enter manual + auto-envío de voz en la misma ventana de tiempo.
  const sendCommandText = useCallback(async (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed || processingRef.current) return;

    const opts = optionsRef.current;
    const target = classifyChatMessage(trimmed, opts.connectedUsers);
    opts.addMessage('user', trimmed);

    if (target.kind === 'human' && target.known) {
      setCommand('');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    const controller = new AbortController();
    commandAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 30000);
    try {
      const ast = nodesToAST(opts.nodes, opts.edges);
      const response = await apiFetch(`${API_BASE}/api/ai/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          command: trimmed,
          currentState: ast,
          diagramId: opts.diagramId,
          selectedElement: opts.selectedElement ?? null,
          provider: opts.provider ?? undefined,
          ...(opts.provider === 'ollama' ? { ollamaUrl: opts.ollamaUrl, ollamaModel: opts.ollamaModel } : {}),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const errorMsg = typeof error?.error === 'string'
          ? error.error
          : 'No se pudo procesar el comando.';
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
      if (controller.signal.aborted) {
        if (controller.signal.reason === 'timeout') {
          opts.addMessage('system', 'La IA tardó demasiado en responder. Intenta de nuevo.');
        }
      } else {
        console.error('Error al comunicarse con el servidor:', error);
        opts.addMessage('ia', 'No se pudo conectar con el servidor de IA.');
      }
    } finally {
      clearTimeout(timeout);
      if (commandAbortRef.current === controller) commandAbortRef.current = null;
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
      mediaRecorderRef.current?.stop();
      return;
    }

    discardRecordingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = (event) => {
        console.error('Error de grabación de audio:', event);
        clearRecordingResources();
        setIsRecording(false);
        setIsProcessing(false);
        optionsRef.current.addMessage('system', 'Error al grabar audio. Intenta de nuevo.');
      };

      mediaRecorder.onstop = async () => {
        clearRecordingResources();
        setIsRecording(false);

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size === 0) {
          optionsRef.current.addMessage('system', 'No se grabó audio.');
          return;
        }

        setIsProcessing(true);
        optionsRef.current.addMessage('system', 'Transcribiendo audio...');

        const controller = new AbortController();
        transcriptionAbortRef.current = controller;
        const timeout = setTimeout(() => controller.abort('timeout'), 10000);

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await apiFetch(`${API_BASE}/api/ai/transcribe`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => null);
            optionsRef.current.addMessage('ia', 'Error de transcripción: ' + (err?.error || 'Error desconocido'));
            return;
          }

          const data = await res.json();
          if (data.text && data.text.trim()) {
            const transcript = data.text.trim();
            setCommand(transcript);
            optionsRef.current.addMessage('system', `Transcripción: "${transcript}"`);
            if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
            autoSendTimerRef.current = setTimeout(() => {
              sendCommandText(commandRef.current);
            }, 400);
          } else {
            optionsRef.current.addMessage('system', 'No se detectó voz en el audio.');
          }
        } catch (err) {
          if (controller.signal.aborted) {
            if (controller.signal.reason === 'timeout') {
              optionsRef.current.addMessage('system', 'La transcripción tardó demasiado. Intenta de nuevo.');
            }
          } else {
            console.error('Error transcribiendo:', err);
            optionsRef.current.addMessage('ia', 'No se pudo conectar con el servicio de transcripción.');
          }
        } finally {
          clearTimeout(timeout);
          if (transcriptionAbortRef.current === controller) transcriptionAbortRef.current = null;
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Si no hay voz en 5 s, detiene la grabación automáticamente.
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let speechDetected = false;
        let silentSince = Date.now();

        audioContextRef.current = audioContext;
        silenceIntervalRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const value = (data[i] - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / data.length);
          if (rms > 0.02) {
            speechDetected = true;
            silentSince = Date.now();
          } else if (!speechDetected && Date.now() - silentSince > 5000) {
            if (silenceIntervalRef.current) {
              clearInterval(silenceIntervalRef.current);
              silenceIntervalRef.current = null;
            }
            try { mediaRecorder.stop(); } catch {}
          }
        }, 200);
      }

      // Límite absoluto para que el micrófono nunca quede abierto.
      recordingTimerRef.current = setTimeout(() => {
        try {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        } catch {}
      }, 15000);
    } catch (err: any) {
      clearRecordingResources();
      console.error('Error accediendo al micrófono:', err);
      setIsRecording(false);
      setIsProcessing(false);
      if (err.name === 'NotAllowedError') {
        optionsRef.current.addMessage('system', 'Permiso de micrófono denegado. Habilita el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        optionsRef.current.addMessage('system', 'No se encontró un micrófono conectado.');
      } else {
        optionsRef.current.addMessage('ia', 'Error al acceder al micrófono: ' + err.message);
      }
    }
  }, [clearRecordingResources, isRecording, sendCommandText]);

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
    handleCancel,
    handleFromImage,
  };
}
