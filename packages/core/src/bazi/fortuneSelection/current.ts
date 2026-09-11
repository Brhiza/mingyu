import { getBaziDayIndexByDate, getBaziMonthIndexByDate } from '../calendarTool';
import type { BaziChartResult } from '../baziTypes';
import {
  createCivilDate,
  getLuckCycleForCivilDate,
  getLuckCycleForDate,
  toChinaCivilDate,
} from '../luckTiming';
import type { BaziFortuneSelectionValue } from './helpers/types';

function assertValidDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('当前运势定位需要有效日期。');
  }
}

/** 按精确交运时刻定位大运；数字年份参数仅为旧调用方式保留。 */
export function getCurrentBaziLuckCycle(
  result: BaziChartResult,
  reference: Date | number = new Date(),
): BaziChartResult['luckInfo']['cycles'][number] | null {
  if (reference instanceof Date) {
    assertValidDate(reference);
    return getLuckCycleForDate(result.luckInfo.cycles, reference);
  }
  if (!Number.isInteger(reference)) throw new TypeError('当前年份必须是整数。');
  return getLuckCycleForCivilDate(
    result.luckInfo.cycles,
    createCivilDate(reference, 7, 1, 12, 0, 0),
  );
}

/** 生成可直接传给 buildFortuneSelectionContext 的当前流日选择。 */
export function buildCurrentBaziFortuneSelection(
  result: BaziChartResult,
  now = new Date(),
): BaziFortuneSelectionValue | null {
  assertValidDate(now);
  const civilNow = toChinaCivilDate(now);
  const currentCycle = getCurrentBaziLuckCycle(result, now);
  if (!currentCycle) return null;
  const cycleIndex = result.luckInfo.cycles.findIndex((item) => item === currentCycle);

  // 元旦至立春前属于上一节令年的末段：当前公历年查不到时须回查上一年，
  // 不得回退到当年首月首日冒充当前日期
  let termYear = civilNow.getUTCFullYear();
  let monthIndex = getBaziMonthIndexByDate(termYear, now);
  if (monthIndex === undefined) {
    termYear -= 1;
    monthIndex = getBaziMonthIndexByDate(termYear, now);
  }
  if (monthIndex === undefined) {
    throw new Error('当前日期无法定位到所属节令月，不回退到默认首月。');
  }
  const day = getBaziDayIndexByDate(termYear, monthIndex, now);
  if (day === undefined) {
    throw new Error('当前日期无法定位到所属节令日，不回退到默认首日。');
  }
  return { scope: 'day', cycleIndex, year: termYear, month: monthIndex, day };
}

/**
 * 将当前日期定位结果收窄到指定岁运层级。
 *
 * 供提示词入口使用：未明确指定具体年份、月份或日期时，仍能返回当前阶段的
 * 对应资料，而不是回退到只有本命盘的通用提示词。
 */
export function buildCurrentBaziFortuneSelectionForScope(
  result: BaziChartResult,
  scope: Exclude<BaziFortuneSelectionValue['scope'], 'natal' | 'full'>,
  now = new Date(),
): BaziFortuneSelectionValue | null {
  const current = buildCurrentBaziFortuneSelection(result, now);
  if (!current) return null;

  if (scope === 'dayun') {
    return { scope, cycleIndex: current.cycleIndex };
  }
  if (scope === 'year') {
    return {
      scope,
      cycleIndex: current.cycleIndex,
      year: current.year,
    };
  }
  if (scope === 'month') {
    return {
      scope,
      cycleIndex: current.cycleIndex,
      year: current.year,
      month: current.month,
    };
  }
  return current;
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
