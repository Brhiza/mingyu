import {
  generateAstrolabeBirthRange,
  type AstrolabeBirthRange,
  type AstrolabeBirthRangeSource,
} from '../lib/astrolabe-birth-range';
import type { AstrolabeBirthInput } from 'mingyu-core/types';

type AstrolabeBirthRangeWorkerRequest = {
  id: string;
  input: AstrolabeBirthInput;
  source: AstrolabeBirthRangeSource;
};

type AstrolabeBirthRangeWorkerResponse =
  | { id: string; type: 'progress'; completed: number; total: number }
  | { id: string; type: 'result'; result: AstrolabeBirthRange }
  | { id: string; type: 'error'; error: string };

self.onmessage = (event: MessageEvent<AstrolabeBirthRangeWorkerRequest>) => {
  const { id, input, source } = event.data;
  try {
    let lastProgressTime = 0;
    const result = generateAstrolabeBirthRange(input, source, {
      onProgress: (completed, total) => {
        const now = performance.now();
        if (completed === total || completed === 1 || now - lastProgressTime >= 100) {
          lastProgressTime = now;
          const response: AstrolabeBirthRangeWorkerResponse = {
            id,
            type: 'progress',
            completed,
            total,
          };
          self.postMessage(response);
        }
      },
    });
    const response: AstrolabeBirthRangeWorkerResponse = { id, type: 'result', result };
    self.postMessage(response);
  } catch (error) {
    const response: AstrolabeBirthRangeWorkerResponse = {
      id,
      type: 'error',
      error: error instanceof Error ? error.message : '西占星盘出生区间计算失败。',
    };
    self.postMessage(response);
  }
};
