import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { buildBaziPerson } from '../../mcp/src/tools/bazi';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';
import { formatBaziForPrompt } from '../../packages/core/src/bazi/baziAnalysisFormatter';
import { formatBaziSchoolFacts } from '../../packages/core/src/prompt/bazi-school';
import type { BaziChartResult } from '../../packages/core/src/bazi/baziTypes';
import { BaziCalculator } from '../../packages/core/src/bazi/baziCalculator';
import { discoverUnknownTimeCandidates } from '../../packages/core/src/bazi/baziUnknownTime';

const input = {
  dateType: 'solar',
  gender: 'female',
  year: 2024,
  month: 2,
  day: 4,
  timeIndex: -1,
  baziFortuneScope: 'natal',
  question: '比较出生时辰未确定时的候选盘面。',
};

test('未知时辰仅使用明确的负一索引，HTTP与MCP均拒绝越界或小数', async () => {
  for (const timeIndex of [-2, -0.5, 13]) {
    const invalid = { ...input, timeIndex };
    assert.throws(() => buildBaziPerson({ ...invalid, gender: 'female', dateType: 'solar' }));
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/v1/bazi/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalid),
      }),
    );
    assert.equal(response.status, 400);
  }
});

test('未知时辰合盘在排盘前拒绝，避免展开无效候选计算', async (t) => {
  const calculate = t.mock.method(BaziCalculator.prototype, 'calculateBazi', () => {
    throw new Error('未知时辰合盘不应开始排盘');
  });
  const response = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/bazi/compatibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person1: input, person2: { ...input, timeIndex: 4 } }),
    }),
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /未知时辰.*单盘候选/);
  const server = createMingyuMcpServer();
  const client = new Client({ name: '缺时辰合盘验证', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    for (const name of ['bazi_compatibility', 'bazi_compatibility_prompt']) {
      const result = await client.callTool({
        name,
        arguments: { person1: input, person2: { ...input, timeIndex: 4 } },
      });
      assert.equal(result.isError, true);
      assert.match(JSON.stringify(result), /未知时辰.*单盘候选/);
    }
    assert.equal(calculate.mock.callCount(), 0);
  } finally {
    await client.close();
    await server.close();
  }
});

test('未知时辰合参在首页拒绝，不能发出最终无法完成的跨体系续页游标', async () => {
  for (const [path, extras] of [
    ['bazi-ziwei/prompt', {}],
    ['consultation/thematic/prompt', { methodId: 'bazi-ziwei', scope: 'full', topic: 'career' }],
  ] as const) {
    const response = await handlePublicApiRequest(
      new Request(`https://example.test/api/v1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          ...extras,
          baziFortuneScope: 'full',
          promptScope: 'full',
          scopeDate: '2026-02-10',
          scopeHourIndex: 4,
          combinedBatch: { section: 'bazi-natal', startIndex: 0 },
        }),
      }),
    );
    assert.equal(response.status, 400);
    assert.match(await response.text(), /合参需要明确的出生时辰/);
  }
});

test('未知时辰交节两侧的同一时辰候选贯通 HTTP、MCP 与各流派提示词', async () => {
  const pillarText = (pillars: BaziChartResult['pillars']) =>
    [pillars.year, pillars.month, pillars.day, pillars.hour].map((item) => item.ganZhi).join(' ');
  const expected = new Set(['癸卯 乙丑 戊戌 庚申', '甲辰 丙寅 戊戌 庚申']);
  const pages = new Map<
    string,
    {
      result: BaziChartResult;
      prompt: string;
      cursor: { startIndex: number; contextKey?: string };
    }
  >();
  let cursor: { startIndex: number; contextKey?: string } | undefined;
  do {
    const requestCursor = cursor ?? { startIndex: 0 };
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/v1/bazi/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          responseMode: 'full',
          ...(cursor ? { unknownTimeBatch: cursor } : {}),
        }),
      }),
    );
    const body = (await response.json()) as {
      data: {
        result: BaziChartResult;
        prompt: string;
        batch: {
          unknownTimeBatch: {
            next: { startIndex: number; contextKey: string } | null;
          };
        };
      };
    };
    assert.equal(response.status, 200, JSON.stringify(body));
    const result = body.data.result;
    const scenarios = result.unknownTimeAnalysis!.scenarios;
    assert.equal(scenarios.length, 1);
    const combination = pillarText(scenarios[0]!.pillars);
    if (expected.has(combination)) {
      pages.set(combination, { result, prompt: body.data.prompt, cursor: requestCursor });
    }
    assert.equal(result.isThreePillars, true);
    assert.equal(result.pillars.hour.ganZhi, '');
    assert.equal(result.analysis.mingGe.pattern, '待补时');
    assert.deepEqual(result.luckInfo.cycles, []);
    cursor = body.data.batch.unknownTimeBatch.next ?? undefined;
  } while (cursor);

  assert.deepEqual(new Set(pages.keys()), expected);
  for (const [combination, page] of pages) {
    const scenario = page.result.unknownTimeAnalysis!.scenarios[0]!;
    for (const text of [
      page.prompt,
      formatBaziForPrompt(page.result),
      ...(['ziping', 'mangpai', 'xinpai'] as const).map((school) =>
        formatBaziSchoolFacts(page.result, school),
      ),
    ]) {
      assert.ok(text.includes(combination), `提示词遗漏：${combination}`);
      assert.ok(text.includes(scenario.timeName));
    }
  }

  const server = createMingyuMcpServer();
  const client = new Client({ name: '缺时辰边界验证', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    for (const [combination, page] of pages) {
      const mcp = await client.callTool({
        name: 'bazi_prompt',
        arguments: { ...input, unknownTimeBatch: page.cursor },
      });
      assert.ok(!mcp.isError, JSON.stringify(mcp));
      const data = mcp.structuredContent as { result: BaziChartResult; prompt: string };
      assert.deepEqual(data.result.unknownTimeAnalysis, page.result.unknownTimeAnalysis);
      assert.ok(data.prompt.includes(combination));
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test('HTTP 重复民用日保留两个正午候选的钟表时刻、偏移与续页身份', async () => {
  const person = {
    year: 1969,
    month: 9,
    day: 30,
    gender: 'female' as const,
    timeZoneId: 'Pacific/Kwajalein',
  };
  const request = { ...person, dateType: 'solar', timeIndex: -1 };
  const noon = discoverUnknownTimeCandidates(person).flatMap((candidate, index) =>
    candidate.point.source === 'shichen-representative' &&
    candidate.point.hour === 12 &&
    candidate.point.minute === 0
      ? [{ candidate, index }]
      : [],
  );
  assert.deepEqual(
    noon.map(({ candidate }) => candidate.person.timezone),
    [11, -12],
  );

  const first = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/bazi/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );
  assert.equal(first.status, 200);
  const firstData = (await first.json()) as {
    data: { batch: { unknownTimeBatch: { contextKey: string } } };
  };
  const contextKey = firstData.data.batch.unknownTimeBatch.contextKey;

  for (const { candidate, index } of noon) {
    const timezone = candidate.person.timezone!;
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/v1/bazi/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          question: '比较两个正午候选。',
          responseMode: 'full',
          unknownTimeBatch: { startIndex: index, contextKey },
        }),
      }),
    );
    const body = (await response.json()) as {
      data: {
        result: BaziChartResult;
        prompt: string;
        batch: { unknownTimeBatch: { candidateKey: string; contextKey: string } };
      };
    };
    assert.equal(response.status, 200, JSON.stringify(body));
    const scenario = body.data.result.unknownTimeAnalysis?.scenarios[0];
    assert.ok(scenario);
    assert.equal(scenario.inputClockTime, '12:00:00');
    assert.ok(scenario.timeName.includes(`UTC${timezone >= 0 ? '+' : ''}${timezone}`));
    assert.equal(scenario.scenarioKey, candidate.scenarioKey);
    assert.equal(body.data.batch.unknownTimeBatch.candidateKey, candidate.scenarioKey);
    assert.equal(body.data.batch.unknownTimeBatch.contextKey, contextKey);
    assert.ok(body.data.prompt.includes(scenario.timeName));
    const clock = /^(\d{2}):(\d{2}):(\d{2})$/.exec(scenario.inputClockTime);
    const offset = /UTC([+-]\d+)/.exec(scenario.timeName);
    assert.ok(clock);
    assert.ok(offset);
    assert.equal(
      new Date(
        Date.UTC(1969, 8, 30, Number(clock[1]), Number(clock[2]), Number(clock[3])) -
          Number(offset[1]) * 3_600_000,
      ).toISOString(),
      timezone === 11 ? '1969-09-30T01:00:00.000Z' : '1969-10-01T00:00:00.000Z',
    );
  }
});

test('HTTP 中国夏令时跨标准日期的未知时辰保留输入日期与逐候选实际历日', async () => {
  const request = {
    dateType: 'solar' as const,
    gender: 'female' as const,
    year: 1988,
    month: 5,
    day: 1,
    timeIndex: -1,
    applyChinaDst: true,
    question: '核对候选出生日期。',
  };
  const full = new BaziCalculator().calculateBazi(request);
  assert.deepEqual(full.unknownTimeAnalysis?.uncertainCalendarDates, ['solar', 'lunar']);
  const scenarios = full.unknownTimeAnalysis!.scenarios;
  const noonIndex = scenarios.findIndex(
    (scenario) =>
      scenario.source === 'shichen-representative' && scenario.inputClockTime === '12:00:00',
  );
  assert.ok(noonIndex > 0);
  const firstResponse = await handlePublicApiRequest(
    new Request('https://example.test/api/v1/bazi/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, responseMode: 'full' }),
    }),
  );
  assert.equal(firstResponse.status, 200);
  const first = (await firstResponse.json()) as {
    data: {
      result: BaziChartResult;
      prompt: string;
      batch: { unknownTimeBatch: { contextKey: string } };
    };
  };
  const contextKey = first.data.batch.unknownTimeBatch.contextKey;

  for (const [index, expectedSolar, expectedLunar] of [
    [0, { year: 1988, month: 4, day: 30 }, { monthName: '三月', dayName: '十五' }],
    [noonIndex, { year: 1988, month: 5, day: 1 }, { monthName: '三月', dayName: '十六' }],
  ] as const) {
    let data = first.data;
    if (index !== 0) {
      const response = await handlePublicApiRequest(
        new Request('https://example.test/api/v1/bazi/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...request,
            responseMode: 'full',
            unknownTimeBatch: { startIndex: index, contextKey },
          }),
        }),
      );
      assert.equal(response.status, 200);
      data = ((await response.json()) as typeof first).data;
    }
    const result = data.result;
    const scenario = result.unknownTimeAnalysis!.scenarios[0]!;
    assert.deepEqual(result.unknownTimeAnalysis?.uncertainCalendarDates, ['solar', 'lunar']);
    assert.deepEqual(result.solarDate, { year: 1988, month: 5, day: 1 });
    assert.deepEqual(scenario, scenarios[index]);
    assert.deepEqual(scenario.solarDate, expectedSolar);
    assert.equal(scenario.lunarDate?.monthName, expectedLunar.monthName);
    assert.equal(scenario.lunarDate?.dayName, expectedLunar.dayName);
    assert.match(data.prompt, /输入日期对应公历1988年5月1日，参考农历1988年三月十六/);
    if (index === 0) {
      assert.match(data.prompt, /日初00:00:00候选：排盘历日公历1988年4月30日、农历1988年三月十五/);
    } else {
      assert.match(data.prompt, /午时候选：/);
      assert.doesNotMatch(data.prompt, /午时候选：排盘历日/);
      assert.equal(data.prompt.match(/农历1988年三月十六/g)?.length, 1);
    }
  }
});
