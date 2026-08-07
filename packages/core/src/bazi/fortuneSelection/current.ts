import { getBaziDayIndexByDate, getBaziMonthIndexByDate } from '../calendarTool';
import type { BaziChartResult } from '../baziTypes';
import type { BaziFortuneSelectionValue } from './helpers/types';

function assertValidDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('当前运势定位需要有效日期。');
  }
}

/** 按公历年份定位覆盖该年的最后一个大运或童运周期。 */
export function getCurrentBaziLuckCycle(
  result: BaziChartResult,
  currentYear = new Date().getFullYear(),
): BaziChartResult['luckInfo']['cycles'][number] | null {
  if (!Number.isInteger(currentYear)) throw new TypeError('当前年份必须是整数。');
  for (let index = result.luckInfo.cycles.length - 1; index >= 0; index -= 1) {
    const cycle = result.luckInfo.cycles[index];
    if (cycle.years?.some((item) => item.year === currentYear)) return cycle;
  }
  return null;
}

/** 生成可直接传给 buildFortuneSelectionContext 的当前流日选择。 */
export function buildCurrentBaziFortuneSelection(
  result: BaziChartResult,
  now = new Date(),
): BaziFortuneSelectionValue | null {
  assertValidDate(now);
  const year = now.getFullYear();
  const currentCycle = getCurrentBaziLuckCycle(result, year);
  if (!currentCycle) return null;
  const cycleIndex = result.luckInfo.cycles.findIndex((item) => item === currentCycle);
  const month = getBaziMonthIndexByDate(year, now) ?? 1;
  const day = getBaziDayIndexByDate(year, month, now) ?? 1;
  return { scope: 'day', cycleIndex, year, month, day };
}

/** 生成当前节令月选择，适合“近期趋势”类入口。 */
export function buildRecentBaziFortuneSelection(
  result: BaziChartResult,
  now = new Date(),
): BaziFortuneSelectionValue | null {
  const current = buildCurrentBaziFortuneSelection(result, now);
  if (!current) return null;
  return {
    scope: 'month',
    cycleIndex: current.cycleIndex,
    year: current.year,
    month: current.month,
  };
}
