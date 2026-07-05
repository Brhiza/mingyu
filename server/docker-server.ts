import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { handlePublicApiRequest, isPublicApiRequestPath } from '../src/lib/public-api/handler';
import { getPublicApiManifestForRequest } from '../src/lib/public-api/metadata';
import type { AiEnv } from '../src/lib/ai/proxy';
import { getAiRuntimeConfigScript } from '../src/lib/ai/runtime-config';
import { readLimitedNodeRequestBody } from '../src/lib/http/node-request-body';
import {
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  RequestBodyTooLargeError,
} from '../src/lib/http/request-body';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const RUNTIME_CONFIG_PATH = '/mingyu-runtime-config.js';
const RUNTIME_CONFIG_HEADERS = {
  'Cache-Control': 'no-store',
  Allow: 'GET,HEAD,OPTIONS',
};

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
  extraHeaders: Record<string, string> = {},
) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  sendText(response, statusCode, JSON.stringify(body), 'application/json; charset=utf-8', {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
}

async function handleApiRequest(request: IncomingMessage, response: ServerResponse, url: URL) {
  let body: Buffer | undefined;
  try {
    body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await readLimitedNodeRequestBody(request, DEFAULT_MAX_REQUEST_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      sendJson(response, 413, {
        ok: false,
        error: {
          code: 'REQUEST_BODY_TOO_LARGE',
          message: `请求体不能超过 ${DEFAULT_MAX_REQUEST_BODY_BYTES} 字节。`,
        },
        meta: {
          service: url.host || 'mingyu',
          version: 'v1',
        },
      });
      return;
    }
    throw error;
  }
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
  if (url.pathname === '/.well-known/aov-mingyu-api.json') {
    if (request.method === 'OPTIONS') {
      sendText(response, 204, '', 'application/json; charset=utf-8', {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }

    const manifest = getPublicApiManifestForRequest(new Request(url));
    sendText(
      response,
      200,
      request.method === 'HEAD' ? '' : JSON.stringify(manifest),
      'application/json; charset=utf-8',
      {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    );
    return;
  }

  if (url.pathname === RUNTIME_CONFIG_PATH) {
    const method = (request.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      sendText(response, 204, '', 'text/javascript; charset=utf-8', RUNTIME_CONFIG_HEADERS);
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      sendText(response, 405, '方法不支持。', 'text/plain; charset=utf-8', RUNTIME_CONFIG_HEADERS);
      return;
    }

    sendText(
      response,
      200,
      method === 'HEAD' ? '' : getAiRuntimeConfigScript(process.env),
      'text/javascript; charset=utf-8',
      RUNTIME_CONFIG_HEADERS,
    );
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

    if (isPublicApiRequestPath(url.pathname)) {
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
