import { APP_NAME } from './brand-config';

export type ExternalAiShareTarget = 'doubao' | 'deepseek';

interface ExternalAiTargetConfig {
  appUrl: string;
  label: string;
}

export const EXTERNAL_AI_TARGETS: Record<ExternalAiShareTarget, ExternalAiTargetConfig> = {
  doubao: {
    appUrl: 'doubao://',
    label: '豆包',
  },
  deepseek: {
    appUrl: 'dpsk://chat/new',
    label: 'DeepSeek',
  },
};

export interface ExternalAiClientConfig {
  id: string;
  label: string;
  /** APP 原生唤起链接（优先唤起，如 doubao://、dpsk://chat/new） */
  appUrl?: string;
  /** 网页链接（未安装 APP 或无 APP 链接时打开，如 https://...） */
  webUrl?: string;
  /** 兼容字段：首选跳转地址（优先 appUrl，其次 webUrl） */
  url: string;
  enabled: boolean;
  builtIn?: boolean;
}

export interface ExternalAiLaunchPlan {
  primaryUrl: string;
  primaryKind: 'app' | 'web';
  fallbackWebUrl?: string;
}

export interface ExternalAiQuickJumpSettings {
  enabled: boolean;
  clients: ExternalAiClientConfig[];
}

export const EXTERNAL_AI_JUMP_STORAGE_KEY = 'mingyu.v2.externalAiJump.v1';
export const EXTERNAL_AI_JUMP_CHANGED_EVENT = 'mingyu:external-ai-jump-changed';

export const DEFAULT_EXTERNAL_AI_CLIENTS: readonly ExternalAiClientConfig[] = [
  {
    id: 'doubao',
    label: '豆包',
    appUrl: 'doubao://',
    webUrl: 'https://www.doubao.com/chat/',
    url: 'doubao://',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    appUrl: 'dpsk://chat/new',
    webUrl: 'https://chat.deepseek.com/',
    url: 'dpsk://chat/new',
    enabled: true,
    builtIn: true,
  },
  {
    id: 'yuanbao',
    label: '腾讯元宝',
    appUrl: 'yuanbao://',
    webUrl: 'https://yuanbao.tencent.com/',
    url: 'yuanbao://',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'kimi',
    label: 'Kimi',
    appUrl: 'kimi://',
    webUrl: 'https://kimi.moonshot.cn/',
    url: 'kimi://',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'qwen',
    label: '通义千问',
    appUrl: 'tongyi://',
    webUrl: 'https://tongyi.aliyun.com/qianwen/',
    url: 'tongyi://',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    appUrl: 'chatgpt://',
    webUrl: 'https://chatgpt.com/',
    url: 'chatgpt://',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'claude',
    label: 'Claude',
    appUrl: 'claude://',
    webUrl: 'https://claude.ai/new',
    url: 'claude://',
    enabled: false,
    builtIn: true,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    appUrl: 'googlegemini://',
    webUrl: 'https://gemini.google.com/app',
    url: 'googlegemini://',
    enabled: false,
    builtIn: true,
  },
];

const UNSAFE_SCHEME_RE = /^(javascript|data|vbscript|file):/i;
const VALID_SCHEME_RE = /^[a-z][a-z0-9+.-]{1,23}:\/\//i;

export function isSafeExternalClientUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\s<>"'`\\]/.test(trimmed)) return false;
  if (UNSAFE_SCHEME_RE.test(trimmed)) return false;
  if (!VALID_SCHEME_RE.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }
  return true;
}

export function isSafeExternalWebUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  return /^https?:\/\//i.test(trimmed) && isSafeExternalClientUrl(trimmed);
}

export function isSafeExternalAppUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  return !/^https?:\/\//i.test(trimmed) && isSafeExternalClientUrl(trimmed);
}

export function createDefaultExternalAiQuickJumpSettings(): ExternalAiQuickJumpSettings {
  return {
    enabled: true,
    clients: DEFAULT_EXTERNAL_AI_CLIENTS.map((item) => ({ ...item })),
  };
}

function normalizeClientEntry(
  raw: unknown,
  fallbackBuiltIn?: ExternalAiClientConfig,
): ExternalAiClientConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : fallbackBuiltIn?.id ?? '';
  const label =
    typeof obj.label === 'string' && obj.label.trim()
      ? obj.label.trim().slice(0, 24)
      : fallbackBuiltIn?.label ?? '';
  if (!id || !label) return null;

  const hasExplicitAppUrl = typeof obj.appUrl === 'string';
  const hasExplicitWebUrl = typeof obj.webUrl === 'string';
  const legacyUrl = typeof obj.url === 'string' ? obj.url.trim() : '';

  let appUrl = '';
  let webUrl = '';

  if (hasExplicitAppUrl || hasExplicitWebUrl) {
    const rawApp = typeof obj.appUrl === 'string' ? obj.appUrl.trim() : '';
    const rawWeb = typeof obj.webUrl === 'string' ? obj.webUrl.trim() : '';
    if (rawApp && !isSafeExternalAppUrl(rawApp)) return null;
    if (rawWeb && !isSafeExternalWebUrl(rawWeb)) return null;
    appUrl = rawApp;
    webUrl = rawWeb;
    if (!appUrl && !hasExplicitAppUrl && isSafeExternalAppUrl(legacyUrl)) {
      appUrl = legacyUrl;
    }
    if (!webUrl && !hasExplicitWebUrl && isSafeExternalWebUrl(legacyUrl)) {
      webUrl = legacyUrl;
    }
  } else {
    // 兼容旧版单 url 配置并自动补齐内置客户端双链接
    const candidate = legacyUrl || fallbackBuiltIn?.url || '';
    if (!candidate) return null;
    if (isSafeExternalAppUrl(candidate)) {
      appUrl = candidate;
      webUrl =
        fallbackBuiltIn?.webUrl && isSafeExternalWebUrl(fallbackBuiltIn.webUrl)
          ? fallbackBuiltIn.webUrl
          : '';
    } else if (isSafeExternalWebUrl(candidate)) {
      webUrl = candidate;
      appUrl =
        fallbackBuiltIn?.appUrl && isSafeExternalAppUrl(fallbackBuiltIn.appUrl)
          ? fallbackBuiltIn.appUrl
          : '';
    } else {
      return null;
    }
  }

  const preferredUrl = appUrl || webUrl;
  if (!preferredUrl) return null;

  return {
    id,
    label,
    ...(appUrl ? { appUrl } : {}),
    ...(webUrl ? { webUrl } : {}),
    url: preferredUrl,
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : Boolean(fallbackBuiltIn?.enabled),
    ...(fallbackBuiltIn || obj.builtIn === true ? { builtIn: true } : {}),
  };
}

export function loadExternalAiQuickJumpSettings(
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): ExternalAiQuickJumpSettings {
  const defaults = createDefaultExternalAiQuickJumpSettings();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(EXTERNAL_AI_JUMP_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ExternalAiQuickJumpSettings>;
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : true;
    const rawClients: unknown[] = Array.isArray(parsed.clients) ? parsed.clients : [];
    const byId = new Map<string, Record<string, unknown>>();
    const customClients: ExternalAiClientConfig[] = [];
    const builtInIds = new Set(DEFAULT_EXTERNAL_AI_CLIENTS.map((item) => item.id));

    for (const item of rawClients) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const id = typeof rec.id === 'string' ? rec.id.trim() : '';
      if (!id) continue;
      if (builtInIds.has(id)) {
        byId.set(id, rec);
      } else {
        const normalized = normalizeClientEntry(rec);
        if (normalized && !customClients.some((c) => c.id === normalized.id)) {
          customClients.push(normalized);
        }
      }
    }

    const mergedBuiltIns = DEFAULT_EXTERNAL_AI_CLIENTS.map((preset) => {
      const saved = byId.get(preset.id);
      return saved ? (normalizeClientEntry(saved, preset) ?? { ...preset }) : { ...preset };
    });

    return {
      enabled,
      clients: [...mergedBuiltIns, ...customClients],
    };
  } catch {
    return defaults;
  }
}

export function saveExternalAiQuickJumpSettings(
  settings: ExternalAiQuickJumpSettings,
  storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined,
): ExternalAiQuickJumpSettings {
  const sanitized: ExternalAiQuickJumpSettings = {
    enabled: Boolean(settings.enabled),
    clients: settings.clients
      .map((item) => {
        const preset = DEFAULT_EXTERNAL_AI_CLIENTS.find((d) => d.id === item.id);
        return normalizeClientEntry(item, preset);
      })
      .filter((item): item is ExternalAiClientConfig => item !== null),
  };
  if (storage) {
    try {
      storage.setItem(EXTERNAL_AI_JUMP_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {}
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent(EXTERNAL_AI_JUMP_JUMP_OR_EVENT_COMPAT(), { detail: sanitized }),
    );
  }
  return sanitized;
}

function EXTERNAL_AI_JUMP_JUMP_OR_EVENT_COMPAT(): string {
  return EXTERNAL_AI_JUMP_CHANGED_EVENT;
}

export function resolveExternalAiLaunchPlan(
  client: Pick<ExternalAiClientConfig, 'appUrl' | 'webUrl' | 'url'>,
): ExternalAiLaunchPlan | null {
  const explicitApp = typeof client.appUrl === 'string' ? client.appUrl.trim() : '';
  const explicitWeb = typeof client.webUrl === 'string' ? client.webUrl.trim() : '';
  const legacyUrl = typeof client.url === 'string' ? client.url.trim() : '';

  const validApp =
    (explicitApp && isSafeExternalAppUrl(explicitApp) ? explicitApp : '') ||
    (!explicitApp && legacyUrl && isSafeExternalAppUrl(legacyUrl) ? legacyUrl : '');
  const validWeb =
    (explicitWeb && isSafeExternalWebUrl(explicitWeb) ? explicitWeb : '') ||
    (!explicitWeb && legacyUrl && isSafeExternalWebUrl(legacyUrl) ? legacyUrl : '');

  if (validApp) {
    return {
      primaryUrl: validApp,
      primaryKind: 'app',
      ...(validWeb ? { fallbackWebUrl: validWeb } : {}),
    };
  }
  if (validWeb) {
    return {
      primaryUrl: validWeb,
      primaryKind: 'web',
    };
  }
  return null;
}

export function getVisibleExternalAiClients(
  settings: ExternalAiQuickJumpSettings = loadExternalAiQuickJumpSettings(),
): ExternalAiClientConfig[] {
  if (!settings.enabled) return [];
  return settings.clients.filter((client) => client.enabled && Boolean(resolveExternalAiLaunchPlan(client)));
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export function isIosDevice(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function buildExternalAiShareData(text: string): ShareData {
  return {
    title: `${APP_NAME}解读提示词`,
    text,
  };
}

export function getExternalAiAppUrl(target: ExternalAiShareTarget): string {
  return EXTERNAL_AI_TARGETS[target].appUrl;
}

export async function copyPromptText(text: string): Promise<boolean> {
  const clean = text.trim();
  if (!clean) return false;
  try {
    await navigator.clipboard.writeText(clean);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = clean;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function launchExternalAiClient(
  client: Pick<ExternalAiClientConfig, 'appUrl' | 'webUrl' | 'url'>,
  promptText: string,
): Promise<{ copied: boolean; mode: 'app' | 'web' | 'none' }> {
  const copied = await copyPromptText(promptText);
  const plan = resolveExternalAiLaunchPlan(client);
  if (!copied || typeof window === 'undefined' || !plan) {
    return { copied, mode: plan ? plan.primaryKind : 'none' };
  }

  if (plan.primaryKind === 'web') {
    window.open(plan.primaryUrl, '_blank', 'noopener,noreferrer');
    return { copied, mode: 'web' };
  }

  if (plan.fallbackWebUrl && typeof document !== 'undefined') {
    const fallbackUrl = plan.fallbackWebUrl;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
    const touch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;
    const isMobile = isAndroidUserAgent(ua) || isIosDevice(ua, platform, touch);
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onAppHandled);
      window.removeEventListener('blur', onAppHandled);
    };

    const onAppHandled = () => {
      settled = true;
      cleanup();
    };

    const onVisibilityChange = () => {
      if (document.hidden) onAppHandled();
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      cleanup();
      if (!document.hidden) {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      }
    }, isMobile ? 1100 : 900);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onAppHandled, { once: true });
    window.addEventListener('blur', onAppHandled, { once: true });
  }

  window.location.href = plan.primaryUrl;
  return { copied, mode: 'app' };
}

export async function launchExternalAiApp(
  target: ExternalAiShareTarget,
  promptText: string,
): Promise<{ copied: boolean }> {
  const settings = loadExternalAiQuickJumpSettings();
  const matched = settings.clients.find((c) => c.id === target);
  if (matched) {
    return launchExternalAiClient(matched, promptText);
  }
  const copied = await copyPromptText(promptText);
  if (copied && typeof window !== 'undefined') {
    window.location.href = getExternalAiAppUrl(target);
  }
  return { copied };
}

export async function sharePromptViaSystem(promptText: string): Promise<'shared' | 'copied' | 'failed'> {
  const clean = promptText.trim();
  if (!clean) return 'failed';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(buildExternalAiShareData(clean));
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'shared';
      }
    }
  }
  return (await copyPromptText(clean)) ? 'copied' : 'failed';
}
