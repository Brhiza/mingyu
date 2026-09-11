import { attachWorkerSafety } from '@/hooks/useWorkerRequest';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { buildSerializableZiweiResult } from 'mingyu-core/ziwei';

type ZiweiReadingResourceContent = {
  text: string;
  usable: true;
  kind: 'evidence';
  structured: ReturnType<typeof buildSerializableZiweiResult>;
};

export function createPayloadWorker(
  input: ChartInput,
  requestId: string,
  onSuccess: (payloadByScope: Record<ScopeType, AnalysisPayloadV1>) => void,
  onError: (message: string) => void,
  fallbackError: string,
): () => void {
  const worker = new Worker(new URL('../../../workers/ziwei-payload.worker.ts', import.meta.url), {
    type: 'module',
  });
  const disarm = attachWorkerSafety(worker, { onError });
  worker.onmessage = (
    event: MessageEvent<{
      id: string;
      ok: boolean;
      payloadByScope?: Record<ScopeType, AnalysisPayloadV1>;
      error?: string;
    }>,
  ) => {
    if (event.data.id !== requestId) {
      return;
    }
    disarm();

    if (event.data.ok && event.data.payloadByScope) {
      onSuccess(event.data.payloadByScope);
    } else {
      onError(event.data.error || fallbackError);
    }

    worker.terminate();
  };

  worker.postMessage({ id: requestId, input });

  return () => {
    disarm();
    worker.terminate();
  };
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
  const disarm = attachWorkerSafety(worker, { onError });
  worker.onmessage = (
    event: MessageEvent<{
      id: string;
      kind?: 'payload' | 'reading-resource';
      ok: boolean;
      resource?: ZiweiReadingResourceContent;
      error?: string;
    }>,
  ) => {
    if (event.data.id !== requestId) return;
    disarm();

    if (event.data.kind === 'reading-resource' && event.data.ok && event.data.resource) {
      onSuccess(event.data.resource);
    } else {
      onError(event.data.error || '紫微完整运限资料生成失败。');
    }

    worker.terminate();
  };

  worker.postMessage({
    id: requestId,
    kind: 'reading-resource',
    input,
    dateStr,
    hourIndex,
  });

  return () => {
    disarm();
    worker.terminate();
  };
}
