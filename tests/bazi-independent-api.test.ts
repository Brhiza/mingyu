import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { question: '事业如何？', currentTime: '2025-01-01T00:00:00Z', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 }, gender: 'male', referenceTime: '2026-06-15T04:00:00Z' };

test('独立八字预览输出四柱、司权、大运、岁运事实与条件限制', async () => {
  const result = await calculate('bazi', input);
  assert.equal(result.data.chart.pillars.day.ganZhi, '庚辰');
  assert.match(result.prompt.text, /【日主旺衰条件模型】/);
  assert.match(result.prompt.text, /【取用基础取向】/);
  assert.match(result.prompt.text, /【调候条件候选】/);
  assert.match(result.prompt.text, /【司权、病药与通关候选】/);
  assert.match(result.prompt.text, /【格局透干与根气条件】/);
  assert.match(result.prompt.text, /并非最终用神或喜忌/);
  assert.match(result.prompt.text, /双人合盘需另用 bazi-synastry/);
  assert.match(result.prompt.text, /最终用神和具体事件应期尚未计算/);
  assert.match(result.prompt.text, /【普通月令取格候选】/);
  assert.ok(result.prompt.text.includes(result.data.chart.ordinaryPattern.candidate));
  assert.ok(result.prompt.text.includes(result.data.chart.strength.status));
  assert.ok(result.data.chart.strength.roots.every((root: any) => typeof root.actionable === 'boolean'));
  assert.equal(result.data.fortune.cycles.length, 12);
  assert.equal(result.data.located.year.ganZhi, '丙午');
  for (const section of ['【四柱】', '【本命结构】', '【通根与月令透干】', '【十神分布】', '【大运】', '【指定时刻岁运】', '事业如何？', '不得将其当成已经算出的结论']) assert.ok(result.prompt.text.includes(section), section);
  assert.ok(result.prompt.text.includes(`日柱：${result.data.chart.pillars.day.ganZhi}`));
  const full = await calculate('bazi', { ...input, prompt: { detailMode: 'full' } });
  assert.match(full.prompt.text, /未命中所列关系/);
  if (full.data.chart.climate.candidates.length) assert.match(full.prompt.text, /说明：/);
});

test('指定时辰与缺少性别不伪造大运，参数限制明确', async () => {
  const shichen = await calculate('bazi', { question: '问题', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'shichen', index: 7 } }, gender: 'male' });
  assert.equal(shichen.data.fortune, null); assert.equal(shichen.data.located, null);
  assert.match(shichen.prompt.text, /选择当地民用钟表 13:00 至 15:00/);
  assert.match(shichen.prompt.text, /双人合盘需另用 bazi-synastry/);
  const noGender = await calculate('bazi', { question: '问题', birth: input.birth });
  assert.equal(noGender.data.fortune, null);
  for (const invalid of [
    { ...input, gender: undefined },
    { ...input, birth: { ...input.birth, clock: { kind: 'shichen', index: 7 } } },
    { ...input, referenceTime: '2026-06-15T04:00:00.500Z' },
    { ...input, referenceTime: '1980-01-01T00:00:00Z' },
    { ...input, birth: { ...input.birth, timeStandard: 'true-solar' } },
  ]) await assert.rejects(() => calculate('bazi', invalid));
});

test('保存后追问重算核对，拒绝篡改盘面、大运和岁运关系', async () => {
  const result = JSON.parse(JSON.stringify(await calculate('bazi', input)));
  const next = await reprompt({ method: 'bazi', result, question: '感情呢？', prompt: { detailMode: 'full' } });
  assert.match(next.prompt.text, /感情呢？/);
  for (const mutate of [
    (data: any) => { data.chart.pillars.day.ganZhi = '甲子'; },
    (data: any) => { data.chart.strength.status = '伪造'; },
    (data: any) => { data.chart.usefulBaseline.favorable.push('伪造'); },
    (data: any) => { data.chart.climate.candidates.push({ id: '伪造' }); },
    (data: any) => { data.chart.climateDecision.favorable.push('伪造'); },
    (data: any) => { data.chart.usefulStrategy.favorable.push('伪造'); },
    (data: any) => { data.chart.patternEvidence.visible[0].effective = !data.chart.patternEvidence.visible[0].effective; },
    (data: any) => { data.chart.ordinaryPattern.candidate = '伪造'; },
    (data: any) => { data.fortune.cycles[0].ganZhi = '甲子'; },
    (data: any) => { data.located.evidence.comparisons[0].relations.push({ name: '伪造', values: [] }); },
  ]) {
    const altered = structuredClone(result); mutate(altered.data);
    await assert.rejects(() => reprompt({ method: 'bazi', result: altered, question: '继续问' }), /不一致/);
  }
});

test('Worker HTTP、MCP 与追问使用一致的独立八字', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi', input });
  assert.equal(http.status, 200); const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'bazi', result: saved, question: '继续问' })).status, 200);
  saved.data.chart.pillars.year.gan = '伪造';
  assert.equal((await send('/api/prompt', { method: 'bazi', result: saved, question: '继续问' })).status, 400);
});

test('五合化气的依据进入提示词，保存追问校验反证与根气', async () => {
  const source = { ...input, birth: { ...input.birth, day: 7 } };
  const result = await calculate('bazi', source);
  const transformation = result.data.chart.transformation;
  assert.equal(transformation.pattern, '丁壬化木格');
  assert.equal(transformation.status, '合绊（合而不化）');
  assert.match(result.prompt.text, /【日干五合化气】/);
  assert.ok(result.prompt.text.includes(transformation.pattern));
  assert.ok(result.prompt.text.includes(transformation.blockers[0]));
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'bazi', result: saved, question: '继续问' })).prompt.text, /丁壬化木格/);
  saved.data.chart.transformation.status = '成化';
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续问' }), /不一致/);
});

test('曲直条件与格局排序进入提示词，追问会核对证据', async () => {
  const source = { question: '问题', birth: { year: 1980, month: 1, day: 3, clock: { kind: 'exact', hour: 6, minute: 0, second: 0 }, timezone: 8 } };
  const result = await calculate('bazi', source);
  assert.equal(result.data.chart.quzhi.route, '亥卯未木局');
  assert.equal(result.data.chart.quzhi.status, '条件成立');
  assert.equal(result.data.chart.patternOverview.pattern, '曲直格');
  assert.match(result.prompt.text, /【曲直格条件】/);
  assert.match(result.prompt.text, /亥卯未木局.*条件成立/);
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'bazi', result: saved, question: '继续问' })).prompt.text, /亥卯未木局/);
  saved.data.chart.quzhi.status = '存在反证';
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续问' }), /不一致/);
});

test('从儿和从财优先条件进入提示词并在追问时复核', async () => {
  const source = { question: '问题', birth: { year: 1987, month: 2, day: 23, clock: { kind: 'exact', hour: 8, minute: 0, second: 0 }, timezone: 8 } };
  const result = await calculate('bazi', source);
  assert.equal(result.data.chart.conger.route, '三会食伤成气');
  assert.equal(result.data.chart.conger.status, '条件成立');
  assert.equal(result.data.chart.patternOverview.pattern, '从儿格');
  assert.match(result.prompt.text, /【从儿与从财条件】/);
  assert.match(result.prompt.text, /三会食伤成气：条件成立/);
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'bazi', result: saved, question: '继续问' })).prompt.text, /三会食伤成气/);
  saved.data.chart.conger.status = '存在反证';
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续问' }), /不一致/);
  const wealth = await calculate('bazi', { ...source, birth: { year: 2018, month: 5, day: 3, clock: { kind: 'exact', hour: 20, minute: 0, second: 0 }, timezone: 8 } });
  assert.equal(wealth.data.chart.conger.competingWealth, '四支本气皆财');
  assert.equal(wealth.data.chart.patternOverview.pattern, '从财格');
  assert.match(wealth.prompt.text, /从财优先路线：四支本气皆财/);
});

test('通用从格的条件进入提示词并在追问时核对', async () => {
  const source = { question: '问题', birth: { year: 1981, month: 9, day: 13, clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8 } };
  const result = await calculate('bazi', source);
  assert.equal(result.data.chart.extreme.candidate, '从势格');
  assert.equal(result.data.chart.extreme.status, '条件成立');
  assert.equal(result.data.chart.patternOverview.pattern, '从势格');
  assert.match(result.prompt.text, /【专旺与通用从格条件】/);
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'bazi', result: saved, question: '继续问' })).prompt.text, /从势格/);
  saved.data.chart.extreme.status = '存在反证';
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续问' }), /不一致/);
});

test('未知时辰保留交节与夏令时的候选，追问校验且拒绝指定岁运', async () => {
  const unknown = { question: '问题', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'unknown' }, timezone: 8 } };
  const result = await calculate('bazi', unknown);
  assert.equal(result.data.chart, null); assert.equal(result.data.fortune, null);
  assert.equal(result.data.unknown.common.year, null);
  const strengths = [...new Set(result.data.unknown.segments.map((segment: any) => segment.strength.status))];
  assert.deepEqual(result.data.unknown.possibleStrengths, strengths);
  assert.equal(result.data.unknown.commonStrength, strengths.length === 1 ? strengths[0] : null);
  const patterns = [...new Set(result.data.unknown.segments.map((segment: any) => segment.ordinaryPattern.candidate))];
  assert.deepEqual(result.data.unknown.possibleOrdinaryPatterns, patterns);
  assert.equal(result.data.unknown.commonOrdinaryPattern, patterns.length === 1 ? patterns[0] : null);
  for (const segment of result.data.unknown.segments) assert.ok(result.prompt.text.includes(`旺衰模型${segment.strength.status}`));
  for (const segment of result.data.unknown.segments) assert.ok(result.prompt.text.includes(`普通格局条件模型${segment.patternEvidence.decision?.status ?? '不适用'}`));
  assert.match(result.prompt.text, /不得将某个候选时段当作已确定出生时间/);
  const saved = JSON.parse(JSON.stringify(result));
  const next = await reprompt({ method: 'bazi', result: saved, question: '继续问', prompt: { detailMode: 'full' } });
  assert.match(next.prompt.text, /原局关系/);
  saved.data.unknown.segments[0].pillars.year.ganZhi = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续问' }), /不一致/);
  await assert.rejects(() => calculate('bazi', { ...unknown, gender: 'male', referenceTime: '2026-01-01T00:00:00Z' }));
  const fall = await calculate('bazi', { question: '问题', birth: { year: 2024, month: 11, day: 3, clock: { kind: 'unknown' }, timeZoneId: 'America/New_York' } });
  assert.equal(fall.data.unknown.source.endTimestamp - fall.data.unknown.source.startTimestamp, 25 * 3_600_000);
  assert.deepEqual([...new Set(fall.data.unknown.segments.map((segment: any) => segment.timezone))], [-4, -5]);
  const solar = await calculate('bazi', { question: '问题', birth: { ...unknown.birth, timeStandard: 'true-solar', longitude: 116.4 } });
  assert.ok(solar.data.unknown.segments.some((segment: any) => segment.startTimestamp % 3_600_000 !== 0));
  const lunar = await calculate('bazi', { question: '问题', birth: { year: 2023, month: 2, day: 1, calendar: 'lunar', leapMonth: true, clock: { kind: 'unknown' }, timezone: 8 } });
  assert.equal(lunar.data.unknown.source.solarDate, '2023-03-22');
});

test('指定时辰跨立春时保留两种年月柱，支持真太阳时与追问', async () => {
  const input = { question: '问题', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'shichen', index: 8 }, timezone: 8, timeStandard: 'true-solar', longitude: 116.4 } };
  const result = await calculate('bazi', input);
  assert.equal(result.data.chart, null);
  assert.equal(result.data.unknown.common.year, null);
  assert.ok(result.data.unknown.segments.length >= 2);
  assert.match(result.prompt.text, /真太阳时，经度 116.4°/);
  const saved = JSON.parse(JSON.stringify(result));
  assert.match((await reprompt({ method: 'bazi', result: saved, question: '继续问' })).prompt.text, /继续问/);
  saved.data.unknown.segments[0].endTimestamp++;
  await assert.rejects(() => reprompt({ method: 'bazi', result: saved, question: '继续问' }), /不一致/);
});
