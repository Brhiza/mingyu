import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';
import { buildDirectionCoverage } from '../src/systems/bazi/direction-coverage';

const person1 = { name: '甲', year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 };
const person2 = { name: '乙', year: 1992, month: 8, day: 12, clock: { kind: 'exact', hour: 9, minute: 0, second: 0 }, timezone: 8 };
const base = { question: '双方如何相处？', currentTime: '2025-01-01T00:00:00Z', person1, person2 };

test('独立双盘覆盖六种关系、双向十神及流派任务', async () => {
  for (const [relationship, label] of Object.entries({ marriage: '婚恋', career: '合伙', friendship: '友情', children: '子女', parents: '父母', siblings: '兄弟姐妹' })) {
    const result = await calculate('bazi-synastry', { ...base, relationship, prompt: { schools: ['ziping', 'mangpai'] } });
    assert.equal(result.data.compatibility.comparisons.length, 16);
    assert.equal(result.data.compatibility.tenGodMappings.length, 8);
    assert.equal(result.data.compatibility.usefulGodCoverage.status, '待计算');
    assert.ok(result.data.compatibility.spousePalaceDeep);
    assert.ok(['双向喜用覆盖', '单向喜用覆盖', '未见喜用覆盖', '资料不足'].includes(result.data.compatibility.usefulGodComplementarity.level));
    assert.match(result.prompt.text, /互补等级：/);
    assert.doesNotMatch(result.prompt.text, /喜忌覆盖及双方岁运未计算/);
    for (const chart of Object.values(result.data.charts) as any[]) assert.ok(result.prompt.text.includes(`旺衰模型${chart.strength.status}`));
    assert.match(result.prompt.text, /非最终喜忌/);
    assert.match(result.prompt.text, /【双方取用条件候选】/);
    for (const chart of Object.values(result.data.charts) as any[]) assert.ok(result.prompt.text.includes(`普通取格候选${chart.ordinaryPattern.candidate}`));
    for (const text of [`【${label}任务】`, '【双向十神】', '【跨柱关系】', '【资料缺口】', '子平派', '盲派', '双方如何相处？']) assert.ok(result.prompt.text.includes(text), text);
  }
});

test('保存后追问重算核对双盘及跨盘证据，精确时间和时区校验', async () => {
  const original = JSON.parse(JSON.stringify(await calculate('bazi-synastry', base)));
  const next = await reprompt({ method: 'bazi-synastry', result: original, question: '如何沟通？', prompt: { schools: ['xinpai'] } });
  assert.match(next.prompt.text, /如何沟通/); assert.match(next.prompt.text, /新派/);
  for (const mutate of [
    (d: any) => { d.input.person1.year++; },
    (d: any) => { d.charts.person2.pillars.day.ganZhi = '伪造'; },
    (d: any) => { d.charts.person2.strength.status = '伪造'; },
    (d: any) => { d.charts.person2.ordinaryPattern.candidate = '伪造'; },
    (d: any) => { d.compatibility.tenGodMappings[0].stemTenGod = '伪造'; },
  ]) {
    const saved = structuredClone(original); mutate(saved.data);
    await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: saved, question: '追问' }), /不一致/);
  }
  await assert.rejects(() => calculate('bazi-synastry', { ...base, compareCandidates: false, person1: { ...person1, clock: { kind: 'unknown' } } }));
  await assert.rejects(() => calculate('bazi-synastry', { ...base, compareCandidates: false, person1: { ...person1, clock: { kind: 'shichen', index: 7 } } }));
  const lunar = { year: 2023, month: 2, day: 1, calendar: 'lunar', leapMonth: true, clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8 };
  const solar = { ...person2, timeZoneId: 'America/New_York', timezone: -4, timeStandard: 'true-solar', longitude: -74 };
  const mixed = await calculate('bazi-synastry', { question: '问题', person1: lunar, person2: solar });
  assert.match(mixed.data.charts.person1.basis.localDateTime, /2023-03-22/);
  assert.match(mixed.prompt.text, /真太阳时/);
});

test('双人合盘保留各自日干化气及其状态', async () => {
  const result = await calculate('bazi-synastry', { ...base, person1: { ...person1, day: 7 } });
  const transformation = result.data.charts.person1.transformation;
  assert.equal(transformation.status, '存在反证');
  assert.ok(result.prompt.text.includes(`${transformation.pattern}（${transformation.status}）`));
});

test('双盘保留双方曲直条件及格局排序', async () => {
  const first = { ...person1, year: 1980, month: 1, day: 3, clock: { kind: 'exact', hour: 6, minute: 0, second: 0 } };
  const result = await calculate('bazi-synastry', { ...base, person1: first });
  assert.equal(result.data.charts.person1.patternOverview.pattern, '曲直格');
  assert.match(result.prompt.text, /曲直亥卯未木局（条件成立）/);
});

test('双盘保留从财优先条件及格局排序', async () => {
  const first = { ...person1, year: 2018, month: 5, day: 3, clock: { kind: 'exact', hour: 20, minute: 0, second: 0 } };
  const result = await calculate('bazi-synastry', { ...base, person1: first });
  assert.equal(result.data.charts.person1.patternOverview.pattern, '从财格');
  assert.match(result.prompt.text, /从财优先四支本气皆财/);
});

test('Worker HTTP 与 MCP 共用双盘与追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi-synastry' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi-synastry', input: base });
  assert.equal(http.status, 200); const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi-synastry', arguments: base } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'bazi-synastry', result: saved, question: '追问' })).status, 200);
});

test('双方可分别选择时辰或未知时辰候选，跨交节不能当作确定出生', async () => {
  const first = { name: '甲', year: 2024, month: 2, day: 4, timezone: 8, clock: { kind: 'shichen', index: 8 }, candidateIndex: 0 };
  const second = { name: '乙', year: 2024, month: 11, day: 3, timeZoneId: 'America/New_York', clock: { kind: 'unknown' }, candidateIndex: 0 };
  const result = await calculate('bazi-synastry', { question: '问题', person1: first, person2: second });
  assert.deepEqual(result.data.compatibility.directionCoverage.person1FromPerson2, buildDirectionCoverage(result.data.charts.person1.usefulStrategy, result.data.charts.person2.pillars));
  assert.deepEqual(result.data.compatibility.directionCoverage.person2FromPerson1, buildDirectionCoverage(result.data.charts.person2.usefulStrategy, result.data.charts.person1.pillars));
  const a = result.data.charts.person1.candidate, b = result.data.charts.person2.candidate;
  assert.ok(a.total >= 2); assert.ok(b.total >= 12);
  assert.equal(a.index, 0); assert.equal(a.nextIndex, 1);
  assert.deepEqual([...new Set(b.candidates.map((item: any) => item.timezone))], [-4, -5]);
  assert.match(result.prompt.text, /不能当作确定出生时刻或代表全部候选/);
  assert.match(result.prompt.text, /仅分析所选候选组合/);
  const last = await calculate('bazi-synastry', { question: '问题', person1: { ...first, candidateIndex: a.total - 1 }, person2: second });
  assert.notEqual(result.data.charts.person1.pillars.year.ganZhi, last.data.charts.person1.pillars.year.ganZhi);
  assert.equal(last.data.charts.person1.candidate.nextIndex, null);
  const segment = last.data.charts.person1.candidate;
  const civil = getCivilDateTimeAtFixedOffset(new Date(segment.startTimestamp), 8);
  const exact = await calculateBaziPillars({ ...civil, timezone: 8, clock: { kind: 'exact', hour: civil.hour, minute: civil.minute, second: civil.second } });
  assert.deepEqual(last.data.charts.person1.pillars, exact.pillars);
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'bazi-synastry', result: saved, question: '继续' })).prompt.text, /仅分析所选候选组合/);
  saved.data.charts.person1.candidate.candidates[0].endTimestamp++;
  await assert.rejects(() => reprompt({ method: 'bazi-synastry', result: saved, question: '追问' }), /不一致/);
  await assert.rejects(() => calculate('bazi-synastry', { question: '问题', person1: { ...first, candidateIndex: a.total }, person2: second }), /候选索引超出范围/);
  await assert.rejects(() => calculate('bazi-synastry', { ...base, person1: { ...person1, candidateIndex: 0 } }));
});

test('八字双盘支持双方最终用神跨盘覆盖与指定时刻双人岁运合参', async () => {
  const withGenderAndRef = {
    ...base,
    person1: { ...person1, gender: 'male' as const },
    person2: { ...person2, gender: 'female' as const },
    referenceTime: '2026-06-15T04:00:00Z',
  };
  const result = await calculate('bazi-synastry', withGenderAndRef);
  assert.ok(result.data.charts.person1.usefulGod);
  assert.ok(result.data.charts.person2.usefulGod);
  assert.ok(result.data.compatibility.finalUsefulGodCoverage.person1FromPerson2);
  assert.ok(result.data.compatibility.finalUsefulGodCoverage.person2FromPerson1);
  assert.ok(result.data.compatibility.fortuneComparison);
  assert.equal(result.data.compatibility.fortuneComparison.sharedYear, '丙午');
  assert.ok(result.data.compatibility.fortuneComparison.person1.dayun);
  assert.ok(result.data.compatibility.fortuneComparison.person2.dayun);
  assert.match(result.prompt.text, /【双方用神裁定与跨盘覆盖】/);
  assert.match(result.prompt.text, /【双方岁运合参】/);
  const saved = JSON.parse(JSON.stringify(result));
  const followed = await reprompt({ method: 'bazi-synastry', result: saved, question: '今年合作要注意什么？' });
  assert.match(followed.prompt.text, /【双方岁运合参】/);
});
