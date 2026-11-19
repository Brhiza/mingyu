import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'unknown' }, timezone: 8 } as const;
const source = { question: '哪些事实稳定？', birth, gender: 'female' } as const;

async function checkEachSegment(input: any, points: 'all' | 'edges' = 'all') {
  const range = await calculate('ziwei', input), candidates = range.data.unknown.candidates;
  for (const candidate of candidates) {
    const times = points === 'all' ? [candidate.startTimestamp, Math.floor((candidate.startTimestamp + candidate.endTimestamp - 1000) / 2000) * 1000, candidate.endTimestamp - 1000] : [candidate.endTimestamp - 1000];
    for (const timestamp of [...new Set(times)]) {
      const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), candidate.timezone);
      const { clock: _clock, calendar: _calendar, leapMonth: _leap, ...other } = input.birth;
      const exactBirth = { ...other, year: local.year, month: local.month, day: local.day, calendar: 'solar', timezone: candidate.timezone, clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second } };
      const exact = await calculate('ziwei', { ...input, birth: exactBirth, prompt: undefined });
      assert.deepEqual(candidate.chart.natal, exact.data.natal, `本命不稳定 ${new Date(timestamp).toISOString()}`);
      assert.deepEqual(candidate.chart.reference, exact.data.reference, `运限不稳定 ${new Date(timestamp).toISOString()}`);
    }
  }
  return range;
}

test('未知时辰覆盖当地整日，候选首中末与精确出生盘一致', async () => {
  const result = await checkEachSegment(source);
  const { candidates, source: coverage } = result.data.unknown;
  assert.equal(candidates.length, 13); assert.equal(coverage.excludedSeconds, 0);
  assert.equal(candidates[0].startTimestamp, coverage.startTimestamp); assert.equal(candidates.at(-1).endTimestamp, coverage.endTimestamp);
  assert.equal(candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 86_400_000);
  for (let i = 1; i < candidates.length; i++) assert.equal(candidates[i - 1].endTimestamp, candidates[i].startTimestamp);
  assert.match(result.prompt.text, /不能视为确定出生瞬时/); assert.match(result.prompt.text, /候选 12/);
  assert.ok(result.data.unknown.possible.soulBranch.length > 1);
});

test('指定民用时辰结合真太阳时按变化秒拆分，并保留全部候选', async () => {
  const input = { ...source, birth: { ...birth, clock: { kind: 'shichen', index: 7 }, timeStandard: 'true-solar', longitude: 87.6 }, referenceTime: '2025-01-01T00:00:00Z', prompt: { scope: 'yearly' } };
  const result = await checkEachSegment(input);
  assert.ok(result.data.unknown.candidates.length >= 2);
  assert.equal(result.data.unknown.source.excludedSeconds, 22 * 3600);
  assert.equal(result.data.unknown.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 7200_000);
  assert.match(result.prompt.text, /运限：流年/);
  const selected = await calculate('ziwei', { ...input, prompt: { scope: 'yearly', candidateIndex: 1, topic: 'career-wealth' } });
  assert.match(selected.prompt.text, /出生候选 1/); assert.match(selected.prompt.text, /计算样本/); assert.match(selected.prompt.text, /事业财运/);
  await assert.rejects(() => calculate('ziwei', { ...input, prompt: { candidateIndex: 100 } }), /索引超出/);
});

test('夏令时跳时、回拨和指定偏移覆盖实际秒数', async () => {
  const newYork = { ...birth, year: 2024, month: 3, day: 10, timezone: undefined, timeZoneId: 'America/New_York' };
  const spring = await checkEachSegment({ ...source, birth: newYork }, 'edges');
  assert.equal(spring.data.unknown.source.endTimestamp - spring.data.unknown.source.startTimestamp, 23 * 3600_000);
  assert.equal(spring.data.unknown.source.excludedSeconds, 0);
  const fallBirth = { ...newYork, month: 11, day: 3, clock: { kind: 'shichen', index: 1 } };
  const fall = await checkEachSegment({ ...source, birth: fallBirth }, 'edges');
  assert.equal(fall.data.unknown.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 3 * 3600_000);
  assert.deepEqual([...new Set(fall.data.unknown.candidates.map((item: any) => item.timezone))], [-4, -5]);
  const filtered = await calculate('ziwei', { ...source, birth: { ...fallBirth, timezone: -4 } });
  assert.equal(filtered.data.unknown.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 3600_000);
  assert.ok(filtered.data.unknown.candidates.every((item: any) => item.timezone === -4));
});

test('农历闰月、晚子换日、参考时刻和保存追问均保留候选约束', async () => {
  const input = { ...source, birth: { ...birth, year: 2023, month: 2, day: 1, calendar: 'lunar', leapMonth: true, clock: { kind: 'shichen', index: 12 } }, rules: { dayDivide: 'forward' }, referenceTime: '2025-01-01T00:00:00Z' };
  const result = await checkEachSegment(input);
  assert.equal(result.data.unknown.source.solarDate, '2023-03-22');
  assert.equal(result.data.unknown.candidates[0].chart.basis.effectiveDate, '2023-03-23');
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'ziwei', result: saved, question: '看第一项', prompt: { candidateIndex: 0 } })).prompt.text, /出生候选 0/);
  saved.data.unknown.candidates[0].chart.natal.palaces[0].name = '伪造';
  await assert.rejects(() => reprompt({ method: 'ziwei', result: saved, question: '追问' }), /不一致/);
  await assert.rejects(() => calculate('ziwei', { ...input, referenceTime: '2023-03-22T15:00:00Z' }), /不得早于任一/);
});

test('HTTP 和 MCP 返回完整候选，原资料追问使用同一批盘面', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'ziwei' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { ...source, birth: { ...birth, clock: { kind: 'shichen', index: 7 }, timeStandard: 'true-solar', longitude: 87.6 } };
  const response = await send('/api/calculate', { method: 'ziwei', input }); assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ziwei', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'ziwei', result: saved, question: '追问', prompt: { candidateIndex: 0 } })).status, 200);
});

test('真太阳时跨午夜及晚子交界，current 和 forward 口径都不遗漏候选', async () => {
  for (const dayDivide of ['current', 'forward'] as const) {
    const input = { ...source, birth: { ...birth, timeStandard: 'true-solar', longitude: 50 }, rules: { dayDivide } };
    const result = await checkEachSegment(input, 'edges');
    const days = [...new Set(result.data.unknown.candidates.map((item: any) => item.chart.basis.correctedLocalDateTime.slice(0, 10)))];
    assert.deepEqual(days, ['1990-05-14', '1990-05-15']);
    assert.equal(result.data.unknown.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 24 * 3600_000);
    assert.match(result.prompt.text, /真太阳时/); assert.match(result.prompt.text, new RegExp(`晚子日界${dayDivide}`));
  }
});

test('47 小时重历民用日同时保留两个实际时区偏移', async () => {
  const input = { ...source, birth: { ...birth, year: 1969, month: 9, day: 30, timezone: undefined, timeZoneId: 'Pacific/Kwajalein' } };
  const result = await checkEachSegment(input, 'edges');
  assert.equal(result.data.unknown.source.endTimestamp - result.data.unknown.source.startTimestamp, 47 * 3600_000);
  assert.equal(result.data.unknown.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 47 * 3600_000);
  assert.deepEqual([...new Set(result.data.unknown.candidates.map((item: any) => item.timezone))], [11, -12]);
  assert.match(result.prompt.text, /Pacific\/Kwajalein/);
});
