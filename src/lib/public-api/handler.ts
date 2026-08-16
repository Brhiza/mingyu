import {
  analyzeBaziCompatibility,
  type BaziChartResult,
  type Person,
  type ShenShaScope,
  type ShenShaVariantConfig,
} from 'mingyu-core/bazi';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { analyzeZiweiCompatibility } from 'mingyu-core/ziwei';
import { buildFortuneSelectionContext, type BaziFortuneSelectionValue } from 'mingyu-core/bazi';
import {
  buildAstronomicalTimeEvidence,
  calculateMoonPhaseEvidence,
  calculateSolarIlluminationEvidence,
  calculateSolarTermEvidence,
  convertTrueSolarTime,
  getTimeIndexFromClock,
  resolveTrueSolarBirthTime,
} from 'mingyu-core/calendar';
import { buildZiweiChartInput, calculatePublicZiweiChartForScopes } from 'mingyu-core/ziwei';
import { buildCombinedZiweiCompatibilityPrompt } from 'mingyu-core/ziwei/prompt';
import {
  daysInSolarMonth,
  getBirthDateValidationMessage,
  isValidIsoDateTime,
} from '../date-validation';
import { generateLiuyao, type LiuyaoGenerationOptions } from 'mingyu-core/divination/liuyao';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateJinkoujue } from 'mingyu-core/divination/jinkoujue';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { analyzeAlmanacEvidence, generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { analyzeAstrolabeSynastry } from 'mingyu-core/divination/astrolabe-synastry';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import {
  bazhai,
  zodiac,
  taiyi,
  wuyunLiuqi,
  huangjiJingshi,
  qizheng,
  xuankong,
  residentialFengshui,
} from 'mingyu-core';
import { isValidGanZhi } from 'mingyu-core/ganzhi';
import { BAGUA, TWENTY_FOUR_MOUNTAINS } from 'mingyu-core/direction';
import {
  analyzeCompassDirection,
  analyzeShenshaEvidence,
  analyzeWuxing,
  describeGanZhi,
  getFoundationCapabilities,
} from 'mingyu-core/foundation';
import { buildDivinationPrompt } from '../divination/engine';
import { getDivinationSummaryBlocks } from '../divination/summary';
import { buildAstrolabeFullScopeContexts, buildAstrolabeScopeContext } from '../astrolabe-scope';
import { buildAstrolabeSynastryPrompt } from '../astrolabe-synastry-prompt';
import { getCompatibilityPrompt, type CompatType } from '../../utils/ai/aiPrompts';
import {
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  readLimitedRequestText,
  RequestBodyTooLargeError,
} from '../http/request-body';
import { ASTROLABE_PROMPT_TOPICS } from '../astrolabe-prompts';
import { buildMetaphysicsPrompt as buildSharedMetaphysicsPrompt } from '../metaphysics-prompt';
import type {
  AlmanacData,
  AlmanacParticipantInput,
  AlmanacTopic,
  AstrolabeData,
  AstrolabeBirthInput,
  DivinationData,
  LenormandSpreadType,
  LiuyaoTemplateType,
  LiurenTemplateType,
  MeihuaSettings,
  RandomOptions,
  SupplementaryInfo,
  XiaoliurenDivinationMethod,
} from '../../types/divination';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import {
  formatPromptSchoolGuidance,
  getPromptSchoolIds,
  insertPromptSectionBeforeHeading,
  type PromptSchoolMethod,
} from 'mingyu-core/prompt';
import type { ScopeType } from '../../types/analysis';
import {
  BAZI_PROMPT_TOPICS,
  BAZI_FORTUNE_SCOPES,
  BAZI_MULTI_SCHOOLS,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_PROMPT_TOPICS,
  ZIWEI_SCHOOLS,
  buildBaziZiweiPromptForResults,
  buildBaziPromptForResult,
  buildPublicZiweiPromptForRuntime,
  buildSerializableZiweiResult,
  getZiweiPromptCalculationScopes,
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
import { RESULT_DETAIL_MODES, shapeCalculationResult } from '../result-detail';

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
const SHENSHA_REFERENCE_PROFILES = ['wenzhen', 'classical'] as const;
const SHENSHA_SCOPES = ['common', 'all'] as const;
const MAX_PUBLIC_API_TEXT_FIELD_LENGTH = 5000;
const MAX_PUBLIC_API_RESPONSE_BYTES = 1024 * 1024;
const MAX_ALMANAC_PARTICIPANTS = 30;
const MAX_ALMANAC_PAGE_SIZE = 31;
const MAX_COMPACT_QIMEN_CLASSIC_PATTERNS = 8;
const MAX_COMPACT_QIMEN_PATTERN_COMBOS = 10;
const MAX_COMPACT_QIMEN_PALACE_INSIGHTS = 9;
const PROMPT_RESPONSE_MODES = ['summary', 'full', 'prompt-only'] as const;
const DETAIL_MODES = RESULT_DETAIL_MODES;
const ASTROLABE_PROMPT_SCOPES = ['natal', 'full', 'yearly', 'monthly', 'daily'] as const;

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
  'jinkoujue',
  'qimen',
  'liuren',
  'tarot',
  'ssgw',
  'almanac',
  'lenormand',
  'astrolabe',
] as const;

const DIVINATION_PROMPT_METHODS = DIVINATION_METHODS.filter((method) => method !== 'ssgw');

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
  seed: {
    oneOf: [{ type: 'string' }, { type: 'number' }],
    description: '随机种子；仅随机起法、抽牌和抽签使用，相同种子与相同输入可复现。',
  },
  replay: {
    type: 'array',
    maxItems: 256,
    items: { type: 'number', minimum: 0, exclusiveMaximum: 1 },
    description: '从结果 meta.random.samples 保存的随机样本，用于完整重放。',
  },
  liuyaoMethod: {
    enum: ['time', 'manual', 'coins'],
    description: '六爻起卦方式：时间起卦、手工爻值或模拟三钱投掷。',
  },
  yaos: {
    type: 'array',
    minItems: 6,
    maxItems: 6,
    items: { type: 'integer', minimum: 6, maximum: 9 },
    description: '手工六爻值，按初爻至上爻传入 6、7、8、9。',
  },
  qimenMethod: {
    enum: ['zhuanpan', 'feipan'],
    description: '奇门遁甲排盘方法：zhuanpan 为转盘法（默认），feipan 为飞盘法。',
  },
  qimenJuMethod: {
    enum: ['chaibu', 'zhirun'],
    description: '奇门定局方法：chaibu 为拆补法（默认），zhirun 为置闰法；仅时家/日家生效。',
  },
  method: { enum: ['time', 'number', 'random', 'timeTrigram'] },
  number: { type: 'integer', minimum: 1 },
  xiaoliurenMethod: {
    enum: ['time'],
    description: '小六壬当前仅保留可核验的通行时间起课。',
  },
  jinkoujueMethod: { enum: ['time', 'number', 'random'] },
  jinkoujueNumber: { type: 'integer', minimum: 1 },
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
  timeZoneId: { type: 'string', example: 'Asia/Shanghai' },
  locationName: { type: 'string' },
  useTrueSolarTime: { type: 'boolean' },
  astrolabeTopic: { enum: [...ASTROLABE_PROMPT_TOPICS] },
  astrolabeScope: {
    enum: [...ASTROLABE_PROMPT_SCOPES],
    description:
      '星盘分析范围：natal=本命, full=完整输出版, yearly=流年, monthly=流月, daily=流日。不传时默认本命；传 astrolabeScopeText 时以自定义文本为准。',
  },
  astrolabeScopeDate: {
    type: 'string',
    description:
      '星盘行运日期；full 和 daily 用 YYYY-MM-DD，yearly 用 YYYY，monthly 用 YYYY-MM。除 natal 外均必填。',
  },
  astrolabeScopeText: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
  promptMode: { enum: [...PROMPT_MODES] },
  supplementaryInfo: {
    type: 'object',
    properties: {
      gender: {
        enum: ['男', '女', ''],
        deprecated: true,
        description: '兼容字段；通用占卜不再把性别写入提示词。',
      },
      birthYear: {
        type: 'integer',
        minimum: 1,
        maximum: 9999,
        description: '仅用于奇门年命换算，其他占法不会写入提示词。',
      },
      userSupplement: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
      currentSituation: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
      currentState: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
      knownFacts: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
      desiredOutcome: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
      constraints: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
      meihuaSettings: {
        type: 'object',
        properties: {
          method: { enum: ['time', 'number', 'random', 'timeTrigram'] },
          number: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
  schools: {
    type: 'array',
    minItems: 1,
    maxItems: 3,
    uniqueItems: true,
    items: { type: 'string' },
    description: '解读流派、断法或侧重，可选值随术数而定；选择两个或三个时生成多口径合参提示词。',
  },
  responseMode: {
    enum: [...PROMPT_RESPONSE_MODES],
    default: 'prompt-only',
    description:
      '提示词接口返回模式：prompt-only 为默认值，只返回提示词；summary 额外返回轻量摘要；full 返回完整排盘。',
  },
  detailMode: {
    enum: [...DETAIL_MODES],
    default: 'compact',
    description:
      '排盘接口返回细节：compact 为默认值，只返回盘面与解读所需字段；full 显式返回完整证据链和计算过程。',
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
        '提供真太阳时换算、六十甲子、五行等公共地基能力，以及八字、紫微斗数、六爻、梅花易数、小六壬、奇门遁甲、大六壬、五运六气、皇极经世、塔罗、三山国王灵签、黄历择日、雷诺曼、星盘和提示词生成能力。',
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
      '/foundation/capabilities': {
        get: {
          summary: '获取公共地基能力目录',
          responses: {
            '200': {
              description:
                '历法、干支、五行、方位与神煞目录的稳定能力事实、来源、证据汇总、限制和可复制说明',
            },
          },
        },
      },
      '/calendar/true-solar-time': {
        post: {
          summary: '将当地钟表时间换算为真太阳时',
          requestBody: openApiJsonRequestBody('#/components/schemas/TrueSolarTimeRequest'),
          responses: {
            '200': {
              description:
                '唯一校正时间、经度与均时差修正、跨日、对应时辰，以及结构化计算链、校正事实、证据汇总、来源与限制',
            },
          },
        },
      },
      '/calendar/true-solar-birth': {
        post: {
          summary: '统一换算公历或农历出生真太阳时',
          requestBody: openApiJsonRequestBody('#/components/schemas/TrueSolarBirthRequest'),
          responses: {
            '200': {
              description:
                '公历钟表时间、标准时间、真太阳时、跨日、唯一时辰索引、夏令时资料，以及历法输入在内的完整结构化计算链、事实、汇总与限制',
            },
          },
        },
      },
      '/calendar/solar-illumination': {
        post: {
          summary: '计算太阳高度、日出日落和曙暮光证据',
          requestBody: openApiJsonRequestBody('#/components/schemas/SolarIlluminationRequest'),
          responses: {
            '200': { description: '太阳高度、方位、视太阳正午及四类地平交点证据' },
          },
        },
      },
      '/calendar/astronomical-time': {
        post: {
          summary: '换算UTC、儒略日、近似UT1、ΔT与近似TT',
          requestBody: openApiJsonRequestBody('#/components/schemas/AstronomicalTimeRequest'),
          responses: {
            '200': {
              description:
                '历史时区诊断、UTC、JD(UTC)、近似UT1、ΔT、近似TT、计算链、反证、汇总与精度限制',
            },
          },
        },
      },
      '/calendar/moon-phase': {
        post: {
          summary: '计算月相、照明比例与前后朔弦望事件',
          requestBody: openApiJsonRequestBody('#/components/schemas/MoonPhaseRequest'),
          responses: {
            '200': {
              description:
                '日月黄经差、八分月相、照明比例、近似月龄、前后四正事件、计算链、汇总与限制',
            },
          },
        },
      },
      '/calendar/solar-term': {
        post: {
          summary: '查询单个二十四节气交接与独立黄经核验证据',
          requestBody: openApiJsonRequestBody('#/components/schemas/SolarTermRequest'),
          responses: {
            '200': {
              description:
                '采用历表时刻、目标黄经、独立模型求根、差值核验、计算链、证据汇总与精度限制',
            },
          },
        },
      },
      '/foundation/ganzhi': {
        post: {
          summary: '查询六十甲子完整基础资料',
          requestBody: openApiJsonRequestBody('#/components/schemas/FoundationGanZhiRequest'),
          responses: {
            '200': {
              description:
                '干支序号、纳音、五行、阴阳、藏干与合冲刑害破，以及稳定键、计算链、来源事实、证据汇总和解释限制',
            },
          },
        },
      },
      '/foundation/wuxing': {
        post: {
          summary: '统一五行分布分析',
          requestBody: openApiJsonRequestBody('#/components/schemas/FoundationWuxingRequest'),
          responses: {
            '200': {
              description:
                '五行计数、并列最高最低与缺失五行，以及逐项贡献、计算链、证据汇总和解释限制',
            },
          },
        },
      },
      '/foundation/direction': {
        post: {
          summary: '换算罗盘度数、二十四山坐向与八卦归属',
          requestBody: openApiJsonRequestBody('#/components/schemas/FoundationDirectionRequest'),
          responses: {
            '200': {
              description:
                '归一化度数、向山、坐山、八卦归属、分界线状态，以及计算链、证据汇总和解释限制',
            },
          },
        },
      },
      '/foundation/shensha': {
        post: {
          summary: '核验完整四柱的通用神煞结构化证据',
          requestBody: openApiJsonRequestBody('#/components/schemas/FoundationShenshaRequest'),
          responses: {
            '200': {
              description:
                '空亡、驿马、桃花逐项起法、目标地支、命中柱位、来源声明、计算链、证据汇总和解释限制',
            },
          },
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
      '/bazi/compatibility': {
        post: {
          summary: '八字双盘结构化证据计算',
          requestBody: openApiJsonRequestBody('#/components/schemas/BaziCompatibilityRequest'),
          responses: {
            '200': { description: '双方命盘、跨盘干支关系、双向十神、喜忌覆盖与证据包' },
          },
        },
      },
      '/bazi/compatibility/prompt': {
        post: {
          summary: '八字双盘计算并生成 AI 解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/BaziCompatibilityRequest'),
          responses: { '200': { description: '八字双盘结构化结果与完整证据提示词' } },
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
      '/ziwei/compatibility': {
        post: {
          summary: '紫微双盘宫位与四化结构化证据计算',
          requestBody: openApiJsonRequestBody('#/components/schemas/ZiweiCompatibilityRequest'),
          responses: { '200': { description: '双方本命盘、宫位叠盘、跨盘生年四化落宫与证据包' } },
        },
      },
      '/ziwei/compatibility/prompt': {
        post: {
          summary: '紫微双盘计算并生成 AI 解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/ZiweiCompatibilityRequest'),
          responses: { '200': { description: '紫微双盘结构化结果与完整证据提示词' } },
        },
      },
      '/bazi-ziwei/prompt': {
        post: {
          summary: '八字紫微合参并生成 AI 解读提示词',
          description:
            '同一份出生信息同时计算八字和紫微斗数，并生成合参提示词。适合需要先用八字定主线、再用紫微校验宫位与运限的深度分析。',
          requestBody: openApiJsonRequestBody('#/components/schemas/BaziZiweiPromptRequest'),
          responses: { '200': { description: '八字、紫微轻量摘要和合参结构化提示词' } },
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
      '/divination/jinkoujue': {
        post: {
          summary: '金口诀起课',
          description: '生成地分、将神、贵神、人元四位一体课盘。',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest', false),
          responses: { '200': { description: '金口诀课盘' } },
        },
      },
      '/divination/jinkoujue/prompt': {
        post: {
          summary: '金口诀提示词',
          description: '生成金口诀课盘与可外发 AI 提示词。',
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationRequest'),
          responses: { '200': { description: '金口诀课盘与提示词' } },
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
      '/divination/ssgw/prompt': {
        post: {
          summary: '三山国王灵签求签并生成 AI 解读提示词',
          description:
            '签谱提示词只使用本次签号、签题、签诗、吉凶、典故和解签资料，不提供解读流派选择。',
          requestBody: openApiJsonRequestBody('#/components/schemas/SsgwPromptRequest'),
          responses: { '200': { description: '灵签结果与签谱提示词' } },
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
      '/divination/astrolabe/synastry': {
        post: {
          summary: '西洋占星双盘关系计算',
          requestBody: openApiJsonRequestBody('#/components/schemas/AstrolabeSynastryRequest'),
          responses: { '200': { description: '双方本命盘、跨盘相位、跨盘落宫与证据包' } },
        },
      },
      '/divination/astrolabe/synastry/prompt': {
        post: {
          summary: '西洋占星双盘计算并生成 AI 解读提示词',
          requestBody: openApiJsonRequestBody(
            '#/components/schemas/AstrolabeSynastryPromptRequest',
          ),
          responses: { '200': { description: '西占双盘结果与结构化证据提示词' } },
        },
      },
      '/divination/{method}/prompt': {
        post: {
          summary: '起卦、抽牌或排盘并生成 AI 解读提示词',
          parameters: [
            {
              name: 'method',
              in: 'path',
              required: true,
              schema: { enum: [...DIVINATION_PROMPT_METHODS] },
              description: '占卜方法。',
            },
          ],
          requestBody: openApiJsonRequestBody('#/components/schemas/DivinationPromptRequest'),
          responses: { '200': { description: '占卜结果、统一摘要和结构化提示词' } },
        },
      },
      '/metaphysics/bazhai/calculate': {
        post: {
          summary: '八宅风水排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '八宅大游年盘与吉凶方位' } },
        },
      },
      '/metaphysics/bazhai/prompt': {
        post: {
          summary: '八宅风水排盘并生成 AI 解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '八宅盘与结构化提示词' } },
        },
      },
      '/metaphysics/zodiac/calculate': {
        post: {
          summary: '生肖犯太岁与流年运程',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '犯太岁与运程等级' } },
        },
      },
      '/metaphysics/zodiac/prompt': {
        post: {
          summary: '生肖犯太岁与流年运程并生成提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '运程与提示词' } },
        },
      },
      '/metaphysics/taiyi/calculate': {
        post: {
          summary: '太乙神数排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '太乙式盘' } },
        },
      },
      '/metaphysics/taiyi/prompt': {
        post: {
          summary: '太乙神数排盘并生成提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '太乙盘与提示词' } },
        },
      },
      '/metaphysics/wuyun-liuqi/calculate': {
        post: {
          summary: '五运六气年度结构计算',
          requestBody: openApiJsonRequestBody('#/components/schemas/WuyunLiuqiRequest'),
          responses: {
            '200': { description: '岁运太过不及、五步主客运、司天在泉及六步主客气' },
          },
        },
      },
      '/metaphysics/wuyun-liuqi/prompt': {
        post: {
          summary: '五运六气计算并生成完整解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/WuyunLiuqiRequest'),
          responses: { '200': { description: '五运六气结构与自包含提示词' } },
        },
      },
      '/metaphysics/huangji-jingshi/calculate': {
        post: {
          summary: '皇极经世元会运世周期换算',
          requestBody: openApiJsonRequestBody('#/components/schemas/HuangjiJingshiRequest'),
          responses: { '200': { description: '元会运世位置及各层起止年坐标' } },
        },
      },
      '/metaphysics/huangji-jingshi/prompt': {
        post: {
          summary: '皇极经世周期换算并生成完整解读提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/HuangjiJingshiRequest'),
          responses: { '200': { description: '元会运世结果与自包含提示词' } },
        },
      },
      '/metaphysics/qizheng/calculate': {
        post: {
          summary: '七政四余排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '十一星、真实距星宿界与结构化证据' } },
        },
      },
      '/metaphysics/qizheng/prompt': {
        post: {
          summary: '七政四余排盘并生成提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '七政四余盘与结构化提示词' } },
        },
      },
      '/metaphysics/xuankong/calculate': {
        post: {
          summary: '玄空飞星排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '运盘、山盘、向盘与到山到向证据' } },
        },
      },
      '/metaphysics/xuankong/prompt': {
        post: {
          summary: '玄空飞星排盘并生成提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '玄空飞星盘与结构化提示词' } },
        },
      },
      '/metaphysics/residential/calculate': {
        post: {
          summary: '住宅风水排盘',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '八宅与玄空分层合参结果' } },
        },
      },
      '/metaphysics/residential/prompt': {
        post: {
          summary: '住宅风水排盘并生成提示词',
          requestBody: openApiJsonRequestBody('#/components/schemas/MetaphysicsRequest'),
          responses: { '200': { description: '住宅风水合参结果与结构化提示词' } },
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
        TrueSolarTimeRequest: {
          type: 'object',
          required: ['localDateTime', 'longitude'],
          description:
            '可用 timezone 提供固定 UTC 偏移，或用 timeZoneId 按当地日期解析历史偏移；两者同时提供时，timezone 用于回拨重复时刻消歧和一致性核验。',
          properties: {
            localDateTime: {
              type: 'string',
              example: '1990-05-15T10:30:00',
              description:
                '当地钟表时间，格式为 YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss，不要附带 Z 或时区偏移；IANA 时区会自动解析历史夏令时',
            },
            longitude: {
              type: 'number',
              minimum: -180,
              maximum: 180,
              example: 116.4074,
              description: '当地经度，东经为正、西经为负',
            },
            timezone: {
              type: 'number',
              minimum: -12,
              maximum: 14,
              example: 8,
              description: '固定 UTC 偏移；未提供 timeZoneId 时默认 UTC+8，支持 5.5 等小数时区',
            },
            timeZoneId: {
              type: 'string',
              example: 'America/New_York',
              description: 'IANA 历史时区；会按当地日期解析当时的法定 UTC 偏移',
            },
            applyChinaDst: {
              type: 'boolean',
              default: false,
              description: '是否按中国 1986-1991 历史规则自动还原夏令时',
            },
          },
        },
        TrueSolarBirthRequest: {
          type: 'object',
          required: ['dateType', 'year', 'month', 'day', 'hour', 'minute', 'longitude'],
          description:
            '可用 timezone 提供固定 UTC 偏移，或用 timeZoneId 按出生日期解析历史偏移；回拨重复时刻需同时提供 timezone 消歧。',
          properties: {
            dateType: { enum: ['solar', 'lunar'], description: '公历或农历' },
            year: { type: 'integer', minimum: 1900, maximum: 2100 },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            hour: { type: 'integer', minimum: 0, maximum: 23 },
            minute: { type: 'integer', minimum: 0, maximum: 59 },
            second: { type: 'integer', minimum: 0, maximum: 59, default: 0 },
            isLeapMonth: { type: 'boolean', default: false, description: '农历是否为闰月' },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            timezone: { type: 'number', minimum: -12, maximum: 14 },
            timeZoneId: { type: 'string', example: 'America/New_York' },
            applyChinaDst: { type: 'boolean', default: false },
          },
        },
        SolarIlluminationRequest: {
          type: 'object',
          required: ['year', 'month', 'day', 'latitude', 'longitude'],
          description: 'timezone 与 timeZoneId 至少提供一项；推荐历史日期使用 IANA 时区。',
          properties: {
            year: { type: 'integer', minimum: 1900, maximum: 2200 },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            hour: { type: 'integer', minimum: 0, maximum: 23, default: 12 },
            minute: { type: 'integer', minimum: 0, maximum: 59, default: 0 },
            second: { type: 'integer', minimum: 0, maximum: 59, default: 0 },
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            timezone: { type: 'number', minimum: -12, maximum: 14 },
            timeZoneId: { type: 'string', example: 'Asia/Shanghai' },
          },
        },
        AstronomicalTimeRequest: {
          type: 'object',
          required: ['year', 'month', 'day'],
          properties: {
            year: { type: 'integer', minimum: 1900, maximum: 2200 },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            hour: { type: 'integer', minimum: 0, maximum: 23, default: 0 },
            minute: { type: 'integer', minimum: 0, maximum: 59, default: 0 },
            second: { type: 'integer', minimum: 0, maximum: 59, default: 0 },
            timezone: { type: 'number', minimum: -12, maximum: 14 },
            timeZoneId: { type: 'string', example: 'Asia/Shanghai' },
          },
          description:
            'timezone 与 timeZoneId 至少提供一项；IANA 时区优先，timezone 仅用于回拨消歧和一致性核验，冲突时拒绝计算。',
        },
        MoonPhaseRequest: {
          type: 'object',
          required: ['utcDateTime'],
          properties: {
            utcDateTime: {
              type: 'string',
              format: 'date-time',
              description: '带 Z 或 UTC 偏移的 ISO 时间，如 2024-06-21T12:00:00Z',
            },
          },
        },
        SolarTermRequest: {
          type: 'object',
          required: ['year', 'index'],
          properties: {
            year: { type: 'integer', minimum: 1900, maximum: 2200 },
            index: {
              type: 'integer',
              minimum: 0,
              maximum: 23,
              description: '0冬至、1小寒、2大寒、3立春……23大雪',
            },
          },
        },
        FoundationGanZhiRequest: {
          type: 'object',
          required: ['ganZhi'],
          properties: {
            ganZhi: { type: 'string', description: '真实六十甲子，如“甲子”“甲辰”' },
          },
        },
        FoundationWuxingRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 32,
              items: { type: 'string' },
              description: '天干或地支数组，如 [“甲”,“子”,“丙”,“午”]',
            },
            weightHidden: { type: 'boolean', description: '是否对地支藏干加权，默认 true' },
          },
        },
        FoundationDirectionRequest: {
          type: 'object',
          required: ['degree'],
          properties: {
            degree: {
              type: 'number',
              minimum: 0,
              maximum: 360,
              description: '朝向罗盘度数，正北为0°、顺时针增加，360°等同0°',
            },
          },
        },
        FoundationShenshaRequest: {
          type: 'object',
          required: ['yearGanZhi', 'monthGanZhi', 'dayGanZhi', 'hourGanZhi'],
          properties: {
            yearGanZhi: { type: 'string', description: '年柱六十甲子，如“甲子”' },
            monthGanZhi: { type: 'string', description: '月柱六十甲子，如“丙寅”' },
            dayGanZhi: { type: 'string', description: '日柱六十甲子，如“戊辰”' },
            hourGanZhi: { type: 'string', description: '时柱六十甲子，如“丁巳”' },
            ids: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              uniqueItems: true,
              items: { enum: ['kongwang', 'yima', 'taohua'] },
              description: '可选；不传时查询全部通用规则：空亡、驿马、桃花',
            },
          },
        },
        ShenShaVariants: {
          type: 'object',
          description:
            '可选。神煞争议口径配置；不传时使用问真学堂整理口径。只影响已声明的争议神煞算法，不改变基础历法与干支排盘。',
          properties: {
            referenceProfile: {
              enum: [...SHENSHA_REFERENCE_PROFILES],
              default: 'wenzhen',
              description:
                '整组参考口径：wenzhen=问真学堂整理口径；classical=原有传统兼容口径。单项配置可继续覆盖整组默认值。',
            },
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
            timezone: { type: 'number', minimum: -12, maximum: 14 },
            timeZoneId: { type: 'string', example: 'America/New_York' },
            applyChinaDst: { type: 'boolean' },
            shenShaScope: {
              enum: [...SHENSHA_SCOPES],
              default: 'common',
              description: '神煞输出范围：common=默认仅返回55个常用神煞；all=返回全部已计算神煞。',
            },
            shenShaVariants: { $ref: '#/components/schemas/ShenShaVariants' },
            detailMode: DIVINATION_REQUEST_PROPERTIES.detailMode,
          },
        },
        MetaphysicsRequest: {
          type: 'object',
          description: '新增术数系统通用请求体。各系统仅使用其中相关字段，未用字段可省略。',
          properties: {
            birthYear: {
              type: 'integer',
              minimum: 1900,
              maximum: 2100,
              description: '出生公历年份（八宅推命卦）',
            },
            birthMonth: {
              type: 'integer',
              minimum: 1,
              maximum: 12,
              description: '出生公历月份（八宅立春换年）',
            },
            birthDay: {
              type: 'integer',
              minimum: 1,
              maximum: 31,
              description: '出生公历日期（八宅立春换年）',
            },
            gender: { enum: ['male', 'female'], description: '性别（八宅）' },
            mingGua: { type: 'string', description: '直接给定命卦（八宅）' },
            sitMountain: { type: 'string', description: '坐山，如「子」（八宅）' },
            doorToInteriorDegree: {
              type: 'number',
              minimum: 0,
              maximum: 360,
              description: '站在大门处面向屋内的指南针读数；与 sitMountain 二选一（八宅）',
            },
            northReference: {
              enum: ['unspecified', 'magnetic', 'true'],
              description: '指南针读数基于未声明、磁北或真北（八宅）',
            },
            magneticDeclinationDegrees: {
              type: 'number',
              minimum: -30,
              maximum: 30,
              description: '当地磁偏角，东偏为正、西偏为负，仅用于磁北读数（八宅）',
            },
            measurementUncertaintyDegrees: {
              type: 'number',
              minimum: 0,
              maximum: 45,
              description: '方位测量可能误差，用于判断跨山向或跨宅卦边界（八宅）',
            },
            zodiac: { type: 'string', description: '生肖或地支，如「鼠」或「子」（生肖运程）' },
            year: {
              type: 'integer',
              minimum: 1900,
              maximum: 2200,
              description: '公元年；生肖运程与 yearGanZhi 至少提供一项',
            },
            yearGanZhi: { type: 'string', description: '直接给定流年干支，如「甲辰」（生肖运程）' },
            scope: {
              enum: ['year'],
              description: '太乙计式：当前仅开放完成古籍历法链校勘的年计',
            },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            hour: { type: 'integer', minimum: 0, maximum: 23 },
            minute: { type: 'integer', minimum: 0, maximum: 59 },
            ganZhi: { type: 'string', description: '可选本计干支，必须与所给日期一致（太乙）' },
            latitude: {
              type: 'number',
              minimum: -90,
              maximum: 90,
              description: '纬度（七政四余）',
            },
            longitude: {
              type: 'number',
              minimum: -180,
              maximum: 180,
              description: '经度（七政四余）',
            },
            timezone: {
              type: 'number',
              minimum: -12,
              maximum: 14,
              description: '时区偏移（七政四余）',
            },
            question: { type: 'string', description: '解读问题（prompt 端点）' },
            promptMode: { type: 'string', description: '提示词模式（prompt 端点）' },
            schools: DIVINATION_REQUEST_PROPERTIES.schools,
            detailMode: DIVINATION_REQUEST_PROPERTIES.detailMode,
          },
        },
        WuyunLiuqiRequest: {
          type: 'object',
          description:
            'year 与 yearGanZhi 至少提供一项；同时提供时会校验公历年年中所属年柱是否一致。',
          anyOf: [{ required: ['year'] }, { required: ['yearGanZhi'] }],
          properties: {
            year: {
              type: 'integer',
              minimum: 1,
              maximum: 9999,
              description: '公历年，按该年年中所属年柱换算。',
            },
            yearGanZhi: {
              type: 'string',
              minLength: 2,
              maxLength: 2,
              description: '明确年干支，如「丙午」。',
            },
            question: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
            schools: DIVINATION_REQUEST_PROPERTIES.schools,
            responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
          },
        },
        HuangjiJingshiRequest: {
          type: 'object',
          description:
            '普通用户只需提供公元 year，即可获得通行值年卦完整排盘；研究自定义纪元时提供 epochYear，并从 year 与 elapsedYears 中选择一项。',
          oneOf: [
            { required: ['year'], not: { required: ['elapsedYears'] } },
            {
              required: ['epochYear', 'elapsedYears'],
              not: { required: ['year'] },
            },
          ],
          properties: {
            epochYear: {
              type: 'integer',
              description: '可选的自定义纪元第一年整数坐标；省略时采用通行公元值年卦排法。',
            },
            year: {
              type: 'integer',
              description: '目标公元年；提供 epochYear 时表示该自定义纪元下的目标年坐标。',
            },
            elapsedYears: {
              type: 'integer',
              minimum: 0,
              description: '自定义纪元下距第一年已经过的完整年数，0 表示第一年。',
            },
            question: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
            schools: DIVINATION_REQUEST_PROPERTIES.schools,
            responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
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
                baziFortuneScope: {
                  enum: [...BAZI_FORTUNE_SCOPES],
                  description:
                    '八字命限范围：natal=本命, full=完整输出版, dayun=大运, year=流年, month=流月, day=流日。',
                },
                baziFortuneCycleIndex: {
                  type: 'integer',
                  minimum: 0,
                  description:
                    '大运序号，从 0 开始；选择大运时必填，选择流年、流月或流日时可与年份一起传入以消除交运年歧义。',
                },
                baziFortuneYear: {
                  type: 'integer',
                  description: '指定流年年份；选择流年、流月或流日时必填。',
                },
                baziFortuneMonth: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 12,
                  description: '指定流月序号；选择流月或流日时必填。',
                },
                baziFortuneDay: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 31,
                  description: '指定流日序号；选择流日时必填。',
                },
                responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
                school: {
                  enum: [...BAZI_SCHOOLS],
                  description:
                    '八字流派指引：traditional=传统兼容名（子平派）, ziping=子平派（月令格局、调候行运）, mangpai=盲派（宫位十神、主宾体用、通根墓库、组合取象、分柱年限）, xinpai=新派（旺衰判定、十神流通、喜忌落位、动态岁运）。不传则不附加流派指引。',
                },
                schools: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  uniqueItems: true,
                  items: { enum: [...BAZI_MULTI_SCHOOLS] },
                  description: '八字多派合参；按数组顺序分别解读后归纳共识与分歧。',
                },
              },
            },
          ],
        },
        BaziCompatibilityRequest: {
          type: 'object',
          required: ['person1', 'person2'],
          properties: {
            person1: { $ref: '#/components/schemas/BaziRequest' },
            person2: { $ref: '#/components/schemas/BaziRequest' },
            person1Name: { type: 'string', description: '第一人称呼；仅用于证据来源标注。' },
            person2Name: { type: 'string', description: '第二人称呼；仅用于证据来源标注。' },
            question: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
            compatType: {
              enum: ['marriage', 'career', 'friendship', 'children', 'parents', 'siblings'],
              description: '关系范围；只影响任务范围，不改变双盘事实计算。',
            },
            promptMode: { enum: [...PROMPT_MODES] },
            schools: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              uniqueItems: true,
              items: { enum: [...BAZI_MULTI_SCHOOLS] },
              description: '八字合盘解读流派；选择两个或三个时生成多派合参。',
            },
            responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
          },
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
                '可选。默认只返回本命范围；传入后会额外返回指定分析范围；full 会返回本命、大限、流年、流月、流日、流时。',
            },
            isLeapMonth: { type: 'boolean' },
            useTrueSolarTime: { type: 'boolean' },
            birthHour: { type: 'string' },
            birthMinute: { type: 'string' },
            birthLongitude: { type: 'string' },
            timezone: { type: 'number', minimum: -12, maximum: 14 },
            timeZoneId: { type: 'string', example: 'America/New_York' },
            applyChinaDst: { type: 'boolean' },
            algorithm: {
              enum: ['default', 'zhongzhou'],
              description:
                '紫微安星口径：default 为传统通行安星法，zhongzhou 为中州派安星法；它改变底层排盘，不等同于提示词解读流派。',
            },
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
                schools: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  uniqueItems: true,
                  items: { enum: [...ZIWEI_SCHOOLS] },
                  description: '紫微多派合参；按数组顺序分别解读后归纳共识与分歧。',
                },
              },
            },
          ],
        },
        ZiweiCompatibilityRequest: {
          type: 'object',
          required: ['person1', 'person2'],
          properties: {
            person1: { $ref: '#/components/schemas/ZiweiRequest' },
            person2: { $ref: '#/components/schemas/ZiweiRequest' },
            person1Name: {
              type: 'string',
              description: '第一人称呼；未传时优先使用 person1.name。',
            },
            person2Name: {
              type: 'string',
              description: '第二人称呼；未传时优先使用 person2.name。',
            },
            question: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
            promptTopic: {
              enum: [...ZIWEI_PROMPT_TOPICS],
              description: '关系分析主题；只影响提示词任务范围。',
            },
            promptMode: { enum: [...PROMPT_MODES] },
            schools: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              uniqueItems: true,
              items: { enum: [...ZIWEI_SCHOOLS] },
              description: '紫微合盘解读流派；选择两个或三个时生成多派合参。',
            },
            responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
          },
        },
        BaziZiweiPromptRequest: {
          allOf: [
            { $ref: '#/components/schemas/BaziRequest' },
            {
              type: 'object',
              required: ['question'],
              properties: {
                name: { type: 'string' },
                question: {
                  type: 'string',
                  maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH,
                },
                baziPromptTopic: {
                  enum: [...BAZI_PROMPT_TOPICS],
                  description: '八字侧分析主题；不传时使用 general。',
                },
                ziweiPromptTopic: {
                  enum: [...ZIWEI_PROMPT_TOPICS],
                  description: '紫微侧分析主题；不传时使用 life。',
                },
                promptScope: { enum: [...ZIWEI_PROMPT_SCOPES] },
                promptMode: { enum: [...PROMPT_MODES] },
                responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
                baziSchool: {
                  enum: [...BAZI_SCHOOLS],
                  description: '八字侧流派指引；不传则不附加。',
                },
                baziSchools: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  uniqueItems: true,
                  items: { enum: [...BAZI_MULTI_SCHOOLS] },
                  description: '八字侧多派合参。',
                },
                ziweiSchool: {
                  enum: [...ZIWEI_SCHOOLS],
                  description: '紫微侧流派指引；不传则不附加。',
                },
                ziweiSchools: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  uniqueItems: true,
                  items: { enum: [...ZIWEI_SCHOOLS] },
                  description: '紫微侧多派合参。',
                },
                algorithm: {
                  enum: ['default', 'zhongzhou'],
                  description:
                    '紫微安星口径：default 为传统通行安星法，zhongzhou 为中州派安星法；它改变底层排盘，不等同于提示词解读流派。',
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
        AstrolabeBirthRequest: {
          type: 'object',
          required: ['year', 'month', 'day', 'hour', 'minute', 'latitude', 'longitude'],
          properties: {
            name: { type: 'string' },
            gender: { enum: ['男', '女', ''] },
            year: { type: 'integer', minimum: 1900, maximum: 2100 },
            month: { type: 'integer', minimum: 1, maximum: 12 },
            day: { type: 'integer', minimum: 1, maximum: 31 },
            hour: { type: 'integer', minimum: 0, maximum: 23 },
            minute: { type: 'integer', minimum: 0, maximum: 59 },
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            timezone: { type: 'number', minimum: -12, maximum: 14 },
            timeZoneId: {
              type: 'string',
              example: 'Asia/Shanghai',
              description: 'IANA 历史时区；推荐用于历史日期和实行夏令时的地区',
            },
            locationName: { type: 'string' },
            useTrueSolarTime: { type: 'boolean' },
          },
        },
        AstrolabeSynastryRequest: {
          type: 'object',
          required: ['person1', 'person2'],
          properties: {
            person1: { $ref: '#/components/schemas/AstrolabeBirthRequest' },
            person2: { $ref: '#/components/schemas/AstrolabeBirthRequest' },
          },
        },
        AstrolabeSynastryPromptRequest: {
          allOf: [
            { $ref: '#/components/schemas/AstrolabeSynastryRequest' },
            {
              type: 'object',
              properties: {
                question: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
                promptMode: { enum: [...PROMPT_MODES] },
                responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
                schools: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  uniqueItems: true,
                  items: { enum: [...getPromptSchoolIds('astrolabe')] },
                  description: '西占双盘解读口径；支持现代心理占星、古典占星和时限触发法合参。',
                },
              },
            },
          ],
        },
        SsgwPromptRequest: {
          type: 'object',
          required: ['question'],
          properties: {
            question: { type: 'string', maxLength: MAX_PUBLIC_API_TEXT_FIELD_LENGTH },
            promptMode: { enum: [...PROMPT_MODES] },
            responseMode: DIVINATION_REQUEST_PROPERTIES.responseMode,
            seed: DIVINATION_REQUEST_PROPERTIES.seed,
            replay: DIVINATION_REQUEST_PROPERTIES.replay,
          },
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
    if (path === 'foundation/capabilities') {
      return getFoundationCapabilities();
    }
  }

  if (context.request.method !== 'POST') {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', '当前接口只支持 GET、POST 或 OPTIONS。');
  }

  switch (path) {
    case 'calendar/true-solar-time':
      return calculateTrueSolarTimeApi(await readJson(context.request));
    case 'calendar/true-solar-birth':
      return calculateTrueSolarBirthApi(await readJson(context.request));
    case 'calendar/solar-illumination':
      return calculateSolarIlluminationApi(await readJson(context.request));
    case 'calendar/astronomical-time':
      return calculateAstronomicalTimeApi(await readJson(context.request));
    case 'calendar/moon-phase':
      return calculateMoonPhaseApi(await readJson(context.request));
    case 'calendar/solar-term':
      return calculateSolarTermApi(await readJson(context.request));
    case 'foundation/ganzhi':
      return calculateFoundationGanZhi(await readJson(context.request));
    case 'foundation/wuxing':
      return calculateFoundationWuxing(await readJson(context.request));
    case 'foundation/direction':
      return calculateFoundationDirection(await readJson(context.request));
    case 'foundation/shensha':
      return calculateFoundationShensha(await readJson(context.request));
    case 'bazi/calculate':
      return calculateApiResult(context.request, calculateBaziApi);
    case 'bazi/prompt':
      return buildBaziPrompt(await readJson(context.request));
    case 'bazi/compatibility':
      return calculateApiResult(context.request, calculateBaziCompatibilityApi);
    case 'bazi/compatibility/prompt':
      return buildBaziCompatibilityPromptApi(await readJson(context.request));
    case 'ziwei/calculate':
      return calculateApiResult(context.request, calculateZiwei);
    case 'ziwei/prompt':
      return buildZiweiPrompt(await readJson(context.request));
    case 'ziwei/compatibility':
      return calculateApiResult(context.request, calculateZiweiCompatibilityApi);
    case 'ziwei/compatibility/prompt':
      return buildZiweiCompatibilityPromptApi(await readJson(context.request));
    case 'bazi-ziwei/prompt':
      return buildBaziZiweiPrompt(await readJson(context.request));
    case 'divination/liuyao':
      return calculateApiResult(context.request, calculateLiuyao, true);
    case 'divination/liuyao/prompt':
      return buildDivinationPromptResult('liuyao', await readJson(context.request));
    case 'divination/meihua':
      return calculateApiResult(context.request, calculateMeihua, true);
    case 'divination/meihua/prompt':
      return buildDivinationPromptResult('meihua', await readJson(context.request));
    case 'divination/xiaoliuren':
      return calculateApiResult(context.request, calculateXiaoliuren, true);
    case 'divination/xiaoliuren/prompt':
      return buildDivinationPromptResult('xiaoliuren', await readJson(context.request));
    case 'divination/jinkoujue':
      return calculateApiResult(context.request, calculateJinkoujue, true);
    case 'divination/jinkoujue/prompt':
      return buildDivinationPromptResult('jinkoujue', await readJson(context.request));
    case 'divination/qimen':
      return calculateApiResult(context.request, calculateQimenApi, true);
    case 'divination/qimen/prompt':
      return buildDivinationPromptResult('qimen', await readJson(context.request));
    case 'divination/liuren':
      return calculateApiResult(context.request, calculateLiuren, true);
    case 'divination/liuren/prompt':
      return buildDivinationPromptResult('liuren', await readJson(context.request));
    case 'divination/tarot':
      return calculateApiResult(context.request, calculateTarot, true);
    case 'divination/tarot/prompt':
      return buildDivinationPromptResult('tarot', await readJson(context.request));
    case 'divination/ssgw':
      return calculateApiResult(context.request, calculateSsgw, true);
    case 'divination/ssgw/prompt':
      return buildDivinationPromptResult('ssgw', await readJson(context.request));
    case 'divination/almanac':
      return calculateApiResult(context.request, calculateAlmanacApi);
    case 'divination/almanac/prompt':
      return buildDivinationPromptResult('almanac', await readJson(context.request));
    case 'divination/lenormand':
      return calculateApiResult(context.request, calculateLenormand, true);
    case 'divination/lenormand/prompt':
      return buildDivinationPromptResult('lenormand', await readJson(context.request));
    case 'divination/astrolabe':
      return calculateApiResult(context.request, calculateAstrolabe);
    case 'divination/astrolabe/prompt':
      return buildDivinationPromptResult('astrolabe', await readJson(context.request));
    case 'divination/astrolabe/synastry':
      return calculateApiResult(context.request, calculateAstrolabeSynastryApi);
    case 'divination/astrolabe/synastry/prompt':
      return buildAstrolabeSynastryPromptApi(await readJson(context.request));
    // 新增术数系统（地基层之上的新体系）
    case 'metaphysics/bazhai/calculate':
      return calculateApiResult(context.request, calculateBaZhaiApi);
    case 'metaphysics/bazhai/prompt':
      return buildBaZhaiPrompt(await readJson(context.request));
    case 'metaphysics/zodiac/calculate':
      return calculateApiResult(context.request, calculateZodiacApi);
    case 'metaphysics/zodiac/prompt':
      return buildZodiacPrompt(await readJson(context.request));
    case 'metaphysics/taiyi/calculate':
      return calculateApiResult(context.request, calculateTaiyiApi);
    case 'metaphysics/taiyi/prompt':
      return buildTaiyiPrompt(await readJson(context.request));
    case 'metaphysics/wuyun-liuqi/calculate':
      return calculateApiResult(context.request, calculateWuyunLiuqiApi);
    case 'metaphysics/wuyun-liuqi/prompt':
      return buildWuyunLiuqiPromptApi(await readJson(context.request));
    case 'metaphysics/huangji-jingshi/calculate':
      return calculateApiResult(context.request, calculateHuangjiJingshiApi);
    case 'metaphysics/huangji-jingshi/prompt':
      return buildHuangjiJingshiPromptApi(await readJson(context.request));
    case 'metaphysics/qizheng/calculate':
      return calculateApiResult(context.request, calculateQizhengApi);
    case 'metaphysics/qizheng/prompt':
      return buildQizhengPrompt(await readJson(context.request));
    case 'metaphysics/xuankong/calculate':
      return calculateApiResult(context.request, calculateXuanKongApi);
    case 'metaphysics/xuankong/prompt':
      return buildXuanKongPrompt(await readJson(context.request));
    case 'metaphysics/residential/calculate':
      return calculateApiResult(context.request, calculateResidentialApi);
    case 'metaphysics/residential/prompt':
      return buildResidentialPrompt(await readJson(context.request));
    default:
      throw new ApiError(404, 'NOT_FOUND', '没有找到对应的 API 路径。');
  }
}

async function calculateApiResult(
  request: Request,
  calculate: (input: JsonRecord) => unknown | Promise<unknown>,
  optionalBody = false,
) {
  const input = await readJson(request, optionalBody);
  const result = await calculate(input);
  return shapeCalculationResult(result, readDetailMode(input));
}

function calculateTrueSolarTimeApi(input: JsonRecord) {
  const localDateTime = readRequiredString(input, 'localDateTime');
  const longitude = readNumberLike(input, 'longitude', -180, 180);
  const timezone =
    input.timezone === undefined ? undefined : readNumberLike(input, 'timezone', -12, 14);
  const timeZoneId =
    input.timeZoneId === undefined ? undefined : readRequiredString(input, 'timeZoneId');
  const applyChinaDst = readBoolean(input, 'applyChinaDst', false);
  try {
    return convertTrueSolarTime({
      localDateTime,
      longitude,
      timezone,
      timeZoneId,
      applyChinaDst,
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '真太阳时参数无效。',
    );
  }
}

function calculateTrueSolarBirthApi(input: JsonRecord) {
  try {
    return resolveTrueSolarBirthTime({
      dateType: readEnum(input, 'dateType', ['solar', 'lunar'] as const),
      year: readIntegerLike(input, 'year', 1900, 2100),
      month: readIntegerLike(input, 'month', 1, 12),
      day: readIntegerLike(input, 'day', 1, 31),
      hour: readIntegerLike(input, 'hour', 0, 23),
      minute: readIntegerLike(input, 'minute', 0, 59),
      second: input.second === undefined ? 0 : readIntegerLike(input, 'second', 0, 59),
      isLeapMonth: readBoolean(input, 'isLeapMonth', false),
      longitude: readNumberLike(input, 'longitude', -180, 180),
      timezone:
        input.timezone === undefined ? undefined : readNumberLike(input, 'timezone', -12, 14),
      timeZoneId:
        input.timeZoneId === undefined ? undefined : readRequiredString(input, 'timeZoneId'),
      applyChinaDst: readBoolean(input, 'applyChinaDst', false),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '出生真太阳时参数无效。',
    );
  }
}

function calculateSolarIlluminationApi(input: JsonRecord) {
  try {
    const timezone =
      input.timezone === undefined ? undefined : readNumberLike(input, 'timezone', -12, 14);
    const timeZoneId =
      input.timeZoneId === undefined ? undefined : readRequiredString(input, 'timeZoneId');
    if (timezone === undefined && !timeZoneId) {
      throw new ApiError(400, 'BAD_REQUEST', 'timezone 与 timeZoneId 至少需要提供一项。');
    }
    return calculateSolarIlluminationEvidence({
      year: readIntegerLike(input, 'year', 1900, 2200),
      month: readIntegerLike(input, 'month', 1, 12),
      day: readIntegerLike(input, 'day', 1, 31),
      hour: input.hour === undefined ? 12 : readIntegerLike(input, 'hour', 0, 23),
      minute: input.minute === undefined ? 0 : readIntegerLike(input, 'minute', 0, 59),
      second: input.second === undefined ? 0 : readIntegerLike(input, 'second', 0, 59),
      latitude: readNumberLike(input, 'latitude', -90, 90),
      longitude: readNumberLike(input, 'longitude', -180, 180),
      timezone,
      timeZoneId,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '太阳光照参数无效。',
    );
  }
}

function calculateAstronomicalTimeApi(input: JsonRecord) {
  try {
    const timezone =
      input.timezone === undefined ? undefined : readNumberLike(input, 'timezone', -12, 14);
    const timeZoneId =
      input.timeZoneId === undefined ? undefined : readRequiredString(input, 'timeZoneId');
    if (timezone === undefined && !timeZoneId) {
      throw new ApiError(400, 'BAD_REQUEST', 'timezone 与 timeZoneId 至少需要提供一项。');
    }
    return buildAstronomicalTimeEvidence({
      year: readIntegerLike(input, 'year', 1900, 2200),
      month: readIntegerLike(input, 'month', 1, 12),
      day: readIntegerLike(input, 'day', 1, 31),
      hour: input.hour === undefined ? 0 : readIntegerLike(input, 'hour', 0, 23),
      minute: input.minute === undefined ? 0 : readIntegerLike(input, 'minute', 0, 59),
      second: input.second === undefined ? 0 : readIntegerLike(input, 'second', 0, 59),
      timezone,
      timeZoneId,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '天文时间尺度参数无效。',
    );
  }
}

function calculateMoonPhaseApi(input: JsonRecord) {
  const utcDateTime = readRequiredString(input, 'utcDateTime');
  const date = new Date(utcDateTime);
  if (!isValidIsoDateTime(utcDateTime, date)) {
    throw new ApiError(400, 'BAD_REQUEST', 'utcDateTime 需为带 Z 或 UTC 偏移的有效 ISO 时间。');
  }
  try {
    return calculateMoonPhaseEvidence(date.getTime());
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '月相参数无效。',
    );
  }
}

function calculateSolarTermApi(input: JsonRecord) {
  try {
    return calculateSolarTermEvidence(
      readIntegerLike(input, 'year', 1900, 2200),
      readIntegerLike(input, 'index', 0, 23),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '节气参数无效。',
    );
  }
}

function calculateFoundationGanZhi(input: JsonRecord) {
  const ganZhi = readString(input, 'ganZhi', '');
  if (!ganZhi) throw new ApiError(400, 'BAD_REQUEST', 'ganZhi 必填。');
  try {
    return describeGanZhi(ganZhi);
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '干支参数无效。',
    );
  }
}

function calculateFoundationWuxing(input: JsonRecord) {
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 32) {
    throw new ApiError(400, 'BAD_REQUEST', 'items 必须是包含 1-32 个天干或地支的数组。');
  }
  if (!input.items.every((item) => typeof item === 'string')) {
    throw new ApiError(400, 'BAD_REQUEST', 'items 中每一项都必须是字符串。');
  }
  if (input.weightHidden !== undefined && typeof input.weightHidden !== 'boolean') {
    throw new ApiError(400, 'BAD_REQUEST', 'weightHidden 必须是布尔值。');
  }
  try {
    return analyzeWuxing(input.items, { weightHidden: input.weightHidden as boolean | undefined });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '五行分析参数无效。',
    );
  }
}

function calculateFoundationDirection(input: JsonRecord) {
  const degree = readNumber(input, 'degree', 0, 360);
  try {
    return analyzeCompassDirection(degree);
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '罗盘方位参数无效。',
    );
  }
}

function calculateFoundationShensha(input: JsonRecord) {
  const ids = input.ids;
  if (
    ids !== undefined &&
    (!Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 3 ||
      !ids.every((item) => typeof item === 'string') ||
      new Set(ids).size !== ids.length)
  ) {
    throw new ApiError(400, 'BAD_REQUEST', 'ids 必须是包含 1-3 个不重复神煞编号的字符串数组。');
  }
  try {
    return analyzeShenshaEvidence(
      {
        yearGanZhi: readRequiredString(input, 'yearGanZhi'),
        monthGanZhi: readRequiredString(input, 'monthGanZhi'),
        dayGanZhi: readRequiredString(input, 'dayGanZhi'),
        hourGanZhi: readRequiredString(input, 'hourGanZhi'),
      },
      ids as string[] | undefined,
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '通用神煞参数无效。',
    );
  }
}

// ===== 新增术数系统 API =====

function optInt(input: JsonRecord, key: string, min?: number, max?: number): number | undefined {
  const v = input[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是整数。`);
  }
  if (min !== undefined && v < min)
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能小于 ${min}。`);
  if (max !== undefined && v > max)
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能大于 ${max}。`);
  return v;
}

function optNumber(input: JsonRecord, key: string, min: number, max: number): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须是 ${min} 至 ${max} 之间的数字。`);
  }
  return value;
}

function buildSolarDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const date = new Date(year, month - 1, day, hour, minute, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new ApiError(400, 'BAD_REQUEST', '日期或时间无效。');
  }
  return date;
}

function buildMetaphysicsPrompt(
  basePrompt: string,
  input: JsonRecord,
  method: 'zodiac' | 'taiyi' | 'qizheng' | 'xuankong' | 'residential',
): string {
  const question =
    readString(input, 'question', '').trim() || '请综合解读本次排盘的重点、风险与行动建议。';
  const schools =
    input.schools === undefined ? undefined : readPromptSchools(input, getPromptSchoolIds(method));
  return buildSharedMetaphysicsPrompt(basePrompt, question, { method, schools });
}

function calculateBaZhaiApi(input: JsonRecord) {
  const gender =
    input.gender === 'female' ? 'female' : input.gender === 'male' ? 'male' : undefined;
  const birthYear = optInt(input, 'birthYear', 1900, 2100);
  const birthMonth = optInt(input, 'birthMonth', 1, 12);
  const birthDay = optInt(input, 'birthDay', 1, 31);
  const mingGua = readString(input, 'mingGua', '');
  const sitMountain = readString(input, 'sitMountain', '');
  const doorToInteriorDegree = optNumber(input, 'doorToInteriorDegree', 0, 360);
  const northReference = readString(input, 'northReference', '') || undefined;
  const magneticDeclinationDegrees = optNumber(input, 'magneticDeclinationDegrees', -30, 30);
  const measurementUncertaintyDegrees = optNumber(input, 'measurementUncertaintyDegrees', 0, 45);
  if (birthYear !== undefined && !gender) {
    throw new ApiError(400, 'BAD_REQUEST', '使用 birthYear 推命卦时必须同时提供 gender。');
  }
  if (birthYear === undefined && !mingGua) {
    throw new ApiError(400, 'BAD_REQUEST', '需提供 birthYear+gender 或直接给定 mingGua。');
  }
  if (mingGua && !BAGUA.includes(mingGua)) {
    throw new ApiError(400, 'BAD_REQUEST', `mingGua 必须是八卦之一：${BAGUA.join('、')}。`);
  }
  if (sitMountain && !TWENTY_FOUR_MOUNTAINS.includes(sitMountain)) {
    throw new ApiError(400, 'BAD_REQUEST', 'sitMountain 必须是有效的二十四山。');
  }
  if (sitMountain && doorToInteriorDegree !== undefined) {
    throw new ApiError(400, 'BAD_REQUEST', 'sitMountain 与 doorToInteriorDegree 只能提供一个。');
  }
  if (northReference && !['unspecified', 'magnetic', 'true'].includes(northReference)) {
    throw new ApiError(400, 'BAD_REQUEST', 'northReference 只能是 unspecified、magnetic 或 true。');
  }
  const baseInput: {
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    gender?: 'male' | 'female';
    mingGua?: string;
  } = {
    ...(birthYear !== undefined ? { birthYear, gender, birthMonth, birthDay } : {}),
    mingGua: mingGua || undefined,
  };
  return doorToInteriorDegree !== undefined
    ? bazhai.analyzeBaZhaiByDoorDegree({
        ...baseInput,
        doorToInteriorDegree,
        northReference: northReference as 'unspecified' | 'magnetic' | 'true' | undefined,
        magneticDeclinationDegrees,
        measurementUncertaintyDegrees,
      })
    : bazhai.analyzeBaZhai({ ...baseInput, sitMountain: sitMountain || undefined });
}

function buildBaZhaiPrompt(input: JsonRecord) {
  const result = calculateBaZhaiApi(input);
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: buildSharedMetaphysicsPrompt(
      result.prompt,
      readString(input, 'question', '').trim() || '请综合解读本次排盘的重点、风险与行动建议。',
      {
        method: 'bazhai',
        schools:
          input.schools === undefined
            ? undefined
            : readPromptSchools(input, getPromptSchoolIds('bazhai')),
        measurement: (result as { directionMeasurement?: { promptText: string } })
          .directionMeasurement?.promptText,
      },
    ),
    fullResult: result,
  });
}

function calculateZodiacApi(input: JsonRecord) {
  const zodiacName = readString(input, 'zodiac', '');
  if (!zodiacName) throw new ApiError(400, 'BAD_REQUEST', 'zodiac 必须是生肖或地支。');
  const yearGanZhi = readString(input, 'yearGanZhi', '');
  if (yearGanZhi && !isValidGanZhi(yearGanZhi)) {
    throw new ApiError(400, 'BAD_REQUEST', `yearGanZhi 不是有效的六十甲子：${yearGanZhi}。`);
  }
  const year = optInt(input, 'year', 1900, 2200);
  if (year === undefined && !yearGanZhi) {
    throw new ApiError(400, 'BAD_REQUEST', 'year 与 yearGanZhi 至少提供一个。');
  }
  try {
    return zodiac.calculateZodiacYearFortune({
      zodiac: zodiacName,
      ...(year !== undefined ? { year } : {}),
      ...(yearGanZhi ? { yearGanZhi } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '生肖流年参数无效。',
    );
  }
}

function buildZodiacPrompt(input: JsonRecord) {
  const result = calculateZodiacApi(input);
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: buildMetaphysicsPrompt(result.prompt, input, 'zodiac'),
    fullResult: result,
  });
}

function calculateTaiyiApi(input: JsonRecord) {
  const scope = readEnum(input, 'scope', ['year'], 'year');
  const year = readInteger(input, 'year', 1900, 2200);
  const ganZhi = readString(input, 'ganZhi', '');
  if (ganZhi && !isValidGanZhi(ganZhi)) {
    throw new ApiError(400, 'BAD_REQUEST', `ganZhi 不是有效的六十甲子：${ganZhi}。`);
  }
  try {
    return taiyi.generateTaiyi({
      scope,
      year,
      ...(ganZhi ? { ganZhi } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '太乙参数无效。',
    );
  }
}

function buildTaiyiPrompt(input: JsonRecord) {
  const result = calculateTaiyiApi(input);
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: buildMetaphysicsPrompt(result.prompt, input, 'taiyi'),
    fullResult: result,
  });
}

function calculateWuyunLiuqiApi(input: JsonRecord) {
  const year = optInt(input, 'year', 1, 9999);
  const yearGanZhi = readString(input, 'yearGanZhi', '').trim();
  const question = readString(input, 'question', '').trim();
  if (year === undefined && !yearGanZhi) {
    throw new ApiError(400, 'BAD_REQUEST', 'year 与 yearGanZhi 至少提供一个。');
  }
  if (yearGanZhi && !isValidGanZhi(yearGanZhi)) {
    throw new ApiError(400, 'BAD_REQUEST', `yearGanZhi 不是有效的六十甲子：${yearGanZhi}。`);
  }
  try {
    return wuyunLiuqi.calculateWuyunLiuqi({
      ...(year !== undefined ? { year } : {}),
      ...(yearGanZhi ? { yearGanZhi } : {}),
      ...(question ? { question } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '五运六气参数无效。',
    );
  }
}

function buildWuyunLiuqiPromptApi(input: JsonRecord) {
  const result = calculateWuyunLiuqiApi(input);
  const schools = readPromptSchools(input, getPromptSchoolIds('wuyun-liuqi')) as
    Array<'yunqi' | 'sitian' | 'kezhu'> | undefined;
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: wuyunLiuqi.buildWuyunLiuqiPrompt(
      result,
      readString(input, 'question', '').trim() || undefined,
      schools,
    ),
    resultSummary: {
      yearGanZhi: result.input.yearGanZhi,
      annualMovement: result.annualMovement,
      sitian: result.sitian,
      zaiquan: result.zaiquan,
      annualRelation: result.annualRelation,
      annualConformities: result.annualConformities,
      movementSteps: result.movementSteps,
      qiSteps: result.qiSteps,
    },
    fullResult: result,
  });
}

function calculateHuangjiJingshiApi(input: JsonRecord) {
  const epochYear = optInt(input, 'epochYear');
  const year = optInt(input, 'year');
  const elapsedYears = optInt(input, 'elapsedYears', 0);
  const question = readString(input, 'question', '').trim();
  if (epochYear === undefined) {
    if (year === undefined || elapsedYears !== undefined) {
      throw new ApiError(400, 'BAD_REQUEST', '通行公元值年卦模式必须只提供 year。');
    }
  } else if ((year === undefined) === (elapsedYears === undefined)) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      '自定义纪元模式的 year 与 elapsedYears 必须且只能提供一个。',
    );
  }
  try {
    return huangjiJingshi.calculateHuangjiJingshi({
      ...(epochYear !== undefined ? { epochYear } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(elapsedYears !== undefined ? { elapsedYears } : {}),
      ...(question ? { question } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '皇极经世参数无效。',
    );
  }
}

function buildHuangjiJingshiPromptApi(input: JsonRecord) {
  const result = calculateHuangjiJingshiApi(input);
  const schools = readPromptSchools(input, getPromptSchoolIds('huangji-jingshi')) as
    Array<'yuanhui' | 'guaqi'> | undefined;
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: huangjiJingshi.buildHuangjiJingshiPrompt(
      result,
      readString(input, 'question', '').trim() || undefined,
      schools,
    ),
    resultSummary: {
      input: result.input,
      position: result.position,
      progress: result.progress,
      conversion: result.conversion,
      forecast: result.forecast,
    },
    fullResult: result,
  });
}

function calculateQizhengApi(input: JsonRecord) {
  const year = readInteger(input, 'year', 1900, 2200);
  const month = readInteger(input, 'month', 1, 12);
  const day = readInteger(input, 'day', 1, 31);
  const hour = readInteger(input, 'hour', 0, 23);
  const minute = optInt(input, 'minute', 0, 59) ?? 0;
  buildSolarDate(year, month, day, hour, minute);
  const latitude = optNumber(input, 'latitude', -90, 90);
  const longitude = optNumber(input, 'longitude', -180, 180);
  const timezone = optNumber(input, 'timezone', -12, 14);
  const timeZoneId =
    input.timeZoneId === undefined ? undefined : readString(input, 'timeZoneId', '');
  const useTrueSolarTime = readBoolean(input, 'useTrueSolarTime', false);
  try {
    return qizheng.generateQizheng({
      year,
      month,
      day,
      hour,
      minute,
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
      ...(timeZoneId ? { timeZoneId } : {}),
      ...(useTrueSolarTime ? { useTrueSolarTime: true } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '七政四余参数无效。',
    );
  }
}

function calculateXuanKongApi(input: JsonRecord) {
  const year = readInteger(input, 'year', 1, 9999);
  const sitMountain =
    input.sitMountain === undefined ? undefined : readString(input, 'sitMountain', '');
  const facingMountain =
    input.facingMountain === undefined ? undefined : readString(input, 'facingMountain', '');
  const facingDegree =
    input.facingDegree === undefined ? undefined : readNumberLike(input, 'facingDegree', 0, 360);
  const sitDegree =
    input.sitDegree === undefined ? undefined : readNumberLike(input, 'sitDegree', 0, 360);
  const measurementUncertaintyDegrees =
    input.measurementUncertaintyDegrees === undefined
      ? undefined
      : readNumberLike(input, 'measurementUncertaintyDegrees', 0, 45);
  const guaType =
    input.guaType === undefined
      ? undefined
      : (readEnum(input, 'guaType', ['下卦', '替卦']) as '下卦' | '替卦');
  try {
    return xuankong.generateXuanKong({
      year,
      ...(sitMountain ? { sitMountain } : {}),
      ...(facingMountain ? { facingMountain } : {}),
      ...(facingDegree !== undefined ? { facingDegree } : {}),
      ...(sitDegree !== undefined ? { sitDegree } : {}),
      ...(measurementUncertaintyDegrees !== undefined ? { measurementUncertaintyDegrees } : {}),
      ...(guaType ? { guaType } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '玄空飞星参数无效。',
    );
  }
}

function calculateResidentialApi(input: JsonRecord) {
  const year = input.year === undefined ? undefined : readInteger(input, 'year', 1, 9999);
  const birthYear = optInt(input, 'birthYear', 1900, 2100);
  const birthMonth = optInt(input, 'birthMonth', 1, 12);
  const birthDay = optInt(input, 'birthDay', 1, 31);
  const gender =
    input.gender === 'female' ? 'female' : input.gender === 'male' ? 'male' : undefined;
  const mingGua = input.mingGua === undefined ? undefined : readString(input, 'mingGua', '');
  const sitMountain =
    input.sitMountain === undefined ? undefined : readString(input, 'sitMountain', '');
  const facingMountain =
    input.facingMountain === undefined ? undefined : readString(input, 'facingMountain', '');
  const facingDegree =
    input.facingDegree === undefined ? undefined : readNumberLike(input, 'facingDegree', 0, 360);
  const sitDegree =
    input.sitDegree === undefined ? undefined : readNumberLike(input, 'sitDegree', 0, 360);
  const doorToInteriorDegree = optNumber(input, 'doorToInteriorDegree', 0, 360);
  const northReference =
    input.northReference === undefined ? undefined : readString(input, 'northReference', '');
  const magneticDeclinationDegrees = optNumber(input, 'magneticDeclinationDegrees', -30, 30);
  const measurementUncertaintyDegrees = optNumber(input, 'measurementUncertaintyDegrees', 0, 45);
  const guaType =
    input.guaType === undefined
      ? undefined
      : (readEnum(input, 'guaType', ['下卦', '替卦']) as '下卦' | '替卦');

  if (mingGua && !BAGUA.includes(mingGua)) {
    throw new ApiError(400, 'BAD_REQUEST', `mingGua 必须是八卦之一：${BAGUA.join('、')}。`);
  }
  if (sitMountain && !TWENTY_FOUR_MOUNTAINS.includes(sitMountain)) {
    throw new ApiError(400, 'BAD_REQUEST', 'sitMountain 必须是有效的二十四山。');
  }
  if (facingMountain && !TWENTY_FOUR_MOUNTAINS.includes(facingMountain)) {
    throw new ApiError(400, 'BAD_REQUEST', 'facingMountain 必须是有效的二十四山。');
  }
  if (northReference && !['unspecified', 'magnetic', 'true'].includes(northReference)) {
    throw new ApiError(400, 'BAD_REQUEST', 'northReference 只能是 unspecified、magnetic 或 true。');
  }
  if (birthYear !== undefined && !gender && !mingGua) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      '使用 birthYear 推命卦时必须同时提供 gender，或直接给定 mingGua。',
    );
  }

  try {
    return residentialFengshui.generateResidentialFengshui({
      ...(year !== undefined ? { year } : {}),
      ...(birthYear !== undefined ? { birthYear } : {}),
      ...(birthMonth !== undefined ? { birthMonth } : {}),
      ...(birthDay !== undefined ? { birthDay } : {}),
      ...(gender ? { gender } : {}),
      ...(mingGua ? { mingGua } : {}),
      ...(sitMountain ? { sitMountain } : {}),
      ...(facingMountain ? { facingMountain } : {}),
      ...(facingDegree !== undefined ? { facingDegree } : {}),
      ...(sitDegree !== undefined ? { sitDegree } : {}),
      ...(doorToInteriorDegree !== undefined ? { doorToInteriorDegree } : {}),
      ...(northReference
        ? { northReference: northReference as 'unspecified' | 'magnetic' | 'true' }
        : {}),
      ...(magneticDeclinationDegrees !== undefined ? { magneticDeclinationDegrees } : {}),
      ...(measurementUncertaintyDegrees !== undefined ? { measurementUncertaintyDegrees } : {}),
      ...(guaType ? { guaType } : {}),
    });
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '住宅风水参数无效。',
    );
  }
}

function buildResidentialPrompt(input: JsonRecord) {
  const result = calculateResidentialApi(input);
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: buildMetaphysicsPrompt(result.prompt, input, 'residential'),
    fullResult: result,
  });
}

function buildXuanKongPrompt(input: JsonRecord) {
  const result = calculateXuanKongApi(input);
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: buildMetaphysicsPrompt(result.prompt, input, 'xuankong'),
    fullResult: result,
  });
}

function buildQizhengPrompt(input: JsonRecord) {
  const result = calculateQizhengApi(input);
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt: buildMetaphysicsPrompt(result.prompt, input, 'qizheng'),
    fullResult: result,
  });
}

function calculateBaziApi(input: JsonRecord) {
  const result = calculateBazi(input);
  return input.detailMode === 'compact' ? buildCompactBaziResult(result) : result;
}

function readBaziPerson(input: JsonRecord): Person {
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
    timezone: input.timezone === undefined ? undefined : readNumberLike(input, 'timezone', -12, 14),
    timeZoneId:
      input.timeZoneId === undefined ? undefined : readRequiredString(input, 'timeZoneId'),
    applyChinaDst:
      input.applyChinaDst === undefined ? undefined : readBoolean(input, 'applyChinaDst', false),
    shenShaScope: readEnum(input, 'shenShaScope', SHENSHA_SCOPES, 'common') as ShenShaScope,
    shenShaVariants: readShenShaVariants(input),
  };

  return person;
}

function calculateBazi(input: JsonRecord) {
  return baziCalculator.calculateBazi(readBaziPerson(input));
}

function readShenShaVariants(input: JsonRecord): Partial<ShenShaVariantConfig> | undefined {
  const value = input.shenShaVariants;
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new ApiError(400, 'BAD_REQUEST', 'shenShaVariants 必须是对象。');
  }

  const variants: Partial<ShenShaVariantConfig> = {};
  const referenceProfile = readOptionalEnum(value, 'referenceProfile', SHENSHA_REFERENCE_PROFILES);
  const kongWangBasis = readOptionalEnum(value, 'kongWangBasis', SHENSHA_KONG_WANG_BASIS);
  const yangRenMode = readOptionalEnum(value, 'yangRenMode', SHENSHA_YANG_REN_MODE);
  const tongZiScope = readOptionalEnum(value, 'tongZiScope', SHENSHA_TONG_ZI_SCOPE);

  if (referenceProfile) variants.referenceProfile = referenceProfile;
  if (kongWangBasis) variants.kongWangBasis = kongWangBasis;
  if (yangRenMode) variants.yangRenMode = yangRenMode;
  if (tongZiScope) variants.tongZiScope = tongZiScope;

  return variants;
}

function buildBaziFortuneContextFromInput(result: BaziChartResult, input: JsonRecord) {
  const scope = readEnum(input, 'baziFortuneScope', BAZI_FORTUNE_SCOPES, 'natal');
  const selection: BaziFortuneSelectionValue = {
    scope,
    cycleIndex:
      scope === 'natal' || scope === 'full'
        ? undefined
        : scope === 'dayun' || input.baziFortuneCycleIndex !== undefined
          ? readInteger(input, 'baziFortuneCycleIndex', 0, 99)
          : undefined,
    year:
      scope === 'year' || scope === 'month' || scope === 'day'
        ? readInteger(input, 'baziFortuneYear', 1900, 2200)
        : undefined,
    month:
      scope === 'month' || scope === 'day'
        ? readInteger(input, 'baziFortuneMonth', 1, 12)
        : undefined,
    day: scope === 'day' ? readInteger(input, 'baziFortuneDay', 1, 31) : undefined,
  };

  try {
    return buildFortuneSelectionContext(result, selection);
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '八字年限参数无效。',
    );
  }
}

function buildBaziPrompt(input: JsonRecord) {
  const result = calculateBazi(input);
  const fortuneScope = readEnum(input, 'baziFortuneScope', BAZI_FORTUNE_SCOPES, 'natal');
  const fortuneSelectionContext = buildBaziFortuneContextFromInput(result, input);
  const schoolValue = input.school;
  const school =
    typeof schoolValue === 'string' && (BAZI_SCHOOLS as readonly string[]).includes(schoolValue)
      ? (schoolValue as BaziSchool)
      : undefined;
  const schools = readPromptSchools(input, BAZI_MULTI_SCHOOLS) as BaziSchool[] | undefined;
  const basePrompt = buildBaziPromptForResult({
    result,
    question: readRequiredString(input, 'question'),
    topic: readEnum(input, 'promptTopic', BAZI_PROMPT_TOPICS, 'general') as BaziPromptTopic,
    mode: readEnum(input, 'promptMode', PROMPT_MODES, 'framework') as PromptMode,
    fortuneSelectionContext,
    fortuneScope,
    school,
    schools,
  });
  const prompt = basePrompt;

  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult: {
      ...result,
      ...(fortuneSelectionContext ? { fortuneSelection: fortuneSelectionContext } : {}),
    },
    resultSummary: {
      ...buildCompactBaziResult(result),
    },
  });
}

const BAZI_COMPATIBILITY_TYPES = [
  'marriage',
  'career',
  'friendship',
  'children',
  'parents',
  'siblings',
] as const;

function readBaziCompatibilityCharts(input: JsonRecord) {
  if (!isRecord(input.person1) || !isRecord(input.person2)) {
    throw new ApiError(400, 'BAD_REQUEST', 'person1 和 person2 必须是完整的八字出生资料。');
  }
  const chart1 = calculateBazi(input.person1);
  const chart2 = calculateBazi(input.person2);
  return { chart1, chart2 };
}

function calculateBaziCompatibilityApi(input: JsonRecord) {
  assertNoRandomOptions(input, '八字双盘是确定性计算，不接受 seed 或 replay。');
  const { chart1, chart2 } = readBaziCompatibilityCharts(input);
  const compatibility = analyzeBaziCompatibility(chart1, chart2, {
    person1Name: readString(input, 'person1Name', ''),
    person2Name: readString(input, 'person2Name', ''),
  });
  return { charts: { person1: chart1, person2: chart2 }, compatibility };
}

function buildBaziCompatibilityPromptApi(input: JsonRecord) {
  const result = calculateBaziCompatibilityApi(input);
  const promptParts = getCompatibilityPrompt(
    readString(input, 'question', ''),
    result.charts.person1,
    result.charts.person2,
    readEnum(input, 'compatType', BAZI_COMPATIBILITY_TYPES, 'marriage') as CompatType,
    {
      isCustomQuestion: readEnum(input, 'promptMode', PROMPT_MODES, 'framework') === 'custom',
      person1Name: readString(input, 'person1Name', ''),
      person2Name: readString(input, 'person2Name', ''),
    },
  );
  const basePrompt = [promptParts.system, promptParts.user].filter(Boolean).join('\n\n');
  const schools = readPromptSchools(input, BAZI_MULTI_SCHOOLS) as BaziSchool[] | undefined;
  const normalizedSchools = schools
    ? Array.from(new Set(schools.map((school) => (school === 'traditional' ? 'ziping' : school))))
    : undefined;
  const schoolText = formatPromptSchoolGuidance('bazi', normalizedSchools);
  const prompt = schoolText
    ? insertPromptSectionBeforeHeading(
        basePrompt,
        '【问题】',
        `【${normalizedSchools && normalizedSchools.length > 1 ? '多派合参' : '解读流派'}】\n${schoolText}`,
      )
    : basePrompt;
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult: result,
    resultSummary: {
      people: result.compatibility.people,
      dayMasterRelation: result.compatibility.dayMasterRelation,
      spousePalaceRelations: result.compatibility.spousePalaceRelations,
      summaryFact: result.compatibility.summaryFact,
    },
  });
}

async function calculateZiweiRuntime(input: JsonRecord, scopes: ScopeType[] = ['origin']) {
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
      timezone:
        input.timezone === undefined ? undefined : readNumberLike(input, 'timezone', -12, 14),
      timeZoneId:
        input.timeZoneId === undefined ? undefined : readRequiredString(input, 'timeZoneId'),
      applyChinaDst:
        input.applyChinaDst === undefined ? undefined : readBoolean(input, 'applyChinaDst', false),
      algorithm: readEnum(input, 'algorithm', ['default', 'zhongzhou'], 'default') as
        'default' | 'zhongzhou',
    }),
    Array.from(new Set(['origin' as ScopeType, ...scopes])),
  );
}

async function calculateZiwei(input: JsonRecord) {
  const scope = readEnum(input, 'promptScope', ZIWEI_PROMPT_SCOPES, 'origin') as ZiweiPromptScope;
  const result = buildSerializableZiweiResult(
    await calculateZiweiRuntime(input, getZiweiPromptCalculationScopes(scope)),
  );
  return input.detailMode === 'compact' ? buildCompactZiweiResult(result) : result;
}

async function buildZiweiPrompt(input: JsonRecord) {
  const scope = readEnum(input, 'promptScope', ZIWEI_PROMPT_SCOPES, 'origin') as ZiweiPromptScope;
  const result = await calculateZiweiRuntime(input, getZiweiPromptCalculationScopes(scope));
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
  const schools = readPromptSchools(input, ZIWEI_SCHOOLS) as ZiweiSchool[] | undefined;
  const serializableResult = buildSerializableZiweiResult(result);
  const prompt = buildPublicZiweiPromptForRuntime({
    result,
    question: readRequiredString(input, 'question'),
    topic: promptTopic,
    scope,
    mode,
    school,
    schools,
  });

  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult: serializableResult,
    resultSummary: buildCompactZiweiResult(serializableResult),
  });
}

async function readZiweiCompatibilityCharts(input: JsonRecord) {
  if (!isRecord(input.person1) || !isRecord(input.person2)) {
    throw new ApiError(400, 'BAD_REQUEST', 'person1 和 person2 必须是完整的紫微出生资料。');
  }
  const [person1, person2] = await Promise.all([
    calculateZiweiRuntime(input.person1, ['origin']),
    calculateZiweiRuntime(input.person2, ['origin']),
  ]);
  const person1Name =
    readString(input, 'person1Name', '') || readString(input.person1, 'name', '') || '第一人';
  const person2Name =
    readString(input, 'person2Name', '') || readString(input.person2, 'name', '') || '第二人';
  return { person1, person2, person1Name, person2Name };
}

async function calculateZiweiCompatibilityApi(input: JsonRecord) {
  assertNoRandomOptions(input, '紫微双盘是确定性计算，不接受 seed 或 replay。');
  const charts = await readZiweiCompatibilityCharts(input);
  const compatibility = analyzeZiweiCompatibility(
    charts.person1.payloadByScope.origin,
    charts.person2.payloadByScope.origin,
    {
      person1Name: charts.person1Name,
      person2Name: charts.person2Name,
      astrolabe1: charts.person1.astrolabe,
      astrolabe2: charts.person2.astrolabe,
    },
  );
  return {
    charts: {
      person1: buildSerializableZiweiResult(charts.person1),
      person2: buildSerializableZiweiResult(charts.person2),
    },
    compatibility,
  };
}

async function buildZiweiCompatibilityPromptApi(input: JsonRecord) {
  assertNoRandomOptions(input, '紫微双盘是确定性计算，不接受 seed 或 replay。');
  const charts = await readZiweiCompatibilityCharts(input);
  const compatibility = analyzeZiweiCompatibility(
    charts.person1.payloadByScope.origin,
    charts.person2.payloadByScope.origin,
    {
      person1Name: charts.person1Name,
      person2Name: charts.person2Name,
      astrolabe1: charts.person1.astrolabe,
      astrolabe2: charts.person2.astrolabe,
    },
  );
  const topic = readEnum(input, 'promptTopic', ZIWEI_PROMPT_TOPICS, 'relationship');
  const prompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: charts.person1.payloadByScope.origin,
    partnerPayload: charts.person2.payloadByScope.origin,
    primaryAstrolabe: charts.person1.astrolabe,
    partnerAstrolabe: charts.person2.astrolabe,
    primaryTrueSolarEvidence: charts.person1.trueSolarEvidence,
    partnerTrueSolarEvidence: charts.person2.trueSolarEvidence,
    primaryName: charts.person1Name,
    partnerName: charts.person2Name,
    topic,
    question: readString(input, 'question', ''),
    isCustomQuestion: readEnum(input, 'promptMode', PROMPT_MODES, 'framework') === 'custom',
    schools: readPromptSchools(input, ZIWEI_SCHOOLS) as ZiweiSchool[] | undefined,
  });
  const fullResult = {
    charts: {
      person1: buildSerializableZiweiResult(charts.person1),
      person2: buildSerializableZiweiResult(charts.person2),
    },
    compatibility,
  };
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult,
    resultSummary: {
      key: compatibility.key,
      status: compatibility.status,
      people: compatibility.people,
      summaryFact: compatibility.summaryFact,
    },
  });
}

async function buildBaziZiweiPrompt(input: JsonRecord) {
  const baziResult = calculateBazi(input);
  const scope = readEnum(input, 'promptScope', ZIWEI_PROMPT_SCOPES, 'origin') as ZiweiPromptScope;
  const ziweiResult = await calculateZiweiRuntime(input, getZiweiPromptCalculationScopes(scope));
  const baziTopic = readEnum(
    input,
    'baziPromptTopic',
    BAZI_PROMPT_TOPICS,
    'general',
  ) as BaziPromptTopic;
  const ziweiTopic =
    input.ziweiPromptTopic === undefined
      ? undefined
      : (readEnum(input, 'ziweiPromptTopic', ZIWEI_PROMPT_TOPICS) as ZiweiPromptTopic);
  const mode = readEnum(input, 'promptMode', PROMPT_MODES, 'framework') as PromptMode;
  const baziSchoolValue = input.baziSchool;
  const baziSchool =
    typeof baziSchoolValue === 'string' &&
    (BAZI_SCHOOLS as readonly string[]).includes(baziSchoolValue)
      ? (baziSchoolValue as BaziSchool)
      : undefined;
  const ziweiSchoolValue = input.ziweiSchool;
  const ziweiSchool =
    typeof ziweiSchoolValue === 'string' &&
    (ZIWEI_SCHOOLS as readonly string[]).includes(ziweiSchoolValue)
      ? (ziweiSchoolValue as ZiweiSchool)
      : undefined;
  const baziSchools = readPromptSchools(input, BAZI_MULTI_SCHOOLS, 'baziSchools') as
    BaziSchool[] | undefined;
  const ziweiSchools = readPromptSchools(input, ZIWEI_SCHOOLS, 'ziweiSchools') as
    ZiweiSchool[] | undefined;
  const serializableZiweiResult = buildSerializableZiweiResult(ziweiResult);
  const prompt = buildBaziZiweiPromptForResults({
    baziResult,
    ziweiResult,
    question: readRequiredString(input, 'question'),
    baziTopic,
    ziweiTopic,
    ziweiScope: scope,
    mode,
    baziSchool,
    baziSchools,
    ziweiSchool,
    ziweiSchools,
  });
  const fullResult = {
    bazi: baziResult,
    ziwei: serializableZiweiResult,
  };

  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    fullResult,
    resultSummary: {
      bazi: buildCompactBaziResult(baziResult),
      ziwei: buildCompactZiweiResult(serializableZiweiResult),
    },
  });
}

function calculateLiuyao(input: JsonRecord) {
  const method = readOptionalEnum(input, 'liuyaoMethod', ['time', 'manual', 'coins'] as const);
  const yaos = readOptionalIntegerArray(input, 'yaos', 6, 6, 9);
  const randomOptions = readRandomOptions(input);
  const options: LiuyaoGenerationOptions | undefined =
    method || yaos || randomOptions
      ? {
          method,
          yaos,
          ...randomOptions,
        }
      : undefined;
  return generateLiuyao(readCustomDate(input), options);
}

function calculateQimen(input: JsonRecord) {
  assertNoRandomOptions(input, '奇门遁甲是确定性排盘，不接受 seed 或 replay。');
  const method = readEnum(input, 'qimenMethod', ['zhuanpan', 'feipan'], 'zhuanpan');
  const juMethod = readEnum(input, 'qimenJuMethod', ['chaibu', 'zhirun'], 'chaibu');
  return generateQimen(
    readCustomDate(input),
    method as 'zhuanpan' | 'feipan',
    'hour',
    juMethod as 'chaibu' | 'zhirun',
  );
}

function calculateQimenApi(input: JsonRecord) {
  const result = calculateQimen(input);
  return input.detailMode === 'compact' ? buildCompactQimenResult(result) : result;
}

function calculateMeihua(input: JsonRecord) {
  const method = readEnum(input, 'method', ['time', 'number', 'random', 'timeTrigram'], 'time');
  const settings: MeihuaSettings = {
    method,
    ...(method === 'number' ? { number: readInteger(input, 'number', 1) } : {}),
    ...(method === 'random' ? readRandomOptions(input) : {}),
  };
  if (method !== 'random') assertNoRandomOptions(input, '梅花易数仅随机起卦接受 seed 或 replay。');

  return generateMeihua(readCustomDate(input), settings);
}

function calculateLiuren(input: JsonRecord) {
  assertNoRandomOptions(input, '大六壬是确定性排盘，不接受 seed 或 replay。');
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
  assertNoRandomOptions(input, '小六壬是确定性时间起课，不接受 seed 或 replay。');
  const method = readEnum(
    input,
    'xiaoliurenMethod',
    ['time'],
    'time',
  ) as XiaoliurenDivinationMethod;
  if (input.xiaoliurenSchool !== undefined || input.xiaoliurenNumber !== undefined) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      '小六壬已移除无可靠来源的流派和数字起课参数，当前仅接受时间起课。',
    );
  }
  return generateXiaoliuren({
    method,
    customDate: readCustomDate(input),
  });
}

function calculateJinkoujue(input: JsonRecord) {
  const method = readEnum(input, 'jinkoujueMethod', ['time', 'number', 'random'], 'time') as
    'time' | 'number' | 'random';
  if (method !== 'random') {
    assertNoRandomOptions(input, '金口诀仅随机起课接受 seed 或 replay。');
  }
  return generateJinkoujue({
    method,
    customDate: readCustomDate(input),
    ...(method === 'number' ? { number: readInteger(input, 'jinkoujueNumber', 1) } : {}),
    ...(method === 'random' ? readRandomOptions(input) : {}),
  });
}

function calculateTarot(input: JsonRecord) {
  const randomOptions = readRandomOptions(input);
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
  return drawTarotSpread(spreadType, randomOptions);
}

function drawSsgw(input: JsonRecord) {
  return drawRandomSign(readCustomDate(input), readRandomOptions(input));
}

function calculateSsgw(input: JsonRecord) {
  return drawSsgw(input);
}

function calculateAlmanac(input: JsonRecord) {
  assertNoRandomOptions(input, '黄历择日是确定性计算，不接受 seed 或 replay。');
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
    readRandomOptions(input),
  );
}

function calculateAstrolabe(input: JsonRecord) {
  assertNoRandomOptions(input, '星盘是确定性排盘，不接受 seed 或 replay。');
  const birthDate = readBirthDate(input, { dateType: 'solar' });
  const timezone = optNumber(input, 'timezone', -12, 14);
  const timeZoneId =
    input.timeZoneId === undefined ? undefined : readString(input, 'timeZoneId', '');
  if (timezone === undefined && !timeZoneId) {
    throw new ApiError(400, 'BAD_REQUEST', 'timezone 与 timeZoneId 至少需要提供一项。');
  }
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
    ...(timezone !== undefined ? { timezone: String(timezone) } : {}),
    ...(timeZoneId ? { timeZoneId } : {}),
    locationName: readString(input, 'locationName', ''),
    useTrueSolarTime: readBoolean(input, 'useTrueSolarTime', false),
  };
  return generateAstrolabe(astrolabeInput);
}

function readAstrolabeSynastryCharts(input: JsonRecord) {
  if (!isRecord(input.person1) || !isRecord(input.person2)) {
    throw new ApiError(400, 'BAD_REQUEST', 'person1 和 person2 必须是完整的星盘出生资料。');
  }
  const chart1 = calculateAstrolabe(input.person1);
  const chart2 = calculateAstrolabe(input.person2);
  return { chart1, chart2 };
}

function calculateAstrolabeSynastryApi(input: JsonRecord) {
  assertNoRandomOptions(input, '西占双盘是确定性计算，不接受 seed 或 replay。');
  const { chart1, chart2 } = readAstrolabeSynastryCharts(input);
  const synastry = analyzeAstrolabeSynastry(chart1, chart2);
  return { charts: { person1: chart1, person2: chart2 }, synastry };
}

function buildAstrolabeSynastryPromptApi(input: JsonRecord) {
  const result = calculateAstrolabeSynastryApi(input);
  const prompt = buildAstrolabeSynastryPrompt({
    chart1: result.charts.person1,
    chart2: result.charts.person2,
    synastry: result.synastry,
    question: readString(input, 'question', ''),
    promptMode: readEnum(input, 'promptMode', PROMPT_MODES, 'framework'),
    schools:
      input.schools === undefined
        ? undefined
        : readPromptSchools(input, getPromptSchoolIds('astrolabe')),
  });
  return buildPromptApiResult({
    responseMode: readPromptResponseMode(input),
    prompt,
    summary: result.synastry.summary,
    fullResult: result,
    resultSummary: {
      key: result.synastry.key,
      status: result.synastry.status,
      people: result.synastry.people,
      summary: {
        totalAspects: result.synastry.summary.totalAspects,
        harmonious: result.synastry.summary.harmonious,
        tense: result.synastry.summary.tense,
        neutral: result.synastry.summary.neutral,
        tightAspects: result.synastry.summary.tightAspects,
      },
      summaryFact: buildCompactAstrolabeSynastrySummaryFact(result.synastry.summaryFact),
    },
  });
}

function buildAstrolabeFullScopePromptText(data: AstrolabeData, referenceDateStr: string) {
  const fullContexts = buildAstrolabeFullScopeContexts(data, referenceDateStr);
  const contexts = [
    fullContexts.natal,
    fullContexts.yearly,
    fullContexts.monthly,
    fullContexts.daily,
  ];
  const lines = contexts
    .map((context) => context.promptText)
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`);

  return ['分析对象：本命盘与完整行运资料。', '完整星盘行运资料：', ...lines].join('\n');
}

function buildAstrolabePromptScopeText(input: JsonRecord, data: AstrolabeData) {
  const customText = readString(input, 'astrolabeScopeText', '').trim();
  if (customText) return customText;

  const scope = readEnum(
    input,
    'astrolabeScope',
    ASTROLABE_PROMPT_SCOPES,
    'natal',
  ) as (typeof ASTROLABE_PROMPT_SCOPES)[number];
  const dateStr = scope === 'natal' ? '' : readRequiredString(input, 'astrolabeScopeDate');

  try {
    if (scope === 'full') {
      return buildAstrolabeFullScopePromptText(data, dateStr);
    }

    return buildAstrolabeScopeContext(data, scope, dateStr).promptText;
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '星盘行运日期无效。',
    );
  }
}

function buildAstrolabeScopeEvidence(input: JsonRecord, data: AstrolabeData) {
  const customText = readString(input, 'astrolabeScopeText', '').trim();
  if (customText) {
    return { scope: 'custom' as const, promptText: customText };
  }

  const scope = readEnum(
    input,
    'astrolabeScope',
    ASTROLABE_PROMPT_SCOPES,
    'natal',
  ) as (typeof ASTROLABE_PROMPT_SCOPES)[number];
  const dateStr = scope === 'natal' ? '' : readRequiredString(input, 'astrolabeScopeDate');
  try {
    if (scope === 'full') {
      return {
        scope: 'full' as const,
        referenceDate: dateStr,
        contexts: buildAstrolabeFullScopeContexts(data, dateStr),
      };
    }

    return buildAstrolabeScopeContext(data, scope, dateStr);
  } catch (error) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      error instanceof Error ? error.message : '星盘行运日期无效。',
    );
  }
}

function buildDivinationPromptResult(
  method: Exclude<DivinationMethodId, 'random'>,
  input: JsonRecord,
) {
  if (method === 'ssgw' && input.schools !== undefined) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      '三山国王灵签不提供解读流派或断法选择，请移除 schools。',
    );
  }
  const question =
    method === 'almanac'
      ? readString(input, 'question', '')
      : readRequiredString(input, 'question');
  const rawData = calculateDivinationData(method, input);
  const promptData =
    method === 'almanac' ? shapeAlmanacPromptData(rawData as AlmanacData, input) : rawData;
  const fullResult =
    method === 'almanac'
      ? shapeAlmanacResult(rawData as AlmanacData, input)
      : method === 'ssgw'
        ? rawData
        : method === 'astrolabe'
          ? {
              ...(rawData as AstrolabeData),
              scopeEvidence: buildAstrolabeScopeEvidence(input, rawData as AstrolabeData),
            }
          : rawData;
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
      return calculateLiuyao(input);
    case 'meihua':
      return calculateMeihua(input);
    case 'xiaoliuren':
      return calculateXiaoliuren(input);
    case 'jinkoujue':
      return calculateJinkoujue(input);
    case 'qimen':
      return calculateQimen(input);
    case 'liuren':
      return calculateLiuren(input);
    case 'tarot':
      return calculateTarot(input);
    case 'ssgw':
      return drawSsgw(input);
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
  const baseSupplementaryInfo = readSupplementaryInfo(input);
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
  const schools =
    method === 'ssgw' || input.schools === undefined
      ? undefined
      : readPromptSchools(input, getPromptSchoolIds(method as PromptSchoolMethod));

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
      method === 'astrolabe'
        ? buildAstrolabePromptScopeText(input, data as AstrolabeData)
        : undefined,
    schools,
  });
}

function readSupplementaryInfo(input: JsonRecord): SupplementaryInfo | undefined {
  const value = input.supplementaryInfo;
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new ApiError(400, 'BAD_REQUEST', 'supplementaryInfo 必须是对象。');
  }

  const info: SupplementaryInfo = {};
  const gender = readEnum(value, 'gender', ['男', '女', ''], '');
  if (gender) {
    info.gender = gender;
  }

  const birthYear = optInt(value, 'birthYear', 1, 9999);
  if (birthYear !== undefined) {
    info.birthYear = birthYear;
  }

  const textFields = [
    'userSupplement',
    'currentSituation',
    'currentState',
    'knownFacts',
    'desiredOutcome',
    'constraints',
  ] as const;
  for (const key of textFields) {
    if (value[key] !== undefined) {
      const text = readString(value, key, '');
      if (text) {
        info[key] = text;
      }
    }
  }

  const rawMeihuaSettings = value.meihuaSettings;
  if (rawMeihuaSettings !== undefined) {
    if (!isRecord(rawMeihuaSettings)) {
      throw new ApiError(400, 'BAD_REQUEST', 'supplementaryInfo.meihuaSettings 必须是对象。');
    }

    const meihuaSettings: MeihuaSettings = {};
    if (rawMeihuaSettings.method !== undefined) {
      meihuaSettings.method = readEnum(rawMeihuaSettings, 'method', [
        'time',
        'number',
        'random',
        'timeTrigram',
      ]);
    }
    const number = optInt(rawMeihuaSettings, 'number', 1);
    if (number !== undefined) {
      meihuaSettings.number = number;
    }
    if (Object.keys(meihuaSettings).length > 0) {
      info.meihuaSettings = meihuaSettings;
    }
  }

  return Object.keys(info).length > 0 ? info : undefined;
}

function readPromptResponseMode(input: JsonRecord) {
  return readEnum(input, 'responseMode', PROMPT_RESPONSE_MODES, 'prompt-only');
}

function readDetailMode(input: JsonRecord) {
  return readEnum(input, 'detailMode', DETAIL_MODES, 'compact');
}

function buildPromptApiResult(params: {
  responseMode: (typeof PROMPT_RESPONSE_MODES)[number];
  prompt: string;
  summary?: unknown;
  fullResult: unknown;
  resultSummary?: unknown;
}) {
  const prompt = params.prompt;
  if (params.responseMode === 'prompt-only') {
    return { prompt };
  }

  if (params.responseMode === 'full') {
    return {
      result: params.fullResult,
      ...(params.summary === undefined ? {} : { summary: params.summary }),
      prompt,
    };
  }

  return {
    ...(params.resultSummary === undefined ? {} : { resultSummary: params.resultSummary }),
    ...(params.summary === undefined ? {} : { summary: params.summary }),
    prompt,
  };
}

function buildCompactBaziResult(result: BaziChartResult) {
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
    wuxingStrength: result.wuxingStrength,
    analysis: result.analysis,
    mingGong: result.mingGong,
    shenGong: result.shenGong,
    taiYuan: result.taiYuan,
    taiXi: result.taiXi,
    kongWang: result.kongWang,
    monthCommander: result.monthCommander,
    luckInfo: {
      startInfo: result.luckInfo.startInfo,
      cycles: result.luckInfo.cycles.map((cycle) => ({
        age: cycle.age,
        year: cycle.year,
        ganZhi: cycle.ganZhi,
      })),
    },
    warnings: result.warnings,
  };
}

function buildCompactZiweiResult(result: ReturnType<typeof buildSerializableZiweiResult>) {
  return {
    basicInfo: result.basicInfo,
    calculationConfig: result.calculationConfig,
    scopeNames: result.scopeNames,
    evidenceSummaryByScope: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        payload.evidence_analysis
          ? {
              status: payload.evidence_analysis.status,
              summaryFact: buildCompactZiweiEvidenceSummaryFact(
                payload.evidence_analysis.summaryFact,
              ),
            }
          : undefined,
      ]),
    ),
    patternSummaryByScope: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        payload.pattern_analysis
          ? {
              status: payload.pattern_analysis.status,
              summaryFact: buildCompactZiweiPatternSummaryFact(
                payload.pattern_analysis.summaryFact,
              ),
            }
          : undefined,
      ]),
    ),
    activeScopes: Object.fromEntries(
      Object.entries(result.payloadByScope).map(([scope, payload]) => [
        scope,
        {
          active_scope: payload.active_scope,
          palaces: payload.palaces.map((palace) => ({
            index: palace.index,
            name: palace.name,
            is_body_palace: palace.is_body_palace,
            major_stars: palace.major_stars.map((star) => ({
              name: star.name,
              brightness: star.brightness,
              birth_mutagen: star.birth_mutagen,
            })),
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

function buildCompactZiweiEvidenceSummaryFact(
  summaryFact: NonNullable<
    ReturnType<
      typeof buildSerializableZiweiResult
    >['payloadByScope'][ScopeType]['evidence_analysis']
  >['summaryFact'],
) {
  return {
    key: summaryFact.key,
    status: summaryFact.status,
    evidenceFactCount: summaryFact.evidenceFactCount,
    natalFactCount: summaryFact.natalFactCount,
    scopeFactCount: summaryFact.scopeFactCount,
    primaryFactCount: summaryFact.primaryFactCount,
    supportingFactCount: summaryFact.supportingFactCount,
    missingFactCount: summaryFact.missingFactCount,
    counterEvidenceCount: summaryFact.counterEvidenceCount,
    limitationFactCount: summaryFact.limitationFactCount,
  };
}

function buildCompactZiweiPatternSummaryFact(
  summaryFact: NonNullable<
    ReturnType<typeof buildSerializableZiweiResult>['payloadByScope'][ScopeType]['pattern_analysis']
  >['summaryFact'],
) {
  return {
    key: summaryFact.key,
    status: summaryFact.status,
    registeredRuleCount: summaryFact.registeredRuleCount,
    evaluatedRuleCount: summaryFact.evaluatedRuleCount,
    unevaluatedRuleCount: summaryFact.unevaluatedRuleCount,
    matchedPatternCount: summaryFact.matchedPatternCount,
    unmatchedRuleCount: summaryFact.unmatchedRuleCount,
    auspiciousPatternCount: summaryFact.auspiciousPatternCount,
    inauspiciousPatternCount: summaryFact.inauspiciousPatternCount,
    neutralPatternCount: summaryFact.neutralPatternCount,
    counterEvidenceCount: summaryFact.counterEvidenceCount,
    limitationFactCount: summaryFact.limitationFactCount,
  };
}

function buildCompactAstrolabeSynastrySummaryFact(
  summaryFact: ReturnType<typeof analyzeAstrolabeSynastry>['summaryFact'],
) {
  return {
    key: summaryFact.key,
    status: summaryFact.status,
    selectedPointCount1: summaryFact.selectedPointCount1,
    selectedPointCount2: summaryFact.selectedPointCount2,
    evaluatedPairCount: summaryFact.evaluatedPairCount,
    matchedAspectCount: summaryFact.matchedAspectCount,
    returnedAspectCount: summaryFact.returnedAspectCount,
    truncatedAspectCount: summaryFact.truncatedAspectCount,
    houseOverlayCount: summaryFact.houseOverlayCount,
    coreHouseOverlayCount: summaryFact.coreHouseOverlayCount,
    aspectTypeCounts: summaryFact.aspectTypeCounts,
    tendencyCounts: summaryFact.tendencyCounts,
  };
}

function buildCompactQimenResult(result: ReturnType<typeof generateQimen>) {
  const classicPatterns = (result.classicPatterns ?? []).slice(
    0,
    MAX_COMPACT_QIMEN_CLASSIC_PATTERNS,
  );
  const patternCombos = (result.patternCombos ?? []).slice(0, MAX_COMPACT_QIMEN_PATTERN_COMBOS);

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
      summary: pattern.summary,
      palaces: pattern.palaces,
    })),
    stemRelations: result.stemRelations,
    patternComboTotal: result.patternCombos?.length ?? 0,
    patternCombos: patternCombos.map((combo) => ({
      key: combo.key,
      name: combo.name,
      tone: combo.tone,
      summary: combo.summary,
      palace: combo.palace,
    })),
    directions: result.directions
      ? {
          goodDirections: result.directions.goodDirections.map((item) => ({
            gong: item.gong,
            name: item.name,
            direction: item.direction,
            use: item.use,
            reasons: item.reasons,
          })),
          avoidDirections: result.directions.avoidDirections.map((item) => ({
            gong: item.gong,
            name: item.name,
            direction: item.direction,
            use: item.use,
            reasons: item.reasons,
          })),
        }
      : undefined,
    yingQi: result.yingQi,
    timestamp: result.timestamp,
  };
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
  if (!shouldPaginate) return result;
  const shaped = { ...result, days: selectedDays };
  shaped.evidenceAnalysis = analyzeAlmanacEvidence(shaped);
  return shaped;
}

function shapeAlmanacResult(result: AlmanacData, input: JsonRecord): AlmanacApiResult {
  const detailMode = readDetailMode(input);
  const { shouldPaginate, selectedDays, pagination } = readAlmanacPageSelection(result, input);
  const days = detailMode === 'compact' ? selectedDays.map(compactAlmanacDay) : selectedDays;

  return {
    ...result,
    days,
    evidenceAnalysis: analyzeAlmanacEvidence({ ...result, days: selectedDays }),
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

function readPromptSchools(
  input: JsonRecord,
  allowedValues: readonly string[],
  key = 'schools',
): string[] | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须包含一至三个解读口径。`);
  }
  const selected = value.map((item, index) => {
    if (typeof item !== 'string' || !allowedValues.includes(item)) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `${key}[${index}] 必须是以下值之一：${allowedValues.join('、')}。`,
      );
    }
    return item;
  });
  if (new Set(selected).size !== selected.length) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 不能包含重复解读口径。`);
  }
  return selected;
}

function readOptionalIntegerArray(
  input: JsonRecord,
  key: string,
  expectedLength: number,
  min: number,
  max: number,
): number[] | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 必须恰好包含 ${expectedLength} 个整数。`);
  }
  return value.map((item, index) => {
    if (!Number.isSafeInteger(item) || item < min || item > max) {
      throw new ApiError(400, 'BAD_REQUEST', `${key}[${index}] 必须是 ${min}-${max} 之间的整数。`);
    }
    return item;
  });
}

function readRandomOptions(input: JsonRecord): RandomOptions | undefined {
  const seedValue = input.seed;
  let seed: string | number | undefined;
  if (seedValue !== undefined) {
    if (typeof seedValue === 'string') {
      if (!seedValue || seedValue.length > 256) {
        throw new ApiError(400, 'BAD_REQUEST', 'seed 必须是 1-256 个字符的文本或有限数字。');
      }
      seed = seedValue;
    } else if (typeof seedValue === 'number' && Number.isFinite(seedValue)) {
      seed = seedValue;
    } else {
      throw new ApiError(400, 'BAD_REQUEST', 'seed 必须是文本或有限数字。');
    }
  }

  const replayValue = input.replay;
  let replay: number[] | undefined;
  if (replayValue !== undefined) {
    if (!Array.isArray(replayValue) || replayValue.length === 0 || replayValue.length > 256) {
      throw new ApiError(400, 'BAD_REQUEST', 'replay 必须是包含 1-256 个随机样本的数组。');
    }
    replay = replayValue.map((item, index) => {
      if (typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item >= 1) {
        throw new ApiError(
          400,
          'BAD_REQUEST',
          `replay[${index}] 必须是大于等于 0 且小于 1 的数字。`,
        );
      }
      return item;
    });
  }
  if (seed !== undefined && replay !== undefined) {
    throw new ApiError(400, 'BAD_REQUEST', 'seed 与 replay 只能提供一个。');
  }
  return seed !== undefined || replay !== undefined ? { seed, replay } : undefined;
}

function assertNoRandomOptions(input: JsonRecord, message: string): void {
  if (input.seed !== undefined || input.replay !== undefined) {
    throw new ApiError(400, 'BAD_REQUEST', message);
  }
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
