import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const input = { question: '住宅飞星如何？', construction: { year: 2008 }, orientation: { kind: 'mountain', sitMountain: '子' }, flow: { kind: 'date', year: 2026, month: 6, day: 15 } };

test('下卦盘与流年流月叠宫进入结果', async () => {
  const result = await calculate('xuankong', input);
  const chart = result.data.charts[0];
  assert.equal(chart.castleGate.candidates.length, 2);
  assert.match(result.prompt.text, /实际可用性须结合/);
  assert.equal(chart.palaces.length, 9);
  assert.ok(chart.palaces.every((p: any) => typeof p.dayStar === 'number'));
  assert.equal(result.data.flow.hour, null);
  assert.match(result.prompt.text, /八运|8运/);
  assert.match(result.prompt.text, /住宅飞星如何/);
  assert.match(result.prompt.text, /流日/);

  const withHour = await calculate('xuankong', { ...input, flow: { ...input.flow, hour: 10 } });
  assert.ok(withHour.data.flow.hour);
  assert.ok(withHour.data.charts[0].palaces.every((p: any) => typeof p.hourStar === 'number'));
  assert.match(withHour.prompt.text, /流时（10时）/);
  const followed = await reprompt({ method: 'xuankong', result: JSON.parse(JSON.stringify(withHour)), question: '流时怎么看？' });
  assert.match(followed.prompt.text, /流时/);
});

test('交运年与测量跨界保留所有候选，具体日期核定运期', async () => {
  const boundary = { question: '问题', construction: { year: 2024 }, orientation: { kind: 'degree', reading: 'sit', degree: 22.5, northReference: 'true', uncertaintyDegrees: 1 } };
  const result = await calculate('xuankong', boundary);
  assert.equal(result.data.periodBoundary, '交界双候选'); assert.equal(result.data.charts.length, 4);
  assert.deepEqual([...new Set(result.data.charts.map((x: any) => x.period.yun))], [8, 9]);
  assert.deepEqual([...new Set(result.data.charts.map((x: any) => x.sitMountain))], ['癸', '丑']);
  for (const [day, expected] of [[3, [8]], [4, [8, 9]], [5, [9]]] as const) {
    const value = await calculate('xuankong', { ...boundary, construction: { year: 2024, month: 2, day } });
    assert.deepEqual([...new Set(value.data.charts.map((x: any) => x.period.yun))], expected);
  }
  const facing = await calculate('xuankong', { ...boundary, construction: { year: 2008 }, orientation: { kind: 'degree', reading: 'facing', degree: 180, northReference: 'true' } });
  assert.equal(facing.data.charts[0].sitMountain, '子');
});

test('替卦须确认兼向且误差完整位于外侧三度', async () => {
  const base = { question: '问题', construction: { year: 2008 }, orientation: { kind: 'degree', reading: 'sit', degree: 5.5, northReference: 'true', uncertaintyDegrees: 0.2 }, mode: '替卦', confirmJianXiang: true };
  const result = await calculate('xuankong', base);
  assert.equal(result.data.charts[0].replacementApplied, true);
  for (const invalid of [
    { ...base, confirmJianXiang: undefined },
    { ...base, orientation: { ...base.orientation, degree: 4.5 } },
    { ...base, orientation: { ...base.orientation, degree: 7.4, uncertaintyDegrees: 0.2 } },
    { ...base, orientation: { ...base.orientation, northReference: 'unspecified' } },
    { ...base, mode: '下卦' },
  ]) await assert.rejects(() => calculate('xuankong', invalid));
});

test('保存追问重算核对所有候选，HTTP 与 MCP 保持一致', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'xuankong' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'xuankong', input }); assert.equal(http.status, 200); const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'xuankong', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'xuankong', result: saved, question: '追问' })).status, 200);
  const alteredGate = structuredClone(saved); alteredGate.data.charts[0].castleGate.candidates[0].arrivalStar = 99;
  assert.equal((await send('/api/prompt', { method: 'xuankong', result: alteredGate, question: '追问' })).status, 400);
  saved.data.charts[0].plates.shan[0] = 99;
  assert.equal((await send('/api/prompt', { method: 'xuankong', result: saved, question: '追问' })).status, 400);
});
