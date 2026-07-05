import type { MeihuaCalculation } from '../../../../types/divination';
import { dizhi } from '../../../../divination/divination-data';
import { getDivinationTime } from '../../../../calendar/timeManager';
import type { RandomOptions } from '../../../../shared/random';
import { createRandomSource, randomInt } from '../../../../shared/random';

export interface MeihuaMethodResult {
  upperTrigramIndex: number;
  lowerTrigramIndex: number;
  movingYaoIndex: number;
  calculation: MeihuaCalculation;
}

type DivinationTime = ReturnType<typeof getDivinationTime>;
type DivinationGanzhi = DivinationTime['ganzhi'];
type DivinationLunar = DivinationTime['timeInfo']['lunar'];

export function resolveTimeMethod(
  ganzhi: DivinationGanzhi,
  lunar: DivinationLunar,
): MeihuaMethodResult {
  const yearZhi = ganzhi.year.substring(1, 2);
  const month = lunar.monthNumber;
  const day = lunar.dayNumber;
  const timeZhi = ganzhi.hour.substring(1, 2);
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
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('数字起卦必须提供正整数');
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
  const rng = createRandomSource(options);
  const upperTrigramIndex = randomInt(8, rng) + 1;
  const lowerTrigramIndex = randomInt(8, rng) + 1;
  const movingYaoIndex = randomInt(6, rng) + 1;

  return {
    upperTrigramIndex,
    lowerTrigramIndex,
    movingYaoIndex,
    calculation: {
      method: '随机起卦法',
      methodKey: 'random',
      upperTrigramIndex,
      lowerTrigramIndex,
      movingYaoIndex,
    },
  };
}
