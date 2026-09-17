import {
  generateZiweiReadingLocally,
  type ZiweiReadingChunk,
} from '@/lib/ai/ziwei-reading-calculation';

type WorkerRequest = {
  id: string;
  type: 'calculate';
  calculationRequest: Record<string, unknown>;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type !== 'calculate') return;
  void generateZiweiReadingLocally(message.calculationRequest, {
    onProgress: (completed, total) => {
      self.postMessage({ id: message.id, type: 'progress', completed, total });
    },
    onChunk: (chunk: ZiweiReadingChunk) => {
      self.postMessage({ id: message.id, type: 'chunk', chunk });
    },
  })
    .then(() => {
      self.postMessage({ id: message.id, type: 'complete' });
    })
    .catch((error: unknown) => {
      self.postMessage({
        id: message.id,
        type: 'error',
        error: error instanceof Error ? error.message : '紫微本地计算失败。',
      });
    });
};
