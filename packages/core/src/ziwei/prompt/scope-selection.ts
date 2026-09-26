import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import { mapZiweiScopeLabel } from './labels';

/** 排盘保留各层落宫；提示词只展示本次选择的运限落宫。 */
export function getSelectedScopeHits(payload: AnalysisPayloadV1, palace: PalaceFact): string[] {
  const { scope, label } = payload.active_scope;
  if (scope === 'origin') return [];
  const selectedHit = `${scope === 'decadal' ? label || '大限' : mapZiweiScopeLabel(scope)}落宫`;
  return palace.scope_hits.filter((hit) => hit === selectedHit);
}
