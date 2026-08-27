import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { AiRequestConfig } from './settings';

type DirectChatMessage = { role: 'user' | 'assistant'; content: string };

interface AndroidDirectAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AndroidDirectAiEvent {
  requestId: string;
  type: 'chunk' | 'done' | 'error';
  content?: string;
  message?: string;
}

interface AndroidDirectAiPlugin {
  streamChat(options: {
    requestId: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    messages: DirectChatMessage[];
  }): Promise<void>;
  cancelStream(options: { requestId: string }): Promise<void>;
  fetchModels(options: { apiKey: string; baseUrl: string }): Promise<{ models: string[] }>;
  addListener(
    eventName: 'streamEvent',
    listener: (event: AndroidDirectAiEvent) => void,
  ): Promise<PluginListenerHandle>;
}

interface DirectStreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

const AndroidDirectAi = registerPlugin<AndroidDirectAiPlugin>('AndroidDirectAi');
const BLOCKED_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal']);

export function isAndroidDirectCustomAi(
  aiConfig: AiRequestConfig | undefined,
  androidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
): aiConfig is AiRequestConfig & { mode: 'custom' } {
  return androidNative && aiConfig?.mode === 'custom';
}

export function normalizeAndroidDirectAiConfig(
  aiConfig: AiRequestConfig,
  requireModel = true,
): AndroidDirectAiConfig {
  const apiKey = aiConfig.apiKey?.trim() ?? '';
  const rawBaseUrl = aiConfig.baseUrl?.trim() ?? '';
  const model = aiConfig.model?.trim() ?? '';
  if (!apiKey || !rawBaseUrl || (requireModel && !model)) {
    throw new Error('请先填写自定义 AI 的接口、密钥和模型。');
  }

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error('自定义 AI 接口地址必须是合法的 HTTPS 公网地址。');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    isUnsafeHost(url.hostname)
  ) {
    throw new Error('自定义 AI 接口地址必须使用 HTTPS 公网地址，不能指向本机或内网。');
  }

  return {
    apiKey,
    baseUrl: url.href.replace(/\/+$/, ''),
    model,
  };
}

export async function streamAndroidDirectAi(
  messages: DirectChatMessage[],
  aiConfig: AiRequestConfig,
  callbacks: DirectStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const config = normalizeAndroidDirectAiConfig(aiConfig);
  const requestId = createRequestId();
  let receivedContent = false;
  let settled = false;
  let listener: PluginListenerHandle | null = null;
  let settleCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    settleCompletion = resolve;
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', handleAbort);
    if (listener) void listener.remove().catch(() => undefined);
    settleCompletion?.();
  };

  const handleAbort = () => {
    void AndroidDirectAi.cancelStream({ requestId }).catch(() => undefined);
    finish();
  };

  listener = await AndroidDirectAi.addListener('streamEvent', (event) => {
    if (settled || event.requestId !== requestId) return;
    if (event.type === 'chunk') {
      if (event.content) {
        receivedContent = true;
        callbacks.onChunk(event.content);
      }
      return;
    }
    if (event.type === 'error') {
      callbacks.onError(event.message || '自定义 AI 请求失败，请稍后重试。');
      finish();
      return;
    }
    if (!receivedContent) {
      callbacks.onError('AI 未返回任何内容，请重新生成。');
    } else {
      callbacks.onDone();
    }
    finish();
  });

  if (signal?.aborted) {
    handleAbort();
    return completion;
  }
  signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    await AndroidDirectAi.streamChat({ requestId, ...config, messages });
  } catch (error) {
    callbacks.onError(formatNativeError(error, '无法从当前设备直连自定义 AI。'));
    finish();
  }

  return completion;
}

export async function fetchAndroidDirectAiModels(aiConfig: AiRequestConfig): Promise<string[]> {
  const config = normalizeAndroidDirectAiConfig(aiConfig, false);
  try {
    const response = await AndroidDirectAi.fetchModels(config);
    return Array.isArray(response.models)
      ? response.models.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        )
      : [];
  } catch (error) {
    throw new Error(formatNativeError(error, '无法从当前设备直连获取模型。'), {
      cause: error,
    });
  }
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatNativeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

function isUnsafeHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '');
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost')) return true;
  if (host.endsWith('.internal') || host.includes(':')) return true;

  const ipv4 = parseIpv4Address(host);
  if (ipv4) return isUnsafeIpv4Address(ipv4);
  return !host.includes('.');
}

function parseIpv4Address(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const parsed = parts.map((part) => {
    if (!/^\d+$/.test(part)) return Number.NaN;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : Number.NaN;
  });
  return parsed.every(Number.isFinite) ? (parsed as [number, number, number, number]) : null;
}

function isUnsafeIpv4Address([a, b]: [number, number, number, number]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}
