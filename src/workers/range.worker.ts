import { collectAstrolabeRange } from '../astrolabe-range-client';
import { collectQizhengRange } from '../qizheng-range-client';
import { astrolabeRange } from '../systems/astrolabe-range';
import { qizhengRange } from '../systems/qizheng-range';

export interface RangeWorkerRequest {
  id: number;
  kind: 'astrolabe-range' | 'qizheng-range';
  payload: unknown;
}

export type RangeWorkerResponse =
  | { id: number; type: 'progress'; completed: number; total: number }
  | { id: number; type: 'result'; result: unknown }
  | { id: number; type: 'error'; error: string };

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<RangeWorkerRequest>) => void) | null;
  postMessage: (msg: RangeWorkerResponse) => void;
};

ctx.onmessage = async (event: MessageEvent<RangeWorkerRequest>) => {
  const { id, kind, payload } = event.data;
  const options = {
    onProgress: (completed: number, total: number) => {
      ctx.postMessage({ id, type: 'progress', completed, total });
    },
  };
  try {
    const collected =
      kind === 'astrolabe-range'
        ? await collectAstrolabeRange(payload, async (page) => (await astrolabeRange(page)).data, options)
        : await collectQizhengRange(payload, async (page) => (await qizhengRange(page)).data, options);
    ctx.postMessage({ id, type: 'result', result: collected });
  } catch (err) {
    ctx.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : '出生范围计算失败。',
    });
  }
};
