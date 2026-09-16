import assert from 'node:assert/strict';
import test from 'node:test';

import { getDivinationTime } from 'mingyu-core/calendar';
import {
  generateQizhengBirthRange,
  type QizhengBirthRange,
  type QizhengInput,
} from 'mingyu-core/qizheng';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';

const OFFSET_MINUTES = 480;
const OFFSET_MILLISECONDS = OFFSET_MINUTES * 60 * 1_000;

function beijingTimestamp(value: string) {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

function formatBeijingTimestamp(timestamp: number) {
  return new Date(timestamp + OFFSET_MILLISECONDS).toISOString().slice(0, 19).replace('T', ' ');
}

const startText = '2024-02-19 11:24:48';
const endText = '2024-02-19 11:24:50';
const startTimestamp = beijingTimestamp(startText);
const endTimestamp = beijingTimestamp(endText);

const source: BaziReverseSource = {
  pillars: getDivinationTime(new Date(startTimestamp), OFFSET_MINUTES).ganzhi,
  intervalStart: startText,
  intervalEnd: endText,
  startTimestamp,
  endTimestamp,
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

const lockedInput: QizhengInput = {
  gender: 'male',
  year: 2024,
  month: 2,
  day: 19,
  hour: 11,
  minute: 24,
  second: 48,
  latitude: 39.9,
  longitude: 116.4,
  timezone: 8,
  useTrueSolarTime: false,
};

function createSubject(range: BaziReverseSource = source): ReadingSubjectSnapshot {
  return {
    id: 'synthetic-qizheng-birth-range',
    source: 'qizheng',
    allowedMethods: ['qi-zheng'],
    lockedInputs: { 'qi-zheng': lockedInput },
    range: { birthTimeRanges: { primary: range } },
  };
}

type WorkerMessage = {
  id: string;
  input: QizhengInput;
  source: BaziReverseSource;
};

class ReadingFakeWorker {
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
    const result = generateQizhengBirthRange(message.input, {
      startTimestamp: message.source.startTimestamp!,
      endTimestamp: message.source.endTimestamp!,
    });
    queueMicrotask(() => {
      this.onmessage?.({
        data: { id: message.id, type: 'result', result },
      } as MessageEvent);
    });
  }

  terminate() {
    this.terminated = true;
  }
}

async function withReadingFakeWorker<T>(callback: () => Promise<T>) {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  ReadingFakeWorker.instances = [];
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

test('七政完整出生区间补算走本地 Worker 并保留全部本命分支事实', async () => {
  await withReadingFakeWorker(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'qi-zheng',
        input: { question: '本命出生区间的共同与分段事实' },
      },
      undefined,
      createSubject(),
    );

    const structured = resource.structured as Record<string, unknown>;
    const range = structured as unknown as QizhengBirthRange & {
      birthTimeRange: BaziReverseSource;
    };
    assert.deepEqual(range.birthTimeRange, source);
    assert.equal(range.source.startTimestamp, startTimestamp);
    assert.equal(range.source.endTimestamp, endTimestamp);
    assert.ok(range.branches.length > 0);
    for (const branch of range.branches) {
      assert.match(
        resource.text,
        new RegExp(
          `${formatBeijingTimestamp(branch.startTimestamp)} 至 ${formatBeijingTimestamp(branch.endTimestamp)}`,
          'u',
        ),
      );
    }
    assert.match(resource.text, /【七政四余本命出生区间】/u);
    assert.match(resource.text, /【问题】/u);
    assert.match(resource.text, /本命出生区间的共同与分段事实/u);
    assert.equal(ReadingFakeWorker.instances.length, 1);
    assert.deepEqual(ReadingFakeWorker.instances[0]?.postedMessage?.input, lockedInput);
    assert.equal(ReadingFakeWorker.instances[0]?.terminated, true);
  });
});

test('七政出生区间明确拒绝流年字段而不启动计算', async () => {
  await withReadingFakeWorker(async () => {
    await assert.rejects(
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'qi-zheng',
          input: { flowYear: 2035, question: '不应进入本命区间' },
        },
        undefined,
        createSubject(),
      ),
      /只支持本命，不能包含flowYear字段/u,
    );
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});

test('七政出生区间机器来源无效时显式报错而不回退单点', async () => {
  await withReadingFakeWorker(async () => {
    await assert.rejects(
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'qi-zheng',
          input: { question: '无效区间' },
        },
        undefined,
        createSubject({ ...source, intervalEnd: '2024-02-19 11:24:51' }),
      ),
      /来源无效，不能退回单点补算/u,
    );
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});

test('七政出生区间仍沿用锁定主体，动作不能改写出生字段', async () => {
  await withReadingFakeWorker(async () => {
    await assert.rejects(
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'qi-zheng',
          input: { year: 2025, question: '篡改锁定出生年份' },
        },
        undefined,
        createSubject(),
      ),
      /主体与当前命盘不一致：year/u,
    );
    assert.equal(ReadingFakeWorker.instances.length, 0);
  });
});
