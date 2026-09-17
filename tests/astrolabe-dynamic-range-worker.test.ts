import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAstrolabeDynamicRange } from 'mingyu-core/divination/astrolabe-dynamic-range';
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

test('实际动态 Worker 按请求交付全部分段，结果与独立核心计算一致', async (context) => {
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
    const expected = generateAstrolabeDynamicRange(input, fullSource, fullRequest);
    const delivered: AstrolabeDynamicRangeBranch[] = [];
    let nextRequest: DynamicRangeWorkerRequest = {
      type: 'start',
      input,
      source: fullSource,
      request: fullRequest,
    };
    for (let index = 0; index <= expected.branchCount; index++) {
      messages.length = 0;
      workerScope.onmessage!({ data: nextRequest } as MessageEvent<DynamicRangeWorkerRequest>);
      const responses = messages.filter((message) => message.type !== 'progress');
      assert.equal(responses.length, 1);
      const response = responses[0];
      if (index < expected.branchCount) {
        assert.equal(response.type, 'branch');
        if (response.type === 'branch') delivered.push(response.branch);
        nextRequest = { type: 'next' };
      } else {
        assert.equal(response.type, 'complete');
        if (response.type === 'complete')
          assert.deepEqual({ ...response.summary, branches: delivered }, expected);
      }
    }
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

test('动态区间保存当前段完成后才拉取下一段，最终只返回汇总', async () => {
  await withWorker(async () => {
    let saved!: () => void;
    const saving = new Promise<void>((resolve) => {
      saved = resolve;
    });
    const received: AstrolabeDynamicRangeBranch[] = [];
    const pending = executeAstrolabeDynamicRangeWorker(input, source, request, async (value) => {
      received.push(value);
      await saving;
    });
    const worker = FakeWorker.current;
    assert.equal(worker.posted[0].type, 'start');
    worker.emit({ type: 'branch', branch });
    await Promise.resolve();
    assert.equal(worker.posted.length, 1);
    saved();
    await saving;
    await Promise.resolve();
    assert.deepEqual(worker.posted[1], { type: 'next' });
    worker.emit({ type: 'complete', summary });
    assert.deepEqual(await pending, summary);
    assert.deepEqual(received, [branch]);
    assert.equal(worker.terminated, true);
  });
});

test('动态区间保存过程中取消立即终止，保存结束不再拉取', async () => {
  await withWorker(async () => {
    const controller = new AbortController();
    let saved!: () => void;
    const saving = new Promise<void>((resolve) => {
      saved = resolve;
    });
    const pending = executeAstrolabeDynamicRangeWorker(input, source, request, () => saving, {
      signal: controller.signal,
    });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    const worker = FakeWorker.current;
    worker.emit({ type: 'branch', branch });
    controller.abort();
    await rejected;
    saved();
    await saving;
    await Promise.resolve();
    assert.equal(worker.terminated, true);
    assert.equal(worker.posted.length, 1);
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
