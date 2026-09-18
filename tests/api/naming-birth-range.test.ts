import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const birth = {
  gender: 'male' as const,
  year: 2024,
  month: 2,
  day: 19,
  timeIndex: 6,
  dateType: 'solar' as const,
  birthHour: 11,
  birthMinute: 0,
  birthSecond: 0,
  birthTimeRange: {
    startTimestamp: Date.parse('2024-02-19T11:00:00+08:00'),
    endTimestamp: Date.parse('2024-02-19T11:00:10+08:00'),
    endExclusive: true as const,
    timezone: 'Asia/Shanghai' as const,
    offsetHours: 8 as const,
    pillars: { year: '甲辰', month: '丙寅', day: '癸丑', hour: '戊午' },
  },
};

async function callApi(path: string, body?: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  return { status: response.status, body: (await response.json()) as any };
}

function assertBirthRange(result: any) {
  assert.deepEqual(result.birthRange?.source, birth.birthTimeRange);
  assert.equal(result.birthRange?.totalSamples, 10);
  assert.equal(result.birthRange?.branches.length, 1);
}

test('起名HTTP生成与分析完整转发出生范围且OpenAPI公开来源四柱', async () => {
  const generated = await callApi('name/generate', { surname: '李', limit: 1, birth });
  assert.equal(generated.status, 200);
  assertBirthRange(generated.body.data[0].analysis.birthContext);

  const analyzed = await callApi('name/analyze', { fullName: '李清和', birth });
  assert.equal(analyzed.status, 200);
  assertBirthRange(analyzed.body.data.birthContext);

  const openapi = await callApi('openapi.json');
  assert.equal(openapi.status, 200);
  assert.equal(
    openapi.body.data.components.schemas.NamingBirthInput.properties.birthTimeRange.$ref,
    '#/components/schemas/NamingBirthTimeRange',
  );
  assert.deepEqual(openapi.body.data.components.schemas.NamingBirthTimeRange.allOf[1].required, [
    'pillars',
  ]);
});

test('起名MCP生成与分析不静默丢弃出生范围', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: 'naming-birth-range-test', version: '1.0.0' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  try {
    const generated = await client.callTool({
      name: 'name_generate',
      arguments: { surname: '李', limit: 1, birth },
    });
    assert.equal(generated.isError, undefined);
    const generatedResult = (generated.structuredContent as any).result;
    assertBirthRange(generatedResult[0].analysis.birthContext);

    const analyzed = await client.callTool({
      name: 'name_analyze',
      arguments: { fullName: '李清和', birth },
    });
    assert.equal(analyzed.isError, undefined);
    assertBirthRange((analyzed.structuredContent as any).result.birthContext);
  } finally {
    await client.close();
    await server.close();
  }
});
