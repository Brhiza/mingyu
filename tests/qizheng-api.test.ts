import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { mansionBoundaries, locateMansion } from '../src/systems/qizheng/mansions';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };

test('二十八宿完整覆盖圆周，距星边界前后归属相邻宿', () => {
  for (const year of [1900, 2024, 2200]) {
    const boundaries = mansionBoundaries(new Date(Date.UTC(year, 5, 15))).sort((a, b) => a.longitude - b.longitude);
    assert.equal(new Set(boundaries.map((item) => item.mansion)).size, 28);
    assert.ok(Math.abs(boundaries.reduce((sum, item) => sum + item.widthDegrees, 0) - 360) < 1e-7);
    for (let i = 0; i < boundaries.length; i++) {
      const current = boundaries[i], previous = boundaries[(i + 27) % 28];
      assert.equal(locateMansion(current.longitude - 1e-7, boundaries).xiu, previous.mansion);
      assert.equal(locateMansion(current.longitude, boundaries).xiu, current.mansion);
      assert.equal(locateMansion(current.longitude + 1e-7, boundaries).xiu, current.mansion);
    }
  }
  assert.throws(() => locateMansion(0, []), /二十八宿/);
});

test('主题与原盘追问复用，出生资料及未实现范围严格校验', async () => {
  const initial = await calculate('qizheng', { question: '事业？', birth, prompt: { topicId: 'career', subtopicId: 'workplace' } });
  assert.match(initial.prompt.text, /事业（职场发展）/);
  const saved = JSON.parse(JSON.stringify(initial));
  assert.match((await reprompt({ method: 'qizheng', result: saved, question: '继续' })).prompt.text, /事业（职场发展）/);
  assert.match((await reprompt({ method: 'qizheng', result: saved, question: '婚姻？', prompt: { topicId: 'relationship', subtopicId: 'marriage' } })).prompt.text, /感情（长期关系）/);
  await assert.rejects(() => reprompt({ method: 'qizheng', result: saved, question: '问题', prompt: { topicId: 'career', subtopicId: 'marriage' } }), /子主题/);
  const tinyDrift = structuredClone(saved); tinyDrift.data.stars[0].longitude += 5e-10;
  assert.match((await reprompt({ method: 'qizheng', result: tinyDrift, question: '微小误差' })).prompt.text, /微小误差/);
  const changed = structuredClone(saved); changed.data.stars[0].longitude += 1e-7;
  await assert.rejects(() => reprompt({ method: 'qizheng', result: changed, question: '问题' }), /不一致/);
  saved.data.stars[0].longitude += 1;
  await assert.rejects(() => reprompt({ method: 'qizheng', result: saved, question: '问题' }), /不一致/);
  for (const invalid of [
    { ...birth, month: 2, day: 30 }, { ...birth, timezone: undefined }, { ...birth, longitude: undefined },
    { ...birth, timezone: undefined, timeZoneId: 'America/New_York', year: 2024, month: 11, day: 3, hour: 1, minute: 30 },
  ]) await assert.rejects(() => calculate('qizheng', { question: '问题', birth: invalid }));
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, prompt: { scope: 'yearly' } }));
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, flowYear: 2026 }));
});

test('HTTP 和 MCP 共享结果，保存盘篡改被拒绝', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', birth }, response = await send('/api/calculate', { method: 'qizheng', input });
  assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'qizheng', result: saved, question: '追问' })).status, 200);
  saved.data.mansionBoundaries[0].longitude += 1;
  assert.equal((await send('/api/prompt', { method: 'qizheng', result: saved, question: '追问' })).status, 400);
});
