import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, inputSchemas, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } as const;
const input = { question: '事业如何？', birth, gender: 'female', referenceTime: '2025-01-01T00:00:00Z', prompt: { scope: 'yearly', topic: 'career-wealth', schools: ['sanhe', 'sihua'] } } as const;


test('六种运限、各主题和流派进入提示词', async () => {
  const layers = ['decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'] as const;
  for (const scope of layers) {
    const result = await calculate('ziwei', { ...input, prompt: { ...input.prompt, scope } });
    assert.equal(result.data.reference.layers[scope].palaceNames.length, 12);
    assert.match(result.prompt.text, /事业财运/); assert.match(result.prompt.text, /三合/); assert.match(result.prompt.text, /四化/);
  }
  const health = await calculate('ziwei', { ...input, prompt: { scope: 'origin', topic: 'health', schools: ['feixing'] } });
  assert.match(health.prompt.text, /疾厄宫/); assert.match(health.prompt.text, /医学诊断/); assert.doesNotMatch(health.prompt.text, /【运限】/);
  assert.match(health.prompt.text, /【本命宫干四化】/);
  for (const palace of health.data.natal.palaces) for (const item of palace.flyingTransformations) assert.ok(health.prompt.text.includes(`化${item.mutagen}${item.star}→${item.targetName}${item.targetBranch}宫`));
  const topics = inputSchemas['ziwei'].shape.prompt.unwrap().shape.topic.unwrap().options;
  for (const topic of topics) {
    const result = await calculate('ziwei', { ...input, prompt: { scope: 'origin', topic } });
    assert.match(result.prompt.text, /【主题】/); assert.doesNotMatch(result.prompt.text, /undefined/);
  }
});

test('农历闰月、真太阳时、夏令时和非法出生资料明确处理', async () => {
  const lunar = await calculate('ziwei', { question: '问题', gender: 'female', birth: { ...birth, calendar: 'lunar', month: 4, day: 21 } });
  const solar = await calculate('ziwei', { question: '问题', gender: 'female', birth });
  assert.deepEqual(lunar.data.natal, solar.data.natal);
  const leap = await calculate('ziwei', { question: '问题', gender: 'female', birth: { ...birth, year: 2023, month: 2, day: 1, calendar: 'lunar', leapMonth: true } });
  assert.equal(leap.data.natal.solarDate, '2023-03-22'); assert.match(leap.data.natal.lunarDate, /闰二月/);
  const corrected = await calculate('ziwei', { question: '问题', gender: 'female', birth: { ...birth, timeStandard: 'true-solar', longitude: 87.6 } });
  assert.ok(corrected.data.basis.trueSolarCorrection); assert.notEqual(corrected.data.basis.correctedLocalDateTime, corrected.data.basis.localDateTime);
  const dstBirth = { year: 1990, month: 1, day: 15, clock: { kind: 'exact', hour: 8, minute: 0, second: 0 }, timeZoneId: 'America/New_York' };
  const dst = await calculate('ziwei', { question: '问题', gender: 'female', birth: dstBirth, referenceTime: '2025-07-15T16:00:00Z' });
  assert.equal(dst.data.basis.timezone, -5); assert.equal(dst.data.reference.timezone, -4); assert.equal(dst.data.reference.localDateTime, '2025-07-15T12:00:00');
  for (const invalid of [
    { ...input, birth: { ...birth, day: 32 } }, { ...input, prompt: { candidateIndex: 0 } },
    { ...input, birth: { ...birth, longitude: 100 } }, { ...input, birth: { ...birth, timeStandard: 'true-solar' } },
    { ...input, referenceTime: undefined, prompt: { scope: 'yearly' } }, { ...input, referenceTime: '1989-01-01T00:00:00Z' },
    { ...input, referenceTime: '2501-01-01T00:00:00Z' },
    { ...input, rules: { ageDivide: 'invalid' } },
  ]) await assert.rejects(() => calculate('ziwei', invalid));
});

test('不同算法请求交错后结果稳定，保存追问核对盘面及输入', async () => {
  const first = await calculate('ziwei', input);
  await calculate('ziwei', { ...input, rules: { algorithm: 'zhongzhou', yearDivide: 'exact', horoscopeDivide: 'exact', dayDivide: 'current', fixLeap: false } });
  const repeated = await calculate('ziwei', input); assert.deepEqual(first.data, repeated.data);
  const saved = JSON.parse(JSON.stringify(first));
  const next = await reprompt({ method: 'ziwei', result: saved, question: '追问' });
  assert.match(next.prompt.text, /事业财运/); assert.match(next.prompt.text, /【运限】/);
  const changed = structuredClone(saved); changed.data.natal.palaces[0].majorStars[0].name = '伪造';
  await assert.rejects(() => reprompt({ method: 'ziwei', result: changed, question: '追问' }), /不一致/);
  const alteredFlight = structuredClone(saved); alteredFlight.data.natal.palaces[0].flyingTransformations[0].targetIndex = 99;
  await assert.rejects(() => reprompt({ method: 'ziwei', result: alteredFlight, question: '追问' }), /不一致/);
});

test('HTTP 与 MCP 使用独立紫微并复用结果', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'ziwei' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'ziwei', input }); assert.equal(response.status, 200);
  const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ziwei', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'ziwei', result: saved, question: '追问' })).status, 200);
});

test('紫微运限支持逐宫飞化结构与全年十二流月时间线', async () => {
  const result = await calculate('ziwei', { ...input, includeTimeline: true });
  assert.equal(result.data.reference.layers.yearly.palaceFlying.length, 12);
  for (const item of result.data.reference.layers.yearly.palaceFlying) {
    assert.equal(item.transformations.length, 4);
  }
  assert.ok(result.data.reference.monthlyTimeline);
  assert.equal(result.data.reference.monthlyTimeline.length, 12);
  assert.match(result.prompt.text, /【流年十二流月时间线】/);
  assert.ok(result.data.reference.yearlyTimeline);
  assert.equal(result.data.reference.yearlyTimeline.length, 10);
  assert.match(result.prompt.text, /【当前大限十年流年时间线】/);
});
