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
import { DEFAULT_CHINA_TIMEZONE_HOURS } from '../../calendar/civil-time';
import { getDivinationTime } from '../../calendar/timeManager';
import { assertOptionalRecord } from '../../shared/validation';
import { attachResultMeta } from '../../shared/result';
import { analyzeXiaoliurenEvidence } from '../xiaoliuren-evidence';
import {
  getXiaoliurenVerse,
  getXiaoliurenPalaceName,
  resolveXiaoliurenRule,
} from '../xiaoliuren-rules';

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

const XIAOLIUREN_PALACES = Array.from({ length: 6 }, (_, index) => ({
  name: getXiaoliurenPalaceName(index),
  index,
  verse: getXiaoliurenVerse(index, 'common'),
})) satisfies XiaoliurenPalaceDetail[];

function palaceAt(index: number, rule: XiaoliurenRule): XiaoliurenPalaceDetail {
  const palace = XIAOLIUREN_PALACES[((index % 6) + 6) % 6];
  if (!palace) {
    throw new Error(`小六壬宫位索引无效：${index}`);
  }
  return {
    ...palace,
    verse: getXiaoliurenVerse(palace.index, rule),
  };
}

function assertReferenceData(): void {
  if (
    XIAOLIUREN_PALACES.length !== 6 ||
    XIAOLIUREN_PALACES.some(
      (palace, index) =>
        palace.index !== index || palace.name !== getXiaoliurenPalaceName(index) || !palace.verse,
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
  termReferenceDate?: Date;
}): XiaoliurenData {
  assertOptionalRecord(params, '小六壬起课参数');
  const rule = resolveXiaoliurenRule(params?.rule);
  const method = params?.method ?? 'time';
  if (method !== 'time') {
    throw new Error('小六壬当前仅保留有明确顺数规则的时间起课。');
  }

  const { ganzhi, timeInfo, timestamp } = getDivinationTime(
    params?.customDate,
    DEFAULT_CHINA_TIMEZONE_HOURS * 60,
    params?.termReferenceDate,
  );
  const civilLunar = params?.termReferenceDate
    ? getDivinationTime(params.termReferenceDate, DEFAULT_CHINA_TIMEZONE_HOURS * 60).timeInfo.lunar
    : timeInfo.lunar;
  const lunarMonth = civilLunar.monthNumber;
  const lunarDay = civilLunar.dayNumber;
  const isLeapMonth = civilLunar.isLeapMonth;
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
    ...(params?.termReferenceDate
      ? { termReferenceTimestamp: params.termReferenceDate.getTime() }
      : {}),
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
    input: {
      method,
      rule: rule.id,
      timestamp,
      ...(params?.termReferenceDate
        ? { termReferenceTimestamp: params.termReferenceDate.getTime() }
        : {}),
    },
    calculatedAt: timestamp,
  });
  return { ...result, evidenceAnalysis: analyzeXiaoliurenEvidence(result) };
}
