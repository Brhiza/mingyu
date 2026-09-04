import { MCP_CORS_HEADERS } from '../src/lib/mcp/handler.js';

type PagesContext = {
  request: Request;
};

export function onRequest(context: PagesContext): Response {
  if (context.request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: MCP_CORS_HEADERS,
    });
  }

  return new Response(
    JSON.stringify({
      error:
        'Cloudflare Pages 边缘节点推荐使用现代 Streamable HTTP 协议端点 https://aov.cc/mcp。如需有状态 SSE 会话，可使用本地/自部署 mingyu-mcp 服务。',
      code: 'USE_STREAMABLE_HTTP',
      recommendedEndpoint: 'https://aov.cc/mcp',
      transport: 'streamable-http',
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
