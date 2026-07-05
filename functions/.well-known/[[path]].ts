import { getPublicApiManifestForRequest } from '../../src/lib/public-api/metadata';

type PagesContext = {
  request: Request;
  params?: {
    path?: string | string[];
  };
};

const WELL_KNOWN_API_FILE = 'aov-mingyu-api.json';
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function onRequest(context: PagesContext) {
  const path = readPath(context);

  if (path !== WELL_KNOWN_API_FILE) {
    return new Response('Not Found', {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  const method = context.request.method.toUpperCase();
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: JSON_HEADERS,
    });
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  return new Response(
    method === 'HEAD' ? null : JSON.stringify(getPublicApiManifestForRequest(context.request)),
    {
      status: 200,
      headers: JSON_HEADERS,
    },
  );
}

function readPath(context: PagesContext) {
  const paramPath = context.params?.path;
  if (Array.isArray(paramPath)) {
    return paramPath.join('/');
  }
  if (typeof paramPath === 'string') {
    return paramPath;
  }
  return new URL(context.request.url).pathname.replace(/^\/\.well-known\//, '');
}
