import assert from 'node:assert/strict';
import test from 'node:test';

import { getDivinationTime } from 'mingyu-core/calendar';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  generateAstrolabeBirthRange,
  type AstrolabeBirthRange,
} from '../src/lib/astrolabe-birth-range';

const OFFSET_MINUTES = 480;
const SECOND = 1_000;

function beijingTimestamp(value: string) {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

function sourceFor(intervalStart: string, intervalEnd: string): BaziReverseSource {
  const startTimestamp = beijingTimestamp(intervalStart);
  const endTimestamp = beijingTimestamp(intervalEnd);
  return {
    pillars: getDivinationTime(new Date(startTimestamp), OFFSET_MINUTES).ganzhi,
    intervalStart,
    intervalEnd,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const startText = '1990-05-20 12:30:00';
const endText = '1990-05-20 12:30:02';
const source = sourceFor(startText, endText);

const lockedInput = {
  name: '公开合成星盘样本',
  gender: '女',
  year: 1990,
  month: 5,
  day: 20,
  hour: 12,
  minute: 30,
  second: 0,
  latitude: 31.2304,
  longitude: 121.4737,
  timezone: 8,
  locationName: '上海',
  useTrueSolarTime: false,
};

function createSubject(
  range: unknown = source,
  input: Record<string, unknown> = lockedInput,
): ReadingSubjectSnapshot {
  return {
    id: 'synthetic-astrolabe-birth-range',
    source: 'astrolabe',
    allowedMethods: ['astrolabe'],
    lockedInputs: { astrolabe: input },
    range: { birthTimeRanges: { primary: range } },
  };
}

type WorkerMessage = {
  id: string;
  input: AstrolabeBirthInput;
  source: BaziReverseSource;
};

type WorkerBehavior = (worker: ReadingFakeWorker, message: WorkerMessage) => void;

class ReadingFakeWorker {
  static behavior: WorkerBehavior = (worker, message) => {
    try {
      const result = generateAstrolabeBirthRange(message.input, message.source);
      queueMicrotask(() => worker.emit({ id: message.id, type: 'result', result }));
    } catch (error) {
      queueMicrotask(() =>
        worker.emit({
          id: message.id,
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  static instances: ReadingFakeWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postedMessage: WorkerMessage | undefined;
  terminated = false;

  constructor(..._args: unknown[]) {
    ReadingFakeWorker.instances.push(this);
  }

  postMessage(message: WorkerMessage) {
    this.postedMessage = message;
    ReadingFakeWorker.behavior(this, message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

async function withReadingFakeWorker<T>(
  callback: () => Promise<T>,
  behavior: WorkerBehavior = ReadingFakeWorker.behavior,
) {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  ReadingFakeWorker.instances = [];
  ReadingFakeWorker.behavior = behavior;
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: ReadingFakeWorker,
  });
  try {
    return await callback();
  } finally {
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
}

async function assertRejectedWithoutNetwork(operation: () => Promise<unknown>, expected: RegExp) {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('测试不允许访问网络。');
  }) as typeof fetch;
  try {
    await assert.rejects(operation, expected);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
}

function readAstrolabeBirthRange(resource: { structured?: Record<string, unknown> }) {
  const structured = resource.structured as
    (AstrolabeBirthRange & { birthTimeRange: BaziReverseSource }) | undefined;
  assert.ok(structured);
  assert.deepEqual(structured.birthTimeRange, source);
  assert.equal(structured.coverage, 'natal');
  assert.equal(structured.source.startTimestamp, source.startTimestamp);
  assert.equal(structured.source.endTimestamp, source.endTimestamp);
  assert.equal(structured.source.endExclusive, true);
  assert.equal(structured.source.timezone, 'Asia/Shanghai');
  assert.equal(structured.source.offsetHours, 8);
  assert.equal(structured.resolutionSeconds, 1);
  assert.equal(structured.sampleCount, (source.endTimestamp! - source.startTimestamp!) / SECOND);
  assert.ok(structured.branches.length > 0);
  let nextStart = source.startTimestamp!;
  for (const branch of structured.branches) {
    assert.equal(branch.startTimestamp, nextStart);
    assert.equal(branch.endExclusive, true);
    assert.equal(branch.sampleCount, (branch.endTimestamp - branch.startTimestamp) / SECOND);
    assert.ok(branch.representative);
    assert.ok(branch.last);
    assert.ok(Array.isArray(branch.continuous));
    nextStart = branch.endTimestamp;
  }
  assert.equal(nextStart, source.endTimestamp);
  return structured;
}

test('西占本命出生区间补算保留问题、全部分支和完整结构化机器范围', async () => {
  await withReadingFakeWorker(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'astrolabe',
        input: {
          astrolabeScope: 'natal',
          question: '请区分出生区间内共同成立与只适用于部分时段的本命事实。',
        },
      },
      undefined,
      createSubject(),
    );

    const range = readAstrolabeBirthRange(resource);
    const firstBirth = range.branches[0]?.representative.birth;
    assert.match(String(firstBirth?.standardDateTime ?? firstBirth?.dateTime), /1990-05-20 12:30/u);
    assert.match(resource.text, /【西洋占星本命出生时间区间】/u);
    assert.match(resource.text, /【问题】/u);
    assert.match(resource.text, /请区分出生区间内共同成立与只适用于部分时段的本命事实/u);

    assert.equal(ReadingFakeWorker.instances.length, 1);
    const posted = ReadingFakeWorker.instances[0]?.postedMessage;
    assert.equal(posted?.input.year, '1990');
    assert.equal(posted?.input.month, '5');
    assert.equal(posted?.input.day, '20');
    assert.equal(posted?.input.hour, '12');
    assert.equal(posted?.input.minute, '30');
    assert.equal(posted?.input.second, '0');
    assert.equal(posted?.input.timeZoneId, undefined);
    assert.equal(ReadingFakeWorker.instances[0]?.terminated, true);
  });
});

test('西占本命区间主体起点与来源不匹配时拒绝且不启动 Worker', async () => {
  const mismatchedSource = sourceFor('1990-05-20 12:30:01', '1990-05-20 12:30:03');
  await withReadingFakeWorker(async () => {
    await assert.rejects(
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'astrolabe',
          input: { astrolabeScope: 'natal' },
        },
        undefined,
        createSubject(mismatchedSource),
      ),
      /出生代表时间必须等于四柱候选区间起点/u,
    );
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});

test('西占本命区间返回范围与主体不匹配时拒绝结果', async () => {
  await withReadingFakeWorker(
    async () => {
      await assert.rejects(
        executeReadingAction(
          {
            kind: 'calculate',
            method: 'astrolabe',
            input: { astrolabeScope: 'natal' },
          },
          undefined,
          createSubject(),
        ),
        /补算身份核验失败：astrolabe\.birthRange\.endTimestamp/u,
      );
      assert.equal(ReadingFakeWorker.instances.length, 1);
      assert.equal(ReadingFakeWorker.instances[0]?.terminated, true);
    },
    (worker, message) => {
      const result = generateAstrolabeBirthRange(message.input, message.source);
      queueMicrotask(() =>
        worker.emit({
          id: message.id,
          type: 'result',
          result: {
            ...result,
            source: {
              ...result.source,
              endTimestamp: result.source.endTimestamp - SECOND,
            },
          },
        }),
      );
    },
  );
});

const multiBranchSource = sourceFor('2024-03-20 11:06:20', '2024-03-20 11:06:30');
const multiBranchLockedInput = {
  ...lockedInput,
  year: 2024,
  month: 3,
  day: 20,
  hour: 11,
  minute: 6,
  second: 20,
  latitude: 39.9042,
  longitude: 116.4074,
  locationName: '北京',
};

test('西占本命区间逐段核对第二段代表盘身份', async () => {
  await withReadingFakeWorker(
    async () => {
      await assert.rejects(
        executeReadingAction(
          {
            kind: 'calculate',
            method: 'astrolabe',
            input: { astrolabeScope: 'natal' },
          },
          undefined,
          createSubject(multiBranchSource, multiBranchLockedInput),
        ),
        /补算身份核验失败：astrolabe\.standardDateTime/u,
      );
      assert.equal(ReadingFakeWorker.instances.length, 1);
      assert.equal(ReadingFakeWorker.instances[0]?.terminated, true);
    },
    (worker, message) => {
      const result = generateAstrolabeBirthRange(message.input, message.source);
      const tamperedBranches = result.branches.map((branch, index) =>
        index === 1
          ? {
              ...branch,
              representative: {
                ...branch.representative,
                birth: {
                  ...branch.representative.birth,
                  standardDateTime: '2001-01-01 00:00:00',
                },
              },
            }
          : branch,
      );
      queueMicrotask(() =>
        worker.emit({
          id: message.id,
          type: 'result',
          result: { ...result, branches: tamperedBranches },
        }),
      );
    },
  );
});

test('西占本命区间逐段核对末段前一秒身份', async () => {
  await withReadingFakeWorker(
    async () => {
      await assert.rejects(
        executeReadingAction(
          {
            kind: 'calculate',
            method: 'astrolabe',
            input: { astrolabeScope: 'natal' },
          },
          undefined,
          createSubject(),
        ),
        /补算身份核验失败：astrolabe\.standardDateTime/u,
      );
      assert.equal(ReadingFakeWorker.instances.length, 1);
      assert.equal(ReadingFakeWorker.instances[0]?.terminated, true);
    },
    (worker, message) => {
      const result = generateAstrolabeBirthRange(message.input, message.source);
      const lastIndex = result.branches.length - 1;
      const tamperedBranches = result.branches.map((branch, index) =>
        index === lastIndex
          ? {
              ...branch,
              last: {
                ...branch.last,
                birth: {
                  ...branch.last.birth,
                  standardDateTime: '2001-01-01 00:00:00',
                },
              },
            }
          : branch,
      );
      queueMicrotask(() =>
        worker.emit({
          id: message.id,
          type: 'result',
          result: { ...result, branches: tamperedBranches },
        }),
      );
    },
  );
});
test('西占本命区间残缺机器来源明确拒绝且不访问网络或启动 Worker', async () => {
  const incompleteSources: unknown[] = [
    {
      ...source,
      endTimestamp: source.endTimestamp! - SECOND,
    },
    {},
    null,
    '损坏区间',
  ];
  await withReadingFakeWorker(async () => {
    for (const incompleteSource of incompleteSources) {
      await assertRejectedWithoutNetwork(
        () =>
          executeReadingAction(
            {
              kind: 'calculate',
              method: 'astrolabe',
              input: { astrolabeScope: 'natal' },
            },
            undefined,
            createSubject(incompleteSource),
          ),
        /西占星盘出生区间来源无效/u,
      );
    }
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});

test('西占动态出生区间及默认流年要求浏览器存储，不能回退到网络或本命计算', async () => {
  await withReadingFakeWorker(async () => {
    for (const input of [
      { astrolabeScope: 'yearly', astrolabeScopeDate: '2024' },
      { astrolabeScope: 'monthly', astrolabeScopeDate: '2024-03' },
      { astrolabeScope: 'daily', astrolabeScopeDate: '2024-03-20' },
      { astrolabeScope: 'full', astrolabeScopeDate: '2024-03-20' },
      {},
    ]) {
      await assertRejectedWithoutNetwork(
        () =>
          executeReadingAction(
            { kind: 'calculate', method: 'astrolabe', input },
            undefined,
            createSubject(),
          ),
        /需要浏览器本地存储/u,
      );
    }
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});

test('西占本命出生区间取消时终止 Worker 并返回取消错误', async () => {
  const controller = new AbortController();
  const pending = withReadingFakeWorker(
    () =>
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'astrolabe',
          input: { astrolabeScope: 'natal' },
        },
        controller.signal,
        createSubject(),
      ),
    () => controller.abort(),
  );

  await assert.rejects(pending, (error: unknown) => {
    return error instanceof DOMException && error.name === 'AbortError';
  });
  assert.equal(ReadingFakeWorker.instances.length, 1);
  assert.equal(ReadingFakeWorker.instances[0]?.terminated, true);
});

test('出生区间动态补算要求明确范围，自定义文字不会触发网络或 Worker', async () => {
  await withReadingFakeWorker(async () => {
    await assertRejectedWithoutNetwork(
      () =>
        executeReadingAction(
          {
            kind: 'calculate',
            method: 'astrolabe',
            input: { astrolabeScope: 'custom', astrolabeScopeText: '公开合成范围' },
          },
          undefined,
          createSubject(),
        ),
      /需选择明确的流年、流月、流日或全部范围/u,
    );
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});
