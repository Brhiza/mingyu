import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMingyuMcpServer, SERVER_INFO } from '../../../mcp/src/create-server.js';

export const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With, mcp-session-id, Accept, mcp-protocol-version',
  'Access-Control-Max-Age': '86400',
};

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
    if (!accept.includes('text/event-stream') && !accept.includes('application/json')) {
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

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
