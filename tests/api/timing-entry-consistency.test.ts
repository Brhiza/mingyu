import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { findTool } from '../../mcp/src/catalog/tool-catalog';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const server = createMingyuMcpServer();
const client = new Client({ name: 'timing-contract-test', version: '1.0.0' });

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
  return { response, body: await response.json() };
}

const cases: Array<[string, string, Record<string, unknown>]> = [
  ['皇极公元值年', 'metaphysics_huangji_jingshi', { year: 2026 }],
  ['皇极指定年月日时', 'metaphysics_huangji_jingshi', { customDate: '2026-02-04T12:30:00+08:00' }],
  ['玄空仅宅盘', 'metaphysics_xuankong', { year: 2024, facingDegree: 180 }],
  [
    '玄空指定流年流月日期',
    'metaphysics_xuankong',
    { year: 2024, facingDegree: 180, flowYear: 2026, flowMonth: 2, flowDay: 4 },
  ],
  [
    '住宅指定流年流月日期',
    'metaphysics_residential',
    {
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 15,
      gender: 'male',
      year: 2024,
      doorToInteriorDegree: 0,
      flowYear: 2026,
      flowMonth: 2,
      flowDay: 10,
    },
  ],
  [
    '七政历史时区与目标流年',
    'metaphysics_qizheng',
    {
      year: 1990,
      month: 5,
      day: 15,
      hour: 10,
      minute: 30,
      timeZoneId: 'Asia/Shanghai',
      latitude: 39.9,
      longitude: 116.4,
      gender: 'male',
      flowYear: 2026,
    },
  ],
  [
    '终身奇门目标区间',
    'divine_qimen_lifetime',
    {
      birthDateTime: '1990-05-15T10:30:00',
      timeZoneId: 'Asia/Shanghai',
      periodRange: { startDate: '2026-01-01', endDate: '2027-12-31' },
    },
  ],
];

for (const [label, tool, input] of cases) {
  test(`${label}经 HTTP 与 MCP 返回同一完整时限资料`, async () => {
    const args = { ...input, detailMode: 'full' };
    const http = await callHttp(tool, args);
    assert.equal(http.response.status, 200, JSON.stringify(http.body));
    const mcp = await client.callTool({ name: tool, arguments: args });
    assert.notEqual(mcp.isError, true, JSON.stringify(mcp));
    const structured = mcp.structuredContent as Record<string, unknown>;
    assert.ok(http.body.data);
    assert.ok(structured.result);
    const mcpResult = JSON.parse(JSON.stringify(structured.result));
    if (tool === 'divine_qimen_lifetime') {
      const { input: httpInput, ...httpFacts } = http.body.data;
      const { input: mcpInput, ...mcpFacts } = mcpResult;
      for (const [field, value] of Object.entries(args)) {
        assert.deepEqual(httpInput[field], value, `HTTP 回显 ${field}`);
        assert.deepEqual(mcpInput[field], value, `MCP 回显 ${field}`);
      }
      // 输入回显可省略默认字段；实际默认口径由 basis 和完整盘面共同核验。
      assert.deepEqual(mcpFacts, httpFacts);
    } else {
      assert.deepEqual(mcpResult, http.body.data);
    }
  });
}

test('皇极日期与年坐标混用在 HTTP 与 MCP 均返回错误', async () => {
  const tool = 'metaphysics_huangji_jingshi';
  const input = { customDate: '2026-02-04T12:30:00+08:00', year: 2026 };
  const http = await callHttp(tool, input);
  assert.equal(http.response.status, 400);
  const mcp = await client.callTool({ name: tool, arguments: input });
  assert.equal(mcp.isError, true);
});
