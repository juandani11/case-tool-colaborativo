'use client';

import { useState } from 'react';
import { AiProvider } from '../types/diagram';
import { AiConfig, DEFAULT_AI_CONFIG } from '../hooks/useAiProvider';
import { apiFetch, API_BASE } from '../lib/apiClient';

interface AiConfigModalProps {
  aiConfig: AiConfig;
  onAiConfigChange: (config: AiConfig) => void;
  onClose: () => void;
}

function isLoopbackOllamaUrl(value: string): boolean {
  const url = value.trim().toLowerCase();
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1');
}

export default function AiConfigModal({
  aiConfig,
  onAiConfigChange,
  onClose,
}: AiConfigModalProps) {
  const [draftProvider, setDraftProvider] = useState<AiProvider>(aiConfig.provider);
  const [draftOllamaUrl, setDraftOllamaUrl] = useState(aiConfig.ollamaUrl);
  const [draftOllamaModel, setDraftOllamaModel] = useState(aiConfig.ollamaModel);
  const [configError, setConfigError] = useState('');
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [detectingModels, setDetectingModels] = useState(false);
  const [modelDetectionError, setModelDetectionError] = useState('');
  const isCloudDeployment = typeof window !== 'undefined'
    && process.env.NODE_ENV === 'production'
    && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const showCloudLocalhostWarning =
    isCloudDeployment && isLoopbackOllamaUrl(draftOllamaUrl);

  const detectModels = async () => {
    const url = draftOllamaUrl.trim() || DEFAULT_AI_CONFIG.ollamaUrl;
    setDetectingModels(true);
    setDetectedModels([]);
    setModelDetectionError('');
    try {
      const response = await apiFetch(
        `${API_BASE}/api/ai/ollama-models?url=${encodeURIComponent(url)}`
      );
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        setModelDetectionError(
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'No se detectaron modelos. Asegúrate de que Ollama esté corriendo.'
        );
        return;
      }
      const data = await response.json().catch(() => null);
      const models = Array.isArray(data)
        ? data.filter((model: unknown): model is string => typeof model === 'string' && model.trim().length > 0)
        : [];
      if (models.length === 0) {
        setModelDetectionError('No se detectaron modelos. Asegúrate de que Ollama esté corriendo.');
        return;
      }
      setDetectedModels(models);
      setDraftOllamaModel((current) => models.includes(current) ? current : models[0]);
    } catch {
      setModelDetectionError('No se detectaron modelos. Asegúrate de que Ollama esté corriendo.');
    } finally {
      setDetectingModels(false);
    }
  };

  const saveConfig = () => {
    const url = draftOllamaUrl.trim() || DEFAULT_AI_CONFIG.ollamaUrl;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('protocol');
      }
    } catch {
      setConfigError('La URL de Ollama debe empezar por http:// o https://.');
      return;
    }
    onAiConfigChange({
      provider: draftProvider,
      ollamaUrl: url,
      ollamaModel: draftOllamaModel.trim() || DEFAULT_AI_CONFIG.ollamaModel,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-config-title"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveConfig();
        }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-5"
      >
        <h3 id="ai-config-title" className="text-base font-semibold text-gray-900 mb-1">
          Configuración Avanzada de IA
        </h3>
        <p className="text-[11px] text-gray-500 mb-4">
          Groq es rápido y requiere internet. Ollama es local y requiere que el servidor esté activo.
        </p>

        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="ai-provider-modal">
          Proveedor
        </label>
        <select
          id="ai-provider-modal"
          value={draftProvider}
          onChange={(event) => setDraftProvider(event.target.value as AiProvider)}
          className="w-full mb-3 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="groq">Groq (Nube)</option>
          <option value="ollama">Ollama (Local)</option>
        </select>

        {draftProvider === 'ollama' && (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="ai-ollama-url">
              Ollama URL
            </label>
            <input
              id="ai-ollama-url"
              type="url"
              value={draftOllamaUrl}
              onChange={(event) => {
                setDraftOllamaUrl(event.target.value);
                setDetectedModels([]);
                setModelDetectionError('');
              }}
              placeholder={DEFAULT_AI_CONFIG.ollamaUrl}
              className="w-full mb-3 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {showCloudLocalhostWarning && (
              <p
                className="text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mb-3"
                title="En la nube, localhost apunta al servidor de Vercel/Railway, no a tu equipo. Expón Ollama con Ngrok y usa la URL pública."
              >
                ⚠️ En la nube, <code className="font-mono">localhost</code> no funciona. Para usar Ollama, expón tu puerto con Ngrok y pega la URL pública aquí.
              </p>
            )}

            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="ai-ollama-model">
              Ollama Model
            </label>
            <div className="flex gap-2 mb-1">
              {detectedModels.length > 0 ? (
                <select
                  id="ai-ollama-model"
                  value={draftOllamaModel}
                  onChange={(event) => setDraftOllamaModel(event.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {detectedModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="ai-ollama-model"
                  type="text"
                  value={draftOllamaModel}
                  onChange={(event) => setDraftOllamaModel(event.target.value)}
                  placeholder={DEFAULT_AI_CONFIG.ollamaModel}
                  className="flex-1 min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <button
                type="button"
                onClick={detectModels}
                disabled={detectingModels}
                className="px-2.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={detectingModels ? 'animate-spin' : ''}>
                    <path d="M10 6a4 4 0 11-1.2-2.8M10 1.5V4H7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {detectingModels ? 'Buscando...' : 'Detectar'}
                </span>
              </button>
            </div>
            {detectingModels && (
              <p className="text-[11px] text-gray-400 mb-1">Buscando modelos...</p>
            )}
            {modelDetectionError && (
              <p className="text-[11px] text-amber-700 mb-1">{modelDetectionError}</p>
            )}
          </>
        )}

        {configError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
            {configError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Guardar Configuración
          </button>
        </div>
      </form>
    </div>
  );
}
