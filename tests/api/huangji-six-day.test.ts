import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { findTool } from '../../mcp/src/catalog/tool-catalog';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const server = createMingyuMcpServer();
const client = new Client({ name: 'huangji-six-day-test', version: '1.0.0' });

type HuangjiResponse = {
  input?: { mode?: string };
  sixDayCycle?: {
    civilTime?: { timezone?: number };
    anchor?: { kind?: string };
    calendar?: { model?: string; mapping?: string; actualElapsedDays?: number };
  };
  result?: HuangjiResponse;
  prompt?: string;
};

before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

after(async () => {
  await client.close();
  await server.close();
});

async function callHttp(tool: string, input: Record<string, unknown>) {
  const endpoint = findTool(tool)?.endpoint;
  assert.ok(endpoint, `${tool} 必须声明公开路径`);
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { response, body: await response.json() } as {
    response: Response;
    body: { ok: boolean; data?: HuangjiResponse; error?: { message?: string } };
  };
}

test('皇极六日逐爻 OpenAPI 以 oneOf 固定两种模型的历元要求', async () => {
  const response = await handlePublicApiRequest(
    new Request('https://aov.cc/api/v1/openapi.json', { method: 'GET' }),
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    data?: unknown;
  };
  const document = (payload.data ?? payload) as {
    components?: {
      schemas?: {
        HuangjiJingshiRequest?: {
          oneOf?: Array<{
            required?: string[];
            properties?: { calendarModel?: { const?: string } };
            not?: { anyOf?: Array<{ required?: string[] }> };
          }>;
        };
      };
    };
  };
  const modes = document.components?.schemas?.HuangjiJingshiRequest?.oneOf ?? [];
  const explicit = modes.find(
    (mode) => mode.properties?.calendarModel?.const === 'six-day-explicit-epoch',
  );
  const proportional = modes.find(
    (mode) => mode.properties?.calendarModel?.const === 'six-day-seven-part',
  );
  assert.deepEqual(explicit?.required, ['sixDayDateTime', 'sixDayEpochDateTime', 'calendarModel']);
  assert.deepEqual(proportional?.required, ['sixDayDateTime', 'calendarModel']);
  assert.ok(
    proportional?.not?.anyOf?.some((condition) =>
      condition.required?.includes('sixDayEpochDateTime'),
    ),
  );
});

test('皇极六日逐爻 HTTP 与 MCP 入口返回同一带时区公历结果', async () => {
  const args = {
    sixDayDateTime: '2025-12-22T05:03:05+14:00',
    sixDayEpochDateTime: '2025-12-21T00:00:00+14:00',
    calendarModel: 'six-day-explicit-epoch',
    detailMode: 'full',
  };
  const http = await callHttp('metaphysics_huangji_jingshi', args);
  assert.equal(http.response.status, 200, JSON.stringify(http.body));
  const mcp = await client.callTool({ name: 'metaphysics_huangji_jingshi', arguments: args });
  assert.notEqual(mcp.isError, true, JSON.stringify(mcp));
  const mcpResult = (mcp.structuredContent as { result: HuangjiResponse }).result;
  assert.deepEqual(mcpResult, http.body.data);
  assert.equal(http.body.data?.input?.mode, '六日逐爻公历');
  assert.equal(http.body.data?.sixDayCycle?.civilTime?.timezone, 14);
  assert.equal(http.body.data?.sixDayCycle?.anchor?.kind, 'explicit-epoch');
  assert.equal(http.body.data?.sixDayCycle?.calendar?.actualElapsedDays, 1);
});

test('皇极六日七分模型无需显式历元且 HTTP 与 MCP 均保留现代定位说明', async () => {
  const args = {
    sixDayDateTime: '2025-12-22T05:03:05+08:00',
    calendarModel: 'six-day-seven-part',
    detailMode: 'full',
  };
  const http = await callHttp('metaphysics_huangji_jingshi', args);
  assert.equal(http.response.status, 200, JSON.stringify(http.body));
  assert.equal(http.body.data?.input?.mode, '六日逐爻公历');
  assert.equal(http.body.data?.sixDayCycle?.calendar?.model, 'six-day-seven-part');
  assert.equal(http.body.data?.sixDayCycle?.calendar?.mapping, 'winter-solstice-proportional-360');
  assert.equal(http.body.data?.sixDayCycle?.anchor?.kind, 'winter-solstice-civil-midnight');
  assert.match(JSON.stringify(http.body.data), /冬至|岁周|适用/);

  const mcp = await client.callTool({ name: 'metaphysics_huangji_jingshi', arguments: args });
  assert.notEqual(mcp.isError, true, JSON.stringify(mcp));
  const mcpResult = (mcp.structuredContent as { result: HuangjiResponse }).result;
  assert.deepEqual(mcpResult, http.body.data);
  assert.equal(mcpResult.sixDayCycle?.calendar?.model, 'six-day-seven-part');

  const rejectedEpoch = await callHttp('metaphysics_huangji_jingshi', {
    ...args,
    sixDayEpochDateTime: '2025-12-21T00:00:00+08:00',
  });
  assert.equal(rejectedEpoch.response.status, 400);
  assert.match(JSON.stringify(rejectedEpoch.body), /six-day-seven-part.*sixDayEpochDateTime/);
});

test('皇极六日逐爻 prompt 入口保留显式历元资料并拒绝无时区时间', async () => {
  const prompt = await callHttp('huangji_jingshi_prompt', {
    sixDayDateTime: '2025-12-21T23:03:05+08:00',
    sixDayEpochDateTime: '2025-12-21T00:00:00+08:00',
    calendarModel: 'six-day-explicit-epoch',
    question: '此时应取何象？',
    responseMode: 'full',
  });
  assert.equal(prompt.response.status, 200, JSON.stringify(prompt.body));
  assert.equal(prompt.body.data?.result?.input?.mode, '六日逐爻公历');
  assert.match(prompt.body.data?.prompt ?? '', /六日逐爻公历时间：2025-12-21T23:03:05\+08:00/);
  assert.match(prompt.body.data?.prompt ?? '', /【问题】\n此时应取何象？/);

  const mcpPrompt = await client.callTool({
    name: 'huangji_jingshi_prompt',
    arguments: {
      sixDayDateTime: '2025-12-21T23:03:05+08:00',
      sixDayEpochDateTime: '2025-12-21T00:00:00+08:00',
      calendarModel: 'six-day-explicit-epoch',
      question: '此时应取何象？',
    },
  });
  assert.notEqual(mcpPrompt.isError, true, JSON.stringify(mcpPrompt));
  const mcpPromptData = mcpPrompt.structuredContent as {
    prompt?: string;
    result?: HuangjiResponse;
  };
  assert.equal(mcpPromptData.result?.input?.mode, '六日逐爻公历');
  assert.match(mcpPromptData.prompt ?? '', /六日逐爻公历时间：2025-12-21T23:03:05\+08:00/);

  const missingModel = await callHttp('metaphysics_huangji_jingshi', {
    sixDayDateTime: '2025-12-21T23:03:05+08:00',
    sixDayEpochDateTime: '2025-12-21T00:00:00+08:00',
  });
  assert.equal(missingModel.response.status, 400);
  assert.match(
    JSON.stringify(missingModel.body),
    /必须明确提供 calendarModel=six-day-seven-part 或 six-day-explicit-epoch/,
  );

  const missingEpoch = await callHttp('metaphysics_huangji_jingshi', {
    sixDayDateTime: '2025-12-21T23:03:05+08:00',
    calendarModel: 'six-day-explicit-epoch',
  });
  assert.equal(missingEpoch.response.status, 400);
  assert.match(JSON.stringify(missingEpoch.body), /sixDayEpochDateTime/);

  const missingTimezone = await callHttp('metaphysics_huangji_jingshi', {
    sixDayDateTime: '2025-12-21T23:03:05',
    sixDayEpochDateTime: '2025-12-21T00:00:00',
    calendarModel: 'six-day-explicit-epoch',
  });
  assert.equal(missingTimezone.response.status, 400);
  assert.match(JSON.stringify(missingTimezone.body), /timezone 与 timeZoneId 至少需要提供一项/);
});
