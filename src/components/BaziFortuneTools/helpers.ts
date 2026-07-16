import type { BaziFortuneScope } from '@/lib/query-state';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import { getBaziDayIndexByDate, getBaziMonthIndexByDate } from '@core/bazi/calendarTool';
import type { BaziFortuneSelectionValue } from '@core/bazi/fortuneSelection';

export const baziFortuneScopeLabelMap: Record<BaziFortuneScope, string> = {
  natal: '本命',
  full: '完整输出',
  dayun: '大运',
  year: '流年',
  month: '流月',
  day: '流日',
};

export function getCurrentLuckCycle(
  result: BaziChartResult,
  currentYear = new Date().getFullYear(),
) {
  for (let i = result.luckInfo.cycles.length - 1; i >= 0; i -= 1) {
    const cycle = result.luckInfo.cycles[i];
    if (cycle.years?.some((item) => item.year === currentYear)) {
      return cycle;
    }
  }

  return result.luckInfo.cycles[0] ?? null;
}

export function buildCurrentBaziFortuneSelection(
  result: BaziChartResult,
  now = new Date(),
): BaziFortuneSelectionValue {
  const year = now.getFullYear();
  const currentCycle = getCurrentLuckCycle(result, year);
  const cycleIndex = Math.max(
    0,
    result.luckInfo.cycles.findIndex((item) => item === currentCycle),
  );
  const month = getBaziMonthIndexByDate(year, now) ?? 1;
  const day = getBaziDayIndexByDate(year, month, now) ?? 1;

  return {
    scope: 'day',
    cycleIndex,
    year,
    month,
    day,
  };
}

export function buildRecentBaziFortuneSelection(
  result: BaziChartResult,
  now = new Date(),
): BaziFortuneSelectionValue {
  const current = buildCurrentBaziFortuneSelection(result, now);
  return {
    scope: 'month',
    cycleIndex: current.cycleIndex,
    year: current.year,
    month: current.month,
  };
}

export function splitGanZhi(value: string) {
  return [value.charAt(0), value.charAt(1)];
}

export function formatBaziCycleDisplay(ganZhi: string, isXiaoyun: boolean) {
  if (isXiaoyun || ganZhi === '小运') {
    return '童运';
  }

  return `${ganZhi}运`;
}

export function getWuxingClass(character: string) {
  const wuxingMap: Record<string, string> = {
    甲: 'wuxing-mu',
    乙: 'wuxing-mu',
    寅: 'wuxing-mu',
    卯: 'wuxing-mu',
    木: 'wuxing-mu',
    丙: 'wuxing-huo',
    丁: 'wuxing-huo',
    巳: 'wuxing-huo',
    午: 'wuxing-huo',
    火: 'wuxing-huo',
    戊: 'wuxing-tu',
    己: 'wuxing-tu',
    辰: 'wuxing-tu',
    戌: 'wuxing-tu',
    丑: 'wuxing-tu',
    未: 'wuxing-tu',
    土: 'wuxing-tu',
    庚: 'wuxing-jin',
    辛: 'wuxing-jin',
    申: 'wuxing-jin',
    酉: 'wuxing-jin',
    金: 'wuxing-jin',
    壬: 'wuxing-shui',
    癸: 'wuxing-shui',
    子: 'wuxing-shui',
    亥: 'wuxing-shui',
    水: 'wuxing-shui',
  };

  return wuxingMap[character] || '';
}
