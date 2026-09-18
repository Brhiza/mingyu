import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';
import { baziCalculator } from '../../packages/core/src/bazi/baziCalculator';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei';

const input = {
  name: '公开合参分册样本',
  gender: 'female',
  dateType: 'solar',
  year: 1992,
  month: 8,
  day: 21,
  timeIndex: 4,
  birthHour: 8,
  birthMinute: 23,
  birthSecond: 47,
  promptScope: 'full',
  scopeDate: '2026-02-10',
  scopeHourIndex: 4,
  question: '请解读本次所列资料。',
  responseMode: 'full',
} as const;

async function callApi(
  path: 'bazi-ziwei/prompt' | 'consultation/thematic/prompt',
  overrides: Record<string, unknown>,
) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, ...overrides }),
    }),
  );
  const text = await response.text();
  return {
    status: response.status,
    data: JSON.parse(text) as any,
    bytes: new TextEncoder().encode(text).byteLength,
  };
}

function selectBaziCycleEntry(cycle: any, year: any | null) {
  return {
    cycle: {
      age: cycle.age,
      year: cycle.year,
      ganZhi: cycle.ganZhi,
      isXiaoyun: cycle.isXiaoyun,
      type: cycle.type,
      startSolarTime: cycle.startSolarTime,
      endSolarTime: cycle.endSolarTime,
    },
    year,
  };
}

function getPromptOnlyResponseBytes(response: any) {
  return new TextEncoder().encode(
    JSON.stringify({
      ...response,
      data: {
        batch: response.data.batch,
        prompt: response.data.prompt,
      },
    }),
  ).byteLength;
}

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('完整合参游标按四个分区穷尽资料且固定取盘上下文', async () => {
  const baselineBazi = baziCalculator.calculateBazi({
    gender: input.gender,
    year: input.year,
    month: input.month,
    day: input.day,
    timeIndex: input.timeIndex,
    birthHour: input.birthHour,
    birthMinute: input.birthMinute,
    birthSecond: input.birthSecond,
  });
  const baselineZiwei = await calculateZiweiChart(
    buildZiweiChartInput({
      name: input.name,
      gender: input.gender,
      dateType: input.dateType,
      year: String(input.year),
      month: String(input.month),
      day: String(input.day),
      timeIndex: '',
      birthHour: String(input.birthHour),
      birthMinute: String(input.birthMinute),
      birthSecond: String(input.birthSecond),
      isLeapMonth: false,
    }),
    {
      scopes: [],
      horoscopeContext: { dateStr: input.scopeDate, hourIndex: input.scopeHourIndex },
      fortuneRange: {
        scope: 'all',
        dateStr: input.scopeDate,
        hourIndex: input.scopeHourIndex,
      },
    },
  );
  const baselineBaziEntries = baselineBazi.luckInfo.cycles.flatMap((cycle: any) =>
    cycle.years.length
      ? cycle.years.map((year: any) => selectBaziCycleEntry(cycle, year))
      : [selectBaziCycleEntry(cycle, null)],
  );
  assert.ok(baselineZiwei.fortuneTimeline);
  const baselineZiweiYears = baselineZiwei.fortuneTimeline.periods.flatMap((period: any) =>
    period.years.map((year: any) => ({
      age: year.age,
      year: year.year,
      dateStr: year.dateStr,
      endDateStr: year.endDateStr,
      label: year.label,
      ganZhi: year.ganZhi,
    })),
  );
  const natal = await callApi('bazi-ziwei/prompt', { combinedBatch: {} });
  assert.equal(natal.status, 200, JSON.stringify(natal.data));
  assert.deepEqual(natal.data.data.batch.combinedBatch.next, {
    section: 'bazi-fortune',
    startIndex: 0,
  });
  assert.deepEqual(natal.data.data.batch.combinedBatch.scopeContext, {
    dateStr: input.scopeDate,
    hourIndex: input.scopeHourIndex,
  });
  assert.ok(natal.data.data.result.bazi);
  assert.equal(natal.data.data.result.ziwei, undefined);
  assert.deepEqual(natal.data.data.result.bazi.luckInfo.cycles, []);
  assert.deepEqual(natal.data.data.result.bazi.liunian, []);
  assert.doesNotMatch(natal.data.data.prompt, /【紫微盘面/);

  let cursor = natal.data.data.batch.combinedBatch.next;
  const baziEntries: ReturnType<typeof selectBaziCycleEntry>[] = [];
  const baziFullPages: Array<{ startIndex: number; cycle: any; liunian: any[] }> = [];
  const ziweiScopes: string[] = [];
  const ziweiYears: Array<{
    age: number;
    year: number;
    dateStr: string;
    endDateStr?: string;
    label: string;
    ganZhi: string;
  }> = [];
  const pageBytes = [natal.bytes];
  const promptOnlyPageBytes = [getPromptOnlyResponseBytes(natal.data)];
  let guard = 0;
  while (cursor) {
    guard += 1;
    assert.ok(guard < 300, '合参续取必须在有限页内结束');
    const page = await callApi('bazi-ziwei/prompt', { combinedBatch: cursor });
    assert.equal(page.status, 200, JSON.stringify(page.data));
    pageBytes.push(page.bytes);
    promptOnlyPageBytes.push(getPromptOnlyResponseBytes(page.data));
    const batch = page.data.data.batch.combinedBatch;
    assert.equal(batch.section, cursor.section);
    assert.equal(batch.startIndex, cursor.startIndex);
    assert.deepEqual(batch.scopeContext, {
      dateStr: input.scopeDate,
      hourIndex: input.scopeHourIndex,
    });
    if (cursor.section === 'bazi-fortune') {
      assert.ok(page.data.data.result.bazi);
      assert.equal(page.data.data.result.ziwei, undefined);
      const cycle = page.data.data.result.bazi.luckInfo.cycles[0];
      assert.ok(cycle);
      assert.ok(cycle.years.length <= 1);
      baziEntries.push(selectBaziCycleEntry(cycle, cycle.years[0] ?? null));
      assert.deepEqual(page.data.data.result.bazi.liunian, cycle.years);
      baziFullPages.push({
        startIndex: cursor.startIndex,
        cycle,
        liunian: page.data.data.result.bazi.liunian,
      });
      assert.doesNotMatch(page.data.data.prompt, /【紫微盘面/);
    } else {
      assert.ok(page.data.data.result.ziwei);
      assert.equal(page.data.data.result.bazi, undefined);
      assert.doesNotMatch(page.data.data.prompt, /【八字排盘信息】|【排盘信息】[\s\S]*四柱/);
      if (cursor.section === 'ziwei-scope') {
        ziweiScopes.push(...page.data.data.result.ziwei.scopeNames);
      } else {
        ziweiYears.push(
          ...page.data.data.result.ziwei.fortuneTimeline.periods.flatMap((period: any) =>
            period.years.map((year: any) => ({
              age: year.age,
              year: year.year,
              dateStr: year.dateStr,
              endDateStr: year.endDateStr,
              label: year.label,
              ganZhi: year.ganZhi,
            })),
          ),
        );
      }
    }
    cursor = batch.next;
  }

  assert.deepEqual(baziEntries, baselineBaziEntries);
  assert.deepEqual(ziweiScopes, ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly']);
  assert.ok(
    baziEntries.some(
      (item, index) =>
        index > 0 &&
        item.year?.year === baziEntries[index - 1]?.year?.year &&
        item.cycle.ganZhi !== baziEntries[index - 1]?.cycle.ganZhi,
    ),
    '交运年应在相邻大运页分别保留',
  );
  assert.deepEqual(ziweiYears, baselineZiweiYears);

  const handoverPageIndex = baziFullPages.findIndex(
    (page, index) =>
      index > 0 &&
      page.cycle.years[0]?.year === baziFullPages[index - 1]?.cycle.years[0]?.year &&
      page.cycle.ganZhi !== baziFullPages[index - 1]?.cycle.ganZhi,
  );
  assert.ok(handoverPageIndex > 0, '测试盘应找到交运同年的前后两页');
  for (const fullPage of baziFullPages.slice(handoverPageIndex - 1, handoverPageIndex + 1)) {
    for (const [path, extras] of [
      ['bazi-ziwei/prompt', {}],
      ['consultation/thematic/prompt', { methodId: 'bazi-ziwei', scope: 'full', topic: 'career' }],
    ] as const) {
      const summary = await callApi(path, {
        ...extras,
        responseMode: 'summary',
        combinedBatch: { section: 'bazi-fortune', startIndex: fullPage.startIndex },
      });
      assert.equal(summary.status, 200, JSON.stringify(summary.data));
      const summaryBazi = summary.data.data.resultSummary.bazi;
      assert.deepEqual(summaryBazi.luckInfo.cycles[0].years, fullPage.cycle.years);
      assert.deepEqual(summaryBazi.luckInfo.cycles[0].resolvedYears, fullPage.cycle.resolvedYears);
      assert.deepEqual(summaryBazi.liunian, fullPage.liunian);
    }
  }
  const natalSummary = await callApi('bazi-ziwei/prompt', {
    responseMode: 'summary',
    combinedBatch: { section: 'bazi-natal', startIndex: 0 },
  });
  assert.equal(natalSummary.status, 200, JSON.stringify(natalSummary.data));
  assert.deepEqual(natalSummary.data.data.resultSummary.bazi.luckInfo.cycles, []);
  assert.deepEqual(natalSummary.data.data.resultSummary.bazi.liunian, []);

  assert.ok(Math.max(...pageBytes) < 512 * 1024, `单页响应过大：${Math.max(...pageBytes)}`);
  assert.ok(
    Math.max(...promptOnlyPageBytes) < 128 * 1024,
    `默认 prompt-only 响应过大：${Math.max(...promptOnlyPageBytes)}`,
  );
});

test('完整合参分页拒绝冲突、非完整范围与越界游标，旧入口保持双盘结果', async () => {
  for (const overrides of [
    { promptScope: 'decadal', combinedBatch: {} },
    { combinedBatch: {}, scopeBatch: {} },
    { combinedBatch: {}, fortuneBatch: {} },
    { combinedBatch: { limit: 2 } },
    { combinedBatch: { section: 'bazi-natal', startIndex: 1 } },
    { combinedBatch: { section: 'ziwei-scope', startIndex: 6 } },
    { combinedBatch: { section: 'ziwei-fortune', startIndex: 10000 } },
  ]) {
    const response = await callApi('bazi-ziwei/prompt', overrides);
    assert.equal(response.status, 400, JSON.stringify(response.data));
    assert.match(JSON.stringify(response.data), /combinedBatch|续取|startIndex|资料范围|分页起点/);
  }

  const legacy = await callApi('bazi-ziwei/prompt', { responseMode: 'summary' });
  assert.equal(legacy.status, 200, JSON.stringify(legacy.data));
  assert.equal(legacy.data.data.batch, undefined);
  assert.ok(legacy.data.data.resultSummary.bazi);
  assert.ok(legacy.data.data.resultSummary.ziwei);

  const invalidMcp = await client.callTool({
    name: 'bazi_ziwei_prompt',
    arguments: { ...input, combinedBatch: { limit: 2 } },
  });
  assert.equal(invalidMcp.isError, true, JSON.stringify(invalidMcp));
  assert.match(JSON.stringify(invalidMcp), /limit|unrecognized|不支持|无法识别/i);
});

test('合参分册单页只调用当前体系的排盘入口', async (context) => {
  const require = createRequire(import.meta.url);
  const astroModule = require('iztro/lib/astro/astro') as {
    withOptions: (...args: any[]) => unknown;
  };
  const originalBazi = baziCalculator.calculateBazi.bind(baziCalculator);
  const originalBaziBatch = baziCalculator.calculateBaziBatch.bind(baziCalculator);
  const originalWithOptions = astroModule.withOptions;
  let baziCalls = 0;
  let baziBatchCalls = 0;
  let ziweiCalls = 0;
  context.mock.method(
    baziCalculator,
    'calculateBazi',
    (...args: Parameters<typeof originalBazi>) => {
      baziCalls += 1;
      return originalBazi(...args);
    },
  );
  context.mock.method(
    baziCalculator,
    'calculateBaziBatch',
    (...args: Parameters<typeof originalBaziBatch>) => {
      baziBatchCalls += 1;
      return originalBaziBatch(...args);
    },
  );
  context.mock.method(
    astroModule,
    'withOptions',
    (...args: Parameters<typeof originalWithOptions>) => {
      ziweiCalls += 1;
      return originalWithOptions(...args);
    },
  );

  const baziPage = await callApi('bazi-ziwei/prompt', {
    combinedBatch: { section: 'bazi-natal', startIndex: 0 },
  });
  assert.equal(baziPage.status, 200, JSON.stringify(baziPage.data));
  assert.equal(baziCalls, 0);
  assert.equal(baziBatchCalls, 1);
  assert.equal(ziweiCalls, 0);

  baziCalls = 0;
  baziBatchCalls = 0;
  ziweiCalls = 0;
  const baziFortunePage = await callApi('bazi-ziwei/prompt', {
    combinedBatch: { section: 'bazi-fortune', startIndex: 0 },
  });
  assert.equal(baziFortunePage.status, 200, JSON.stringify(baziFortunePage.data));
  assert.equal(baziCalls, 0);
  assert.equal(baziBatchCalls, 1);
  assert.equal(ziweiCalls, 0);

  baziCalls = 0;
  baziBatchCalls = 0;
  ziweiCalls = 0;
  const ziweiPage = await callApi('bazi-ziwei/prompt', {
    combinedBatch: { section: 'ziwei-scope', startIndex: 0 },
  });
  assert.equal(ziweiPage.status, 200, JSON.stringify(ziweiPage.data));
  assert.equal(baziCalls, 0);
  assert.equal(baziBatchCalls, 0);
  assert.equal(ziweiCalls, 1);

  baziCalls = 0;
  baziBatchCalls = 0;
  ziweiCalls = 0;
  const ziweiFortunePage = await callApi('bazi-ziwei/prompt', {
    combinedBatch: { section: 'ziwei-fortune', startIndex: 0 },
  });
  assert.equal(ziweiFortunePage.status, 200, JSON.stringify(ziweiFortunePage.data));
  assert.equal(baziCalls, 0);
  assert.equal(baziBatchCalls, 0);
  assert.equal(ziweiCalls, 1);
});

const server = createMingyuMcpServer();
const client = new Client({ name: '合参分册测试', version: '1.0.0' });

before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

after(async () => {
  await client.close();
  await server.close();
});

test('HTTP、普通 MCP 与主题 MCP 共用合参分区游标和单体系结果', async () => {
  const cursor = { section: 'ziwei-scope' as const, startIndex: 1 };
  const http = await callApi('bazi-ziwei/prompt', { combinedBatch: cursor });
  assert.equal(http.status, 200, JSON.stringify(http.data));

  const mcp = await client.callTool({
    name: 'bazi_ziwei_prompt',
    arguments: { ...input, combinedBatch: cursor },
  });
  assert.ok(!mcp.isError, JSON.stringify(mcp));
  const mcpData = mcp.structuredContent as any;
  assert.deepEqual(mcpData.batch, http.data.data.batch);
  assert.deepEqual(jsonValue(mcpData.result.ziwei), http.data.data.result.ziwei);
  assert.deepEqual(mcpData.result.ziwei.scopeNames, ['decadal']);
  assert.equal(mcpData.result.bazi, undefined);

  const thematicHttp = await callApi('consultation/thematic/prompt', {
    methodId: 'bazi-ziwei',
    scope: 'full',
    topic: 'career',
    combinedBatch: { section: 'bazi-natal', startIndex: 0 },
  });
  assert.equal(thematicHttp.status, 200, JSON.stringify(thematicHttp.data));
  assert.ok(thematicHttp.data.data.result.bazi);
  assert.equal(thematicHttp.data.data.result.ziwei, undefined);

  const thematicMcp = await client.callTool({
    name: 'thematic_consultation_prompt',
    arguments: {
      ...input,
      methodId: 'bazi-ziwei',
      scope: 'full',
      topic: 'career',
      combinedBatch: { section: 'bazi-natal', startIndex: 0 },
    },
  });
  assert.ok(!thematicMcp.isError, JSON.stringify(thematicMcp));
  const thematicMcpData = thematicMcp.structuredContent as any;
  assert.deepEqual(thematicMcpData.batch, thematicHttp.data.data.batch);
  assert.deepEqual(jsonValue(thematicMcpData.result.bazi), thematicHttp.data.data.result.bazi);
  assert.ok(thematicMcpData.result.bazi);
  assert.equal(thematicMcpData.result.ziwei, undefined);
});
