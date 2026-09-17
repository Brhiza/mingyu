import {
  calculateMingluRangePageFacts,
  type MingluRangeCalculationRequest,
  type MingluRangePageFacts,
} from '@/lib/full-chart-engine/minglu-range';

type WorkerRequest = {
  id: string;
  type: 'calculate';
  calculationRequest: MingluRangeCalculationRequest;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message || message.type !== 'calculate') return;

  void calculateMingluRangePageFacts(message.calculationRequest)
    .then((result: MingluRangePageFacts) => {
      self.postMessage({ id: message.id, type: 'result', result });
    })
    .catch((error: unknown) => {
      self.postMessage({
        id: message.id,
        type: 'error',
        error: error instanceof Error ? error.message : '命录当前页计算失败。',
      });
    });
};
