/**
 * @file 月家、年家奇门局数计算
 * @description 月家奇门和年家奇门的定局算法。
 *
 * 月家奇门以所属干支年的五年三元定地盘局，再以月干支定符使；
 * 年家奇门以一百八十年三元定地盘局，再以年干支定符使。
 *
 * 古籍依据：
 *   - 《奇门遁甲统宗》“附年奇门起例”“附月奇门起例”
 */

import { jiazi } from '../../../../divination/divination-data';
import { assertGanZhiName } from '../../../../bazi/baziUtils';

const SAN_YUAN_BASE_YEAR = 1864; // 甲子上元起点

/**
 * 月家奇门定局
 *
 * 《奇门遁甲统宗》所载月家法以年干支每五年换元：
 *   甲子至戊辰等为上元，阴遁一局；己巳至癸酉等为中元，阴遁四局；
 *   甲戌至戊寅等为下元，阴遁七局。月干支用于定位当月旬首和符使。
 *
 * @param monthGanZhi 月干支（如 "甲寅"）
 * @param yearGanZhi  年干支（如 "甲辰"），用于定位五年三元
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当月或年干支无法识别时
 */
export function getMonthQimenJuShu(
  monthGanZhi: string,
  yearGanZhi: string,
): {
  isYangDun: boolean;
  juShu: number;
  yuan: string;
} {
  assertGanZhiName(monthGanZhi, '月干支');
  assertGanZhiName(yearGanZhi, '年干支');
  const yearIndex = jiazi.indexOf(yearGanZhi);
  const yuanIndex = Math.floor(yearIndex / 5) % 3;
  const yuan = (['上元', '中元', '下元'] as const)[yuanIndex]!;
  const juShu = [1, 4, 7][yuanIndex]!;

  return { isYangDun: false, juShu, yuan };
}

/**
 * 年家奇门定局
 *
 * 《奇门遁甲统宗》所载年家法按一百八十年三元定局：
 *   上元六十年阴遁一局，中元六十年阴遁四局，下元六十年阴遁七局。
 *   基准：1864 甲子年属上元，1924 甲子年属中元，1984 甲子年属下元。
 *
 * @param yearGanZhi 年干支（如 "甲辰"）
 * @param solarYear  实际公历年，用于区分同一干支所在的 180 年三元周期
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当年干支无法识别时
 */
export function getYearQimenJuShu(
  yearGanZhi: string,
  solarYear?: number,
): {
  isYangDun: boolean;
  juShu: number;
  yuan: string;
} {
  assertGanZhiName(yearGanZhi, '年干支');
  const yearIndex = jiazi.indexOf(yearGanZhi);
  if (yearIndex === -1) {
    throw new Error(`无法识别年干支 "${yearGanZhi}"。`);
  }

  // 同一干支每六十年重复一次，须结合实际年份定位三元。
  const cycleYear = resolveSanYuanCycleYear(yearGanZhi, yearIndex, solarYear);
  const cyclePos = positiveMod(cycleYear - SAN_YUAN_BASE_YEAR, 180);
  const yuanIndex = Math.floor(cyclePos / 60);
  const yuan = (['上元', '中元', '下元'] as const)[yuanIndex]!;
  const juShu = [1, 4, 7][yuanIndex]!;

  return { isYangDun: false, juShu, yuan };
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function resolveSanYuanCycleYear(
  yearGanZhi: string,
  yearIndex: number,
  solarYear?: number,
): number {
  if (solarYear === undefined) {
    return SAN_YUAN_BASE_YEAR + yearIndex;
  }

  if (!Number.isInteger(solarYear)) {
    throw new Error(`无法识别公历年份 "${solarYear}"。`);
  }

  // 年初干支未切换时，传入的年干支可能对应上一公历年。
  for (const offset of [0, -1, 1]) {
    const candidateYear = solarYear + offset;
    if (positiveMod(candidateYear - SAN_YUAN_BASE_YEAR, 60) === yearIndex) {
      return candidateYear;
    }
  }

  throw new Error(`公历年 "${solarYear}" 与年干支 "${yearGanZhi}" 不匹配。`);
}
