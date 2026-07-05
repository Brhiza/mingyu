import { getAiRuntimeConfigScript, type AiRuntimeEnv } from '../src/lib/ai/runtime-config';

type PagesContext = {
  request: Request;
  env?: AiRuntimeEnv;
  next: () => Response | Promise<Response>;
};

const RUNTIME_CONFIG_PATH = '/mingyu-runtime-config.js';
const SCRIPT_HEADERS = {
  'Content-Type': 'text/javascript; charset=utf-8',
  'Cache-Control': 'no-store',
  Allow: 'GET,HEAD,OPTIONS',
};

export function onRequest(context: PagesContext) {
  const url = new URL(context.request.url);
  if (url.pathname !== RUNTIME_CONFIG_PATH) {
    return context.next();
  }

  const method = context.request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: SCRIPT_HEADERS,
    });
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('方法不支持。', {
      status: 405,
      headers: SCRIPT_HEADERS,
    });
  }

  return new Response(method === 'HEAD' ? null : getAiRuntimeConfigScript(context.env), {
    status: 200,
    headers: SCRIPT_HEADERS,
  });
}
