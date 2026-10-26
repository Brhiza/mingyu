import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { baziCalculator } from 'mingyu-core/bazi';
import { calculatePublicZiweiFactsForScopes, buildZiweiChartInput } from 'mingyu-core/ziwei';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { analyzeChineseName, analyzeNumber, generateChineseNames } from 'mingyu-core/name-number';
import { buildSerializableZiweiResult } from '../../src/lib/public-api/prompt-builders';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';
import {
  planBaziPromptRequest,
  calculateBaziPromptPlan,
} from '../../src/lib/public-api/natal-request-plan';

const birth = {
  gender: 'female',
  dateType: 'solar',
  year: 1992,
  month: 8,
  day: 21,
  timeIndex: 4,
  timezone: 8,
  useTrueSolarTime: false,
};
const ziweiBirth = { ...birth, year: '1992', month: '8', day: '21' };
const target = { scopeDate: '2026-10-26', scopeHourIndex: 4 };
const question = '请解读所选范围的事业变化。';
const server = createMingyuMcpServer({ preset: 'full', defaultResponseMode: 'full' });
const client = new Client({ name: 'protocol-regressions', version: '1.0.0' });
before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});
after(async () => {
  await client.close();
  await server.close();
});
const clean = (value: unknown): any => JSON.parse(JSON.stringify(value));

async function rest(path: string, input: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  const body = (await response.json()) as any;
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  return body.data;
}
async function mcp(name: string, input: Record<string, unknown>) {
  const value = await client.callTool({ name, arguments: input });
  assert.notEqual(value.isError, true, JSON.stringify(value));
  return clean(value.structuredContent);
}
function scopeSection(prompt: string, heading: string) {
  return prompt.slice(prompt.lastIndexOf(`【${heading}】`)).split(/\n【/)[0];
}
function ziweiFacts(result: any) {
  return {
    basicInfo: result.basicInfo,
    calculationConfig: result.calculationConfig,
    scopeNames: result.scopeNames,
    birthMutagens: result.birthMutagens,
    fourMutagens: result.fourMutagens,
    scopes: Object.fromEntries(
      Object.entries(result.payloadByScope ?? result.activeScopes).map(
        ([scope, value]: [string, any]) => [
          scope,
          {
            active_scope: value.active_scope,
            palaces: value.palaces.map((palace: any) => ({
              index: palace.index,
              name: palace.name,
              is_body_palace: palace.is_body_palace,
              major_stars: palace.major_stars.map((star: any) => ({
                name: star.name,
                brightness: star.brightness,
                birth_mutagen: star.birth_mutagen,
              })),
            })),
          },
        ],
      ),
    ),
  };
}

const culturePromptCases = [
  {
    endpoint: 'name/generate/prompt',
    tool: 'name_generate_prompt',
    factField: 'candidates',
    input: {
      surname: '李',
      gender: '通用',
      givenNameLength: 1,
      generationCharacter: '和',
      generationPosition: 'first',
      limit: 1,
      birth,
      topicId: 'general',
      subtopicId: 'naming',
      scope: 'natal',
    },
    expected: () =>
      generateChineseNames({
        surname: '李',
        gender: '通用',
        givenNameLength: 1,
        generationCharacter: '和',
        generationPosition: 'first',
        limit: 1,
        birth: { ...birth, gender: 'female', dateType: 'solar' },
      }),
  },
  {
    endpoint: 'name/analyze/prompt',
    tool: 'name_analyze_prompt',
    factField: 'analysis',
    input: {
      fullName: '李清和',
      birth,
      question: '适合长期使用吗？',
      topicId: 'general',
      subtopicId: 'name-analysis',
      scope: 'natal',
    },
    expected: () =>
      analyzeChineseName({
        fullName: '李清和',
        birth: { ...birth, gender: 'female', dateType: 'solar' },
      }),
  },
  {
    endpoint: 'number/analyze/prompt',
    tool: 'number_energy_prompt',
    factField: 'analysis',
    input: {
      value: '粤B12345',
      purpose: 'plate',
      question: '适合长期使用吗？',
      topicId: 'general',
      subtopicId: 'number-energy',
      scope: 'custom',
    },
    expected: () => analyzeNumber('粤B12345', 'plate'),
  },
];

test('R09 三个文化提示词入口按显式模式切换且省略及 full 保留真实旧事实', async (t) => {
  for (const item of culturePromptCases) {
    await t.test(item.endpoint, async () => {
      const legacy = await rest(item.endpoint, item.input);
      assert.deepEqual(Object.keys(legacy).sort(), [item.factField, 'prompt', 'selection'].sort());
      assert.deepEqual(legacy[item.factField], clean(item.expected()));
      assert.match(legacy.prompt, /【任务】/);
      const defaultTool = await mcp(item.tool, item.input);
      assert.deepEqual(defaultTool.result[item.factField], legacy[item.factField]);
      assert.equal(defaultTool.result.prompt, legacy.prompt);
      for (const responseMode of ['prompt-only', 'summary', 'full']) {
        const input = { ...item.input, responseMode };
        const http = await rest(item.endpoint, input);
        const response = await client.callTool({ name: item.tool, arguments: input });
        assert.equal(response.isError, undefined, JSON.stringify(response));
        const tool = clean(response.structuredContent);
        assert.equal(http.prompt, legacy.prompt, `${item.endpoint}: ${responseMode}`);
        assert.equal(tool.prompt, http.prompt);
        assert.equal(
          response.content.find((content) => content.type === 'text')?.text,
          tool.prompt,
        );
        if (responseMode === 'prompt-only') {
          assert.deepEqual(http, { prompt: legacy.prompt });
          assert.deepEqual(tool, { prompt: legacy.prompt });
        } else if (responseMode === 'summary') {
          assert.deepEqual(Object.keys(http).sort(), ['prompt', 'resultSummary']);
          assert.deepEqual(
            Object.keys(http.resultSummary).sort(),
            [item.factField, 'selection'].sort(),
          );
          assert.equal(http.resultSummary.selection.subtopicId, item.input.subtopicId);
          assert.deepEqual(http.resultSummary[item.factField], legacy[item.factField]);
          assert.deepEqual(tool.resultSummary[item.factField], http.resultSummary[item.factField]);
          assert.equal(tool.resultSummary.prompt, undefined);
          assert.equal(http.result, undefined);
        } else {
          assert.deepEqual(http.result, legacy);
          assert.deepEqual(http[item.factField], legacy[item.factField]);
          assert.deepEqual(http.selection, legacy.selection);
          assert.deepEqual(
            Object.keys(http).sort(),
            [item.factField, 'prompt', 'result', 'selection'].sort(),
          );
          assert.deepEqual(tool.result[item.factField], http.result[item.factField]);
          assert.equal(tool.result.prompt, http.prompt);
          assert.equal(tool[item.factField], undefined);
          assert.equal(http.resultSummary, undefined);
        }
      }
    });
  }
});

test('R09 文化提示词省略模式在未选主题时仍只返回具名事实与任务书', async () => {
  for (const item of culturePromptCases) {
    const { topicId, subtopicId, scope, ...input } = item.input;
    const legacy = await rest(item.endpoint, input);
    assert.deepEqual(Object.keys(legacy).sort(), [item.factField, 'prompt'].sort());
    assert.deepEqual(legacy[item.factField], clean(item.expected()));
    const full = await rest(item.endpoint, { ...input, responseMode: 'full' });
    assert.deepEqual(full.result, legacy);
    assert.equal(full.selection, undefined);
    const summary = await rest(item.endpoint, { ...input, responseMode: 'summary' });
    assert.equal(summary.resultSummary.selection, undefined);
  }
});

test('R09 三个文化提示词入口一致拒绝非法模式且保留 REST 和 MCP 错误封装', async () => {
  for (const item of culturePromptCases) {
    for (const responseMode of ['invalid', '', null, 1, false, {}, []]) {
      const input = { ...item.input, responseMode };
      const response = await handlePublicApiRequest(
        new Request(`https://example.test/api/v1/${item.endpoint}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      const body = await response.json();
      assert.equal(response.status, 400, item.endpoint);
      assert.equal(body.ok, false);
      assert.equal(body.error.code, 'BAD_REQUEST');
      assert.equal(
        body.error.message,
        'responseMode 必须是以下值之一：summary、full、prompt-only。',
      );
      assert.deepEqual(body.meta, { service: 'example.test', version: 'v1' });
      assert.equal(body.data, undefined);
      const tool = await client.callTool({ name: item.tool, arguments: input });
      assert.equal(tool.isError, true);
      assert.match(JSON.stringify(tool.content), /responseMode/);
    }
  }
});

test('F01 紫微规范 scope 优先，旧字段单独使用与任务书保持一致', async () => {
  for (const [fields, expected] of [
    [{ scope: 'yearly', promptScope: 'origin' }, '流年'],
    [{ scope: 'yearly' }, '流年'],
    [{ promptScope: 'origin' }, '本命'],
    [{ topicId: 'career', promptScope: 'yearly' }, '流年'],
    [{}, '大限'],
  ] as const) {
    const input = {
      ...ziweiBirth,
      ...target,
      question,
      promptMode: 'custom',
      responseMode: 'full',
      ...fields,
    };
    const http = await rest('ziwei/prompt', input);
    const tool = await mcp('ziwei_prompt', input);
    assert.deepEqual(ziweiFacts(http.result), ziweiFacts(tool.result));
    for (const data of [http, tool]) {
      assert.match(scopeSection(data.prompt, '分析背景'), new RegExp(`分析范围：${expected}`));
      if ('scope' in fields || 'topicId' in fields) {
        assert.match(scopeSection(data.prompt, '解读选择'), new RegExp(`分析范围：${expected}`));
      }
      assert.ok(data.prompt.includes(question));
      if (expected === '流年') {
        assert.deepEqual(data.result.scopeNames, ['origin', 'yearly']);
        assert.equal(data.result.fortuneTimeline.targetDateStr, target.scopeDate);
        assert.equal(data.result.fortuneTimeline.targetHourIndex, target.scopeHourIndex);
        assert.match(scopeSection(data.prompt, '分析对象'), /流年/);
        assert.doesNotMatch(scopeSection(data.prompt, '分析背景'), /分析范围：本命/);
      }
    }
  }
});

test('F01 八字日期、旧序号、默认与规范范围冲突共用实际岁运计划', async () => {
  for (const fields of [
    {},
    { baziFortuneScope: 'natal' },
    { baziFortuneScope: 'year', baziFortuneDate: '2026-10-26' },
    { baziFortuneScope: 'year', baziFortuneYear: 2026 },
    { scope: 'yearly', baziFortuneScope: 'natal', baziFortuneDate: '2026-10-26' },
    { topicId: 'career', baziFortuneScope: 'natal' },
  ]) {
    const input = { ...birth, question, responseMode: 'full', ...fields };
    const http = await rest('bazi/prompt', input);
    const tool = await mcp('bazi_prompt', input);
    assert.deepEqual(http.result.pillars, tool.result.pillars);
    assert.deepEqual(http.result.fortuneSelection, tool.result.fortuneSelection);
    if (fields.scope === 'yearly') {
      assert.equal(http.result.fortuneSelection.scope, 'year');
      for (const data of [http, tool]) {
        assert.match(scopeSection(data.prompt, '解读选择'), /分析范围：流年/);
        assert.match(data.prompt, /2026年/);
      }
    }
    if (fields.topicId && fields.baziFortuneScope === 'natal') {
      for (const data of [http, tool])
        assert.match(scopeSection(data.prompt, '解读选择'), /分析范围：本命/);
    }
  }
});

test('F01 历史年份与未知时辰冲突的身份和范围都消费有效计划', async () => {
  const historical = {
    gender: 'male',
    dateType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    scope: 'yearly',
    baziFortuneScope: 'year',
    baziFortuneYear: 1998,
    question,
    responseMode: 'full',
  };
  const legacy = await rest('bazi/prompt', { ...historical, scope: undefined });
  const http = await rest('bazi/prompt', historical);
  const tool = await mcp('bazi_prompt', historical);
  assert.deepEqual(http.result.fortuneSelection, legacy.result.fortuneSelection);
  assert.deepEqual(tool.result.fortuneSelection, legacy.result.fortuneSelection);
  assert.equal(http.result.fortuneSelection.year, 1998);
  const person = {
    gender: 'male' as const,
    isLunar: false,
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
  };
  const pastPlan = planBaziPromptRequest(historical, person, new Date('2200-01-01T00:00:00Z'));
  const past = calculateBaziPromptPlan(person, pastPlan);
  assert.equal(past.fortuneScope, 'year');
  assert.equal(past.fortuneSelectionContext?.year, 1998);
  assert.deepEqual(clean(past.fortuneSelectionContext), legacy.result.fortuneSelection);
  for (const responseMode of ['prompt-only', 'summary', 'full']) {
    const input = {
      ...birth,
      timeIndex: -1,
      scope: 'natal',
      baziFortuneScope: 'dayun',
      question,
      responseMode,
    };
    const http = await rest('bazi/prompt', input);
    const tool = await mcp('bazi_prompt', input);
    assert.deepEqual(http.batch, tool.batch);
    for (const data of [http, tool]) {
      assert.match(scopeSection(data.prompt, '解读选择'), /分析范围：本命/);
      assert.match(data.prompt, /当前时辰候选/);
    }
    if (responseMode === 'full') {
      assert.equal(http.result.calculationIdentity.target.baziFortuneScope, 'natal');
      assert.equal(http.result.calculationIdentity.target.unknownTimeBatch.startIndex, 0);
    }
  }
});

test('F04 真实三体系 omitted=compact，两入口相等且 full 完整保留领域事实', async (t) => {
  const qimenInput = {
    customDate: '2026-10-26T08:23:47+08:00',
    qimenMethod: 'zhuanpan',
    qimenScope: 'hour',
    qimenJuMethod: 'chaibu',
  };
  const expectedBazi = baziCalculator.calculateBazi({ ...birth, isLunar: false });
  const expectedZiwei = buildSerializableZiweiResult(
    await calculatePublicZiweiFactsForScopes(
      buildZiweiChartInput({
        ...ziweiBirth,
        name: '',
        isLeapMonth: false,
        birthHour: '',
        birthMinute: '',
        birthLongitude: '',
        algorithm: 'default',
      }),
      ['origin', 'yearly'],
      {
        horoscopeContext: { dateStr: target.scopeDate, hourIndex: target.scopeHourIndex },
        fortuneRange: {
          scope: 'year',
          dateStr: target.scopeDate,
          hourIndex: target.scopeHourIndex,
        },
      },
    ),
  );
  const expectedQimen = generateQimen(
    new Date(qimenInput.customDate),
    'zhuanpan',
    'hour',
    'chaibu',
  );
  for (const item of [
    {
      system: 'bazi',
      endpoint: 'bazi/calculate',
      tool: 'bazi_calculate',
      input: birth,
      expected: expectedBazi,
    },
    {
      system: 'ziwei',
      endpoint: 'ziwei/calculate',
      tool: 'ziwei_calculate',
      input: { ...ziweiBirth, ...target, promptScope: 'yearly' },
      expected: expectedZiwei,
    },
    {
      system: 'qimen',
      endpoint: 'divination/qimen',
      tool: 'divine_qimen',
      input: qimenInput,
      expected: expectedQimen,
    },
  ]) {
    const results: Record<string, any> = {};
    for (const mode of ['omitted', 'compact', 'full']) {
      const input = { ...item.input, ...(mode === 'omitted' ? {} : { detailMode: mode }) };
      const http = await rest(item.endpoint, input);
      const data = await mcp(item.tool, input);
      const tool =
        item.system === 'ziwei'
          ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'meta'))
          : data.result;
      assert.deepEqual(http, tool, `${item.system} ${mode}`);
      results[mode] = http;
    }
    assert.deepEqual(results.omitted, results.compact);
    assert.deepEqual(results.full, clean(item.expected));
    assert.ok(results.full.evidenceAnalysis || results.full.payloadByScope);
    if (item.system === 'bazi') {
      assert.deepEqual(results.compact.pillars, results.full.pillars);
      assert.deepEqual(results.compact.luckInfo.startInfo, results.full.luckInfo.startInfo);
      assert.deepEqual(
        results.compact.luckInfo.cycles,
        results.full.luckInfo.cycles.map(({ age, year, ganZhi }: any) => ({ age, year, ganZhi })),
      );
      assert.equal(results.compact.liunian, undefined);
      assert.ok(results.full.luckInfo.cycles.some((cycle: any) => cycle.years?.length));
    } else if (item.system === 'ziwei') {
      assert.deepEqual(ziweiFacts(results.compact), ziweiFacts(results.full));
      assert.equal(results.compact.payloadByScope, undefined);
    } else {
      assert.deepEqual(
        results.compact.jiuGongGe,
        results.full.jiuGongGe.map(
          ({ gong, name, direction, element, tianPan, diPan, renPan, shenPan }: any) => ({
            gong,
            name,
            direction,
            element,
            tianPan,
            diPan,
            renPan,
            shenPan,
          }),
        ),
      );
      assert.equal(results.compact.patternComboTotal, results.full.patternCombos.length);
    }
    const compactBytes = Buffer.byteLength(JSON.stringify(results.compact));
    const fullBytes = Buffer.byteLength(JSON.stringify(results.full));
    assert.ok(compactBytes < fullBytes);
    if (item.system === 'ziwei') assert.ok(compactBytes < 20000);
    t.diagnostic(`${item.system}: omitted/compact=${compactBytes} bytes, full=${fullBytes} bytes`);
  }
});

test('F04 compact/full 都保留实际随机轨迹并可跨 REST/MCP 重放', async () => {
  const original = await rest('divination/tarot', {
    spreadType: 'single',
    seed: 'protocol-regression',
    detailMode: 'full',
  });
  const replay = original.meta.random.samples;
  for (const detailMode of ['compact', 'full']) {
    const http = await rest('divination/tarot', { spreadType: 'single', replay, detailMode });
    const tool = await mcp('divine_tarot', { spreadType: 'single', replay, detailMode });
    assert.deepEqual(http.cards, tool.result.cards);
    assert.deepEqual(http.draw, tool.result.draw);
    assert.deepEqual(http.cards, original.cards);
    for (const result of [http, tool.result]) {
      assert.deepEqual(result.meta.random.samples, replay);
      assert.equal(result.meta.resultId, original.meta.resultId);
      assert.equal(result.meta.inputHash, original.meta.inputHash);
      assert.equal(result.meta.random.mode, 'replay');
      assert.equal(typeof result.meta.calculatedAt, 'string');
      assert.equal(typeof result.timestamp, 'number');
    }
  }
});

test('F04 紫微显式分页保留游标与本页唯一年龄年', async () => {
  for (const cursor of [{ scopeBatch: { startIndex: 1 } }, { fortuneBatch: { startIndex: 1 } }]) {
    for (const detailMode of ['compact', 'full']) {
      const input = { ...ziweiBirth, ...target, promptScope: 'full', ...cursor, detailMode };
      const http = await rest('ziwei/calculate', input);
      const tool = await mcp('ziwei_calculate', input);
      assert.deepEqual(http.batch, tool.batch);
      if ('scopeBatch' in cursor) {
        assert.deepEqual(http.scopeNames, ['decadal']);
        assert.equal(http.batch.scopeBatch.endIndexExclusive, 2);
        assert.equal(http.batch.scopeBatch.nextIndex, 2);
      } else {
        assert.equal(http.batch.fortuneBatch.startIndex, 1);
        assert.equal(http.batch.fortuneBatch.endIndexExclusive, 2);
        assert.equal(http.fortuneTimeline.periods.flatMap((period: any) => period.years).length, 1);
        assert.deepEqual(http.fortuneTimeline, tool.fortuneTimeline);
      }
    }
  }
});

test('F03 实际工具保留 replay 类型、八宅输入字段，游标越界不再建议资源重试', async () => {
  for (const name of ['divine_tarot', 'tarot_prompt']) {
    const result = await client.callTool({
      name,
      arguments: {
        spreadType: 'single',
        replay: [0.5],
        ...(name === 'tarot_prompt' ? { question } : {}),
      },
    });
    assert.equal(result.isError, true);
    const error = result.structuredContent as any;
    assert.equal(error.code, 'RANDOM_REPLAY_EXHAUSTED');
    assert.equal(error.category, 'validation');
    assert.equal(error.field, 'replay');
    assert.equal(error.retryable, false);
    assert.deepEqual(JSON.parse((result.content[0] as { text: string }).text), error);
  }
  for (const [input, field] of [
    [
      {
        mingGua: '坎',
        doorToInteriorDegree: 180,
        northReference: 'true',
        magneticDeclinationDegrees: 5,
      },
      'magneticDeclinationDegrees',
    ],
    [{ birthYear: 1992, gender: 'female', sitMountain: '子', birthMinute: 23 }, 'birthHour'],
  ] as const) {
    const value = await client.callTool({ name: 'metaphysics_bazhai', arguments: input });
    assert.equal(value.isError, true);
    const error = value.structuredContent as any;
    assert.equal(error.code, 'INVALID_ARGUMENTS');
    assert.equal(error.category, 'validation');
    assert.equal(error.field, field);
    assert.equal(error.retryable, false);
  }
  for (const [name, input] of [
    [
      'bazi_prompt',
      { ...birth, question, baziFortuneScope: 'full', fortuneBatch: { startIndex: 10000 } },
    ],
    [
      'ziwei_prompt',
      { ...ziweiBirth, question, promptScope: 'full', scopeBatch: { startIndex: 10000 } },
    ],
    [
      'ziwei_calculate',
      { ...ziweiBirth, ...target, promptScope: 'full', fortuneBatch: { startIndex: 10000 } },
    ],
    [
      'ziwei_prompt',
      {
        ...ziweiBirth,
        ...target,
        question,
        promptScope: 'full',
        fortuneBatch: { startIndex: 10000 },
      },
    ],
  ] as const) {
    const value = await client.callTool({ name, arguments: input });
    assert.equal(value.isError, true);
    const error = value.structuredContent as any;
    assert.equal(error.code, 'INVALID_ARGUMENTS');
    assert.equal(error.category, 'validation');
    assert.equal(error.retryable, false);
    assert.match(error.field, /startIndex/);
    assert.match(error.fallback, /游标/);
    assert.doesNotMatch(error.fallback, /缩小日期/);
  }
  const contextError = await client.callTool({
    name: 'bazi_prompt',
    arguments: {
      ...birth,
      timeIndex: -1,
      question,
      unknownTimeBatch: { startIndex: 0, contextKey: 'different-birth' },
    },
  });
  assert.equal(contextError.isError, true);
  const data = contextError.structuredContent as any;
  assert.equal(data.code, 'INVALID_ARGUMENTS');
  assert.equal(data.field, 'unknownTimeBatch.contextKey');
  assert.equal(data.retryable, false);
});
