import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import { buildEvidenceSummary as buildCoreEvidenceSummary } from 'mingyu-core/ziwei/prompt';
import { toZiweiPromptContext, type PromptContext } from './types';

export {
  buildPalaceSummary,
  buildScopeStructureSummary,
  buildScopeHitSummary,
  buildPalaceIndex,
} from 'mingyu-core/ziwei/prompt';

export function buildEvidenceSummary(
  payload: AnalysisPayloadV1,
  focusPalaces: PalaceFact[],
  reportContext: PromptContext,
) {
  return buildCoreEvidenceSummary(payload, focusPalaces, toZiweiPromptContext(reportContext));
}
