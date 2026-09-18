import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMingyuMcpServer, SERVER_INFO } from '../../../mcp/src/create-server.js';

export const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With, mcp-session-id, Accept, mcp-protocol-version',
  'Access-Control-Max-Age': '86400',
};

const ONLINE_ALMANAC_MAX_DAYS = 7;
const ONLINE_QIMEN_LIFETIME_MAX_YEARS = 10;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...MCP_CORS_HEADERS,
    },
  });
}

function getValidationFieldNames(message: string) {
  const fields = new Set<string>();
  for (const match of message.matchAll(/"path"\s*:\s*\[([^\]]*)\]/g)) {
    for (const field of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
      fields.add(field[1]);
    }
  }
  for (const match of message.matchAll(/path:\s*\[\s*['"]([^'"]+)['"]/g)) {
    fields.add(match[1]);
  }
  return [...fields];
}

function normalizeMcpValidationResponseBody(payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as Record<string, unknown>;
  const result = record.result;
  if (!result || typeof result !== 'object') return payload;
  const toolResult = result as Record<string, unknown>;
  if (!toolResult.isError || toolResult.structuredContent) return payload;
  const content = Array.isArray(toolResult.content) ? toolResult.content : [];
  const rawText = content.find(
    (item): item is { type: 'text'; text: string } =>
      !!item && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string',
  )?.text;
  if (!rawText || !/Input validation error/i.test(rawText)) return payload;

  const error = rawText.replace(/^MCP error -32602:\s*/i, '');
  const missingFields = getValidationFieldNames(rawText);
  const structuredContent = {
    error,
    code: 'INVALID_ARGUMENTS',
    ...(missingFields.length ? { missingFields } : {}),
    retryable: false,
    fallback: '请根据 error 和 missingFields 修正输入参数后重试。',
  };
  return {
    ...record,
    result: {
      ...toolResult,
      structuredContent,
      content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    },
  };
}

function readDateRangeDays(startDate: unknown, endDate: unknown) {
  if (typeof startDate !== 'string' || typeof endDate !== 'string') return undefined;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function readYearRangeYears(range: unknown) {
  if (!range || typeof range !== 'object') return undefined;
  const record = range as Record<string, unknown>;
  if (typeof record.startDate !== 'string' || typeof record.endDate !== 'string') return undefined;
  const startYear = Number(record.startDate.slice(0, 4));
  const endYear = Number(record.endDate.slice(0, 4));
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    return undefined;
  }
  return endYear - startYear + 1;
}

function buildOnlineResourceLimitResponse(id: unknown, message: string) {
  const structuredContent = {
    error: message,
    code: 'RESOURCE_LIMIT',
    retryable: true,
    fallback: '请缩小范围后分段调用；需要完整大范围结果时使用本地或自部署 MCP。',
  };
  return jsonResponse({
    jsonrpc: '2.0',
    id,
    result: {
      isError: true,
      structuredContent,
      content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    },
  });
}

async function checkOnlineResourceLimit(request: Request) {
  if (request.method.toUpperCase() !== 'POST') return undefined;
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return undefined;
  }
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  if (record.method !== 'tools/call' || record.id === undefined) return undefined;
  const params = record.params;
  if (!params || typeof params !== 'object') return undefined;
  const call = params as Record<string, unknown>;
  const name = call.name;
  const args = call.arguments;
  if (!args || typeof args !== 'object' || typeof name !== 'string') return undefined;
  const input = args as Record<string, unknown>;

  if (name === 'divine_almanac' || name === 'almanac_prompt') {
    const days = readDateRangeDays(input.startDate, input.endDate);
    if (days !== undefined && days > ONLINE_ALMANAC_MAX_DAYS) {
      return buildOnlineResourceLimitResponse(
        record.id,
        `在线 MCP 为保证边缘运行稳定，黄历单次最多计算 ${ONLINE_ALMANAC_MAX_DAYS} 天；当前请求为 ${days} 天。`,
      );
    }
  }

  if (name === 'divine_qimen_lifetime' || name === 'qimen_lifetime_prompt') {
    const years = readYearRangeYears(input.periodRange);
    if (years !== undefined && years > ONLINE_QIMEN_LIFETIME_MAX_YEARS) {
      return buildOnlineResourceLimitResponse(
        record.id,
        `在线 MCP 为保证边缘运行稳定，奇门终身局单次动态扫描最多 ${ONLINE_QIMEN_LIFETIME_MAX_YEARS} 年；当前请求为 ${years} 年。`,
      );
    }
  }
  return undefined;
}

/**
 * 统一处理 Streamable HTTP 协议的 MCP 请求（兼容 Cloudflare Pages、Node.js 与 Docker）
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  // 1. CORS 预检
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: MCP_CORS_HEADERS,
    });
  }

  // 2. 浏览器或爬虫直接 GET /mcp
  if (method === 'GET') {
    const accept = request.headers.get('accept') || '';
    const hasSession = request.headers.has('mcp-session-id');
    if (
      !accept.includes('text/event-stream') &&
      (!accept.includes('application/json') || !hasSession)
    ) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: SERVER_INFO.name,
          version: SERVER_INFO.version,
          protocol: 'mcp-streamable-http',
          endpoint: '/mcp',
          transports: ['streamable-http'],
          documentation: 'https://aov.cc/tutorial',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...MCP_CORS_HEADERS,
          },
        },
      );
    }
  }

  const resourceLimitResponse = await checkOnlineResourceLimit(request);
  if (resourceLimitResponse) return resourceLimitResponse;

  // 3. 规范化 Accept 请求标头，避免因客户端省略特定 mime 类型导致 406
  let normalizedRequest = request;
  const incomingAccept = request.headers.get('accept') || '';
  if (
    !incomingAccept.includes('application/json') ||
    !incomingAccept.includes('text/event-stream')
  ) {
    const nextHeaders = new Headers(request.headers);
    nextHeaders.set('accept', 'application/json, text/event-stream');
    normalizedRequest = new Request(request, { headers: nextHeaders });
  }

  // 4. 创建无状态 Transport 并执行请求
  const server = createMingyuMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const response = await transport.handleRequest(normalizedRequest);

  // 5. 注入 CORS 标头
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  if ((headers.get('content-type') || '').includes('application/json')) {
    const body = await response.text();
    try {
      const normalizedBody = normalizeMcpValidationResponseBody(JSON.parse(body));
      return new Response(JSON.stringify(normalizedBody), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
