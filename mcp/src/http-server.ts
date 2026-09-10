import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMingyuMcpServer, SERVER_INFO } from './create-server.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
}

export interface HttpServerInstance {
  server: Server;
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
}

/**
 * 启动支持 Streamable HTTP + SSE 的远程 MCP 服务器
 */
export async function startHttpServer(
  options: HttpServerOptions = {},
): Promise<HttpServerInstance> {
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';

  // Streamable HTTP 与 SSE 都按客户端维护独立会话，避免一个客户端的初始化状态污染其他客户端。
  const streamableSessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();
  const sseSessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

  const createStreamableSession = async () => {
    const streamableServer = createMingyuMcpServer();
    const streamableTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await streamableServer.connect(streamableTransport);
    const session = { transport: streamableTransport, server: streamableServer };
    let closing = false;
    streamableTransport.onclose = () => {
      if (closing) return;
      closing = true;
      const sessionId = streamableTransport.sessionId;
      if (sessionId) streamableSessions.delete(sessionId);
      streamableServer.close().catch(() => {});
    };
    return session;
  };

  const server = createServer(async (req, res) => {
    // 跨域支持 (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, mcp-session-id, mcp-protocol-version, Accept',
    );
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = req.headers.host || `localhost:${port}`;
    const url = new URL(req.url || '/', `http://${hostHeader}`);

    // Streamable HTTP 端点 (/mcp)
    if (url.pathname === '/mcp') {
      try {
        const sessionId =
          typeof req.headers['mcp-session-id'] === 'string'
            ? req.headers['mcp-session-id']
            : undefined;
        let session = sessionId ? streamableSessions.get(sessionId) : undefined;
        if (!session && sessionId) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MCP session not found or expired' }));
          return;
        }
        if (!session) {
          if (req.method !== 'POST') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'MCP session is required' }));
            return;
          }
          session = await createStreamableSession();
        }
        await session.transport.handleRequest(req, res);
        const initializedSessionId = session.transport.sessionId;
        if (initializedSessionId) streamableSessions.set(initializedSessionId, session);
      } catch (err) {
        console.error('Streamable HTTP 处理异常:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
      return;
    }

    // SSE 建立连接端点 (/sse)
    if (url.pathname === '/sse' && req.method === 'GET') {
      try {
        const sseTransport = new SSEServerTransport('/message', res);
        const sseServer = createMingyuMcpServer();
        await sseServer.connect(sseTransport);

        const sessionId = sseTransport.sessionId;
        sseSessions.set(sessionId, { transport: sseTransport, server: sseServer });

        let isClosed = false;
        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          sseSessions.delete(sessionId);
          sseServer.close().catch(() => {});
        };

        res.on('close', cleanup);
        sseTransport.onclose = cleanup;
      } catch (err) {
        console.error('SSE 连接建立失败:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to establish SSE connection' }));
        }
      }
      return;
    }

    // SSE 消息投递端点 (/message 或 /messages)
    if ((url.pathname === '/message' || url.pathname === '/messages') && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      const session = sessionId ? sseSessions.get(sessionId) : undefined;
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SSE session not found or expired' }));
        return;
      }

      try {
        await session.transport.handlePostMessage(req, res);
      } catch (err) {
        console.error('SSE 消息处理异常:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to handle SSE message' }));
        }
      }
      return;
    }

    // 健康检查与服务元信息
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: SERVER_INFO.name,
          version: SERVER_INFO.version,
          transports: ['streamable-http', 'sse', 'stdio'],
          endpoints: {
            streamableHttp: '/mcp',
            sse: '/sse',
            message: '/message',
            health: '/health',
          },
          cors: true,
        }),
      );
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const actualAddress = server.address();
      const actualPort =
        typeof actualAddress === 'object' && actualAddress ? actualAddress.port : port;
      const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
      const url = `http://${displayHost}:${actualPort}`;

      resolve({
        server,
        url,
        port: actualPort,
        host,
        close: () =>
          new Promise<void>((resClose, rejClose) => {
            // 关闭所有活跃的 SSE 会话与 MCP 服务端
            for (const session of sseSessions.values()) {
              session.server.close().catch(() => {});
            }
            sseSessions.clear();
            for (const session of streamableSessions.values()) {
              session.transport.close().catch(() => {});
              session.server.close().catch(() => {});
            }
            streamableSessions.clear();
            server.close((err) => (err ? rejClose(err) : resClose()));
          }),
      });
    });
  });
}
