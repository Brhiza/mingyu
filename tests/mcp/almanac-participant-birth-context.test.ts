import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'almanac-birth-context-test', version: '0.0.1' });
const transport = new StdioClientTransport({
  command: 'npm',
  args: ['run', 'mcp'],
  cwd: process.cwd(),
  stderr: 'pipe',
});
let connected = false;

async function getClient() {
  if (!connected) {
    await client.connect(transport);
    connected = true;
  }
  return client;
}

after(async () => {
  if (connected) await client.close();
});

const participant = {
  id: 'solar-cross-day',
  name: '合成参与人',
  gender: '男',
  year: 1990,
  month: 1,
  day: 2,
  birthHour: 0,
  birthMinute: 30,
  dateType: 'solar',
  birthPlace: '测试地点',
  birthLongitude: 75,
  timezone: 8,
  useTrueSolarTime: true,
} as const;

const request = {
  topic: 'custom',
  startDate: '2026-06-01',
  endDate: '2026-06-01',
} as const;

type ParticipantResult = {
  solarDate: string;
  lunarDate: string;
  pillars: { year: string; month: string; day: string; hour: string };
};

async function calculate(input: Record<string, unknown>): Promise<ParticipantResult> {
  const mcp = await getClient();
  const response = await mcp.callTool({
    name: 'divine_almanac',
    arguments: { ...request, detailMode: 'full', participants: [input] },
  });
  assert.equal(response.isError, undefined, JSON.stringify(response.content));
  const result = response.structuredContent?.result as { participants: ParticipantResult[] };
  assert.equal(result.participants.length, 1);
  return result.participants[0]!;
}

test('MCP 黄历排盘与完整任务书透传原始钟表、地点经度和真太阳时跨日', async () => {
  const profile = await calculate(participant);
  assert.equal(profile.solarDate, '1990-01-01');
  assert.equal(profile.lunarDate, '十二月初五');
  assert.deepEqual(profile.pillars, {
    year: '己巳',
    month: '丙子',
    day: '丙寅',
    hour: '己亥',
  });

  const mcp = await getClient();
  const promptResult = await mcp.callTool({
    name: 'almanac_prompt',
    arguments: { ...request, participants: [participant], question: '请按本次参与人盘面择日。' },
  });
  assert.equal(promptResult.isError, undefined, JSON.stringify(promptResult.content));
  const promptProfile = (
    promptResult.structuredContent?.result as {
      participants: ParticipantResult[];
    }
  ).participants[0];
  assert.deepEqual(promptProfile, profile);
  const prompt = String(promptResult.structuredContent?.prompt);
  assert.match(prompt, /合成参与人/u);
  assert.match(prompt, /四柱己巳 丙子 丙寅 己亥/u);

  const explicitSecond = await calculate({ ...participant, birthSecond: 0 });
  assert.deepEqual(explicitSecond, profile);
  const fixedOffset = await calculate({ ...participant, birthLongitude: 120, timezone: 9 });
  assert.equal(fixedOffset.solarDate, '1990-01-01');
  assert.equal(fixedOffset.pillars.day, '丁卯');
  const legacyShichen = await calculate({
    ...participant,
    timeIndex: 0,
    birthHour: undefined,
    birthMinute: undefined,
    birthPlace: undefined,
    birthLongitude: undefined,
    useTrueSolarTime: undefined,
  });
  assert.equal(legacyShichen.solarDate, '1990-01-02');
});

test('MCP 黄历沿用核心出生钟表与出生区间的冲突、缺资料校验', async () => {
  const mcp = await getClient();
  const birthTimeRange = {
    startTimestamp: Date.parse('1990-01-02T00:30:00+08:00'),
    endTimestamp: Date.parse('1990-01-02T00:30:01+08:00'),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
    pillars: { year: '己巳', month: '丙子', day: '丁卯', hour: '庚子' },
  };
  const invalidCases: Array<{ label: string; input: Record<string, unknown>; reason: RegExp }> = [
    {
      label: '缺出生经度',
      input: { ...participant, birthLongitude: undefined },
      reason: /真太阳时需要出生经度/u,
    },
    {
      label: '无效 IANA 时区',
      input: { ...participant, useTrueSolarTime: false, timeZoneId: 'Invalid/Zone' },
      reason: /时区|time\s*zone|timeZoneId/iu,
    },
    {
      label: '精确钟表与时辰不一致',
      input: { ...participant, timeIndex: 1 },
      reason: /时辰索引.*不一致/u,
    },
    {
      label: '缺出生分钟',
      input: { ...participant, birthMinute: undefined, useTrueSolarTime: false },
      reason: /同时提供小时和分钟/u,
    },
    {
      label: '反推区间省略起点秒数',
      input: {
        ...participant,
        timeIndex: 0,
        birthSecond: undefined,
        useTrueSolarTime: false,
        birthTimeRange,
      },
      reason: /birthTimeRange 时必须提供 birthHour、birthMinute、birthSecond/u,
    },
    {
      label: '反推区间混用真太阳时',
      input: {
        ...participant,
        timeIndex: 0,
        birthSecond: 0,
        birthTimeRange,
      },
      reason: /四柱反推参与人必须使用公历、非闰月和标准北京时间/u,
    },
  ];

  for (const { label, input, reason } of invalidCases) {
    const response = await mcp.callTool({
      name: 'divine_almanac',
      arguments: { ...request, participants: [input] },
    });
    assert.equal(response.isError, true, label);
    assert.match(String(response.content?.[0]?.text), reason, label);
  }
});
