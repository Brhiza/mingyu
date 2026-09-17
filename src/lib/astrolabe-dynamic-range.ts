import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeRequest,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import type { BaziReverseSource } from './bazi-reverse-input';
import { validateAstrolabeBirthRangeInput } from './astrolabe-birth-range';

export type DynamicRangeWorkerRequest =
  | {
      type: 'start';
      input: AstrolabeBirthInput;
      source: BaziReverseSource;
      request: AstrolabeDynamicRangeRequest;
    }
  | { type: 'next' };
export type DynamicRangeWorkerResponse =
  | { type: 'branch'; branch: AstrolabeDynamicRangeBranch }
  | { type: 'complete'; summary: AstrolabeDynamicRangeSummary }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'error'; error: string };

/** 消费方保存完当前段后才请求下一段，结果不会在消息队列中堆积。 */
export function executeAstrolabeDynamicRangeWorker(
  input: AstrolabeBirthInput,
  source: BaziReverseSource,
  request: AstrolabeDynamicRangeRequest,
  onBranch: (branch: AstrolabeDynamicRangeBranch) => void | Promise<void>,
  options: { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void } = {},
): Promise<AstrolabeDynamicRangeSummary> {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException('已停止西占动态区间计算。', 'AbortError');
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }
    const validSource = validateAstrolabeBirthRangeInput(input, source);
    const worker = new Worker(
      new URL('../workers/astrolabe-dynamic-range.worker.ts', import.meta.url),
      { type: 'module' },
    );
    let settled = false;
    const cleanup = () => {
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(abortError());
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => fail(new Error(event.message || '西占动态区间计算失败。'));
    worker.onmessageerror = () => fail(new Error('西占动态区间结果解析失败。'));
    worker.onmessage = async (event: MessageEvent<DynamicRangeWorkerResponse>) => {
      if (settled) return;
      try {
        const message = event.data;
        if (message.type === 'progress') options.onProgress?.(message.completed, message.total);
        else if (message.type === 'error') fail(new Error(message.error));
        else if (message.type === 'branch') {
          await onBranch(message.branch);
          if (!settled) worker.postMessage({ type: 'next' } satisfies DynamicRangeWorkerRequest);
        } else {
          settled = true;
          cleanup();
          resolve(message.summary);
        }
      } catch (error) {
        fail(error);
      }
    };
    try {
      worker.postMessage({
        type: 'start',
        input,
        source: validSource,
        request,
      } satisfies DynamicRangeWorkerRequest);
    } catch (error) {
      fail(error);
    }
  });
}
