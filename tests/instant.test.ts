import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { formatCivilDateTime } from '../src/systems/huangji/civil-time';

const question = '这件事应当如何考虑？';
const at = '2025-01-01T00:00:00Z';
const observer = { longitude: 116.4, latitude: 39.9, timezone: 8 };

test('五种即时盘共用起盘瞬时，并保持与独立计算一致', async () => {
  const birth = { year: 2025, month: 1, day: 1, clock: { kind: 'exact', hour: 8, minute: 0, second: 0 }, timezone: 8 };
  const bazi = await calculate('bazi', { question, birth });
  const ziwei = await calculate('ziwei', { question, birth, gender: 'female' });
  const astro = await calculate('astrolabe', { question, birth: { year: 2025, month: 1, day: 1, hour: 8, minute: 0, second: 0, ...observer, coordinateAccuracy: 'user-provided', useTrueSolarTime: false } });
  const qizheng = await calculate('qizheng', { question, birth: { year: 2025, month: 1, day: 1, hour: 8, minute: 0, second: 0, ...observer } });
  for (const type of ['bazi', 'ziwei', 'bazi-ziwei', 'astrolabe', 'qizheng'] as const) {
    const result = await calculate('instant', { question, type, at, ...(['astrolabe', 'qizheng'].includes(type) ? { observer } : {}) });
    assert.equal(result.data.basis.utcDateTime, '2025-01-01T00:00:00.000Z');
    assert.match(result.prompt.text, /即时盘/); assert.match(result.prompt.text, /不是个人出生盘/);
    if (result.data.bazi) { assert.deepEqual(result.data.bazi.pillars, bazi.data.chart.pillars); assert.match(result.prompt.text, /四柱条件证据/); }
    if (result.data.ziwei) {
      assert.deepEqual(result.data.ziwei.palaces.map((p) => p.flyingTransformations), ziwei.data.natal.palaces.map((p: any) => p.flyingTransformations));
      assert.doesNotMatch(JSON.stringify(result.data.ziwei), /"gender"|"decadal"|"ages"|"changsheng12"|"boshi12"/);
      assert.match(result.prompt.text, /宫干四化/);
    }
    if (result.data.astrolabe) { assert.deepEqual(result.data.astrolabe.points, astro.data.points); assert.match(result.prompt.text, /相位：/); }
    if (result.data.qizheng) { assert.deepEqual(result.data.qizheng.stars, qizheng.data.stars); assert.match(result.prompt.text, /吊照：/); }
    const saved = JSON.parse(JSON.stringify(result));
    const continued = await reprompt({ method: 'instant', result: saved, question: '继续问', currentTime: '2026-01-01T00:00:00Z' });
    assert.match(continued.prompt.text, /2025-01-01T00:00:00.000Z/); assert.match(continued.prompt.text, /继续问/);
    saved.data.basis.utcDateTime = '2026-01-01T00:00:00.000Z';
    await assert.rejects(() => reprompt({ method: 'instant', result: saved, question: '追问' }), /不一致/);
  }
});

test('紫微默认与中州的男女共同星曜逐项核验，不泄漏岁限', async () => {
  for (const year of [1984, 1990, 2024]) for (const hour of [0, 9, 23]) for (const algorithm of ['default', 'zhongzhou'] as const) {
    const instantAt = `${year}-05-15T${String(hour).padStart(2, '0')}:30:00+08:00`;
    const result = await calculate('instant', { question, type: 'ziwei', at: instantAt, ziweiAlgorithm: algorithm });
    const birth = { year, month: 5, day: 15, clock: { kind: 'exact', hour, minute: 30, second: 0 }, timezone: 8 };
    const [male, female] = await Promise.all(['male', 'female'].map((gender) => calculate('ziwei', { question, birth, gender, rules: { algorithm } })));
    for (let i = 0; i < 12; i++) {
      const p = result.data.ziwei.palaces[i], a = male.data.natal.palaces[i], b = female.data.natal.palaces[i];
      for (const key of ['majorStars', 'minorStars', 'adjectiveStars'] as const) {
        for (const star of p[key]) { assert.ok(a[key].some((x: any) => JSON.stringify(x) === JSON.stringify(star))); assert.ok(b[key].some((x: any) => JSON.stringify(x) === JSON.stringify(star))); }
      }
      assert.deepEqual(p.flyingTransformations, a.flyingTransformations); assert.deepEqual(p.flyingTransformations, b.flyingTransformations);
    }
  }
});

test('默认当刻取整秒，时区回拨按真实瞬时区分且真太阳时使用指定经度', async () => {
  const now = await calculate('instant', { type: 'bazi', question, currentTime: '2025-01-01T00:00:00.987Z' });
  assert.equal(now.data.input.at, '2025-01-01T00:00:00.000Z');
  const where = { longitude: -74, latitude: 40.7, timeZoneId: 'America/New_York' };
  const [first, second] = await Promise.all(['2024-11-03T05:30:00Z', '2024-11-03T06:30:00Z'].map((at) => calculate('instant', { type: 'astrolabe', question, at, observer: where })));
  assert.equal(first.data.basis.localDateTime, second.data.basis.localDateTime);
  assert.equal(first.data.basis.timezone, -4); assert.equal(second.data.basis.timezone, -5);
  assert.notEqual(first.data.astrolabe.points[1].longitude, second.data.astrolabe.points[1].longitude);
  const source = { type: 'bazi-ziwei', question, at: '2024-02-04T08:00:00Z', timeStandard: 'true-solar', observer: { longitude: 87.6, timezone: 8 } };
  const solar = await calculate('instant', source);
  assert.equal(solar.data.basis.utcDateTime, '2024-02-04T08:00:00.000Z');
  assert.ok(solar.data.bazi.trueSolar); assert.ok(solar.data.ziwei.trueSolarCorrection);
  assert.notEqual(solar.data.ziwei.correctedLocalDateTime, solar.data.basis.localDateTime);
});

test('五种即时盘区分真实瞬时、民用钟表和真太阳时，追问保留同一时刻', async () => {
  const source = { question, at: '2024-05-15T06:30:00Z', timeStandard: 'true-solar', observer: { longitude: 100, latitude: 30, timezone: 8 } };
  for (const type of ['bazi', 'ziwei', 'bazi-ziwei', 'astrolabe', 'qizheng'] as const) {
    const result = await calculate('instant', { ...source, type });
    assert.equal(result.data.basis.utcDateTime, '2024-05-15T06:30:00.000Z');
    assert.equal(result.data.basis.localDateTime, '2024-05-15T14:30:00');
    assert.equal(result.data.basis.trueSolarDateTime, '2024-05-15T13:13:38');
    assert.match(result.prompt.text, /观测地民用时间 2024-05-15T14:30:00 UTC\+8/);
    assert.match(result.prompt.text, /真太阳时钟表 2024-05-15T13:13:38/);
    if (result.data.bazi) assert.equal(result.data.basis.trueSolarDateTime, formatCivilDateTime(result.data.bazi.calculationClock));
    if (result.data.ziwei) assert.equal(result.data.basis.trueSolarDateTime, result.data.ziwei.correctedLocalDateTime);
    if (result.data.qizheng) assert.equal(result.data.basis.trueSolarDateTime, formatCivilDateTime(result.data.qizheng.basis.palaceClock));
    if (type === 'astrolabe') assert.match(result.prompt.text, /西洋星盘仍按真实瞬时计算，真太阳时仅作参考/);
    if (type === 'qizheng') assert.match(result.prompt.text, /真太阳时用于命身宫时辰，星位仍按真实瞬时计算/);
    const follow = await reprompt({ method: 'instant', result: JSON.parse(JSON.stringify(result)), question: '继续问' });
    assert.match(follow.prompt.text, /真太阳时钟表 2024-05-15T13:13:38/);
  }
  const newYork = await calculate('instant', { question, type: 'qizheng', at: '2024-05-15T04:30:00Z', timeStandard: 'true-solar', observer: { longitude: -74, latitude: 40.7, timeZoneId: 'America/New_York' } });
  assert.equal(newYork.data.basis.timezone, -4);
  assert.equal(newYork.data.basis.localDateTime, '2024-05-15T00:30:00');
  assert.equal(newYork.data.basis.trueSolarDateTime, '2024-05-14T23:37:38');
  assert.equal(newYork.data.basis.trueSolarDateTime, formatCivilDateTime(newYork.data.qizheng.basis.palaceClock));
  const normal = await calculate('instant', { question, type: 'bazi', at: source.at });
  assert.equal(normal.data.basis.trueSolarDateTime, undefined);
  assert.match(normal.prompt.text, /北京时间 2024-05-15T14:30:00 UTC\+8/);
  assert.doesNotMatch(normal.prompt.text, /真太阳时钟表/);
});

test('无效观测资料、不允许的选项和篡改结果明确拒绝', async () => {
  for (const input of [
    { type: 'astrolabe', question, at }, { type: 'qizheng', question, at, observer: { longitude: 116.4, timezone: 8 } },
    { type: 'bazi', question, at, timeStandard: 'true-solar' }, { type: 'bazi', question, at, ziweiAlgorithm: 'zhongzhou' },
    { type: 'ziwei', question, at: '2025-01-01T00:00:00.123Z' },
    { type: 'astrolabe', question, at, observer: { ...observer, timeZoneId: 'America/New_York' } },
    { type: 'astrolabe', question, at, observer: { ...observer, latitude: 90 } },
  ]) await assert.rejects(() => calculate('instant', input));
});

test('Worker HTTP 与 MCP 使用同一即时盘并复用结果', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'instant' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question, type: 'qizheng', at, observer, timeStandard: 'true-solar' };
  const http = await send('/api/calculate', { method: 'instant', input }); assert.equal(http.status, 200);
  const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'instant', arguments: input } });
  const mcpResult = (await mcp.json()).result.structuredContent;
  assert.deepEqual(mcpResult.data, saved.data);
  assert.ok(saved.prompt.text.includes(`真太阳时钟表 ${saved.data.basis.trueSolarDateTime}`));
  assert.equal(mcpResult.prompt.text, saved.prompt.text);
  const follow = await send('/api/prompt', { method: 'instant', result: saved, question: '追问' });
  assert.equal(follow.status, 200);
  assert.ok((await follow.json()).prompt.text.includes(`真太阳时钟表 ${saved.data.basis.trueSolarDateTime}`));
  saved.data.input.at = '2024-01-01T00:00:00.000Z';
  assert.equal((await send('/api/prompt', { method: 'instant', result: saved, question: '追问' })).status, 400);
});
