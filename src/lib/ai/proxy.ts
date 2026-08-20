/**
 * AI 解析代理 — 共享逻辑
 *
 * 被 catch-all handler 和独立 Pages Function 共用。
 * 接收提示词或对话消息，调用 OpenAI 兼容的 Chat Completions API 流式解析，返回 SSE Response。
 * 支持任何兼容接口（DeepSeek、千问、豆包、Groq、OpenAI 等）。
 */

import {
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  readLimitedRequestText,
  RequestBodyTooLargeError,
} from '../http/request-body';
import { consumeBuiltinAiRateLimit, type AiRateLimitEnv } from './rate-limit';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const MAX_PROMPT_LENGTH = 50_000;
const MAX_MESSAGES = 30;
const UPSTREAM_FETCH_TIMEOUT_MS = 25_000;
const UPSTREAM_STREAM_IDLE_TIMEOUT_MS = 30_000;
const UPSTREAM_STREAM_TOTAL_TIMEOUT_MS = 95_000;
const UPSTREAM_RETRY_DELAYS_MS = [500, 1500];
const BLOCKED_CUSTOM_AI_HOSTS = new Set(['localhost', 'metadata', 'metadata.google.internal']);

const SSE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export type AiEnv = AiRateLimitEnv & {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_PROVIDER_NAME?: string;
  AI_BUILTIN_ENABLED?: string;
  AI_DEFAULT_ENABLED?: string;
  AI_STREAM_IDLE_TIMEOUT_MS?: string;
  AI_STREAM_TOTAL_TIMEOUT_MS?: string;
  AI_TRUST_PROXY?: string;
};

export type AiRuntime = {
  resolveHostname?: (hostname: string) => Promise<string[]>;
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
  now?: () => number;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type AiProviderConfig = {
  mode?: 'builtin' | 'custom';
  apiKey?: unknown;
  baseUrl?: unknown;
  model?: unknown;
};
type UpstreamFetchResult =
  | {
      ok: true;
      response: Response;
      attempts: number;
      controller: AbortController;
      cleanup: () => void;
    }
  | { ok: false; error: Response };

type ResolvedAiProvider = {
  mode: 'builtin' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
};

const SYSTEM_PROMPT_SINGLE = '请根据用户提供的排盘资料和问题直接解读。';

const SYSTEM_PROMPT_CHAT = '用户的第一条消息是本次排盘资料和问题。请继续围绕这份资料解读。';

/**
 * 处理 AI 解析请求，返回 SSE Response。
 * 如果出错则返回 JSON error Response。
 *
 * 请求体支持两种格式：
 * 1. { prompt: string } — 单轮解析（向后兼容）
 * 2. { messages: Array<{role, content}> } — 多轮对话
 */
export async function handleAiAnalyze(
  request: Request,
  env?: AiEnv,
  runtime: AiRuntime = {},
): Promise<Response> {
  let body: { prompt?: unknown; messages?: unknown; aiConfig?: AiProviderConfig };
  try {
    body = parseJsonObject(await readLimitedRequestText(request, DEFAULT_MAX_REQUEST_BODY_BYTES));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return aiJsonError(
        413,
        'REQUEST_BODY_TOO_LARGE',
        `请求体不能超过 ${DEFAULT_MAX_REQUEST_BODY_BYTES} 字节。`,
      );
    }
    return aiJsonError(400, 'BAD_REQUEST', '请求体必须是合法 JSON。');
  }

  const provider = resolveAiProvider(body.aiConfig, env);
  if ('error' in provider) {
    return provider.error;
  }

  // 解析对话消息：优先使用 messages 数组，否则回退到 prompt 字符串
  let chatMessages: ChatMessage[];
  let isMultiTurn = false;

  if (
    Array.isArray(body.messages) &&
    body.messages.length > 0 &&
    body.messages.every(
      (m) =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    )
  ) {
    if (body.messages.length > MAX_MESSAGES) {
      return aiJsonError(
        400,
        'TOO_MANY_MESSAGES',
        `一次最多发送 ${MAX_MESSAGES} 条消息，请拆分为多次请求。`,
      );
    }

    chatMessages = (body.messages as ChatMessage[])
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);
    isMultiTurn = chatMessages.length > 1;
  } else {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return aiJsonError(400, 'BAD_REQUEST', 'prompt 不能为空。');
    }
    chatMessages = [{ role: 'user' as const, content: prompt }];
  }

  if (chatMessages.length === 0) {
    return aiJsonError(400, 'BAD_REQUEST', '消息内容不能为空。');
  }

  const totalLength = chatMessages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalLength > MAX_PROMPT_LENGTH) {
    return aiJsonError(400, 'PROMPT_TOO_LONG', `提示词不能超过 ${MAX_PROMPT_LENGTH} 字符。`);
  }

  const providerSafetyError = await validateCustomAiProvider(provider, runtime, request.signal);
  if (providerSafetyError) return providerSafetyError;

  const rateLimitError = enforceBuiltinAiRateLimit(request, provider, env, runtime);
  if (rateLimitError) return rateLimitError;

  const systemPrompt = isMultiTurn ? SYSTEM_PROMPT_CHAT : SYSTEM_PROMPT_SINGLE;

  const endpoint = `${provider.baseUrl}/chat/completions`;
  const upstreamResult = await fetchUpstreamWithRetry(
    endpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...chatMessages,
        ],
      }),
      signal: request.signal,
    },
    runtime,
  );
  if (upstreamResult.ok === false) {
    return upstreamResult.error;
  }

  const { response: upstream, attempts, controller, cleanup } = upstreamResult;
  if (!upstream.ok) {
    try {
      const errText = await readUpstreamText(upstream, controller, runtime, env);
      return buildUpstreamErrorResponse(upstream.status, errText, attempts);
    } catch (error) {
      return buildUpstreamReadError(error, attempts);
    } finally {
      controller.abort();
      cleanup();
    }
  }

  if (!upstream.body) {
    controller.abort();
    cleanup();
    return aiJsonError(502, 'AI_UPSTREAM_EMPTY_RESPONSE', 'AI 服务没有返回可读取的内容。', {
      attempts,
      retryable: true,
    });
  }

  // 将 upstream SSE 流转换为前端可读的 SSE 流
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const streamTimeouts = getStreamTimeouts(runtime, env);
    const streamDeadline = Date.now() + streamTimeouts.totalTimeoutMs;

    try {
      while (true) {
        const { done, value } = await readStreamChunk(
          reader,
          controller,
          streamTimeouts.idleTimeoutMs,
          streamDeadline,
        );
        if (done) break;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              const payload = JSON.stringify({ content: delta });
              await writer.write(encoder.encode(`data: ${payload}\n\n`));
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }

      // 流结束，flush decoder 并处理残留 buffer
      buffer += decoder.decode();
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta) {
                const payload = JSON.stringify({ content: delta });
                await writer.write(encoder.encode(`data: ${payload}\n\n`));
              }
            } catch {
              // 忽略
            }
          }
        }
      }
    } catch (err) {
      const timedOut = err instanceof UpstreamStreamTimeoutError;
      const payload = JSON.stringify({
        error: {
          code: timedOut ? 'AI_UPSTREAM_TIMEOUT' : 'AI_UPSTREAM_STREAM_ERROR',
          message: timedOut
            ? 'AI 服务长时间没有继续响应，请稍后重试，或在设置里改用自己的接口。'
            : 'AI 服务响应中断，请稍后重试，或在设置里改用自己的接口。',
          attempts,
          retryable: true,
          detail: err instanceof Error ? err.message : undefined,
        },
      });
      try {
        await writer.write(encoder.encode(`data: ${payload}\n\n`));
      } catch {
        // writer 已关闭或出错，静默忽略
      }
    } finally {
      controller.abort();
      cleanup();
      void reader.cancel().catch(() => undefined);
      try {
        await writer.close();
      } catch {
        // writer 已关闭，静默忽略
      }
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

export async function handleAiModels(
  request: Request,
  env?: AiEnv,
  runtime: AiRuntime = {},
): Promise<Response> {
  let body: { aiConfig?: AiProviderConfig };
  try {
    body = parseJsonObject(await readLimitedRequestText(request, DEFAULT_MAX_REQUEST_BODY_BYTES));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return aiJsonError(
        413,
        'REQUEST_BODY_TOO_LARGE',
        `请求体不能超过 ${DEFAULT_MAX_REQUEST_BODY_BYTES} 字节。`,
      );
    }
    return aiJsonError(400, 'BAD_REQUEST', '请求体必须是合法 JSON。');
  }

  const provider = resolveAiProvider(body.aiConfig, env, { requireModel: false });
  if ('error' in provider) {
    return provider.error;
  }

  const providerSafetyError = await validateCustomAiProvider(provider, runtime, request.signal);
  if (providerSafetyError) return providerSafetyError;

  const rateLimitError = enforceBuiltinAiRateLimit(request, provider, env, runtime);
  if (rateLimitError) return rateLimitError;

  const upstreamResult = await fetchUpstreamWithRetry(
    `${provider.baseUrl}/models`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: request.signal,
    },
    runtime,
  );
  if (upstreamResult.ok === false) {
    return upstreamResult.error;
  }

  const { response: upstream, attempts, controller, cleanup } = upstreamResult;
  let rawBody: string;
  try {
    rawBody = await readUpstreamText(upstream, controller, runtime, env);
  } catch (error) {
    return buildUpstreamReadError(error, attempts, '获取模型失败：');
  } finally {
    controller.abort();
    cleanup();
  }

  if (!upstream.ok) {
    return buildUpstreamErrorResponse(upstream.status, rawBody, attempts, '获取模型失败：');
  }

  const data = parseJsonObjectOrNull(rawBody) as { data?: unknown } | null;
  const modelItems = Array.isArray(data?.data) ? data.data : [];
  const models = modelItems
    .map((item: unknown) => {
      if (item && typeof item === 'object' && 'id' in item) {
        return (item as { id?: unknown }).id;
      }
      return null;
    })
    .filter((item: unknown): item is string => typeof item === 'string' && item.length > 0);

  return new Response(JSON.stringify({ ok: true, models }), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function resolveAiProvider(
  config: AiProviderConfig | undefined,
  env?: AiEnv,
  options: { requireModel?: boolean } = {},
): ResolvedAiProvider | { error: Response } {
  const mode = config?.mode === 'custom' ? 'custom' : 'builtin';
  const requireModel = options.requireModel ?? true;

  if (mode === 'custom') {
    const apiKey = typeof config?.apiKey === 'string' ? config.apiKey.trim() : '';
    const rawBaseUrl = typeof config?.baseUrl === 'string' ? config.baseUrl.trim() : '';
    const model = typeof config?.model === 'string' ? config.model.trim() : '';

    if (!apiKey || !rawBaseUrl || (requireModel && !model)) {
      return {
        error: aiJsonError(
          400,
          'AI_CUSTOM_CONFIG_REQUIRED',
          '请先填写自定义 AI 的接口、密钥和模型。',
        ),
      };
    }

    const baseUrlResult = normalizeCustomAiBaseUrl(rawBaseUrl);
    if ('error' in baseUrlResult) {
      return baseUrlResult;
    }

    return { mode: 'custom', apiKey, baseUrl: baseUrlResult.baseUrl, model };
  }

  if (!isBuiltinAiEnabled(env)) {
    return {
      error: aiJsonError(
        403,
        'AI_SERVER_NOT_ENABLED',
        '服务端 AI 未启用，请在设置里改用自己的 AI 接口。',
      ),
    };
  }

  const apiKey = env?.AI_API_KEY ?? '';
  const baseUrl = (env?.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = env?.AI_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    return {
      error: aiJsonError(500, 'AI_API_KEY 未配置', '服务端缺少 AI 密钥，请联系管理员。'),
    };
  }

  return { mode: 'builtin', apiKey, baseUrl, model };
}

function isBuiltinAiEnabled(env?: AiEnv): boolean {
  const enabled = env?.AI_BUILTIN_ENABLED ?? env?.AI_DEFAULT_ENABLED;
  return enabled === 'true';
}

function enforceBuiltinAiRateLimit(
  request: Request,
  provider: ResolvedAiProvider,
  env: AiEnv | undefined,
  runtime: AiRuntime,
): Response | null {
  if (provider.mode !== 'builtin') return null;
  const result = consumeBuiltinAiRateLimit(request, env, runtime.now?.() ?? Date.now());
  if (!result || result.allowed === true) return null;

  return aiJsonError(
    429,
    'AI_RATE_LIMITED',
    `内置 AI 请求过于频繁，请在 ${result.retryAfterSeconds} 秒后重试，或在设置里改用自己的接口。`,
    {
      retryable: true,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      'Retry-After': String(result.retryAfterSeconds),
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    },
  );
}

async function validateCustomAiProvider(
  provider: ResolvedAiProvider,
  runtime: AiRuntime,
  signal?: AbortSignal,
): Promise<Response | null> {
  if (provider.mode !== 'custom') return null;

  const hostname = new URL(provider.baseUrl).hostname.replace(/^\[(.*)\]$/, '$1');
  if (parseIpv4Address(hostname) || hostname.includes(':')) return null;

  try {
    const addresses = runtime.resolveHostname
      ? await runtime.resolveHostname(hostname)
      : await resolveHostnameWithDnsOverHttps(hostname, signal);
    if (!addresses.length || addresses.some((address) => isUnsafeCustomAiHost(address))) {
      return aiJsonError(
        400,
        'AI_CUSTOM_BASE_URL_UNSAFE',
        '自定义 AI 接口地址必须解析到公开互联网地址，不能指向本机、内网或特殊用途地址。',
      );
    }
  } catch {
    return aiJsonError(
      400,
      'AI_CUSTOM_BASE_URL_DNS_FAILED',
      '无法确认自定义 AI 接口的公网地址，请检查域名是否可以正常解析。',
    );
  }

  return null;
}

async function resolveHostnameWithDnsOverHttps(
  hostname: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const query = async (type: 'A' | 'AAAA') => {
    const url = new URL('https://cloudflare-dns.com/dns-query');
    url.searchParams.set('name', hostname);
    url.searchParams.set('type', type);
    const response = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error(`DNS 查询失败：${response.status}`);
    const data = (await response.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number; data?: string }>;
    };
    if (data.Status !== 0) return [];
    return (data.Answer ?? [])
      .filter((answer) => answer.type === 1 || answer.type === 28)
      .map((answer) => answer.data?.trim() ?? '')
      .filter(Boolean);
  };

  const results = await Promise.allSettled([query('A'), query('AAAA')]);
  const addresses = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  if (!addresses.length && results.every((result) => result.status === 'rejected')) {
    throw new Error('DNS 查询失败');
  }
  return [...new Set(addresses)];
}

function normalizeCustomAiBaseUrl(value: string): { baseUrl: string } | { error: Response } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      error: aiJsonError(
        400,
        'AI_CUSTOM_BASE_URL_INVALID',
        '自定义 AI 接口地址必须是合法的 HTTPS 公网地址。',
      ),
    };
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    isUnsafeCustomAiHost(url.hostname)
  ) {
    return {
      error: aiJsonError(
        400,
        'AI_CUSTOM_BASE_URL_UNSAFE',
        '自定义 AI 接口地址必须使用 HTTPS 公网地址，不能指向本机、内网或云元数据地址。',
      ),
    };
  }

  return { baseUrl: url.href.replace(/\/+$/, '') };
}

function isUnsafeCustomAiHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_CUSTOM_AI_HOSTS.has(host) || host.endsWith('.localhost')) return true;
  if (host.endsWith('.internal')) return true;

  const ipv4 = parseIpv4Address(host);
  if (ipv4) {
    return isUnsafeIpv4Address(ipv4);
  }

  if (host.includes(':')) {
    return isUnsafeIpv6Address(host);
  }

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

function isUnsafeIpv4Address([a, b, c]: [number, number, number, number]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isUnsafeIpv6Address(host: string): boolean {
  const words = parseIpv6Address(host);
  if (!words) return true;

  const firstWord = words[0];
  const isUnspecified = words.every((word) => word === 0);
  const isLoopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const isUniqueLocal = (firstWord & 0xfe00) === 0xfc00;
  const isLinkLocal = (firstWord & 0xffc0) === 0xfe80;
  const isSiteLocal = (firstWord & 0xffc0) === 0xfec0;
  const isMulticast = (firstWord & 0xff00) === 0xff00;
  const isGlobalUnicast = (firstWord & 0xe000) === 0x2000;
  const isDocumentation = firstWord === 0x2001 && words[1] === 0x0db8;
  const isIpv4Compatible = words.slice(0, 6).every((word) => word === 0);
  const isIpv4Mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;

  if (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isSiteLocal ||
    isMulticast ||
    !isGlobalUnicast ||
    isDocumentation
  ) {
    return true;
  }

  if (isIpv4Mapped) {
    return isUnsafeIpv4Address([words[6] >>> 8, words[6] & 0xff, words[7] >>> 8, words[7] & 0xff]);
  }

  // IPv4 兼容地址已经废弃，部分网络栈仍可能把它按 IPv4 解释。
  return isIpv4Compatible;
}

function parseIpv6Address(host: string): number[] | null {
  const sections = host.split('::');
  if (sections.length > 2) return null;

  const parseSection = (section: string): number[] | null => {
    if (!section) return [];
    const parts = section.split(':');
    const words: number[] = [];

    for (const part of parts) {
      if (/^[0-9a-f]{1,4}$/i.test(part)) {
        words.push(Number.parseInt(part, 16));
        continue;
      }

      // URL 通常会规范化 IPv4 嵌入尾段；这里仍保留直接调用时的校验能力。
      const ipv4 = parseIpv4Address(part);
      if (!ipv4 || part !== parts[parts.length - 1]) return null;
      words.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
    }

    return words;
  };

  const left = parseSection(sections[0]);
  const right = sections.length === 2 ? parseSection(sections[1]) : [];
  if (!left || !right) return null;

  if (sections.length === 1) {
    return left.length === 8 ? left : null;
  }

  const omittedWords = 8 - left.length - right.length;
  if (omittedWords < 1) return null;
  return [...left, ...Array.from({ length: omittedWords }, () => 0), ...right];
}

async function fetchUpstreamWithRetry(
  url: string,
  init: RequestInit,
  _runtime: AiRuntime,
): Promise<UpstreamFetchResult> {
  const maxAttempts = UPSTREAM_RETRY_DELAYS_MS.length + 1;
  const { signal: externalSignal, ...fetchInit } = init;

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (externalSignal?.aborted) {
      abortFromCaller();
    } else {
      externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    }
    const cleanup = () => externalSignal?.removeEventListener('abort', abortFromCaller);
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, UPSTREAM_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...fetchInit,
        redirect: 'error',
        signal: controller.signal,
      });
      if (isRetryableUpstreamStatus(response.status) && attemptIndex < maxAttempts - 1) {
        await response.body?.cancel().catch(() => undefined);
        cleanup();
        await sleep(getRetryDelayMs(response, attemptIndex));
        continue;
      }

      return { ok: true, response, attempts: attemptIndex + 1, controller, cleanup };
    } catch (error) {
      cleanup();
      const abortedByCaller = Boolean(externalSignal?.aborted) && !timedOut;
      const fetchTimedOut = timedOut || (isAbortError(error) && !abortedByCaller);
      if (!fetchTimedOut && !abortedByCaller && attemptIndex < maxAttempts - 1) {
        await sleep(UPSTREAM_RETRY_DELAYS_MS[attemptIndex]);
        continue;
      }

      const attempts = attemptIndex + 1;
      if (abortedByCaller) {
        return {
          ok: false,
          error: aiJsonError(499, 'AI_REQUEST_ABORTED', '请求已取消。', {
            attempts,
            retryable: true,
          }),
        };
      }
      return {
        ok: false,
        error: aiJsonError(
          fetchTimedOut ? 504 : 502,
          fetchTimedOut ? 'AI_UPSTREAM_TIMEOUT' : 'AI_UPSTREAM_NETWORK_ERROR',
          fetchTimedOut
            ? `AI 服务连接超时${formatRetrySummary(attempts)}。请稍后再试，或在设置里改用自己的接口。`
            : `无法连接 AI 服务${formatRetrySummary(attempts)}。请稍后再试，或在设置里改用自己的接口。`,
          {
            attempts,
            retryable: true,
            detail: error instanceof Error ? error.message : undefined,
          },
        ),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false,
    error: aiJsonError(502, 'AI_UPSTREAM_NETWORK_ERROR', '无法连接 AI 服务。', {
      attempts: maxAttempts,
      retryable: true,
    }),
  };
}

class UpstreamStreamTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamStreamTimeoutError';
  }
}

type Uint8StreamReadResult = { done: boolean; value?: Uint8Array };

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: AbortController,
  idleTimeoutMs: number,
  deadline: number,
): Promise<Uint8StreamReadResult> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    controller.abort();
    throw new UpstreamStreamTimeoutError('AI 服务流式响应超过总时长限制。');
  }

  const timeoutMs = Math.min(idleTimeoutMs, remainingMs);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new UpstreamStreamTimeoutError(
          timeoutMs === remainingMs
            ? 'AI 服务流式响应超过总时长限制。'
            : 'AI 服务流式响应长时间没有新内容。',
        ),
      );
    }, timeoutMs);

    reader.read().then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function readUpstreamText(
  response: Response,
  controller: AbortController,
  runtime: AiRuntime,
  env?: AiEnv,
): Promise<string> {
  const { totalTimeoutMs } = getStreamTimeouts(runtime, env);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new UpstreamStreamTimeoutError('AI 服务响应正文读取超时。'));
    }, totalTimeoutMs);
    response.text().then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function getStreamTimeouts(runtime: AiRuntime, env?: AiEnv) {
  const idleTimeoutMs = readTimeoutMs(
    runtime.streamIdleTimeoutMs ?? env?.AI_STREAM_IDLE_TIMEOUT_MS,
    UPSTREAM_STREAM_IDLE_TIMEOUT_MS,
  );
  const totalTimeoutMs = Math.max(
    idleTimeoutMs,
    readTimeoutMs(
      runtime.streamTotalTimeoutMs ?? env?.AI_STREAM_TOTAL_TIMEOUT_MS,
      UPSTREAM_STREAM_TOTAL_TIMEOUT_MS,
    ),
  );
  return { idleTimeoutMs, totalTimeoutMs };
}

function readTimeoutMs(value: number | string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5 * 60_000) return fallback;
  return Math.floor(parsed);
}

function buildUpstreamReadError(error: unknown, attempts: number, prefix = ''): Response {
  if (error instanceof UpstreamStreamTimeoutError || isAbortError(error)) {
    return aiJsonError(
      504,
      'AI_UPSTREAM_TIMEOUT',
      `${prefix}AI 服务响应超时，请稍后重试，或在设置里改用自己的接口。`,
      {
        attempts,
        retryable: true,
        detail: error instanceof Error ? error.message : undefined,
      },
    );
  }
  return aiJsonError(
    502,
    'AI_UPSTREAM_STREAM_ERROR',
    `${prefix}AI 服务响应中断，请稍后重试，或在设置里改用自己的接口。`,
    {
      attempts,
      retryable: true,
      detail: error instanceof Error ? error.message : undefined,
    },
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error ||
      (typeof DOMException !== 'undefined' && error instanceof DOMException)) &&
    error.name === 'AbortError'
  );
}

function isRetryableUpstreamStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelayMs(response: Response, attemptIndex: number): number {
  const retryAfter = parseRetryAfterMs(response.headers.get('Retry-After'));
  return retryAfter ?? UPSTREAM_RETRY_DELAYS_MS[attemptIndex];
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 3000);
  }

  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt)) {
    return Math.min(Math.max(retryAt - Date.now(), 0), 3000);
  }

  return undefined;
}

function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildUpstreamErrorResponse(
  status: number,
  rawBody: string,
  attempts: number,
  prefix = '',
): Response {
  const upstreamError = parseUpstreamError(rawBody);
  const retrySummary = formatRetrySummary(attempts);
  const retryable = isRetryableUpstreamStatus(status);
  const detail = upstreamError.message
    ? `上游提示：${upstreamError.message}${upstreamError.code ? `（${upstreamError.code}）` : ''}`
    : undefined;
  const commonDetails = {
    upstreamStatus: status,
    upstreamCode: upstreamError.code,
    attempts,
    retryable,
    detail,
  };

  if (status === 401 || status === 403) {
    return aiJsonError(
      status,
      'AI_UPSTREAM_AUTH_ERROR',
      `${prefix}AI 服务鉴权失败，请检查 API Key 是否有效、额度是否正常。`,
      commonDetails,
    );
  }

  if (status === 400 || status === 404) {
    return aiJsonError(
      status,
      'AI_UPSTREAM_CONFIG_ERROR',
      `${prefix}AI 服务配置可能有误，请检查接口地址和模型名称是否支持当前请求。`,
      commonDetails,
    );
  }

  if (status === 408) {
    return aiJsonError(
      status,
      'AI_UPSTREAM_TIMEOUT',
      `${prefix}AI 服务响应超时${retrySummary}。请稍后再试。`,
      commonDetails,
    );
  }

  if (status === 429) {
    return aiJsonError(
      status,
      'AI_UPSTREAM_RATE_LIMIT',
      `${prefix}AI 服务请求过多或额度受限${retrySummary}。请稍后再试，或改用自己的接口。`,
      commonDetails,
    );
  }

  if (status >= 500) {
    return aiJsonError(
      status,
      'AI_UPSTREAM_UNSTABLE',
      `${prefix}AI 服务暂时不稳定${retrySummary}。请稍后再试，或在设置里改用自己的接口。`,
      commonDetails,
    );
  }

  return aiJsonError(
    status,
    'AI_UPSTREAM_ERROR',
    `${prefix}AI 服务返回异常（上游状态 ${status}）。`,
    commonDetails,
  );
}

function formatRetrySummary(attempts: number): string {
  return attempts > 1 ? `，已自动重试 ${attempts - 1} 次仍未成功` : '';
}

function parseUpstreamError(rawBody: string): { message?: string; code?: string } {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    const error = parsed?.error;
    const message =
      typeof error?.message === 'string'
        ? error.message
        : typeof parsed?.message === 'string'
          ? parsed.message
          : '';
    const code =
      typeof error?.code === 'string'
        ? error.code
        : typeof parsed?.code === 'string'
          ? parsed.code
          : '';
    return {
      message: sanitizeUpstreamText(message),
      code: sanitizeUpstreamText(code),
    };
  } catch {
    return { message: sanitizeUpstreamText(trimmed) };
  }
}

function parseJsonObject<T extends Record<string, unknown>>(text: string): T {
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('请求体必须是 JSON 对象。');
  }
  return value as T;
}

function parseJsonObjectOrNull(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sanitizeUpstreamText(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 180) : undefined;
}

function aiJsonError(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message, ...details },
    }),
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
        ...extraHeaders,
      },
    },
  );
}
