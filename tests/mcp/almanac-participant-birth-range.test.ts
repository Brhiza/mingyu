import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const rangeParticipant = {
  id: 'synthetic-range',
  name: '合成参与人甲',
  gender: '男',
  year: 2024,
  month: 2,
  day: 11,
  timeIndex: 8,
  birthHour: 15,
  birthMinute: 0,
  birthSecond: 0,
  dateType: 'solar',
  birthTimeRange: {
    startTimestamp: Date.parse('2024-02-11T15:00:00+08:00'),
    endTimestamp: Date.parse('2024-02-11T17:00:00+08:00'),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
    pillars: { year: '甲辰', month: '丙寅', day: '乙巳', hour: '甲申' },
  },
} as const;

const client = new Client({ name: 'almanac-birth-range-test', version: '0.0.1' });
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

test('MCP 黄历排盘与提示词透传参与人完整出生区间及来源四柱', async () => {
  const mcp = await getClient();
  const input = {
    topic: 'custom',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    participants: [rangeParticipant],
  };
  const result = await mcp.callTool({
    name: 'divine_almanac',
    arguments: { ...input, detailMode: 'full' },
  });
  assert.equal(result.isError, undefined, JSON.stringify(result.content));
  const data = result.structuredContent?.result as {
    participants: Array<{
      birthTimeRange?: {
        source: typeof rangeParticipant.birthTimeRange;
        status: string;
        branches: Array<{ startTimestamp: number; endTimestamp: number }>;
      };
    }>;
  };
  assert.equal(data.participants[0]?.birthTimeRange?.status, 'conditional');
  assert.deepEqual(data.participants[0]?.birthTimeRange?.source, rangeParticipant.birthTimeRange);
  assert.deepEqual(
    data.participants[0]?.birthTimeRange?.branches.map((branch) => [
      branch.startTimestamp,
      branch.endTimestamp,
    ]),
    [
      [rangeParticipant.birthTimeRange.startTimestamp, 1707640027000],
      [1707640027000, rangeParticipant.birthTimeRange.endTimestamp],
    ],
  );

  const promptResult = await mcp.callTool({
    name: 'almanac_prompt',
    arguments: input,
  });
  assert.equal(promptResult.isError, undefined, JSON.stringify(promptResult.content));
  const prompt = String(promptResult.structuredContent?.prompt);
  assert.match(prompt, /2024-02-11 15:00:00/u);
  assert.match(prompt, /2024-02-11 16:27:07/u);
  assert.match(prompt, /2024-02-11 17:00:00/u);
});
