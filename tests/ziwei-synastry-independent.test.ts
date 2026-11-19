import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';
import worker from '../src/worker';
import { formatNatalFlying } from '../src/systems/ziwei-flying';

const person1 = { name: '甲', gender: 'female', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } } as const;
const person2 = { name: '乙', gender: 'male', birth: { year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8 } } as const;
const input = { question: '如何合作？', person1, person2, relationship: 'career', prompt: { schools: ['sanhe', 'sihua'] } } as const;

test('十二宫双向叠合、生年四化与本命飞化进入双盘提示词', async () => {
  const result = await calculate('ziwei-synastry', input), actual = result.data.selected.evidence;
  assert.equal(actual.overlays.length, 24); assert.equal(actual.crossMutagens.length, 8); assert.equal(actual.gaps.length, 0);
  assert.match(result.prompt.text, /【合作任务】/); assert.match(result.prompt.text, /三合/); assert.match(result.prompt.text, /四化/);
  assert.match(result.prompt.text, /【双方各自本命宫干四化】/);
  assert.ok(result.prompt.text.includes(formatNatalFlying(result.data.selected.natal.person1.palaces)));
  assert.ok(result.prompt.text.includes(formatNatalFlying(result.data.selected.natal.person2.palaces)));
  assert.match(result.prompt.text, /运限合参与完整专业证据尚未迁移/);
});

test('未知时辰自动比较全部组合，统计不是概率', async () => {
  const unknown = { ...person1, birth: { ...person1.birth, clock: { kind: 'unknown' } } };
  const result = await calculate('ziwei-synastry', { ...input, person1: unknown });
  assert.equal(result.data.selected, null); assert.equal(result.data.comparison.person1Candidates, 13); assert.equal(result.data.comparison.total, 13);
  assert.match(result.prompt.text, /不代表概率/); assert.match(result.prompt.text, /候选尚未确定|全部出生候选比较/);
  assert.doesNotMatch(result.prompt.text, /【双方各自本命宫干四化】/);
  const candidates = result.data.charts.person1.unknown.candidates;
  for (const entry of [...result.data.comparison.common, ...result.data.comparison.variable]) {
    assert.ok(entry.count >= 1 && entry.count <= 13); assert.ok(entry.example.person1Index >= 0);
  }
  const candidate = candidates[0], local = getCivilDateTimeAtFixedOffset(new Date(candidate.startTimestamp), candidate.timezone);
  const exact = { ...person1, birth: { ...person1.birth, year: local.year, month: local.month, day: local.day, timezone: candidate.timezone, clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second } } };
  const direct = await calculate('ziwei-synastry', { ...input, person1: exact });
  const selected = await calculate('ziwei-synastry', { ...input, person1: { ...unknown, candidateIndex: 0 }, compareCandidates: true });
  assert.deepEqual(selected.data.selected.evidence, direct.data.selected.evidence);
  assert.deepEqual(selected.data.comparison, result.data.comparison);
});

test('双方时辰跨真太阳时边界时逐组合统计，候选输入不可省略', async () => {
  const p1 = { ...person1, birth: { ...person1.birth, clock: { kind: 'shichen', index: 7 }, timeStandard: 'true-solar', longitude: 87.6 }, candidateIndex: 0 };
  const p2 = { ...person2, birth: { ...person2.birth, clock: { kind: 'shichen', index: 5 }, timeStandard: 'true-solar', longitude: 87.6 }, candidateIndex: 0 };
  const source = { ...input, person1: p1, person2: p2, compareCandidates: true, comparisonPage: { limit: 200 } };
  const result = await calculate('ziwei-synastry', source), comparison = result.data.comparison;
  assert.ok(comparison.person1Candidates >= 2 && comparison.person2Candidates >= 2); assert.equal(comparison.total, comparison.person1Candidates * comparison.person2Candidates);
  const counts = new Map<string, number>();
  for (const c1 of result.data.charts.person1.unknown.candidates) for (const c2 of result.data.charts.person2.unknown.candidates) {
    const asExact = (person: any, candidate: any) => {
      const local = getCivilDateTimeAtFixedOffset(new Date(candidate.startTimestamp), candidate.timezone);
      const { candidateIndex: _index, ...rest } = person;
      return { ...rest, birth: { ...person.birth, year: local.year, month: local.month, day: local.day, timezone: candidate.timezone, clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second } } };
    };
    const one = await calculate('ziwei-synastry', { ...input, person1: asExact(p1, c1), person2: asExact(p2, c2) });
    const evidence = one.data.selected.evidence;
    for (const key of new Set([...evidence.overlays, ...evidence.crossMutagens, ...evidence.gaps].map((fact: any) => JSON.stringify(fact)))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const item of [...comparison.common, ...comparison.variable]) assert.equal(item.count, counts.get(JSON.stringify(item.fact)));
  assert.equal(comparison.common.length + comparison.variable.length, counts.size);
  await assert.rejects(() => calculate('ziwei-synastry', { ...input, person1: { ...p1, candidateIndex: undefined }, compareCandidates: false }));
  await assert.rejects(() => calculate('ziwei-synastry', { ...input, person1: { ...p1, candidateIndex: 200 } }), /索引超出/);
  await assert.rejects(() => calculate('ziwei-synastry', { ...input, person1: { ...person1, candidateIndex: 0 } }));
});

test('变化事实逐页完整读取，页内顺序与计数不丢失或重复', async () => {
  const p1 = { ...person1, birth: { ...person1.birth, clock: { kind: 'shichen', index: 7 }, timeStandard: 'true-solar', longitude: 87.6 } };
  const p2 = { ...person2, birth: { ...person2.birth, clock: { kind: 'shichen', index: 5 }, timeStandard: 'true-solar', longitude: 87.6 } };
  const source = { ...input, person1: p1, person2: p2 };
  const reference = await calculate('ziwei-synastry', { ...source, comparisonPage: { limit: 200 } });
  const items = []; let offset: number | null = 0;
  while (offset !== null) {
    const page = await calculate('ziwei-synastry', { ...source, comparisonPage: { offset, limit: 17 } });
    assert.equal(page.data.comparison.page.offset, offset); assert.equal(page.data.comparison.variableTotal, reference.data.comparison.variableTotal);
    assert.deepEqual(page.data.comparison.common, reference.data.comparison.common);
    items.push(...page.data.comparison.variable); offset = page.data.comparison.page.nextOffset;
  }
  assert.deepEqual(items, reference.data.comparison.variable);
  assert.equal(new Set(items.map((item) => JSON.stringify(item.fact))).size, items.length);
  await assert.rejects(() => calculate('ziwei-synastry', { ...source, comparisonPage: { offset: 100000 } }), /偏移超出/);
  await assert.rejects(() => calculate('ziwei-synastry', { ...input, compareCandidates: false, comparisonPage: {} }));
});

test('关系类型、原双盘追问与完整证据验证', async () => {
  for (const relationship of ['marriage', 'career', 'friendship', 'children', 'parents', 'siblings']) {
    const result = await calculate('ziwei-synastry', { ...input, relationship }); assert.match(result.prompt.text, /任务/);
  }
  const first = await calculate('ziwei-synastry', input), saved = JSON.parse(JSON.stringify(first));
  const continued = await reprompt({ method: 'ziwei-synastry', result: saved, question: '接着问' });
  assert.match(continued.prompt.text, /接着问/); assert.match(continued.prompt.text, /三合/);
  saved.data.selected.evidence.crossMutagens[0].targetPalace = '伪造';
  await assert.rejects(() => reprompt({ method: 'ziwei-synastry', result: saved, question: '问题' }), /不一致/);
});

test('HTTP 与 MCP 使用相同双盘，可保存追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'ziwei-synastry' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'ziwei-synastry', input }); assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ziwei-synastry', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'ziwei-synastry', result: saved, question: '追问' })).status, 200);
});

test('大范围候选返回有限分页和轻量候选摘要', async () => {
  const person = { gender: 'female', birth: { year: 1969, month: 9, day: 30, clock: { kind: 'unknown' }, timeZoneId: 'Pacific/Kwajalein' } };
  const result = await calculate('ziwei-synastry', { question: '问题', person1: person, person2: person });
  assert.equal(result.data.comparison.total, 625); assert.ok(result.data.comparison.variableTotal > 1000);
  assert.equal(result.data.comparison.variable.length, 100); assert.equal(result.data.comparison.page.nextOffset, 100);
  assert.equal(result.data.charts.person1.unknown.candidates.length, 25);
  assert.ok(!('chart' in result.data.charts.person1.unknown.candidates[0]));
  assert.ok(new TextEncoder().encode(JSON.stringify(result)).length < 100_000);
});
