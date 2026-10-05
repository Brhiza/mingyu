import assert from 'node:assert/strict';
import test from 'node:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildBaziPerson, registerBaziTool } from '../../mcp/src/tools/bazi';
import { registerBaziZiweiTool } from '../../mcp/src/tools/bazi-ziwei';
import { buildMcpZiweiChartInput, registerZiweiTool } from '../../mcp/src/tools/ziwei';

type RegisteredTool = {
  inputSchema: {
    safeParse(
      value: unknown,
    ): { success: true; data: Record<string, unknown> } | { success: false; error: unknown };
  };
  handler(args: Record<string, unknown>): Promise<{
    isError?: boolean;
    structuredContent?: Record<string, any>;
  }>;
};

function getTools() {
  const server = new McpServer({ name: 'birth-clock-consistency-test', version: '1.0.0' });
  registerBaziTool(server);
  registerZiweiTool(server);
  registerBaziZiweiTool(server);
  return (server as unknown as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
}

async function callTool(tool: RegisteredTool, input: Record<string, unknown>) {
  const parsed = tool.inputSchema.safeParse(input);
  assert.equal(parsed.success, true, JSON.stringify(parsed.success ? null : parsed.error));
  if (!parsed.success) throw new Error('MCP 输入未通过 schema。');
  const response = await tool.handler(parsed.data);
  assert.equal(response.isError, undefined, JSON.stringify(response.structuredContent));
  assert.ok(response.structuredContent);
  return response.structuredContent;
}

const birth = {
  gender: 'male' as const,
  dateType: 'solar' as const,
  year: 2024,
  month: 6,
  day: 1,
};

function ziweiBirth(
  input: typeof birth & {
    timeIndex?: number;
    birthHour?: number;
    birthMinute?: number;
    birthSecond?: number;
  },
) {
  return {
    ...input,
    year: String(input.year),
    month: String(input.month),
    day: String(input.day),
    birthHour: input.birthHour === undefined ? undefined : String(input.birthHour),
    birthMinute: input.birthMinute === undefined ? undefined : String(input.birthMinute),
    birthSecond: input.birthSecond === undefined ? undefined : String(input.birthSecond),
  };
}

test('MCP 八字、紫微和合参对无秒钟表及冲突索引采用同一时辰', async () => {
  const tools = getTools();
  const input = { ...birth, timeIndex: 6, birthHour: 0, birthMinute: 5 };
  const bazi = await callTool(tools.bazi_calculate!, input);
  const ziwei = await callTool(tools.ziwei_calculate!, {
    ...ziweiBirth(input),
    promptScope: 'origin',
  });
  const combined = await callTool(tools.bazi_ziwei_prompt!, {
    ...input,
    question: '请核对本命盘。',
    promptScope: 'origin',
  });

  assert.equal(bazi.result.timeInfo.index, 0);
  assert.equal(ziwei.basicInfo.birth_time_label, '早子时');
  assert.equal(bazi.result.pillars.hour.ganZhi, ziwei.basicInfo.four_pillars.hour_pillar);
  assert.equal(combined.result.bazi.timeInfo.index, 0);
  assert.equal(combined.result.bazi.pillars.hour.ganZhi, bazi.result.pillars.hour.ganZhi);
  assert.equal(
    combined.result.ziwei.basicInfo.four_pillars.hour_pillar,
    ziwei.basicInfo.four_pillars.hour_pillar,
  );
});

test('MCP 完整时分可省时辰索引，传统时辰和未知时辰仍按原口径', async () => {
  const tools = getTools();
  const clock = { ...birth, birthHour: 0, birthMinute: 5 };
  const bazi = await callTool(tools.bazi_calculate!, clock);
  const ziwei = await callTool(tools.ziwei_calculate!, {
    ...ziweiBirth(clock),
    promptScope: 'origin',
  });
  const combined = await callTool(tools.bazi_ziwei_prompt!, {
    ...clock,
    question: '请核对本命盘。',
    promptScope: 'origin',
  });
  assert.equal(bazi.result.timeInfo.index, 0);
  assert.equal(ziwei.basicInfo.birth_time_label, '早子时');
  assert.equal(combined.result.bazi.pillars.hour.ganZhi, bazi.result.pillars.hour.ganZhi);
  assert.equal(buildBaziPerson(clock).birthSecond, 0);
  assert.deepEqual(buildMcpZiweiChartInput(ziweiBirth(clock)).birthTime, {
    hour: 0,
    minute: 5,
    second: 0,
  });

  const traditional = { ...birth, timeIndex: 6 };
  assert.equal(buildBaziPerson(traditional).timeIndex, 6);
  assert.equal(
    buildMcpZiweiChartInput({ ...ziweiBirth(traditional), birthHour: '', birthMinute: '' })
      .birthTimeIndex,
    6,
  );
  assert.equal(buildBaziPerson({ ...birth, timeIndex: -1 }).isThreePillars, true);
});

test('MCP 部分钟表和坏值明确拒绝', async () => {
  assert.throws(() => buildBaziPerson({ ...birth, timeIndex: 6, birthHour: 0 }));
  assert.throws(() => buildBaziPerson({ ...birth, timeIndex: 6, birthSecond: 1 }));
  assert.throws(() => buildBaziPerson({ ...birth, timeIndex: 6, birthHour: 24, birthMinute: 5 }));
  assert.throws(() =>
    buildMcpZiweiChartInput({
      ...ziweiBirth({ ...birth, timeIndex: 6 }),
      birthHour: '0',
    }),
  );
  assert.throws(() =>
    buildMcpZiweiChartInput({
      ...ziweiBirth({ ...birth, timeIndex: 6 }),
      birthHour: 'bad',
      birthMinute: '5',
    }),
  );

  const tools = getTools();
  const partial = { ...birth, timeIndex: 6, birthHour: 0, question: '请核对本命盘。' };
  const parsed = tools.bazi_ziwei_prompt!.inputSchema.safeParse(partial);
  assert.equal(parsed.success, true);
  if (!parsed.success) throw new Error('MCP 输入未通过 schema。');
  const combined = await tools.bazi_ziwei_prompt!.handler(parsed.data);
  assert.equal(combined.isError, true);
});

test('MCP 紫微单盘和提示词共同采用上海别名的夏令时跨日事实', async () => {
  const tools = getTools();
  const input = {
    ...ziweiBirth({
      ...birth,
      year: 1990,
      month: 5,
      day: 15,
      birthHour: 0,
      birthMinute: 20,
      birthSecond: 17,
    }),
    timeZoneId: 'Asia/Harbin',
    promptScope: 'origin',
  };
  const calculated = await callTool(tools.ziwei_calculate!, input);
  const prompt = await callTool(tools.ziwei_prompt!, { ...input, question: '请解读本命盘。' });
  assert.equal(calculated.basicInfo.solar_date, '1990-05-14');
  assert.equal(calculated.basicInfo.birth_time_label, '晚子时');
  assert.deepEqual(prompt.result.basicInfo.four_pillars, calculated.basicInfo.four_pillars);
  assert.match(prompt.prompt, /1990-05-14/);
  assert.match(prompt.prompt, /晚子时/);
  assert.deepEqual(buildMcpZiweiChartInput(input).birthTime, { hour: 23, minute: 20, second: 17 });
});

test('MCP 紫微普通钟表拒绝不存在与未消歧的 IANA 当地时刻', async () => {
  const tools = getTools();
  for (const clock of [
    { month: 3, day: 10, birthHour: 2, birthMinute: 30 },
    { month: 11, day: 3, birthHour: 1, birthMinute: 30 },
    { month: 7, day: 1, birthHour: 12, birthMinute: 0, timezone: -5 },
  ]) {
    const input = {
      ...ziweiBirth({ ...birth, ...clock }),
      timeZoneId: 'America/New_York',
      ...('timezone' in clock ? { timezone: clock.timezone } : {}),
      promptScope: 'origin',
    };
    for (const name of ['ziwei_calculate', 'ziwei_prompt']) {
      const tool = tools[name]!;
      const parsed = tool.inputSchema.safeParse({ ...input, question: '请解读本命盘。' });
      assert.equal(parsed.success, true);
      if (!parsed.success) throw new Error('MCP 输入未通过 schema。');
      const response = await tool.handler(parsed.data);
      assert.equal(response.isError, true, name);
    }
  }
});
