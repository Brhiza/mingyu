#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMingyuMcpServer } from './create-server.js';
import { startHttpServer } from './http-server.js';

// 参数解析
const args = process.argv.slice(2);
const isHttpMode =
  args.includes('--http') ||
  process.env.MCP_TRANSPORT === 'http' ||
  args.some((arg) => arg.startsWith('--port=') || arg === '--port') ||
  process.env.PORT !== undefined;

function getArgValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  const prefixArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (prefixArg) {
    return prefixArg.split('=')[1];
  }
  return undefined;
}

if (isHttpMode) {
  const portStr = getArgValue('--port') ?? process.env.PORT ?? '3000';
  const host = getArgValue('--host') ?? process.env.HOST ?? '0.0.0.0';
  const port = parseInt(portStr, 10);

  startHttpServer({ port, host })
    .then((instance) => {
      console.log(`[Mingyu MCP] 远程服务器已启动: ${instance.url}`);
      console.log(`  - Streamable HTTP: ${instance.url}/mcp`);
      console.log(`  - SSE Transport:   ${instance.url}/sse`);
      console.log(`  - 健康检查与元信息: ${instance.url}/health`);

      const handleExit = async () => {
        console.log('\n[Mingyu MCP] 正在关闭远程服务器...');
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', handleExit);
      process.on('SIGTERM', handleExit);
    })
    .catch((error) => {
      console.error('[Mingyu MCP] HTTP 远程服务启动失败:', error);
      process.exit(1);
    });
} else {
  // 默认使用 STDIO
  const server = createMingyuMcpServer();
  const transport = new StdioServerTransport();

  server.connect(transport).catch((error) => {
    console.error('MCP Server 启动失败:', error);
    process.exit(1);
  });
}
