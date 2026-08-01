/**
 * @file 月家、年家奇门局数计算
 * @description 月家奇门和年家奇门的定局算法。
 *
 * 月家以行年干支所属五年段定三元，月干支用于寻旬首与排盘；
 * 年家以一百八十年三元周期定局。
 *
 * 已核古籍依据：
 *   - 《遁甲演义》月家、年家奇门条
 *   - 《奇门遁甲统宗》年月日时奇门条
 *   - 《奇门法窍》月奇、年奇及三元甲子条
 *
 * 三书可互证的共同口径：月家与年家均为阴遁，上元一局、中元四局、
 * 下元七局，逆布六仪、顺布三奇。日家版本并不统一，不在本文件实现。
 */

import { jiazi } from '../../../../divination/divination-data';
import { assertGanZhiName } from '../../../../bazi/baziUtils';

const SAN_YUAN_BASE_YEAR = 1864; // 甲子上元起点

/**
 * 月家奇门定局
 *
 * 六十甲子行年每五年为一段，按上、中、下三元循环：
 *   第 1~5 年为上元阴遁一局；
 *   第 6~10 年为中元阴遁四局；
 *   第 11~15 年为下元阴遁七局；其后每十五年重复。
 *
 * @param monthGanZhi 月干支（如 "甲寅"）
 * @param yearGanZhi  行年干支（如 "甲辰"），用于确定五年段三元
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当月干支或年干支不是有效六十甲子时
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
  if (yearIndex === -1) {
    throw new Error(`无法识别年干支 "${yearGanZhi}"。`);
  }

  const segment = Math.floor(yearIndex / 5) % 3;
  const yuan = (['上元', '中元', '下元'] as const)[segment];
  const juShu = ([1, 4, 7] as const)[segment];
  return { isYangDun: false, juShu, yuan };
}

/**
 * 年家奇门定局
 *
 * 以三元甲子定局（180 年大循环），三元均为阴遁：
 *   上元（第 1-60 年）= 一局
 *   中元（第 61-120 年）= 四局
 *   下元（第 121-180 年）= 七局
 *   基准：1864 甲子年属上元，1924 甲子年属中元，1984 甲子年属下元。
 *
 * @param yearGanZhi 年干支（如 "甲辰"）
 * @param solarYear  实际公历年，用于区分同一干支所在的 180 年三元周期；不可省略
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当年干支无法识别时
 */
export function getYearQimenJuShu(
  yearGanZhi: string,
  solarYear: number,
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

  // 三元甲子定阴阳遁（180 年大循环）。同一干支每 60 年重复一次，
  // 必须结合实际年份才能区分上元、中元、下元。
  const cycleYear = resolveSanYuanCycleYear(yearGanZhi, yearIndex, solarYear);
  const cyclePos = positiveMod(cycleYear - SAN_YUAN_BASE_YEAR, 180);
  const yuanCycle = cyclePos < 60 ? '上元' : cyclePos < 120 ? '中元' : '下元';
  const juShu = yuanCycle === '上元' ? 1 : yuanCycle === '中元' ? 4 : 7;
  return { isYangDun: false, juShu, yuan: yuanCycle };
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function resolveSanYuanCycleYear(yearGanZhi: string, yearIndex: number, solarYear: number): number {
  if (!Number.isInteger(solarYear)) {
    throw new Error(`无法识别公历年份 "${solarYear}"。`);
  }

  // 年初干支未切换时，传入的年干支可能对应上一公历年。
  for (const offset of [0, -1]) {
    const candidateYear = solarYear + offset;
    if (positiveMod(candidateYear - SAN_YUAN_BASE_YEAR, 60) === yearIndex) {
      return candidateYear;
    }
  }

  throw new Error(`公历年 "${solarYear}" 与年干支 "${yearGanZhi}" 不匹配。`);
}
