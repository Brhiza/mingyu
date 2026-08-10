export const RESULT_DETAIL_MODES = ['compact', 'full'] as const;

export type ResultDetailMode = (typeof RESULT_DETAIL_MODES)[number];

const COMPACT_OMITTED_KEYS = new Set([
  'prompt',
  'evidenceAnalysis',
  'evidence_analysis',
  'evidencePromptText',
  'calculationChain',
  'calculationSteps',
  'trueSolarEvidence',
  'timezoneEvidence',
  'previousTermEvidence',
  'nextTermEvidence',
  'solarTermEvidence',
  'moonPhaseEvidence',
  'focusEvidence',
  'timingEvidence',
  'layoutEvidence',
  'primaryEvidence',
  'supportingEvidence',
  'counterEvidence',
]);

/**
 * 计算接口的默认响应只保留盘面与解读所需字段。
 * 完整证据对象仍由调用方通过 detailMode=full 显式获取。
 */
export function compactCalculationResult<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compactCalculationResult(item)) as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !COMPACT_OMITTED_KEYS.has(key))
      .map(([key, item]) => [key, compactCalculationResult(item)]),
  ) as T;
}

export function shapeCalculationResult<T>(value: T, detailMode: ResultDetailMode = 'compact'): T {
  return detailMode === 'full' ? value : compactCalculationResult(value);
}
