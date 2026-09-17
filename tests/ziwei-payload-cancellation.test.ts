import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChartInput } from '../src/types/chart';
import { loadZiweiPayload } from '../src/pages/ResultPage/utils/ziweiCalculationCache';

test('取消紫微预热后立即读取同一出生页应启动新计算并保留新缓存', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const workers: FakeWorker[] = [];
  class FakeWorker extends EventTarget {
    onmessage: ((event: MessageEvent) => void) | null = null;
    id = '';
    terminated = false;
    constructor() {
      super();
      workers.push(this);
    }
    postMessage(message: { id: string }) {
      this.id = message.id;
    }
    terminate() {
      this.terminated = true;
    }
    complete() {
      this.onmessage?.({
        data: { id: this.id, ok: true, payloadByScope: { origin: { marker: this.id } } },
      } as MessageEvent);
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  const input = {} as ChartInput;
  const key = '公开合成取消重启样本';
  const controller = new AbortController();
  try {
    const first = loadZiweiPayload(input, key, {}, undefined, controller.signal);
    const firstRejected = assert.rejects(first, { name: 'AbortError' });
    controller.abort();
    const second = loadZiweiPayload(input, key);
    assert.equal(workers.length, 2, '相同出生页不能复用已取消的预热请求');
    assert.equal(workers[0].terminated, true);
    await firstRejected;
    const samePending = loadZiweiPayload(input, key);
    assert.equal(samePending, second, '旧请求清理不能删除新请求的缓存');
    workers[1].complete();
    const result = await second;
    assert.equal(await loadZiweiPayload(input, key), result);
    assert.equal(workers.length, 2);
  } finally {
    for (const worker of workers) worker.complete();
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
