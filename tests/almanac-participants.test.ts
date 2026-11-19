import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';
import { participantBranchConflicts } from '../src/systems/almanac/participants';

const input = { question: '如何安排？', topic: 'move', startDate: '2024-02-03', endDate: '2024-02-04', participants: [{ name: '甲', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } }] };

test('出生时段跨立春与换日保留条件，真实时刻和真太阳时可用', async () => {
  const boundary = await calculate('almanac', { ...input, participants: [{ name: '乙', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'unknown' }, timezone: 8 } }] });
  const person = boundary.data.participants[0];
  assert.deepEqual(person.variants.map((x: any) => [x.yearBranch, x.dayBranch]), [['卯', '戌'], ['辰', '戌'], ['辰', '亥']]);
  assert.equal(person.relationsByBranch.find((x: any) => x.candidateBranch === '子').stability, '有条件');
  assert.ok(person.variants.every((x: any) => x.intervals.every((interval: any) => interval.endExclusive)));
  assert.match(boundary.prompt.text, /有条件/);
  const precise = await calculate('almanac', { ...input, participants: [{ name: '丙', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'exact', hour: 16, minute: 27, second: 7 }, timezone: 8, timeStandard: 'true-solar', longitude: 116.4 } }] });
  assert.equal(precise.data.participants[0].variants.length, 1);
  const shichen = await calculate('almanac', { ...input, participants: [{ name: '丁', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'shichen', index: 8 }, timezone: 8 } }] });
  assert.ok(shichen.data.participants[0].variants.length > 1);
  await assert.rejects(() => calculate('almanac', { ...input, participants: [{ name: '戊', birth: { year: 2024, month: 2, day: 4, clock: { kind: 'exact', hour: 1, minute: 0, second: 0 }, timeStandard: 'true-solar' } }] }));
});

test('交节与四绝列出实际日期及时间', async () => {
  const current = await calculate('almanac', input);
  const before = current.data.days[0], onTerm = current.data.days[1];
  assert.equal(before.fourTermination, '立春');
  assert.deepEqual(onTerm.jieBoundary, { name: '立春', time: '16:27:07', before: { year: '癸卯', month: '乙丑' }, after: { year: '甲辰', month: '丙寅' } });
  assert.match(current.prompt.text, /四绝/); assert.match(current.prompt.text, /交节/);
});

test('有参与人时重算追问并校验 HTTP、MCP', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'almanac' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const response = await send('/api/calculate', { method: 'almanac', input }); assert.equal(response.status, 200); const saved = await response.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'almanac', arguments: input } });
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  assert.match((await reprompt({ method: 'almanac', result: saved, question: '继续' })).prompt.text, /继续/);
  saved.data.participants[0].relationsByBranch[0].outcomes[0].yearBranch = '伪造';
  assert.equal((await send('/api/prompt', { method: 'almanac', result: saved, question: '继续' })).status, 400);
});
