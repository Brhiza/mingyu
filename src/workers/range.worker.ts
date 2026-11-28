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
    let collected: unknown;
    if (kind === 'astrolabe-range') {
      const [{ collectAstrolabeRange }, { astrolabeRange }] = await Promise.all([
        import('../astrolabe-range-client'),
        import('../systems/astrolabe-range'),
      ]);
      collected = await collectAstrolabeRange(payload, async (page) => (await astrolabeRange(page)).data, options);
    } else {
      const [{ collectQizhengRange }, { qizhengRange }] = await Promise.all([
        import('../qizheng-range-client'),
        import('../systems/qizheng-range'),
      ]);
      collected = await collectQizhengRange(payload, async (page) => (await qizhengRange(page)).data, options);
    }
    ctx.postMessage({ id, type: 'result', result: collected });
  } catch (err) {
    ctx.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : '出生范围计算失败。',
    });
  }
};
