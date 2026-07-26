import { attachWorkerSafety } from '@/hooks/useWorkerRequest';
import type { ZiweiHoroscopeContext } from '@/lib/full-chart-engine';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';

export function createPayloadWorker(
  input: ChartInput,
  horoscopeContext: ZiweiHoroscopeContext,
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

  worker.postMessage({ id: requestId, input, horoscopeContext });

  return () => {
    disarm();
    worker.terminate();
  };
}
