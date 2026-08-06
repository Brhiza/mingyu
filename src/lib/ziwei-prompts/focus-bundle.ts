import type { AnalysisPayloadV1 } from '../../types/analysis';
import { buildFocusTaskBundle as buildCoreFocusTaskBundle } from 'mingyu-core/ziwei/prompt';
import { toZiweiPromptContext, type PromptContext } from './types';

export function buildFocusTaskBundle(payload: AnalysisPayloadV1, reportContext: PromptContext) {
  return buildCoreFocusTaskBundle(payload, toZiweiPromptContext(reportContext));
}
