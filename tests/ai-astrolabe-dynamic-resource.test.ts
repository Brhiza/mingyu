import assert from 'node:assert/strict';
import test from 'node:test';
import { getDivinationTime } from 'mingyu-core/calendar';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  prepareAstrolabeDynamicResource,
  type AstrolabeDynamicResourceDependencies,
} from '../src/lib/ai/astrolabe-dynamic-resource';
import type { AstrolabeDynamicRangeStore } from '../src/lib/astrolabe-dynamic-range-store';

const start = Date.parse('2024-03-20T11:00:00+08:00');
const input: AstrolabeBirthInput = {
  name: '动态补算合成样本',
  gender: '男',
  year: '2024',
  month: '3',
  day: '20',
  hour: '11',
  minute: '0',
  second: '0',
  latitude: '39.9042',
  longitude: '116.416334',
  timezone: '8',
};
const source: BaziReverseSource = {
  pillars: getDivinationTime(new Date(start), 480).ganzhi,
  intervalStart: '2024-03-20 11:00:00',
  intervalEnd: '2024-03-20 11:00:04',
  startTimestamp: start,
  endTimestamp: start + 4_000,
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};
const request = { scope: 'daily' as const, referenceDate: '2028-03-20' };

function makeBranch(startTimestamp: number, endTimestamp: number) {
  return {
    startTimestamp,
    endTimestamp,
    endExclusive: true as const,
    sampleCount: (endTimestamp - startTimestamp) / 1000,
    representative: {} as AstrolabeDynamicRangeBranch['representative'],
    last: {} as AstrolabeDynamicRangeBranch['last'],
    continuous: [],
  } satisfies AstrolabeDynamicRangeBranch;
}

const branches = [makeBranch(start, start + 2_000), makeBranch(start + 2_000, start + 4_000)];

function makeSummary(branchCount = branches.length, sampleCount = 4): AstrolabeDynamicRangeSummary {
  return {
    coverage: 'natal+dynamic',
    scope: request.scope,
    referenceDate: request.referenceDate,
    status: branchCount === 1 ? 'stable' : 'conditional',
    source: {
      startTimestamp: source.startTimestamp!,
      endTimestamp: source.endTimestamp!,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
    resolutionSeconds: 1,
    sampleCount,
    branchCount,
  };
}

type WorkerExecutor = NonNullable<AstrolabeDynamicResourceDependencies['executeWorker']>;

function createFakeStore() {
  const values = new Map<number, AstrolabeDynamicRangeBranch>();
  let disposeCount = 0;
  const store: AstrolabeDynamicRangeStore = {
    async put(index, branch) {
      values.set(index, branch);
      return {
        index,
        startTimestamp: branch.startTimestamp,
        endTimestamp: branch.endTimestamp,
        sampleCount: branch.sampleCount,
        compressedBytes: 1,
      };
    },
    async read(index) {
      const branch = values.get(index);
      if (!branch) throw new Error('测试分段不存在。');
      return branch;
    },
    async dispose() {
      disposeCount += 1;
      values.clear();
    },
  };
  return {
    store,
    get disposeCount() {
      return disposeCount;
    },
  };
}

function dependenciesFor(executeWorker: WorkerExecutor) {
  const fakeStore = createFakeStore();
  return {
    fakeStore,
    dependencies: {
      createStore: async () => fakeStore.store,
      executeWorker,
    } satisfies AstrolabeDynamicResourceDependencies,
  };
}

test('逐段保存并返回只读分段，dispose 幂等且不聚合整批结果', async () => {
  const progress: Array<[number, number]> = [];
  let receivedInput: AstrolabeBirthInput | undefined;
  let receivedSource: BaziReverseSource | undefined;
  const executeWorker: WorkerExecutor = async (
    workerInput,
    workerSource,
    workerRequest,
    onBranch,
    options,
  ) => {
    receivedInput = workerInput;
    receivedSource = workerSource;
    assert.deepEqual(workerRequest, request);
    options.onProgress?.(4, 4);
    for (const branch of branches) await onBranch(branch);
    return makeSummary();
  };
  const { fakeStore, dependencies } = dependenciesFor(executeWorker);

  const prepared = await prepareAstrolabeDynamicResource(
    input,
    source,
    request,
    { onProgress: (completed, total) => progress.push([completed, total]) },
    dependencies,
  );

  assert.deepEqual(receivedInput, input);
  assert.deepEqual(receivedSource, source);
  assert.deepEqual(progress, [[4, 4]]);
  assert.equal(prepared.summary.branchCount, 2);
  assert.deepEqual(await prepared.readBranch(0), branches[0]);
  assert.deepEqual(await prepared.readBranch(1), branches[1]);
  await prepared.dispose();
  await prepared.dispose();
  assert.equal(fakeStore.disposeCount, 1);
  await assert.rejects(prepared.readBranch(0), /已关闭/u);
});

test('按流年和流月请求透传核心允许的短参考日期', async () => {
  for (const shortRequest of [
    { scope: 'yearly', referenceDate: '2028' },
    { scope: 'monthly', referenceDate: '2028-03' },
  ] as const) {
    const executeWorker: WorkerExecutor = async (_input, _source, workerRequest, onBranch) => {
      for (const branch of branches) await onBranch(branch);
      return {
        ...makeSummary(2, 4),
        scope: workerRequest.scope,
        referenceDate: workerRequest.referenceDate,
      };
    };
    const { fakeStore, dependencies } = dependenciesFor(executeWorker);
    const prepared = await prepareAstrolabeDynamicResource(
      input,
      source,
      shortRequest,
      {},
      dependencies,
    );
    assert.equal(prepared.summary.scope, shortRequest.scope);
    assert.equal(prepared.summary.referenceDate, shortRequest.referenceDate);
    await prepared.dispose();
    assert.equal(fakeStore.disposeCount, 1);
  }
});

test('读取分段期间关闭资源后不返回已结束资料', async () => {
  const delayedStore = createFakeStore();
  const originalRead = delayedStore.store.read.bind(delayedStore.store);
  let releaseRead!: () => void;
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  delayedStore.store.read = async (index) => {
    const branch = await originalRead(index);
    await readGate;
    return branch;
  };
  const executeWorker: WorkerExecutor = async (_input, _source, _request, onBranch) => {
    for (const branch of branches) await onBranch(branch);
    return makeSummary();
  };
  const prepared = await prepareAstrolabeDynamicResource(
    input,
    source,
    request,
    {},
    { createStore: async () => delayedStore.store, executeWorker },
  );
  const pendingRead = prepared.readBranch(0);
  await Promise.resolve();
  await prepared.dispose();
  releaseRead();
  await assert.rejects(pendingRead, /已关闭/u);
  assert.equal(delayedStore.disposeCount, 1);
});

test('分段缺口或汇总数量不一致时拒绝结果并清理临时库', async () => {
  const fakeStore = createFakeStore();
  const executeWorker: WorkerExecutor = async (_input, _source, _request, onBranch) => {
    await onBranch(branches[0]);
    return makeSummary(2, 4);
  };
  await assert.rejects(
    prepareAstrolabeDynamicResource(
      input,
      source,
      request,
      {},
      {
        createStore: async () => fakeStore.store,
        executeWorker,
      },
    ),
    /缺少末段/u,
  );
  assert.equal(fakeStore.disposeCount, 1);

  const invalidSummaryStore = createFakeStore();
  const invalidSummaryWorker: WorkerExecutor = async (_input, _source, _request, onBranch) => {
    for (const branch of branches) await onBranch(branch);
    return makeSummary(1, 4);
  };
  await assert.rejects(
    prepareAstrolabeDynamicResource(
      input,
      source,
      request,
      {},
      {
        createStore: async () => invalidSummaryStore.store,
        executeWorker: invalidSummaryWorker,
      },
    ),
    /范围数量不完整/u,
  );
  assert.equal(invalidSummaryStore.disposeCount, 1);
});

test('Worker 失败或取消都会清理已创建的临时库', async () => {
  const failedStore = createFakeStore();
  const failedWorker: WorkerExecutor = async () => {
    throw new Error('测试 Worker 失败。');
  };
  await assert.rejects(
    prepareAstrolabeDynamicResource(
      input,
      source,
      request,
      {},
      {
        createStore: async () => failedStore.store,
        executeWorker: failedWorker,
      },
    ),
    /测试 Worker 失败/u,
  );
  assert.equal(failedStore.disposeCount, 1);

  const controller = new AbortController();
  const cancelledStore = createFakeStore();
  const cancelledWorker: WorkerExecutor = async (_input, _source, _request, _onBranch, options) => {
    controller.abort();
    options.signal?.throwIfAborted();
    return makeSummary();
  };
  await assert.rejects(
    prepareAstrolabeDynamicResource(
      input,
      source,
      request,
      { signal: controller.signal },
      { createStore: async () => cancelledStore.store, executeWorker: cancelledWorker },
    ),
    { name: 'AbortError' },
  );
  assert.equal(cancelledStore.disposeCount, 1);

  const creationController = new AbortController();
  const creationCancelledStore = createFakeStore();
  let workerCalled = false;
  const creationCancelledWorker: WorkerExecutor = async () => {
    workerCalled = true;
    return makeSummary();
  };
  await assert.rejects(
    prepareAstrolabeDynamicResource(
      input,
      source,
      request,
      { signal: creationController.signal },
      {
        createStore: async () => {
          creationController.abort();
          return creationCancelledStore.store;
        },
        executeWorker: creationCancelledWorker,
      },
    ),
    { name: 'AbortError' },
  );
  assert.equal(workerCalled, false);
  assert.equal(creationCancelledStore.disposeCount, 1);
});

test('默认路径缺少浏览器 Worker 时显式失败，不走整批 Node fallback', async () => {
  if (typeof Worker !== 'undefined') return;
  await assert.rejects(prepareAstrolabeDynamicResource(input, source, request), /浏览器 Worker/u);
});
