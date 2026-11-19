import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { solarIllumination } from '../src/systems/astronomy/solar-illumination';
import { qizhengEnNan } from '../src/systems/qizheng/tradition';
import { qizhengMoonPhase } from '../src/systems/qizheng/moon-phase';

const birth = { year: 2020, month: 8, day: 15, hour: 12, minute: 0, timezone: 8, latitude: 39.9, longitude: 116.4 };

test('重历 47 小时民用日使用全部升落交点', async () => {
  const common = { year: 1969, month: 9, day: 30, hour: 12, minute: 0, latitude: 8.7167, longitude: 167.7333, timeZoneId: 'Pacific/Kwajalein' };
  for (const timezone of [11, -12]) {
    const result = await calculate('qizheng', { question: '问题', birth: { ...common, timezone } });
    assert.equal(result.data.illumination.window.endUtcMs - result.data.illumination.window.startUtcMs, 47 * 3_600_000);
    assert.deepEqual(result.data.illumination.sunriseSunset.crossings.map((event: any) => [event.direction, event.timezone]), [['上行', 11], ['下行', 11], ['上行', -12], ['下行', -12]]);
    assert.equal(result.data.enNan.sect, result.data.illumination.daylight ? '昼生' : '夜生');
  }
});

test('日光、神煞、恩难支持追问重算与 HTTP/MCP', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', birth }, response = await send('/api/calculate', { method: 'qizheng', input }); assert.equal(response.status, 200);
  const saved = await response.json(), mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data.shensha, saved.data.shensha);
  assert.match(saved.prompt.text, /前一四正/); assert.ok(saved.data.moonPhase.previous.utcTimestamp < saved.data.basis.utcTimestamp);
  assert.match((await reprompt({ method: 'qizheng', result: saved, question: '继续' })).prompt.text, /继续/);
  const altered = structuredClone(saved); altered.data.enNan.enStars.push('伪造');
  assert.equal((await send('/api/prompt', { method: 'qizheng', result: altered, question: '继续' })).status, 400);
  const alteredSun = structuredClone(saved); alteredSun.data.illumination.sunriseSunset.crossings[0].direction = '下行';
  assert.equal((await send('/api/prompt', { method: 'qizheng', result: alteredSun, question: '继续' })).status, 400);
});

test('跨多个地点和天文库缓存状态反复追问保持可重算', async () => {
  for (let i = 0; i < 16; i++) {
    const person = { ...birth, year: 1990 + i, month: 1 + i % 12, day: 2 + i % 26, hour: i % 24, latitude: -70 + i * 8, longitude: -150 + i * 15 };
    const saved = JSON.parse(JSON.stringify(await calculate('qizheng', { question: '问题', birth: person })));
    await calculate('qizheng', { question: '另一个盘', birth: { ...birth, year: 2000 + i, hour: (i * 3) % 24 } });
    assert.match((await reprompt({ method: 'qizheng', result: saved, question: '继续' })).prompt.text, /继续/);
  }
});
