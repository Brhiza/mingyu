export const API_VERSION = 'v1';

export type PublicApiRuntime = {
  service: string;
  origin: string;
};

export const DEFAULT_PUBLIC_API_RUNTIME: PublicApiRuntime = {
  service: 'mingyu',
  origin: 'http://localhost:3000',
};

export const PUBLIC_API_ENDPOINTS = [
  'GET /api/v1/health',
  'GET /api/v1/manifest',
  'GET /api/v1/openapi.json',
  'GET /api/v1/foundation/capabilities',
  'GET /.well-known/aov-mingyu-api.json',
  'POST /api/v1/calendar/true-solar-time',
  'POST /api/v1/calendar/true-solar-birth',
  'POST /api/v1/calendar/astronomical-time',
  'POST /api/v1/calendar/moon-phase',
  'POST /api/v1/calendar/solar-term',
  'POST /api/v1/foundation/ganzhi',
  'POST /api/v1/foundation/wuxing',
  'POST /api/v1/foundation/direction',
  'POST /api/v1/foundation/shensha',
  'POST /api/v1/bazi/calculate',
  'POST /api/v1/bazi/prompt',
  'POST /api/v1/bazi/compatibility',
  'POST /api/v1/bazi/compatibility/prompt',
  'POST /api/v1/ziwei/calculate',
  'POST /api/v1/ziwei/prompt',
  'POST /api/v1/ziwei/compatibility',
  'POST /api/v1/ziwei/compatibility/prompt',
  'POST /api/v1/bazi-ziwei/prompt',
  'POST /api/v1/divination/liuyao',
  'POST /api/v1/divination/liuyao/prompt',
  'POST /api/v1/divination/meihua',
  'POST /api/v1/divination/meihua/prompt',
  'POST /api/v1/divination/xiaoliuren',
  'POST /api/v1/divination/xiaoliuren/prompt',
  'POST /api/v1/divination/qimen',
  'POST /api/v1/divination/qimen/prompt',
  'POST /api/v1/divination/liuren',
  'POST /api/v1/divination/liuren/prompt',
  'POST /api/v1/divination/tarot',
  'POST /api/v1/divination/tarot/prompt',
  'POST /api/v1/divination/ssgw',
  'POST /api/v1/divination/ssgw/prompt',
  'POST /api/v1/divination/almanac',
  'POST /api/v1/divination/almanac/prompt',
  'POST /api/v1/divination/lenormand',
  'POST /api/v1/divination/lenormand/prompt',
  'POST /api/v1/divination/astrolabe',
  'POST /api/v1/divination/astrolabe/prompt',
  'POST /api/v1/metaphysics/bazhai/calculate',
  'POST /api/v1/metaphysics/bazhai/prompt',
  'POST /api/v1/metaphysics/zodiac/calculate',
  'POST /api/v1/metaphysics/zodiac/prompt',
  'POST /api/v1/metaphysics/taiyi/calculate',
  'POST /api/v1/metaphysics/taiyi/prompt',
  'POST /api/v1/metaphysics/wuyun-liuqi/calculate',
  'POST /api/v1/metaphysics/wuyun-liuqi/prompt',
  'POST /api/v1/metaphysics/huangji-jingshi/calculate',
  'POST /api/v1/metaphysics/huangji-jingshi/prompt',
  'POST /api/v1/metaphysics/qizheng/calculate',
  'POST /api/v1/metaphysics/qizheng/prompt',
  'POST /api/v1/metaphysics/xuankong/calculate',
  'POST /api/v1/metaphysics/xuankong/prompt',
  'POST /api/v1/metaphysics/residential/calculate',
  'POST /api/v1/metaphysics/residential/prompt',
  'POST /api/v1/ai/analyze',
  'POST /api/v1/ai/models',
] as const;

export function getPublicApiRuntime(request: Request): PublicApiRuntime {
  const url = new URL(request.url);
  const origin = url.origin.replace(/\/+$/, '');

  return {
    service: url.host || DEFAULT_PUBLIC_API_RUNTIME.service,
    origin: origin || DEFAULT_PUBLIC_API_RUNTIME.origin,
  };
}

export function getPublicApiManifest(runtime: PublicApiRuntime = DEFAULT_PUBLIC_API_RUNTIME) {
  const baseUrl = `${runtime.origin}/api/${API_VERSION}`;

  return {
    name: 'AOV 命理与占卜公开 API',
    service: runtime.service,
    version: API_VERSION,
    baseUrl,
    openapiUrl: `${baseUrl}/openapi.json`,
    skillUrl: `${runtime.origin}/skills/aov-mingyu-api/SKILL.md`,
    endpoints: [...PUBLIC_API_ENDPOINTS],
  };
}

export function getPublicApiManifestForRequest(request: Request) {
  return getPublicApiManifest(getPublicApiRuntime(request));
}
