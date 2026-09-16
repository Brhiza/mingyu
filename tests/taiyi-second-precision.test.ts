import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../mcp/src/create-server';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';

type ApiPayload = {
  ok: boolean;
  data?: Record<string, any>;
  error?: { message?: string };
};

type BodyMutator = (body: Record<string, unknown>) => void;

async function callTaiyiApi(path: 'calculate' | 'prompt', input: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/metaphysics/taiyi/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { response, body: (await response.json()) as ApiPayload };
}

async function withPublicApi(callback: () => Promise<void>, mutate?: BodyMutator) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const request = new Request(new URL(String(input), 'https://aov.cc'), init);
    const response = await handlePublicApiRequest(request);
    if (!mutate) return response;
    const body = (await response.json()) as Record<string, unknown>;
    mutate(body);
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('太乙公开接口在夏至秒边界保留完整目标时间', async () => {
  const yinYangValues: string[] = [];
  for (const [second, expected, expectedYinYang] of [
    [29, '2026-06-21 16:24:29', '阳遁'],
    [30, '2026-06-21 16:24:30', '阴遁'],
  ] as const) {
    const { response, body } = await callTaiyiApi('calculate', {
      scope: 'hour',
      year: 2026,
      month: 6,
      day: 21,
      hour: 16,
      minute: 24,
      second,
    });
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data?.dateTime, expected);
    assert.equal(body.data?.yinYang, expectedYinYang);
    yinYangValues.push(String(body.data?.yinYang));
  }
  assert.notEqual(yinYangValues[0], yinYangValues[1]);
});

test('太乙公开接口在冬至秒边界保留完整目标时间并支持提示词入口', async () => {
  const yinYangValues: string[] = [];
  for (const [second, expected, expectedYinYang] of [
    [4, '2025-12-21 23:03:04', '阴遁'],
    [5, '2025-12-21 23:03:05', '阳遁'],
  ] as const) {
    const { response, body } = await callTaiyiApi('prompt', {
      scope: 'hour',
      year: 2025,
      month: 12,
      day: 21,
      hour: 23,
      minute: 3,
      second,
      responseMode: 'full',
      question: '核对目标时刻。',
    });
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data?.result?.dateTime, expected);
    assert.equal(body.data?.result?.yinYang, expectedYinYang);
    yinYangValues.push(String(body.data?.result?.yinYang));
  }
  assert.notEqual(yinYangValues[0], yinYangValues[1]);
});

test('太乙 MetaphysicsRequest schema 声明秒字段及默认值', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/openapi.json', { method: 'GET' }),
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data?: {
      components?: {
        schemas?: {
          MetaphysicsRequest?: { properties?: Record<string, any> };
        };
      };
    };
  };
  const second = body.data?.components?.schemas?.MetaphysicsRequest?.properties?.second;
  assert.deepEqual(second, {
    type: 'integer',
    minimum: 0,
    maximum: 59,
    default: 0,
    description: '太乙月、日、时计的秒数；省略时按 00 秒计算。',
  });
});

test('太乙公开接口默认秒为零并拒绝越界或非整数秒', async () => {
  const defaultSecond = await callTaiyiApi('calculate', {
    scope: 'hour',
    year: 2026,
    month: 6,
    day: 21,
    hour: 16,
    minute: 24,
  });
  assert.equal(defaultSecond.response.status, 200);
  assert.equal(defaultSecond.body.data?.dateTime, '2026-06-21 16:24:00');

  for (const second of [-1, 60, 1.5, '30']) {
    const invalid = await callTaiyiApi('calculate', {
      scope: 'hour',
      year: 2026,
      month: 6,
      day: 21,
      hour: 16,
      minute: 24,
      second,
    });
    assert.equal(invalid.response.status, 400, `second=${String(second)} 应被拒绝`);
    assert.equal(invalid.body.ok, false);
    assert.match(String(invalid.body.error?.message), /second/);
  }
});

test('太乙补算资源的参数 schema 与结构化校验均保留秒', async () => {
  await withPublicApi(async () => {
    const schema = await executeReadingAction({ kind: 'schema', method: 'taiyi' });
    const schemaJson = JSON.parse(schema.text) as {
      properties?: Record<string, unknown>;
    };
    assert.ok(schemaJson.properties?.second);

    const resource = await executeReadingAction({
      kind: 'calculate',
      method: 'taiyi',
      input: {
        scope: 'hour',
        year: 2026,
        month: 6,
        day: 21,
        hour: 16,
        minute: 24,
        second: 30,
      },
    });
    assert.equal((resource.structured as Record<string, unknown>).dateTime, '2026-06-21 16:24:30');
  });
});

test('太乙补算拒绝被篡改的秒级结果', async () => {
  await assert.rejects(
    withPublicApi(
      async () => {
        await executeReadingAction({
          kind: 'calculate',
          method: 'taiyi',
          input: {
            scope: 'hour',
            year: 2026,
            month: 6,
            day: 21,
            hour: 16,
            minute: 24,
            second: 30,
          },
        });
      },
      (body) => {
        const data = body.data as Record<string, unknown>;
        const result = data.result as Record<string, unknown>;
        result.dateTime = '2026-06-21 16:24:29';
      },
    ),
    /taiyi\.second/u,
  );
});

test('MCP 太乙 customDate 的秒字段进入结构化结果', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: 'taiyi-second-precision-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: 'metaphysics_taiyi',
      arguments: {
        scope: 'hour',
        customDate: '2026-06-21T16:24:30+08:00',
      },
    });
    assert.equal(result.isError, undefined);
    assert.equal(
      (result.structuredContent as { result: { dateTime: string } }).result.dateTime,
      '2026-06-21 16:24:30',
    );
  } finally {
    await client.close();
    await server.close();
  }
});
