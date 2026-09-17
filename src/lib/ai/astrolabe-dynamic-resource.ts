import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeRequest,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import type { BaziReverseSource } from '../bazi-reverse-input';
import { validateAstrolabeBirthRangeInput } from '../astrolabe-birth-range';
import { executeAstrolabeDynamicRangeWorker } from '../astrolabe-dynamic-range';
import {
  createAstrolabeDynamicRangeStore,
  type AstrolabeDynamicBranchIndex,
  type AstrolabeDynamicRangeStore,
} from '../astrolabe-dynamic-range-store';

const DYNAMIC_SCOPES = ['yearly', 'monthly', 'daily', 'full'] as const;
type DynamicScope = (typeof DYNAMIC_SCOPES)[number];

export type AstrolabeDynamicResourceOptions = {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
};

export type AstrolabeDynamicResourceDependencies = {
  createStore?: () => Promise<AstrolabeDynamicRangeStore>;
  executeWorker?: typeof executeAstrolabeDynamicRangeWorker;
};

export type PreparedAstrolabeDynamicResource = {
  summary: AstrolabeDynamicRangeSummary;
  readBranch: (index: number) => Promise<AstrolabeDynamicRangeBranch>;
  dispose: () => Promise<void>;
};

function abortError() {
  return new DOMException('已停止西占动态区间补算。', 'AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  throw abortError();
}

function assertBrowserRuntime(requirements: { worker: boolean; store: boolean }) {
  if (requirements.worker && typeof Worker === 'undefined') {
    throw new Error('西占动态出生区间补算需要浏览器 Worker。');
  }
  if (requirements.store && typeof indexedDB === 'undefined') {
    throw new Error('西占动态出生区间补算需要浏览器本地存储。');
  }
  if (
    requirements.store &&
    (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined')
  ) {
    throw new Error('西占动态出生区间补算需要浏览器压缩流。');
  }
  if (requirements.store && typeof window === 'undefined') {
    throw new Error('西占动态出生区间补算需要浏览器页面生命周期。');
  }
}

function assertRequest(request: AstrolabeDynamicRangeRequest): asserts request is {
  scope: DynamicScope;
  referenceDate: string;
} {
  if (!request || !DYNAMIC_SCOPES.includes(request.scope as DynamicScope)) {
    throw new Error('动态出生区间必须指定流年、流月、流日或完整范围。');
  }
  if (typeof request.referenceDate !== 'string' || !request.referenceDate.trim()) {
    throw new Error('动态出生区间必须提供参考日期。');
  }
}

function expectedSampleCount(source: { startTimestamp: number; endTimestamp: number }) {
  const milliseconds = source.endTimestamp - source.startTimestamp;
  const samples = milliseconds / 1000;
  if (!Number.isSafeInteger(samples) || samples <= 0) {
    throw new Error('动态出生区间的整秒样本数无效。');
  }
  return samples;
}

function assertBranchShape(
  branch: AstrolabeDynamicRangeBranch,
  index: number,
  expectedStart: number,
  options: { maxEnd?: number; exactEnd?: number } = {},
) {
  if (!branch || typeof branch !== 'object') {
    throw new Error(`动态出生区间第${index + 1}段为空。`);
  }
  if (
    !Number.isSafeInteger(branch.startTimestamp) ||
    branch.startTimestamp % 1000 !== 0 ||
    !Number.isSafeInteger(branch.endTimestamp) ||
    branch.endTimestamp % 1000 !== 0 ||
    branch.endTimestamp <= branch.startTimestamp ||
    branch.endExclusive !== true
  ) {
    throw new Error(`动态出生区间第${index + 1}段的时间边界无效。`);
  }
  if (branch.startTimestamp !== expectedStart) {
    throw new Error(`动态出生区间第${index + 1}段不连续。`);
  }
  if (options.maxEnd !== undefined && branch.endTimestamp > options.maxEnd) {
    throw new Error(`动态出生区间第${index + 1}段超出锁定范围。`);
  }
  if (options.exactEnd !== undefined && branch.endTimestamp !== options.exactEnd) {
    throw new Error(`动态出生区间第${index + 1}段读取结果与索引不一致。`);
  }
  const samples = (branch.endTimestamp - branch.startTimestamp) / 1000;
  if (!Number.isSafeInteger(branch.sampleCount) || branch.sampleCount !== samples) {
    throw new Error(`动态出生区间第${index + 1}段样本数不完整。`);
  }
}

function assertStoredIndex(
  entry: AstrolabeDynamicBranchIndex,
  branch: AstrolabeDynamicRangeBranch,
  index: number,
) {
  if (
    entry.index !== index ||
    entry.startTimestamp !== branch.startTimestamp ||
    entry.endTimestamp !== branch.endTimestamp ||
    entry.sampleCount !== branch.sampleCount
  ) {
    throw new Error(`动态出生区间第${index + 1}段保存索引不一致。`);
  }
}

function assertSummary(
  summary: AstrolabeDynamicRangeSummary,
  source: ReturnType<typeof validateAstrolabeBirthRangeInput>,
  request: { scope: DynamicScope; referenceDate: string },
  entries: readonly AstrolabeDynamicBranchIndex[],
) {
  if (
    !summary ||
    typeof summary !== 'object' ||
    summary.coverage !== 'natal+dynamic' ||
    !summary.source ||
    typeof summary.source !== 'object'
  ) {
    throw new Error('动态出生区间补算未返回完整汇总。');
  }
  if (
    summary.scope !== request.scope ||
    summary.referenceDate !== request.referenceDate ||
    summary.resolutionSeconds !== 1
  ) {
    throw new Error('动态出生区间补算汇总与请求不一致。');
  }
  if (
    summary.source.startTimestamp !== source.startTimestamp ||
    summary.source.endTimestamp !== source.endTimestamp ||
    summary.source.endExclusive !== source.endExclusive ||
    summary.source.timezone !== source.timezone ||
    summary.source.offsetHours !== source.offsetHours
  ) {
    throw new Error('动态出生区间补算汇总与锁定范围不一致。');
  }
  const total = expectedSampleCount(source);
  if (
    !Number.isSafeInteger(summary.sampleCount) ||
    summary.sampleCount !== total ||
    !Number.isSafeInteger(summary.branchCount) ||
    summary.branchCount <= 0 ||
    summary.branchCount !== entries.length
  ) {
    throw new Error('动态出生区间补算汇总的范围数量不完整。');
  }
  const expectedStatus = entries.length === 1 ? 'stable' : 'conditional';
  if (summary.status !== expectedStatus) {
    throw new Error('动态出生区间补算汇总状态无效。');
  }
  const storedSamples = entries.reduce((sum, entry) => sum + entry.sampleCount, 0);
  if (storedSamples !== total) throw new Error('动态出生区间补算分段样本数不完整。');
}

function cloneInput(input: AstrolabeBirthInput): AstrolabeBirthInput {
  return { ...input };
}

function cloneSource(source: ReturnType<typeof validateAstrolabeBirthRangeInput>) {
  return { ...source, pillars: { ...source.pillars } };
}

export async function prepareAstrolabeDynamicResource(
  input: AstrolabeBirthInput,
  source: BaziReverseSource,
  request: AstrolabeDynamicRangeRequest,
  options: AstrolabeDynamicResourceOptions = {},
  dependencies: AstrolabeDynamicResourceDependencies = {},
): Promise<PreparedAstrolabeDynamicResource> {
  const validSource = validateAstrolabeBirthRangeInput(input, source);
  assertRequest(request);
  throwIfAborted(options.signal);

  assertBrowserRuntime({
    worker: !dependencies.executeWorker,
    store: !dependencies.createStore,
  });

  const lockedInput = cloneInput(input);
  const lockedSource = cloneSource(validSource);
  const lockedRequest = { scope: request.scope, referenceDate: request.referenceDate };
  const createStore = dependencies.createStore ?? createAstrolabeDynamicRangeStore;
  const executeWorker = dependencies.executeWorker ?? executeAstrolabeDynamicRangeWorker;
  const store = await createStore();
  let disposed = false;
  let disposePromise: Promise<void> | undefined;
  const dispose = () => {
    if (!disposePromise) {
      disposed = true;
      disposePromise = Promise.resolve().then(() => store.dispose());
    }
    return disposePromise;
  };
  const assertOpen = () => {
    if (disposed) throw new Error('动态出生区间补算资料已关闭。');
  };

  const entries: AstrolabeDynamicBranchIndex[] = [];
  let nextStart = lockedSource.startTimestamp;
  try {
    throwIfAborted(options.signal);
    const summary = await executeWorker(
      lockedInput,
      lockedSource,
      lockedRequest,
      async (branch) => {
        assertOpen();
        throwIfAborted(options.signal);
        assertBranchShape(branch, entries.length, nextStart, {
          maxEnd: lockedSource.endTimestamp,
        });
        const entry = await store.put(entries.length, branch);
        throwIfAborted(options.signal);
        assertStoredIndex(entry, branch, entries.length);
        entries.push(entry);
        nextStart = branch.endTimestamp;
      },
      {
        signal: options.signal,
        onProgress(completed, total) {
          throwIfAborted(options.signal);
          options.onProgress?.(completed, total);
        },
      },
    );
    throwIfAborted(options.signal);
    if (nextStart !== lockedSource.endTimestamp) {
      throw new Error('动态出生区间补算缺少末段。');
    }
    assertSummary(summary, lockedSource, lockedRequest, entries);
    const readBranch = async (index: number) => {
      assertOpen();
      if (!Number.isSafeInteger(index) || index < 0 || index >= entries.length) {
        throw new Error('动态出生区间分段索引无效。');
      }
      const entry = entries[index]!;
      const branch = await store.read(index);
      assertOpen();
      assertBranchShape(branch, index, entry.startTimestamp, { exactEnd: entry.endTimestamp });
      if (branch.sampleCount !== entry.sampleCount) {
        throw new Error(`动态出生区间第${index + 1}段读取样本数不一致。`);
      }
      return branch;
    };
    return { summary, readBranch, dispose };
  } catch (error) {
    try {
      await dispose();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        '动态出生区间补算失败，且临时资料清理失败。',
        { cause: cleanupError },
      );
    }
    throw error;
  }
}
