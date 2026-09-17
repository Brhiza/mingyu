import assert from 'node:assert/strict';
import test from 'node:test';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import { calculateBaziReading } from '../src/lib/ai/bazi-reading-calculation';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';

const subject: ReadingSubjectSnapshot = {
  id: '公开合成本地八字主体',
  source: 'bazi',
  allowedMethods: ['bazi'],
  range: {},
  lockedInputs: {
    bazi: {
      gender: 'female',
      year: 1990,
      month: 6,
      day: 14,
      dateType: 'solar',
      birthHour: 12,
      birthMinute: 34,
      birthSecond: 56,
      timeIndex: 6,
      useTrueSolarTime: false,
      timezone: 8,
    },
  },
};

const action = {
  kind: 'calculate' as const,
  method: 'bazi',
  input: { baziFortuneScope: 'natal', question: '分析本命结构。' },
};

test('浏览器八字补算使用本地 Worker 并保留主体核验、取消和错误', async () => {
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
            data: { id: message.id, type: 'error', error: '公开合成计算错误' },
          } as MessageEvent);
          return;
        }
        try {
          const result = await calculateBaziReading(message.calculationRequest);
          if (mode === 'wrong-subject' || mode === 'wrong-clock') {
            const identity = result.result.calculationIdentity as {
              birth: Record<string, unknown>;
            };
            if (mode === 'wrong-subject') identity.birth.day = 15;
            else identity.birth.birthMinute = 35;
          }
          this.onmessage?.({ data: { id: message.id, type: 'result', result } } as MessageEvent);
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
    throw new Error('本地八字计算不应访问网络。');
  };
  try {
    const resource = await executeReadingAction(action, undefined, subject);
    assert.match(workerUrl, /bazi-reading\.worker\.ts$/);
    assert.equal(resource.usable, true);
    assert.match(resource.text, /分析本命结构/);
    assert.equal(terminated, 1);
    const identity = resource.structured?.calculationIdentity as {
      birth: Record<string, unknown>;
    };
    assert.equal(identity.birth.birthSecond, 56);

    mode = 'wrong-subject';
    await assert.rejects(executeReadingAction(action, undefined, subject), /day|主体|不一致/);

    mode = 'wrong-clock';
    await assert.rejects(executeReadingAction(action, undefined, subject), /birthMinute/);

    mode = 'error';
    await assert.rejects(executeReadingAction(action, undefined, subject), /公开合成计算错误/);

    mode = 'pending';
    const controller = new AbortController();
    const pending = executeReadingAction(action, controller.signal, subject);
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
