import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { aggregateBaziCompatibility } from '../src/systems/bazi/compatibility-aggregate';
import { calculateUnknownBaziTime } from '../src/systems/bazi/unknown-time';
import { buildBaziCompatibility } from '../src/systems/bazi/compatibility';
import worker from '../src/worker';

const first = { year: 2024, month: 2, day: 4, timezone: 8, clock: { kind: 'shichen', index: 8 }, candidateIndex: 0 };
const second = { year: 2024, month: 2, day: 4, timezone: 8, clock: { kind: 'shichen', index: 8 }, candidateIndex: 0 };
const exact = { year: 1990, month: 5, day: 15, timezone: 8, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 } };

function individualFacts(result: any) {
  const e = result.data.compatibility;
  return [
    { kind: '日主关系', value: e.dayMasterRelation },
    ...e.comparisons.flatMap((pair: any) => pair.relations.map((item: any) => ({ kind: '跨柱关系', person1Pillar: pair.person1Pillar, person2Pillar: pair.person2Pillar, ...item }))),
    ...e.combinations.map((value: any) => ({ kind: '跨盘组合', value })),
    ...e.tenGodMappings.map((value: any) => ({ kind: '双向十神', value })),
  ].map((fact) => JSON.stringify(fact));
}

test('全部候选的共同与变化事实和逐组计算一致，包含实际柱位与取值', async () => {
  const input = { question: '问题', person1: first, person2: second, compareCandidates: true };
  const result = await calculate('bazi-synastry', input);
  const aggregate = result.data.candidateComparison;
  assert.ok(aggregate.person1Candidates >= 2 && aggregate.person2Candidates >= 2);
  assert.equal(aggregate.total, aggregate.person1Candidates * aggregate.person2Candidates);
  const expected = new Map<string, number>();
  const examples = new Map<string, Set<string>>();
  for (let a = 0; a < aggregate.person1Candidates; a++) for (let b = 0; b < aggregate.person2Candidates; b++) {
    const individual = await calculate('bazi-synastry', { question: '问题', person1: { ...first, candidateIndex: a }, person2: { ...second, candidateIndex: b } });
    const facts = new Set(individualFacts(individual)); examples.set(`${a}/${b}`, facts);
    for (const key of facts) expected.set(key, (expected.get(key) ?? 0) + 1);
  }
  const all = [...aggregate.common, ...aggregate.variable];
  assert.equal(all.length, expected.size);
  for (const item of all) {
    assert.equal(item.count, expected.get(JSON.stringify(item.fact)));
    assert.equal(item.count === aggregate.total, aggregate.common.includes(item));
    assert.ok(item.example.person1Index >= 0 && item.example.person2Index >= 0);
    assert.ok(examples.get(`${item.example.person1Index}/${item.example.person2Index}`)!.has(JSON.stringify(item.fact)));
  }
  assert.ok(aggregate.common.length > 0); assert.ok(aggregate.variable.length > 0);
  assert.match(result.prompt.text, /组合计数，不按时段长度或出生概率加权/);
  const full = await reprompt({ method: 'bazi-synastry', result: JSON.parse(JSON.stringify(result)), question: '继续', prompt: { detailMode: 'full' } });
  assert.doesNotMatch(full.prompt.text, /另有 \d+ 条变化事实/);
  assert.match(full.prompt.text, /全部候选组合比较/);
  const altered = JSON.parse(JSON.stringify(result)); altered.data.candidateComparison.common[0].count++;
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: altered, question: '追问' }), /不一致/);
});

test('精确出生按单一候选比较，未请求时不计算汇总', async () => {
  const result = await calculate('bazi-synastry', { question: '问题', person1: exact, person2: exact, compareCandidates: true });
  assert.equal(result.data.candidateComparison.total, 1);
  assert.equal(result.data.candidateComparison.variable.length, 0);
  assert.ok(result.data.candidateComparison.common.every((x: any) => x.example.person1Index === null && x.example.person2Index === null));
  const ordinary = await calculate('bazi-synastry', { question: '问题', person1: exact, person2: exact });
  assert.equal(ordinary.data.candidateComparison, undefined);
});

test('组合为空或超过预算时明确拒绝，不返回截断汇总', () => {
  assert.throws(() => aggregateBaziCompatibility([], [{} as any]), /1 至 2048/);
  assert.throws(() => aggregateBaziCompatibility(Array(46).fill({}), Array(45).fill({})), /1 至 2048/);
});

test('未选择出生候选时自动比较，不把首个时段当作确定双盘', async () => {
  const { candidateIndex: _a, ...person1 } = first, { candidateIndex: _b, ...person2 } = second;
  const input = { question: '如何合作？', person1, person2, relationship: 'career', prompt: { schools: ['mangpai'] } };
  const result = await calculate('bazi-synastry', input);
  assert.equal(result.data.charts.person1, null); assert.equal(result.data.charts.person2, null);
  assert.equal(result.data.compatibility, null);
  assert.equal(result.data.candidates.person1.length, result.data.candidateComparison.person1Candidates);
  assert.equal(result.data.candidateComparison.total, result.data.candidates.person1.length * result.data.candidates.person2.length);
  assert.ok(result.data.candidates.person1.every((item: any) => item.endExclusive && item.endTimestamp > item.startTimestamp && item.pillars.day));
  assert.match(result.prompt.text, /出生时段尚未全部选定/); assert.match(result.prompt.text, /全部候选组合比较/);
  for (const candidate of result.data.candidates.person1) {
    assert.ok(result.prompt.text.includes(`索引 ${candidate.index}｜${new Date(candidate.startTimestamp).toISOString()}`));
    assert.ok(result.prompt.text.includes(candidate.pillars.day));
  }
  assert.match(result.prompt.text, /不是出生概率/); assert.match(result.prompt.text, /盲派/);
  const selected = await calculate('bazi-synastry', { ...input, person1: first, person2: second, compareCandidates: true });
  assert.deepEqual(result.data.candidateComparison, selected.data.candidateComparison);
  const partial = await calculate('bazi-synastry', { ...input, person1: first });
  assert.ok(partial.data.charts.person1); assert.equal(partial.data.charts.person2, null);
  const exactAndUnknown = await calculate('bazi-synastry', { ...input, person1: exact });
  assert.equal(exactAndUnknown.data.candidateComparison.person1Candidates, 1);
  assert.equal(exactAndUnknown.data.charts.person2, null);
  const follow = await reprompt({ method: 'bazi-synastry', result: JSON.parse(JSON.stringify(result)), question: '继续比较', prompt: { detailMode: 'full' } });
  assert.match(follow.prompt.text, /继续比较/); assert.doesNotMatch(follow.prompt.text, /另有 \d+ 条变化事实/);
  const altered = structuredClone(result); altered.data.candidates.person1[0].endTimestamp++;
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: altered, question: '追问' }), /不一致/);
  await assert.rejects(() => calculate('bazi-synastry', { ...input, compareCandidates: false }), /candidateIndex/);
  await assert.rejects(() => calculate('bazi-synastry', { ...input, person1: { ...person1, candidateIndex: 999 } }), /候选索引超出范围/);
});

test('HTTP 和 MCP 都能直接比较未选定的八字候选并追问', async () => {
  const { candidateIndex: _a, ...person1 } = first, { candidateIndex: _b, ...person2 } = second;
  const input = { question: '问题', person1, person2 };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi-synastry' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'bazi-synastry', input });
  assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi-synastry', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  const follow = await send('/api/prompt', { method: 'bazi-synastry', result: saved, question: '继续' });
  assert.equal(follow.status, 200); assert.match((await follow.json()).prompt.text, /继续/);
  const pagedInput = { ...input, comparisonPage: { offset: 1, limit: 1 } };
  const pagedHttp = await send('/api/calculate', { method: 'bazi-synastry', input: pagedInput });
  assert.equal(pagedHttp.status, 200); const paged = await pagedHttp.json();
  const pagedMcp = await send('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'bazi-synastry', arguments: pagedInput } });
  assert.deepEqual((await pagedMcp.json()).result.structuredContent.data, paged.data);
  assert.equal(paged.data.candidateComparison.page.offset, 1);
  assert.equal((await send('/api/prompt', { method: 'bazi-synastry', result: paged, question: '继续' })).status, 200);
});

test('候选变化事实分页可完整续取，追问只使用保存的页', async () => {
  const person = { year: 1990, month: 5, day: 15, timezone: 8, clock: { kind: 'unknown' } };
  const input = { question: '问题', person1: person, person2: person };
  const firstPage = await calculate('bazi-synastry', input);
  const comparison = firstPage.data.candidateComparison;
  assert.equal(comparison.total, 169); assert.equal(comparison.page.limit, 100);
  assert.ok(comparison.variableTotal > 200); assert.equal(comparison.variable.length, 100);
  assert.equal(comparison.page.nextOffset, 100);
  assert.match(firstPage.prompt.text, /下一页 comparisonPage.offset=100/);
  const collect = async (limit: number) => {
    const variable = []; let offset: number | null = 0;
    while (offset !== null) {
      const result = await calculate('bazi-synastry', { ...input, comparisonPage: { offset, limit } });
      assert.equal(result.data.candidateComparison.page.offset, offset);
      assert.equal(result.data.candidateComparison.variableTotal, comparison.variableTotal);
      assert.deepEqual(result.data.candidateComparison.common, comparison.common);
      variable.push(...result.data.candidateComparison.variable);
      offset = result.data.candidateComparison.page.nextOffset;
    }
    return variable;
  };
  const small = await collect(23), large = await collect(200);
  assert.deepEqual(small, large); assert.equal(small.length, comparison.variableTotal);
  assert.equal(new Set(small.map((item) => JSON.stringify(item.fact))).size, small.length);
  const second = await calculate('bazi-synastry', { ...input, comparisonPage: { offset: 100, limit: 23 } });
  const follow = await reprompt({ method: 'bazi-synastry', result: JSON.parse(JSON.stringify(second)), question: '继续', prompt: { detailMode: 'full' } });
  assert.match(follow.prompt.text, /当前页 23 \/ 全部/); assert.match(follow.prompt.text, /下一页 comparisonPage.offset=123/);
  const altered = structuredClone(second); altered.data.candidateComparison.page.nextOffset++;
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: altered, question: '追问' }), /不一致/);
  await assert.rejects(() => calculate('bazi-synastry', { ...input, comparisonPage: { offset: 100000 } }), /偏移超出/);
  await assert.rejects(() => calculate('bazi-synastry', { ...input, comparisonPage: { limit: 201 } }));
  await assert.rejects(() => calculate('bazi-synastry', { question: '问题', person1: exact, person2: exact, compareCandidates: false, comparisonPage: {} }));
  const selected = await calculate('bazi-synastry', { question: '问题', person1: exact, person2: exact, comparisonPage: {} });
  assert.equal(selected.data.candidateComparison.total, 1);
  assert.deepEqual(selected.data.candidateComparison.page, { offset: 0, limit: 100, nextOffset: null });
});

test('重历日四柱相同的时段仍单独计数，分页事实和逐组计算一致', async () => {
  const range = await calculateUnknownBaziTime({ year: 1969, month: 9, day: 30, timeZoneId: 'Pacific/Kwajalein' });
  const candidates = range.segments.map((segment, index) => ({ index, pillars: segment.pillars }));
  assert.equal(candidates.length, 25);
  assert.ok(new Set(candidates.map((item) => JSON.stringify(item.pillars))).size < candidates.length);
  const expected = new Map<string, number>(), examples = new Map<string, Set<string>>();
  for (const a of candidates) for (const b of candidates) {
    const facts = new Set(individualFacts({ data: { compatibility: buildBaziCompatibility(a.pillars, b.pillars) } }));
    examples.set(`${a.index}/${b.index}`, facts);
    for (const fact of facts) expected.set(fact, (expected.get(fact) ?? 0) + 1);
  }
  const all = []; let offset: number | null = 0, common: unknown[] | undefined;
  while (offset !== null) {
    const result = aggregateBaziCompatibility(candidates, candidates, { offset, limit: 200 });
    assert.equal(result.total, 625);
    if (common) assert.deepEqual(result.common, common); else common = result.common;
    all.push(...result.variable); offset = result.page.nextOffset;
  }
  const facts = [...common!, ...all] as Array<{ fact: unknown; count: number; example: { person1Index: number; person2Index: number } }>;
  assert.equal(facts.length, expected.size);
  for (const item of facts) {
    const key = JSON.stringify(item.fact);
    assert.equal(item.count, expected.get(key));
    assert.ok(examples.get(`${item.example.person1Index}/${item.example.person2Index}`)?.has(key));
  }
});
