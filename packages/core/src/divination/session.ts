import type { DivinationMethodId } from './config';
import { generateAlmanacSelection } from './algorithms/almanac';
import { generateAstrolabe } from './algorithms/astrolabe';
import { generateJinkoujue } from './algorithms/jinkoujue';
import { generateLiuyao, type LiuyaoGenerationOptions } from './algorithms/liuyao';
import { generateLiuren } from './algorithms/liuren/index';
import { drawLenormandSpread } from './algorithms/lenormand';
import { generateMeihua } from './algorithms/meihua/index';
import { generateQimen, type QimenMethod, type QimenScope } from './algorithms/qimen/index';
import { drawRandomSign, resolveSignByNumber } from './algorithms/ssgw';
import { generateXiaoliuren } from './algorithms/xiaoliuren';
import { generateTaiyi } from '../taiyi/index';
import { drawTarotSpread, type TarotDrawOptions, type TarotManualCardInput } from './tarot';
import type { RandomOptions } from '../shared/random';
import { createRandomContext, randomInt } from '../shared/random';
import { serializeCoreResult } from '../shared/result';
import {
  buildDivinationPromptDocument,
  formatDivinationInfo,
  getDivinationSummaryBlocks,
  type DivinationPromptOptions,
} from '../prompt/divination';
import type { PromptDocument } from '../prompt/types';
import type {
  AlmanacParticipantInput,
  AlmanacTopic,
  AstrolabeBirthInput,
  DivinationData,
  JinkoujueDivinationMethod,
  LenormandSpreadType,
  MeihuaSettings,
  SupplementaryInfo,
  TarotSpreadType,
  TaiyiResult,
  TaiyiScope,
  XiaoliurenDivinationMethod,
} from '../types/divination';

export type QimenJuMethod = 'chaibu' | 'zhirun';

export type DivinationSessionMethod = Exclude<DivinationMethodId, 'random'>;

export interface DivinationRequest {
  /** 指定占法；random 会从可独立起课的占法中稳定选择一种。 */
  method: DivinationMethodId;
  question?: string;
  questionSource?: 'custom' | 'inspiration';
  /** 起课时间；未提供时由各算法使用当前时间。 */
  divinationTime?: Date | string | number;
  /** 提示词中的当前时间；未提供时使用运行环境当前时间。 */
  currentTime?: Date | string | number;
  /** 随机占法的统一随机设置，支持 seed、replay 和自定义随机源。 */
  random?: RandomOptions;
  supplementaryInfo?: SupplementaryInfo;
  liuyao?: LiuyaoGenerationOptions;
  meihua?: MeihuaSettings;
  xiaoliuren?: { method?: XiaoliurenDivinationMethod };
  jinkoujue?: {
    method?: JinkoujueDivinationMethod;
    number?: number;
  };
  qimen?: {
    method?: QimenMethod;
    scope?: QimenScope;
    juMethod?: QimenJuMethod;
  };
  tarot?: {
    spread?: TarotSpreadType;
    manualCards?: readonly TarotManualCardInput[];
    interactiveSamples?: readonly number[];
  };
  ssgw?: { method?: 'random' | 'manual'; number?: number };
  almanac?: {
    topic: AlmanacTopic;
    startDate: string;
    endDate: string;
    participants?: AlmanacParticipantInput[];
  };
  lenormand?: {
    spread?: LenormandSpreadType;
    manualCardIds?: readonly number[];
    interactiveSamples?: readonly number[];
  };
  astrolabe?: AstrolabeBirthInput;
  taiyi?: { year: number; scope?: TaiyiScope };
  prompt?: Omit<DivinationPromptOptions, 'method' | 'data' | 'question' | 'currentTime'>;
}

export interface DivinationSession {
  requestedMethod: DivinationMethodId;
  method: DivinationSessionMethod;
  question: string;
  data: DivinationData;
  summary: ReturnType<typeof getDivinationSummaryBlocks>;
  formattedResult: string;
  serializedResult: string;
  prompt: string;
  promptDocument: PromptDocument;
}

export function summarizeDivinationResult(method: DivinationSessionMethod, data: DivinationData) {
  return getDivinationSummaryBlocks(method, data);
}

export function formatDivinationResult(method: DivinationSessionMethod, data: DivinationData) {
  return formatDivinationInfo(method, data);
}

export function serializeDivinationResult(data: DivinationData) {
  return serializeCoreResult(data);
}

const RANDOM_METHODS: DivinationSessionMethod[] = [
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'qimen',
  'liuren',
  'taiyi',
  'tarot',
  'ssgw',
  'lenormand',
];

function assertRequestRecord(request: DivinationRequest): void {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('占法请求必须是对象。');
  }
  if (
    !RANDOM_METHODS.includes(request.method as DivinationSessionMethod) &&
    request.method !== 'astrolabe' &&
    request.method !== 'almanac'
  ) {
    if (request.method !== 'random') throw new Error(`未知的占法：${String(request.method)}`);
  }
}

function normalizeDate(value: Date | string | number | undefined, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field}必须是有效日期。`);
  return date;
}

function normalizeCurrentTime(value: Date | string | number | undefined): Date | undefined {
  return normalizeDate(value, '当前时间');
}

function resolveMethod(request: DivinationRequest): {
  method: DivinationSessionMethod;
  random?: ReturnType<typeof createRandomContext>;
} {
  if (request.method !== 'random') return { method: request.method };
  const random = createRandomContext(request.random);
  return { method: RANDOM_METHODS[randomInt(RANDOM_METHODS.length, random.random)]!, random };
}

function withSessionRandom(
  options: RandomOptions | undefined,
  selectionRandom: ReturnType<typeof createRandomContext> | undefined,
): RandomOptions | undefined {
  if (!selectionRandom) return options;
  return { random: selectionRandom.random };
}

function buildQuestion(
  method: DivinationSessionMethod,
  question: string | undefined,
  data: DivinationData,
) {
  const normalized = question?.trim() ?? '';
  if (normalized) return normalized;
  if (method === 'almanac') {
    const item = data as Extract<DivinationData, { topicLabel: string }>;
    return `黄历择日：${item.topicLabel}（${item.startDate} 至 ${item.endDate}）`;
  }
  return '';
}

/** 只做请求层校验，不执行排盘；适合表单和 API 在提交前调用。 */
export function validateDivinationRequest(request: DivinationRequest): void {
  assertRequestRecord(request);
  if (request.method !== 'almanac' && !request.question?.trim()) {
    throw new Error('占法请求需要提供问题；黄历择日可省略问题。');
  }
  normalizeDate(request.divinationTime, '起课时间');
  normalizeCurrentTime(request.currentTime);

  if (request.method === 'almanac') {
    const value = request.almanac;
    if (!value) throw new Error('黄历择日需要提供 almanac 参数。');
    if (!value.startDate || !value.endDate) throw new Error('黄历择日需要提供开始日期和结束日期。');
  }
  if (request.method === 'astrolabe' && !request.astrolabe) {
    throw new Error('星盘需要提供 astrolabe 出生资料。');
  }
  if (request.method === 'taiyi') {
    if (!request.taiyi || (request.taiyi.scope !== undefined && request.taiyi.scope !== 'year')) {
      throw new Error('太乙当前只开放年计，请提供 taiyi.year，并将 scope 设为 year。');
    }
    if (!Number.isSafeInteger(request.taiyi.year)) throw new Error('太乙年计年份必须是整数。');
  }
}

function generateData(
  request: DivinationRequest,
  method: DivinationSessionMethod,
  customDate: Date | undefined,
  selectionRandom: ReturnType<typeof createRandomContext> | undefined,
): DivinationData {
  const randomOptions = withSessionRandom(request.random, selectionRandom);
  switch (method) {
    case 'liuyao':
      return generateLiuyao(customDate, {
        ...(request.liuyao ?? {}),
        ...((request.liuyao?.method ?? (request.liuyao?.yaos ? 'manual' : 'time')) === 'coins' &&
        randomOptions
          ? randomOptions
          : {}),
      });
    case 'meihua':
      return generateMeihua(customDate, {
        ...(request.meihua ?? {}),
        ...(request.meihua?.method === 'random' && randomOptions ? randomOptions : {}),
      });
    case 'xiaoliuren':
      return generateXiaoliuren({ ...request.xiaoliuren, customDate });
    case 'jinkoujue':
      return generateJinkoujue({
        ...request.jinkoujue,
        ...(request.jinkoujue?.method === 'random' && randomOptions ? randomOptions : {}),
        customDate,
      });
    case 'qimen':
      return generateQimen(
        customDate,
        request.qimen?.method,
        request.qimen?.scope,
        request.qimen?.juMethod,
      );
    case 'liuren':
      return generateLiuren(customDate);
    case 'tarot':
      return drawTarotSpread(request.tarot?.spread ?? 'single', {
        ...(request.tarot?.manualCards ? { manualCards: request.tarot.manualCards } : {}),
        ...(request.tarot?.interactiveSamples
          ? { interactiveSamples: request.tarot.interactiveSamples }
          : {}),
        ...(!request.tarot?.manualCards && !request.tarot?.interactiveSamples && randomOptions
          ? randomOptions
          : {}),
      } satisfies TarotDrawOptions);
    case 'ssgw':
      return request.ssgw?.method === 'manual'
        ? resolveSignByNumber(request.ssgw.number ?? 0, customDate)
        : drawRandomSign(customDate, randomOptions);
    case 'almanac':
      if (!request.almanac) throw new Error('黄历择日需要提供 almanac 参数。');
      return generateAlmanacSelection(request.almanac);
    case 'lenormand':
      return drawLenormandSpread(request.lenormand?.spread ?? 'single', {
        ...(request.lenormand?.manualCardIds
          ? { manualCardIds: request.lenormand.manualCardIds }
          : {}),
        ...(request.lenormand?.interactiveSamples
          ? { interactiveSamples: request.lenormand.interactiveSamples }
          : {}),
        ...(!request.lenormand?.manualCardIds &&
        !request.lenormand?.interactiveSamples &&
        randomOptions
          ? randomOptions
          : {}),
      });
    case 'astrolabe':
      if (!request.astrolabe) throw new Error('星盘需要提供 astrolabe 出生资料。');
      return generateAstrolabe(request.astrolabe);
    case 'taiyi':
      if (!request.taiyi) throw new Error('太乙需要提供 taiyi.year。');
      return generateTaiyi({
        year: request.taiyi.year,
        scope: request.taiyi.scope ?? 'year',
      }) as TaiyiResult;
  }
}

/** 以框架无关的纯数据请求完成一次占法，返回可展示、可缓存、可传输的统一结果。 */
export function generateDivinationSession(request: DivinationRequest): DivinationSession {
  validateDivinationRequest(request);
  const { method, random: selectionRandom } = resolveMethod(request);
  const customDate = normalizeDate(request.divinationTime, '起课时间');
  const data = generateData(request, method, customDate, selectionRandom);
  const question = buildQuestion(method, request.question, data);
  const promptOptions: DivinationPromptOptions = {
    method,
    data,
    question,
    currentTime: normalizeCurrentTime(request.currentTime),
    ...request.prompt,
    supplementaryInfo: request.supplementaryInfo,
    isCustomQuestion: request.questionSource === 'custom',
  };
  const promptDocument = buildDivinationPromptDocument(promptOptions);
  const summary = summarizeDivinationResult(method, data);
  return {
    requestedMethod: request.method,
    method,
    question,
    data,
    summary,
    formattedResult: formatDivinationResult(method, data),
    serializedResult: serializeDivinationResult(data),
    prompt: promptDocument.text,
    promptDocument,
  };
}

/** 兼容只需要一个函数名的调用方。 */
export const generateDivination = generateDivinationSession;
