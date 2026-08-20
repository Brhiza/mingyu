import { handlePublicApiRequest, normalizeApiPath } from '../../../src/lib/public-api/handler';
import type { AiEnv } from '../../../src/lib/ai/proxy';
import { AI_CLIENT_ADDRESS_HEADER } from '../../../src/lib/ai/rate-limit';

type PagesContext = {
  request: Request;
  env?: AiEnv;
  params?: {
    path?: string | string[];
  };
};

export function onRequest(context: PagesContext) {
  const paramPath = context.params?.path;
  const segments = Array.isArray(paramPath)
    ? paramPath
    : typeof paramPath === 'string'
      ? paramPath.split('/').filter(Boolean)
      : normalizeApiPath(new URL(context.request.url).pathname);

  const headers = new Headers(context.request.headers);
  const clientAddress = context.request.headers.get('CF-Connecting-IP')?.trim();
  if (clientAddress) {
    headers.set(AI_CLIENT_ADDRESS_HEADER, clientAddress);
  } else {
    headers.delete(AI_CLIENT_ADDRESS_HEADER);
  }
  const trustedRequest = new Request(context.request, { headers });

  return handlePublicApiRequest(trustedRequest, segments, context.env);
}
