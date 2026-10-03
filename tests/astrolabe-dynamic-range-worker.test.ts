import assert from 'node:assert/strict';
import test from 'node:test';
import { getDivinationTime } from 'mingyu-core/calendar';
import {
  executeAstrolabeDynamicRangeWorker,
  type DynamicRangeWorkerRequest,
  type DynamicRangeWorkerResponse,
} from '../src/lib/astrolabe-dynamic-range';
import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';

const start = Date.parse('2024-03-20T11:00:00+08:00');
const input = {
  name: '公开合成样本',
  gender: '男',
  year: '2024',
  month: '3',
  day: '20',
  hour: '11',
  minute: '0',
  second: '0',
  timezone: '8',
  latitude: '39.9042',
  longitude: '116.416334',
};
const source = {
  pillars: getDivinationTime(new Date(start), 480).ganzhi,
  intervalStart: '2024-03-20 11:00:00',
  intervalEnd: '2024-03-20 11:00:02',
  startTimestamp: start,
  endTimestamp: start + 2000,
  endExclusive: true as const,
  timezone: 'Asia/Shanghai' as const,
  offsetHours: 8 as const,
};
const request = { scope: 'daily' as const, referenceDate: '2028-03-20' };
const branch = {
  startTimestamp: start,
  endTimestamp: start + 2000,
  sampleCount: 2,
} as AstrolabeDynamicRangeBranch;
const summary = { branchCount: 1, sampleCount: 2 } as AstrolabeDynamicRangeSummary;

class FakeWorker {
  static current: FakeWorker;
  posted: DynamicRangeWorkerRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<DynamicRangeWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  constructor() {
    FakeWorker.current = this;
  }
  postMessage(message: DynamicRangeWorkerRequest) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: DynamicRangeWorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<DynamicRangeWorkerResponse>);
  }
}

test('实际动态 Worker 按请求交付连续完整分段并返回范围汇总', async (context) => {
  context.mock.method(Date, 'now', () => Date.parse('2028-03-20T00:00:00Z'));
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const messages: DynamicRangeWorkerResponse[] = [];
  const workerScope = {
    postMessage(message: DynamicRangeWorkerResponse) {
      messages.push(structuredClone(message));
    },
    onmessage: null as ((event: MessageEvent<DynamicRangeWorkerRequest>) => void) | null,
  };
  Object.defineProperty(globalThis, 'self', { configurable: true, value: workerScope });
  try {
    await import('../src/workers/astrolabe-dynamic-range.worker');
    const fullRequest = { ...request, scope: 'full' as const };
    const fullSource = {
      ...source,
      intervalEnd: '2024-03-20 11:00:03',
      endTimestamp: start + 3000,
    };
    const expectedSampleCount = (fullSource.endTimestamp - fullSource.startTimestamp) / 1000;
    const delivered: AstrolabeDynamicRangeBranch[] = [];
    let completedSummary: AstrolabeDynamicRangeSummary | undefined;
    let nextRequest: DynamicRangeWorkerRequest = {
      type: 'start',
      input,
      source: fullSource,
      request: fullRequest,
    };
    for (let requestCount = 0; requestCount <= expectedSampleCount; requestCount++) {
      messages.length = 0;
      workerScope.onmessage!({ data: nextRequest } as MessageEvent<DynamicRangeWorkerRequest>);
      const responses = messages.filter((message) => message.type !== 'progress');
      assert.equal(responses.length, 1);
      const response = responses[0];
      if (response.type === 'branch') {
        assert.ok(requestCount < expectedSampleCount, '分段数不能超过逐秒样本数');
        delivered.push(response.branch);
        nextRequest = { type: 'next' };
      } else {
        assert.equal(response.type, 'complete');
        if (response.type === 'complete') completedSummary = response.summary;
        break;
      }
    }
    assert.ok(completedSummary, '全部分段交付后应收到完整汇总');
    assert.equal(completedSummary.coverage, 'natal+dynamic');
    assert.equal(completedSummary.scope, fullRequest.scope);
    assert.equal(completedSummary.referenceDate, fullRequest.referenceDate);
    assert.equal(completedSummary.source.startTimestamp, fullSource.startTimestamp);
    assert.equal(completedSummary.source.endTimestamp, fullSource.endTimestamp);
    assert.equal(completedSummary.resolutionSeconds, 1);
    assert.equal(completedSummary.sampleCount, expectedSampleCount);
    assert.equal(completedSummary.branchCount, delivered.length);

    let cursor = fullSource.startTimestamp;
    for (const item of delivered) {
      assert.equal(item.startTimestamp, cursor);
      assert.equal(item.endExclusive, true);
      assert.ok(item.endTimestamp > item.startTimestamp);
      assert.equal(item.sampleCount, (item.endTimestamp - item.startTimestamp) / 1000);
      assert.deepEqual(
        item.representative.scopes.map((scope) => scope.scope),
        ['natal', 'yearly', 'monthly', 'daily'],
      );
      assert.deepEqual(
        item.last.scopes.map((scope) => scope.scope),
        ['natal', 'yearly', 'monthly', 'daily'],
      );
      cursor = item.endTimestamp;
    }
    assert.equal(cursor, fullSource.endTimestamp);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'self', descriptor);
    else Reflect.deleteProperty(globalThis, 'self');
  }
});

async function withWorker(run: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  try {
    await run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
}

test('动态区间保存当前段完成后才拉取下一段，最终只返回汇总', async (context) => {
  await withWorker(async () => {
    let saved!: () => void;
    const saving = new Promise<void>((resolve) => {
      saved = resolve;
    });
    const received: AstrolabeDynamicRangeBranch[] = [];
    const controller = new AbortController();
    const replacement = new AbortController();
    const removedOriginal = context.mock.method(controller.signal, 'removeEventListener');
    const removedReplacement = context.mock.method(replacement.signal, 'removeEventListener');
    const progress: Array<[number, number]> = [];
    const replacementProgress: Array<[number, number]> = [];
    const options = {
      signal: controller.signal,
      onProgress: (completed: number, total: number) => progress.push([completed, total]),
    };
    const pending = executeAstrolabeDynamicRangeWorker(
      input,
      source,
      request,
      async (value) => {
        received.push(value);
        await saving;
      },
      options,
    );
    const worker = FakeWorker.current;
    assert.equal(worker.posted[0].type, 'start');
    worker.emit({ type: 'branch', branch });
    await Promise.resolve();
    assert.equal(worker.posted.length, 1);
    options.signal = replacement.signal;
    options.onProgress = (completed, total) => replacementProgress.push([completed, total]);
    saved();
    await saving;
    await Promise.resolve();
    assert.deepEqual(worker.posted[1], { type: 'next' });
    worker.emit({ type: 'progress', completed: 2, total: 2 });
    worker.emit({ type: 'complete', summary });
    assert.deepEqual(await pending, summary);
    assert.deepEqual(received, [branch]);
    assert.deepEqual(progress, [[2, 2]]);
    assert.deepEqual(replacementProgress, []);
    assert.equal(removedOriginal.mock.callCount(), 1);
    assert.equal(removedOriginal.mock.calls[0].arguments[0], 'abort');
    assert.equal(removedReplacement.mock.callCount(), 0);
    assert.equal(options.signal, replacement.signal);
    assert.equal(worker.terminated, true);
  });
});

test('动态区间保存过程中取消立即终止，保存结束不再拉取', async () => {
  await withWorker(async () => {
    const controller = new AbortController();
    const progress: Array<[number, number]> = [];
    const received: AstrolabeDynamicRangeBranch[] = [];
    let saved!: () => void;
    const saving = new Promise<void>((resolve) => {
      saved = resolve;
    });
    const pending = executeAstrolabeDynamicRangeWorker(
      input,
      source,
      request,
      (value) => {
        received.push(value);
        return saving;
      },
      {
        signal: controller.signal,
        onProgress: (completed, total) => progress.push([completed, total]),
      },
    );
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    const worker = FakeWorker.current;
    worker.emit({ type: 'branch', branch });
    controller.abort();
    await rejected;
    worker.emit({ type: 'progress', completed: 2, total: 2 });
    worker.emit({ type: 'branch', branch });
    worker.emit({ type: 'complete', summary });
    assert.deepEqual(received, [branch]);
    assert.deepEqual(progress, []);
    saved();
    await saving;
    await Promise.resolve();
    assert.equal(worker.terminated, true);
    assert.equal(worker.posted.length, 1);
    assert.deepEqual(received, [branch]);
    assert.deepEqual(progress, []);
  });
});

test('动态区间保存失败或进度回调失败保留错误并终止计算', async () => {
  await withWorker(async () => {
    for (const mode of ['branch', 'progress'] as const) {
      const error = new Error('公开合成保存错误');
      const pending = executeAstrolabeDynamicRangeWorker(
        input,
        source,
        request,
        () => {
          throw error;
        },
        {
          onProgress: () => {
            throw error;
          },
        },
      );
      const rejected = assert.rejects(pending, (value) => value === error);
      const worker = FakeWorker.current;
      worker.emit(
        mode === 'branch'
          ? { type: 'branch', branch }
          : { type: 'progress', completed: 1, total: 2 },
      );
      await rejected;
      assert.equal(worker.terminated, true);
      assert.equal(worker.posted.length, 1);
    }
  });
});
