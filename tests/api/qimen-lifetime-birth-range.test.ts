import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const input = {
  birthDateTime: '2024-02-19T11:00:00',
  timezone: 8,
  gender: 'male',
  birthRangeIndex: 4392,
  birthTimeRange: {
    startTimestamp: Date.parse('2024-02-19T11:00:00+08:00'),
    endTimestamp: Date.parse('2024-02-19T13:00:00+08:00'),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  },
};
async function call(path: string, extra: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/divination/qimen/lifetime${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, ...extra }),
    }),
  );
  return { status: response.status, body: (await response.json()) as any };
}

test('奇门终身局HTTP完整精简与仅提示词均保留出生范围和续取位置', async () => {
  for (const detailMode of ['full', 'compact']) {
    const { status, body } = await call('', { detailMode });
    assert.equal(status, 200);
    assert.equal(body.data.birthRange.index, 4392);
    assert.equal(body.data.birthRange.nextIndex, 4393);
    assert.equal(body.data.basis.solarTerm, '雨水');
  }
  const prompt = await call('/prompt', { question: '解读本册资料', responseMode: 'prompt-only' });
  assert.equal(prompt.status, 200);
  assert.equal(prompt.body.data.birthRange.totalSamples, 7200);
  assert.match(prompt.body.data.prompt, /12:13:12/);
  const fullPrompt = await call('/prompt', {
    question: '解读本册资料',
    responseMode: 'full',
  });
  assert.equal(fullPrompt.status, 200);
  assert.equal(fullPrompt.body.data.summary.birthDateTime, '2024-02-19T12:13:12');
  assert.equal(
    fullPrompt.body.data.result.birthRange.timestamp,
    input.birthTimeRange.startTimestamp + 4392000,
  );
  const invalid = await call('', { birthRangeIndex: 7200 });
  assert.equal(invalid.status, 400);
});

test('奇门终身局HTTP在历法计算前拒绝出生范围的非固定时制', async () => {
  for (const path of ['', '/prompt']) {
    const { status, body } = await call(path, {
      ...(path ? { question: '解读本册资料' } : {}),
      timeStandard: 'trueSolar',
    });
    assert.equal(status, 400, path || '计算接口');
    assert.match(String(body.error?.message), /标准北京时间|法定民用时/u);
  }
});

test('奇门终身局MCP不丢弃区间字段且与HTTP当前候选一致', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: 'qimen-range-test', version: '1.0.0' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  try {
    const response = await client.callTool({
      name: 'divine_qimen_lifetime',
      arguments: { ...input, detailMode: 'full' },
    });
    assert.equal(response.isError, undefined);
    const data = response.structuredContent as any;
    assert.equal(data.result.birthRange.index, 4392);
    assert.equal(data.result.birthRange.nextIndex, 4393);
    assert.equal(data.result.basis.solarTerm, '雨水');
  } finally {
    await client.close();
    await server.close();
  }
});

test('奇门终身局范围接口允许未指定性别', async () => {
  for (const path of ['', '/prompt']) {
    for (const gender of [undefined, '']) {
      const { status, body } = await call(path, {
        gender,
        ...(path ? { question: '解读本册资料' } : {}),
      });
      assert.equal(status, 200);
      assert.equal(body.data.birthRange.index, 4392);
    }
  }
});
