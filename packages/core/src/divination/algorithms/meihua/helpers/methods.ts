import type { MeihuaCalculation } from '../../../../types/divination';
import { dizhi } from '../../../../divination/divination-data';
import { getDivinationTime } from '../../../../calendar/timeManager';
import type { RandomOptions, RandomTrace } from '../../../../shared/random';
import { createRandomContext, randomInt } from '../../../../shared/random';

export interface MeihuaMethodResult {
  upperTrigramIndex: number;
  lowerTrigramIndex: number;
  movingYaoIndex: number;
  calculation: MeihuaCalculation;
  randomTrace?: RandomTrace;
}

type DivinationTime = ReturnType<typeof getDivinationTime>;
type DivinationGanzhi = DivinationTime['ganzhi'];
type DivinationLunar = DivinationTime['timeInfo']['lunar'];

function getLunarYearBranch(lunar: DivinationLunar) {
  const lunarYearText = lunar.yearInChinese.replace(/^农历/, '');
  const yearBranch = lunarYearText.charAt(1);
  if (!dizhi.includes(yearBranch)) {
    throw new Error(`梅花易数无法识别农历年支 "${lunar.yearInChinese}"。`);
  }
  return yearBranch;
}

function assertIntegerRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}必须是 ${min}-${max} 之间的整数。`);
  }
}

function getHourBranch(ganzhi: DivinationGanzhi): string {
  const timeZhi = ganzhi.hour.substring(1, 2);
  if (!dizhi.includes(timeZhi)) {
    throw new Error(`梅花易数无法识别时支 "${ganzhi.hour}"。`);
  }
  return timeZhi;
}

export function resolveTimeMethod(
  ganzhi: DivinationGanzhi,
  lunar: DivinationLunar,
): MeihuaMethodResult {
  const yearZhi = getLunarYearBranch(lunar);
  const month = lunar.monthNumber;
  const day = lunar.dayNumber;
  assertIntegerRange(month, '农历月份', 1, 12);
  assertIntegerRange(day, '农历日期', 1, 30);
  const timeZhi = getHourBranch(ganzhi);
  const yearZhiIndex = dizhi.indexOf(yearZhi) + 1;
  const timeZhiIndex = dizhi.indexOf(timeZhi) + 1;
  const upperTrigramIndex = (yearZhiIndex + month + day) % 8 || 8;
  const lowerTrigramIndex = (yearZhiIndex + month + day + timeZhiIndex) % 8 || 8;
  const movingYaoIndex = (yearZhiIndex + month + day + timeZhiIndex) % 6 || 6;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '年月日时起卦法',
      methodKey: 'time',
      yearZhi,
      yearZhiIndex,
      month,
      day,
      timeZhi,
      timeZhiIndex,
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

export function resolveTimeTrigramMethod(
  ganzhi: DivinationGanzhi,
  lunar: DivinationLunar,
): MeihuaMethodResult {
  const result = resolveTimeMethod(ganzhi, lunar);
  return {
    ...result,
    calculation: {
      ...result.calculation,
      method: '年月日时起卦法（timeTrigram 兼容）',
      methodKey: 'timeTrigram',
      formula:
        '上卦=(年支序+月+日)%8；下卦=(年支序+月+日+时支序)%8；动爻=(年支序+月+日+时支序)%6。',
      compatibilityNote:
        'timeTrigram 为历史兼容入口，现按《梅花易数》年月日时起卦法计算，不再使用时辰地支方位自定义映射。',
    },
  };
}

export function resolveNumberMethod(number: number, timeBranch: string): MeihuaMethodResult {
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error('数字起卦必须提供安全范围内的正整数');
  }
  const timeZhiIndex = dizhi.indexOf(timeBranch) + 1;
  if (timeZhiIndex <= 0) {
    throw new Error('数字起卦无法识别起卦时辰');
  }

  const upperTrigramIndex = number % 8 || 8;
  const totalWithTime = number + timeZhiIndex;
  const lowerTrigramIndex = totalWithTime % 8 || 8;
  const movingYaoIndex = totalWithTime % 6 || 6;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '数字起卦法',
      methodKey: 'number',
      number,
      timeZhi: timeBranch,
      timeZhiIndex,
      totalWithTime,
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}

export function resolveRandomMethod(options?: RandomOptions): MeihuaMethodResult {
  const context = createRandomContext(options);
  const rng = context.random;
  const upperTrigramIndex = randomInt(8, rng) + 1;
  const lowerTrigramIndex = randomInt(8, rng) + 1;
  const movingYaoIndex = randomInt(6, rng) + 1;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    randomTrace: context.getTrace(),
    calculation: {
      method: '随机起卦法',
      methodKey: 'random',
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}
