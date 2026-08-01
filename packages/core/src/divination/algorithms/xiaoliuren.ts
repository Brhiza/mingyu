/**
 * @file 小六壬通行时间课
 * @description 仅实现可复核的月、日、时逐宫顺数，不混入现代扩展断法。
 * @口径 正月从大安起，月上起初一，日上起子时，均按六宫顺行；时宫为占得宫。
 * @来源 通行俗传小六壬掌诀。作者、成书年代及“李淳风”署名暂无可靠版本学证据。
 */
import type {
  XiaoliurenData,
  XiaoliurenDivinationMethod,
  XiaoliurenPalaceDetail,
} from '../../types/divination';
import { getShichenByIndex, getTimeIndexFromClock } from '../../calendar/dateUtils';
import { getDivinationTime } from '../../calendar/timeManager';
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

const XIAOLIUREN_PALACES = [
  {
    name: '大安',
    index: 0,
    verse:
      '大安事事昌，求财在坤方，失物去不远，宅舍保安康，行人身未动，病者主无妨，将军回田野，仔细更推详。',
  },
  {
    name: '留连',
    index: 1,
    verse:
      '留连事难成，求谋日未明，官事凡宜缓，去者未回程，失物南方见，急讨方心称，更须防口舌，人口且平平。',
  },
  {
    name: '速喜',
    index: 2,
    verse:
      '速喜喜来临，求财向南行，失物申午未，逢人路上寻，官事有福德，病者无祸侵，田宅六畜吉，行人有信音。',
  },
  {
    name: '赤口',
    index: 3,
    verse:
      '赤口主口舌，官非切宜防，失物急去寻，行人有惊慌，六畜多作怪，病者出西方，更须防咀咒，恐怕染瘟皇。',
  },
  {
    name: '小吉',
    index: 4,
    verse:
      '小吉最吉昌，路上好商量，阴人来报喜，失物在坤方，行人立便至，交关甚是强，凡事皆和合，病者叩穷苍。',
  },
  {
    name: '空亡',
    index: 5,
    verse:
      '空亡事不祥，阴人多乖张，求财无利益，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，祈解保安康。',
  },
] as const satisfies readonly XiaoliurenPalaceDetail[];

function palaceAt(index: number): XiaoliurenPalaceDetail {
  const palace = XIAOLIUREN_PALACES[((index % 6) + 6) % 6];
  if (!palace) {
    throw new Error(`小六壬宫位索引无效：${index}`);
  }
  return palace;
}

function assertReferenceData(): void {
  const expected = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
  if (
    XIAOLIUREN_PALACES.length !== 6 ||
    XIAOLIUREN_PALACES.some(
      (palace, index) => palace.index !== index || palace.name !== expected[index] || !palace.verse,
    )
  ) {
    throw new Error('小六壬六宫顺序或歌诀资料不完整。');
  }
}

assertReferenceData();

/**
 * 生成通行小六壬时间课。
 *
 * 闰月沿用同名月序；农历日按东八区民用日零点换日。两项均在结果中显式标注，
 * 以免把有分歧的历法边界伪装成唯一传统口径。
 */
function buildXiaoliurenData(params?: {
  method?: XiaoliurenDivinationMethod;
  customDate?: Date;
}): XiaoliurenData {
  assertOptionalRecord(params, '小六壬起课参数');
  const method = params?.method ?? 'time';
  if (method !== 'time') {
    throw new Error('小六壬当前仅保留有明确顺数规则的时间起课。');
  }

  const { ganzhi, timeInfo, timestamp } = getDivinationTime(params?.customDate);
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
  const monthSeed = lunarMonth;
  const daySeed = lunarMonth + lunarDay - 1;
  const hourSeed = lunarMonth + lunarDay + hourNumber - 2;
  const monthPalaceIndex = (monthSeed - 1) % 6;
  const dayPalaceIndex = (daySeed - 1) % 6;
  const hourPalaceIndex = (hourSeed - 1) % 6;

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
      monthSeed,
      daySeed,
      hourSeed,
      monthPalaceIndex,
      dayPalaceIndex,
      hourPalaceIndex,
      dayBoundary: '东八区民用日零点换日',
      leapMonthRule: '闰月沿用同名月序',
    },
    sequence: {
      month: palaceAt(monthPalaceIndex),
      day: palaceAt(dayPalaceIndex),
      hour: palaceAt(hourPalaceIndex),
    },
    palaceOrder: XIAOLIUREN_PALACES.map((palace) => ({ ...palace })),
    primary: palaceAt(hourPalaceIndex),
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

/** 只保留时间起课标识与时间戳，农历、时辰、三宫和证据全部重算。 */
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

/** 生成通行小六壬时间课。 */
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
