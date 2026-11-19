import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getDivinationTime } from '../src/systems/calendar';
import { createTimezoneOffsetReader } from '../src/systems/huangji/civil-time';
import worker from '../src/worker';

const question = '事情如何推进？';
const currentTime = '2025-01-01T00:00:00Z';

test('公开地方时单盘支持固定偏移、IANA 时区及四种层级', async () => {
  const date = new Date('2024-05-15T12:30:00Z');
  for (const [timezone, timeZoneId] of [[-5, undefined], [5.75, undefined], [14, undefined], [-4, 'America/New_York']] as const) {
    for (const scope of ['hour', 'day', 'month', 'year'] as const) for (const method of ['zhuanpan', 'feipan'] as const) {
      const qimen = { scope, method, timeStandard: 'civil', ...(timeZoneId ? { timeZoneId } : { timezone }) };
      const result = await calculate('qimen', { question, currentTime, divinationTime: date.toISOString(), qimen });
      assert.equal(result.data.timezoneOffsetMinutes, timezone * 60);
      assert.match(result.prompt.text, /历法时区 UTC/);
      if (timeZoneId) assert.ok(result.prompt.text.includes(timeZoneId));
      const saved = JSON.parse(JSON.stringify(result));
      assert.match((await reprompt({ method: 'qimen', result: saved, question: '后续' })).prompt.text, /后续/);
      saved.data.timezoneOffsetMinutes++;
      await assert.rejects(() => reprompt({ method: 'qimen', result: saved, question: '后续' }), /不一致/);
    }
  }
});

test('地方时范围按换时、地方时辰及日界分段，逐秒保留实际四柱', async () => {
  const cases = [
    { start: '2024-11-03T05:00:00Z', end: '2024-11-03T07:00:00Z', timeZoneId: 'America/New_York', jump: '2024-11-03T06:00:00Z', before: -4, after: -5 },
    { start: '2024-03-10T06:00:00Z', end: '2024-03-10T08:00:00Z', timeZoneId: 'America/New_York', jump: '2024-03-10T07:00:00Z', before: -5, after: -4 },
    { start: '2024-04-06T14:00:00Z', end: '2024-04-06T16:00:00Z', timeZoneId: 'Australia/Lord_Howe', jump: '2024-04-06T15:00:00Z', before: 11, after: 10.5 },
    { start: '2011-12-30T09:00:00Z', end: '2011-12-30T11:00:00Z', timeZoneId: 'Pacific/Apia', jump: '2011-12-30T10:00:00Z', before: -10, after: 14 },
    { start: '2024-11-03T05:00:00Z', end: '2024-11-03T07:00:00Z', timezone: 5.75 },
  ];
  for (const item of cases) {
    const { start, end, timeZoneId, timezone, jump, before, after } = item;
    const qimen = { timeStandard: 'civil', ...(timeZoneId ? { timeZoneId } : { timezone }) };
    const result = await calculate('qimen', { question, currentTime, range: { start, end }, qimen });
    const data = result.data, startMs = Date.parse(start), endMs = Date.parse(end), readOffset = timeZoneId ? createTimezoneOffsetReader(timeZoneId) : () => timezone!;
    assert.equal(data.source.startTimestamp, startMs); assert.equal(data.source.endTimestamp, endMs);
    assert.match(result.prompt.text, /地方民用时/);
    if (jump) {
      const boundary = Date.parse(jump);
      assert.equal(readOffset(boundary - 1000), before); assert.equal(readOffset(boundary), after);
      assert.ok(data.branches.some((branch: any) => branch.startTimestamp === boundary), `${timeZoneId} 换时须分段`);
    }
    for (const branch of data.branches) {
      const single = await calculate('qimen', { question, currentTime, divinationTime: new Date(branch.startTimestamp).toISOString(), qimen });
      assert.deepEqual(branch.data, single.data);
      assert.equal(branch.moonPhaseEvidence.start.utcTimestamp, branch.startTimestamp);
      assert.equal(branch.moonPhaseEvidence.end.utcTimestamp, branch.endTimestamp - 1000);
    }
    for (let timestamp = startMs; timestamp < endMs; timestamp += 1000) {
      const branch = data.branches.find((item: any) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp);
      assert.ok(branch, `${timeZoneId ?? timezone}/${timestamp}`);
      const offset = readOffset(timestamp), local = getDivinationTime(new Date(timestamp), offset * 60).ganzhi, reference = getDivinationTime(new Date(timestamp)).ganzhi;
      assert.equal(branch.data.timezoneOffsetMinutes, offset * 60);
      assert.deepEqual(branch.data.ganzhi, { ...local, year: reference.year, month: reference.month }, `${timeZoneId ?? timezone}/${timestamp}`);
    }
    const saved = JSON.parse(JSON.stringify(result));
    assert.match((await reprompt({ method: 'qimen', result: saved, question: '继续问' })).prompt.text, /继续问/);
    saved.data.input.qimen.timeStandard = 'beijing';
    await assert.rejects(() => reprompt({ method: 'qimen', result: saved, question: '继续问' }));
  }
});

test('不完整或冲突的时区参数明确拒绝', async () => {
  const minuteOffset = await calculate('qimen', { question, currentTime, qimen: { timeStandard: 'civil', timezone: 4 + 1 / 60 } });
  assert.equal(minuteOffset.data.timezoneOffsetMinutes, 241);
  assert.match(minuteOffset.prompt.text, /UTC\+04:01/);
  assert.match((await reprompt({ method: 'qimen', result: JSON.parse(JSON.stringify(minuteOffset)), question: '后续' })).prompt.text, /后续/);
  for (const qimen of [
    { timeStandard: 'civil' }, { timeStandard: 'civil', timezone: 8, timeZoneId: 'Asia/Shanghai' },
    { timeStandard: 'civil', timezone: 8.001 }, { timeStandard: 'civil', timezone: 15 }, { timeStandard: 'civil', timeZoneId: 'Not/AZone' },
    { timeStandard: 'beijing', timezone: 8 }, { timeStandard: 'true-solar', longitude: 116.4, timezone: 8 },
    { timeStandard: 'civil', timezone: 8, longitude: 116.4 },
  ]) await assert.rejects(() => calculate('qimen', { question, currentTime, qimen }));
});

test('Worker HTTP 与 MCP 地方时范围一致并可追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question, currentTime, range: { start: '2024-11-03T05:59:58Z', end: '2024-11-03T06:00:02Z' }, qimen: { timeStandard: 'civil', timeZoneId: 'America/New_York' } };
  const response = await send('/api/calculate', { method: 'qimen', input }); assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.equal((await send('/api/prompt', { method: 'qimen', result: saved, question: '追问' })).status, 200);
});
