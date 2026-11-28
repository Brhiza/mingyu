import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { createServer } from '../src/mcp';
import { searchBaziDates } from '../src/systems/bazi-reverse';
import { getDivinationTime } from '../src/systems/calendar';
import { createUtcTimestamp } from '../src/systems/huangji/civil-time';
import worker from '../src/worker';

const positions = ['year', 'month', 'day', 'hour'] as const;
const known = { year: '甲辰', month: '丙寅', day: '戊戌', hour: '庚申' };
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('跨年代、四季及时辰生成的四柱能够找到原始时刻', () => {
  for (const year of [1900, 1901, 1949, 1964, 1990, 2000, 2024, 2099, 2100]) for (const month of [1, 2, 3, 6, 9, 12]) for (const hour of [0, 12, 23]) {
    const instant = createUtcTimestamp(year, month - 1, 15, hour - 8), pillars = getDivinationTime(new Date(instant)).ganzhi;
    const result = searchBaziDates({ pillars, startYear: year, endYear: year });
    assert.ok(result.candidates.some((candidate) => candidate.startTimestamp <= instant && instant < candidate.endTimestamp), `${year}/${month}/${hour}`);
  }
});

test('交节前后与公历年度边界的原始时刻不会从反推结果丢失', () => {
  for (const year of [1900, 1964, 2024, 2100]) for (let offset = 0; offset < 12; offset++) {
    const t = SolarTerm.fromIndex(year, 3).next(offset * 2).getJulianDay().getSolarTime();
    const instant = createUtcTimestamp(t.getYear(), t.getMonth() - 1, t.getDay(), t.getHour() - 8, t.getMinute(), t.getSecond());
    for (const delta of [-1000, 0]) {
      const timestamp = instant + delta, civilYear = new Date(timestamp + 8 * 3_600_000).getUTCFullYear();
      if (civilYear < 1900 || civilYear > 2100) continue;
      const pillars = getDivinationTime(new Date(timestamp)).ganzhi;
      assert.ok(searchBaziDates({ pillars, startYear: civilYear, endYear: civilYear }).candidates.some((item) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp));
    }
  }
  const result = searchBaziDates({ pillars: known, startYear: 1900, endYear: 2100 });
  assert.equal(result.candidateCount, 3);
  assert.ok(result.candidates.some((item) => item.start === '2024-02-04T16:27:07+08:00' && item.startBoundary === '节气交接'));
});

test('候选区间逐秒符合四柱，可直接用于姓名分析与起名', async () => {
  const reverse = await calculate('bazi-reverse', { pillars: known, startYear: 1900, endYear: 2100 });
  assert.equal(reverse.data.candidates.length, 3);
  for (const candidate of reverse.data.candidates) {
    assert.ok(candidate.endTimestamp - candidate.startTimestamp <= 7_200_000);
    for (let instant = candidate.startTimestamp; instant < candidate.endTimestamp; instant += 1000) assert.deepEqual(getDivinationTime(new Date(instant)).ganzhi, known);
    assert.ok(reverse.prompt.text.includes(candidate.start.replace('T', ' ')));
    assert.doesNotMatch(reverse.prompt.text, /"birthRange"|"pillars":/);
    const name = await calculate('chinese-name', { fullName: '张知远', birthRange: candidate.birthRange, question: '问题' });
    const naming = await calculate('chinese-naming', { surname: '张', birthRange: candidate.birthRange, question: '问题', limit: 3 });
    assert.deepEqual(name.data.birthContext, naming.data.birthContext);
    assert.ok(name.data.birthContext!.segments.every((item) => item.pillars.every((value, index) => value === known[positions[index]])));
    assert.match(name.prompt.text, /四柱来源/);
  }
});

test('非法柱与五虎遁、五鼠遁矛盾明确拒绝，保存结果可追问并核验', async () => {
  for (const input of [
    { pillars: { ...known, year: '甲丑' }, startYear: 2024, endYear: 2024 },
    { pillars: { ...known, month: '甲子' }, startYear: 2024, endYear: 2024 },
    { pillars: { ...known, hour: '丙子' }, startYear: 2024, endYear: 2024 },
    { pillars: known, startYear: 2025, endYear: 2024 }, { pillars: known, startYear: 0, endYear: 2024 },
  ]) await assert.rejects(() => calculate('bazi-reverse', input));
  const result = await calculate('bazi-reverse', { pillars: known, startYear: 2024, endYear: 2024 });
  const next = await reprompt({ method: 'bazi-reverse', result, question: '继续说明' });
  assert.match(next.prompt.text, /继续说明/);
  const bad = plain(result); bad.data.candidates[0].end = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi-reverse', result: bad, question: '问题' }), /不一致/);
});

test('HTTP 与 MCP 返回同一反推结果、提示词及追问', async () => {
  const input = { pillars: known, startYear: 2024, endYear: 2024, currentTime: '2025-01-01T00:00:00Z' };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi-reverse' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'bazi-reverse', input }); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal((await send('/api/prompt', { method: 'bazi-reverse', result, question: '追问' })).status, 200);
  const [ct, st] = InMemoryTransport.createLinkedPair(), server = createServer(['bazi-reverse']), client = new Client({ name: 'reverse-test', version: '1' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  try {
    const mcp = await client.callTool({ name: 'bazi-reverse', arguments: input });
    assert.deepEqual(mcp.structuredContent?.data, result.data);
    const follow = await client.callTool({ name: 'reprompt', arguments: { method: 'bazi-reverse', result: mcp.structuredContent, question: '追问' } });
    assert.equal(follow.isError, undefined);
  } finally { await client.close(); await server.close(); }
});

test('四柱反推支持真太阳时经度反推与 1986–1991 中国夏令时标注', async () => {
  const solarReverse = await calculate('bazi-reverse', { pillars: known, startYear: 2024, endYear: 2024, longitude: 104.06 });
  assert.equal(solarReverse.data.candidates.length, 1);
  const candidate = solarReverse.data.candidates[0];
  assert.equal(candidate.birthRange.timeStandard, 'true-solar');
  assert.equal(candidate.birthRange.longitude, 104.06);
  const baziFromReverse = await calculate('bazi', { birthRange: candidate.birthRange, question: '核对真太阳时反推' });
  assert.ok(baziFromReverse.data.unknown!.segments.every((seg) => positions.every((pos) => seg.pillars[pos].ganZhi === known[pos])));

  const dstPillars = getDivinationTime(new Date(createUtcTimestamp(1988, 5, 15, 4))).ganzhi;
  const dstReverse = await calculate('bazi-reverse', { pillars: dstPillars, startYear: 1988, endYear: 1988, applyChinaDst: true });
  assert.ok(dstReverse.data.candidates.some((c) => c.chinaDst?.inDst === true));
  assert.match(dstReverse.prompt.text, /夏令时民用钟表/);
});

test('支持按历史朝代年份范围（公元 1 年至 2099 年）反推四柱', async () => {
  const dynasties = [
    { label: '现代', startYear: 1912, endYear: 2099, expectedMin: 1 },
    { label: '清朝', startYear: 1644, endYear: 1911, expectedMin: 1 },
    { label: '明朝', startYear: 1368, endYear: 1643, expectedMin: 1 },
    { label: '元朝', startYear: 1271, endYear: 1367, expectedMin: 0 },
    { label: '宋朝~五代十国', startYear: 908, endYear: 1279, expectedMin: 1 },
    { label: '唐朝', startYear: 618, endYear: 907, expectedMin: 1 },
    { label: '晋~南北朝~隋朝', startYear: 265, endYear: 617, expectedMin: 1 },
    { label: '汉朝~三国', startYear: 1, endYear: 280, expectedMin: 1 },
  ];
  for (const dynasty of dynasties) {
    const res = await calculate('bazi-reverse', { pillars: known, startYear: dynasty.startYear, endYear: dynasty.endYear });
    assert.ok(res.data.candidateCount >= dynasty.expectedMin, dynasty.label);
    for (const candidate of res.data.candidates) {
      const year = Number(candidate.start.slice(0, 4));
      assert.ok(year >= dynasty.startYear && year <= dynasty.endYear, `${dynasty.label}: ${candidate.start}`);
    }
  }
  const jan1 = await calculate('bazi-reverse', { pillars: { year: '庚申', month: '己丑', day: '乙酉', hour: '丙子' }, startYear: 1, endYear: 1 });
  assert.equal(jan1.data.candidateCount, 1);
  assert.equal(jan1.data.candidates[0].start, '0001-01-08T23:00:00+08:00');
  const oct1582 = await calculate('bazi-reverse', { pillars: { year: '壬午', month: '庚戌', day: '甲戌', hour: '庚午' }, startYear: 1582, endYear: 1582 });
  assert.equal(oct1582.data.candidateCount, 1);
  assert.equal(oct1582.data.candidates[0].start, '1582-10-15T11:00:00+08:00');
});
