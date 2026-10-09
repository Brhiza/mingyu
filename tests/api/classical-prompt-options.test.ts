import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getClassicalReferences, supportsClassicalReferences } from 'mingyu-core/prompt';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { TOOL_CATALOG } from '../../mcp/src/catalog/tool-catalog';
import {
  getPublicApiOpenApiDocument,
  handlePublicApiRequest,
} from '../../src/lib/public-api/handler';

const birth = {
  gender: 'female',
  dateType: 'solar',
  year: 1992,
  month: 8,
  day: 21,
  timeIndex: 4,
  birthHour: 8,
  birthMinute: 23,
  scopeDate: '2026-02-10',
  scopeHourIndex: 4,
  question: '请解读本次所列资料。',
};
const divination = {
  customDate: '2026-02-10T08:30:00+08:00',
  question: '请解读本次所列资料。',
};

async function callApi(path: string, input: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://example.test/api/v1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return { status: response.status, body: await response.json() };
}

function assertClassics(content: Record<string, unknown>, method: string) {
  assert.deepEqual(content.classicalReferences, getClassicalReferences(method));
  assert.equal(String(content.prompt).split('【经典依据】').length - 1, 1);
  for (const reference of getClassicalReferences(method)) {
    assert.equal(reference.textType, 'summary');
    assert.match(reference.sourceUrl, /^https:\/\//);
    assert.ok(String(content.prompt).includes(reference.book));
    assert.ok(String(content.prompt).includes(reference.summary));
    assert.ok(String(content.prompt).includes(reference.application));
  }
}

test('公开提示词默认与显式关闭经典依据保持原输出，开启覆盖三种返回模式', async () => {
  for (const [path, method, input] of [
    ['bazi/prompt', 'bazi', { ...birth, baziFortuneScope: 'natal' }],
    ['divination/meihua/prompt', 'meihua', divination],
  ] as const) {
    for (const responseMode of ['prompt-only', 'summary', 'full']) {
      const args = { ...input, responseMode };
      const baseline = await callApi(path, args);
      const disabled = await callApi(path, { ...args, includeClassics: false });
      const enabled = await callApi(path, { ...args, includeClassics: true });
      assert.equal(baseline.status, 200, JSON.stringify(baseline.body));
      assert.equal(disabled.status, 200, JSON.stringify(disabled.body));
      assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
      assert.deepEqual(disabled.body.data, baseline.body.data);
      assert.equal(baseline.body.data.classicalReferences, undefined);
      assertClassics(enabled.body.data, method);
      const { prompt, classicalReferences, ...originalFields } = enabled.body.data;
      const { prompt: oldPrompt, ...baselineFields } = baseline.body.data;
      assert.deepEqual(originalFields, baselineFields);
      assert.ok(prompt.length > oldPrompt.length);
      assert.ok(classicalReferences.length > 0);
    }
  }
});

test('公开提示词严格拒绝字符串、数字与 null 经典开关', async () => {
  for (const includeClassics of ['true', 'false', 1, 0, null]) {
    const result = await callApi('divination/meihua/prompt', { ...divination, includeClassics });
    assert.equal(result.status, 400);
    assert.match(JSON.stringify(result.body), /includeClassics.*布尔值/);
  }
});

const promptMethods: Record<string, string> = {
  'bazi/prompt': 'bazi',
  'bazi/compatibility/prompt': 'bazi',
  'ziwei/prompt': 'ziwei',
  'ziwei/compatibility/prompt': 'ziwei',
  'bazi-ziwei/prompt': 'bazi-ziwei',
  'consultation/thematic/prompt': 'bazi-ziwei',
  'divination/liuyao/prompt': 'liuyao',
  'divination/meihua/prompt': 'meihua',
  'divination/xiaoliuren/prompt': 'xiaoliuren',
  'divination/jinkoujue/prompt': 'jinkoujue',
  'divination/qimen/prompt': 'qimen',
  'divination/qimen/lifetime/prompt': 'qimen-lifetime',
  'divination/liuren/prompt': 'liuren',
  'divination/almanac/prompt': 'almanac',
  'metaphysics/bazhai/prompt': 'bazhai',
  'metaphysics/residential/prompt': 'residential',
  'metaphysics/xuankong/prompt': 'xuankong',
  'metaphysics/taiyi/prompt': 'taiyi',
  'metaphysics/wuyun-liuqi/prompt': 'wuyun-liuqi',
  'metaphysics/huangji-jingshi/prompt': 'huangji-jingshi',
  'metaphysics/qizheng/prompt': 'qizheng',
};

test('OpenAPI 只在具有经典目录的提示词路径暴露布尔开关', () => {
  const document = getPublicApiOpenApiDocument();
  for (const [path, operation] of Object.entries(document.paths)) {
    if (!('post' in operation)) continue;
    const expected = supportsClassicalReferences(promptMethods[path.slice(1)] ?? '');
    assert.equal(JSON.stringify(operation.post).includes('includeClassics'), expected, path);
    if (expected)
      assert.match(JSON.stringify(operation.post), /"includeClassics":\{"type":"boolean"/);
  }
});

test('公开合参分册经典依据只覆盖当前计算的体系，主题咨询跟随选定方法', async () => {
  for (const path of ['bazi-ziwei/prompt', 'consultation/thematic/prompt']) {
    for (const [section, method] of [
      ['bazi-natal', 'bazi'],
      ['bazi-fortune', 'bazi'],
      ['ziwei-scope', 'ziwei'],
      ['ziwei-fortune', 'ziwei'],
    ]) {
      const page = await callApi(path, {
        ...birth,
        promptScope: 'full',
        combinedBatch: { section, startIndex: 0 },
        includeClassics: true,
      });
      assert.equal(page.status, 200, JSON.stringify(page.body));
      assert.equal(page.body.data.batch.combinedBatch.section, section);
      assertClassics(page.body.data, method);
    }
  }
  for (const methodId of ['bazi', 'ziwei']) {
    const selected = await callApi('consultation/thematic/prompt', {
      ...birth,
      methodId,
      system: 'bazi_ziwei',
      promptScope: 'origin',
      includeClassics: true,
    });
    assert.equal(selected.status, 200, JSON.stringify(selected.body));
    assertClassics(selected.body.data, methodId);
  }
});

const server = createMingyuMcpServer();
const client = new Client({ name: 'classical-prompt-options-test', version: '1.0.0' });
before(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});
after(async () => {
  await client.close();
  await server.close();
});

test('MCP 工具目录与 OpenAPI 一致，仅支持体系暴露经典开关及输出字段', async () => {
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const catalog = TOOL_CATALOG.find((item) => item.id === tool.name);
    const method = promptMethods[catalog?.endpoint?.slice(1) ?? ''] ?? '';
    const expected = catalog?.type === 'prompt' && supportsClassicalReferences(method);
    assert.equal('includeClassics' in (tool.inputSchema.properties ?? {}), expected, tool.name);
    assert.equal(
      JSON.stringify(tool.outputSchema).includes('classicalReferences'),
      expected,
      tool.name,
    );
    if (expected) assert.equal(tool.inputSchema.properties?.includeClassics?.type, 'boolean');
  }
});

test('MCP 开启后文本与结构化提示词相同，三种返回模式均保留经典资料', async () => {
  for (const [name, method, input] of [
    ['bazi_prompt', 'bazi', { ...birth, baziFortuneScope: 'natal' }],
    ['meihua_prompt', 'meihua', divination],
  ] as const) {
    for (const responseMode of ['prompt-only', 'summary', 'full']) {
      const args = { ...input, responseMode };
      const baseline = await client.callTool({ name, arguments: args });
      const disabled = await client.callTool({
        name,
        arguments: { ...args, includeClassics: false },
      });
      const enabled = await client.callTool({
        name,
        arguments: { ...args, includeClassics: true },
      });
      assert.equal(baseline.isError, undefined, JSON.stringify(baseline));
      assert.equal(enabled.isError, undefined, JSON.stringify(enabled));
      assert.deepEqual(disabled.structuredContent, baseline.structuredContent);
      const content = enabled.structuredContent as Record<string, unknown>;
      assertClassics(content, method);
      assert.equal(enabled.content.find((item) => item.type === 'text')?.text, content.prompt);
    }
  }
});

test('MCP 对经典开关使用严格布尔类型校验', async () => {
  for (const includeClassics of ['true', 1, null]) {
    const result = await client.callTool({
      name: 'meihua_prompt',
      arguments: { ...divination, includeClassics },
    });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /includeClassics/);
  }
});

test('MCP 合参和主题咨询分册经典资料跟随本册，单体系咨询按实际结果选择', async () => {
  for (const name of ['bazi_ziwei_prompt', 'thematic_consultation_prompt']) {
    for (const [section, method] of [
      ['bazi-natal', 'bazi'],
      ['bazi-fortune', 'bazi'],
      ['ziwei-scope', 'ziwei'],
      ['ziwei-fortune', 'ziwei'],
    ]) {
      const page = await client.callTool({
        name,
        arguments: {
          ...birth,
          promptScope: 'full',
          combinedBatch: { section, startIndex: 0 },
          includeClassics: true,
          responseMode: 'prompt-only',
        },
      });
      assert.equal(page.isError, undefined, JSON.stringify(page));
      assertClassics(page.structuredContent as Record<string, unknown>, method);
    }
  }
  for (const methodId of ['bazi', 'ziwei']) {
    const selected = await client.callTool({
      name: 'thematic_consultation_prompt',
      arguments: {
        ...birth,
        methodId,
        system: 'bazi_ziwei',
        promptScope: 'origin',
        includeClassics: true,
        responseMode: 'summary',
      },
    });
    assert.equal(selected.isError, undefined, JSON.stringify(selected));
    assertClassics(selected.structuredContent as Record<string, unknown>, methodId);
  }
});
