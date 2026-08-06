import type { AnalysisPayloadV1 } from '../../types/analysis';
import {
  buildPromptContextSnapshot as buildCorePromptContextSnapshot,
  buildZiweiReadableSnapshot as buildCoreZiweiReadableSnapshot,
  buildZiweiTaskBookSnapshot as buildCoreZiweiTaskBookSnapshot,
} from 'mingyu-core/ziwei/prompt';
import { toZiweiPromptContext, type PromptContext } from './types';

type SnapshotParams = {
  payload: AnalysisPayloadV1;
  reportContext: PromptContext;
};

function toCoreParams(params: SnapshotParams) {
  return {
    payload: params.payload,
    reportContext: toZiweiPromptContext(params.reportContext),
  };
}

export function buildPromptContextSnapshot(params: SnapshotParams) {
  return buildCorePromptContextSnapshot(toCoreParams(params));
}

export function buildZiweiReadableSnapshot(params: SnapshotParams) {
  return buildCoreZiweiReadableSnapshot(toCoreParams(params));
}

export function buildZiweiTaskBookSnapshot(params: SnapshotParams) {
  return buildCoreZiweiTaskBookSnapshot(toCoreParams(params));
}
