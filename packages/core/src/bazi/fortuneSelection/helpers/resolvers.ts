import type { BaziChartResult, LiunianInfo, LuckCycle } from '../../baziTypes';
import {
  getBaziDayIndexByDate,
  getBaziMonthIndexByDate,
  getMonthDaysInfo,
  getYearInfo,
} from '../../calendarTool';
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

  if (
    typeof selection.cycleIndex === 'number' &&
    selection.cycleIndex >= 0 &&
    selection.cycleIndex < result.luckInfo.cycles.length
  ) {
    return selection.cycleIndex;
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

  const currentYear = new Date().getFullYear();
  let currentCycleIndex = -1;
  for (let i = result.luckInfo.cycles.length - 1; i >= 0; i -= 1) {
    if (result.luckInfo.cycles[i].years.some((item) => item.year === currentYear)) {
      currentCycleIndex = i;
      break;
    }
  }
  return currentCycleIndex >= 0 ? currentCycleIndex : 0;
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

  const currentYear = new Date().getFullYear();
  const currentItem = cycle.years.find((item) => item.year === currentYear);
  return currentItem?.year ?? cycle.years[0]?.year;
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

  return getBaziMonthIndexByDate(selection.year, new Date()) ?? 1;
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

  return getBaziDayIndexByDate(year, month, new Date()) ?? 1;
}
