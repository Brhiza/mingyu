import type { AnalysisPayloadV1 } from '../../types/analysis';
import { buildPortablePromptPack as buildCorePortablePromptPack } from 'mingyu-core/ziwei/prompt';
import { toZiweiPromptContext, type PromptContext } from './types';

export type { PromptContext } from './types';

export function buildPortablePromptPack(params: {
  payload: AnalysisPayloadV1;
  reportContext: PromptContext;
  mode?: 'full' | 'task-book';
}) {
  return buildCorePortablePromptPack({
    payload: params.payload,
    reportContext: toZiweiPromptContext(params.reportContext),
    mode: params.mode === 'task-book' ? 'task-book' : 'readable',
  });
}
