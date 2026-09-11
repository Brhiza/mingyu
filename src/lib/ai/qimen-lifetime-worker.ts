import type { QimenLifetimeData, QimenLifetimeInput } from 'mingyu-core/types';

export type QimenLifetimeWorkerResult = {
  prompt: string;
  result: QimenLifetimeData;
};

type WorkerResponse =
  | ({ id: string; ok: true } & QimenLifetimeWorkerResult)
  | { id: string; ok: false; error?: string };

let requestCounter = 0;

function createAbortError() {
  return new DOMException('已停止解读', 'AbortError');
}

function createWorkerId() {
  requestCounter += 1;
  return `qimen-lifetime-${requestCounter}`;
}

export function executeQimenLifetimeWorker(
  input: QimenLifetimeInput,
  question: string | undefined,
  signal?: AbortSignal,
): Promise<QimenLifetimeWorkerResult> {
  if (signal?.aborted) return Promise.reject(createAbortError());

  let worker: Worker;
  try {
    worker = new Worker(new URL('../../workers/qimen-lifetime.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch (error) {
    return Promise.reject(error);
  }

  const requestId = createWorkerId();
  return new Promise<QimenLifetimeWorkerResult>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      finishWithError(new Error('奇门终身局计算超时，请稍后重试。'));
    }, 45_000);

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      try {
        worker.terminate();
      } catch {
        // worker 已结束时无需重复处理终止错误。
      }
    };

    const finishWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('奇门终身局排盘失败。'));
    };

    const handleAbort = () => finishWithError(createAbortError());

    if (signal?.aborted) {
      finishWithError(createAbortError());
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (settled || event.data.id !== requestId) return;
      if (event.data.ok) {
        settled = true;
        cleanup();
        resolve({
          prompt: event.data.prompt,
          result: event.data.result,
        });
      } else {
        finishWithError(new Error(event.data.error || '奇门终身局排盘失败。'));
      }
    };
    worker.onerror = (event) => {
      finishWithError(new Error(event.message || '奇门终身局排盘失败。'));
    };
    worker.onmessageerror = () => {
      finishWithError(new Error('奇门终身局结果解析失败。'));
    };

    try {
      worker.postMessage({ id: requestId, input, question });
    } catch (error) {
      finishWithError(error);
    }
  });
}
