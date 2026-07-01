import { handlePublicApiRequest, normalizeApiPath } from '../../../src/lib/public-api/handler';
import type { AiEnv } from '../../../src/lib/ai/proxy';

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

  return handlePublicApiRequest(context.request, segments, context.env);
}
