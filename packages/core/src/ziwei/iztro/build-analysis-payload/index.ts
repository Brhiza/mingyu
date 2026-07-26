import type { IztroAstrolabe, IztroHoroscope } from '../../../types/iztro';
import type {
  AnalysisPayloadV1,
  PatternFact,
  ScopeType,
  ZiweiCalculationConfig,
} from '../../../types/analysis';
import { buildEvidenceAnalysis, buildEvidencePool } from '../build-evidence-pool';
import { buildPatternAnalysis } from '../pattern-detection';
import { DEFAULT_ZIWEI_CALCULATION_CONFIG } from '../runtime-helpers';
import { assertScopeType, getCurrentScopeItem } from './helpers/scope';
import { buildActiveScope, buildBasicInfo, buildPalaceFacts } from './helpers/builders';

export function buildAnalysisPayloadV1(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  calculationConfig?: ZiweiCalculationConfig;
  skipAnalysis?: boolean;
}): AnalysisPayloadV1 {
  const { astrolabe, horoscope, currentScope, calculationConfig, skipAnalysis } = params;
  assertScopeType(currentScope);

  const currentScopeItem = getCurrentScopeItem(horoscope, currentScope);
  const basic_info = buildBasicInfo(astrolabe);
  const active_scope = buildActiveScope({
    astrolabe,
    horoscope,
    currentScope,
    currentScopeItem,
  });

  const palaces = buildPalaceFacts({
    astrolabe,
    horoscope,
    currentScope,
    currentScopeItem,
  });

  const evidence_pool = skipAnalysis
    ? []
    : buildEvidencePool({
        astrolabe,
        horoscope,
        currentScope,
        palaces,
      });
  const evidence_analysis = buildEvidenceAnalysis({
    evidencePool: evidence_pool,
    currentScope,
    palaces,
    skipped: skipAnalysis,
  });

  // 自定义格局规则尚未逐条完成原文校勘，不能作为传统事实输出。
  const patterns: PatternFact[] = [];
  const pattern_analysis = buildPatternAnalysis({
    patterns,
    palaces,
    skipped: true,
    sourceUnverified: true,
  });

  return {
    payload_version: 'analysis_payload_v1',
    language: 'zh-CN',
    calculation_config: calculationConfig ?? DEFAULT_ZIWEI_CALCULATION_CONFIG,
    basic_info,
    active_scope,
    palaces,
    evidence_pool,
    evidence_analysis,
    patterns,
    pattern_analysis,
  };
}
