import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../calendar';

const cycle = Array.from({ length: 60 }, (_, index) => HEAVENLY_STEMS[index % 10] + EARTHLY_BRANCHES[index % 12]);
const baseYear = 1864;
const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
function cycleIndex(value: string, label: string) {
  const index = cycle.indexOf(value);
  if (index < 0) throw new Error(`${label}无效：${value}`);
  return index;
}
function result(index: number) {
  return { isYangDun: false, juShu: [1, 4, 7][index], yuan: ['上元', '中元', '下元'][index] };
}
/** 月家以干支年的五年三元定局，月干支供后续定位符使。 */
export function getMonthQimenJuShu(monthGanZhi: string, yearGanZhi: string) {
  cycleIndex(monthGanZhi, '月干支');
  return result(Math.floor(cycleIndex(yearGanZhi, '年干支') / 5) % 3);
}
/** 年家按实际年所处一百八十年周期取三元。 */
export function getYearQimenJuShu(yearGanZhi: string, solarYear?: number) {
  const index = cycleIndex(yearGanZhi, '年干支');
  if (solarYear !== undefined && !Number.isInteger(solarYear)) throw new Error(`无法识别公历年份：${solarYear}`);
  const year = solarYear === undefined ? baseYear + index : [solarYear, solarYear - 1, solarYear + 1].find((candidate) => mod(candidate - baseYear, 60) === index);
  if (year === undefined) throw new Error(`公历年与年干支不匹配：${solarYear}、${yearGanZhi}`);
  return result(Math.floor(mod(year - baseYear, 180) / 60));
}
