'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { AiProvider } from '../types/diagram';

export interface AiConfig {
  provider: AiProvider;
  ollamaUrl: string;
  ollamaModel: string;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'groq',
  ollamaUrl: 'http://localhost:11434/v1',
  ollamaModel: 'qwen2.5-coder:7b',
};

const STORAGE_KEY = 'case-tool:ai-config';
const LEGACY_PROVIDER_KEY = 'case-tool:ai-provider';
const CHANGE_EVENT = 'case-tool:ai-config-change';

let cachedConfig: AiConfig | null = null;

function readConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiConfig>;
      return {
        provider: parsed.provider === 'ollama' ? 'ollama' : 'groq',
        ollamaUrl: typeof parsed.ollamaUrl === 'string' && parsed.ollamaUrl.trim()
          ? parsed.ollamaUrl.trim()
          : DEFAULT_AI_CONFIG.ollamaUrl,
        ollamaModel: typeof parsed.ollamaModel === 'string' && parsed.ollamaModel.trim()
          ? parsed.ollamaModel.trim()
          : DEFAULT_AI_CONFIG.ollamaModel,
      };
    }
    const legacyProvider = localStorage.getItem(LEGACY_PROVIDER_KEY);
    return {
      ...DEFAULT_AI_CONFIG,
      provider: legacyProvider === 'ollama' ? 'ollama' : 'groq',
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

function getSnapshot(): AiConfig {
  if (!cachedConfig) cachedConfig = readConfig();
  return cachedConfig;
}

function getServerSnapshot(): AiConfig {
  return DEFAULT_AI_CONFIG;
}

function subscribe(callback: () => void) {
  const onStoreChange = () => {
    cachedConfig = readConfig();
    callback();
  };
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function useAiProvider() {
  const config = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setConfig = useCallback((value: AiConfig) => {
    const next: AiConfig = {
      provider: value.provider === 'ollama' ? 'ollama' : 'groq',
      ollamaUrl: value.ollamaUrl.trim() || DEFAULT_AI_CONFIG.ollamaUrl,
      ollamaModel: value.ollamaModel.trim() || DEFAULT_AI_CONFIG.ollamaModel,
    };
    cachedConfig = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { config, setConfig };
}
