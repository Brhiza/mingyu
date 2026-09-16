import {
  generateAstrolabeReadingLocally,
  type AstrolabeReadingCalculationResult,
} from '@/lib/ai/astrolabe-reading-calculation';

type WorkerRequest = {
  id: string;
  type: 'calculate';
  calculationRequest: Record<string, unknown>;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  void generateAstrolabeReadingLocally(message.calculationRequest, {
    onProgress: (completed, total) => {
      self.postMessage({ id: message.id, type: 'progress', completed, total });
    },
  })
    .then((result: AstrolabeReadingCalculationResult) => {
      self.postMessage({ id: message.id, type: 'result', result });
    })
    .catch((error: unknown) => {
      self.postMessage({
        id: message.id,
        type: 'error',
        error: error instanceof Error ? error.message : '星盘本地计算失败。',
      });
    });
};
