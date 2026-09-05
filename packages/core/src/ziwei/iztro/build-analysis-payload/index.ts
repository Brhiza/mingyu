import type { IztroAstrolabe, IztroHoroscope } from '../../../types/iztro';
import type { ChartInput } from '../../../types/chart';
import type { AnalysisPayloadV1, ScopeType, ZiweiCalculationConfig } from '../../../types/analysis';
import { buildEvidenceAnalysis, buildEvidencePool } from '../build-evidence-pool';
import { buildPatternAnalysis, detectPatterns } from '../pattern-detection';
import { DEFAULT_ZIWEI_CALCULATION_CONFIG } from '../runtime-helpers';
import { assertScopeType, getCurrentScopeItem } from './helpers/scope';
import { buildActiveScope, buildBasicInfo, buildPalaceFacts } from './helpers/builders';

export function buildAnalysisPayloadV1(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  calculationConfig?: ZiweiCalculationConfig;
  birthTime?: ChartInput['birthTime'];
  skipAnalysis?: boolean;
}): AnalysisPayloadV1 {
  const { astrolabe, horoscope, currentScope, calculationConfig, skipAnalysis } = params;
  assertScopeType(currentScope);

  const currentScopeItem = getCurrentScopeItem(horoscope, currentScope);
  const basic_info = buildBasicInfo(astrolabe, params.birthTime);
  const birthYearHeavenlyStem = astrolabe.rawDates?.chineseDate?.yearly?.[0];
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

  const patterns = skipAnalysis
    ? []
    : detectPatterns({
        palaces,
        birthTimeLabel: basic_info.birth_time_label,
        birthTimeRange: basic_info.birth_time_range,
        birthYearHeavenlyStem,
      });
  const pattern_analysis = buildPatternAnalysis({
    patterns,
    palaces,
    skipped: skipAnalysis,
    birthTimeLabel: basic_info.birth_time_label,
    birthTimeRange: basic_info.birth_time_range,
    birthYearHeavenlyStem,
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
