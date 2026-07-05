import type { AiEnv } from './proxy';

export type AiRuntimeEnv = Pick<
  AiEnv,
  'AI_API_KEY' | 'AI_PROVIDER_NAME' | 'AI_BUILTIN_ENABLED' | 'AI_DEFAULT_ENABLED'
>;

export type AiRuntimeConfig = {
  aiBuiltinEnabled: boolean;
  aiDefaultEnabled: boolean;
  aiProviderName: string;
};

export function getAiRuntimeConfig(env: AiRuntimeEnv = {}): AiRuntimeConfig {
  const hasAiApiKey = Boolean(env.AI_API_KEY);
  const aiBuiltinFlag = env.AI_BUILTIN_ENABLED ?? env.AI_DEFAULT_ENABLED;
  const aiBuiltinEnabled = aiBuiltinFlag === 'true' && hasAiApiKey;

  return {
    aiBuiltinEnabled,
    aiDefaultEnabled: aiBuiltinEnabled && env.AI_DEFAULT_ENABLED === 'true',
    aiProviderName: env.AI_PROVIDER_NAME || '',
  };
}

export function getAiRuntimeConfigScript(env: AiRuntimeEnv = {}): string {
  return `window.__MINGYU_RUNTIME_CONFIG__ = ${JSON.stringify(getAiRuntimeConfig(env))};\n`;
}
