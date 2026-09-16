import {
  generateQizhengBirthRange,
  generateQizhengFlowBirthRange,
  type QizhengBirthRange,
  type QizhengFlowBirthRange,
  type QizhengInput,
} from 'mingyu-core/qizheng';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

type QizhengBirthRangeWorkerSource = BaziReverseSource & {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

type QizhengBirthRangeWorkerRequest = {
  id: string;
  input: QizhengInput;
  source: QizhengBirthRangeWorkerSource;
};

type QizhengDateRange = QizhengBirthRange | QizhengFlowBirthRange;

const QIZHENG_FLOW_FIELDS = ['flowYear', 'flowMonth', 'flowDay', 'flowHour', 'flowMinute'] as const;

self.onmessage = (event: MessageEvent<QizhengBirthRangeWorkerRequest>) => {
  const { id, input, source } = event.data;
  try {
    let lastProgressTime = 0;
    const options = {
      onProgress: (completed: number, total: number) => {
        const now = performance.now();
        if (completed === total || completed === 1 || now - lastProgressTime >= 100) {
          lastProgressTime = now;
          self.postMessage({ id, type: 'progress', completed, total });
        }
      },
    };
    const range = {
      startTimestamp: source.startTimestamp,
      endTimestamp: source.endTimestamp,
    };
    const flowSource = {
      ...range,
      endExclusive: true as const,
      timezone: 'Asia/Shanghai' as const,
      offsetHours: 8 as const,
    };
    const result: QizhengDateRange = QIZHENG_FLOW_FIELDS.some((field) => input[field] !== undefined)
      ? generateQizhengFlowBirthRange(input, flowSource, options)
      : generateQizhengBirthRange(input, range, options);
    self.postMessage({
      id,
      type: 'result',
      result,
    });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : '七政四余出生区间计算失败。',
    });
  }
};
