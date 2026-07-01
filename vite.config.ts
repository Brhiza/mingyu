import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { getManualChunk } from './build/chunking';

/**
 * 解析 .dev.vars 文件为 key-value 对象
 */
function parseDevVars(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Vite 开发服务器中间件：在本地开发时处理 /api/v1/ai/analyze 请求。
 * 生产环境由 Cloudflare Pages Functions 处理，此插件不生效。
 */
function aiProxyDevPlugin(): Plugin {
  return {
    name: 'ai-proxy-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/v1/ai/analyze')) return next();
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }
        if (req.method !== 'POST') return next();

        // 动态导入共享代理逻辑
        const { handleAiAnalyze } = await import('./src/lib/ai/proxy');

        // 读取 .dev.vars 环境变量
        const devVars = parseDevVars(path.resolve(__dirname, '.dev.vars'));

        // 将 Node.js IncomingMessage 转换为 Web Request
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = Buffer.concat(chunks).toString('utf-8');
        const request = new Request(`http://localhost${req.url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        const response = await handleAiAnalyze(request, devVars);

        // 将 Web Response 写回 Node.js ServerResponse
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        if (response.body) {
          const reader = response.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch {
            // 流中断
          }
        }
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), aiProxyDevPlugin()],
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getManualChunk(id);
        },
      },
    },
  },
});
