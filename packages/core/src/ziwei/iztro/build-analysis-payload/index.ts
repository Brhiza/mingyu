import type { IztroAstrolabe, IztroHoroscope } from '../../../types/iztro';
import type { AnalysisPayloadV1, ScopeType } from '../../../types/analysis';
import { buildEvidenceAnalysis, buildEvidencePool } from '../build-evidence-pool';
import { buildPatternAnalysis, detectPatterns } from '../pattern-detection';
import { assertScopeType, getCurrentScopeItem } from './helpers/scope';
import { buildActiveScope, buildBasicInfo, buildPalaceFacts } from './helpers/builders';

export function buildAnalysisPayloadV1(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  skipAnalysis?: boolean;
}): AnalysisPayloadV1 {
  const { astrolabe, horoscope, currentScope, skipAnalysis } = params;
  assertScopeType(currentScope);

  const currentScopeItem = getCurrentScopeItem(horoscope, currentScope);
  const basic_info = buildBasicInfo(astrolabe);
  const active_scope = buildActiveScope({
    horoscope,
    currentScope,
    currentScopeItem,
    palaces: astrolabe.palaces,
  });

  const palaces = buildPalaceFacts({
    astrolabe,
    horoscope,
    currentScope,
    currentScopeItem,
    hiddenPalaces: basic_info.hidden_palaces,
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
      });
  const pattern_analysis = buildPatternAnalysis({
    patterns,
    palaces,
    skipped: skipAnalysis,
  });

  return {
    payload_version: 'analysis_payload_v1',
    language: 'zh-CN',
    basic_info,
    active_scope,
    palaces,
    evidence_pool,
    evidence_analysis,
    patterns,
    pattern_analysis,
  };
}
