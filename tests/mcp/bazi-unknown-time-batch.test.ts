import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { baziCalculator } from '../../packages/core/src/bazi/baziCalculator';
import type { Person } from '../../packages/core/src/bazi/baziTypes';
import { buildBaziPerson, registerBaziTool } from '../../mcp/src/tools/bazi';
import { registerBaziZiweiTool } from '../../mcp/src/tools/bazi-ziwei';
import { registerThematicTool } from '../../mcp/src/tools/thematic';

type RegisteredTool = {
  inputSchema: {
    safeParse(
      value: unknown,
    ): { success: true; data: Record<string, unknown> } | { success: false; error: unknown };
  };
  handler(args: Record<string, unknown>): Promise<{
    isError?: boolean;
    structuredContent?: Record<string, any>;
    content?: Array<{ type: string; text: string }>;
  }>;
};

function getRegisteredTools(register: (server: McpServer) => void) {
  const server = new McpServer({ name: 'bazi-unknown-time-batch-test', version: '1.0.0' });
  register(server);
  return (server as unknown as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
}

function parseToolInput(tool: RegisteredTool, input: Record<string, unknown>) {
  const parsed = tool.inputSchema.safeParse(input);
  assert.equal(parsed.success, true, JSON.stringify(parsed.success ? null : parsed.error));
  if (!parsed.success) throw new Error('MCP 输入未通过 schema。');
  return parsed.data;
}

const UNKNOWN_INPUT = {
  dateType: 'solar',
  year: 2024,
  month: 2,
  day: 4,
  gender: 'female',
} as const;

const KNOWN_INPUT = {
  ...UNKNOWN_INPUT,
  timeIndex: 1,
} as const;

test('八字 MCP 未知时辰逐页穷尽候选并与完整本地结果逐项一致', async () => {
  const tools = getRegisteredTools(registerBaziTool);
  const calculate = tools.bazi_calculate!;
  const full = baziCalculator.calculateBazi(buildBaziPerson(UNKNOWN_INPUT));
  const expectedScenarios = full.unknownTimeAnalysis?.scenarios ?? [];
  assert.ok(expectedScenarios.length > 1);

  const actualScenarios: unknown[] = [];
  let cursor: { startIndex: number; contextKey?: string } | undefined;
  let contextKey: string | undefined;
  for (let index = 0; index < expectedScenarios.length; index += 1) {
    const result = await calculate.handler(
      parseToolInput(calculate, {
        ...UNKNOWN_INPUT,
        detailMode: 'compact',
        ...(cursor ? { unknownTimeBatch: cursor } : {}),
      }),
    );
    assert.equal(result.isError, undefined, JSON.stringify(result.structuredContent));
    const chart = result.structuredContent?.result;
    const batch = result.structuredContent?.batch?.unknownTimeBatch;
    assert.equal(chart.unknownTimeAnalysis.scenarios.length, 1);
    assert.equal(chart.evidenceAnalysis, undefined, 'compact 仍应只省略证据过程');
    assert.deepEqual(
      chart.unknownTimeAnalysis.uncertainPillars,
      full.unknownTimeAnalysis?.uncertainPillars,
    );
    assert.deepEqual(chart.unknownTimeAnalysis.scenarios[0], expectedScenarios[index]);
    assert.equal(batch.unit, 'candidate');
    assert.equal(batch.startIndex, index);
    assert.equal(batch.endIndexExclusive, index + 1);
    assert.equal(batch.totalCandidates, expectedScenarios.length);
    assert.equal(batch.candidateKey, expectedScenarios[index]?.scenarioKey);
    assert.deepEqual(chart.unknownTimeAnalysis.batch, batch);
    contextKey ??= batch.contextKey;
    assert.equal(batch.contextKey, contextKey);
    actualScenarios.push(chart.unknownTimeAnalysis.scenarios[0]);
    cursor = batch.next ?? undefined;
  }

  assert.equal(cursor, undefined);
  assert.deepEqual(actualScenarios, expectedScenarios);

  const emptyCursorInput = parseToolInput(calculate, {
    ...UNKNOWN_INPUT,
    unknownTimeBatch: {},
  });
  assert.deepEqual(emptyCursorInput.unknownTimeBatch, { startIndex: 0 });
  const emptyCursor = await calculate.handler(emptyCursorInput);
  assert.equal(emptyCursor.isError, undefined);
  assert.deepEqual(
    emptyCursor.structuredContent?.result.unknownTimeAnalysis.scenarios[0],
    expectedScenarios[0],
  );
  assert.equal(emptyCursor.structuredContent?.batch.unknownTimeBatch.startIndex, 0);
  assert.equal(emptyCursor.structuredContent?.batch.unknownTimeBatch.contextKey, contextKey);

  const outOfRange = await calculate.handler(
    parseToolInput(calculate, {
      ...UNKNOWN_INPUT,
      unknownTimeBatch: { startIndex: expectedScenarios.length, contextKey },
    }),
  );
  assert.equal(outOfRange.isError, true);
  assert.match(String(outOfRange.structuredContent?.error), /startIndex 超出资料范围/);
});

test('MCP 标准时间入口保留地点时区与历史夏令时，候选身份和直接 Person 一致', async () => {
  const zonedPerson = buildBaziPerson({
    ...UNKNOWN_INPUT,
    birthPlace: '东京',
    timezone: 9,
    timeZoneId: 'Asia/Tokyo',
    applyChinaDst: false,
  });
  assert.equal(zonedPerson.birthPlace, '东京');
  assert.equal(zonedPerson.timezone, 9);
  assert.equal(zonedPerson.timeZoneId, 'Asia/Tokyo');
  assert.equal(zonedPerson.applyChinaDst, false);

  const dstInput = {
    dateType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    gender: 'female' as const,
    birthPlace: '北京市',
    timezone: 8,
    applyChinaDst: true,
  };
  const directPerson: Person = {
    year: dstInput.year,
    month: dstInput.month,
    day: dstInput.day,
    gender: dstInput.gender,
    timeIndex: 6,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
    isThreePillars: true,
    birthPlace: dstInput.birthPlace,
    timezone: dstInput.timezone,
    applyChinaDst: dstInput.applyChinaDst,
  };
  const direct = baziCalculator.calculateBaziUnknownTimeBatch(directPerson, { startIndex: 0 });
  const tools = getRegisteredTools(registerBaziTool);
  const calculate = tools.bazi_calculate!;
  const mcp = await calculate.handler(parseToolInput(calculate, dstInput));
  assert.equal(mcp.isError, undefined, JSON.stringify(mcp.structuredContent));
  assert.equal(mcp.structuredContent?.batch.unknownTimeBatch.contextKey, direct.batch.contextKey);
  assert.ok(
    mcp.structuredContent?.result.warnings.some((warning: string) =>
      warning.includes('中国夏令时期间'),
    ),
  );
});

test('八字 MCP 默认与显式续取都只计算单个未知候选，提示词复用本页结果', async () => {
  const tools = getRegisteredTools(registerBaziTool);
  const calculate = tools.bazi_calculate!;
  const prompt = tools.bazi_prompt!;
  const originalFull = baziCalculator.calculateBazi;
  const originalBatch = baziCalculator.calculateBaziUnknownTimeBatch;
  let fullCalls = 0;
  let batchCalls = 0;
  baziCalculator.calculateBazi = function (...args: Parameters<typeof originalFull>) {
    fullCalls += 1;
    return originalFull.apply(this, args);
  };
  baziCalculator.calculateBaziUnknownTimeBatch = function (
    ...args: Parameters<typeof originalBatch>
  ) {
    batchCalls += 1;
    return originalBatch.apply(this, args);
  };

  try {
    const first = await calculate.handler(parseToolInput(calculate, UNKNOWN_INPUT));
    assert.equal(first.isError, undefined);
    assert.equal(batchCalls, 1);
    assert.equal(fullCalls, 0);
    const firstBatch = first.structuredContent?.batch?.unknownTimeBatch;
    const firstScenario = first.structuredContent?.result.unknownTimeAnalysis.scenarios[0];

    const second = await prompt.handler(
      parseToolInput(prompt, {
        ...UNKNOWN_INPUT,
        question: '请比较当前未知时辰候选。',
        unknownTimeBatch: firstBatch.next,
      }),
    );
    assert.equal(second.isError, undefined, JSON.stringify(second.structuredContent));
    assert.equal(batchCalls, 2);
    assert.equal(fullCalls, 0);
    const secondBatch = second.structuredContent?.batch?.unknownTimeBatch;
    const secondScenario = second.structuredContent?.result.unknownTimeAnalysis.scenarios[0];
    const promptText = String(second.structuredContent?.prompt);
    assert.equal(secondBatch.startIndex, 1);
    assert.equal(second.structuredContent?.result.unknownTimeAnalysis.scenarios.length, 1);
    assert.match(promptText, new RegExp(secondScenario.timeName));
    assert.doesNotMatch(promptText, new RegExp(firstScenario.timeName));
    assert.match(promptText, /出生时辰待补充/);
  } finally {
    baziCalculator.calculateBazi = originalFull;
    baziCalculator.calculateBaziUnknownTimeBatch = originalBatch;
  }
});

test('八字 MCP 未知候选游标、已知时辰和岁运参数在排盘前严格校验', async () => {
  const tools = getRegisteredTools(registerBaziTool);
  const calculate = tools.bazi_calculate!;
  const prompt = tools.bazi_prompt!;

  const limitInput = calculate.inputSchema.safeParse({
    ...UNKNOWN_INPUT,
    unknownTimeBatch: { startIndex: 0, limit: 1 },
  });
  assert.equal(limitInput.success, false, 'unknownTimeBatch 不接受 limit 字段');

  const originalFull = baziCalculator.calculateBazi;
  const originalBatch = baziCalculator.calculateBaziUnknownTimeBatch;
  let fullCalls = 0;
  let batchCalls = 0;
  baziCalculator.calculateBazi = function (...args: Parameters<typeof originalFull>) {
    fullCalls += 1;
    return originalFull.apply(this, args);
  };
  baziCalculator.calculateBaziUnknownTimeBatch = function (
    ...args: Parameters<typeof originalBatch>
  ) {
    batchCalls += 1;
    return originalBatch.apply(this, args);
  };

  try {
    const known = await calculate.handler(
      parseToolInput(calculate, {
        ...KNOWN_INPUT,
        unknownTimeBatch: { startIndex: 0 },
      }),
    );
    assert.equal(known.isError, true);
    assert.match(String(known.structuredContent?.error), /仅适用于出生时辰未知/);

    const fortune = await prompt.handler(
      parseToolInput(prompt, {
        ...UNKNOWN_INPUT,
        question: '请看岁运。',
        baziFortuneScope: 'full',
        fortuneBatch: { startIndex: 0 },
      }),
    );
    assert.equal(fortune.isError, true);
    assert.match(String(fortune.structuredContent?.error), /不能使用 fortuneBatch/);

    const nonNatal = await prompt.handler(
      parseToolInput(prompt, {
        ...UNKNOWN_INPUT,
        question: '请看流年。',
        baziFortuneScope: 'year',
        baziFortuneYear: 2026,
      }),
    );
    assert.equal(nonNatal.isError, true);
    assert.match(String(nonNatal.structuredContent?.error), /补齐出生时分后才能选择岁运/);
    assert.equal(fullCalls, 0);
    assert.equal(batchCalls, 0, '参数错误必须在候选排盘前拒绝');
  } finally {
    baziCalculator.calculateBazi = originalFull;
    baziCalculator.calculateBaziUnknownTimeBatch = originalBatch;
  }

  const invalidContext = await calculate.handler(
    parseToolInput(calculate, {
      ...UNKNOWN_INPUT,
      unknownTimeBatch: { startIndex: 1, contextKey: 'bazi:unknown-time:v1:wrong' },
    }),
  );
  assert.equal(invalidContext.isError, true);
  assert.match(String(invalidContext.structuredContent?.error), /contextKey 与当前出生资料不一致/);
});

test('真实 MCP client 拒绝八字单盘不支持的其它分页与范围字段且不启动计算', async (t) => {
  const full = t.mock.method(baziCalculator, 'calculateBazi', () => {
    throw new Error('非法单盘分页参数不应启动完整计算');
  });
  const fortuneBatch = t.mock.method(baziCalculator, 'calculateBaziBatch', () => {
    throw new Error('非法单盘分页参数不应启动命限分页计算');
  });
  const unknownBatch = t.mock.method(baziCalculator, 'calculateBaziUnknownTimeBatch', () => {
    throw new Error('非法单盘分页参数不应启动候选分页计算');
  });
  const server = new McpServer({ name: 'bazi-conflicting-batch-test', version: '1.0.0' });
  registerBaziTool(server);
  const client = new Client({ name: 'bazi-conflicting-batch-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const conflicts = [
      ['scopeBatch', { startIndex: 0 }],
      ['combinedBatch', { section: 'bazi-natal', startIndex: 0 }],
      ['rangeBatch', { startIndex: 0 }],
      ['birthTimeRange', { startTimestamp: 0, endTimestamp: 1 }],
    ] as const;
    for (const [name, value] of conflicts) {
      for (const toolName of ['bazi_calculate', 'bazi_prompt']) {
        const result = await client.callTool({
          name: toolName,
          arguments: {
            ...UNKNOWN_INPUT,
            ...(toolName === 'bazi_prompt' ? { question: '请解读。' } : {}),
            [name]: value,
          },
        });
        assert.equal(result.isError, true, `${toolName} 应拒绝 ${name}`);
      }
    }
    const fortuneOnCalculate = await client.callTool({
      name: 'bazi_calculate',
      arguments: { ...UNKNOWN_INPUT, fortuneBatch: { startIndex: 0 } },
    });
    assert.equal(fortuneOnCalculate.isError, true, 'bazi_calculate 应拒绝 fortuneBatch');
    assert.equal(full.mock.callCount(), 0);
    assert.equal(fortuneBatch.mock.callCount(), 0);
    assert.equal(unknownBatch.mock.callCount(), 0);
  } finally {
    await client.close();
    await server.close();
  }
});

test('八字合盘显式拒绝 unknownTimeBatch，不把单盘游标静默忽略', async () => {
  const tools = getRegisteredTools(registerBaziTool);
  for (const name of ['bazi_compatibility', 'bazi_compatibility_prompt'] as const) {
    const tool = tools[name]!;
    const result = await tool.handler(
      parseToolInput(tool, {
        person1: { ...KNOWN_INPUT, unknownTimeBatch: { startIndex: 0 } },
        person2: { ...KNOWN_INPUT, year: 2023 },
        ...(name.endsWith('_prompt') ? { question: '请看双方关系。' } : {}),
      }),
    );
    assert.equal(result.isError, true);
    assert.match(String(result.structuredContent?.error), /仅支持八字单盘工具/);
  }
});

test('主题 MCP 的纯八字未知单盘共用候选分页，紫微与合参拒绝该游标', async () => {
  const tools = getRegisteredTools(registerThematicTool);
  const thematic = tools.thematic_consultation_prompt!;
  const first = await thematic.handler(
    parseToolInput(thematic, {
      ...UNKNOWN_INPUT,
      system: 'bazi',
      question: '请解读当前候选。',
    }),
  );
  assert.equal(first.isError, undefined, JSON.stringify(first.structuredContent));
  assert.equal(first.structuredContent?.result.bazi.unknownTimeAnalysis.scenarios.length, 1);
  assert.equal(first.structuredContent?.result.scope, '本命盘');
  const firstBatch = first.structuredContent?.batch?.unknownTimeBatch;
  assert.equal(firstBatch.startIndex, 0);

  const second = await thematic.handler(
    parseToolInput(thematic, {
      ...UNKNOWN_INPUT,
      system: 'bazi',
      promptScope: 'origin',
      question: '请解读下一候选。',
      unknownTimeBatch: firstBatch.next,
    }),
  );
  assert.equal(second.isError, undefined, JSON.stringify(second.structuredContent));
  assert.equal(second.structuredContent?.batch?.unknownTimeBatch.startIndex, 1);
  assert.equal(second.structuredContent?.result.bazi.unknownTimeAnalysis.scenarios.length, 1);

  const nonNatal = await thematic.handler(
    parseToolInput(thematic, {
      ...UNKNOWN_INPUT,
      system: 'bazi',
      promptScope: 'yearly',
      question: '请看流年。',
    }),
  );
  assert.equal(nonNatal.isError, true);
  assert.match(String(nonNatal.structuredContent?.error), /补齐出生时分后才能选择岁运/);

  const originalFull = baziCalculator.calculateBazi;
  const originalFortuneBatch = baziCalculator.calculateBaziBatch;
  const originalUnknownBatch = baziCalculator.calculateBaziUnknownTimeBatch;
  let calculationCalls = 0;
  baziCalculator.calculateBazi = function (...args: Parameters<typeof originalFull>) {
    calculationCalls += 1;
    return originalFull.apply(this, args);
  };
  baziCalculator.calculateBaziBatch = function (...args: Parameters<typeof originalFortuneBatch>) {
    calculationCalls += 1;
    return originalFortuneBatch.apply(this, args);
  };
  baziCalculator.calculateBaziUnknownTimeBatch = function (
    ...args: Parameters<typeof originalUnknownBatch>
  ) {
    calculationCalls += 1;
    return originalUnknownBatch.apply(this, args);
  };
  try {
    const unknownCombined = await thematic.handler(
      parseToolInput(thematic, {
        ...UNKNOWN_INPUT,
        system: 'bazi_ziwei',
        question: '请合参。',
      }),
    );
    assert.equal(unknownCombined.isError, true);
    assert.match(String(unknownCombined.structuredContent?.error), /需要明确的出生时辰/);
    assert.equal(calculationCalls, 0, '未知合参必须在八字排盘前拒绝');
  } finally {
    baziCalculator.calculateBazi = originalFull;
    baziCalculator.calculateBaziBatch = originalFortuneBatch;
    baziCalculator.calculateBaziUnknownTimeBatch = originalUnknownBatch;
  }

  for (const system of ['ziwei', 'bazi_ziwei'] as const) {
    const rejected = await thematic.handler(
      parseToolInput(thematic, {
        ...KNOWN_INPUT,
        system,
        question: '请解读。',
        unknownTimeBatch: { startIndex: 0 },
      }),
    );
    assert.equal(rejected.isError, true);
    assert.match(String(rejected.structuredContent?.error), /仅支持八字单盘/);
  }
});

test('八字紫微合参 MCP 对未知时辰和单盘游标都在排盘前拒绝', async () => {
  const tools = getRegisteredTools(registerBaziZiweiTool);
  const combined = tools.bazi_ziwei_prompt!;
  const originalFull = baziCalculator.calculateBazi;
  const originalFortuneBatch = baziCalculator.calculateBaziBatch;
  const originalUnknownBatch = baziCalculator.calculateBaziUnknownTimeBatch;
  let calculationCalls = 0;
  baziCalculator.calculateBazi = function (...args: Parameters<typeof originalFull>) {
    calculationCalls += 1;
    return originalFull.apply(this, args);
  };
  baziCalculator.calculateBaziBatch = function (...args: Parameters<typeof originalFortuneBatch>) {
    calculationCalls += 1;
    return originalFortuneBatch.apply(this, args);
  };
  baziCalculator.calculateBaziUnknownTimeBatch = function (
    ...args: Parameters<typeof originalUnknownBatch>
  ) {
    calculationCalls += 1;
    return originalUnknownBatch.apply(this, args);
  };

  try {
    const unknown = await combined.handler(
      parseToolInput(combined, {
        ...UNKNOWN_INPUT,
        question: '请合参。',
      }),
    );
    assert.equal(unknown.isError, true);
    assert.match(String(unknown.structuredContent?.error), /需要明确的出生时辰/);

    const cursorOnKnown = await combined.handler(
      parseToolInput(combined, {
        ...KNOWN_INPUT,
        question: '请合参。',
        unknownTimeBatch: { startIndex: 0 },
      }),
    );
    assert.equal(cursorOnKnown.isError, true);
    assert.match(String(cursorOnKnown.structuredContent?.error), /仅支持八字单盘/);
    assert.equal(calculationCalls, 0, '合参身份错误必须在任何八字排盘前拒绝');
  } finally {
    baziCalculator.calculateBazi = originalFull;
    baziCalculator.calculateBaziBatch = originalFortuneBatch;
    baziCalculator.calculateBaziUnknownTimeBatch = originalUnknownBatch;
  }
});
