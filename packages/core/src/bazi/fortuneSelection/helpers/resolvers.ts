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

  if (typeof selection.cycleIndex === 'number') {
    if (selection.cycleIndex < 0 || selection.cycleIndex >= result.luckInfo.cycles.length) {
      throw new Error(`八字岁运 cycleIndex ${selection.cycleIndex} 超出当前命盘的大运范围。`);
    }
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
    throw new Error(`八字岁运年份 ${selection.year} 不在当前命盘的大运范围内。`);
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
  if (typeof selection.year === 'number') {
    throw new Error(`八字岁运年份 ${selection.year} 不属于所选大运。`);
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
  if (typeof selection.month === 'number') {
    throw new Error(`八字岁运月份 ${selection.month} 超出 ${selection.year} 年的节气月范围。`);
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
  if (typeof selection.day === 'number') {
    throw new Error(`八字岁运日期序号 ${selection.day} 超出所选节气月的流日范围。`);
  }

  return getBaziDayIndexByDate(year, month, new Date()) ?? 1;
}
