import {
  calculateBaziReading,
  type BaziReadingCalculationResult,
} from '@/lib/ai/bazi-reading-calculation';

type WorkerRequest = {
  id: string;
  type: 'calculate';
  calculationRequest: Record<string, unknown>;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type !== 'calculate') return;
  try {
    const result = calculateBaziReading(message.calculationRequest);
    self.postMessage({ id: message.id, type: 'result', result });
  } catch (error: unknown) {
    self.postMessage({
      id: message.id,
      type: 'error',
      error: error instanceof Error ? error.message : '八字本地计算失败。',
    });
  }
};

export type { BaziReadingCalculationResult };
