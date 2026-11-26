import { listModels, type AiConfig } from './ai';
import { migrateV1StorageData } from './v2-ui/v1-migration';

export interface AiProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  modelHint: string;
}

export interface AiConfigProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  updatedAt: string;
}

export interface AiConnectionDiagnosis {
  ok: boolean;
  latencyMs: number;
  modelsCount?: number;
  modelFound?: boolean;
  message: string;
  hint?: string;
}

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelHint: '例如 deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelHint: '例如 gpt-4o-mini' },
  { id: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelHint: '例如 qwen-plus' },
  { id: 'moonshot', label: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', modelHint: '例如 moonshot-v1-8k' },
  { id: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', modelHint: '例如 glm-4-flash' },
  { id: 'ollama', label: '本地 Ollama', baseUrl: 'http://localhost:11434/v1', modelHint: '例如 qwen2.5' },
];

export const WEB_AI_STORAGE_KEYS = {
  enabled: 'mingyu.v2.ai.webEnabled',
  baseUrl: 'mingyu.v2.ai.baseUrl',
  apiKey: 'mingyu.v2.ai.apiKey',
  model: 'mingyu.v2.ai.model',
  chatMode: 'mingyu.v2.ai.chatMode',
  profiles: 'mingyu.v2.ai.profiles',
  activeProfileId: 'mingyu.v2.ai.activeProfileId',
} as const;

export function isWebAiEnabled(): boolean {
  try {
    migrateV1StorageData();
    return window.localStorage.getItem(WEB_AI_STORAGE_KEYS.enabled) === 'true';
  } catch {
    return false;
  }
}

export function isWebAiConfigured(cfg: AiConfig = readWebAiConfig()): boolean {
  return Boolean(cfg.baseUrl.trim() && cfg.model.trim());
}

export function getChatModeOverride(): 'true' | 'false' | null {
  try {
    const val = window.localStorage.getItem(WEB_AI_STORAGE_KEYS.chatMode);
    if (val === 'true' || val === 'false') return val;
    return null;
  } catch {
    return null;
  }
}

export function isChatModeEnabled(): boolean {
  const override = getChatModeOverride();
  if (override === 'false') return false;
  if (override === 'true') return true;
  return isWebAiEnabled() && isWebAiConfigured();
}

export function isChatAgentActive(): boolean {
  return isWebAiEnabled() && isChatModeEnabled();
}

export function setChatModeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(WEB_AI_STORAGE_KEYS.chatMode, enabled ? 'true' : 'false');
  } catch {}
  notifyWebAiChanged();
}

export function ensureChatModeDefaultOnSave(): boolean {
  const override = getChatModeOverride();
  if (override === null && isWebAiEnabled() && isWebAiConfigured()) {
    setChatModeEnabled(true);
    return true;
  }
  return isChatModeEnabled();
}

export function notifyWebAiChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mingyu:web-ai-changed'));
  }
}

export function setWebAiEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(WEB_AI_STORAGE_KEYS.enabled, enabled ? 'true' : 'false');
  } catch {}
  notifyWebAiChanged();
}

export function readWebAiConfig(): AiConfig {
  try {
    migrateV1StorageData();
    return {
      baseUrl: window.localStorage.getItem(WEB_AI_STORAGE_KEYS.baseUrl) ?? '',
      apiKey: window.localStorage.getItem(WEB_AI_STORAGE_KEYS.apiKey) ?? '',
      model: window.localStorage.getItem(WEB_AI_STORAGE_KEYS.model) ?? '',
    };
  } catch {
    return { baseUrl: '', apiKey: '', model: '' };
  }
}

export function writeWebAiConfig(patch: Partial<AiConfig>): void {
  try {
    if (patch.baseUrl !== undefined) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.baseUrl, patch.baseUrl);
    }
    if (patch.apiKey !== undefined) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.apiKey, patch.apiKey);
    }
    if (patch.model !== undefined) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.model, patch.model);
    }
  } catch {}
  notifyWebAiChanged();
}

function inferProfileName(baseUrl: string, model: string): string {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
  const preset = AI_PROVIDER_PRESETS.find((p) => p.baseUrl === cleanUrl);
  const cleanModel = model.trim();
  if (preset && cleanModel) return `${preset.label} · ${cleanModel}`;
  if (preset) return preset.label;
  if (cleanModel) return cleanModel;
  try {
    const host = new URL(cleanUrl).hostname;
    if (host) return host;
  } catch {}
  return '默认配置';
}

function persistWebAiProfiles(profiles: AiConfigProfile[], activeId: string | null): void {
  try {
    window.localStorage.setItem(WEB_AI_STORAGE_KEYS.profiles, JSON.stringify(profiles));
    if (activeId) {
      window.localStorage.setItem(WEB_AI_STORAGE_KEYS.activeProfileId, activeId);
    } else {
      window.localStorage.removeItem(WEB_AI_STORAGE_KEYS.activeProfileId);
    }
  } catch {}
}

export function loadWebAiProfiles(): AiConfigProfile[] {
  try {
    migrateV1StorageData();
    const raw = window.localStorage.getItem(WEB_AI_STORAGE_KEYS.profiles);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (item): item is AiConfigProfile =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as AiConfigProfile).id === 'string' &&
            typeof (item as AiConfigProfile).baseUrl === 'string' &&
            typeof (item as AiConfigProfile).model === 'string',
        );
        if (valid.length > 0) return valid;
      }
    }
    // 无多配置列表但已有单组旧配置时，自动平滑映射为方案 1
    const legacy = readWebAiConfig();
    if (legacy.baseUrl.trim() || legacy.model.trim()) {
      const seeded: AiConfigProfile = {
        id: 'default',
        name: inferProfileName(legacy.baseUrl, legacy.model),
        baseUrl: legacy.baseUrl,
        apiKey: legacy.apiKey ?? '',
        model: legacy.model,
        updatedAt: new Date().toISOString(),
      };
      persistWebAiProfiles([seeded], seeded.id);
      return [seeded];
    }
    return [];
  } catch {
    return [];
  }
}

export function getActiveWebAiProfileId(): string | null {
  try {
    return window.localStorage.getItem(WEB_AI_STORAGE_KEYS.activeProfileId) || null;
  } catch {
    return null;
  }
}

export function saveWebAiProfile(input: {
  id?: string;
  name?: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
}): AiConfigProfile {
  const profiles = loadWebAiProfiles();
  const cleanUrl = input.baseUrl.trim();
  const cleanModel = input.model.trim();
  const cleanKey = input.apiKey ?? '';
  const now = new Date().toISOString();
  const targetId = input.id?.trim() || `prof_${Date.now().toString(36)}`;
  const existingIdx = profiles.findIndex((p) => p.id === targetId);
  const resolvedName =
    input.name?.trim() ||
    (existingIdx >= 0 ? profiles[existingIdx].name : '') ||
    inferProfileName(cleanUrl, cleanModel);

  const nextProfile: AiConfigProfile = {
    id: targetId,
    name: resolvedName,
    baseUrl: cleanUrl,
    apiKey: cleanKey,
    model: cleanModel,
    updatedAt: now,
  };

  const nextList =
    existingIdx >= 0
      ? profiles.map((p, i) => (i === existingIdx ? nextProfile : p))
      : [...profiles, nextProfile].slice(-12);

  persistWebAiProfiles(nextList, nextProfile.id);
  writeWebAiConfig({
    baseUrl: nextProfile.baseUrl,
    apiKey: nextProfile.apiKey,
    model: nextProfile.model,
  });
  return nextProfile;
}

export function activateWebAiProfile(id: string): AiConfigProfile | null {
  const profiles = loadWebAiProfiles();
  const hit = profiles.find((p) => p.id === id);
  if (!hit) return null;
  persistWebAiProfiles(profiles, hit.id);
  writeWebAiConfig({
    baseUrl: hit.baseUrl,
    apiKey: hit.apiKey,
    model: hit.model,
  });
  return hit;
}

export function deleteWebAiProfile(id: string): AiConfigProfile[] {
  const profiles = loadWebAiProfiles().filter((p) => p.id !== id);
  const currentActive = getActiveWebAiProfileId();
  const nextActive =
    currentActive === id ? (profiles[0]?.id ?? null) : currentActive;
  persistWebAiProfiles(profiles, nextActive);
  if (currentActive === id && profiles[0]) {
    writeWebAiConfig({
      baseUrl: profiles[0].baseUrl,
      apiKey: profiles[0].apiKey,
      model: profiles[0].model,
    });
  } else {
    notifyWebAiChanged();
  }
  return profiles;
}

export async function diagnoseWebAiConnection(
  cfg: Pick<AiConfig, 'baseUrl' | 'apiKey' | 'model'>,
  fetchImpl: typeof fetch = fetch,
): Promise<AiConnectionDiagnosis> {
  const cleanUrl = cfg.baseUrl.trim();
  const cleanModel = cfg.model.trim();
  if (!cleanUrl) {
    return { ok: false, latencyMs: 0, message: '请先填写接口地址（例如 https://api.deepseek.com/v1）。' };
  }
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, latencyMs: 0, message: '接口地址格式不对，必须以 http:// 或 https:// 开头。' };
    }
  } catch {
    return { ok: false, latencyMs: 0, message: '接口地址格式无效，请检查是否漏了 https:// 或有多余空格。' };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const models = await listModels(
      { baseUrl: cleanUrl, apiKey: cfg.apiKey },
      fetchImpl,
      controller.signal,
    );
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const modelFound = cleanModel ? models.includes(cleanModel) : undefined;
    if (models.length > 0 && cleanModel && modelFound) {
      return {
        ok: true,
        latencyMs,
        modelsCount: models.length,
        modelFound: true,
        message: `连通正常（耗时 ${latencyMs}ms，发现 ${models.length} 个可用模型，已确认包含「${cleanModel}」）`,
      };
    }
    if (models.length > 0 && cleanModel && !modelFound) {
      return {
        ok: true,
        latencyMs,
        modelsCount: models.length,
        modelFound: false,
        message: `接口已连通（耗时 ${latencyMs}ms，共 ${models.length} 个模型），但列表里未显式出现「${cleanModel}」`,
        hint: '部分中转站会隐藏或别名映射模型名；如果确认名称无误，直接保存使用即可。',
      };
    }
    return {
      ok: true,
      latencyMs,
      modelsCount: models.length,
      message: `接口已连通（耗时 ${latencyMs}ms${models.length ? `，返回 ${models.length} 个模型` : ''}）`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - startedAt);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        latencyMs,
        message: '连接超时（超过 12 秒无响应）。',
        hint: '请检查当前网络、代理设置，或确认该服务商地址是否可从本机访问。',
      };
    }
    const raw = err instanceof Error ? err.message : '';
    const lower = raw.toLowerCase();
    if (lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('networkerror')) {
      return {
        ok: false,
        latencyMs,
        message: '浏览器无法直连该接口（跨域限制或网络不可达）。',
        hint: '请换用支持浏览器直连的服务商/中转站，或直接用结果页「复制提示词」免配置粘贴给任意 AI。',
      };
    }
    if (raw.includes('401')) {
      return {
        ok: false,
        latencyMs,
        message: '密钥认证未通过（401）：API 密钥无效或已失效。',
        hint: '请核对密钥是否复制完整（前后不能有空格），或在服务商后台重新生成密钥。',
      };
    }
    if (raw.includes('402')) {
      return {
        ok: false,
        latencyMs,
        message: '账户余额不足（402）：请前往对应服务商后台充值或切换有额度的密钥。',
      };
    }
    if (raw.includes('403')) {
      return {
        ok: false,
        latencyMs,
        message: '无访问权限（403）：密钥可能缺少模型调用权限，或当前地区受限。',
      };
    }
    if (raw.includes('404')) {
      return {
        ok: false,
        latencyMs,
        message: '接口路径不存在（404）：请检查地址末尾是否漏写了 /v1。',
      };
    }
    if (raw.includes('429')) {
      return {
        ok: false,
        latencyMs,
        message: '请求频率超限或配额已用尽（429）：请稍等片刻或更换密钥/模型。',
      };
    }
    return {
      ok: false,
      latencyMs,
      message: raw || '连接检测失败，请检查接口地址、密钥与网络。',
    };
  } finally {
    clearTimeout(timer);
  }
}
