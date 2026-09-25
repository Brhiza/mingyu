import { handlePublicApiRequest, normalizeApiPath } from '../../../src/lib/public-api/handler';
import type { AiEnv } from '../../../src/lib/ai/proxy';
import { AI_CLIENT_ADDRESS_HEADER } from '../../../src/lib/ai/rate-limit';

type PagesContext = {
  request: Request;
  env?: AiEnv & { TIANJI_PROXY_SECRET?: string };
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
  // 天机新站（tianji-app）从服务器转发提问时，带上共享密钥和真实用户 IP，
  // 这样限流仍按每个用户算，而不是所有人共用 Cloudflare 出口 IP。
  const secret = context.env?.TIANJI_PROXY_SECRET;
  const trusted = Boolean(secret) && context.request.headers.get('x-tianji-proxy-secret') === secret;
  const forwarded = trusted ? context.request.headers.get('x-tianji-client-ip')?.trim() : '';
  headers.delete('x-tianji-proxy-secret');
  headers.delete('x-tianji-client-ip');
  const clientAddress = forwarded || context.request.headers.get('CF-Connecting-IP')?.trim();
  if (clientAddress) {
    headers.set(AI_CLIENT_ADDRESS_HEADER, clientAddress);
  } else {
    headers.delete(AI_CLIENT_ADDRESS_HEADER);
  }
  const trustedRequest = new Request(context.request, { headers });

  return handlePublicApiRequest(trustedRequest, segments, context.env);
}
