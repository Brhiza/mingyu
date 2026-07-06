import { baziCalculator } from '@core/bazi/baziCalculator';
import type { ShenShaVariantConfig } from '@core/bazi/baziShenSha';
import type { BaziChartResult, Person } from '@core/bazi/baziTypes';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import {
  buildZiweiChartInput,
  calculatePublicZiweiChartForScopes,
} from '../full-chart-engine/ziwei';
import {
  daysInSolarMonth,
  getBirthDateValidationMessage,
  isValidIsoDateTime,
} from '../date-validation';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { buildDivinationPrompt } from '../divination/engine';
import { getDivinationSummaryBlocks } from '../divination/summary';
import {
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  readLimitedRequestText,
  RequestBodyTooLargeError,
} from '../http/request-body';
import { ASTROLABE_PROMPT_TOPICS } from '../astrolabe-prompts';
import type {
  AlmanacData,
  AlmanacParticipantInput,
  AlmanacTopic,
  AstrolabeBirthInput,
  DivinationData,
  LenormandSpreadType,
  LiuyaoTemplateType,
  LiurenTemplateType,
  MeihuaSettings,
  SupplementaryInfo,
  XiaoliurenDivinationMethod,
} from '../../types/divination';
import { drawSingleCard, drawSpreadCards, getCardKeywords } from 'mingyu-core/divination/tarot';
import type { DivinationMethodId } from '@core/divination/config';
import {
  BAZI_PROMPT_TOPICS,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_PROMPT_TOPICS,
  ZIWEI_SCHOOLS,
  buildBaziPromptForResult,
  buildPublicZiweiPromptForRuntime,
  buildSerializableZiweiResult,
  type BaziPromptTopic,
  type BaziSchool,
  type PromptMode,
  type ZiweiPromptScope,
  type ZiweiPromptTopic,
  type ZiweiSchool,
} from './prompt-builders';
import { handleAiAnalyze, handleAiModels, type AiEnv } from '../ai/proxy';
import {
  API_VERSION,
  DEFAULT_PUBLIC_API_RUNTIME,
  getPublicApiManifest,
  getPublicApiRuntime,
  type PublicApiRuntime,
} from './metadata';

type ApiMeta = {
  service: string;
  version: typeof API_VERSION;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: ApiMeta;
};

type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  meta: ApiMeta;
};

type JsonRecord = Record<string, unknown>;
type AlmanacPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};
type AlmanacApiResult = Omit<AlmanacData, 'days'> & {
  days: Array<AlmanacData['days'][number] | ReturnType<typeof compactAlmanacDay>>;
  pagination?: AlmanacPagination;
};

const SHENSHA_KONG_WANG_BASIS = ['day', 'day-and-year'] as const;
const SHENSHA_YANG_REN_MODE = ['yang-stems-only', 'include-yin-ren'] as const;
const SHENSHA_TONG_ZI_SCOPE = ['day-hour', 'all-pillars'] as const;
const MAX_PUBLIC_API_TEXT_FIELD_LENGTH = 5000;
const MAX_PUBLIC_API_RESPONSE_BYTES = 1024 * 1024;
const MAX_ALMANAC_PARTICIPANTS = 30;
const MAX_ALMANAC_PAGE_SIZE = 31;
const MAX_COMPACT_QIMEN_CLASSIC_PATTERNS = 8;
const MAX_COMPACT_QIMEN_PATTERN_COMBOS = 10;
const MAX_COMPACT_QIMEN_PALACE_INSIGHTS = 9;
const PROMPT_RESPONSE_MODES = ['summary', 'full', 'prompt-only'] as const;
const DETAIL_MODES = ['full', 'compact'] as const;

type RouteContext = {
  request: Request;
  segments: string[];
  runtime: PublicApiRuntime;
  env?: AiEnv;
};

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

export const PUBLIC_API_BASE_PATH = `/api/${API_VERSION}`;

export function isPublicApiRequestPath(pathname: string) {
  return pathname === PUBLIC_API_BASE_PATH || pathname.startsWith(`${PUBLIC_API_BASE_PATH}/`);
}

const DIVINATION_METHODS = [
  'liuyao',
  'meihua',
  'xiaoliuren',
  'qimen',
  'liuren',
  'tarot',
  'ssgw',
  'almanac',
  'lenormand',
  'astrolabe',
] as const;

function openApiJsonRequestBody(schemaRef: string, required = true) {
  return {
    required,
    content: {
      'application/json': { schema: { $ref: schemaRef } },
    },
  };
}

const DIVINATION_REQUEST_PROPERTIES = {
  question: {
    type: 'string',
    maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH,
    description: '占卜问题。黄历择日接口中可不填；若填写，会作为择日补充信息处理。',
  },
  customDate: {
    type: 'string',
    format: 'date-time',
    description:
      '时间类占卜的自定义起卦或排盘时间，支持六爻、梅花易数、小六壬、奇门遁甲、大六壬；不传则使用当前时间。',
  },
  qimenMethod: {
    enum: ['zhuanpan', 'feipan'],
    description: '奇门遁甲排盘方法：zhuanpan 为转盘法（默认），feipan 为飞盘法。',
  },
  method: { enum: ['time', 'number', 'random', 'timeTrigram'] },
  number: { type: 'integer', minimum: 1 },
  xiaoliurenMethod: { enum: ['time', 'number', 'random'] },
  xiaoliurenNumber: { type: 'integer', minimum: 1 },
  spreadType: {
    enum: [
      'single',
      'three',
      'love',
      'career',
      'decision',
      'celtic',
      'chakra',
      'year',
      'mindBodySpirit',
      'horseshoe',
      'five',
      'relationship',
      'nine',
      'element',
      'grandTableau',
    ],
    description:
      '塔罗支持 single、three、love、career、decision、celtic、chakra、year、mindBodySpirit、horseshoe；雷诺曼支持 single、three、five、relationship、decision、nine、element、grandTableau；不传时使用 single。',
  },
  liuyaoTemplate: { enum: ['general', 'ganqing', 'shiye', 'caifu', 'guaishen'] },
  liurenTemplate: { enum: ['general', 'ganqing', 'shiye', 'caifu'] },
  topic: {
    enum: [
      'marriage',
      'move',
      'opening',
      'contract',
      'travel',
      'medical',
      'study',
      'burial',
      'renovation',
      'custom',
    ],
    description: '黄历择日事项；不传时使用 custom。',
  },
  startDate: { type: 'string', format: 'date' },
  endDate: { type: 'string', format: 'date' },
  participants: {
    type: 'array',
    maxItems: MAX_ALMANAC_PARTICIPANTS,
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        gender: { enum: ['男', '女', ''] },
        year: { type: 'integer', minimum: 1900, maximum: 2100 },
        month: { type: 'integer', minimum: 1, maximum: 12 },
        day: { type: 'integer', minimum: 1, maximum: 31 },
        timeIndex: { type: 'integer', minimum: 0, maximum: 12 },
        dateType: { enum: ['solar', 'lunar'] },
        isLeapMonth: { type: 'boolean' },
      },
    },
  },
  gender: { enum: ['男', '女', ''] },
  year: { type: 'integer', minimum: 1900, maximum: 2100 },
  month: { type: 'integer', minimum: 1, maximum: 12 },
  day: { type: 'integer', minimum: 1, maximum: 31 },
  hour: { type: 'integer', minimum: 0, maximum: 23 },
  minute: { type: 'integer', minimum: 0, maximum: 59 },
  latitude: { type: 'number', minimum: -90, maximum: 90 },
  longitude: { type: 'number', minimum: -180, maximum: 180 },
  timezone: { type: 'number', minimum: -12, maximum: 14 },
  locationName: { type: 'string' },
  useTrueSolarTime: { type: 'boolean' },
  astrolabeTopic: { enum: [...ASTROLABE_PROMPT_TOPICS] },
  astrolabeScopeText: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
  promptMode: { enum: [...PROMPT_MODES] },
  supplementaryInfo: { type: 'object' },
  responseMode: {
    enum: [...PROMPT_RESPONSE_MODES],
    description:
      '提示词接口返回模式：summary 默认只返回提示词和摘要，full 才返回完整排盘，prompt-only 只返回提示词。',
  },
  detailMode: {
    enum: [...DETAIL_MODES],
    description:
      '排盘接口返回细节：full 返回完整结构；compact 返回轻量摘要，适合自动化和多次分页请求。',
  },
  page: {
    type: 'integer',
    minimum: 1,
    description: '黄历择日结果分页页码；不传时保持旧行为返回全部日期。',
  },
  pageSize: {
    type: 'integer',
    minimum: 1,
    maximum: MAX_ALMANAC_PAGE_SIZE,
    description: '黄历择日分页每页数量，最多 31 天。',
  },
};

export function getPublicApiOpenApiDocument(
  runtime: PublicApiRuntime = DEFAULT_PUBLIC_API_RUNTIME,
) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'AOV 命理与占卜公开 API',
      version: API_VERSION,
      description:
        '提供八字、紫微斗数、六爻、梅花易数、小六壬、奇门遁甲、大六壬、塔罗、三山国王灵签、黄历择日、雷诺曼、星盘和提示词生成能力。',
    },
    servers: [{ url: `${runtime.origin}/api/${API_VERSION}` }],
    paths: {
      '/health': {
        get: {
          summary: '健康检查',
          responses: { '200': { description: '服务可用' } },
        },
      },
      '/manifest': {
        get: {
          summary: '获取 API 元数据',
          responses: { '200': { description: 'API 元数据' } },
        },
      },
      '/openapi.json': {
        get: {
          summary: '获取 OpenAPI 文档',
          responses: { '200': { description: 'OpenAPI JSON' } },
        },
      },
      '/bazi/calculate': {
        post: {
          summary: '八字排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/BaziRequest'),
          responses: { '200': { description: '八字命盘数据' } },
        },
      },
      '/bazi/prompt': {
        post: {
          summary: '八字排盘并生成 AI 解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/BaziPromptRequest'),
          responses: { '200': { description: '八字命盘数据和结构化提示词' } },
        },
      },
      '/ziwei/calculate': {
        post: {
          summary: '紫微斗数排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/ZiweiRequest'),
          responses: { '200': { description: '紫微命盘数据' } },
        },
      },
      '/ziwei/prompt': {
        post: {
          summary: '紫微斗数排盘并生成 AI 解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/ZiweiPromptRequest'),
          responses: { '200': { description: '紫微命盘数据和结构化提示词' } },
        },
      },
      '/divination/liuyao': {
        post: {
          summary: '六爻起卦',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '六爻卦盘' } },
        },
      },
      '/divination/meihua': {
        post: {
          summary: '梅花易数起卦',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '梅花易数卦盘' } },
        },
      },
      '/divination/xiaoliuren': {
        post: {
          summary: '小六壬起课',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '小六壬课盘' } },
        },
      },
      '/divination/qimen': {
        post: {
          summary: '奇门遁甲排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '奇门盘，含节令背景与复合格局' } },
        },
      },
      '/divination/liuren': {
        post: {
          summary: '大六壬排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '大六壬课盘' } },
        },
      },
      '/divination/tarot': {
        post: {
          summary: '塔罗抽牌',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '塔罗牌阵' } },
        },
      },
      '/divination/ssgw': {
        post: {
          summary: '三山国王灵签求签',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '灵签结果' } },
        },
      },
      '/divination/almanac': {
        post: {
          summary: '黄历择日',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest'),
          responses: { '200': { description: '择日结果' } },
        },
      },
      '/divination/lenormand': {
        post: {
          summary: '雷诺曼抽牌',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '雷诺曼牌阵' } },
        },
      },
      '/divination/astrolabe': {
        post: {
          summary: '星盘生成',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest'),
          responses: { '200': { description: '星盘结果' } },
        },
      },
      '/divination/{method}/prompt': {
        post: {
          summary: '起卦、抽牌或求签并生成 AI 解读提示词',
          parameters: [
            {
              name: 'method',
              in: 'path',
              required: true,
              schema: { enum: [...DIVINATION_METHODS] },
              description: '占卜方法。',
            },
          ],
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationPromptRequest'),
          responses: { '200': { description: '占卜结果、统一摘要和结构化提示词' } },
        },
      },
      '/ai/analyze': {
        post: {
          summary: 'AI 解读（流式 SSE）',
          description:
            '接收提示词或对话消息，调用 OpenAI 兼容的 Chat API 进行流式解析，返回 SSE 流。' +
            '支持两种请求格式：1) { prompt: string } 单轮解析；' +
            '2) { messages: Array<{role, content}> } 多轮对话（追问仅限当前解析主题）。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    prompt: {
                      type: 'string',
                      description: '完整的提示词文本（单轮模式）',
                    },
                    messages: {
                      type: 'array',
                      description: '对话消息数组（多轮模式，优先于 prompt）',
                      items: {
                        type: 'object',
                        properties: {
                          role: {
                            type: 'string',
                            enum: ['user', 'assistant'],
                          },
                          content: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'SSE 流式响应，data 字段包含 { content: string } 增量。',
            },
          },
        },
      },
      '/ai/models': {
        post: {
          summary: '获取 AI 模型列表',
          description: '按服务端 AI 或用户自行配置的 OpenAI 兼容接口获取模型列表。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    aiConfig: {
                      type: 'object',
                      properties: {
                        mode: { enum: ['builtin', 'custom'] },
                        apiKey: { type: 'string' },
                        baseUrl: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: '模型列表，返回 { ok: true, models: string[] }。',
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ShenShaVariants: {
          type: 'object',
          description:
            '可选。神煞争议口径配置；不传时使用默认主流口径。只影响已声明的争议神煞算法，不改变基础历法与干支排盘。',
          properties: {
            kongWangBasis: {
              enum: [...SHENSHA_KONG_WANG_BASIS],
              description: '空亡口径：day=只按日柱旬空；day-and-year=日柱与年柱旬空并参。',
            },
            yangRenMode: {
              enum: [...SHENSHA_YANG_REN_MODE],
              description:
                '羊刃口径：yang-stems-only=只取阳干羊刃；include-yin-ren=阴干帝旺位作为阴刃并入。',
            },
            tongZiScope: {
              enum: [...SHENSHA_TONG_ZI_SCOPE],
              description: '童子煞口径：day-hour=只查日柱时柱；all-pillars=四柱同查。',
            },
          },
        },
        BaziRequest: {
          type: 'object',
          required: ['gender', 'year', 'month', 'day', 'dateType'],
          properties: {
            gender: { enum: ['male', 'female'] },
            year: { type: 'integer', minimum: 1900, maximum: 2100 },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            timeIndex: {
              type: 'integer',
              minimum: 0,
              maximum: 12,
              description:
                '时辰索引（0-12）。启用真太阳时（useTrueSolarTime=true）时可省略，将从 birthHour/birthMinute 推导。',
            },
            dateType: { enum: ['solar', 'lunar'] },
            isLeapMonth: { type: 'boolean' },
            useTrueSolarTime: { type: 'boolean' },
            birthHour: { type: 'integer', minimum: 0, maximum: 23 },
            birthMinute: { type: 'integer', minimum: 0, maximum: 59 },
            birthPlace: { type: 'string' },
            birthLongitude: { type: 'number', minimum: -180, maximum: 180 },
            shenShaVariants: { $ref: '#/components/schemas/ShenShaVariants' },
            detailMode: DIVINATION_REQUEST_PROPERTIES.detailMode,
          },
        },
        BaziPromptRequest: {
          allOf: [
            { $ref: '#/components/schemas/BaziRequest' },
            {
              type: 'object',
              required: ['question'],
              properties: {
                question: {
                  type: 'string',
                  maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH,
                },
                promptTopic: { enum: [...BAZI_PROMPT_TOPICS] },
                promptMode: { enum: [...PROMPT_MODES] },
                responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
                school: {
                  enum: [...BAZI_SCHOOLS],
                  description:
                    '八字流派指引：traditional=传统派（子平正法、格局调候）, mangpai=盲派（十神象法、年限分段）, xinpai=新派（调候流通）。不传则不附加流派指引。',
                },
              },
            },
          ],
        },
        ZiweiRequest: {
          type: 'object',
          required: ['gender', 'dateType', 'year', 'month', 'day'],
          properties: {
            name: { type: 'string' },
            gender: { enum: ['male', 'female'] },
            dateType: { enum: ['solar', 'lunar'] },
            year: { type: 'string' },
            month: { type: 'string' },
            day: { type: 'string' },
            timeIndex: { type: 'integer', minimum: 0, maximum: 12 },
            promptScope: {
              enum: [...ZIWEI_PROMPT_SCOPES],
              description:
                '可选。公开 API 默认只返回本命范围；传入后会额外返回指定分析范围，避免一次性生成全部运限导致接口超时。',
            },
            isLeapMonth: { type: 'boolean' },
            useTrueSolarTime: { type: 'boolean' },
            birthHour: { type: 'string' },
            birthMinute: { type: 'string' },
            birthLongitude: { type: 'string' },
            detailMode: DIVINATION_REQUEST_PROPERTIES.detailMode,
          },
        },
        ZiweiPromptRequest: {
          allOf: [
            { $ref: '#/components/schemas/ZiweiRequest' },
            {
              type: 'object',
              required: ['question'],
              properties: {
                question: {
                  type: 'string',
                  maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH,
                },
                promptTopic: { enum: [...ZIWEI_PROMPT_TOPICS] },
                promptScope: { enum: [...ZIWEI_PROMPT_SCOPES] },
                promptMode: { enum: [...PROMPT_MODES] },
                responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
                school: {
                  enum: [...ZIWEI_SCHOOLS],
                  description:
                    '紫微流派指引：sanhe=三合派（三方四正、星曜庙旺）, feixing=飞星派（四化飞星链路）, sihua=四化派（生年四化主线）。不传则不附加流派指引。',
                },
              },
            },
          ],
        },
        DivinationRequest: {
          type: 'object',
          properties: DIVINATION_REQUEST_PROPERTIES,
        },
        DivinationPromptRequest: {
          type: 'object',
          properties: DIVINATION_REQUEST_PROPERTIES,
        },
      },
    },
  };
}

export function normalizeApiPath(pathname: string) {
  const path = isPublicApiRequestPath(pathname)
    ? pathname.slice(PUBLIC_API_BASE_PATH.length)
    : pathname;
  return path.replace(/^\/+/, '').split('/').filter(Boolean);
}

export async function handlePublicApiRequest(request: Request, segments?: string[], env?: AiEnv) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const routeSegments = segments ?? normalizeApiPath(new URL(request.url).pathname);
  const runtime = getPublicApiRuntime(request);

  // AI 解析走独立的 SSE 流式响应，不经过 JSON 包装
  if (routeSegments.join('/') === 'ai/analyze' && request.method === 'POST') {
    return handleAiAnalyze(request, env);
  }

  if (routeSegments.join('/') === 'ai/models' && request.method === 'POST') {
    return handleAiModels(request, env);
  }

  try {
    const data = await route({ request, segments: routeSegments, runtime, env });
    return json(success(data, runtime));
  } catch (error) {
    return handleError(error, runtime);
  }
}

async function route(context: RouteContext) {
  const path = context.segments.join('/');

  if (context.request.method === 'GET') {
    if (path === 'health' || path === '') {
      return {
        status: 'ok',
        service: context.runtime.service,
        version: API_VERSION,
        timestamp: new Date().toISOString(),
      };
    }
    if (path === 'manifest') {
      return getPublicApiManifest(context.runtime);
    }
    if (path === 'openapi.json') {
      return getPublicApiOpenApiDocument(context.runtime);
    }
  }

  if (context.request.method !== 'POST') {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', '当前接口只支持 GET、POST 或 OPTIONS。');
  }

  switch (path) {
    case 'bazi/calculate':
      return calculateBaziApi(await readJson(context.request));
    case 'bazi/prompt':
      return buildBaziPrompt(await readJson(context.request));
    case 'ziwei/calculate':
      return calculateZiwei(await readJson(context.request));
    case 'ziwei/prompt':
      return buildZiweiPrompt(await readJson(context.request));
    case 'divination/liuyao':
      return calculateLiuyao(await readJson(context.request, true));
    case 'divination/liuyao/prompt':
      return buildDivinationPromptResult('liuyao', await readJson(context.request));
    case 'divination/meihua':
      return calculateMeihua(await readJson(context.request, true));
    case 'divination/meihua/prompt':
      return buildDivinationPromptResult('meihua', await readJson(context.request));
    case 'divination/xiaoliuren':
      return calculateXiaoliuren(await readJson(context.request, true));
    case 'divination/xiaoliuren/prompt':
      return buildDivinationPromptResult('xiaoliuren', await readJson(context.request));
    case 'divination/qimen':
      return calculateQimenApi(await readJson(context.request, true));
    case 'divination/qimen/prompt':
      return buildDivinationPromptResult('qimen', await readJson(context.request));
    case 'divination/liuren':
      return calculateLiuren(await readJson(context.request, true));
    case 'divination/liuren/prompt':
      return buildDivinationPromptResult('liuren', await readJson(context.request));
    case 'divination/tarot':
      return calculateTarot(await readJson(context.request, true));
    case 'divination/tarot/prompt':
      return buildDivinationPromptResult('tarot', await readJson(context.request));
    case 'divination/ssgw':
      return calculateSsgw(await readJson(context.request, true));
    case 'divination/ssgw/prompt':
      return buildDivinationPromptResult('ssgw', await readJson(context.request));
    case 'divination/almanac':
      return calculateAlmanacApi(await readJson(context.request));
    case 'divination/almanac/prompt':
      return buildDivinationPromptResult('almanac', await readJson(context.request));
    case 'divination/lenormand':
      return calculateLenormand(await readJson(context.request, true));
    case 'divination/lenormand/prompt':
      return buildDivinationPromptResult('lenormand', await readJson(context.request));
    case 'divination/astrolabe':
      return calculateAstrolabe(await readJson(context.request));
    case 'divination/astrolabe/prompt':
      return buildDivinationPromptResult('astrolabe', await readJson(context.request));
    default:
      throw new ApiError(404, 'NOT_FOUND', '没有找到对应的 API 路径。');
  }
}

function calculateBaziApi(input: JsonRecord) {
  const result = calculateBazi(input);
  return readDetailMode(input) === 'compact' ? buildCompactBaziResult(result) : result;
}

function calculateBazi(input: JsonRecord) {
  const gender = readEnum(input, 'gender', ['male', 'female']);
  const birthDate = readBirthDate(input);
  const { dateType } = birthDate;
  const useTrueSolarTime = readBoolean(input, 'useTrueSolarTime', false);
  const birthHour = useTrueSolarTime ? readInteger(input, 'birthHour', 0, 23) : undefined;
  const birthMinute = useTrueSolarTime ? readInteger(input, 'birthMinute', 0, 59) : undefined;
  const birthLongitude = useTrueSolarTime
    ? readNumber(input, 'birthLongitude', -180, 180)
    : undefined;
  const derivedTimeIndex =
    useTrueSolarTime && typeof birthHour === 'number' && typeof birthMinute === 'number'
      ? getTimeIndexFromClock(birthHour, birthMinute)
      : -1;

  // 未启用真太阳时时 timeIndex 必填；启用时优先使用 derivedTimeIndex
  let finalTimeIndex: number;
  if (useTrueSolarTime) {
    if (derivedTimeIndex < 0) {
      throw new ApiError(400, 'BAD_REQUEST', 'birthHour 和 birthMinute 无法换算为有效时辰。');
    }
    finalTimeIndex = derivedTimeIndex;
  } else {
    if (input.timeIndex === undefined) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        '未启用真太阳时时 timeIndex 为必填项，或启用 useTrueSolarTime 并提供 birthHour/birthMinute。',
      );
    }
    finalTimeIndex = readInteger(input, 'timeIndex', 0, 12);
  }

  const person: Person = {
    gender,
    year: birthDate.year,
    month: birthDate.month,
    day: birthDate.day,
    timeIndex: finalTimeIndex,
    isLunar: dateType === 'lunar',
    isLeapMonth: readBoolean(input, 'isLeapMonth', false),
    useTrueSolarTime,
    birthHour,
    birthMinute,
    birthLongitude,
    birthPlace: readString(input, 'birthPlace', ''),
    shenShaVariants: readShenShaVariants(input),
  };

  const result = baziCalculator.calculateBazi(person);
  return result;
}

function readShenShaVariants(input: JsonRecord): Partial<ShenShaVariantConfig> | undefined {
  const value = input.shenShaVariants;
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new ApiError(400, 'BAD_REQUEST', 'shenShaVariants 必须是对象。');
  }

  const variants: Partial<ShenShaVariantConfig> = {};
  const kongWangBasis = readOptionalEnum(value, 'kongWangBasis', SHENSHA_KONG_WANG_BASIS);
  const yangRenMode = readOptionalEnum(value, 'yangRenMode', SHENSHA_YANG_REN_MODE);
  const tongZiScope = readOptionalEnum(value, 'tongZiScope', SHENSHA_TONG_ZI_SCOPE);

  if (kongWangBasis) variants.kongWangBasis = kongWangBasis;
  if (yangRenMode) variants.yangRenMode = yangRenMode;
  if (tongZiScope) variants.tongZiScope = tongZiScope;

  return variants;
}

function buildBaziPrompt(input: JsonRecord) {
  const result = calculateBazi(input);
  const schoolValue = input.school;
  const school =
    typeof schoolValue === 'string' && (BAZI_SCHOOLS as readonly string[]).includes(schoolValue)
      ? (schoolValue as BaziSchool)
      : undefined;
  const prompt = buildBaziPromptForResult({
    result,
    question: readRequiredString(input, 'question'),
    topic: readEnum(input, 'promptTopic', BAZI_PROMPT_TOPICS, 'general') as BaziPromptTopic,
    mode: readEnum(input, 'promptMode', PROMPT_MODES, 'framework') as PromptMode,
    school,
  });

  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult: result,
    resultSummary: buildCompactBaziResult(result),
  });
}

async function calculateZiweiRuntime(input: JsonRecord, scopes: ZiweiPromptScope[] = ['origin']) {
  const birthDate = readBirthDate(input, { asString: true });
  const { dateType } = birthDate;
  const useTrueSolarTime = readBoolean(input, 'useTrueSolarTime', false);
  const timeInput = useTrueSolarTime
    ? {
        timeIndex: '' as const,
        birthHour: String(readIntegerLike(input, 'birthHour', 0, 23)),
        birthMinute: String(readIntegerLike(input, 'birthMinute', 0, 59)),
        birthLongitude: String(readNumberLike(input, 'birthLongitude', -180, 180)),
      }
    : {
        timeIndex: readInteger(input, 'timeIndex', 0, 12),
        birthHour: readString(input, 'birthHour', ''),
        birthMinute: readString(input, 'birthMinute', ''),
        birthLongitude: readString(input, 'birthLongitude', ''),
      };
  return calculatePublicZiweiChartForScopes(
    buildZiweiChartInput({
      name: readString(input, 'name', ''),
      gender: readEnum(input, 'gender', ['male', 'female']),
      dateType,
      year: String(birthDate.year),
      month: String(birthDate.month),
      day: String(birthDate.day),
      timeIndex: timeInput.timeIndex,
      isLeapMonth: readBoolean(input, 'isLeapMonth', false),
      useTrueSolarTime,
      birthHour: timeInput.birthHour,
      birthMinute: timeInput.birthMinute,
      birthLongitude: timeInput.birthLongitude,
    }),
    Array.from(new Set(['origin' as const, ...scopes])),
  );
}

async function calculateZiwei(input: JsonRecord) {
  const scope = readEnum(input, 'promptScope', ZIWEI_PROMPT_SCOPES, 'origin') as ZiweiPromptScope;
  const result = buildSerializableZiweiResult(await calculateZiweiRuntime(input, [scope]));
  return readDetailMode(input) === 'compact' ? buildCompactZiweiResult(result) : result;
}

async function buildZiweiPrompt(input: JsonRecord) {
  const scope = readEnum(input, 'promptScope', ZIWEI_PROMPT_SCOPES, 'origin') as ZiweiPromptScope;
  const result = await calculateZiweiRuntime(input, [scope]);
  const promptTopic =
    input.promptTopic === undefined
      ? undefined
      : (readEnum(input, 'promptTopic', ZIWEI_PROMPT_TOPICS) as ZiweiPromptTopic);
  const mode = readEnum(input, 'promptMode', PROMPT_MODES, 'framework') as PromptMode;
  const schoolValue = input.school;
  const school =
    typeof schoolValue === 'string' && (ZIWEI_SCHOOLS as readonly string[]).includes(schoolValue)
      ? (schoolValue as ZiweiSchool)
      : undefined;
  const serializableResult = buildSerializableZiweiResult(result);
  const prompt = buildPublicZiweiPromptForRuntime({
    result,
    question: readRequiredString(input, 'question'),
    topic: promptTopic,
    scope,
    mode,
    school,
  });

  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult: serializableResult,
    resultSummary: buildCompactZiweiResult(serializableResult),
  });
}

function calculateLiuyao(input: JsonRecord) {
  return generateLiuyao(readCustomDate(input));
}

function calculateQimen(input: JsonRecord) {
  const method = readEnum(input, 'qimenMethod', ['zhuanpan', 'feipan'], 'zhuanpan');
  return generateQimen(readCustomDate(input), method as 'zhuanpan' | 'feipan');
}

function calculateQimenApi(input: JsonRecord) {
  const result = calculateQimen(input);
  return readDetailMode(input) === 'compact' ? buildCompactQimenResult(result) : result;
}

function calculateMeihua(input: JsonRecord) {
  const method = readEnum(input, 'method', ['time', 'number', 'random', 'timeTrigram'], 'time');
  const settings: MeihuaSettings = {
    method,
    ...(method === 'number' ? { number: readInteger(input, 'number', 1) } : {}),
  };

  return generateMeihua(readCustomDate(input), settings);
}

function calculateLiuren(input: JsonRecord) {
  const template = readEnum(
    input,
    'liurenTemplate',
    ['general', 'ganqing', 'shiye', 'caifu'],
    'general',
  );
  return {
    ...generateLiuren(readCustomDate(input)),
    template,
  };
}

function calculateXiaoliuren(input: JsonRecord) {
  const method = readEnum(
    input,
    'xiaoliurenMethod',
    ['time', 'number', 'random'],
    'time',
  ) as XiaoliurenDivinationMethod;
  return generateXiaoliuren({
    method,
    ...(method === 'number' ? { number: readInteger(input, 'xiaoliurenNumber', 1) } : {}),
    customDate: readCustomDate(input),
  });
}

function calculateTarot(input: JsonRecord) {
  const spreadType = readEnum(
    input,
    'spreadType',
    [
      'single',
      'three',
      'love',
      'career',
      'decision',
      'celtic',
      'chakra',
      'year',
      'mindBodySpirit',
      'horseshoe',
    ],
    'single',
  );
  if (spreadType === 'single') {
    const drawResult = drawSingleCard();
    const output = {
      spreadType: 'single',
      spreadName: '单牌指引',
      cards: [
        {
          id: drawResult.card.number,
          name: drawResult.card.name,
          position: drawResult.position,
          reversed: drawResult.isReversed,
          keywords: getCardKeywords(drawResult.card.name).split(','),
        },
      ],
      timestamp: drawResult.timestamp,
    };
    return output;
  }

  const result = drawSpreadCards(spreadType);
  const output = {
    spreadType: result.spreadType,
    spreadName: result.spreadName,
    cards: result.cards.map((item) => ({
      id: item.card.number,
      name: item.card.name,
      position: item.position,
      reversed: item.isReversed,
      keywords: getCardKeywords(item.card.name).split(','),
    })),
    timestamp: result.timestamp,
  };
  return output;
}

function calculateSsgw(input: JsonRecord) {
  const result = drawRandomSign(readCustomDate(input));
  // 三连阴杯拒绝起卦，返回结构化提示而非签文
  if (result.ritual?.rejected) {
    return {
      rejected: true,
      message: result.ritual.reason,
      ritual: result.ritual,
      details: result.details,
    };
  }
  return result;
}

function calculateAlmanac(input: JsonRecord) {
  const { startDate, endDate } = readAlmanacDateRange(input);
  return generateAlmanacSelection({
    topic: readEnum(
      input,
      'topic',
      [
        'marriage',
        'move',
        'opening',
        'contract',
        'travel',
        'medical',
        'study',
        'burial',
        'renovation',
        'custom',
      ],
      'custom',
    ) as AlmanacTopic,
    startDate,
    endDate,
    participants: readAlmanacParticipants(input),
  });
}

function calculateAlmanacApi(input: JsonRecord) {
  const result = calculateAlmanac(input);
  return shapeAlmanacResult(result, input);
}

function calculateLenormand(input: JsonRecord) {
  return drawLenormandSpread(
    readEnum(
      input,
      'spreadType',
      ['single', 'three', 'five', 'relationship', 'decision', 'nine', 'element', 'grandTableau'],
      'single',
    ) as LenormandSpreadType,
  );
}

function calculateAstrolabe(input: JsonRecord) {
  const birthDate = readBirthDate(input, { dateType: 'solar' });
  const astrolabeInput: AstrolabeBirthInput = {
    name: readString(input, 'name', ''),
    gender: readEnum(input, 'gender', ['男', '女', ''], ''),
    year: String(birthDate.year),
    month: String(birthDate.month),
    day: String(birthDate.day),
    hour: String(readInteger(input, 'hour', 0, 23)),
    minute: String(readInteger(input, 'minute', 0, 59)),
    latitude: String(readNumber(input, 'latitude', -90, 90)),
    longitude: String(readNumber(input, 'longitude', -180, 180)),
    timezone: String(readNumber(input, 'timezone', -12, 14)),
    locationName: readString(input, 'locationName', ''),
    useTrueSolarTime: readBoolean(input, 'useTrueSolarTime', false),
  };
  return generateAstrolabe(astrolabeInput);
}

function buildDivinationPromptResult(
  method: Exclude<DivinationMethodId, 'random'>,
  input: JsonRecord,
) {
  const question =
    method === 'almanac'
      ? readString(input, 'question', '')
      : readRequiredString(input, 'question');
  const rawData = calculateDivinationData(method, input);
  const promptData =
    method === 'almanac' ? shapeAlmanacPromptData(rawData as AlmanacData, input) : rawData;
  const fullResult =
    method === 'almanac' ? shapeAlmanacResult(rawData as AlmanacData, input) : rawData;
  const summary = getDivinationSummaryBlocks(method, promptData);
  const prompt = buildDivinationPromptText(method, question, promptData, input);

  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    summary,
    fullResult,
  });
}

function calculateDivinationData(
  method: Exclude<DivinationMethodId, 'random'>,
  input: JsonRecord,
): DivinationData {
  switch (method) {
    case 'liuyao':
      return generateLiuyao(readCustomDate(input));
    case 'meihua':
      return calculateMeihua(input);
    case 'xiaoliuren':
      return calculateXiaoliuren(input);
    case 'qimen':
      return calculateQimen(input);
    case 'liuren':
      return calculateLiuren(input);
    case 'tarot':
      return calculateTarot(input);
    case 'ssgw':
      return drawRandomSign(readCustomDate(input));
    case 'almanac':
      return calculateAlmanac(input);
    case 'lenormand':
      return calculateLenormand(input);
    case 'astrolabe':
      return calculateAstrolabe(input);
    default:
      throw new Error('不支持的占法类型');
  }
}

function buildDivinationPromptText(
  method: Exclude<DivinationMethodId, 'random'>,
  question: string,
  data: unknown,
  input: JsonRecord,
) {
  const baseSupplementaryInfo = isRecord(input.supplementaryInfo)
    ? (input.supplementaryInfo as SupplementaryInfo)
    : undefined;
  const supplementaryInfo =
    method === 'almanac' && question.trim()
      ? {
          ...(baseSupplementaryInfo ?? {}),
          userSupplement: question.trim(),
        }
      : baseSupplementaryInfo;
  const liuyaoTemplate = readEnum(
    input,
    'liuyaoTemplate',
    ['general', 'ganqing', 'shiye', 'caifu', 'guaishen'],
    'general',
  ) as LiuyaoTemplateType;
  const liurenTemplate = readEnum(
    input,
    'liurenTemplate',
    ['general', 'ganqing', 'shiye', 'caifu'],
    'general',
  ) as LiurenTemplateType;

  return buildDivinationPrompt(method, question, data as DivinationData, supplementaryInfo, {
    isCustomQuestion:
      (readEnum(input, 'promptMode', PROMPT_MODES, 'framework') as PromptMode) === 'custom',
    liuyaoTemplate,
    liurenTemplate,
    astrolabeTopic:
      method === 'astrolabe'
        ? readEnum(input, 'astrolabeTopic', ASTROLABE_PROMPT_TOPICS, 'life')
        : undefined,
    astrolabeScopeText:
      method === 'astrolabe' ? readString(input, 'astrolabeScopeText', '') : undefined,
  });
}

function readPromptResponseMode(input: JsonRecord) {
  return readEnum(input, 'responseMode', PROMPT_RESPONSE_MODES, 'summary');
}

function readDetailMode(input: JsonRecord) {
  return readEnum(input, 'detailMode', DETAIL_MODES, 'full');
}

function buildPromptApiResult(params: {
  responseMode: (typeof PROMPT_RESPONSE_MODES)[number];
  prompt: string;
  summary?: unknown;
  fullResult: unknown;
  resultSummary?: unknown;
}) {
  if (params.responseMode === 'prompt-only') {
    return { prompt: params.prompt };
  }

  if (params.responseMode === 'full') {
    return {
      result: params.fullResult,
      ...(params.summary === undefined ? {} : { summary: params.summary }),
      prompt: params.prompt,
    };
  }

  return {
    ...(params.resultSummary === undefined ? {} : { resultSummary: params.resultSummary }),
    ...(params.summary === undefined ? {} : { summary: params.summary }),
    prompt: params.prompt,
  };
}

function buildCompactBaziResult(result: BaziChartResult) {
  const currentYear = new Date().getFullYear();
  const currentLiunian = result.liunian?.find((item) => item.year === currentYear);

  return {
    gender: result.gender,
    solarDate: result.solarDate,
    lunarDate: result.lunarDate,
    timeInfo: result.timeInfo,
    pillars: result.pillars,
    dayMaster: result.dayMaster,
    zodiac: result.zodiac,
    constellation: result.constellation,
    mingGua: result.mingGua,
    tenGods: result.tenGods,
    hiddenStems: result.hiddenStems,
    hiddenTenGods: result.hiddenTenGods,
    wuxingStrength: result.wuxingStrength,
    analysis: result.analysis,
    mingGong: result.mingGong,
    shenGong: result.shenGong,
    taiYuan: result.taiYuan,
    taiXi: result.taiXi,
    lifeStages: result.lifeStages,
    nayin: result.nayin,
    shensha: result.shensha,
    shenShaAnalysis: result.shenShaAnalysis,
    kongWang: result.kongWang,
    wuxingSeasonStatus: result.wuxingSeasonStatus,
    monthCommander: result.monthCommander,
    seasonInfo: {
      ...result.seasonInfo,
      jieqiList: result.seasonInfo.jieqiList.slice(0, 6),
    },
    luckInfo: {
      startInfo: result.luckInfo.startInfo,
      handoverInfo: result.luckInfo.handoverInfo,
      cycles: result.luckInfo.cycles.map((cycle) => ({
        age: cycle.age,
        year: cycle.year,
        ganZhi: cycle.ganZhi,
        isXiaoyun: cycle.isXiaoyun,
        type: cycle.type,
        startSolarTime: cycle.startSolarTime,
        endSolarTime: cycle.endSolarTime,
      })),
    },
    currentLiunian,
    warnings: result.warnings,
  };
}

function buildCompactZiweiResult(result: ReturnType<typeof buildSerializableZiweiResult>) {
  return {
    basicInfo: result.basicInfo,
    scopeNames: result.scopeNames,
    activeScopes: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        {
          active_scope: payload.active_scope,
          palaces: payload.palaces.map((palace) => ({
            index: palace.index,
            name: palace.name,
            heavenly_stem: palace.heavenly_stem,
            earthly_branch: palace.earthly_branch,
            is_body_palace: palace.is_body_palace,
            major_stars: palace.major_stars.map((star) => ({
              name: star.name,
              brightness: star.brightness,
              birth_mutagen: star.birth_mutagen,
            })),
            minor_stars: palace.minor_stars.map((star) => ({
              name: star.name,
              brightness: star.brightness,
              birth_mutagen: star.birth_mutagen,
            })),
            summary_tags: palace.summary_tags,
            opposite_palace_index: palace.opposite_palace_index,
            surrounded_palace_indexes: palace.surrounded_palace_indexes,
            scope_hits: palace.scope_hits,
          })),
        },
      ]),
    ),
    birthMutagens: result.birthMutagens,
    fourMutagens: result.fourMutagens,
    命宫: result.命宫,
    身宫: result.身宫,
    五行局: result.五行局,
    四化: result.四化,
  };
}

function buildCompactQimenResult(result: ReturnType<typeof generateQimen>) {
  const classicPatterns = takeTopScoredItems(
    result.classicPatterns,
    MAX_COMPACT_QIMEN_CLASSIC_PATTERNS,
  );
  const patternCombos = takeTopScoredItems(result.patternCombos, MAX_COMPACT_QIMEN_PATTERN_COMBOS);

  return {
    scope: result.scope,
    timeInfo: result.timeInfo,
    ganzhi: result.ganzhi,
    isYangDun: result.isYangDun,
    juShu: result.juShu,
    zhiFu: result.zhiFu,
    zhiShi: result.zhiShi,
    patternTags: result.patternTags,
    patternDetails: result.patternDetails,
    palaceInsights: (result.palaceInsights ?? []).slice(0, MAX_COMPACT_QIMEN_PALACE_INSIGHTS),
    palaceInsightTotal: result.palaceInsights?.length ?? 0,
    voidBranches: result.voidBranches,
    voidPalaces: result.voidPalaces,
    horseStar: result.horseStar,
    specialConditions: result.specialConditions,
    seasonality: result.seasonality,
    jiuGongGe: result.jiuGongGe.map((palace) => ({
      gong: palace.gong,
      name: palace.name,
      direction: palace.direction,
      element: palace.element,
      tianPan: palace.tianPan,
      diPan: palace.diPan,
      renPan: palace.renPan,
      shenPan: palace.shenPan,
    })),
    classicPatternTotal: result.classicPatterns?.length ?? 0,
    classicPatterns: classicPatterns.map((pattern) => ({
      name: pattern.name,
      type: pattern.type,
      score: pattern.score,
      summary: pattern.summary,
      palaces: pattern.palaces,
    })),
    stemRelations: result.stemRelations,
    patternComboTotal: result.patternCombos?.length ?? 0,
    patternCombos: patternCombos.map((combo) => ({
      key: combo.key,
      name: combo.name,
      tone: combo.tone,
      score: combo.score,
      summary: combo.summary,
      palace: combo.palace,
    })),
    directions: result.directions
      ? {
          goodDirections: result.directions.goodDirections.map((item) => ({
            gong: item.gong,
            name: item.name,
            direction: item.direction,
            score: item.score,
            use: item.use,
          })),
          avoidDirections: result.directions.avoidDirections.map((item) => ({
            gong: item.gong,
            name: item.name,
            direction: item.direction,
            score: item.score,
            use: item.use,
          })),
        }
      : undefined,
    yingQi: result.yingQi,
    timestamp: result.timestamp,
  };
}

function takeTopScoredItems<T extends { score: number }>(items: T[] | undefined, maxItems: number) {
  return [...(items ?? [])]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, maxItems);
}

function compactAlmanacDay(day: AlmanacData['days'][number]) {
  return {
    date: day.date,
    weekday: day.weekday,
    lunarDate: day.lunarDate,
    ganzhi: day.ganzhi,
    zodiac: day.zodiac,
    dayOfficer: day.dayOfficer,
    clash: day.clash,
    score: day.score,
    highlights: day.highlights,
    cautions: day.cautions,
    participantNotes: day.participantNotes,
    recommends: day.recommends.slice(0, 8),
    avoids: day.avoids.slice(0, 8),
    gods: day.gods.slice(0, 8),
  };
}

function readAlmanacPageSelection(result: AlmanacData, input: JsonRecord) {
  const shouldPaginate = input.page !== undefined || input.pageSize !== undefined;
  const page = shouldPaginate ? readInteger(input, 'page', 1, Number.MAX_SAFE_INTEGER, 1) : 1;
  const pageSize = shouldPaginate
    ? readInteger(input, 'pageSize', 1, MAX_ALMANAC_PAGE_SIZE, 10)
    : result.days.length;
  const total = result.days.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  if (shouldPaginate && page > totalPages) {
    throw new ApiError(400, 'BAD_REQUEST', `page 不能超过总页数 ${totalPages}。`);
  }
  const pageStart = (page - 1) * pageSize;
  const selectedDays = shouldPaginate
    ? result.days.slice(pageStart, pageStart + pageSize)
    : result.days;

  return {
    shouldPaginate,
    selectedDays,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

function shapeAlmanacPromptData(result: AlmanacData, input: JsonRecord): AlmanacData {
  const { shouldPaginate, selectedDays } = readAlmanacPageSelection(result, input);
  return shouldPaginate ? { ...result, days: selectedDays } : result;
}

function shapeAlmanacResult(result: AlmanacData, input: JsonRecord): AlmanacApiResult {
  const detailMode = readDetailMode(input);
  const { shouldPaginate, selectedDays, pagination } = readAlmanacPageSelection(result, input);
  const days = detailMode === 'compact' ? selectedDays.map(compactAlmanacDay) : selectedDays;

  return {
    ...result,
    days,
    ...(shouldPaginate ? { pagination } : {}),
  };
}

async function readJson(request: Request, optional = false): Promise<JsonRecord> {
  if (optional && request.body === null) {
    return {};
  }

  try {
    const text = await readLimitedRequestText(request, DEFAULT_MAX_REQUEST_BODY_BYTES);
    if (optional && !text.trim()) {
      return {};
    }
    const value = JSON.parse(text);
    if (!isRecord(value)) {
      throw new ApiError(400, 'BAD_REQUEST', '请求体必须是 JSON 对象。');
    }
    return value;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof RequestBodyTooLargeError) {
      throw new ApiError(
        413,
        'REQUEST_BODY_TOO_LARGE',
        `请求体不能超过 ${DEFAULT_MAX_REQUEST_BODY_BYTES} 字节。`,
      );
    }
    throw new ApiError(400, 'BAD_REQUEST', '请求体必须是合法 JSON。');
  }
}

function readCustomDate(input: JsonRecord) {
  const value = input.customDate;
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'BAD_REQUEST', 'customDate 必须是 ISO 8601 时间字符串。');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !isValidIsoDateTime(value, date)) {
    throw new ApiError(400, 'BAD_REQUEST', 'customDate 不是有效时间。');
  }
  return date;
}

function readInteger(
  input: JsonRecord,
  key: string,
  min?: number,
  max?: number,
  defaultValue?: number,
): number {
  const value = input[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是整数。`);
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是整数。`);
  }
  if (min !== undefined && value < min) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能小于 ${min}。`);
  }
  if (max !== undefined && value > max) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能大于 ${max}。`);
  }
  return value;
}

function readNumber(input: JsonRecord, key: string, min?: number, max?: number): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是数字。`);
  }
  if (min !== undefined && value < min) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能小于 ${min}。`);
  }
  if (max !== undefined && value > max) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能大于 ${max}。`);
  }
  return value;
}

function readBoolean(input: JsonRecord, key: string, fallback: boolean) {
  const value = input[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是布尔值。`);
  }
  return value;
}

function readString(input: JsonRecord, key: string, fallback: string) {
  const value = input[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是字符串。`);
  }
  if (value.length > MAX_PUBLIC_API_TEXT_FIELD_LENGTH) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `${key} 不能超过 ${MAX_PUBLIC_API_TEXT_FIELD_LENGTH} 个字符。`,
    );
  }
  return value;
}

function readRequiredString(input: JsonRecord, key: string) {
  const value = readString(input, key, '');
  if (!value.trim()) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能为空。`);
  }
  return value;
}

function readOptionalEnum<const T extends readonly string[]>(
  input: JsonRecord,
  key: string,
  values: T,
): T[number] | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' && values.includes(value)) {
    return value;
  }
  throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是以下值之一：${values.join('、')}。`);
}

function readDateOnly(input: JsonRecord, key: string) {
  const value = readRequiredString(input, key);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 需要使用 YYYY-MM-DD 格式。`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 年份需在 1900-2100 之间。`);
  }
  if (month < 1 || month > 12) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不是有效日期。`);
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不是有效日期。`);
  }

  return {
    value,
    date: new Date(Date.UTC(year, month - 1, day)),
  };
}

function readAlmanacDateRange(input: JsonRecord) {
  const start = readDateOnly(input, 'startDate');
  const end = readDateOnly(input, 'endDate');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'endDate 不能早于 startDate。');
  }
  if (diffDays > 30) {
    throw new ApiError(400, 'BAD_REQUEST', '黄历择日一次最多比较 31 天，请缩小日期范围。');
  }

  return {
    startDate: start.value,
    endDate: end.value,
  };
}

function readIntegerLike(input: JsonRecord, key: string, min?: number, max?: number): number {
  const value = input[key];
  if (typeof value === 'number') {
    return readInteger(input, key, min, max);
  }
  if (typeof value !== 'string' || !value.trim() || !/^\d+$/.test(value.trim())) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是整数。`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是整数。`);
  }
  if (min !== undefined && parsed < min) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能小于 ${min}。`);
  }
  if (max !== undefined && parsed > max) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能大于 ${max}。`);
  }
  return parsed;
}

function readNumberLike(input: JsonRecord, key: string, min?: number, max?: number): number {
  const value = input[key];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是数字。`);
  }
  if (min !== undefined && parsed < min) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能小于 ${min}。`);
  }
  if (max !== undefined && parsed > max) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能大于 ${max}。`);
  }
  return parsed;
}

function readBirthDate(
  input: JsonRecord,
  options: { dateType?: 'solar' | 'lunar'; asString?: boolean } = {},
) {
  const readPart = options.asString ? readIntegerLike : readInteger;
  const year = readPart(input, 'year', 1900, 2100);
  const month = readPart(input, 'month', 1, 12);
  const dateType = options.dateType ?? readEnum(input, 'dateType', ['solar', 'lunar']);
  const isLeapMonth = readBoolean(input, 'isLeapMonth', false);
  const day = readPart(input, 'day', 1, dateType === 'lunar' ? 30 : 31);

  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType,
    isLeapMonth,
  });
  if (validationMessage) {
    throw new ApiError(400, 'BAD_REQUEST', validationMessage);
  }

  return { year, month, day, dateType };
}

function readAlmanacParticipants(input: JsonRecord): AlmanacParticipantInput[] {
  const value = input.participants;
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'BAD_REQUEST', 'participants 必须是数组。');
  }
  if (value.length > MAX_ALMANAC_PARTICIPANTS) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `participants 一次最多传 ${MAX_ALMANAC_PARTICIPANTS} 位参与人，请拆分请求。`,
    );
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new ApiError(400, 'BAD_REQUEST', `participants[${index}] 必须是对象。`);
    }

    const dateType = readEnum(item, 'dateType', ['solar', 'lunar']);
    const birthDate = readBirthDate(item, { dateType });
    const participant: AlmanacParticipantInput = {
      id: readString(item, 'id', `participant-${index + 1}`),
      name: readString(item, 'name', ''),
      gender: readEnum(item, 'gender', ['男', '女', ''], ''),
      year: String(birthDate.year),
      month: String(birthDate.month),
      day: String(birthDate.day),
      timeIndex: String(readInteger(item, 'timeIndex', 0, 12)),
      dateType,
      isLeapMonth: readBoolean(item, 'isLeapMonth', false),
    };

    return participant;
  });
}

function readEnum<const T extends readonly string[]>(
  input: JsonRecord,
  key: string,
  values: T,
  fallback?: T[number],
): T[number] {
  const value = input[key];
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }
  if (typeof value === 'string' && values.includes(value)) {
    return value;
  }
  throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是以下值之一：${values.join('、')}。`);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function success<T>(data: T, runtime: PublicApiRuntime): ApiSuccess<T> {
  return {
    ok: true,
    data,
    meta: {
      service: runtime.service,
      version: API_VERSION,
    },
  };
}

function failure(code: string, message: string, runtime: PublicApiRuntime): ApiFailure {
  return {
    ok: false,
    error: { code, message },
    meta: {
      service: runtime.service,
      version: API_VERSION,
    },
  };
}

function json(body: ApiSuccess<unknown> | ApiFailure, status = 200) {
  let text = JSON.stringify(body);
  const bodyBytes = new TextEncoder().encode(text).byteLength;
  if (body.ok && bodyBytes > MAX_PUBLIC_API_RESPONSE_BYTES) {
    text = JSON.stringify({
      ok: false,
      error: {
        code: 'RESPONSE_TOO_LARGE',
        message: `响应内容不能超过 ${MAX_PUBLIC_API_RESPONSE_BYTES} 字节，请缩小日期范围、减少参与人或拆分请求。`,
      },
      meta: body.meta,
    } satisfies ApiFailure);
    status = 413;
  }

  return new Response(text, {
    status,
    headers: JSON_HEADERS,
  });
}

function handleError(error: unknown, runtime: PublicApiRuntime) {
  if (error instanceof ApiError) {
    return json(failure(error.code, error.message, runtime), error.status);
  }

  console.error('公开 API 未处理异常', error);
  return json(failure('INTERNAL_ERROR', '服务内部错误。', runtime), 500);
}
