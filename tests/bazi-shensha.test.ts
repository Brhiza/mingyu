import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { calculateBaziShensha } from '../src/systems/bazi/shensha';
import worker from '../src/worker';

test('本命神煞记录起例及命中柱，年支和日支可共同作为依据', () => {
  const pillars = buildPillarFacts({ year: '甲子', month: '丙寅', day: '丙申', hour: '己亥' });
  const result = calculateBaziShensha(pillars);
  assert.deepEqual(result.entries.find((entry) => entry.position === 'month' && entry.name === '驿马'), {
    name: '驿马', position: 'month', branch: '寅', targetKind: '支', target: '寅', basis: [
      { pillar: 'year', kind: '支', value: '子', target: '寅' },
      { pillar: 'day', kind: '支', value: '申', target: '寅' },
    ],
  });
  assert.deepEqual(result.entries.find((entry) => entry.position === 'hour' && entry.name === '天乙贵人')?.basis,
    [{ pillar: 'day', kind: '干', value: '丙', target: '亥' }]);
  assert.match(result.limitation, /仅列54项/);
});

test('天德查天干或地支时保留实际命中位置，福星贵人不混入年支福星', () => {
  const stems = buildPillarFacts({ year: '乙亥', month: '己亥', day: '乙丑', hour: '庚申' });
  const entries = calculateBaziShensha(stems).entries;
  assert.deepEqual(entries.find((item) => item.name === '天德贵人' && item.position === 'year'), {
    name: '天德贵人', position: 'year', branch: '亥', targetKind: '干', target: '乙',
    basis: [{ pillar: 'month', kind: '支', value: '亥', target: '乙' }],
  });
  assert.equal(entries.some((item) => item.name === '福星贵人' && item.position === 'hour'), false);
  const branches = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '丁卯', day: '丙申', hour: '己亥' })).entries;
  const branch = branches.find((item) => item.name === '天德贵人' && item.position === 'day');
  assert.equal(branch?.targetKind, '支'); assert.equal(branch?.target, '申');
});

test('整局神煞按真实四柱顺序记录；未提供性别不猜测元辰', () => {
  const ordered = buildPillarFacts({ year: '甲子', month: '戊寅', day: '庚辰', hour: '己亥' });
  const noGender = calculateBaziShensha(ordered);
  assert.equal(noGender.included.length, 54);
  assert.deepEqual(noGender.unavailable, [{ name: '元辰', reason: '该查法需要性别，未提供时不推测。' }]);
  assert.deepEqual(noGender.global.find((item) => item.name === '三奇贵人')?.basis.map((item) => item.pillar), ['year', 'month', 'day']);
  const genderPillars = buildPillarFacts({ year: '甲子', month: '己巳', day: '庚午', hour: '癸未' });
  const male = calculateBaziShensha(genderPillars, 'male');
  const female = calculateBaziShensha(genderPillars, 'female');
  assert.equal(male.included.length, 55); assert.deepEqual(male.unavailable, []);
  assert.equal(male.entries.find((item) => item.name === '元辰')?.target, '巳');
  assert.equal(female.entries.find((item) => item.name === '元辰')?.target, '未');
  const gonglu = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '丙寅', day: '癸亥', hour: '癸丑' }));
  assert.deepEqual(gonglu.global.find((item) => item.name === '拱禄')?.basis.map((item) => item.value), ['癸亥', '癸丑']);
});

test('精确和未知时辰可查看神煞并追问，HTTP 与 MCP 返回相同数据', async () => {
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const input = { birth, gender: 'female', question: '事业如何？' };
  const result = await calculate('bazi', input);
  assert.match(result.prompt.text, /本命神煞（55项）/);
  assert.equal(result.data.chart!.shensha.included.length, 55);
  const follow = await reprompt({ method: 'bazi', result, question: '继续问' });
  assert.match(follow.prompt.text, /本命神煞（55项）/);
  const altered = structuredClone(result); altered.data.chart!.shensha.entries.pop();
  await assert.rejects(() => reprompt({ method: 'bazi', result: altered, question: '继续问' }), /不一致/);
  const uncertain = await calculate('bazi', { ...input, birth: { ...birth, clock: { kind: 'unknown' } } });
  assert.ok(uncertain.data.unknown!.segments.every((segment) => segment.shensha.included.length === 55));
  assert.match(uncertain.prompt.text, /仅列55项本命神煞/);
  const withoutGender = await calculate('bazi', { birth, question: '问题' });
  assert.deepEqual(withoutGender.data.chart!.shensha.unavailable.map((item) => item.name), ['元辰']);
  assert.match(withoutGender.prompt.text, /元辰因未提供性别未计算/);
  const first = uncertain.data.unknown!.segments[0];
  assert.deepEqual(first.shensha, calculateBaziShensha(first.pillars, 'female'));
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi', input });
  assert.equal(http.status, 200);
  const httpValue: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } });
  const mcpValue: any = await mcp.json();
  assert.deepEqual(httpValue.data.chart.shensha, mcpValue.result.structuredContent.data.chart.shensha);
});
