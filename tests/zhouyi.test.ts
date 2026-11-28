import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { ensureZhouyiTextsLoaded, getAllHexagrams } from '../src/systems/zhouyi-text';
import hexagrams from '../src/systems/huangji-hexagrams.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';

test('原文检索按卦分页，保留命中字段及可追溯版本', async () => {
  const result: any = await calculate('zhouyi', { query: { kind: 'search', text: '天行健' }, currentTime });
  assert.ok(result.data.result.items.some((item: any) => item.id === 1 && item.matches.some((match: any) => match.field === '大象')));
  const seen: number[] = [];
  let offset: number | null = 0, total = 0;
  do {
    const page: any = await calculate('zhouyi', { query: { kind: 'search', text: '象曰', offset, limit: 7 }, currentTime });
    total = page.data.result.total;
    for (const item of page.data.result.items) { seen.push(item.id); assert.match(item.sourceUrl, /oldid=\d+$/); assert.ok(item.matches.every((m: any) => m.excerpt.includes('象曰'))); }
    offset = page.data.result.nextOffset;
  } while (offset !== null);
  assert.equal(total, 64); assert.equal(seen.length, 64); assert.equal(new Set(seen).size, 64);
  const empty: any = await calculate('zhouyi', { query: { kind: 'search', text: '不存在的字串' }, currentTime });
  assert.equal(empty.data.result.total, 0); assert.equal(empty.data.result.nextOffset, null);
});

test('六爻 64 卦与 384 种动爻只引用实际卦象和动爻原文', async () => {
  await ensureZhouyiTextsLoaded();
  const allHexagrams = getAllHexagrams();
  for (const item of hexagrams) for (let line = 1; line <= 6; line++) {
    const code = item.binarySymbol.slice(3) + item.binarySymbol.slice(0, 3);
    const yaos = [...code].map((bit, index) => index + 1 === line ? bit === '1' ? 9 : 6 : bit === '1' ? 7 : 8);
    const result: any = await calculate('liuyao', { question: '问题', currentTime, liuyao: { method: 'manual', yaos }, prompt: { includeClassics: true } });
    assert.equal(result.data.originalName, item.name);
    const expected = allHexagrams.find((hexagram) => hexagram.id === item.id)!, currentLine = expected.yaos[line - 1];
    assert.ok(result.prompt.text.includes(currentLine.yaoCi), `${item.name}/${line}`);
    assert.ok(result.prompt.text.includes(currentLine.xiaoXiang), `${item.name}/${line}`);
    assert.ok(result.prompt.text.includes(expected.tuanCi), item.name);
    assert.match(result.prompt.text, /经文来源.*CC BY-SA 4\.0/);
  }
  const plain: any = await calculate('liuyao', { question: '问题', currentTime, liuyao: { method: 'manual', yaos: [7, 7, 7, 7, 7, 7] } });
  assert.doesNotMatch(plain.prompt.text, /【周易经文】/);
  const follow = await reprompt({ method: 'liuyao', result: plain, question: '继续问', prompt: { includeClassics: true } });
  assert.match(follow.prompt.text, /大哉乾元/); assert.match(follow.prompt.text, /继续问/);
  for (const [yao, phrase] of [[9, '用九：见群龙无首'], [6, '用六：利永贞']] as const) {
    const six: any = await calculate('liuyao', { question: '问题', currentTime, liuyao: { method: 'manual', yaos: Array(6).fill(yao) }, prompt: { includeClassics: true } });
    assert.ok(six.prompt.text.includes(phrase));
  }
});

test('梅花与六爻时间范围的经典资料跟随保存的卦与动爻', async () => {
  await ensureZhouyiTextsLoaded();
  const allHexagrams = getAllHexagrams();
  const meihua: any = await calculate('meihua', { question: '问题', currentTime, meihua: { method: 'number', number: 123 }, prompt: { includeClassics: true } });
  const text = allHexagrams.find((item) => item.name === meihua.data.originalName)!;
  assert.ok(meihua.prompt.text.includes(text.yaos[meihua.data.movingYao.position - 1].xiaoXiang));
  assert.match((await reprompt({ method: 'meihua', result: meihua, question: '继续', prompt: { includeClassics: true } })).prompt.text, /经文来源/);
  const ranged: any = await calculate('liuyao', { question: '问题', currentTime, range: { start: '2024-02-04T07:00:00Z', end: '2024-02-04T09:00:00Z' }, liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 7, 7] }, prompt: { includeClassics: true } });
  assert.ok(ranged.data.branches.length > 1); assert.match(ranged.prompt.text, /潜龙勿用/);
  assert.match((await reprompt({ method: 'liuyao', result: ranged, question: '继续', prompt: { includeClassics: true } })).prompt.text, /潜龙勿用/);
});

test('原文可保存追问，拒绝篡改；HTTP 和 MCP 公开同一资料', async () => {
  const result: any = await calculate('zhouyi', { query: { kind: 'hexagram', id: 1 }, question: '问题', currentTime });
  const next = await reprompt({ method: 'zhouyi', result, question: '继续问' }); assert.match(next.prompt.text, /继续问/);
  const bad = structuredClone(result); bad.data.result.hexagram.guaCi = '伪造';
  await assert.rejects(() => reprompt({ method: 'zhouyi', result: bad, question: '继续问' }), /不一致/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'zhouyi,liuyao' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { query: { kind: 'hexagram', id: 2, line: 1 }, question: '问题', currentTime };
  const response = await send('/api/calculate', { method: 'zhouyi', input }); assert.equal(response.status, 200); const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'zhouyi', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'zhouyi', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
});
