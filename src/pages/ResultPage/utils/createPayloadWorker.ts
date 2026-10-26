import { attachWorkerSafety } from '@/hooks/useWorkerRequest';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ReadingResource } from '@/lib/ai/reading-workflow';
import type { ZiweiRuntimeOptions } from 'mingyu-core/ziwei';

export type ZiweiReadingResourceContent = Omit<ReadingResource, 'key' | 'title'>;
export type ZiweiPayloadOptions = Omit<ZiweiRuntimeOptions, 'scopes'>;

export function createPayloadWorker(
  input: ChartInput,
  options: ZiweiPayloadOptions,
  requestId: string,
  onSuccess: (payloadByScope: Record<ScopeType, AnalysisPayloadV1>) => void,
  onError: (message: string) => void,
  fallbackError: string,
): () => void {
  const worker = new Worker(new URL('../../../workers/ziwei-payload.worker.ts', import.meta.url), {
    type: 'module',
  });
  let settled = false;
  const finish = () => {
    settled = true;
    disarm();
    worker.onmessage = null;
    worker.terminate();
  };
  const disarm = attachWorkerSafety(worker, {
    onError: (message) => {
      if (settled) return;
      finish();
      onError(message);
    },
  });
  worker.onmessage = (
    event: MessageEvent<{
      id: string;
      ok: boolean;
      payloadByScope?: Record<ScopeType, AnalysisPayloadV1>;
      error?: string;
    }>,
  ) => {
    if (settled || event.data.id !== requestId) {
      return;
    }
    finish();

    if (event.data.ok && event.data.payloadByScope) {
      onSuccess(event.data.payloadByScope);
    } else {
      onError(event.data.error || fallbackError);
    }
  };

  worker.postMessage({ id: requestId, input, options });

  return finish;
}

export function createReadingResourceWorker(
  input: ChartInput,
  dateStr: string,
  hourIndex: number,
  requestId: string,
  onSuccess: (resource: ZiweiReadingResourceContent) => void,
  onError: (message: string) => void,
): () => void {
  const worker = new Worker(new URL('../../../workers/ziwei-payload.worker.ts', import.meta.url), {
    type: 'module',
  });
  let settled = false;
  const finish = () => {
    settled = true;
    disarm();
    worker.onmessage = null;
    worker.terminate();
  };
  const disarm = attachWorkerSafety(worker, {
    onError: (message) => {
      if (settled) return;
      finish();
      onError(message);
    },
  });
  worker.onmessage = (
    event: MessageEvent<{
      id: string;
      kind?: 'payload' | 'reading-resource';
      ok: boolean;
      resource?: ZiweiReadingResourceContent;
      error?: string;
    }>,
  ) => {
    if (settled || event.data.id !== requestId) return;
    finish();

    if (event.data.kind === 'reading-resource' && event.data.ok && event.data.resource) {
      onSuccess(event.data.resource);
    } else {
      onError(event.data.error || '紫微完整运限资料生成失败。');
    }
  };

  worker.postMessage({
    id: requestId,
    kind: 'reading-resource',
    input,
    dateStr,
    hourIndex,
  });

  return finish;
}
