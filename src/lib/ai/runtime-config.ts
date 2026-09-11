export type AiRuntimeEnv = {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_PROVIDER_NAME?: string;
  AI_BUILTIN_ENABLED?: string;
  AI_DEFAULT_ENABLED?: string;
  // 分析（可选）
  ANALYTICS_PROVIDER?: string;
  ANALYTICS_URL?: string;
  ANALYTICS_SITE_ID?: string;
  // 认证（可选）
  AUTH_ENABLED?: string;
};

export type AiRuntimeConfig = {
  aiBuiltinEnabled: boolean;
  aiDefaultEnabled: boolean;
  aiProviderName: string;
  analyticsProvider?: 'plausible' | 'umami' | 'ga' | 'none';
  analyticsUrl?: string;
  analyticsSiteId?: string;
  authEnabled?: boolean;
};

export function getAiRuntimeConfig(env: AiRuntimeEnv = {}): AiRuntimeConfig {
  const hasAiApiKey = Boolean(env.AI_API_KEY);
  const aiBuiltinFlag = env.AI_BUILTIN_ENABLED ?? env.AI_DEFAULT_ENABLED;
  const aiBuiltinEnabled = aiBuiltinFlag === 'true' && hasAiApiKey;

  const providerRaw = env.ANALYTICS_PROVIDER;
  const analyticsProvider =
    providerRaw === 'plausible' || providerRaw === 'umami' || providerRaw === 'ga'
      ? providerRaw
      : 'none';

  return {
    aiBuiltinEnabled,
    aiDefaultEnabled: aiBuiltinEnabled && env.AI_DEFAULT_ENABLED === 'true',
    aiProviderName: env.AI_PROVIDER_NAME || '',
    analyticsProvider,
    analyticsUrl: env.ANALYTICS_URL || undefined,
    analyticsSiteId: env.ANALYTICS_SITE_ID || undefined,
    authEnabled: env.AUTH_ENABLED === 'true',
  };
}

export function getAiRuntimeConfigScript(env: AiRuntimeEnv = {}): string {
  return `window.__TEMPOSOUL_RUNTIME_CONFIG__ = ${JSON.stringify(getAiRuntimeConfig(env))};\n`;
}

declare global {
  interface Window {
    __TEMPOSOUL_RUNTIME_CONFIG__?: AiRuntimeConfig;
  }
}
