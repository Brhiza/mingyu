import assert from 'node:assert/strict';
import test from 'node:test';

import { executeReadingAction } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import {
  calculateZiweiReading,
  generateZiweiReadingLocally,
  type ZiweiReadingChunk,
} from '../src/lib/ai/ziwei-reading-calculation';
import { executeZiweiReadingWorker } from '../src/lib/ai/ziwei-reading-worker';

const BASE_INPUT = {
  name: '本地紫微合成主体',
  gender: 'male',
  dateType: 'solar',
  year: '1990',
  month: '6',
  day: '14',
  birthHour: '10',
  birthMinute: '59',
  birthSecond: 37,
  timeIndex: 5,
  isLeapMonth: false,
  useTrueSolarTime: false,
  timezone: 8,
  birthPlace: '合成地点',
  birthLatitude: 30.25,
  birthLongitude: '120.5',
  algorithm: 'zhongzhou',
  scopeDate: '2025-01-01',
  scopeHourIndex: 6,
  question: '请核对本次紫微资料。',
};

const LOCKED_SUBJECT: ReadingSubjectSnapshot = {
  id: '公开合成本地紫微主体',
  source: 'ziwei',
  allowedMethods: ['ziwei'],
  range: {},
  lockedInputs: {
    ziwei: {
      name: BASE_INPUT.name,
      gender: BASE_INPUT.gender,
      year: 1990,
      month: 6,
      day: 14,
      dateType: 'solar',
      isLeapMonth: false,
      birthHour: 10,
      birthMinute: 59,
      birthSecond: 37,
      timeIndex: 5,
      useTrueSolarTime: false,
      birthPlace: BASE_INPUT.birthPlace,
      birthLatitude: BASE_INPUT.birthLatitude,
      timezone: BASE_INPUT.timezone,
      algorithm: BASE_INPUT.algorithm,
    },
  },
};

test('本地紫微点补算保留出生秒、算法、固定运限上下文和完整层级事实', async () => {
  const result = await generateZiweiReadingLocally({
    ...BASE_INPUT,
    promptScope: 'decadal',
  });

  assert.equal(result.result.calculationIdentity.method, 'ziwei');
  assert.deepEqual(result.result.calculationIdentity.birth, {
    name: '本地紫微合成主体',
    gender: 'male',
    year: 1990,
    month: 6,
    day: 14,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthPlace: '合成地点',
    birthHour: 10,
    birthMinute: 59,
    birthSecond: 37,
    birthLatitude: 30.25,
    timezone: 8,
    algorithm: 'zhongzhou',
  });
  assert.deepEqual(result.result.calculationIdentity.target, {
    promptScope: 'decadal',
    scopeDate: '2025-01-01',
    scopeHourIndex: 6,
  });
  assert.equal(result.result.basicInfo.gender, '男');
  assert.equal(result.result.calculationConfig.algorithm, 'zhongzhou');
  assert.deepEqual(result.result.scopeNames, ['origin', 'decadal']);
  assert.equal(result.result.fortuneTimeline?.targetDateStr, '2025-01-01');
  assert.equal(result.result.fortuneTimeline?.targetHourIndex, 6);
  assert.match(result.prompt, /请核对本次紫微资料/u);
});

test('本地紫微 full 补算逐批取得年龄年后再生成完整事实提示词', async () => {
  const progress: Array<[number, number]> = [];
  const chunks: ZiweiReadingChunk[] = [];
  const result = await generateZiweiReadingLocally(
    { ...BASE_INPUT, promptScope: 'full' },
    {
      onProgress: (completed, total) => progress.push([completed, total]),
      onChunk: (chunk) => chunks.push(chunk),
    },
  );

  assert.ok(progress.length > 1);
  assert.ok(progress.every(([completed, total]) => completed >= 1 && completed <= total));
  assert.equal(progress.at(-1)?.[0], progress.at(-1)?.[1]);
  assert.deepEqual(result.result.scopeNames, [
    'origin',
    'decadal',
    'yearly',
    'monthly',
    'daily',
    'hourly',
  ]);
  assert.equal(result.result.fortuneTimeline?.scope, 'all');
  assert.equal(result.result.fortuneTimeline?.batch, undefined);
  const timeline = result.result.fortuneTimeline;
  assert.ok(timeline?.periods.length);
  assert.deepEqual(result.result.scopeNames, Object.keys(result.result.payloadByScope));
  assert.equal(timeline?.actualStartDateStr, timeline?.periods[0]?.dateStr);
  assert.equal(timeline?.actualEndDateStr, timeline?.periods.at(-1)?.endDateStr);
  assert.match(result.prompt, /完整紫微运限资料/u);
  assert.equal(chunks[0]?.kind, 'base');
  assert.ok(chunks.some((chunk) => chunk.kind === 'scope' && chunk.scope === 'decadal'));
  assert.ok(chunks.some((chunk) => chunk.kind === 'fortune'));
  assert.ok(chunks.some((chunk) => chunk.kind === 'prompt'));
  assert.equal(chunks.at(-1)?.kind, 'complete');
});

test('紫微本地 Worker 返回同形结果、转发进度并支持取消', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const originalFetch = globalThis.fetch;
  const progress: Array<[number, number]> = [];

  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminated = false;

    postMessage(message: { id: string; calculationRequest: Record<string, unknown> }) {
      void generateZiweiReadingLocally(message.calculationRequest, {
        onProgress: (completed, total) => {
          this.onmessage?.({
            data: { id: message.id, type: 'progress', completed, total },
          } as MessageEvent);
        },
        onChunk: (chunk) => {
          this.onmessage?.({
            data: { id: message.id, type: 'chunk', chunk },
          } as MessageEvent);
        },
      })
        .then(() => {
          this.onmessage?.({
            data: { id: message.id, type: 'complete' },
          } as MessageEvent);
        })
        .catch((error: unknown) => {
          this.onerror?.({
            message: error instanceof Error ? error.message : String(error),
          } as ErrorEvent);
        });
    }

    terminate() {
      this.terminated = true;
    }
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: FakeWorker,
  });
  globalThis.fetch = (async () => {
    throw new Error('紫微本地 Worker 不应访问公开接口。');
  }) as typeof fetch;
  try {
    const result = await executeZiweiReadingWorker(
      { ...BASE_INPUT, promptScope: 'origin' },
      undefined,
      (completed, total) => progress.push([completed, total]),
    );
    assert.equal(result.result.calculationIdentity.target.promptScope, 'origin');
    assert.ok(progress.some(([completed, total]) => completed === 1 && total === 1));

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      executeZiweiReadingWorker({ ...BASE_INPUT, promptScope: 'origin' }, controller.signal),
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('紫微补算接入 ReadingResource 时核验主体、错误和取消且不回退网络', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const originalFetch = globalThis.fetch;
  let mode: 'success' | 'wrong-subject' | 'wrong-clock' | 'error' | 'pending' = 'success';
  let networkRequests = 0;
  let terminated = 0;
  let workerUrl = '';

  class LocalWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;

    constructor(url: URL) {
      workerUrl = String(url);
    }

    postMessage(message: { id: string; calculationRequest: Record<string, unknown> }) {
      if (mode === 'pending') return;
      queueMicrotask(async () => {
        if (mode === 'error') {
          this.onmessage?.({
            data: { id: message.id, type: 'error', error: '公开合成紫微计算错误' },
          } as MessageEvent);
          return;
        }
        try {
          const chunks: ZiweiReadingChunk[] = [];
          await calculateZiweiReading(message.calculationRequest, {
            onChunk: (chunk) => chunks.push(chunk),
          });
          for (const chunk of chunks) {
            if (chunk.kind === 'complete' && mode !== 'success') {
              const identity = chunk.calculationIdentity as {
                birth: Record<string, unknown>;
              };
              if (mode === 'wrong-subject') identity.birth.day = 15;
              else if (mode === 'wrong-clock') identity.birth.birthMinute = 0;
            }
            this.onmessage?.({
              data: { id: message.id, type: 'chunk', chunk },
            } as MessageEvent);
          }
          this.onmessage?.({ data: { id: message.id, type: 'complete' } } as MessageEvent);
        } catch (error) {
          this.onerror?.({ message: String(error) } as ErrorEvent);
        }
      });
    }

    terminate() {
      terminated += 1;
    }
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: LocalWorker,
  });
  globalThis.fetch = async () => {
    networkRequests += 1;
    throw new Error('本地紫微计算不应访问网络。');
  };
  const action = {
    kind: 'calculate' as const,
    method: 'ziwei' as const,
    input: { promptScope: 'origin', question: '分析本命结构。' },
  };
  try {
    const resource = await executeReadingAction(action, undefined, LOCKED_SUBJECT);
    assert.match(workerUrl, /ziwei-reading\.worker\.ts$/u);
    assert.equal(resource.usable, true);
    assert.match(resource.text, /分析本命结构/u);
    assert.equal(terminated, 1);
    const identity = resource.structured?.calculationIdentity as {
      birth: Record<string, unknown>;
    };
    assert.equal(identity.birth.birthSecond, 37);

    mode = 'wrong-subject';
    await assert.rejects(
      executeReadingAction(action, undefined, LOCKED_SUBJECT),
      /day|主体|不一致/u,
    );

    mode = 'wrong-clock';
    await assert.rejects(executeReadingAction(action, undefined, LOCKED_SUBJECT), /birthMinute/u);

    mode = 'error';
    await assert.rejects(
      executeReadingAction(action, undefined, LOCKED_SUBJECT),
      /公开合成紫微计算错误/u,
    );

    mode = 'pending';
    const controller = new AbortController();
    const pending = executeReadingAction(action, controller.signal, LOCKED_SUBJECT);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(terminated, 5);
    assert.equal(networkRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('紫微本地 Worker 缺少提示词分块时拒绝合成结果', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');

  class MissingChunkWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;

    postMessage(message: { id: string; calculationRequest: Record<string, unknown> }) {
      queueMicrotask(async () => {
        try {
          const chunks: ZiweiReadingChunk[] = [];
          await generateZiweiReadingLocally(message.calculationRequest, {
            onChunk: (chunk) => chunks.push(chunk),
          });
          for (const chunk of chunks) {
            if (chunk.kind === 'prompt') continue;
            this.onmessage?.({
              data: { id: message.id, type: 'chunk', chunk },
            } as MessageEvent);
          }
          this.onmessage?.({ data: { id: message.id, type: 'complete' } } as MessageEvent);
        } catch (error) {
          this.onerror?.({ message: String(error) } as ErrorEvent);
        }
      });
    }

    terminate() {}
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: MissingChunkWorker,
  });
  try {
    await assert.rejects(
      executeZiweiReadingWorker({ ...BASE_INPUT, promptScope: 'origin' }),
      /缺少提示词片段/u,
    );
  } finally {
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});
