import type { BaziChartResult, LiunianInfo, LuckCycle } from '../../baziTypes';
import { getMonthDaysInfo, getYearInfo } from '../../calendarTool';
import type { BaziFortuneSelectionValue } from './types';

export function formatCycleLabel(cycle: LuckCycle) {
  if (cycle.isXiaoyun || cycle.ganZhi === '小运') {
    return '童运';
  }

  return `${cycle.ganZhi}运`;
}

export function formatYearLabel(yearInfo: LiunianInfo) {
  return `${yearInfo.year}年 ${yearInfo.ganZhi}`;
}

export function resolveCycleIndex(result: BaziChartResult, selection: BaziFortuneSelectionValue) {
  if (!result.luckInfo.cycles.length) return -1;

  if (selection.cycleIndex !== undefined) {
    return Number.isInteger(selection.cycleIndex) &&
      selection.cycleIndex >= 0 &&
      selection.cycleIndex < result.luckInfo.cycles.length
      ? selection.cycleIndex
      : -1;
  }

  if (typeof selection.year === 'number') {
    let matchedIndex = -1;
    for (let i = result.luckInfo.cycles.length - 1; i >= 0; i -= 1) {
      if (result.luckInfo.cycles[i].years.some((item) => item.year === selection.year)) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return -1;
}

export function resolveSelectedYear(
  cycle: LuckCycle | undefined,
  selection: BaziFortuneSelectionValue,
) {
  if (!cycle?.years.length) return undefined;

  if (
    typeof selection.year === 'number' &&
    cycle.years.some((item) => item.year === selection.year)
  ) {
    return selection.year;
  }

  return undefined;
}

export function resolveSelectedMonth(selection: BaziFortuneSelectionValue) {
  if (typeof selection.year !== 'number') return undefined;

  const monthOptions = getYearInfo(selection.year).months;
  if (
    typeof selection.month === 'number' &&
    selection.month >= 1 &&
    selection.month <= monthOptions.length
  ) {
    return selection.month;
  }

  return undefined;
}

export function resolveSelectedDay(
  year: number | undefined,
  month: number | undefined,
  selection: BaziFortuneSelectionValue,
) {
  if (!year || !month) return undefined;
  const dayOptions = getMonthDaysInfo(year, month);

  if (
    typeof selection.day === 'number' &&
    selection.day >= 1 &&
    selection.day <= dayOptions.length
  ) {
    return selection.day;
  }

  return undefined;
}
