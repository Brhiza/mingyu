import {
  calculateBaziRangePage,
  type BaziRangeWorkerRequest,
  type BaziRangeWorkerResponse,
} from '@/lib/full-chart-engine/bazi-range';

self.onmessage = (event: MessageEvent<BaziRangeWorkerRequest>) => {
  const request = event.data;
  void calculateBaziRangePage(request)
    .then((result) => {
      const response: BaziRangeWorkerResponse = {
        id: request.id,
        type: 'result',
        result,
      };
      self.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: BaziRangeWorkerResponse = {
        id: request.id,
        type: 'error',
        error: error instanceof Error ? error.message : '八字出生范围计算失败。',
      };
      self.postMessage(response);
    });
};
