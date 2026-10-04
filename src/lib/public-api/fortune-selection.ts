import {
  buildBaziFortuneSelectionForDate,
  buildCurrentBaziFortuneSelectionForScope,
  getCurrentBaziLuckCycle,
  resolveBaziFortuneDate,
  type BaziChartResult,
  type BaziFortuneSelectionValue,
} from 'mingyu-core/bazi';

type TimedBaziFortuneScope = Exclude<BaziFortuneSelectionValue['scope'], 'natal' | 'full'>;

/** 按紫微运限基准日选取对应八字岁运；超出命盘运限范围时保留缺资料状态。 */
export function selectBaziFortuneForZiweiScope(
  result: BaziChartResult,
  scope: TimedBaziFortuneScope,
  scopeDate?: string,
): BaziFortuneSelectionValue | null {
  if (!scopeDate) return buildCurrentBaziFortuneSelectionForScope(result, scope);

  const { referenceTimestamp } = resolveBaziFortuneDate(scopeDate);
  if (!getCurrentBaziLuckCycle(result, new Date(referenceTimestamp))) return null;
  return buildBaziFortuneSelectionForDate(result, scope, scopeDate);
}
