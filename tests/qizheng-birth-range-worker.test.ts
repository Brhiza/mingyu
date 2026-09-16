import assert from 'node:assert/strict';
import test from 'node:test';
import { getDivinationTime } from 'mingyu-core/calendar';
import type { QizhengBirthRange, QizhengInput } from 'mingyu-core/qizheng';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  executeQizhengBirthRangeWorker,
  generateQizhengDateRange,
  hasQizhengBirthRangeSource,
  hasQizhengFlowInput,
  isQizhengBirthRangeSource,
} from '../src/lib/qizheng-birth-range';

const CHINA_OFFSET_MINUTES = 480;

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

const SOURCE = sourceFor('2024-02-19 11:00:00', '2024-02-19 13:00:00');
const FLOW_SOURCE = sourceFor('2024-02-19 11:00:00', '2024-02-19 11:00:01');
const INPUT: QizhengInput = {
  year: 2024,
  month: 2,
  day: 19,
  hour: 11,
  minute: 0,
  second: 0,
  latitude: 39.9042,
  longitude: 116.4074,
  timezone: 8,
};

const FLOW_INPUT: QizhengInput = {
  ...INPUT,
  flowYear: 2024,
  flowMonth: 2,
  flowDay: 19,
  flowHour: 12,
  flowMinute: 0,
};

const FAKE_RESULT = {
  source: {
    startTimestamp: SOURCE.startTimestamp,
    endTimestamp: SOURCE.endTimestamp,
    endExclusive: true,
    offsetHours: 8,
  },
  resolutionSeconds: 1,
  sampleCount: 1,
  branches: [],
} as unknown as QizhengBirthRange;

type FakeWorkerMessage = {
  id: string;
  input: QizhengInput;
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

test('七政四余出生来源只接受完整北京时间机器区间并核对代表起点', async () => {
  assert.equal(isQizhengBirthRangeSource(SOURCE), true);
  assert.equal(hasQizhengBirthRangeSource(SOURCE), true);
  assert.equal(
    isQizhengBirthRangeSource({
      pillars: SOURCE.pillars,
      intervalStart: SOURCE.intervalStart,
      intervalEnd: SOURCE.intervalEnd,
    }),
    false,
  );
  assert.equal(
    hasQizhengBirthRangeSource({
      pillars: SOURCE.pillars,
      intervalStart: SOURCE.intervalStart,
      intervalEnd: SOURCE.intervalEnd,
    }),
    false,
  );
  assert.equal(hasQizhengBirthRangeSource({ ...SOURCE, endTimestamp: '非法机器值' }), true);

  await withFakeWorker(
    () => undefined,
    async () => {
      await assert.rejects(
        executeQizhengBirthRangeWorker(INPUT, {
          ...SOURCE,
          intervalEnd: '2024-02-19 12:59:59',
        }),
        /文本边界与机器时间戳不一致/u,
      );
      await assert.rejects(
        executeQizhengBirthRangeWorker({ ...INPUT, hour: 12 }, SOURCE),
        /代表时间必须等于四柱候选区间起点/u,
      );
      await assert.rejects(
        executeQizhengBirthRangeWorker({ ...INPUT, timeZoneId: 'Asia/Shanghai' }, SOURCE),
        /不接受 timeZoneId/u,
      );
      assert.equal(FakeWorker.instances.length, 0);
    },
  );
});

test('七政四余出生 Worker 按请求 ID隔离进度和结果并在成功后清理', async () => {
  const progress: Array<[number, number]> = [];
  const result = await withFakeWorker(
    (worker, message) => {
      worker.emit({ id: 'old-request', type: 'progress', completed: 99, total: 100 });
      worker.emit({ id: message.id, type: 'progress', completed: 1, total: 2 });
      worker.emit({ id: 'old-request', type: 'result', result: {} });
      worker.emit({ id: message.id, type: 'result', result: FAKE_RESULT });
    },
    () =>
      executeQizhengBirthRangeWorker(INPUT, SOURCE, undefined, (completed, total) => {
        progress.push([completed, total]);
      }),
  );

  assert.equal(result, FAKE_RESULT);
  assert.deepEqual(progress, [[1, 2]]);
  assert.equal(
    FakeWorker.instances[0]?.postedMessage?.source.startTimestamp,
    SOURCE.startTimestamp,
  );
  assert.equal(FakeWorker.instances[0]?.terminated, true);
});

test('七政四余出生 Worker 保留完整流曜输入并按流曜路由标记', async () => {
  assert.equal(hasQizhengFlowInput(INPUT), false);
  assert.equal(hasQizhengFlowInput(FLOW_INPUT), true);
  const result = await withFakeWorker(
    (worker, message) => {
      worker.emit({ id: message.id, type: 'progress', completed: 1, total: 2 });
      worker.emit({ id: message.id, type: 'result', result: FAKE_RESULT });
    },
    () => executeQizhengBirthRangeWorker(FLOW_INPUT, SOURCE),
  );

  assert.equal(result, FAKE_RESULT);
  assert.deepEqual(FakeWorker.instances[0]?.postedMessage?.input, FLOW_INPUT);
});

test('七政四余无 Worker 入口按流曜字段实际生成流日范围', () => {
  const result = generateQizhengDateRange(FLOW_INPUT, FLOW_SOURCE);
  assert.equal(result.coverage, 'flow');
  if (result.coverage !== 'flow') return;
  assert.equal(result.target.mode, 'daily');
  assert.equal(result.target.year, FLOW_INPUT.flowYear);
  assert.equal(result.target.month, FLOW_INPUT.flowMonth);
  assert.equal(result.target.day, FLOW_INPUT.flowDay);
  assert.ok(result.branches[0]?.representative.flowingStars);
  assert.throws(
    () => generateQizhengDateRange({ ...FLOW_INPUT, flowYear: undefined }, FLOW_SOURCE),
    /必须明确 flowYear/u,
  );
});

test('七政四余出生 Worker 取消后终止并忽略迟到消息', async () => {
  let worker: FakeWorker | undefined;
  const controller = new AbortController();
  const pending = withFakeWorker(
    (current) => {
      worker = current;
    },
    () => executeQizhengBirthRangeWorker(INPUT, SOURCE, controller.signal),
  );

  await new Promise<void>((resolve) => queueMicrotask(resolve));
  controller.abort();
  await assert.rejects(pending, (error: unknown) => {
    return error instanceof DOMException && error.name === 'AbortError';
  });
  assert.equal(worker?.terminated, true);
  worker?.emit({ id: worker.postedMessage?.id, type: 'result', result: FAKE_RESULT });
});

test('七政四余出生 Worker 错误消息按请求 ID处理并清理', async () => {
  await withFakeWorker(
    (worker, message) => {
      worker.emit({ id: 'old-request', type: 'error', error: '旧错误' });
      worker.emit({ id: message.id, type: 'error', error: '当前计算失败' });
    },
    async () => {
      await assert.rejects(executeQizhengBirthRangeWorker(INPUT, SOURCE), /当前计算失败/u);
      assert.equal(FakeWorker.instances[0]?.terminated, true);
    },
  );
});
