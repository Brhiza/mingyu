import type {
  AstrolabeReadingCalculationResult,
  AstrolabeReadingProgress,
} from './astrolabe-reading-calculation';

type AstrolabeReadingWorkerResponse =
  | { id: string; type: 'progress'; completed: number; total: number }
  | { id: string; type: 'result'; result: AstrolabeReadingCalculationResult }
  | { id: string; type: 'error'; error?: string };

let requestCounter = 0;

function createWorkerId() {
  requestCounter += 1;
  return `astrolabe-reading-${requestCounter}`;
}

function createAbortError() {
  return new DOMException('已停止解读', 'AbortError');
}

/** 通过独立 Worker 完成本命盘与周期批次；失败直接抛出，不自动改走网络。 */
export function executeAstrolabeReadingWorker(
  calculationRequest: Record<string, unknown>,
  signal?: AbortSignal,
  onProgress?: AstrolabeReadingProgress,
): Promise<AstrolabeReadingCalculationResult> {
  if (signal?.aborted) return Promise.reject(createAbortError());
  let worker: Worker;
  try {
    worker = new Worker(new URL('../../workers/astrolabe-reading.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch (error) {
    return Promise.reject(error);
  }
  const requestId = createWorkerId();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      try {
        worker.terminate();
      } catch {
        // Worker 已结束时无需重复处理终止错误。
      }
    };
    const finishWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('星盘本地计算失败。'));
    };
    const handleAbort = () => finishWithError(createAbortError());
    signal?.addEventListener('abort', handleAbort, { once: true });
    worker.onmessage = (event: MessageEvent<AstrolabeReadingWorkerResponse>) => {
      if (settled || event.data.id !== requestId) return;
      if (event.data.type === 'progress') {
        try {
          onProgress?.(event.data.completed, event.data.total);
        } catch (error) {
          finishWithError(error);
        }
      } else if (event.data.type === 'result') {
        settled = true;
        cleanup();
        resolve(event.data.result);
      } else {
        finishWithError(new Error(event.data.error || '星盘本地计算失败。'));
      }
    };
    worker.onerror = (event) => finishWithError(new Error(event.message || '星盘本地计算失败。'));
    worker.onmessageerror = () => finishWithError(new Error('星盘本地结果解析失败。'));
    try {
      worker.postMessage({ id: requestId, type: 'calculate', calculationRequest });
    } catch (error) {
      finishWithError(error);
    }
  });
}
