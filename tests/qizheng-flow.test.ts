import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, latitude: 39.9, longitude: 116.4, timezone: 8 };
const fields = ['star1', 'star2', 'type', 'exactAngle', 'actualAngle', 'orb', 'allowedOrb', 'orbRatio', 'closeness', 'precisionClass'] as const;

test('IANA 夏令时按流曜目标而非出生偏移计算，重复时刻需明确选择', async () => {
  const person = { ...birth, year: 1990, month: 1, day: 15, timezone: -5, timeZoneId: 'America/New_York', latitude: 40.7, longitude: -74 };
  const summer = await calculate('qizheng', { question: '问题', birth: person, flow: { kind: 'month', year: 2026, month: 7 } });
  assert.equal(summer.data.basis.timezone, -5); assert.equal(summer.data.flowing.time.timezone, -4);
  assert.equal(summer.data.flowing.time.utcDateTime, '2026-07-15T16:00:00.000Z');
  assert.equal(summer.data.flowing.time.localDateTime, '2026-07-15T12:00:00');
  const ambiguous = { kind: 'day', year: 2024, month: 11, day: 3, clock: { hour: 1, minute: 30 } };
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth: person, flow: ambiguous }), /歧义/);
  const first = await calculate('qizheng', { question: '问题', birth: person, flow: { ...ambiguous, timezone: -4 } });
  const second = await calculate('qizheng', { question: '问题', birth: person, flow: { ...ambiguous, timezone: -5 } });
  assert.equal(second.data.flowing.time.timestamp - first.data.flowing.time.timestamp, 3_600_000);
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth: person, flow: { kind: 'day', year: 2024, month: 3, day: 10, clock: { hour: 2, minute: 30 } } }), /不存在/);
});

test('选定瞬时、本命和指定范围校验与原结果追问', async () => {
  const input = { question: '问题', birth, flow: { kind: 'instant', at: '2026-06-15T04:00:00Z' }, prompt: { scope: 'daily' } };
  const result = await calculate('qizheng', input);
  assert.equal(result.data.flowing.time.localDateTime, '2026-06-15T12:00:00');
  assert.equal(result.data.timeLords, null); assert.match(result.prompt.text, /未提供性别/);
  const saved = JSON.parse(JSON.stringify(result));
  const natal = await reprompt({ method: 'qizheng', result: saved, question: '看本命', prompt: { scope: 'natal' } });
  assert.doesNotMatch(natal.prompt.text, /【流曜取样】/);
  assert.match((await reprompt({ method: 'qizheng', result: saved, question: '继续' })).prompt.text, /【流曜取样】/);
  await assert.rejects(() => reprompt({ method: 'qizheng', result: saved, question: '问题', prompt: { scope: 'yearly' } }), /范围/);
  const altered = structuredClone(saved); altered.data.flowing.stars[0].longitude += 1;
  await assert.rejects(() => reprompt({ method: 'qizheng', result: altered, question: '问题' }), /不一致/);
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, gender: 'male' }));
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, gender: 'male', flow: { kind: 'year', year: 1989 } }), /不得早于/);
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, flow: { kind: 'day', year: 2026, month: 2, day: 30 } }));
  await assert.rejects(() => calculate('qizheng', { question: '问题', birth, flow: { kind: 'instant', at: '2026-06-15T04:00:00.123Z' } }));
});

test('Worker HTTP 与 MCP 返回流曜和行限，重算拒绝篡改', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', birth, gender: 'female', flow: { kind: 'year', year: 2026 } };
  const response = await send('/api/calculate', { method: 'qizheng', input }); assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng', arguments: input } });
  assert.equal((await mcp.json()).result.structuredContent.data.flowing.stars.length, 11);
  assert.equal(saved.data.timeLords.majorLimitStatus, '命度与交限待核定');
  assert.equal((await send('/api/prompt', { method: 'qizheng', result: saved, question: '追问' })).status, 200);
  saved.data.timeLords.currentMinorLimit.signBranch = '伪造';
  assert.equal((await send('/api/prompt', { method: 'qizheng', result: saved, question: '追问' })).status, 400);
});
