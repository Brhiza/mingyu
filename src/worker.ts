import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z, ZodError } from 'zod';
import { calculate, inputSchemas, reprompt, repromptInput, type Method } from './core';
import { createServer, enabledMethods, type McpServerMode } from './mcp';
import { getPromptCatalog } from './catalog';
import { createRepromptInput } from './schema';
import type { RuntimeContext } from './runtime-context';
import { characterDataVersion, parseCharacterShard } from './character-data';
import { asteroidDataVersion, parseAsteroidData } from './asteroid-data';
import { resolveRepromptPayload, toCompactResult, type CompactableCalculationResult } from './compact';
import { buildLegacyApiGonePayload, isLegacyApiPath } from './v1-sunset';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ENABLED_METHODS?: string;
  ACCESS_TOKEN?: string;
  CORS_ORIGIN?: string;
  MINGYU_MCP_MODE?: string;
}

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const API_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

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
    }, characterShard: async (kind, shard) => {
      const name = `${kind}-${String(shard).padStart(2, '0')}.json`;
      const response = await env.ASSETS.fetch(new Request(`https://mingyu-assets.invalid/character-data/${characterDataVersion}/${name}`));
      return parseCharacterShard(response);
    } };

    const rejection = await authorize(request, env.ACCESS_TOKEN, env);
    if (rejection) return rejection;

    let enabled: Method[];
    try { enabled = enabledMethods(env.ENABLED_METHODS); }
    catch (error) { return apiJson({ error: error instanceof Error ? error.message : '服务配置错误' }, 500, env); }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return apiJson({ status: 'ok', version: '2.0.0', methodsCount: enabled.length }, 200, env);
    }
    if (url.pathname === '/api/methods' && request.method === 'GET') return apiJson({ methods: enabled }, 200, env);
    if ((url.pathname === '/api/prompts' || url.pathname === '/api/schema') && request.method === 'GET') {
      const selected = selectedMethods(url, enabled);
      if (!selected) return apiJson({ error: '术数不存在、未启用或参数重复' }, 400, env);
      if (url.pathname === '/api/prompts') return apiJson({ methods: getPromptCatalog(selected) }, 200, env);
      return apiJson({ methods: Object.fromEntries(selected.map((method) => [method, methodSchema(method)])), reprompt: z.toJSONSchema(createRepromptInput(selected)) }, 200, env);
    }
    if (url.pathname === '/api/calculate' && request.method === 'POST') {
      try {
        const body = await readJsonBody(request) as { method?: unknown; input?: unknown; responseMode?: unknown };
        if (typeof body?.method !== 'string' || !enabled.includes(body.method as Method)) {
          return apiJson({ error: '术数不存在或未启用' }, 400, env);
        }
        const fullResult = await calculate(body.method as Method, body.input, { ...context, enabledMethods: enabled }) as CompactableCalculationResult;
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
