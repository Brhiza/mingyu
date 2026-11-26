import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getCivilDateTimeAtFixedOffset } from '../src/systems/huangji/civil-time';
import worker from '../src/worker';
import { formatNatalFlying } from '../src/systems/ziwei-flying';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } as const;
const input = { question: '事业发展？', birth, gender: 'female', referenceTime: '2025-01-01T00:00:00Z' } as const;

test('合参精确出生共用同一瞬时，两盘与独立方法一致并保留十项主题', async () => {
  const result = await calculate('bazi-ziwei', input);
  const bazi = await calculate('bazi', input), ziwei = await calculate('ziwei', input);
  assert.deepEqual(result.data.charts.bazi, bazi.data); assert.deepEqual(result.data.charts.ziwei, ziwei.data);
  assert.equal(result.data.alignment.kind, 'exact');
  assert.equal(result.data.alignment.timestamp, result.data.charts.bazi.chart.basis.utcTimestamp);
  assert.equal(result.data.alignment.timestamp, Date.parse(result.data.charts.ziwei.basis.utcDateTime));
  assert.deepEqual(result.data.themes.map((item: any) => item.id), ['overview', 'character', 'career', 'wealth', 'relationships', 'family', 'wellbeing', 'mobility', 'inner-world', 'timing']);
  assert.match(result.prompt.text, /【事业与发展】/); assert.match(result.prompt.text, /【大运与流年】/);
  assert.match(result.prompt.text, /旺衰、化气、曲直、从儿及普通格局成败为所列条件模型/);
  assert.ok(result.prompt.text.includes(`旺衰模型${result.data.charts.bazi.chart.strength.status}`));
  assert.match(result.prompt.text, /取用基础方向/);
  assert.match(result.prompt.text, /【八字取用条件候选】/);
  assert.match(result.prompt.text, /【紫微相关宫位的本命宫干四化】/);
  assert.ok(result.prompt.text.includes(formatNatalFlying(result.data.charts.ziwei.natal.palaces)));
  assert.ok(result.prompt.text.includes(`普通取格候选${result.data.charts.bazi.chart.ordinaryPattern.candidate}`));
});

test('合参按主题及出生候选展示真实宫干四化，追问可切换主题', async () => {
  const birth = { year: 2024, month: 2, day: 4, clock: { kind: 'shichen', index: 8 }, timezone: 8 };
  const result = await calculate('bazi-ziwei', { question: '问题', birth, gender: 'female', prompt: { candidateIndex: 0, topic: 'career', ziweiSchools: ['feixing'] } });
  const chosen = result.data.alignment.candidates[0], natal = result.data.charts.ziwei.unknown.candidates[chosen.ziweiIndex].chart.natal;
  const career = natal.palaces.filter((p: any) => ['官禄', '命宫', '迁移', '财帛'].includes(p.name));
  assert.ok(result.prompt.text.includes(formatNatalFlying(career))); assert.match(result.prompt.text, /逐宫运限飞化按本命宫干映射参断/);
  const saved = JSON.parse(JSON.stringify(result));
  const reply = await reprompt({ method: 'bazi-ziwei', result: saved, question: '家庭？', prompt: { candidateIndex: 0, topic: 'family' } });
  const family = natal.palaces.filter((p: any) => ['父母', '兄弟', '子女', '田宅'].includes(p.name));
  assert.ok(reply.prompt.text.includes(formatNatalFlying(family)));
  saved.data.charts.ziwei.unknown.candidates[chosen.ziweiIndex].chart.natal.palaces[0].flyingTransformations[0].targetIndex = 99;
  await assert.rejects(() => reprompt({ method: 'bazi-ziwei', result: saved, question: '问题' }), /不一致/);
});

test('晚子规则不一致时提示差异，不能强行合并日柱', async () => {
  const late = { ...birth, clock: { kind: 'exact', hour: 23, minute: 30, second: 0 } };
  const current = await calculate('bazi-ziwei', { ...input, birth: late, ziweiRules: { dayDivide: 'current' } });
  assert.equal(current.data.charts.bazi.chart.pillars.day.ganZhi, '辛巳');
  assert.equal(current.data.charts.ziwei.natal.chineseDate.split(' ')[2], '庚辰');
  assert.match(current.prompt.text, /八字日柱辛巳与紫微排盘日柱庚辰不同/);
  const forward = await calculate('bazi-ziwei', { ...input, birth: late, ziweiRules: { dayDivide: 'forward' } });
  assert.match(forward.prompt.text, /两体系所列日柱相同/);
});

test('合参展示实际日干化气状态而非自动认定成化', async () => {
  const result = await calculate('bazi-ziwei', { ...input, birth: { ...birth, day: 7 } });
  const transformation = result.data.charts.bazi.chart.transformation;
  assert.equal(transformation.status, '合绊（合而不化）');
  assert.ok(result.prompt.text.includes(`${transformation.pattern}（${transformation.status}）`));
});

test('合参保留曲直结构和已迁移格局排序', async () => {
  const source = { ...input, birth: { year: 1980, month: 1, day: 3, clock: { kind: 'exact', hour: 6, minute: 0, second: 0 }, timezone: 8 } };
  const result = await calculate('bazi-ziwei', source);
  assert.equal(result.data.charts.bazi.chart.patternOverview.pattern, '曲直格');
  assert.match(result.prompt.text, /曲直亥卯未木局（条件成立）/);
});

test('合参保留从儿条件和已迁移格局排序', async () => {
  const source = { ...input, birth: { year: 1987, month: 2, day: 23, clock: { kind: 'exact', hour: 8, minute: 0, second: 0 }, timezone: 8 } };
  const result = await calculate('bazi-ziwei', source);
  assert.equal(result.data.charts.bazi.chart.patternOverview.pattern, '从儿格');
  assert.match(result.prompt.text, /从儿三会食伤成气（条件成立）/);
});

async function assertAlignment(input: any) {
  const result = await calculate('bazi-ziwei', input), { alignment, charts } = result.data;
  assert.equal(alignment.kind, 'candidates');
  const bz = charts.bazi.unknown, zw = charts.ziwei.unknown;
  assert.equal(alignment.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), bz.source.endTimestamp - bz.source.startTimestamp - bz.source.excludedSeconds * 1000);
  for (const item of alignment.candidates) {
    const a = bz.segments[item.baziIndex], b = zw.candidates[item.ziweiIndex];
    assert.equal(item.startTimestamp, Math.max(a.startTimestamp, b.startTimestamp)); assert.equal(item.endTimestamp, Math.min(a.endTimestamp, b.endTimestamp));
    assert.equal(item.timezone, a.timezone); assert.equal(item.timezone, b.timezone);
    for (const timestamp of [item.startTimestamp, item.endTimestamp - 1000]) {
      const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), item.timezone);
      const { clock: _clock, calendar: _calendar, leapMonth: _leap, ...rest } = input.birth;
      const exactBirth = { ...rest, year: local.year, month: local.month, day: local.day, calendar: 'solar', timezone: item.timezone, clock: { kind: 'exact', hour: local.hour, minute: local.minute, second: local.second } };
      const exactBazi = await calculate('bazi', { question: '问题', birth: exactBirth, gender: input.gender });
      const exactZiwei = await calculate('ziwei', { question: '问题', birth: exactBirth, gender: input.gender, rules: input.ziweiRules });
      assert.deepEqual(a.pillars, exactBazi.data.chart.pillars);
      assert.deepEqual(b.chart.natal, exactZiwei.data.natal);
    }
  }
  return result;
}

test('交节日未知时辰按真实交集对齐而不交叉组合', async () => {
  const source = { question: '综合？', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'unknown' }, timezone: 8 }, gender: 'female', referenceTime: '2025-06-01T00:00:00Z', prompt: { topic: 'career' } };
  const result = await assertAlignment(source);
  assert.ok(result.data.alignment.candidates.length >= 14);
  assert.ok(result.data.alignment.candidates.length < result.data.charts.bazi.unknown.segments.length * result.data.charts.ziwei.unknown.candidates.length);
  assert.match(result.prompt.text, /只组合实际时间重叠/); assert.match(result.prompt.text, /【事业与发展】/);
  assert.match(result.prompt.text, /精确起运和岁运未计算/);
  const selected = await calculate('bazi-ziwei', { ...source, prompt: { topic: 'timing', candidateIndex: 0, detailLevel: 'professional', baziSchools: ['ziping'], ziweiSchools: ['sanhe'] } });
  assert.match(selected.prompt.text, /合参出生候选 0/); assert.match(selected.prompt.text, /精确起运或岁运未计算/); assert.match(selected.prompt.text, /三合/);
  await assert.rejects(() => calculate('bazi-ziwei', { ...source, prompt: { candidateIndex: 200 } }), /索引超出/);
});

test('夏令时与真太阳时交界下候选交集覆盖全部有效秒数', async () => {
  const source = { question: '问题', birth: { year: 2024, month: 11, day: 3, clock: { kind: 'shichen', index: 1 }, timeZoneId: 'America/New_York', timeStandard: 'true-solar', longitude: -74 }, gender: 'male', referenceTime: '2025-06-01T00:00:00Z' };
  const result = await assertAlignment(source);
  assert.equal(result.data.alignment.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 3 * 3600_000);
  assert.deepEqual([...new Set(result.data.alignment.candidates.map((item: any) => item.timezone))], [-4, -5]);
  const restricted = await calculate('bazi-ziwei', { ...source, birth: { ...source.birth, timezone: -4 } });
  assert.equal(restricted.data.alignment.candidates.reduce((sum: number, item: any) => sum + item.endTimestamp - item.startTimestamp, 0), 3600_000);
});

test('主题、解读口径、原盘追问与输入校验', async () => {
  const selected = await calculate('bazi-ziwei', { ...input, prompt: { topic: 'wellbeing', detailLevel: 'concise', baziSchools: ['ziping'], ziweiSchools: ['sihua'] } });
  assert.match(selected.prompt.text, /身心与健康/); assert.match(selected.prompt.text, /医疗判断/); assert.match(selected.prompt.text, /子平/); assert.match(selected.prompt.text, /四化/);
  assert.doesNotMatch(selected.prompt.text, /【事业与发展】/);
  const saved = JSON.parse(JSON.stringify(selected));
  const continued = await reprompt({ method: 'bazi-ziwei', result: saved, question: '后续问题' });
  assert.match(continued.prompt.text, /身心与健康/); assert.match(continued.prompt.text, /后续问题/);
  saved.data.charts.ziwei.natal.palaces[0].name = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi-ziwei', result: saved, question: '问题' }), /不一致/);
  for (const invalid of [{ ...input, prompt: { candidateIndex: 0 } }, { ...input, referenceTime: '2025-01-01T00:00:00.123Z' }, { ...input, ziweiRules: { ageDivide: 'invalid' } }]) await assert.rejects(() => calculate('bazi-ziwei', invalid));
});

test('HTTP 和 MCP 返回同一合参，修改双盘被拒绝', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi-ziwei' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'bazi-ziwei', input }); assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi-ziwei', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'bazi-ziwei', result: saved, question: '追问' })).status, 200);
  saved.data.charts.bazi.chart.pillars.day.ganZhi = '伪造';
  assert.equal((await send('/api/prompt', { method: 'bazi-ziwei', result: saved, question: '追问' })).status, 400);
});

test('重历 47 小时民用日不遗漏出生交集', async () => {
  const input = { question: '问题', birth: { year: 1969, month: 9, day: 30, clock: { kind: 'unknown' }, timeZoneId: 'Pacific/Kwajalein' }, gender: 'female' };
  const result = await assertAlignment(input);
  const source = result.data.charts.bazi.unknown.source;
  assert.equal(source.endTimestamp - source.startTimestamp, 47 * 3600_000);
  assert.deepEqual([...new Set(result.data.alignment.candidates.map((item: any) => item.timezone))], [11, -12]);
});

test('外部修改返回的主题资料不会污染后续计算', async () => {
  const result = await calculate('bazi-ziwei', input);
  result.data.themes[0].label = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi-ziwei', result, question: '问题' }), /不一致/);
  const next = await calculate('bazi-ziwei', input);
  assert.equal(next.data.themes[0].label, '命局总纲');
});

test('八字与紫微 exact 模式在立春交节前后一秒与 23 点子时边界四柱完全一致', async () => {
  for (const birth of [
    { year: 2024, month: 2, day: 4, clock: { kind: 'exact', hour: 16, minute: 26, second: 52 }, timezone: 8 },
    { year: 2024, month: 2, day: 4, clock: { kind: 'exact', hour: 16, minute: 27, second: 10 }, timezone: 8 },
    { year: 2024, month: 5, day: 15, clock: { kind: 'exact', hour: 23, minute: 30, second: 0 }, timezone: 8 },
  ] as const) {
    const res = await calculate('bazi-ziwei', {
      question: '边界校准',
      birth,
      gender: 'female',
      ziweiRules: { yearDivide: 'exact', horoscopeDivide: 'exact', dayDivide: 'forward' },
    });
    const bz = res.data.charts.bazi.chart.pillars;
    const expectedChineseDate = `${bz.year.ganZhi} ${bz.month.ganZhi} ${bz.day.ganZhi} ${bz.hour.ganZhi}`;
    assert.equal(res.data.charts.ziwei.natal.chineseDate, expectedChineseDate);
  }
});
