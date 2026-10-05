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
  let canonicalResult: Awaited<ReturnType<typeof calculateBaziReading>> | undefined;
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
          canonicalResult ??= await calculateBaziReading(message.calculationRequest);
          const result = structuredClone(canonicalResult);
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

test('八字补算按原始钟表核主体，并按校正日期核盘面与时辰', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  let altered: 'none' | 'birth-clock' | 'chart-date' | 'chart-time' | 'identity-clock' = 'none';
  let beforeReply: (() => void) | undefined;
  const canonicalResults = new Map<string, ReturnType<typeof calculateBaziReading>>();
  class LocalWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;

    postMessage(message: { id: string; calculationRequest: Record<string, unknown> }) {
      queueMicrotask(() => {
        try {
          const key = JSON.stringify(message.calculationRequest);
          let canonicalResult = canonicalResults.get(key);
          if (!canonicalResult) {
            canonicalResult = calculateBaziReading(message.calculationRequest);
            canonicalResults.set(key, canonicalResult);
          }
          const result = structuredClone(canonicalResult);
          if (altered === 'birth-clock') result.result.birthClockTime!.day = 2;
          if (altered === 'chart-date') result.result.solarDate.day = 30;
          if (altered === 'chart-time') result.result.timeInfo.index = 0;
          if (altered === 'identity-clock') result.result.calculationIdentity.birth.birthMinute = 6;
          beforeReply?.();
          this.onmessage?.({ data: { id: message.id, type: 'result', result } } as MessageEvent);
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
    value: LocalWorker,
  });
  const base = {
    gender: 'female' as const,
    birthHour: 0,
    birthMinute: 30,
    birthSecond: 42,
    timeIndex: 0,
    useTrueSolarTime: false,
  };
  const action = {
    kind: 'calculate' as const,
    method: 'bazi',
    input: { baziFortuneScope: 'natal', question: '核对出生日期和时辰。' },
  };
  const subjectFor = (id: string, locked: Record<string, unknown>): ReadingSubjectSnapshot => ({
    id,
    source: 'bazi',
    allowedMethods: ['bazi'],
    range: {},
    lockedInputs: { bazi: locked },
  });
  const dst = subjectFor('中国夏令时跨日', {
    ...base,
    year: 1988,
    month: 6,
    day: 1,
    dateType: 'solar',
    timezone: 8,
    applyChinaDst: true,
  });
  try {
    for (const [label, locked] of [
      ['中国夏令时', dst],
      [
        'IANA 历史夏令时',
        subjectFor('IANA 历史夏令时跨日', {
          ...base,
          year: 1988,
          month: 6,
          day: 1,
          dateType: 'solar',
          timeZoneId: 'Asia/Shanghai',
        }),
      ],
      ...['Asia/Chongqing', 'Asia/Harbin', 'PRC'].map(
        (timeZoneId) =>
          [
            `IANA 中国时区别名 ${timeZoneId}`,
            subjectFor(`IANA 中国时区别名跨日 ${timeZoneId}`, {
              ...base,
              year: 1988,
              month: 6,
              day: 1,
              dateType: 'solar',
              timeZoneId,
            }),
          ] as const,
      ),
      [
        '农历输入夏令时',
        subjectFor('农历输入夏令时跨日', {
          ...base,
          year: 1988,
          month: 4,
          day: 17,
          dateType: 'lunar',
          timezone: 8,
          applyChinaDst: true,
        }),
      ],
    ] as const) {
      const resource = await executeReadingAction(action, undefined, locked);
      assert.equal(resource.usable, true, label);
      const result = resource.structured as ReturnType<typeof calculateBaziReading>['result'];
      assert.deepEqual(result.birthClockTime, {
        year: 1988,
        month: 6,
        day: 1,
        hour: 0,
        minute: 30,
        second: 42,
      });
      assert.deepEqual(result.solarDate, { year: 1988, month: 5, day: 31 });
      assert.deepEqual(
        { year: result.lunarDate.year, month: result.lunarDate.month, day: result.lunarDate.day },
        { year: 1988, month: 4, day: 16 },
      );
      assert.equal(result.timeInfo.index, 12);
    }

    const trueSolar = await executeReadingAction(
      action,
      undefined,
      subjectFor('真太阳时跨日', {
        ...base,
        year: 2024,
        month: 5,
        day: 19,
        dateType: 'solar',
        timezone: 8,
        useTrueSolarTime: true,
        birthLongitude: 75,
      }),
    );
    assert.equal(trueSolar.usable, true);
    const trueSolarResult = trueSolar.structured as ReturnType<
      typeof calculateBaziReading
    >['result'];
    assert.deepEqual(trueSolarResult.birthClockTime, {
      year: 2024,
      month: 5,
      day: 19,
      hour: 0,
      minute: 30,
      second: 42,
    });
    assert.deepEqual(trueSolarResult.solarDate, { year: 2024, month: 5, day: 18 });

    altered = 'birth-clock';
    await assert.rejects(executeReadingAction(action, undefined, dst), /原始公历出生日期/);
    altered = 'chart-date';
    await assert.rejects(executeReadingAction(action, undefined, dst), /实际校正公历出生日期/);
    altered = 'chart-time';
    await assert.rejects(
      executeReadingAction(
        action,
        undefined,
        subjectFor('IANA 中国时区别名跨日错误时辰', {
          ...base,
          year: 1988,
          month: 6,
          day: 1,
          dateType: 'solar',
          timeZoneId: 'Asia/Chongqing',
        }),
      ),
      /bazi\.result\.timeInfo\.index/,
    );

    altered = 'none';
    const minuteSubject = subjectFor('分钟钟表保留实际零时', {
      gender: 'female',
      year: 2024,
      month: 6,
      day: 1,
      dateType: 'solar',
      useTrueSolarTime: false,
      birthHour: 0,
      birthMinute: 5,
      timeIndex: 6,
      timezone: 8,
    });
    const minuteResource = await executeReadingAction(action, undefined, minuteSubject);
    const minuteResult = minuteResource.structured as ReturnType<
      typeof calculateBaziReading
    >['result'];
    assert.equal(minuteResource.usable, true);
    assert.deepEqual(minuteResult.birthClockTime, {
      year: 2024,
      month: 6,
      day: 1,
      hour: 0,
      minute: 5,
      second: 0,
    });
    assert.equal(minuteResult.timeInfo.index, 0);
    assert.equal(minuteResult.calculationIdentity.birth.birthMinute, 5);

    altered = 'identity-clock';
    await assert.rejects(
      executeReadingAction(action, undefined, minuteSubject),
      /bazi\.birthMinute/,
    );
    altered = 'none';
    beforeReply = () => {
      minuteSubject.lockedInputs.bazi.year = 2025;
    };
    const stableResource = await executeReadingAction(action, undefined, minuteSubject);
    assert.equal(stableResource.usable, true);
    assert.equal(minuteSubject.lockedInputs.bazi.year, 2025);
    assert.equal(
      (stableResource.structured?.calculationIdentity as { birth: { year: number } }).birth.year,
      2024,
    );
  } finally {
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});
