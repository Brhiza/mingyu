import type { BaziChartResult } from './baziTypes';
import { rebuildAuditedBaziData } from './baziCalculator';
import {
  formatBaziForPrompt as formatRebuiltBaziForPrompt,
  type PromptChartScene,
} from './baziAnalysisFormatter';
import { generateEnhancedAnalysisSection as generateRebuiltEnhancedAnalysisSection } from './baziPromptEnhancement';
import {
  analyzeBaziCompatibility as analyzeRebuiltBaziCompatibility,
  type BaziCompatibilityEvidenceResult,
  type BaziCompatibilityOptions,
} from './compatibilityEvidence';
import {
  analyzeFortuneTriggers as analyzeRebuiltFortuneTriggers,
  type FortuneTriggerEvidenceResult,
  type FortuneTriggerLayer,
} from './fortuneTriggerEvidence';
import {
  buildFortuneSelectionContext as buildRebuiltFortuneSelectionContext,
  normalizeFortuneSelection as normalizeRebuiltFortuneSelection,
  type BaziFortuneSelectionValue,
  type FortuneSelectionContext,
} from './fortuneSelection';

const BAZI_FORTUNE_SELECTION_KEYS = new Set(['scope', 'cycleIndex', 'year', 'month', 'day']);
const BAZI_FORTUNE_SCOPES = new Set(['natal', 'full', 'dayun', 'year', 'month', 'day']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertOptionalSafeInteger(
  value: unknown,
  label: string,
  min: number,
  max?: number,
): asserts value is number | undefined {
  if (value === undefined) return;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    (max !== undefined && value > max)
  ) {
    throw new Error(
      max === undefined
        ? `${label} 必须是不小于 ${min} 的安全整数。`
        : `${label} 必须是 ${min}-${max} 内的安全整数。`,
    );
  }
}

/** 只保留可复算的原始岁运选择；派生上下文、未知字段和非法值均拒绝。 */
export function normalizeBaziFortuneSelectionInput(selection: unknown): BaziFortuneSelectionValue {
  if (!isRecord(selection)) {
    throw new Error('八字岁运选择必须是对象。');
  }

  const unknownKeys = Object.keys(selection).filter((key) => !BAZI_FORTUNE_SELECTION_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`八字岁运选择包含不受支持的字段：${unknownKeys.join('、')}。`);
  }
  if (typeof selection.scope !== 'string' || !BAZI_FORTUNE_SCOPES.has(selection.scope)) {
    throw new Error('八字岁运 scope 必须是 natal、full、dayun、year、month 或 day。');
  }

  assertOptionalSafeInteger(selection.cycleIndex, '八字岁运 cycleIndex', 0);
  assertOptionalSafeInteger(selection.year, '八字岁运 year', 1);
  assertOptionalSafeInteger(selection.month, '八字岁运 month', 1, 12);
  assertOptionalSafeInteger(selection.day, '八字岁运 day', 1, 31);

  return {
    scope: selection.scope as BaziFortuneSelectionValue['scope'],
    ...(selection.cycleIndex === undefined ? {} : { cycleIndex: selection.cycleIndex }),
    ...(selection.year === undefined ? {} : { year: selection.year }),
    ...(selection.month === undefined ? {} : { month: selection.month }),
    ...(selection.day === undefined ? {} : { day: selection.day }),
  };
}

/** 先从可信出生来源重建，再格式化可交给 AI 的八字资料。 */
export function formatBaziForPrompt(
  input: BaziChartResult,
  selectedOption: unknown = null,
  scene: PromptChartScene = 'general',
): string {
  return formatRebuiltBaziForPrompt(rebuildAuditedBaziData(input), selectedOption, scene);
}

/** 先从可信出生来源重建，再生成八字补充资料段。 */
export function generateEnhancedAnalysisSection(
  input: BaziChartResult,
  topic: string = 'general',
): string {
  return generateRebuiltEnhancedAnalysisSection(rebuildAuditedBaziData(input), topic);
}

/** 先从可信出生来源重建，再返回本命证据。 */
export function analyzeBaziNatalEvidence(input: BaziChartResult) {
  return rebuildAuditedBaziData(input).evidenceAnalysis!;
}

/** 双方盘面均只凭各自可信出生来源重建，旧四柱与旧合盘资料不会参与计算。 */
export function analyzeBaziCompatibility(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
  options: BaziCompatibilityOptions = {},
): BaziCompatibilityEvidenceResult {
  return analyzeRebuiltBaziCompatibility(
    rebuildAuditedBaziData(chart1),
    rebuildAuditedBaziData(chart2),
    options,
  );
}

/** 先从可信出生来源重建原局，再核验调用方明确提供的岁运层级。 */
export function analyzeFortuneTriggers(
  input: BaziChartResult,
  activeLayers: FortuneTriggerLayer[],
): FortuneTriggerEvidenceResult {
  return analyzeRebuiltFortuneTriggers(rebuildAuditedBaziData(input), activeLayers);
}

/** 先重建完整原局，再将明确的岁运选择规范化。 */
export function normalizeFortuneSelection(
  input: BaziChartResult,
  selection: BaziFortuneSelectionValue,
): BaziFortuneSelectionValue {
  return normalizeRebuiltFortuneSelection(
    rebuildAuditedBaziData(input),
    normalizeBaziFortuneSelectionInput(selection),
  );
}

/** 先重建完整原局，再从明确的岁运选择生成提示词上下文。 */
export function buildFortuneSelectionContext(
  input: BaziChartResult,
  selection: BaziFortuneSelectionValue,
): FortuneSelectionContext | null {
  return buildRebuiltFortuneSelectionContext(
    rebuildAuditedBaziData(input),
    normalizeBaziFortuneSelectionInput(selection),
  );
}

export type { PromptChartScene } from './baziAnalysisFormatter';
export type { BaziFortuneSelectionValue, FortuneSelectionContext } from './fortuneSelection';
