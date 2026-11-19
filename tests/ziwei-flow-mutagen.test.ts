import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { formatScopeFlying, formatScopeMutagens, locateScopeMutagens } from '../src/systems/ziwei-flying';
import { buildZiweiAstrolabe, buildZiweiHoroscope } from '../src/systems/ziwei/index';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } as const;
const input = { question: '流年如何？', birth, gender: 'male', referenceTime: '2025-05-15T04:00:00Z', prompt: { scope: 'yearly', schools: ['sihua'] } } as const;
const stemStars: Record<string, string[]> = {
  甲: ['廉贞', '破军', '武曲', '太阳'], 乙: ['天机', '天梁', '紫微', '太阴'], 丙: ['天同', '天机', '文昌', '廉贞'],
  丁: ['太阴', '天同', '天机', '巨门'], 戊: ['贪狼', '太阴', '右弼', '天机'], 己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'], 辛: ['巨门', '太阳', '文曲', '文昌'], 壬: ['天梁', '紫微', '左辅', '武曲'], 癸: ['破军', '巨门', '太阴', '贪狼'],
};

test('六个运限的四化按实际本命星曜及动态宫名定位', async () => {
  const seen = new Set<string>();
  for (let year = 2020; year <= 2029; year++) for (const algorithm of ['default', 'zhongzhou'] as const) {
    const result = await calculate('ziwei', { ...input, referenceTime: `${year}-05-15T04:00:00Z`, gender: year % 2 ? 'male' : 'female', rules: { algorithm } });
    const { natal, reference } = result.data;
    seen.add(reference.layers.yearly.heavenlyStem);
    for (const [scope, layer] of Object.entries(reference.layers)) {
      assert.deepEqual(layer.mutagen, stemStars[layer.heavenlyStem], `${year}/${algorithm}/${scope}`);
      assert.deepEqual(layer.mutagenPlacements.map((item) => item.mutagen), ['禄', '权', '科', '忌']);
      for (const item of layer.mutagenPlacements) {
        const matches = natal.palaces.filter((palace) => [...palace.majorStars, ...palace.minorStars].some((star) => star.name === item.star));
        assert.equal(matches.length, 1, `${year}/${scope}/${item.star}`);
        assert.deepEqual([item.targetIndex, item.natalPalace, item.targetBranch, item.scopePalace], [matches[0].index, matches[0].name, matches[0].earthlyBranch, layer.palaceNames[matches[0].index]]);
      }
    }
    assert.ok(result.prompt.text.includes(formatScopeMutagens(reference.layers.yearly.mutagenPlacements)));
    assert.doesNotMatch(result.prompt.text, /大限：/);
  }
  assert.equal(seen.size, 10);
  const known = await calculate('ziwei', input);
  assert.deepEqual(known.data.reference.layers.yearly.mutagenPlacements.map(({ mutagen, star, natalPalace, targetBranch, scopePalace }) => [mutagen, star, natalPalace, targetBranch, scopePalace]), [
    ['禄', '天机', '兄弟', '酉', '官禄'], ['权', '天梁', '父母', '亥', '迁移'], ['科', '紫微', '命宫', '戌', '仆役'], ['忌', '太阴', '子女', '未', '福德'],
  ]);
  const natal = await reprompt({ method: 'ziwei', result: known, question: '只看本命', prompt: { scope: 'origin' } });
  assert.doesNotMatch(natal.prompt.text, /【运限】|该运限/);
});

test('出生候选与八字紫微合参保留各自运限四化，追问核对结果', async () => {
  const uncertain = await calculate('ziwei', { ...input, birth: { ...birth, clock: { kind: 'unknown' } } });
  assert.ok('unknown' in uncertain.data);
  for (const candidate of uncertain.data.unknown.candidates) {
    const placement = candidate.chart.reference!.layers.yearly.mutagenPlacements;
    assert.ok(uncertain.prompt.text.includes(formatScopeMutagens(placement)));
  }
  const combined = await calculate('bazi-ziwei', { ...input, prompt: { topic: 'timing' } });
  const ref = combined.data.charts.ziwei.reference!;
  assert.ok(combined.prompt.text.includes(formatScopeMutagens(ref.layers.decadal.mutagenPlacements)));
  assert.ok(combined.prompt.text.includes(formatScopeMutagens(ref.layers.yearly.mutagenPlacements)));
  const follow = await reprompt({ method: 'bazi-ziwei', result: combined, question: '继续问' });
  assert.ok(follow.prompt.text.includes(formatScopeMutagens(ref.layers.yearly.mutagenPlacements)));
  const tampered = structuredClone(combined); tampered.data.charts.ziwei.reference!.layers.yearly.mutagenPlacements[0].scopePalace = '伪造';
  await assert.rejects(() => reprompt({ method: 'bazi-ziwei', result: tampered, question: '继续问' }), /不一致/);
});

test('缺少或重复化星明确拒绝，HTTP 与 MCP 返回相同定位', async () => {
  assert.throws(() => locateScopeMutagens([], { name: '流年', heavenlyStem: '甲', mutagen: ['廉贞', '破军', '武曲', '太阳'], palaceNames: Array(12).fill('命宫') }), /落宫无法确认/);
  const duplicate = [{ index: 0, name: '命宫', earthlyBranch: '子', majorStars: [{ name: '廉贞' }], minorStars: [] }, { index: 1, name: '兄弟', earthlyBranch: '丑', majorStars: [{ name: '廉贞' }], minorStars: [] }];
  assert.throws(() => locateScopeMutagens(duplicate, { name: '流年', heavenlyStem: '甲', mutagen: ['廉贞', '破军', '武曲', '太阳'], palaceNames: Array(12).fill('命宫') }), /落宫无法确认/);
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'ziwei' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'ziwei', input }); assert.equal(http.status, 200);
  const a: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ziwei', arguments: input } }); assert.equal(mcp.status, 200);
  const b: any = await mcp.json();
  assert.deepEqual(a.data.reference.layers.yearly.mutagenPlacements, b.result.structuredContent.data.reference.layers.yearly.mutagenPlacements);
  assert.equal(a.prompt.text, b.result.structuredContent.prompt.text);
});

test('运限四化动态宫位与自研紫微引擎逐宫逐化一致', async () => {
  for (const gender of ['male', 'female'] as const) for (const algorithm of ['default', 'zhongzhou'] as const) {
    const result = await calculate('ziwei', { ...input, gender, rules: { algorithm } });
    const chart = buildZiweiAstrolabe({ solarDate: '1990-05-15', timeIndex: 7, gender, rules: { algorithm, yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward', fixLeap: true } });
    const horoscope = buildZiweiHoroscope(chart, '2025-05-15', 6);
    for (const [scope, layer] of Object.entries(result.data.reference.layers)) {
      const hLayer = horoscope[scope as keyof typeof horoscope] as { palaceNames: string[]; mutagen: string[] };
      for (const palace of layer.palaceNames) for (const [mIdx, mutagen] of (['禄', '权', '科', '忌'] as const).entries()) {
        const actual = layer.mutagenPlacements.some((item) => item.scopePalace === palace && item.mutagen === mutagen);
        const palaceIdx = hLayer.palaceNames.indexOf(palace);
        const targetPalace = chart.palaces[palaceIdx];
        const expected = [...targetPalace.majorStars, ...targetPalace.minorStars].some((star) => star.name === hLayer.mutagen[mIdx]);
        assert.equal(actual, expected, `${gender}/${algorithm}/${scope}/${palace}/${mutagen}`);
      }
    }
  }
});

test('飞星口径按所选运限宫名展示本命宫干路径，并明确映射范围', async () => {
  const result = await calculate('ziwei', { ...input, prompt: { scope: 'yearly', schools: ['feixing'] } });
  const { natal, reference } = result.data;
  const layer = reference.layers.yearly;
  const mapped = formatScopeFlying(natal.palaces, layer.palaceNames);
  assert.ok(result.prompt.text.includes(mapped));
  assert.match(result.prompt.text, /沿用本命宫干及本命化星/);
  assert.match(result.prompt.text, /未另起运限宫干，也不计算流曜或跨层飞化/);
  assert.match(result.prompt.text, /不把它当作另起运限宫干或流曜飞化/);
  assert.doesNotMatch(result.prompt.text, /逐宫运限飞化尚未计算/);
  for (const palace of natal.palaces) {
    const line = mapped.split('\n').find((item) => item.startsWith(`${layer.palaceNames[palace.index]}（`));
    assert.ok(line, palace.name);
    for (const path of palace.flyingTransformations) assert.ok(line.includes(`化${path.mutagen}${path.star}→${layer.palaceNames[path.targetIndex]}`), `${palace.name}/${path.mutagen}`);
  }
  const noFlying = await reprompt({ method: 'ziwei', result, question: '不用飞星', prompt: { scope: 'yearly', schools: ['sihua'] } });
  assert.doesNotMatch(noFlying.prompt.text, /【运限宫名映射说明】/);
  const natalOnly = await reprompt({ method: 'ziwei', result, question: '只看本命', prompt: { scope: 'origin', schools: ['feixing'] } });
  assert.doesNotMatch(natalOnly.prompt.text, /【运限宫名映射说明】/);
  assert.match(natalOnly.prompt.text, /若列出运限宫名映射/);
  const unknown = await calculate('ziwei', { ...input, birth: { ...birth, clock: { kind: 'unknown' } }, prompt: { scope: 'yearly', schools: ['feixing'] } });
  assert.match(unknown.prompt.text, /未在比较摘要展开/);
  const candidate = await reprompt({ method: 'ziwei', result: unknown, question: '候选一', prompt: { scope: 'yearly', schools: ['feixing'], candidateIndex: 0 } });
  assert.match(candidate.prompt.text, /【运限宫名映射说明】/);
});
