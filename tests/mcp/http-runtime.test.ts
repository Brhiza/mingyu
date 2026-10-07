import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server.js';
import { promptResponseModeShape } from '../../mcp/src/schemas.js';
import { getToolCatalog } from '../../mcp/src/catalog/tool-catalog.js';
import { handleMcpRequest } from '../../src/lib/mcp/handler.js';

async function sendMessage(message: unknown, preset: 'online' | 'full' = 'online') {
  const response = await handleMcpRequest(
    new Request('https://aov.cc/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    }),
    { preset },
  );
  return { response, body: await response.json() };
}

test('HTTP 首次基础调用不构造提示词 schema，后续提示词可独立初始化', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(promptResponseModeShape, 'responseMode')!;
  let schemaReads = 0;
  Object.defineProperty(promptResponseModeShape, 'responseMode', {
    configurable: true,
    enumerable: true,
    get() {
      schemaReads += 1;
      return descriptor.value;
    },
  });
  t.after(() => Object.defineProperty(promptResponseModeShape, 'responseMode', descriptor));

  const first = await sendMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'foundation_ganzhi', arguments: { ganZhi: '甲子' } },
  });
  assert.equal(first.body.result.isError, undefined);
  assert.equal(schemaReads, 0);
  schemaReads = 0;

  const prompt = await sendMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'bazi_prompt', arguments: {} },
  });
  assert.equal(prompt.body.result.structuredContent.code, 'INVALID_ARGUMENTS');
  assert.ok(schemaReads > 0);
});

test('HTTP 分类分发覆盖全部合法工具，未知名称仅使用固定工具安装 SDK 处理器', async (t) => {
  const registeredNames: string[] = [];
  const originalRegisterTool = McpServer.prototype.registerTool;
  t.mock.method(
    McpServer.prototype,
    'registerTool',
    function (this: McpServer, ...args: Parameters<typeof originalRegisterTool>) {
      registeredNames.push(args[0]);
      return originalRegisterTool.apply(this, args);
    },
  );
  for (const { id } of getToolCatalog()) {
    registeredNames.length = 0;
    const server = createMingyuMcpServer({
      preset: 'online',
      httpRequest: { method: 'tools/call', toolName: id },
    });
    assert.deepEqual(registeredNames, [id]);
    await server.close();
  }
  for (const toolName of ['unknown_one', 'unknown_two', 'unknown_three']) {
    registeredNames.length = 0;
    const unknown = await sendMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName },
    });
    assert.equal(unknown.body.result.isError, true);
    assert.match(unknown.body.result.content[0].text, new RegExp(toolName));
    assert.deepEqual(registeredNames, ['foundation_capabilities']);
  }
});

test('HTTP 初始化无需注册工具，工具调用只注册目标工具，目录热请求复用稳定 schema', async (t) => {
  const registeredNames: string[] = [];
  const originalRegisterTool = McpServer.prototype.registerTool;
  t.mock.method(
    McpServer.prototype,
    'registerTool',
    function (this: McpServer, ...args: Parameters<typeof originalRegisterTool>) {
      registeredNames.push(args[0]);
      return originalRegisterTool.apply(this, args);
    },
  );

  const initialized = await sendMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: '测试', version: '1' },
    },
  });
  assert.equal(initialized.response.status, 200);
  assert.ok(initialized.body.result.capabilities.tools);
  assert.deepEqual(registeredNames, []);

  const called = await sendMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'foundation_ganzhi', arguments: { ganZhi: '甲子' } },
  });
  assert.equal(called.body.result.isError, undefined);
  assert.deepEqual(registeredNames, ['foundation_ganzhi']);

  const secondTool = await sendMessage({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'foundation_wuxing', arguments: { items: ['甲', '子'] } },
  });
  assert.equal(secondTool.body.result.isError, undefined);
  assert.deepEqual(registeredNames, ['foundation_ganzhi', 'foundation_wuxing']);

  const firstList = await sendMessage({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.ok(firstList.body.result.tools.length > 70);
  registeredNames.length = 0;
  const secondList = await sendMessage({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
  assert.deepEqual(secondList.body.result.tools, firstList.body.result.tools);
  assert.deepEqual(registeredNames, []);
  assert.equal(secondList.body.id, 4);
});

test('HTTP 缓存目录与完整服务器保持同一工具契约，在线和完整默认值独立', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: '测试', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const fullList = await client.listTools();
    const httpFullList = await sendMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'full');
    assert.deepEqual(httpFullList.body.result.tools, fullList.tools);

    const onlineList = await sendMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.deepEqual(
      onlineList.body.result.tools.map((tool: { name: string }) => tool.name),
      fullList.tools.map((tool) => tool.name),
    );
    const findTool = (tools: typeof fullList.tools, name: string) =>
      tools.find((tool) => tool.name === name)!;
    assert.notEqual(
      findTool(onlineList.body.result.tools, 'bazi_prompt').description,
      findTool(fullList.tools, 'bazi_prompt').description,
    );
    for (const name of ['divine_tarot', 'tarot_prompt', 'divine_ssgw', 'ssgw_prompt']) {
      assert.equal(findTool(onlineList.body.result.tools, name).annotations?.idempotentHint, false);
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test('HTTP 按目标注册仍保留协议、未知工具和输入校验，计算结果不进入缓存', async () => {
  const invalidProtocol = await sendMessage({
    id: 1,
    method: 'tools/call',
    params: { name: 'foundation_ganzhi' },
  });
  assert.equal(invalidProtocol.response.status, 400);
  assert.equal(invalidProtocol.body.error.code, -32700);

  const unknown = await sendMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'unknown_tool' },
  });
  assert.equal(unknown.body.result.isError, true);
  assert.match(unknown.body.result.content[0].text, /unknown_tool/);

  const invalidArgs = await sendMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'foundation_ganzhi', arguments: {} },
  });
  assert.equal(invalidArgs.body.result.isError, true);
  assert.equal(invalidArgs.body.result.structuredContent.code, 'INVALID_ARGUMENTS');
  assert.deepEqual(invalidArgs.body.result.structuredContent.missingFields, ['ganZhi']);
  assert.equal(invalidArgs.body.result._meta.tool, 'foundation_ganzhi');

  const results = await Promise.all(
    ['甲子', '乙丑'].map((ganZhi, index) =>
      sendMessage({
        jsonrpc: '2.0',
        id: index + 4,
        method: 'tools/call',
        params: { name: 'foundation_ganzhi', arguments: { ganZhi } },
      }),
    ),
  );
  assert.deepEqual(
    results.map(({ body }) => body.id),
    [4, 5],
  );
  assert.ok(results.every(({ body }) => !body.result.isError));
  assert.notDeepEqual(
    results[0].body.result.structuredContent,
    results[1].body.result.structuredContent,
  );
});
