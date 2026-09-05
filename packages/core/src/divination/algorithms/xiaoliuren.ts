/**
 * @file 小六壬时间课
 * @description 仅实现可复核的月、日、时逐宫顺数，不混入现代扩展断法。
 * @口径 通行掌诀以月宫起初一；多能鄙事以月宫下一宫起初一。日宫起子时，六宫顺行。
 * @来源 通行俗传小六壬掌诀。作者、成书年代及“李淳风”署名暂无可靠版本学证据。
 */
import type {
  XiaoliurenData,
  XiaoliurenDivinationMethod,
  XiaoliurenPalaceDetail,
  XiaoliurenRule,
} from '../../types/divination';
import { getShichenByIndex, getTimeIndexFromClock } from '../../calendar/dateUtils';
import { getDivinationTime } from '../../calendar/timeManager';
import { assertOptionalRecord } from '../../shared/validation';
import { attachResultMeta } from '../../shared/result';
import { analyzeXiaoliurenEvidence } from '../xiaoliuren-evidence';
import { DUONENG_XIAOLIUREN_VERSES, resolveXiaoliurenRule } from '../xiaoliuren-rules';

export { XIAOLIUREN_RULE_OPTIONS } from '../xiaoliuren-rules';

export { analyzeXiaoliurenEvidence } from '../xiaoliuren-evidence';
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

function palaceAt(index: number, rule: XiaoliurenRule): XiaoliurenPalaceDetail {
  const palace = XIAOLIUREN_PALACES[((index % 6) + 6) % 6];
  if (!palace) {
    throw new Error(`小六壬宫位索引无效：${index}`);
  }
  return {
    ...palace,
    verse: rule === 'duoneng' ? DUONENG_XIAOLIUREN_VERSES[palace.index] : palace.verse,
  };
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
 * 生成所选口径的小六壬时间课。
 *
 * 闰月沿用同名月序；农历日按东八区民用日零点换日。两项均在结果中显式标注，
 * 以免把有分歧的历法边界伪装成唯一传统口径。
 */
export function generateXiaoliuren(params?: {
  method?: XiaoliurenDivinationMethod;
  rule?: XiaoliurenRule;
  customDate?: Date;
}): XiaoliurenData {
  assertOptionalRecord(params, '小六壬起课参数');
  const rule = resolveXiaoliurenRule(params?.rule);
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
  const daySeed = lunarMonth + lunarDay - 1 + rule.dayStartOffset;
  const hourSeed = lunarMonth + lunarDay + hourNumber - 2 + rule.dayStartOffset;
  const monthPalaceIndex = (monthSeed - 1) % 6;
  const dayPalaceIndex = (daySeed - 1) % 6;
  const hourPalaceIndex = (hourSeed - 1) % 6;

  const data: XiaoliurenData = {
    rule: rule.id,
    ruleLabel: rule.label,
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
      month: palaceAt(monthPalaceIndex, rule.id),
      day: palaceAt(dayPalaceIndex, rule.id),
      hour: palaceAt(hourPalaceIndex, rule.id),
    },
    palaceOrder: XIAOLIUREN_PALACES.map((palace) => palaceAt(palace.index, rule.id)),
    primary: palaceAt(hourPalaceIndex, rule.id),
  };

  const result = attachResultMeta(data, {
    algorithm: 'xiaoliuren',
    input: { method, rule: rule.id, timestamp },
    calculatedAt: timestamp,
  });
  return { ...result, evidenceAnalysis: analyzeXiaoliurenEvidence(result) };
}
