import assert from 'node:assert/strict';
import test from 'node:test';

import { getDivinationTime } from 'mingyu-core/calendar';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  executeAstrolabeBirthRangeWorker,
  generateAstrolabeBirthRange,
  hasAstrolabeBirthRangeSource,
  isAstrolabeBirthRangeSource,
  type AstrolabeBirthRange,
} from '../src/lib/astrolabe-birth-range';

const CHINA_OFFSET_MINUTES = 480;
const SECOND = 1_000;

function beijingTimestamp(text: string) {
  return Date.parse(`${text.replace(' ', 'T')}+08:00`);
}

function sourceFor(startText: string, endText: string): BaziReverseSource {
  const startTimestamp = beijingTimestamp(startText);
  const endTimestamp = beijingTimestamp(endText);
  return {
    pillars: getDivinationTime(new Date(startTimestamp), CHINA_OFFSET_MINUTES).ganzhi,
    intervalStart: startText,
    intervalEnd: endText,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const SOURCE = sourceFor('1990-05-20 12:30:00', '1990-05-20 12:30:02');
const INPUT: AstrolabeBirthInput = {
  name: '公开合成星盘样本',
  gender: '女',
  year: '1990',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  second: '0',
  latitude: '31.2304',
  longitude: '121.4737',
  timezone: '8',
  locationName: '上海',
};

const FAKE_RESULT = {
  coverage: 'natal',
  status: 'stable',
  source: {
    startTimestamp: SOURCE.startTimestamp,
    endTimestamp: SOURCE.endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  },
  resolutionSeconds: 1,
  sampleCount: 2,
  branches: [],
} as unknown as AstrolabeBirthRange;

type FakeWorkerMessage = {
  id: string;
  input: AstrolabeBirthInput;
  source: BaziReverseSource;
};

type FakeWorkerBehavior = (worker: FakeWorker, message: FakeWorkerMessage) => void;

class FakeWorker {
  static behavior: FakeWorkerBehavior = () => undefined;
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  postedMessage: FakeWorkerMessage | undefined;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: FakeWorkerMessage) {
    this.postedMessage = message;
    FakeWorker.behavior(this, message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

async function withFakeWorker<T>(behavior: FakeWorkerBehavior, callback: () => Promise<T>) {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  FakeWorker.instances = [];
  FakeWorker.behavior = behavior;
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: FakeWorker,
  });
  try {
    return await callback();
  } finally {
    if (originalWorker) {
      Object.defineProperty(globalThis, 'Worker', originalWorker);
    } else {
      Reflect.deleteProperty(globalThis, 'Worker');
    }
  }
}

test('西占本命区间来源核对机器边界、代表起点和半新字段', async () => {
  assert.equal(isAstrolabeBirthRangeSource(SOURCE), true);
  assert.equal(hasAstrolabeBirthRangeSource(SOURCE), true);
  assert.equal(
    isAstrolabeBirthRangeSource({
      pillars: SOURCE.pillars,
      intervalStart: SOURCE.intervalStart,
      intervalEnd: SOURCE.intervalEnd,
    }),
    false,
  );
  assert.equal(
    hasAstrolabeBirthRangeSource({
      pillars: SOURCE.pillars,
      intervalStart: SOURCE.intervalStart,
      intervalEnd: SOURCE.intervalEnd,
    }),
    false,
  );
  assert.equal(hasAstrolabeBirthRangeSource({ ...SOURCE, endTimestamp: '非法机器值' }), true);

  assert.throws(
    () =>
      generateAstrolabeBirthRange(INPUT, {
        ...SOURCE,
        intervalEnd: '1990-05-20 12:30:01',
      }),
    /文本边界与机器时间戳不一致/u,
  );
  assert.throws(
    () => generateAstrolabeBirthRange({ ...INPUT, minute: '31' }, SOURCE),
    /代表时间必须等于四柱候选区间起点/u,
  );
  assert.throws(
    () => generateAstrolabeBirthRange({ ...INPUT, timeZoneId: 'Asia/Shanghai' }, SOURCE),
    /不接受 timeZoneId/u,
  );
  assert.throws(
    () =>
      generateAstrolabeBirthRange(INPUT, {
        ...SOURCE,
        endTimestamp: SOURCE.startTimestamp + 2 * 60 * 60 * SECOND + SECOND,
        intervalEnd: '1990-05-20 14:30:01',
      }),
    /超过两小时/u,
  );

  await withFakeWorker(
    () => undefined,
    async () => {
      await assert.rejects(
        executeAstrolabeBirthRangeWorker(INPUT, {
          ...SOURCE,
          intervalEnd: '1990-05-20 12:30:01',
        }),
        /文本边界与机器时间戳不一致/u,
      );
      assert.equal(FakeWorker.instances.length, 0);
    },
  );
});

test('西占本命区间 Worker 按请求 ID隔离进度和结果并清理', async () => {
  const progress: Array<[number, number]> = [];
  const result = await withFakeWorker(
    (worker, message) => {
      worker.emit({ id: 'old-request', type: 'progress', completed: 99, total: 100 });
      worker.emit({ id: message.id, type: 'progress', completed: 1, total: 2 });
      worker.emit({ id: 'old-request', type: 'result', result: {} });
      worker.emit({ id: message.id, type: 'result', result: FAKE_RESULT });
    },
    () =>
      executeAstrolabeBirthRangeWorker(INPUT, SOURCE, undefined, (completed, total) => {
        progress.push([completed, total]);
      }),
  );

  assert.equal(result, FAKE_RESULT);
  assert.deepEqual(progress, [[1, 2]]);
  assert.deepEqual(FakeWorker.instances[0]?.postedMessage?.input, INPUT);
  assert.equal(
    FakeWorker.instances[0]?.postedMessage?.source.startTimestamp,
    SOURCE.startTimestamp,
  );
  assert.equal(FakeWorker.instances[0]?.terminated, true);
});

test('西占本命区间 Worker 最后进度回调取消后忽略迟到消息且不影响后续请求', async () => {
  let cancelledWorker: FakeWorker | undefined;
  const controller = new AbortController();
  await withFakeWorker(
    (worker, message) => {
      cancelledWorker = worker;
      worker.emit({ id: message.id, type: 'progress', completed: 1, total: 2 });
      worker.emit({ id: message.id, type: 'progress', completed: 2, total: 2 });
      worker.emit({ id: message.id, type: 'progress', completed: 2, total: 2 });
      worker.emit({ id: message.id, type: 'result', result: FAKE_RESULT });
    },
    async () => {
      const cancelledProgress: Array<[number, number]> = [];
      await assert.rejects(
        executeAstrolabeBirthRangeWorker(INPUT, SOURCE, controller.signal, (completed, total) => {
          cancelledProgress.push([completed, total]);
          if (completed === total) controller.abort();
        }),
        (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
      );
      assert.deepEqual(cancelledProgress, [
        [1, 2],
        [2, 2],
      ]);
      assert.equal(cancelledWorker?.terminated, true);

      const nextProgress: Array<[number, number]> = [];
      FakeWorker.behavior = (worker, message) => {
        worker.emit({ id: message.id, type: 'progress', completed: 1, total: 2 });
        worker.emit({ id: message.id, type: 'result', result: FAKE_RESULT });
      };
      const nextResult = await executeAstrolabeBirthRangeWorker(
        INPUT,
        SOURCE,
        undefined,
        (completed, total) => nextProgress.push([completed, total]),
      );
      assert.equal(nextResult, FAKE_RESULT);
      assert.deepEqual(nextProgress, [[1, 2]]);

      cancelledWorker?.emit({
        id: cancelledWorker.postedMessage?.id,
        type: 'progress',
        completed: 2,
        total: 2,
      });
      cancelledWorker?.emit({
        id: cancelledWorker.postedMessage?.id,
        type: 'result',
        result: FAKE_RESULT,
      });
      assert.deepEqual(cancelledProgress, [
        [1, 2],
        [2, 2],
      ]);
      assert.deepEqual(nextProgress, [[1, 2]]);
      assert.equal(FakeWorker.instances.length, 2);
    },
  );
});

test('西占本命区间 Worker 传递当前错误并清理', async () => {
  await withFakeWorker(
    (worker, message) => {
      worker.emit({ id: 'old-request', type: 'error', error: '旧错误' });
      worker.emit({ id: message.id, type: 'error', error: '当前计算失败' });
    },
    async () => {
      await assert.rejects(executeAstrolabeBirthRangeWorker(INPUT, SOURCE), /当前计算失败/u);
      assert.equal(FakeWorker.instances[0]?.terminated, true);
    },
  );
});
