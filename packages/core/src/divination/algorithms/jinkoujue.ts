/**
 * @file 金口诀原始起课事实
 * @description 只保留时间、四柱、用户原始数字或随机轨迹，不自动采用未校定的起课与发用规则。
 * @来源 时间与四柱由统一历法模块换算；金口诀具体底本、版本和页码尚未闭合。
 */
import type { JinkoujueData, JinkoujueDivinationMethod } from '../../types/divination';
import { getRequiredDivinationTime } from '../../calendar/timeManager';
import { assertOptionalRecord } from '../../shared/validation';
import {
  createRandomContext,
  createSeededRandom,
  hasRandomOptions,
  type RandomOptions,
  type RandomTrace,
} from '../../shared/random';
import { attachResultMeta, createResultMeta, stableStringify } from '../../shared/result';
import { analyzeRebuiltJinkoujueEvidence } from '../jinkoujue-evidence';

const METHOD_LABELS: Record<JinkoujueDivinationMethod, string> = {
  time: '时间起课',
  number: '数字起课',
  random: '随机起课',
};

function assertMethod(method: JinkoujueDivinationMethod): void {
  if (!Object.prototype.hasOwnProperty.call(METHOD_LABELS, method)) {
    throw new Error(`未知的金口诀起课方式: ${method}`);
  }
}

function buildJinkoujueData(
  params?: {
    method?: JinkoujueDivinationMethod;
    number?: number;
    customDate?: Date;
  } & RandomOptions,
): JinkoujueData {
  assertOptionalRecord(params, '金口诀起课参数');
  const method = params?.method;
  if (method === undefined) {
    throw new Error('金口诀起课方式必须明确提供，不能自动使用时间起课。');
  }
  assertMethod(method);
  if (method !== 'random' && hasRandomOptions(params)) {
    throw new Error('金口诀仅随机起课接受 seed、replay 或自定义随机源。');
  }
  if (method === 'number' && (!Number.isSafeInteger(params?.number) || (params?.number ?? 0) < 1)) {
    throw new Error('金口诀数字起课必须提供不小于 1 的安全整数。');
  }

  const { ganzhi, timestamp } = getRequiredDivinationTime(params?.customDate, '金口诀起课时间');
  let randomTrace: RandomTrace | undefined;
  if (method === 'random') {
    const context = createRandomContext(params);
    context.random();
    randomTrace = context.getTrace();
  }

  const result: JinkoujueData = {
    method,
    methodLabel: METHOD_LABELS[method],
    timestamp,
    ganzhi,
    ...(method === 'number' ? { numberInput: params!.number } : {}),
    ...(randomTrace ? { randomTrace } : {}),
  };
  return attachResultMeta(result, {
    algorithm: 'jinkoujue',
    input: {
      method,
      timestamp,
      numberInput: method === 'number' ? params!.number : null,
    },
    calculatedAt: timestamp,
    random: randomTrace,
  });
}

function assertJinkoujueTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error('金口诀结果时间戳无效，无法审核重建。');
  }
  return timestamp;
}

function normalizeJinkoujueRandomTrace(input: JinkoujueData): RandomTrace {
  const directTrace = input.randomTrace;
  const metaTrace = input.meta?.random;
  if (directTrace && metaTrace && stableStringify(directTrace) !== stableStringify(metaTrace)) {
    throw new Error('金口诀结果中的两份随机轨迹不一致，无法审核重建。');
  }
  const rawTrace = directTrace ?? metaTrace;
  if (!rawTrace) {
    throw new Error('金口诀随机起课缺少原始随机轨迹，无法审核重建。');
  }
  const trace = createResultMeta({
    algorithm: 'jinkoujue.audit.trace',
    input: { method: 'random' },
    calculatedAt: assertJinkoujueTimestamp(input.timestamp),
    random: rawTrace,
  }).random!;
  if (trace.samples.length !== 1) {
    throw new Error(`金口诀随机起课应记录1个原始随机样本，当前为${trace.samples.length}个。`);
  }
  if (trace.mode === 'seeded') {
    if (trace.seed === undefined) {
      throw new Error('金口诀 seeded 随机轨迹缺少种子，无法核验。');
    }
    if (createSeededRandom(trace.seed)() !== trace.samples[0]) {
      throw new Error('金口诀随机轨迹与保存的种子不一致。');
    }
  } else if (trace.seed !== undefined) {
    throw new Error('金口诀非 seeded 随机轨迹不应携带种子。');
  }
  return trace;
}

/** 只信任起课方式、时间、用户原始数字或随机轨迹，四柱和证据全部重算。 */
export function rebuildAuditedJinkoujueData(input: JinkoujueData): JinkoujueData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('金口诀结果必须是对象。');
  }
  const timestamp = assertJinkoujueTimestamp(input.timestamp);
  const customDate = new Date(timestamp);
  let rebuilt: JinkoujueData;

  if (input.method === 'time') {
    if (input.randomTrace || input.meta?.random) {
      throw new Error('金口诀时间起课不应携带随机轨迹。');
    }
    rebuilt = buildJinkoujueData({ method: 'time', customDate });
  } else if (input.method === 'number') {
    if (input.randomTrace || input.meta?.random) {
      throw new Error('金口诀数字起课不应携带随机轨迹。');
    }
    if (!Number.isSafeInteger(input.numberInput) || (input.numberInput ?? 0) < 1) {
      throw new Error('金口诀数字起课缺少有效的原始用户数字，无法审核重建。');
    }
    rebuilt = buildJinkoujueData({ method: 'number', number: input.numberInput, customDate });
  } else if (input.method === 'random') {
    const trace = normalizeJinkoujueRandomTrace(input);
    const replayed = buildJinkoujueData({ method: 'random', customDate, replay: trace.samples });
    rebuilt = {
      ...replayed,
      randomTrace: trace,
      meta: createResultMeta({
        algorithm: 'jinkoujue',
        input: { method: 'random', timestamp, numberInput: null },
        calculatedAt: timestamp,
        random: trace,
      }),
    };
  } else {
    throw new Error(`未知的金口诀起课方式: ${String(input.method)}`);
  }

  return { ...rebuilt, evidenceAnalysis: analyzeRebuiltJinkoujueEvidence(rebuilt) };
}

export function analyzeJinkoujueEvidence(input: JinkoujueData) {
  return rebuildAuditedJinkoujueData(input).evidenceAnalysis!;
}

/** 生成金口诀继续校勘所需的原始起课事实。 */
export function generateJinkoujue(
  params?: {
    method?: JinkoujueDivinationMethod;
    number?: number;
    customDate?: Date;
  } & RandomOptions,
): JinkoujueData {
  const result = buildJinkoujueData(params);
  return { ...result, evidenceAnalysis: analyzeRebuiltJinkoujueEvidence(result) };
}

export type { JinkoujueEvidenceAnalysis } from '../jinkoujue-evidence';
