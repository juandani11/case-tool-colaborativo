'use client';

import { useState, useRef, useCallback } from 'react';
import { nodesToAST, applyMutations } from '../utils/ast';
import { apiFetch } from '../lib/apiClient';
import { EntityNodeData, RelationshipData } from '../types/diagram';
import { Node, Edge } from 'reactflow';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1234';

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
  nodes: Node<EntityNodeData>[];
  edges: Edge<RelationshipData>[];
  addNode: (node: Node<EntityNodeData>) => void;
  updateNode: (id: string, changes: any) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Edge<RelationshipData>) => void;
  removeEdge: (id: string) => void;
  addMessage: (sender: 'user' | 'ia' | 'system', text: string) => void;
}

export function useAICommand(options: AICommandOptions) {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFromImage, setIsFromImage] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSendCommand = async () => {
    if (!command.trim() || isProcessing) return;
    setIsProcessing(true);
    options.addMessage('user', command.trim());
    try {
      const ast = nodesToAST(options.nodes, options.edges);
      const response = await apiFetch(`${API_BASE}/api/ai/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, currentState: ast }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg = 'Error: ' + (error.error || 'Error desconocido');
        options.addMessage('ia', errorMsg);
        return;
      }

      const data = await response.json();
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
        const explanation = data.explanation ? `\n\n${data.explanation}` : '';
        options.addMessage('ia', summary + explanation);
        setCommand('');
      } else {
        options.addMessage('ia', 'La IA no devolvió cambios.');
      }
    } catch (error) {
      console.error('Error al comunicarse con el servidor:', error);
      options.addMessage('ia', 'No se pudo conectar con el servidor de IA.');
    } finally {
      setIsProcessing(false);
    }
  };

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
          options.addMessage('system', 'No se grabó audio.');
          return;
        }

        setIsProcessing(true);
        options.addMessage('system', 'Transcribiendo audio...');
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await apiFetch(`${API_BASE}/api/ai/transcribe`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            options.addMessage('ia', 'Error de transcripción: ' + (err.error || 'Error desconocido'));
            return;
          }

          const data = await res.json();
          if (data.text && data.text.trim()) {
            setCommand(data.text.trim());
            options.addMessage('system', `Transcripción: "${data.text.trim()}"`);
          } else {
            options.addMessage('system', 'No se detectó voz en el audio.');
          }
        } catch (err) {
          console.error('Error transcribiendo:', err);
          options.addMessage('ia', 'No se pudo conectar con el servicio de transcripción.');
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
        options.addMessage('system', 'Permiso de micrófono denegado. Habilita el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        options.addMessage('system', 'No se encontró un micrófono conectado.');
      } else {
        options.addMessage('ia', 'Error al acceder al micrófono: ' + err.message);
      }
    }
  }, [isRecording, options]);

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
