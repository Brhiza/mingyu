import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const flow = { reference: { kind: 'year', year: 2025 }, techniques: ['solar-return'], solarReturnLocation: { latitude: 40.7128, longitude: -74.006 } };
const input = { birth, question: '返照盘如何？', flow };
const calculated = (result: any) => {
  const value = result.data.flow.solarReturn;
  assert.equal(value.status, 'calculated');
  return value;
};

test('返照地点只改变返照盘的地点相关部分，保存追问沿用该地点', async () => {
  const natalLocation = await calculate('astrolabe', { ...input, flow: { ...flow, solarReturnLocation: undefined } });
  const relocated = await calculate('astrolabe', input);
  const home = calculated(natalLocation), away = calculated(relocated);
  assert.deepEqual(home.location, { latitude: birth.latitude, longitude: birth.longitude, meaning: '出生地' });
  assert.deepEqual(away.location, { ...flow.solarReturnLocation, meaning: '指定地点' });
  assert.deepEqual(away.charts.map((chart: any) => chart.utcDateTime), home.charts.map((chart: any) => chart.utcDateTime));
  assert.deepEqual(relocated.data.points, natalLocation.data.points);
  for (let i = 0; i < home.charts.length; i++) {
    const a = home.charts[i], b = away.charts[i];
    assert.deepEqual(a.points.map((p: any) => [p.id, p.longitude]), b.points.map((p: any) => [p.id, p.longitude]));
    assert.notEqual(a.angles[0].longitude, b.angles[0].longitude);
    assert.notDeepEqual(a.houses, b.houses);
  }
  assert.match(relocated.prompt.text, /地点为指定地点（纬度40\.7128°，经度-74\.006°）/);
  assert.match(relocated.prompt.text, /参考时点仍按出生地时区定位/);
  const saved = JSON.parse(JSON.stringify(relocated));
  const follow = await reprompt({ method: 'astrolabe', result: saved, question: '接下来如何？' });
  assert.match(follow.prompt.text, /指定地点（纬度40\.7128°，经度-74\.006°）/);
  saved.data.flow.solarReturn.location.latitude += 1;
  await assert.rejects(() => reprompt({ method: 'astrolabe', result: saved, question: '接下来如何？' }), /不一致/);
});

test('范围候选、HTTP 与 MCP 都采用所选返照地点，错误选项不会被忽略', async () => {
  const range = { start: '1990-05-15T14:30:00+08:00', end: '1990-05-15T14:30:02+08:00', pageSize: 2 };
  const result = await calculate('astrolabe-range', { ...input, range });
  for (const branch of result.data.branches) {
    assert.deepEqual(calculated({ data: branch.first }).location, { ...flow.solarReturnLocation, meaning: '指定地点' });
    assert.deepEqual(calculated({ data: branch.last }).location, { ...flow.solarReturnLocation, meaning: '指定地点' });
  }
  const follow = await reprompt({ method: 'astrolabe-range', result, question: '范围继续问' });
  assert.match(follow.prompt.text, /指定地点/);
  await assert.rejects(() => calculate('astrolabe', { ...input, flow: { ...flow, techniques: ['transit'] } }), /返照地点仅适用/);
  await assert.rejects(() => calculate('astrolabe', { ...input, flow: { ...flow, solarReturnLocation: { latitude: 91, longitude: 0 } } }));
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'astrolabe' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'astrolabe', input });
  assert.equal(http.status, 200);
  assert.deepEqual(calculated(await http.json()).location, { ...flow.solarReturnLocation, meaning: '指定地点' });
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'astrolabe', arguments: input } });
  assert.equal(mcp.status, 200);
  const json: any = await mcp.json();
  assert.deepEqual(calculated(json.result.structuredContent).location, { ...flow.solarReturnLocation, meaning: '指定地点' });
});
