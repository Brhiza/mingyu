import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'almanac-pagination-test', version: '0.0.1' });
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

test('MCP 黄历日期范围支持按页返回并重算当前页证据', async () => {
  const mcp = await getClient();
  const firstPage = await mcp.callTool({
    name: 'divine_almanac',
    arguments: {
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      page: 1,
      pageSize: 2,
      detailMode: 'full',
    },
  });
  assert.equal(firstPage.isError, undefined, JSON.stringify(firstPage.content));
  const firstData = firstPage.structuredContent?.result as {
    days: Array<{ date: string }>;
    evidenceAnalysis: { candidates: Array<{ date: string }> };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasPrevious: boolean;
      hasNext: boolean;
    };
  };
  assert.equal(firstData.days.length, 2);
  assert.equal(firstData.evidenceAnalysis.candidates.length, 2);
  assert.deepEqual(firstData.pagination, {
    page: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
    hasPrevious: false,
    hasNext: true,
  });
  assert.deepEqual(
    firstData.evidenceAnalysis.candidates.map((candidate) => candidate.date),
    firstData.days.map((day) => day.date),
  );

  const secondPage = await mcp.callTool({
    name: 'divine_almanac',
    arguments: {
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      page: 2,
      pageSize: 2,
    },
  });
  assert.equal(secondPage.isError, undefined, JSON.stringify(secondPage.content));
  const secondData = secondPage.structuredContent?.result as {
    days: Array<{ date: string }>;
    pagination: { page: number; totalPages: number; hasPrevious: boolean; hasNext: boolean };
  };
  assert.equal(secondData.days.length, 1);
  assert.deepEqual(secondData.pagination, {
    page: 2,
    pageSize: 2,
    total: 3,
    totalPages: 2,
    hasPrevious: true,
    hasNext: false,
  });

  const invalidPage = await mcp.callTool({
    name: 'divine_almanac',
    arguments: {
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      page: 3,
      pageSize: 2,
    },
  });
  assert.equal(invalidPage.isError, true);
  assert.match(String(invalidPage.content?.[0]?.text), /page 不能超过总页数 2/);
});
