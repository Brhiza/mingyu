export type AiProviderMode = 'builtin' | 'custom';

export interface AiProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
}

export interface AiSettings {
  enabled: boolean;
  mode: AiProviderMode;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiRequestConfig {
  mode: AiProviderMode;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export const AI_SETTINGS_STORAGE_KEY = 'mingyu:ai-settings:v1';
export const AI_SETTINGS_EVENT = 'mingyu-ai-settings-change';

type RuntimeAiConfig = {
  aiDefaultEnabled?: boolean;
  aiProviderName?: string;
};

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'doubao',
    label: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  {
    id: 'moonshot',
    label: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    id: 'zhipu',
    label: '智谱',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
];

export function isServerBuiltinAiEnabled(): boolean {
  const runtimeConfig = (
    globalThis as typeof globalThis & { __MINGYU_RUNTIME_CONFIG__?: RuntimeAiConfig }
  ).__MINGYU_RUNTIME_CONFIG__;
  if (typeof runtimeConfig?.aiDefaultEnabled === 'boolean') {
    return runtimeConfig.aiDefaultEnabled;
  }
  return import.meta.env.VITE_AI_DEFAULT_ENABLED === 'true';
}

export function getServerBuiltinAiLabel(): string {
  const runtimeConfig = (
    globalThis as typeof globalThis & { __MINGYU_RUNTIME_CONFIG__?: RuntimeAiConfig }
  ).__MINGYU_RUNTIME_CONFIG__;
  if (runtimeConfig?.aiProviderName) {
    return runtimeConfig.aiProviderName;
  }
  return import.meta.env.VITE_AI_PROVIDER_NAME || '内置 AI';
}

export function isServerDefaultAiEnabled(): boolean {
  return isServerBuiltinAiEnabled();
}

export function getDefaultAiSettings(): AiSettings {
  const preset = AI_PROVIDER_PRESETS[0];

  return {
    enabled: isServerDefaultAiEnabled(),
    mode: isServerBuiltinAiEnabled() ? 'builtin' : 'custom',
    providerId: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: '',
  };
}

export function normalizeAiSettings(value: unknown): AiSettings {
  const defaults = getDefaultAiSettings();
  if (!value || typeof value !== 'object') return defaults;

  const raw = value as Partial<AiSettings>;
  const preset =
    AI_PROVIDER_PRESETS.find((item) => item.id === raw.providerId) ?? AI_PROVIDER_PRESETS[0];
  const mode: AiProviderMode =
    raw.mode === 'builtin' && isServerBuiltinAiEnabled()
      ? 'builtin'
      : raw.mode === 'custom'
        ? 'custom'
        : defaults.mode;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    mode,
    providerId: typeof raw.providerId === 'string' ? raw.providerId : preset.id,
    baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl ? raw.baseUrl : preset.baseUrl,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    model: typeof raw.model === 'string' ? raw.model : '',
  };
}

export function readAiSettings(): AiSettings {
  if (typeof window === 'undefined') return getDefaultAiSettings();

  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    return normalizeAiSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return getDefaultAiSettings();
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(AI_SETTINGS_EVENT, { detail: settings }));
}

export function buildAiRequestConfig(settings: AiSettings): AiRequestConfig | undefined {
  if (!settings.enabled) return undefined;
  if (settings.mode === 'builtin') {
    return { mode: 'builtin' };
  }

  return {
    mode: 'custom',
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
  };
}
