import type { RangeWorkerRequest, RangeWorkerResponse } from './range.worker';

export interface RunRangeScanOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

let workerSeq = 0;

/**
 * 优先在浏览器后台线程（Web Worker）中执行星盘/七政逐秒范围扫描，避免卡住主界面；
 * 当运行环境不支持 Worker（如 Node 或测试环境）时自动回退主线程执行。
 */
export async function runRangeScanInBackground(
  kind: 'astrolabe-range' | 'qizheng-range',
  payload: unknown,
  options: RunRangeScanOptions = {},
): Promise<unknown> {
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./range.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        void runOnMainThread().then(resolve, reject);
        return;
      }

      const id = ++workerSeq;
      const cleanup = () => {
        options.signal?.removeEventListener('abort', onAbort);
        worker.terminate();
      };
      const onAbort = () => {
        cleanup();
        reject(new Error('计算已取消。'));
      };
      if (options.signal?.aborted) {
        onAbort();
        return;
      }
      options.signal?.addEventListener('abort', onAbort, { once: true });

      worker.onmessage = (ev: MessageEvent<RangeWorkerResponse>) => {
        const msg = ev.data;
        if (!msg || msg.id !== id) return;
        if (msg.type === 'progress') {
          options.onProgress?.(msg.completed, msg.total);
          return;
        }
        cleanup();
        if (msg.type === 'error') {
          reject(new Error(msg.error));
          return;
        }
        resolve(msg.result);
      };
      worker.onerror = () => {
        cleanup();
        void runOnMainThread().then(resolve, reject);
      };
      const req: RangeWorkerRequest = { id, kind, payload };
      worker.postMessage(req);
    });
  }

  return runOnMainThread();

  async function runOnMainThread(): Promise<unknown> {
    if (typeof __MINGYU_BROWSER_ASSETS__ !== 'undefined' && __MINGYU_BROWSER_ASSETS__) {
      throw new Error('当前浏览器不支持后台计算线程，请刷新或更换现代浏览器重试。');
    }
    const progressOptions = {
      signal: options.signal,
      onProgress: options.onProgress,
      yieldControl: () => new Promise<void>((r) => setTimeout(r, 0)),
    };
    if (kind === 'astrolabe-range') {
      const [{ collectAstrolabeRange }, { astrolabeRange }] = await Promise.all([
        import('../astrolabe-range-client'),
        import('../systems/astrolabe-range'),
      ]);
      return collectAstrolabeRange(
        payload,
        async (page) => (await astrolabeRange(page)).data,
        progressOptions,
      );
    }
    const [{ collectQizhengRange }, { qizhengRange }] = await Promise.all([
      import('../qizheng-range-client'),
      import('../systems/qizheng-range'),
    ]);
    return collectQizhengRange(
      payload,
      async (page) => (await qizhengRange(page)).data,
      progressOptions,
    );
  }
}
