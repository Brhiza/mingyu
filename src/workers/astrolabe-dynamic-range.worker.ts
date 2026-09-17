import { scanAstrolabeDynamicRange } from 'mingyu-core/divination/astrolabe-dynamic-range';
import { validateAstrolabeBirthRangeInput } from '../lib/astrolabe-birth-range';
import type {
  DynamicRangeWorkerRequest,
  DynamicRangeWorkerResponse,
} from '../lib/astrolabe-dynamic-range';

let scanner: ReturnType<typeof scanAstrolabeDynamicRange> | undefined;
const send = (message: DynamicRangeWorkerResponse) => self.postMessage(message);
self.onmessage = (event: MessageEvent<DynamicRangeWorkerRequest>) => {
  try {
    const message = event.data;
    if (message.type === 'start') {
      if (scanner) throw new Error('西占动态区间计算已经开始。');
      const source = validateAstrolabeBirthRangeInput(message.input, message.source);
      let lastProgress = 0;
      scanner = scanAstrolabeDynamicRange(message.input, source, message.request, {
        onProgress(completed, total) {
          const now = performance.now();
          if (completed === 1 || completed === total || now - lastProgress >= 100) {
            lastProgress = now;
            send({ type: 'progress', completed, total });
          }
        },
      });
    }
    if (!scanner) throw new Error('西占动态区间计算尚未开始。');
    const next = scanner.next();
    if (next.done) {
      scanner = undefined;
      send({ type: 'complete', summary: next.value });
    } else send({ type: 'branch', branch: next.value });
  } catch (error) {
    scanner = undefined;
    send({
      type: 'error',
      error: error instanceof Error ? error.message : '西占动态区间计算失败。',
    });
  }
};
