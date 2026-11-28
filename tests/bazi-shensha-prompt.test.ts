import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { calculateBaziShensha, formatBaziShensha, formatBaziShenshaHits, partitionBaziShensha } from '../src/systems/bazi/shensha';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } as const;
const person1 = { ...birth, name: '甲' };
const person2 = { year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8, name: '乙' } as const;

test('未知时辰的完整提示词为每个实际候选保留神煞起例', async () => {
  const input = { birth: { ...birth, clock: { kind: 'unknown' } }, gender: 'female', question: '问题', prompt: { detailMode: 'full' } };
  const result = await calculate('bazi', input);
  const parts = partitionBaziShensha(result.data.unknown!.segments.map((segment) => segment.shensha));
  assert.ok(result.prompt.text.includes(formatBaziShenshaHits(parts.common, true, '没有共同命中项')));
  for (const [index, part] of parts.differences.entries()) {
    assert.ok(result.prompt.text.includes(formatBaziShenshaHits(part, true, '无额外命中')));
    const original = result.data.unknown!.segments[index].shensha;
    assert.deepEqual([...parts.common.entries, ...part.entries].map((item) => JSON.stringify(item)).sort(), original.entries.map((item) => JSON.stringify(item)).sort());
    assert.deepEqual([...parts.common.global, ...part.global].map((item) => JSON.stringify(item)).sort(), original.global.map((item) => JSON.stringify(item)).sort());
  }
  const repeated = result.data.unknown!.segments.map((segment) => formatBaziShenshaHits(segment.shensha, true)).join('\n');
  const compact = [formatBaziShenshaHits(parts.common, true), ...parts.differences.map((value) => formatBaziShenshaHits(value, true))].join('\n');
  assert.ok(compact.length < repeated.length);
  assert.match(result.prompt.text, /不得将某个候选时段当作已确定出生时间/);
  const reply = await reprompt({ method: 'bazi', result, question: '继续', prompt: { detailMode: 'full' } });
  assert.ok(reply.prompt.text.includes(formatBaziShenshaHits(parts.common, true, '没有共同命中项')));
});

test('候选命中名称相同但起例不同时不合并成共同事实', () => {
  const a = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '丙寅', day: '丙申', hour: '己亥' }));
  const b = calculateBaziShensha(buildPillarFacts({ year: '庚子', month: '丙寅', day: '丙申', hour: '己亥' }));
  const parts = partitionBaziShensha([a, b]);
  const isMatch = (entry: { name: string; position: string }) => entry.name === '福星贵人' && entry.position === 'month';
  assert.ok(a.entries.some(isMatch)); assert.ok(b.entries.some(isMatch));
  assert.ok(!parts.common.entries.some(isMatch));
  assert.ok(parts.differences.every((item) => item.entries.some(isMatch)));
});

test('八字双盘分别展示双方实际神煞，缺性别时标明元辰未计算', async () => {
  const input = { person1, person2, relationship: 'marriage', question: '双方如何相处？', prompt: { detailMode: 'full' } };
  const result = await calculate('bazi-synastry', input);
  for (const [person, id] of [['甲', 'person1'], ['乙', 'person2']] as const) {
    const facts = result.data.charts[id].shensha;
    assert.equal(facts.included.length, 69);
    assert.ok(result.prompt.text.includes(`${person}：${formatBaziShenshaHits(facts, true)}`));
  }
  assert.match(result.prompt.text, /元辰、铁扫帚因未提供性别未计算/);
  const reply = await reprompt({ method: 'bazi-synastry', result, question: '工作合作？', prompt: { detailMode: 'full' } });
  assert.ok(reply.prompt.text.includes(formatBaziShenshaHits(result.data.charts.person1.shensha, true)));
  const altered = structuredClone(result); altered.data.charts.person1.shensha.entries.pop();
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: altered, question: '问题' }), /不一致/);
});

test('八字双盘的性别独立填写，未提供者不推测且不影响四柱', async () => {
  const question = '合作如何？';
  const base = await calculate('bazi-synastry', { person1, person2, question });
  const input = { person1: { ...person1, gender: 'female' }, person2, question, prompt: { detailMode: 'full' } };
  const mixed = await calculate('bazi-synastry', input);
  assert.deepEqual(mixed.data.charts.person1.pillars, base.data.charts.person1.pillars);
  assert.deepEqual(mixed.data.charts.person2.pillars, base.data.charts.person2.pillars);
  assert.equal(mixed.data.charts.person1.shensha.included.length, 71);
  assert.deepEqual(mixed.data.charts.person1.shensha.unavailable, []);
  assert.equal(mixed.data.charts.person2.shensha.included.length, 69);
  assert.deepEqual(mixed.data.charts.person2.shensha.unavailable.map((item) => item.name), ['元辰', '铁扫帚']);
  assert.match(mixed.prompt.text, /甲：仅列71项本命神煞/);
  assert.match(mixed.prompt.text, /乙：仅列69项本命神煞（元辰、铁扫帚因未提供性别未计算）/);
  const reply = await reprompt({ method: 'bazi-synastry', result: mixed, question: '继续' });
  assert.match(reply.prompt.text, /甲：仅列71项本命神煞/);
  assert.match(reply.prompt.text, /乙：仅列69项本命神煞/);
  const sensitive = await calculate('bazi-synastry', { ...input, person1: { ...person1, gender: 'female', clock: { kind: 'exact', hour: 21, minute: 0, second: 0 } } });
  const altered = structuredClone(sensitive); altered.data.input.person1.gender = 'male';
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: altered, question: '继续' }), /不一致/);
  const uncertain = await calculate('bazi-synastry', { ...input, person1: { ...person1, gender: 'female', clock: { kind: 'shichen', index: 8 }, candidateIndex: 0 }, person2: { ...person2, gender: 'male' } });
  assert.equal(uncertain.data.charts.person1.shensha.included.length, 71);
  assert.equal(uncertain.data.charts.person2.shensha.included.length, 71);
  const first = uncertain.data.charts.person1;
  assert.deepEqual(first.shensha, calculateBaziShensha(first.pillars, 'female'));
});

test('八字双盘选择出生候选时只展示该候选的神煞', async () => {
  const input = { person1: { ...person1, clock: { kind: 'shichen', index: 8 }, candidateIndex: 0 }, person2, question: '双方如何相处？', prompt: { detailMode: 'full' } };
  const result = await calculate('bazi-synastry', input);
  assert.equal(result.data.charts.person1.candidate?.index, 0);
  assert.ok(result.prompt.text.includes(`甲：${formatBaziShenshaHits(result.data.charts.person1.shensha, true)}`));
  assert.match(result.prompt.text, /不能当作确定出生时刻或代表全部候选/);
  const reply = await reprompt({ method: 'bazi-synastry', result, question: '继续问', prompt: { detailMode: 'full' } });
  assert.ok(reply.prompt.text.includes(formatBaziShenshaHits(result.data.charts.person1.shensha, true)));
});

test('八字紫微合参按精确盘或出生时间交集使用对应神煞', async () => {
  const exact = await calculate('bazi-ziwei', { birth, gender: 'female', question: '问题' });
  assert.ok(exact.prompt.text.includes(formatBaziShenshaHits(exact.data.charts.bazi.chart!.shensha, false)));
  const exactPro = await calculate('bazi-ziwei', { birth, gender: 'female', question: '问题', prompt: { detailLevel: 'professional' } });
  assert.ok(exactPro.prompt.text.includes(formatBaziShensha(exactPro.data.charts.bazi.chart!.shensha)));
  const uncertainInput = { birth: { year: 2024, month: 2, day: 4, clock: { kind: 'shichen', index: 8 }, timezone: 8 }, gender: 'female', question: '问题' };
  const all = await calculate('bazi-ziwei', uncertainInput);
  assert.equal(all.data.alignment.kind, 'candidates');
  const parts = partitionBaziShensha(all.data.alignment.candidates.map((item) => all.data.charts.bazi.unknown!.segments[item.baziIndex].shensha));
  assert.ok(all.prompt.text.includes(`各候选共同：${formatBaziShenshaHits(parts.common, false, '没有共同命中项')}`));
  for (const [index, facts] of parts.differences.entries()) {
    assert.ok(all.prompt.text.includes(`候选 ${index}：${formatBaziShenshaHits(facts, false, '无额外命中')}`));
  }
  const chosen = all.data.alignment.candidates.at(-1)!;
  const index = all.data.alignment.candidates.length - 1;
  const reply = await reprompt({ method: 'bazi-ziwei', result: all, question: '继续', prompt: { candidateIndex: index } });
  const selected = all.data.charts.bazi.unknown!.segments[chosen.baziIndex].shensha;
  assert.ok(reply.prompt.text.includes(formatBaziShenshaHits(selected, false)));
  const replyPro = await reprompt({ method: 'bazi-ziwei', result: all, question: '继续', prompt: { candidateIndex: index, detailLevel: 'professional' } });
  assert.ok(replyPro.prompt.text.includes(formatBaziShensha(selected)));
  assert.match(reply.prompt.text, /该区间并非确定出生时刻/);
});

test('双盘提示词通过 HTTP 和远程 MCP 使用相同性别与神煞事实', async () => {
  const input = { person1: { ...person1, gender: 'female' }, person2, question: '双方如何相处？' };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi-synastry' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi-synastry', input });
  assert.equal(http.status, 200); const first: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi-synastry', arguments: input } });
  assert.equal(mcp.status, 200); const second: any = await mcp.json();
  assert.equal(first.prompt.text, second.result.structuredContent.prompt.text);
  assert.match(first.prompt.text, /双方本命神煞/);
  assert.equal(first.data.charts.person1.shensha.included.length, 71);
  assert.equal(first.data.charts.person2.shensha.included.length, 69);
});
