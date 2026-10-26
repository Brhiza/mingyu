import { attachWorkerSafety } from '@/hooks/useWorkerRequest';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';

export function createDisplayWorker(
  message: { id: string; input: ChartInput; dateStr: string; hourIndex: number; scope: ScopeType },
  onSuccess: (payload: AnalysisPayloadV1) => void,
  onError: () => void,
): () => void {
  const worker = new Worker(new URL('../../../workers/ziwei-display.worker.ts', import.meta.url), {
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
    onError: () => {
      if (settled) return;
      finish();
      onError();
    },
  });
  worker.onmessage = (
    event: MessageEvent<{
      id: string;
      ok: boolean;
      payload?: AnalysisPayloadV1;
    }>,
  ) => {
    if (settled || event.data.id !== message.id) {
      return;
    }
    finish();

    if (event.data.ok && event.data.payload) {
      onSuccess(event.data.payload);
    } else {
      onError();
    }
  };

  worker.postMessage(message);

  return finish;
}
