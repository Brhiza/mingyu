import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import type { AiEnv } from '../src/lib/ai/proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendText(
  response: ServerResponse,
  statusCode: number,
  body: string,
  contentType = 'text/plain; charset=utf-8',
) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function getRuntimeConfigScript() {
  const aiDefaultEnabled = process.env.AI_DEFAULT_ENABLED === 'true' && Boolean(process.env.AI_API_KEY);
  const aiProviderName = process.env.AI_PROVIDER_NAME || '';
  const payload = JSON.stringify({
    aiDefaultEnabled,
    aiProviderName,
  });

  return `window.__MINGYU_RUNTIME_CONFIG__ = ${payload};\n`;
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function handleApiRequest(request: IncomingMessage, response: ServerResponse, url: URL) {
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await readRequestBody(request);
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const apiResponse = await handlePublicApiRequest(
    new Request(url, {
      method: request.method,
      headers,
      body,
    }),
    undefined,
    process.env as AiEnv,
  );

  response.statusCode = apiResponse.status;
  apiResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  if (!apiResponse.body) {
    response.end();
    return;
  }

  Readable.fromWeb(apiResponse.body).pipe(response);
}

async function resolveStaticFile(pathname: string) {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    decodedPath = '/';
  }

  const relativePath = decodedPath === '/' ? '/index.html' : decodedPath;
  const absolutePath = path.resolve(distDir, `.${relativePath}`);

  if (!absolutePath.startsWith(`${distDir}${path.sep}`) && absolutePath !== distDir) {
    return path.join(distDir, 'index.html');
  }

  try {
    const fileStat = await stat(absolutePath);
    if (fileStat.isFile()) {
      return absolutePath;
    }
  } catch {
    // 前端路由交给 index.html 兜底。
  }

  return path.join(distDir, 'index.html');
}

async function handleStaticRequest(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (url.pathname === '/mingyu-runtime-config.js') {
    sendText(response, 200, getRuntimeConfigScript(), 'text/javascript; charset=utf-8');
    return;
  }

  const filePath = await resolveStaticFile(url.pathname);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': contentType,
  };

  if (url.pathname.startsWith('/assets/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (url.pathname === '/service-worker.js' || url.pathname === '/sw.js') {
    headers['Cache-Control'] = 'no-cache';
  }

  response.writeHead(200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/v1/')) {
      await handleApiRequest(request, response, url);
      return;
    }

    await handleStaticRequest(request, response, url);
  })().catch((error) => {
    console.error('Docker 服务未处理异常', error);
    if (!response.headersSent) {
      sendText(response, 500, '服务内部错误。');
    } else {
      response.end();
    }
  });
});

server.listen(port, host, () => {
  console.log(`命语 Docker 服务已启动：http://${host}:${port}`);
});
