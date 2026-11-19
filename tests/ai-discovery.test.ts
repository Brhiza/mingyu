import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, enabledMethods } from '../src/mcp';
import { inputSchemas, methodIds } from '../src/schema';
import { getPromptCatalog } from '../src/catalog';
import { z } from 'zod';
import worker from '../src/worker';

test('HTTP 与 MCP 公开一致的任务说明，AI 能区分查询、起卦和出生盘', async () => {
  const env = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } };
  const response = await worker.fetch(new Request('https://local/api/schema'), env);
  assert.equal(response.status, 200);
  const schema = await response.json() as { methods: Record<string, { description: string }> };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: 'discovery-test', version: '1' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    for (const method of methodIds) {
      const description = schema.methods[method]?.description;
      const tool = tools.find((item) => item.name === method);
      assert.ok(description, `${method} 缺少任务描述`);
      assert.ok(tool?.description?.includes(description), `${method} 的 MCP 和 HTTP 任务描述不一致`);
    }
    assert.match(tools.find((tool) => tool.name === 'zhouyi')!.description!, /查询|检索/);
    assert.match(tools.find((tool) => tool.name === 'tarot')!.description!, /随机抽牌|已选牌号/);
    assert.match(tools.find((tool) => tool.name === 'instant')!.description!, /不是个人出生盘/);
    assert.match(tools.find((tool) => tool.name === 'bazi')!.description!, /用神裁定/);
  } finally {
    await client.close();
    await server.close();
  }
});

test('出生盘方法使用统一名称，旧预览名称不能用于发现、调用或配置', async () => {
  const methods = ['bazi', 'bazi-synastry', 'ziwei', 'ziwei-synastry', 'bazi-ziwei', 'astrolabe', 'astrolabe-synastry'] as const;
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: methods.join(',') };
  const response = await worker.fetch(new Request('https://local/api/methods'), env);
  assert.deepEqual((await response.json() as { methods: string[] }).methods, [...methods]);
  assert.deepEqual(enabledMethods(methods.join(',')), [...methods]);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(methods);
  const client = new Client({ name: 'method-name-test', version: '1' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const method of methods) {
      const old = `${method}-independent`;
      assert.ok(names.includes(method));
      assert.ok(!names.includes(old));
      assert.throws(() => enabledMethods(old), /未知方法/);
      const rejected = await worker.fetch(new Request('https://local/api/calculate', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: old, input: {} }),
      }), env);
      assert.equal(rejected.status, 400, old);
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test('术数路由参考覆盖实际方法，且不引导调用已移除的旧入口', () => {
  const routing = readFileSync(new URL('../skills/mingyu/references/routing.md', import.meta.url), 'utf8');
  const rows = [...routing.matchAll(/^\|[^\n]*\| `([^`]+)` \|/gm)].map((match) => match[1]);
  assert.equal(new Set(rows).size, rows.length);
  assert.deepEqual([...rows].sort(), [...methodIds].sort());
});

test('Skill 的按需参考均存在，调用关键边界没有遗漏', () => {
  const root = fileURLToPath(new URL('../skills/mingyu/', import.meta.url));
  const files = ['SKILL.md', ...readdirSync(resolve(root, 'references')).filter((name) => name.endsWith('.md')).map((name) => `references/${name}`)];
  for (const name of files) {
    const path = resolve(root, name), content = readFileSync(path, 'utf8');
    for (const [, target] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|#)/.test(target)) continue;
      assert.doesNotThrow(() => readFileSync(resolve(dirname(path), target), 'utf8'), `${name} → ${target}`);
    }
  }
  const main = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
  for (const reference of ['birth-and-astrology.md', 'event-divination.md', 'reference-tools.md', 'interpretation.md']) assert.ok(main.includes(reference), reference);
  assert.match(main, /省略 `prompt` 时沿用/);
  assert.match(readFileSync(resolve(root, 'references/birth-and-astrology.md'), 'utf8'), /出生分页完成后仍须检查/);
  assert.match(readFileSync(resolve(root, 'references/event-divination.md'), 'utf8'), /全部分支和追问复用/);
  assert.match(readFileSync(resolve(root, 'references/interpretation.md'), 'utf8'), /盘面、传统取义与现实判断分开/);
});

test('提示词目录覆盖每种术数 schema 中所有枚举选项', () => {
  const catalog = getPromptCatalog(methodIds) as Record<string, Record<string, unknown>>;
  for (const method of methodIds) {
    const schema = z.toJSONSchema(inputSchemas[method]) as any;
    const fields = schema.properties?.prompt?.properties ?? {};
    for (const [field, definition] of Object.entries(fields) as [string, any][]) {
      const expected = definition.enum ?? definition.items?.enum;
      if (!expected) continue;
      const names = field === 'topic' || field === 'topicId' ? ['topicIds', 'topics']
        : field === 'scope' ? ['scopeIds', 'scopes']
        : field === 'detailMode' ? ['detailModes', 'detailMode']
        : field === 'detailLevel' ? ['detailLevels', 'detailLevel'] : [field];
      const value = names.map((name) => catalog[method]?.[name]).find((item) => item !== undefined);
      assert.ok(value, `${method} 提示词目录缺少 ${field}`);
      const ids = Array.isArray(value) ? value.map((item) => typeof item === 'string' ? item : item.id) : Object.keys(value as object);
      assert.deepEqual([...ids].sort(), [...expected].sort(), `${method}/${field}`);
    }
  }
});

test('HTTP 和 MCP 能发现星盘范围主题、断事模板与明细选项', async () => {
  const enabled = ['astrolabe-range', 'liuyao', 'liuren', 'qizheng', 'qimen-lifetime', 'bazi-ziwei', 'bazi'] as const;
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: enabled.join(',') };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(enabled);
  const client = new Client({ name: 'catalog-test', version: '1' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    for (const method of enabled) {
      const http = await worker.fetch(new Request(`https://local/api/prompts?method=${method}`), env);
      assert.equal(http.status, 200, method);
      const body = await http.json() as any;
      const mcp = await client.callTool({ name: 'prompt_catalog', arguments: { method } });
      assert.deepEqual(mcp.structuredContent, body, method);
    }
    const all = getPromptCatalog(enabled) as any;
    assert.ok(all['astrolabe-range'].topicIds.includes('job-change'));
    assert.ok(all['astrolabe-range'].schools.includes('traditional'));
    assert.ok(all.liuyao.liuyaoTemplate.includes('guaishen'));
    assert.ok(all.liuren.liurenTemplate.includes('ganqing'));
    assert.deepEqual(all.qizheng.eventDetail, ['summary', 'full']);
    assert.deepEqual(all['qimen-lifetime'].detailModes, ['compact', 'full']);
    assert.ok(all['bazi-ziwei'].detailLevels.includes('professional'));
    assert.match(all.bazi.note, /双人合盘使用 bazi-synastry/);
    assert.match(all.bazi.note, /用神裁定/);
  } finally {
    await client.close();
    await server.close();
  }
});

test('HTTP 按方法查询 schema 和提示词，保留启用范围与鉴权', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'tarot,liuyao' };
  const get = (path: string, settings = env, headers?: HeadersInit) => worker.fetch(new Request(`https://local${path}`, { headers }), settings);
  const allSchema = await (await get('/api/schema')).json() as any;
  const allCatalog = await (await get('/api/prompts')).json() as any;
  const singleSchemaResponse = await get('/api/schema?method=tarot');
  const singleSchema = await singleSchemaResponse.json() as any;
  const singleCatalog = await (await get('/api/prompts?method=tarot')).json() as any;
  assert.equal(singleSchemaResponse.status, 200);
  assert.deepEqual(Object.keys(singleSchema.methods), ['tarot']);
  assert.deepEqual(singleSchema.methods.tarot, allSchema.methods.tarot);
  assert.deepEqual(singleSchema.reprompt.properties.method.enum, ['tarot']);
  assert.deepEqual(singleSchema.reprompt.properties.result.properties.method.enum, ['tarot']);
  assert.deepEqual(singleCatalog.methods, { tarot: allCatalog.methods.tarot });
  assert.ok(JSON.stringify(singleSchema).length < JSON.stringify(allSchema).length);
  for (const path of ['/api/schema', '/api/prompts']) {
    for (const query of ['?method=', '?method=bazi-independent', '?method=unknown', '?method=tarot&method=liuyao', '?method=tarot&method=tarot']) {
      const bad = await get(path + query); assert.equal(bad.status, 400, path + query);
      assert.deepEqual(await bad.json(), { error: '术数不存在、未启用或参数重复' });
    }
    const protectedEnv = { ...env, ACCESS_TOKEN: 'test-secret' };
    assert.equal((await get(`${path}?method=tarot`, protectedEnv)).status, 401);
    assert.equal((await get(`${path}?method=tarot`, protectedEnv, { authorization: 'Bearer test-secret' })).status, 200);
    assert.equal((await get(`${path}?method=bazi-independent`, protectedEnv, { authorization: 'Bearer test-secret' })).status, 400);
  }
});

test('复用方法 schema 时仍按每次部署配置筛选并验证访问令牌', async () => {
  const assets = { fetch: async () => new Response('asset') };
  const request = (path: string, token?: string) => new Request(`https://local${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const first = { ASSETS: assets, ENABLED_METHODS: 'tarot,liuyao', ACCESS_TOKEN: 'first-key' };
  const second = { ASSETS: assets, ENABLED_METHODS: 'liuyao', ACCESS_TOKEN: 'second-key' };
  const initial = await worker.fetch(request('/api/schema', 'first-key'), first);
  const original = await initial.json() as any;
  assert.deepEqual(Object.keys(original.methods), ['tarot', 'liuyao']);
  assert.equal((await worker.fetch(request('/api/schema', 'first-key'), second)).status, 401);
  assert.equal((await worker.fetch(request('/api/schema?method=tarot', 'second-key'), second)).status, 400);
  const narrowed = await worker.fetch(request('/api/schema', 'second-key'), second);
  const body = await narrowed.json() as any;
  assert.deepEqual(Object.keys(body.methods), ['liuyao']);
  assert.deepEqual(body.methods.liuyao, original.methods.liuyao);
  assert.deepEqual(body.reprompt.properties.method.enum, ['liuyao']);
  assert.deepEqual(body.reprompt.properties.result.properties.method.enum, ['liuyao']);
});
