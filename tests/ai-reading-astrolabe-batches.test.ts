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
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

test('完整星盘分批补算经真实接口保持三个范围事件及完整提示资料', async (context) => {
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
  };
  const previousFetch = globalThis.fetch;
  let baseCount = 0;
  const scopes = new Set<string>();
  globalThis.fetch = (async (url, init) => {
    const request = new Request(new URL(String(url), 'https://aov.cc'), init);
    const payload = JSON.parse(String(init?.body));
    if (request.url.endsWith('/period-events')) scopes.add(payload.astrolabeScope);
    else {
      baseCount += 1;
      assert.equal(payload.astrolabeIncludePeriodEvents, false);
    }
    return handlePublicApiRequest(request);
  }) as typeof fetch;
  try {
    const resource = await executeReadingAction({ kind: 'calculate', method: 'astrolabe', input });
    const original = await handlePublicApiRequest(
      new Request('https://aov.cc/api/v1/divination/astrolabe/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, gender: '女', responseMode: 'full' }),
      }),
    );
    const body = await original.json();
    assert.equal(body.ok, true);
    assert.equal(baseCount, 1);
    assert.deepEqual([...scopes], ['yearly', 'monthly', 'daily']);
    const actual = resource.structured?.scopeEvidence as {
      contexts: Record<
        string,
        { periodEvents: { events: AstrolabePeriodEvent[] }; promptText: string }
      >;
    };
    for (const scope of scopes) {
      const expected = body.data.result.scopeEvidence.contexts[scope];
      assert.deepEqual(actual.contexts[scope].periodEvents.events, expected.periodEvents.events);
      assert.equal(actual.contexts[scope].promptText, expected.promptText);
      assert.ok(resource.text.includes(expected.promptText));
    }
  } finally {
    globalThis.fetch = previousFetch;
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
  const collection = await fetchAstrolabePeriodCollection({
    scope: 'monthly',
    dateStr: '2028-06',
    periodContext,
    batchDays: DEFAULT_ASTROLABE_PERIOD_BATCH_DAYS,
    fetchBatch: async (input) => {
      const range = input.astrolabePeriodRange as { startDate: string; endDate: string };
      requests.push(`${range.startDate}/${range.endDate}`);
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
  });

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
    houses: Array.from({ length: 12 }, (_, index) => makePoint(`House ${index + 1}`, index * 30)),
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
