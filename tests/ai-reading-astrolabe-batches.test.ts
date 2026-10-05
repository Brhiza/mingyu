import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AstrolabePeriodContext,
  AstrolabePeriodEvent,
  AstrolabePeriodScopeMode,
} from 'mingyu-core/divination/astrolabe-scope';
import {
  DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS,
  fetchAstrolabePeriodCollection,
} from '../src/lib/ai/astrolabe-batch-resources';
import { generateAstrolabeReadingLocally } from '../src/lib/ai/astrolabe-reading-calculation';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

test('自定义星盘范围补算核对结构化范围与完整提示词', async () => {
  const customText = '分析合成样本的指定阶段';
  const locked = {
    name: '合成样本',
    gender: 'female',
    year: 1995,
    month: 5,
    day: 20,
    hour: 12,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    useTrueSolarTime: false,
  };
  const input = {
    astrolabeScope: 'natal',
    astrolabeScopeText: customText,
    question: '请分析此阶段。',
  };
  const baseline = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/divination/astrolabe/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...locked, ...input, gender: '女', responseMode: 'full' }),
    }),
  );
  const body = (await baseline.json()) as { ok: boolean; data: Record<string, unknown> };
  assert.equal(body.ok, true, JSON.stringify(body));
  const subject: ReadingSubjectSnapshot = {
    id: 'synthetic-custom-astrolabe',
    source: 'astrolabe',
    allowedMethods: ['astrolabe'],
    lockedInputs: { astrolabe: locked },
    range: {},
  };
  const action = { kind: 'calculate' as const, method: 'astrolabe', input };
  const originalFetch = globalThis.fetch;
  let responseData = structuredClone(body.data);
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    const valid = await executeReadingAction(action, undefined, subject);
    assert.ok(valid.text.includes(customText));

    responseData = structuredClone(body.data);
    const alteredResult = responseData.result as Record<string, unknown>;
    (alteredResult.scopeEvidence as Record<string, unknown>).promptText = '另一分析范围';
    await assert.rejects(
      executeReadingAction(action, undefined, subject),
      /astrolabe\.scopeEvidence\.promptText/u,
    );

    responseData = structuredClone(body.data);
    responseData.prompt = String(responseData.prompt).replaceAll(customText, '另一分析范围');
    await assert.rejects(executeReadingAction(action, undefined, subject), /astrolabe\.prompt/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('完整星盘补算复用一次接口批次并保持本地及三段事件一致', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-16T04:00:00Z') });
  const input = {
    name: '合成验证',
    gender: 'female',
    year: 1995,
    month: 5,
    day: 20,
    hour: 12,
    minute: 30,
    second: 37,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    astrolabeScope: 'full',
    astrolabeScopeDate: '2028-06-12',
    question: '请分析各阶段变化。',
    supplementaryInfo: { knownFacts: '本次既定事实' },
  };
  const previousFetch = globalThis.fetch;
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Reflect.deleteProperty(globalThis, 'Worker');
  let baseCount = 0;
  const periodRequests = new Map<string, Array<{ startDate: string; endDate: string }>>();
  globalThis.fetch = (async (url, init) => {
    const request = new Request(new URL(String(url), 'https://aov.cc'), init);
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (request.url.endsWith('/period-events')) {
      const scope = String(payload.astrolabeScope);
      const range = payload.astrolabePeriodRange as { startDate: string; endDate: string };
      const requests = periodRequests.get(scope) ?? [];
      requests.push({ startDate: range.startDate, endDate: range.endDate });
      periodRequests.set(scope, requests);
      const expectedDateByScope: Record<string, string> = {
        yearly: '2028',
        monthly: '2028-06',
        daily: '2028-06-12',
      };
      assert.equal(payload.astrolabeScopeDate, expectedDateByScope[scope]);
    } else {
      baseCount += 1;
      assert.ok(request.url.endsWith('/astrolabe/prompt'));
      assert.equal(payload.gender, '女');
      assert.equal(payload.astrolabeIncludePeriodEvents, false);
      assert.equal(payload.responseMode, 'full');
      assert.equal(payload.year, input.year);
      assert.equal(payload.month, input.month);
      assert.equal(payload.day, input.day);
      assert.equal(payload.hour, input.hour);
      assert.equal(payload.minute, input.minute);
      assert.equal(payload.second, input.second);
      assert.equal(payload.latitude, input.latitude);
      assert.equal(payload.longitude, input.longitude);
      assert.equal(payload.timezone, input.timezone);
      assert.equal(payload.astrolabeScope, 'full');
      assert.equal(payload.astrolabeScopeDate, input.astrolabeScopeDate);
      assert.equal(payload.question, input.question);
    }
    return handlePublicApiRequest(request);
  }) as typeof fetch;
  try {
    const resource = await executeReadingAction({ kind: 'calculate', method: 'astrolabe', input });
    const original = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/divination/astrolabe/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          gender: '女',
          astrolabeIncludePeriodEvents: true,
          responseMode: 'full',
        }),
      }),
    );
    const body = await original.json();
    assert.equal(body.ok, true);
    assert.equal(resource.text, body.data.prompt);
    const expectedScopes = ['yearly', 'monthly', 'daily'];
    const resourceStructured = resource.structured;
    assert.ok(resourceStructured);
    const remoteEvidence = resourceStructured.scopeEvidence as {
      contexts: Record<
        string,
        { periodEvents?: { events: AstrolabePeriodEvent[] }; promptText: string }
      >;
    };
    for (const scope of expectedScopes) {
      const expected = body.data.result.scopeEvidence.contexts[scope];
      assert.deepEqual(
        remoteEvidence.contexts[scope].periodEvents?.events,
        expected.periodEvents.events,
      );
      assert.equal(remoteEvidence.contexts[scope].promptText, expected.promptText);
      assert.ok(resource.text.includes(expected.promptText));
    }

    const requestsBeforeLocal = {
      baseCount,
      periodRequests: Object.fromEntries(
        [...periodRequests].map(([scope, requests]) => [scope, structuredClone(requests)]),
      ),
    };
    const localInput = {
      ...input,
      supplementaryInfo: { ...input.supplementaryInfo },
      gender: '女',
      responseMode: 'full',
      astrolabeIncludePeriodEvents: false,
    };
    const localOptions = {
      onProgress() {
        localInput.question = '后来问题';
        localInput.supplementaryInfo.knownFacts = '后来事实';
        localOptions.onProgress = () => {
          throw new Error('不应改用后来的进度回调');
        };
      },
    };
    const local = await generateAstrolabeReadingLocally(localInput, localOptions);
    assert.equal(localInput.question, '后来问题');
    assert.equal(localInput.supplementaryInfo.knownFacts, '后来事实');
    assert.ok(local.prompt.includes('本次既定事实'));
    assert.ok(!local.prompt.includes('后来问题'));
    assert.ok(!local.prompt.includes('后来事实'));
    assert.equal(local.prompt, resource.text);
    assert.deepEqual(JSON.parse(JSON.stringify(local.result.scopeEvidence)), remoteEvidence);
    if (local.result.scopeEvidence.scope !== 'full') {
      throw new Error('本地完整星盘结果缺少 full 范围身份。');
    }
    const localContexts = local.result.scopeEvidence.contexts;
    assert.ok(localContexts.yearly.periodEvents?.events.length);
    assert.ok(localContexts.monthly.periodEvents?.events.length);
    assert.ok(localContexts.daily.periodEvents?.events.length);

    assert.equal(DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS, 7);
    const expectedRanges = {
      yearly: {
        dateStr: '2028',
        startDate: '2028-01-01',
        endDate: '2029-01-01',
        days: 366,
        requests: 53,
      },
      monthly: {
        dateStr: '2028-06',
        startDate: '2028-06-01',
        endDate: '2028-07-01',
        days: 30,
        requests: 5,
      },
      daily: {
        dateStr: '2028-06-12',
        startDate: '2028-06-12',
        endDate: '2028-06-13',
        days: 1,
        requests: 1,
      },
    } as const;
    assert.deepEqual([...periodRequests.keys()], expectedScopes);
    for (const scope of expectedScopes) {
      const expected = expectedRanges[scope as keyof typeof expectedRanges];
      const requests = periodRequests.get(scope) ?? [];
      assert.equal(requests.length, expected.requests);
      assert.equal(requests[0]?.startDate, expected.startDate);
      let nextStart = expected.startDate;
      for (const [index, range] of requests.entries()) {
        assert.equal(range.startDate, nextStart);
        const elapsedDays = index * DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS;
        const expectedBatchDays = Math.min(
          DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS,
          expected.days - elapsedDays,
        );
        const actualBatchDays =
          (Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) /
          86_400_000;
        assert.equal(actualBatchDays, expectedBatchDays);
        nextStart = range.endDate;
      }
      assert.equal(nextStart, expected.endDate);
    }
    assert.equal(baseCount, requestsBeforeLocal.baseCount);
    assert.deepEqual(Object.fromEntries(periodRequests), requestsBeforeLocal.periodRequests);
    assert.equal(baseCount, 1);
    const periodRequestCount = [...periodRequests.values()].reduce(
      (total, requests) => total + requests.length,
      0,
    );
    assert.equal(periodRequestCount, 59);
    assert.equal(baseCount + periodRequestCount, 60);
  } finally {
    globalThis.fetch = previousFetch;
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
  }
});

test('星盘本地 Worker 失败直接报错且不回退公开接口', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const originalFetch = globalThis.fetch;
  class FailingAstrolabeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;

    postMessage() {
      queueMicrotask(() => this.onerror?.({ message: '本地星盘 Worker 失败。' } as ErrorEvent));
    }

    terminate() {}
  }
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: FailingAstrolabeWorker,
  });
  globalThis.fetch = (async () => {
    throw new Error('Worker 失败后不应回退公开接口。');
  }) as typeof fetch;
  try {
    await assert.rejects(
      executeReadingAction({
        kind: 'calculate',
        method: 'astrolabe',
        input: {
          name: '失败验证',
          gender: 'male',
          year: 1995,
          month: 5,
          day: 20,
          hour: 12,
          minute: 30,
          latitude: 39.9042,
          longitude: 116.4074,
          timezone: 8,
          astrolabeScope: 'daily',
          astrolabeScopeDate: '2028-06-12',
          question: '测试失败边界',
        },
      }),
      /本地星盘 Worker 失败/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

const periodContext: AstrolabePeriodContext = {
  timezone: 8,
  timeZoneId: 'Asia/Shanghai',
  points: [
    { name: 'Sun', longitude: 10 },
    { name: 'Moon', longitude: 20 },
    { name: 'Ascendant', longitude: 30 },
  ],
  houseCusps: Array.from(
    { length: 12 },
    (_, index) => index * 30,
  ) as AstrolabePeriodContext['houseCusps'],
};

function addDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + days);
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((item, index) => (index === 0 ? String(item) : String(item).padStart(2, '0')))
    .join('-');
}

function eventFor(date: string, key = date): AstrolabePeriodEvent {
  return {
    key,
    kind: '交食',
    julianDate: Date.parse(`${date}T00:00:00Z`) / 86400000 + 2440587.5,
    dateTime: `${date} 00:00`,
    promptText: `日食${date}`,
    movingPoint: '太阳',
    targetPoint: '月亮',
    eclipseName: '日全食',
  };
}

function makeBatchResponse(
  scope: AstrolabePeriodScopeMode,
  target: string,
  startDate: string,
  endDate: string,
  parentRange: { startDate: string; endDate: string },
  nextRange: { startDate: string; endDate: string } | null,
  events: AstrolabePeriodEvent[] = [eventFor(startDate)],
) {
  return {
    kind: 'astrolabe-period-batch',
    scope,
    target,
    parentRange: { ...parentRange, endExclusive: true as const },
    range: { startDate, endDate, endExclusive: true as const },
    nextRange: nextRange ? { ...nextRange, endExclusive: true as const } : null,
    timezone: 8,
    timeZoneId: 'Asia/Shanghai',
    sampleStepDays: scope === 'daily' ? 1 / 24 : scope === 'monthly' ? 0.25 : 1,
    events,
  };
}

test('星盘周期客户端按七个民用日顺序取齐并跨批重建完整层级', async () => {
  const requests: string[] = [];
  const lockedContext = structuredClone(periodContext);
  const controller = new AbortController();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const args = {
    scope: 'monthly' as const,
    dateStr: '2028-06',
    periodContext: lockedContext,
    signal: controller.signal,
    batchDays: DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS,
    fetchBatch: async (input: Record<string, unknown>, signal?: AbortSignal) => {
      const range = input.astrolabePeriodRange as { startDate: string; endDate: string };
      requests.push(`${range.startDate}/${range.endDate}`);
      assert.equal(signal, controller.signal);
      assert.equal(input.astrolabeScope, 'monthly');
      assert.equal(input.astrolabeScopeDate, '2028-06');
      assert.deepEqual(input.astrolabePeriodContext, periodContext);
      if (requests.length === 1) await gate;
      const parentRange = { startDate: '2028-06-01', endDate: '2028-07-01' };
      const nextRange =
        range.endDate === parentRange.endDate
          ? null
          : {
              startDate: range.endDate,
              endDate:
                addDays(range.endDate, 7) > parentRange.endDate
                  ? parentRange.endDate
                  : addDays(range.endDate, 7),
            };
      return makeBatchResponse(
        'monthly',
        '2028-06',
        range.startDate,
        range.endDate,
        parentRange,
        nextRange,
      );
    },
  };
  const pending = fetchAstrolabePeriodCollection(args);
  args.dateStr = '2029-06';
  lockedContext.timezone = 0;
  lockedContext.points[0].longitude = 99;
  lockedContext.houseCusps[0] = 123;
  args.fetchBatch = async () => {
    throw new Error('不应改用后来的批次读取器');
  };
  release();
  const collection = await pending;
  assert.equal(args.dateStr, '2029-06');
  assert.equal(lockedContext.points[0].longitude, 99);
  assert.equal(lockedContext.houseCusps[0], 123);

  assert.deepEqual(requests, [
    '2028-06-01/2028-06-08',
    '2028-06-08/2028-06-15',
    '2028-06-15/2028-06-22',
    '2028-06-22/2028-06-29',
    '2028-06-29/2028-07-01',
  ]);
  assert.equal(collection.parentRange.endDate, '2028-07-01');
  assert.equal(collection.events.length, 5);
  assert.match(collection.promptText, /完整明细：/u);
  assert.match(collection.promptText, /2028-06-29/u);
});

test('星盘周期批次范围不连续或提前结束时拒绝部分结果', async () => {
  await assert.rejects(
    fetchAstrolabePeriodCollection({
      scope: 'monthly',
      dateStr: '2028-06',
      periodContext,
      fetchBatch: async () =>
        makeBatchResponse(
          'monthly',
          '2028-06',
          '2028-06-01',
          '2028-06-08',
          { startDate: '2028-06-01', endDate: '2028-07-01' },
          { startDate: '2028-06-09', endDate: '2028-06-16' },
        ),
    }),
    /下一批未从当前批次结束处继续/u,
  );

  await assert.rejects(
    fetchAstrolabePeriodCollection({
      scope: 'monthly',
      dateStr: '2028-06',
      periodContext,
      fetchBatch: async () =>
        makeBatchResponse(
          'monthly',
          '2028-06',
          '2028-06-01',
          '2028-06-08',
          { startDate: '2028-06-01', endDate: '2028-07-01' },
          null,
        ),
    }),
    /提前结束/u,
  );
});

test('星盘周期分批遵从同一 AbortSignal，取消时不返回部分集合', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchAstrolabePeriodCollection({
      scope: 'daily',
      dateStr: '2028-06-12',
      periodContext,
      signal: controller.signal,
      fetchBatch: async () => {
        throw new Error('不应启动已取消的周期批次');
      },
    }),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );

  const finalController = new AbortController();
  let finalBatchCalls = 0;
  const progress: Array<[number, number]> = [];
  const finalArgs = {
    scope: 'daily' as const,
    dateStr: '2028-06-12',
    periodContext,
    signal: finalController.signal,
    onProgress(completed: number, total: number) {
      progress.push([completed, total]);
      finalArgs.signal = new AbortController().signal;
      finalController.abort();
    },
    fetchBatch: async (_input: Record<string, unknown>, signal?: AbortSignal) => {
      finalBatchCalls += 1;
      assert.equal(signal, finalController.signal);
      return makeBatchResponse(
        'daily',
        '2028-06-12',
        '2028-06-12',
        '2028-06-13',
        { startDate: '2028-06-12', endDate: '2028-06-13' },
        null,
      );
    },
  };
  await assert.rejects(fetchAstrolabePeriodCollection(finalArgs), {
    name: 'AbortError',
    message: '已停止解读',
  });
  assert.equal(finalBatchCalls, 1);
  assert.deepEqual(progress, [[1, 1]]);
  assert.equal(finalController.signal.aborted, true);
  assert.equal(finalArgs.signal.aborted, false);
});

function createAstrolabeResult() {
  const points = [
    ['Sun', 10],
    ['Moon', 20],
    ['Mercury', 30],
    ['Venus', 40],
    ['Mars', 50],
    ['Jupiter', 60],
    ['Saturn', 70],
    ['Uranus', 80],
    ['Neptune', 90],
    ['Pluto', 100],
    ['North Node', 110],
    ['South Node', 290],
  ].map(([name, longitude]) => ({
    name,
    label: name,
    longitude,
    sign: '白羊座',
    degree: 0,
    minute: 0,
    house: 1,
    formatted: '白羊座0°00′',
  }));
  const makePoint = (name: string, longitude: number) => ({
    name,
    label: name,
    longitude,
    sign: '白羊座',
    degree: 0,
    minute: 0,
    house: 1,
    formatted: '白羊座0°00′',
  });
  return {
    birth: {
      name: '甲',
      gender: '男',
      dateTime: '1990-05-15 10:30',
      standardDateTime: '1990-05-15 10:30',
      location: '北京（39.9000, 116.4000）',
      latitude: 39.9,
      longitude: 116.4,
      timezone: 8,
      timeZoneId: 'Asia/Shanghai',
      isTrueSolarTime: false,
    },
    planets: points,
    angles: [makePoint('Ascendant', 120), makePoint('Midheaven', 210)],
    houses: Array.from({ length: 12 }, (_, index) => ({
      ...makePoint(`House ${index + 1}`, index * 30),
      house: index + 1,
    })),
    aspects: [],
    summary: { elements: {}, modalities: {}, retrograde: [], patterns: [] },
    timestamp: 0,
    scopeEvidence: {
      scope: 'monthly',
      dateStr: '2028-06',
      displayText: '流月 · 2028-06',
      displayLabel: '流月2028-06',
      promptText: '分析对象：流月2028-06。\n行运取样：2028-06-15 12:00（Asia/Shanghai）。',
    },
  };
}

test('星盘阅读资源先取轻量本命资料，再顺序补齐周期批次并只发布完整提示词', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; input: Record<string, unknown> }> = [];
  const result = createAstrolabeResult();
  globalThis.fetch = (async (input, init) => {
    const path = String(input);
    const requestInput = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ path, input: requestInput });
    if (path.includes('/astrolabe/prompt')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { result, prompt: `【星盘资料】\n${result.scopeEvidence.promptText}` },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (!path.includes('/astrolabe/period-events')) {
      throw new Error(`意外请求：${path}`);
    }
    const range = requestInput.astrolabePeriodRange as { startDate: string; endDate: string };
    const parentRange = { startDate: '2028-06-01', endDate: '2028-07-01' };
    const nextRange =
      range.endDate === parentRange.endDate
        ? null
        : {
            startDate: range.endDate,
            endDate:
              addDays(range.endDate, 7) > parentRange.endDate
                ? parentRange.endDate
                : addDays(range.endDate, 7),
          };
    return new Response(
      JSON.stringify({
        success: true,
        data: makeBatchResponse(
          'monthly',
          '2028-06',
          range.startDate,
          range.endDate,
          parentRange,
          nextRange,
        ),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const resource = await executeReadingAction({
      kind: 'calculate',
      method: 'astrolabe',
      input: {
        name: '甲',
        gender: 'male',
        year: 1990,
        month: 5,
        day: 15,
        hour: 10,
        minute: 30,
        latitude: 39.9,
        longitude: 116.4,
        timezone: 8,
        astrolabeScope: 'monthly',
        astrolabeScopeDate: '2028-06',
        question: '本月重点是什么？',
      },
    });
    const structured = resource.structured as Record<string, unknown>;
    const evidence = structured.scopeEvidence as Record<string, unknown>;
    const periodEvents = evidence.periodEvents as Record<string, unknown>;
    assert.equal(requests[0]?.input.responseMode, 'full');
    assert.equal(requests[0]?.input.astrolabeIncludePeriodEvents, false);
    assert.equal(requests.length, 6);
    assert.ok(requests.slice(1).every((request) => request.path.includes('/period-events')));
    assert.equal(
      (requests[1]?.input.astrolabePeriodContext as Record<string, unknown>).timeZoneId,
      'Asia/Shanghai',
    );
    assert.equal((periodEvents.events as unknown[]).length, 5);
    assert.match(resource.text, /完整明细：/u);
    assert.match(resource.text, /2028-06-29/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
