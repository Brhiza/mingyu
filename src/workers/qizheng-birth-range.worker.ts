import {
  generateQizhengBirthRange,
  type QizhengBirthRange,
  type QizhengInput,
} from 'mingyu-core/qizheng';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

type QizhengBirthRangeWorkerSource = BaziReverseSource & {
  startTimestamp: number;
  endTimestamp: number;
};

type QizhengBirthRangeWorkerRequest = {
  id: string;
  input: QizhengInput;
  source: QizhengBirthRangeWorkerSource;
};

self.onmessage = (event: MessageEvent<QizhengBirthRangeWorkerRequest>) => {
  const { id, input, source } = event.data;
  try {
    let lastProgressTime = 0;
    const result = generateQizhengBirthRange(
      input,
      {
        startTimestamp: source.startTimestamp,
        endTimestamp: source.endTimestamp,
      },
      {
        onProgress: (completed, total) => {
          const now = performance.now();
          if (completed === total || completed === 1 || now - lastProgressTime >= 100) {
            lastProgressTime = now;
            self.postMessage({ id, type: 'progress', completed, total });
          }
        },
      },
    );
    self.postMessage({
      id,
      type: 'result',
      result: result as QizhengBirthRange,
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : '七政四余出生区间计算失败。',
    });
  }
};
