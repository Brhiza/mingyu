import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z, ZodError } from 'zod';
import { calculate, inputSchemas, reprompt, repromptInput, type Method } from './core';
import { createServer, enabledMethods, type McpServerMode } from './mcp';
import { getPromptCatalog } from './catalog';
import { createRepromptInput } from './schema';
import type { RuntimeContext } from './runtime-context';
import {
  characterDataVersion,
  parseCharacterIndex,
  parseCharacterSearchOrder,
  parseCharacterShard,
  type CharacterIndexData,
} from './character-data';
import { asteroidDataVersion, parseAsteroidData } from './asteroid-data';
import { parseStaticDataset, staticDataVersion } from './static-data';
import { resolveRepromptPayload, toCompactResult, type CompactableCalculationResult } from './compact';
import { buildLegacyApiGonePayload, isLegacyApiPath } from './v1-sunset';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ENABLED_METHODS?: string;
  ACCESS_TOKEN?: string;
  CORS_ORIGIN?: string;
  MINGYU_MCP_MODE?: string;
  AI_BUILTIN_ENABLED?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_API_TYPE?: string;
  AI_MODEL?: string;
  AI_SYSTEM_PROMPT?: string;
  AI_TRUSTED_ORIGINS?: string;
}

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const API_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const PUBLIC_READONLY_CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';

function readonlyCacheHeaders(env: Env): HeadersInit | undefined {
  return env.ACCESS_TOKEN !== undefined ? undefined : { 'cache-control': PUBLIC_READONLY_CACHE_CONTROL };
}

function corsHeaders(env: Env): Record<string, string> {
  const origin = env.CORS_ORIGIN?.trim() || '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version',
    'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
    'access-control-max-age': '86400',
  };
}

function withCors(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(env))) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function apiJson(data: unknown, status = 200, env?: Env, extraHeaders?: HeadersInit): Response {
  return Response.json(data, {
    status,
    headers: { ...API_HEADERS, ...(env ? corsHeaders(env) : {}), ...extraHeaders },
  });
}

class PayloadTooLargeError extends Error {}

async function readLimitedText(request: Request, maxBytes = MAX_REQUEST_BODY_BYTES): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new PayloadTooLargeError('请求体过大。');
    }
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError('请求体过大。');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await readLimitedText(request);
  return JSON.parse(text);
}

// 方法 schema 不随请求或部署配置变化；只缓存实际请求过的项。
function generateMethodSchema(method: Method) { return z.toJSONSchema(inputSchemas[method]); }
const methodSchemaCache = new Map<Method, ReturnType<typeof generateMethodSchema>>();
function methodSchema(method: Method) {
  const cached = methodSchemaCache.get(method);
  if (cached) return cached;
  const value = generateMethodSchema(method);
  methodSchemaCache.set(method, value);
  return value;
}

// Optional shared bearer credential for deployments that do not want public API access.
// Static assets remain public, and browsers calculate locally without this credential.
async function authorize(request: Request, token: string | undefined, env: Env): Promise<Response | undefined> {
  if (token === undefined) return;
  if (!token || /\s/.test(token)) {
    return apiJson({ error: '服务访问令牌配置无效。' }, 500, env);
  }
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '');
  if (match) {
    const encode = new TextEncoder();
    const [actual, expected] = await Promise.all([
      crypto.subtle.digest('SHA-256', encode.encode(match[1])),
      crypto.subtle.digest('SHA-256', encode.encode(token)),
    ]);
    const a = new Uint8Array(actual), b = new Uint8Array(expected);
    let difference = 0;
    for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
    if (difference === 0) return;
  }
  return apiJson({ error: '需要有效的访问令牌。' }, 401, env, { 'www-authenticate': 'Bearer' });
}

function selectedMethods(url: URL, enabled: readonly Method[]): Method[] | undefined {
  const requested = url.searchParams.getAll('method');
  if (!requested.length) return [...enabled];
  if (requested.length !== 1 || !enabled.includes(requested[0] as Method)) return undefined;
  return [requested[0] as Method];
}

function resolveMcpMode(url: URL, env: Env): McpServerMode {
  const param = url.searchParams.get('mode');
  if (param === 'router' || param === 'full') return param;
  return env.MINGYU_MCP_MODE === 'router' ? 'router' : 'full';
}

function isOriginAllowedForBuiltinAi(request: Request, env: Env): boolean {
  const configured = env.AI_TRUSTED_ORIGINS?.trim();
  if (!configured) return true;
  const origin = request.headers.get('origin')?.trim();
  if (!origin) return true;
  const patterns = configured.split(',').map((s) => s.trim()).filter(Boolean);
  for (const pattern of patterns) {
    if (pattern === '*' || pattern === origin) return true;
    if (pattern.startsWith('https://*.')) {
      const suffix = pattern.slice('https://*'.length);
      if (origin.startsWith('https://') && origin.endsWith(suffix)) return true;
    }
  }
  return false;
}

function resolveBuiltinChatUrl(baseUrl: string, apiType: string): string {
  const clean = (baseUrl || 'https://api.deepseek.com/v1').trim().replace(/\/+$/, '');
  const path = apiType === 'responses' ? 'responses' : apiType === 'anthropic' ? 'messages' : 'chat/completions';
  return clean.endsWith(`/${path}`) ? clean : `${clean}/${path}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isLegacyEndpoint = isLegacyApiPath(url.pathname);
    const isApiOrMcp =
      isLegacyEndpoint ||
      url.pathname === '/api' ||
      url.pathname.startsWith('/api/') ||
      url.pathname === '/mcp' ||
      url.pathname.startsWith('/mcp/');
    if (!isApiOrMcp) return env.ASSETS.fetch(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...API_HEADERS, ...corsHeaders(env) } });
    }

    if (isLegacyEndpoint) {
      return apiJson(buildLegacyApiGonePayload(url.pathname), 410, env);
    }

    const asteroidRequests = new Map<string, Promise<unknown>>();
    const staticDatasetRequests = new Map<string, Promise<unknown>>();
    let characterIndexRequest: Promise<CharacterIndexData> | undefined;
    const context: RuntimeContext = { asteroidData: (name) => {
      let request = asteroidRequests.get(name);
      if (!request) {
        request = (async () => {
          const response = await env.ASSETS.fetch(new Request(`https://mingyu-assets.invalid/asteroid-data/${asteroidDataVersion}/${name}.json`));
          return parseAsteroidData(response);
        })();
        asteroidRequests.set(name, request);
      }
      return request;
    }, staticDataset: (name) => {
      let pending = staticDatasetRequests.get(name);
      if (!pending) {
        pending = (async () => {
          const response = await env.ASSETS.fetch(new Request(`https://mingyu-assets.invalid/static-data/${staticDataVersion}/${name}.json`));
          return parseStaticDataset(response, name);
        })();
        staticDatasetRequests.set(name, pending);
      }
      return pending;
    }, characterShard: async (kind, shard) => {
      const name = `${kind}-${String(shard).padStart(2, '0')}.json`;
      const response = await env.ASSETS.fetch(new Request(`https://mingyu-assets.invalid/character-data/${characterDataVersion}/${name}`));
      return parseCharacterShard(response);
    }, characterIndex: async () => {
      if (!characterIndexRequest) {
        characterIndexRequest = Promise.all([
          env.ASSETS.fetch(new Request(`https://mingyu-assets.invalid/character-data/${characterDataVersion}/index.json`)).then(parseCharacterIndex),
          env.ASSETS.fetch(new Request(`https://mingyu-assets.invalid/character-data/${characterDataVersion}/search-order.json`)).then(parseCharacterSearchOrder),
        ]).then(([index, searchOrder]) => ({ index, searchOrder }));
      }
      const active = characterIndexRequest;
      try { return await active; }
      catch (error) { if (characterIndexRequest === active) characterIndexRequest = undefined; throw error; }
    } };

    const rejection = await authorize(request, env.ACCESS_TOKEN, env);
    if (rejection) return rejection;

    let enabled: Method[];
    try { enabled = enabledMethods(env.ENABLED_METHODS); }
    catch (error) { return apiJson({ error: error instanceof Error ? error.message : '服务配置错误' }, 500, env); }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return apiJson({ status: 'ok', version: '2.0.0', methodsCount: enabled.length }, 200, env, readonlyCacheHeaders(env));
    }
    if (url.pathname === '/api/ai/status' && request.method === 'GET') {
      const builtinEnabled =
        env.AI_BUILTIN_ENABLED?.trim().toLowerCase() === 'true' && Boolean(env.AI_API_KEY?.trim());
      return apiJson(
        {
          builtinEnabled,
          ...(builtinEnabled && env.AI_MODEL?.trim() ? { model: env.AI_MODEL.trim() } : {}),
        },
        200,
        env,
      );
    }
    if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
      const builtinEnabled =
        env.AI_BUILTIN_ENABLED?.trim().toLowerCase() === 'true' && Boolean(env.AI_API_KEY?.trim());
      if (!builtinEnabled) {
        return apiJson(
          { error: '站内内置 AI 未开启，请在设置中配置自己的模型接口或使用复制提示词。' },
          403,
          env,
        );
      }
      if (!isOriginAllowedForBuiltinAi(request, env)) {
        return apiJson({ error: '当前来源未被允许调用站内内置 AI。' }, 403, env);
      }
      try {
        const body = (await readJsonBody(request)) as { messages?: unknown };
        const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
        const messages = rawMessages
          .filter(
            (m): m is { role: 'system' | 'user' | 'assistant'; content: string } =>
              Boolean(m) &&
              typeof m === 'object' &&
              ['system', 'user', 'assistant'].includes(String((m as { role?: unknown }).role)) &&
              typeof (m as { content?: unknown }).content === 'string' &&
              Boolean((m as { content: string }).content.trim()),
          )
          .slice(-32);
        if (messages.length === 0) {
          return apiJson({ error: '对话消息不能为空。' }, 400, env);
        }
        const apiType = env.AI_API_TYPE?.trim().toLowerCase() || 'chat';
        const upstreamUrl = resolveBuiltinChatUrl(env.AI_BASE_URL ?? '', apiType);
        const model = env.AI_MODEL?.trim() || 'deepseek-chat';
        const systemPrefix = env.AI_SYSTEM_PROMPT?.trim();
        const outboundMessages = systemPrefix
          ? [{ role: 'system', content: systemPrefix }, ...messages]
          : messages;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);
        try {
          const upstream = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${env.AI_API_KEY!.trim()}`,
            },
            body: JSON.stringify({ model, messages: outboundMessages, stream: true }),
            signal: controller.signal,
          });
          if (!upstream.ok || !upstream.body) {
            return apiJson({ error: `内置 AI 上游返回异常（HTTP ${upstream.status}）。` }, 502, env);
          }
          return withCors(
            new Response(upstream.body, {
              status: 200,
              headers: {
                'content-type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
                'cache-control': 'no-store',
              },
            }),
            env,
          );
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        if (error instanceof PayloadTooLargeError) return apiJson({ error: error.message }, 413, env);
        return apiJson({ error: error instanceof Error ? error.message : '内置 AI 请求失败' }, 400, env);
      }
    }
    if (url.pathname === '/api/methods' && request.method === 'GET') {
      return apiJson({ methods: enabled }, 200, env, readonlyCacheHeaders(env));
    }
    if ((url.pathname === '/api/prompts' || url.pathname === '/api/schema') && request.method === 'GET') {
      const selected = selectedMethods(url, enabled);
      if (!selected) return apiJson({ error: '术数不存在、未启用或参数重复' }, 400, env);
      if (url.pathname === '/api/prompts') {
        return apiJson({ methods: getPromptCatalog(selected) }, 200, env, readonlyCacheHeaders(env));
      }
      return apiJson(
        { methods: Object.fromEntries(selected.map((method) => [method, methodSchema(method)])), reprompt: z.toJSONSchema(createRepromptInput(selected)) },
        200,
        env,
        readonlyCacheHeaders(env),
      );
    }
    if (url.pathname === '/api/calculate' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request) as { method?: unknown; input?: unknown; responseMode?: unknown; outputLanguage?: unknown };
        if (typeof body?.method !== 'string' || !enabled.includes(body.method as Method)) {
          return apiJson({ error: '术数不存在或未启用' }, 400, env);
        }
        const effectiveInput =
          typeof body.outputLanguage === 'string'
          && body.input
          && typeof body.input === 'object'
          && !Array.isArray(body.input)
          && !('outputLanguage' in body.input)
            ? { ...(body.input as Record<string, unknown>), outputLanguage: body.outputLanguage }
            : body.input;
        const fullResult = await calculate(body.method as Method, effectiveInput, { ...context, enabledMethods: enabled }) as CompactableCalculationResult;
        const output = body.responseMode === 'compact' ? await toCompactResult(fullResult) : fullResult;
        return apiJson(output, 200, env);
      } catch (error) {
        if (error instanceof PayloadTooLargeError) return apiJson({ error: error.message }, 413, env);
        return apiJson({ error: error instanceof ZodError ? error.issues : error instanceof Error ? error.message : '请求失败' }, 400, env);
      }
    }
    if (url.pathname === '/api/prompt' && request.method === 'POST') {
      try {
        const { payload } = await resolveRepromptPayload(await readJsonBody(request));
        const body = repromptInput.parse(payload);
        if (!enabled.includes(body.method)) return apiJson({ error: '术数不存在或未启用' }, 400, env);
        return apiJson(await reprompt(body, { ...context, enabledMethods: enabled }), 200, env);
      } catch (error) {
        if (error instanceof PayloadTooLargeError) return apiJson({ error: error.message }, 413, env);
        return apiJson({ error: error instanceof ZodError ? error.issues : error instanceof Error ? error.message : '请求失败' }, 400, env);
      }
    }
    if (url.pathname === '/mcp') {
      let mcpRequest = request;
      if (request.method === 'POST') {
        try {
          const text = await readLimitedText(request);
          mcpRequest = new Request(request.url, { method: request.method, headers: request.headers, body: text });
        } catch (error) {
          if (error instanceof PayloadTooLargeError) return apiJson({ error: error.message }, 413, env);
          throw error;
        }
      }
      const mode = resolveMcpMode(url, env);
      const server = createServer(enabled, context, { mode });
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      try {
        await server.connect(transport);
        const mcpResponse = await transport.handleRequest(mcpRequest);
        return withCors(mcpResponse, env);
      } finally {
        await server.close();
      }
    }
    return apiJson({ error: '未找到接口' }, 404, env);
  },
};
