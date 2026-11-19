import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { lookupCharacters, searchCharacters } from '../src/systems/characters';
import worker from '../src/worker';
import { browserCharacterShard } from '../src/character-data';

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const question = '如何理解这些字？';

test('浏览器字库分片合并并发请求，失败后可重试', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = async () => { requests++; return new Response(JSON.stringify({ 1: '资料' }), { headers: { 'content-type': 'application/json' } }); };
    const [a, b] = await Promise.all([browserCharacterShard('definitions', 29), browserCharacterShard('definitions', 29)]);
    assert.deepEqual(a, b); assert.equal(requests, 1);
    globalThis.fetch = async () => { requests++; return requests === 2 ? new Response('missing', { status: 404 }) : new Response('{}', { headers: { 'content-type': 'application/json' } }); };
    await assert.rejects(() => browserCharacterShard('references', 29), /字库资源缺失/);
    await browserCharacterShard('references', 29);
    assert.equal(requests, 3);
  } finally { globalThis.fetch = original; }
});

test('原资料可追问，修改笔画或原文后拒绝复用', async () => {
  for (const query of [{ kind: 'text', text: '复複髮𠮷' }, { kind: 'text', text: '知远', includeReferences: false }, { kind: 'search', pinyin: 'an', limit: 3 }] as const) {
    const result = await calculate('character-query', { question, query });
    const saved = plain(result), next = await reprompt({ method: 'character-query', result: saved, question: '如何搭配？' });
    assert.match(next.prompt.text, /如何搭配/);
    if ('characters' in saved.data.result) {
      const entry = saved.data.result.characters.find((item: any) => item.detail);
      entry.detail.kangxiStrokes = 100;
    } else saved.data.result.items[0].definition = '伪造';
    await assert.rejects(() => reprompt({ method: 'character-query', result: saved, question }), /不一致/);
  }
  for (const query of [{ kind: 'text', text: '你好A' }, { kind: 'text', text: '一'.repeat(21) }, { kind: 'search', limit: 101 }]) {
    await assert.rejects(() => calculate('character-query', { question, query }));
  }
});

test('HTTP 与 MCP 返回同一查询及追问', async () => {
  const input = { query: { kind: 'text', text: '知远' }, question, currentTime: '2025-01-01T00:00:00Z' };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'character-query' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'character-query', input });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.prompt.text, /康熙字典原文/);
  assert.equal((await send('/api/prompt', { method: 'character-query', result, question: '追问' })).status, 200);
  const [ct, st] = InMemoryTransport.createLinkedPair(), server = createServer(['character-query']), client = new Client({ name: 'character-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    const computed = await client.callTool({ name: 'character-query', arguments: input });
    assert.deepEqual(computed.structuredContent?.data, result.data);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method: 'character-query', result: computed.structuredContent, question: '追问' } });
    assert.equal(follow.isError, undefined);
    assert.match(String((follow.structuredContent?.prompt as { text: string }).text), /追问/);
  } finally { await client.close(); await server.close(); }
});
test('字库筛选可按顺序分页且参数错误明确拒绝', async () => {
  const first = await searchCharacters({ radical: '木', limit: 25 });
  const second = await searchCharacters({ radical: '木', limit: 25, offset: first.nextOffset! });
  const combined = await searchCharacters({ radical: '木', limit: 50 });
  assert.deepEqual([...first.items, ...second.items], combined.items);
  assert.ok(combined.items.every((item) => item.radical === '木'));
  assert.equal(combined.total, first.total);
  assert.equal(new Set(combined.items.map((item) => item.char)).size, combined.items.length);
  await assert.rejects(() => searchCharacters({ strokesMin: 10, strokesMax: 5 }), /最小笔画/);
  const missing = await lookupCharacters('𠮷髮', true);
  assert.deepEqual(missing.unknownCharacters, ['𠮷']);
  assert.equal(missing.totalKangxiStrokes, null);
});

test('现代起名高频字与常用姓氏用字均可查到笔画、五行、拼音与释义', async () => {
  const groups = ['梓瑜皓熠焓煊垚淼焱鑫', '笙珩珝栀柚姝妤婧婷娴', '你嗯邰'];
  for (const group of groups) {
    const res = await lookupCharacters(group, true);
    assert.deepEqual(res.unknownCharacters, []);
    assert.equal(typeof res.totalKangxiStrokes, 'number');
    for (const item of res.characters) {
      assert.ok(item.detail, `${item.char} 应有详情`);
      assert.ok(item.detail.kangxiStrokes > 0, `${item.char} 应有康熙笔画`);
      assert.ok(item.detail.wuxing, `${item.char} 应有五行`);
      assert.ok(item.detail.pinyin, `${item.char} 应有拼音`);
      assert.ok(item.detail.definition, `${item.char} 应有释义`);
    }
  }
});
