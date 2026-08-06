export * from './types';
export * from './labels';
export * from './formatters';
export * from './focus';
export * from './builders';
export * from './snapshot';
export * from './combined';

import type { AnalysisPayloadV1 } from '../../types/analysis';
import { buildZiweiReadableSnapshot, buildZiweiTaskBookSnapshot } from './snapshot';
import type { ZiweiPromptContext, ZiweiPromptSnapshotMode } from './types';

/** 生成可独立复制给在线 AI 的紫微结构化快照。 */
export function buildPortablePromptPack(params: {
  payload: AnalysisPayloadV1;
  reportContext: ZiweiPromptContext;
  mode?: ZiweiPromptSnapshotMode;
}) {
  const builder =
    params.mode === 'task-book' ? buildZiweiTaskBookSnapshot : buildZiweiReadableSnapshot;
  return builder({ payload: params.payload, reportContext: params.reportContext });
}
