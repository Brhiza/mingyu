/**
 * V1 退场过渡层（极简日落模块）
 *
 * 用途：
 * 1. 将 V1 老网页收藏夹 / 搜索引擎链接自动映射到 V2 对应新路由；
 * 2. 对 V1 旧公开 API（/api/v1/*）与旧版 SSE 端点（/sse）返回 410 Gone 升级指引。
 *
 * 退场清理方式（建议正式上线 1~3 个月后执行）：
 * 直接删除本文件，并移除 `src/worker.ts`、`src/app/workspace-router.ts`、
 * `wrangler.jsonc` 中的 3 处引用以及 `tests/v1-sunset.test.ts` 即可。
 */

const EXACT_LEGACY_WEB_REDIRECTS: Readonly<Record<string, string>> = {
  '/home': '/',
  '/records': '/history',
  '/cases': '/chart',
  '/calendar': '/utilities/calendar',
  '/culture-tools': '/utilities/chinese-name',
  '/tutorial': '/',
  '/result': '/history',
  '/result/assistant': '/history',
};

/** 将 V1 网页路径映射为 V2 新路径；非旧路径返回 null。 */
export function resolveLegacyWebRedirect(pathname: string): string | null {
  const collapsed = pathname.replace(/\/+/g, '/');
  const normalized = collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
  const direct = EXACT_LEGACY_WEB_REDIRECTS[normalized];
  if (direct) return direct;

  // V1 占卜结果页：/divination/:method/result(/assistant) -> /divination/:method
  const divinationResultMatch = /^\/divination\/([^/]+)\/result(?:\/assistant)?$/.exec(normalized);
  if (divinationResultMatch) {
    return `/divination/${divinationResultMatch[1]}`;
  }

  return null;
}

/** 判断是否为已下线的 V1 公开接口或旧版 SSE 端点。 */
export function isLegacyApiPath(pathname: string): boolean {
  return pathname === '/api/v1' || pathname.startsWith('/api/v1/') || pathname === '/sse';
}

/** 生成 HTTP 410 Gone 退场提示（同时便于开发者与 AI 客户端自动迁移）。 */
export function buildLegacyApiGonePayload(pathname: string) {
  const isSse = pathname === '/sse';
  return {
    error: isSse
      ? '旧版 SSE 端点已下线，请改用 Streamable HTTP MCP 端点 /mcp（推荐 /mcp?mode=router）。'
      : 'V1 接口已下线，请迁移至命语 V2 接口。',
    deprecatedPath: pathname,
    migration: {
      docs: '/api-docs',
      markdownDocs: '/api-docs.md',
      openapi: '/openapi.json',
      mcp: '/mcp?mode=router',
      endpoints: {
        methods: 'GET /api/methods',
        schema: 'GET /api/schema',
        calculate: 'POST /api/calculate',
        prompt: 'POST /api/prompt',
      },
    },
  };
}
