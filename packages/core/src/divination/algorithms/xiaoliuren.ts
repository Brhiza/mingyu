/**
 * @file 小六壬起课原始时间事实
 * @description 只提供可复核的时间、干支、农历月日与时辰，不自动采用未校定的落宫规则和歌诀。
 * @来源 农历与干支由统一历法模块换算；俗传顺数规则尚未取得可核验固定底本。
 */
import type { XiaoliurenData, XiaoliurenDivinationMethod } from '../../types/divination';
import { getShichenByIndex, getTimeIndexFromClock } from '../../calendar/dateUtils';
import { getRequiredDivinationTime } from '../../calendar/timeManager';
import { assertOptionalRecord } from '../../shared/validation';
import { attachResultMeta } from '../../shared/result';
import { analyzeRebuiltXiaoliurenEvidence } from '../xiaoliuren-evidence';

export type {
  XiaoliurenCalculationFact,
  XiaoliurenCalculationStep,
  XiaoliurenEvidenceAnalysis,
  XiaoliurenLimitationFact,
  XiaoliurenPalaceFact,
  XiaoliurenSummaryFact,
} from '../xiaoliuren-evidence';

/**
 * 生成小六壬继续推算所需的原始时间事实。
 *
 * 闰月沿用同名月序；农历日按东八区民用日零点换日。两项均在结果中显式标注，
 * 以免把有分歧的历法边界伪装成唯一传统口径。
 */
function buildXiaoliurenData(params?: {
  method?: XiaoliurenDivinationMethod;
  customDate?: Date;
}): XiaoliurenData {
  assertOptionalRecord(params, '小六壬起课参数');
  const method = params?.method;
  if (method === undefined) {
    throw new Error('小六壬起课方式必须明确提供，不能自动使用时间起课。');
  }
  if (method !== 'time') {
    throw new Error('小六壬当前只保留时间原始事实，不支持其他起课方式。');
  }

  const { ganzhi, timeInfo, timestamp } = getRequiredDivinationTime(
    params?.customDate,
    '小六壬起课时间',
  );
  const lunarMonth = timeInfo.lunar.monthNumber;
  const lunarDay = timeInfo.lunar.dayNumber;
  const isLeapMonth = timeInfo.lunar.monthInChinese.startsWith('闰');
  const clockHourIndex = getTimeIndexFromClock(timeInfo.solar.hour, timeInfo.solar.minute);
  const shichen = getShichenByIndex(clockHourIndex);
  if (!shichen) {
    throw new Error(`小六壬时辰索引无效：${clockHourIndex}`);
  }

  // dateUtils 以 0 表示早子、12 表示晚子；掌诀均按子1至亥12计数。
  const hourNumber = (clockHourIndex % 12) + 1;
  const data: XiaoliurenData = {
    method,
    methodLabel: '时间起课',
    timestamp,
    lunarMonth,
    lunarDay,
    isLeapMonth,
    hourIndex: clockHourIndex,
    hourLabel: shichen.name,
    ganzhi,
    calculation: {
      lunarMonth,
      lunarDay,
      hourNumber,
      dayBoundary: '东八区民用日零点换日',
      leapMonthRule: '闰月沿用同名月序',
    },
  };

  return attachResultMeta(data, {
    algorithm: 'xiaoliuren',
    input: { method, timestamp },
    calculatedAt: timestamp,
  });
}

function assertXiaoliurenTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error('小六壬结果时间戳无效，无法审核重建。');
  }
  return timestamp;
}

/** 只保留时间起课标识与时间戳，历法事实和证据全部重算。 */
export function rebuildAuditedXiaoliurenData(input: XiaoliurenData): XiaoliurenData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('小六壬结果必须是对象。');
  }
  if (input.method !== 'time') {
    throw new Error(`未知的小六壬起课方式: ${String(input.method)}`);
  }
  const randomTrace = (input as XiaoliurenData & { randomTrace?: unknown }).randomTrace;
  if (randomTrace || input.meta?.random) {
    throw new Error('小六壬时间起课不应携带随机轨迹。');
  }
  const timestamp = assertXiaoliurenTimestamp(input.timestamp);
  const rebuilt = buildXiaoliurenData({ method: 'time', customDate: new Date(timestamp) });
  return {
    ...rebuilt,
    evidenceAnalysis: analyzeRebuiltXiaoliurenEvidence(rebuilt),
  };
}

/** 所有公开证据分析先按时间戳重建，禁止旧派生字段进入提示词。 */
export function analyzeXiaoliurenEvidence(input: XiaoliurenData) {
  return rebuildAuditedXiaoliurenData(input).evidenceAnalysis!;
}

/** 生成小六壬继续推算所需的原始时间事实。 */
export function generateXiaoliuren(params?: {
  method?: XiaoliurenDivinationMethod;
  customDate?: Date;
}): XiaoliurenData {
  const result = buildXiaoliurenData(params);
  return {
    ...result,
    evidenceAnalysis: analyzeRebuiltXiaoliurenEvidence(result),
  };
}
