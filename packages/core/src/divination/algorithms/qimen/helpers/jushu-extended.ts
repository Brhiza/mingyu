/**
 * @file 月家、年家奇门局数计算
 * @description 月家奇门和年家奇门的定局算法。
 *
 * 月家奇门以月干支起局，用于查看一月运势；
 * 年家奇门以年干支起局，用于查看一年大势。
 *
 * 古籍依据：
 *   - 《奇门遁甲秘籍大全》年家奇门："三元共一百八十年，上元甲子起一宫"
 *   - 《奇门旨归》年家阳遁诀："甲己一二三四五，乙庚三四五678..."
 *   - 《遁甲演义》月家奇门："寅上起月，顺逆布之"
 */

import { jiazi, qimen } from '../../../../divination/divination-data';

const { jieQiJuShuMap } = qimen;
const SAN_YUAN_BASE_YEAR = 1864; // 甲子上元起点

/**
 * 月家奇门定局
 *
 * 以月干支定阴阳遁和局数：
 *   寅~未（正月~六月）为阳遁，申~丑（七月~腊月）为阴遁。
 *   阳遁顺起：寅=1局，卯=2局，…
 *   阴遁逆起：申=9局，酉=8局，…
 *   月家每月一局，无"上中下三元"概念。
 *
 * @param monthGanZhi 月干支（如 "甲寅"）
 * @param yearGanZhi  年干支（如 "甲辰"），部分流派可能需要，暂未使用
 * @returns { isYangDun, juShu, yuan }
 *
 * @throws 当月支无法识别时
 */
export function getMonthQimenJuShu(
  monthGanZhi: string,
  _yearGanZhi: string,
): {
  isYangDun: boolean;
  juShu: number;
  yuan: string;
} {
  const monthZhi = monthGanZhi.charAt(1);

  // 月支对应的月数（寅=1，卯=2，…，丑=12）
  const monthZhiOrder: Record<string, number> = {
    寅: 1,
    卯: 2,
    辰: 3,
    巳: 4,
    午: 5,
    未: 6,
    申: 7,
    酉: 8,
    戌: 9,
    亥: 10,
    子: 11,
    丑: 12,
  };

  const monthNum = monthZhiOrder[monthZhi];
  if (!monthNum) {
    throw new Error(`无法识别月支 "${monthZhi}"。`);
  }

  // 月家阴阳遁：冬至后半年（寅~未）阳遁，夏至后半年（申~丑）阴遁
  const yangZhiSet = new Set(['寅', '卯', '辰', '巳', '午', '未']);
  const isYangDun = yangZhiSet.has(monthZhi);

  // 阳遁顺起，阴遁逆起
  const juShu = isYangDun ? ((monthNum - 1) % 9) + 1 : ((9 - ((monthNum - 1) % 9)) % 9) + 1;

  // 月家无上中下三元概念
  const yuan = '月局';

  return { isYangDun, juShu, yuan };
}

/**
 * 年家奇门定局
 *
 * 古法：甲己之年起1局，乙庚之年起7局，丙辛之年起4局，
 *       丁壬之年起1局，戊癸之年起7局。
 * 同年干各年均起同局，不随旬变。
 *
 * 阴阳遁以三元甲子定（180 年大循环）：
 *   上元（第 1-60 年）= 阳遁
 *   中元（第 61-120 年）= 阴遁
 *   下元（第 121-180 年）= 阳遁
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
  const yearGan = yearGanZhi.charAt(0);
  const yearIndex = jiazi.indexOf(yearGanZhi);
  if (yearIndex === -1) {
    throw new Error(`无法识别年干支 "${yearGanZhi}"。`);
  }

  // 年家奇门按天干分组定起始局数
  const ganJuMap: Record<string, number> = {
    甲: 1,
    己: 1,
    乙: 7,
    庚: 7,
    丙: 4,
    辛: 4,
    丁: 1,
    壬: 1,
    戊: 7,
    癸: 7,
  };

  // 三元甲子定阴阳遁（180 年大循环）。同一干支每 60 年重复一次，
  // 必须结合实际年份才能区分上元、中元、下元。
  const cycleYear = resolveSanYuanCycleYear(yearGanZhi, yearIndex, solarYear);
  const cyclePos = positiveMod(cycleYear - SAN_YUAN_BASE_YEAR, 180);
  const yuanCycle = cyclePos < 60 ? '上元' : cyclePos < 120 ? '中元' : '下元';
  // 上元阳遁、中元阴遁、下元阳遁（《奇门旨归》）
  const isYangDun = yuanCycle === '上元' || yuanCycle === '下元';

  // 古法按年干分组定局，同年干各年均起同局
  const juShu = ganJuMap[yearGan] || 1;

  return { isYangDun, juShu, yuan: yuanCycle };
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
