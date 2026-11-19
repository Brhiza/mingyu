import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { question: '住宅方向如何？', currentTime: '2025-01-01T00:00:00Z', person: { kind: 'birth', year: 2024, month: 2, day: 4, gender: 'female', timezone: 8 },
  construction: { year: 2024 }, orientation: { kind: 'degree', reading: 'facing', degree: 202.5, northReference: 'true', uncertaintyDegrees: 1 }, flow: { kind: 'date', year: 2026, month: 6, day: 15 } };

test('八宅与玄空独立计算，跨立春和坐山候选按同一坐山对照', async () => {
  const result = await calculate('residential', input);
  const bazi = await calculate('bazhai', { question: '问题', person: input.person, house: { kind: 'measurement', reading: 'sit', degree: 22.5, northReference: 'true', uncertaintyDegrees: 1 } });
  const xuan = await calculate('xuankong', { question: '问题', construction: input.construction, orientation: input.orientation, flow: input.flow });
  assert.deepEqual(result.data.bazhai, bazi.data); assert.deepEqual(result.data.xuankong, xuan.data);
  assert.equal(result.data.houses.length, 2); assert.equal(result.data.xuankong.charts.length, 4); assert.equal(result.data.links.length, 8);
  for (const link of result.data.links) {
    const chart = result.data.xuankong.charts[link.xuanChartIndex];
    assert.equal(link.sitMountain, chart.sitMountain); assert.equal(link.yun, chart.period.yun); assert.equal(link.xuanFormation, chart.formation);
    const matching = result.data.bazhai.comparisons.find((row: any) => row.sitMountain === link.sitMountain && row.year === link.personYear && row.mingGua === link.mingGua);
    assert.ok(matching); assert.equal(link.directions.length, 8);
    for (const direction of link.directions) {
      const baziDirection = matching.directions.find((item: any) => item.direction === direction.direction);
      const palace = chart.palaces.find((item: any) => item.direction === direction.direction);
      assert.equal(direction.ming, baziDirection.ming); assert.equal(direction.house, baziDirection.house);
      assert.deepEqual([direction.yunStar, direction.shanStar, direction.xiangStar, direction.yearStar, direction.monthStar], [palace.period, palace.mountain, palace.water, palace.yearStar, palace.monthStar]);
    }
  }
  assert.match(result.prompt.text, /不生成综合吉凶总分/);
  assert.match(result.prompt.text, /原始读数202\.5°，来源住宅朝向/);
  assert.equal((result.prompt.text.match(/【问题】/g) ?? []).length, 1);
});

test('缺失居住人或建造年份时仅计算有依据的层级，不静默忽略输入', async () => {
  const personOnly = await calculate('residential', { question: '问题', person: { kind: 'gua', mingGua: '坎' } });
  assert.ok(personOnly.data.bazhai); assert.equal(personOnly.data.xuankong, null);
  assert.match(personOnly.prompt.text, /未提供建造或起运年份/);
  const houseOnly = await calculate('residential', { question: '问题', orientation: { kind: 'mountain', sitMountain: '子' } });
  assert.equal(houseOnly.data.bazhai, null); assert.equal(houseOnly.data.xuankong, null);
  assert.equal(houseOnly.data.housePalaces[0].palaces.length, 8);
  assert.match(houseOnly.prompt.text, /未提供居住人命卦/);
  const houseWithYear = await calculate('residential', { question: '问题', orientation: { kind: 'mountain', sitMountain: '子' }, construction: { year: 2008 } });
  assert.equal(houseWithYear.data.bazhai, null); assert.equal(houseWithYear.data.xuankong.charts.length, 1);
  await assert.rejects(() => calculate('residential', { question: '问题', person: { kind: 'gua', mingGua: '坎' }, construction: { year: 2008 } }), /坐向/);
  await assert.rejects(() => calculate('residential', { question: '问题', orientation: { kind: 'mountain', sitMountain: '子' }, flow: { kind: 'year', year: 2026 } }), /建造年份/);
  await assert.rejects(() => calculate('residential', { question: '问题', orientation: { kind: 'degree', reading: 'sit', degree: 0, northReference: 'magnetic' } }));
});

test('统一结果支持追问校验，HTTP 与 MCP 内容一致', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'residential' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'residential', input }); assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'residential', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.match((await reprompt({ method: 'residential', result: saved, question: '继续问' })).prompt.text, /继续问/);
  for (const change of [(d: any) => { d.links[0].mingHouseMatch = '伪造'; }, (d: any) => { d.xuankong.charts[0].plates.shan[0] = 99; }, (d: any) => { d.bazhai.persons[0].gua = '伪造'; }]) {
    const altered = structuredClone(saved); change(altered.data);
    assert.equal((await send('/api/prompt', { method: 'residential', result: altered, question: '追问' })).status, 400);
  }
});
