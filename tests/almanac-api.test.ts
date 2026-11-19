import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { question: '怎么比较？', topic: 'marriage', startDate: '2026-06-15', endDate: '2026-06-15' };

test('范围、宜忌冲突、自定义事项和不支持的个人资料均明确', async () => {
  const result = await calculate('almanac', input);
  assert.deepEqual(result.data.days[0].match.support, ['嫁娶']);
  assert.ok(result.data.recommendations);
  assert.equal(result.data.recommendations.ranked.length, 1);
  assert.match(result.prompt.text, /【综合择日分级与吉时推荐】/);
  assert.deepEqual(result.data.days[0].match.caution, ['纳采', '订盟']);
  assert.match(result.prompt.text, /不能忽视宜忌同时命中/);
  assert.equal(result.data.days[0].hours[0].range, '00:00-01:00');
  assert.equal(result.data.days[0].hours[12].range, '23:00-24:00');
  assert.equal(result.data.days[0].traditionalFacts.zodiac, '马');
  assert.ok(result.data.days[0].traditionalFacts.nineStar.color);
  assert.ok(result.data.days[0].traditionalFacts.nineStar.wuxing);
  assert.ok(result.prompt.text.includes(result.data.days[0].traditionalFacts.pengzu.stem));
  assert.ok(result.prompt.text.includes(result.data.days[0].traditionalFacts.pengzu.branch));
  const crossYear = await calculate('almanac', { ...input, startDate: '2024-12-31', endDate: '2025-01-02' });
  assert.deepEqual(crossYear.data.days.map((day: any) => day.date), ['2024-12-31', '2025-01-01', '2025-01-02']);
  const maxRange = await calculate('almanac', { ...input, startDate: '2026-01-01', endDate: '2026-06-29' });
  assert.equal(maxRange.data.days.length, 180);
  const selected = await calculate('almanac', { ...input, startDate: '2026-06-15', endDate: '2026-06-17', prompt: { dates: ['2026-06-16'] } });
  assert.equal(selected.data.days.length, 3);
  assert.match(selected.prompt.text, /提示词列出1天，其余2天未列入/);
  assert.match(selected.prompt.text, /2026-06-16 星期/);
  assert.doesNotMatch(selected.prompt.text, /2026-06-15 星期/);
  assert.match((await reprompt({ method: 'almanac', result: selected, question: '继续' })).prompt.text, /2026-06-16 星期/);
  const switched = await reprompt({ method: 'almanac', result: selected, question: '继续', prompt: { dates: ['2026-06-17'] } });
  assert.match(switched.prompt.text, /2026-06-17 星期/);
  assert.doesNotMatch(switched.prompt.text, /2026-06-16 星期/);
  await assert.rejects(() => reprompt({ method: 'almanac', result: selected, question: '继续', prompt: { dates: ['2026-06-18'] } }), /原始结果范围/);
  const custom = await calculate('almanac', { ...input, topic: 'custom', customKeyword: '祭祀' });
  assert.deepEqual(custom.data.days[0].match.support, ['祭祀']);
  for (const invalid of [
    { ...input, topic: 'custom' }, { ...input, customKeyword: '祭祀' }, { ...input, startDate: '2024-02-30' },
    { ...input, startDate: '2026-06-16' }, { ...input, startDate: '2026-01-01', endDate: '2026-06-30' },
    { ...input, participants: [{ name: '甲', birthYear: 1990 }] }, { ...input, prompt: { dates: ['2026-06-16'] } },
    { ...input, prompt: { dates: ['2026-06-15', '2026-06-15'] } },
  ]) await assert.rejects(() => calculate('almanac', invalid));
});

test('已有资料追问重算核验，HTTP 和 MCP 返回一致', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'almanac' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'almanac', input }); assert.equal(http.status, 200);
  const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'almanac', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.match((await reprompt({ method: 'almanac', result: saved, question: '继续问' })).prompt.text, /继续问/);
  saved.data.days[0].hours[0].match.support.push('伪造');
  assert.equal((await send('/api/prompt', { method: 'almanac', result: saved, question: '继续问' })).status, 400);
});
