import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTime } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import { getDivinationTime, getSolarTermName } from '../src/systems/calendar';
import { castLiuyao, castYarrow } from '../src/systems/liuyao/cast';
import reference from '../src/systems/liuyao-reference.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const range = { start: '2024-02-04T07:00:00Z', end: '2024-02-04T09:00:00Z' };
const request = (liuyao: Record<string, unknown>, interval = range) => ({ question: '所问之事', currentTime, range: interval, liuyao });

test('四种起卦方式跨节气时间范围共享一次卦象，保存后可追问', async () => {
  const splits = castYarrow().lines.flatMap((line) => line.changes.map((change) => change.left));
  const methods = [{ method: 'time' }, { method: 'manual', yaos: [6, 7, 8, 9, 7, 8] }, { method: 'coins' },
    { method: 'coins', coinThrows: Array.from({ length: 6 }, () => ({ coins: [2, 2, 3], total: 7 })) },
    { method: 'yarrow' }, { method: 'yarrow', yarrowSplits: splits }];
  for (const liuyao of methods) {
    const saved = JSON.parse(JSON.stringify(await calculate('liuyao', request(liuyao))));
    assert.equal(saved.data.kind, 'range');
    assert.ok(saved.data.branches.length > 1);
    const original = saved.data.branches[0].data;
    for (const branch of saved.data.branches) {
      assert.deepEqual(branch.data.yaoArray, original.yaoArray);
      assert.deepEqual(branch.data.generation, original.generation);
    }
    if (liuyao.method === 'time') {
      assert.deepEqual(original.yaoArray, castLiuyao(Date.parse(range.start), { method: 'time' }).yaos);
      assert.equal(original.generation.coinThrows, undefined);
      assert.match(saved.prompt.text, /未实摇铜钱/);
      assert.match(saved.prompt.text, /起点只是取数代表/);
    }
    if (liuyao.method === 'coins') assert.equal(original.generation.coinSource, 'coinThrows' in liuyao ? 'user-record' : 'simulated');
    assert.match(saved.prompt.text, /分支代表时刻：/);
    assert.doesNotMatch(saved.prompt.text, /【时间】\n起卦：/);
    const follow = await reprompt({ method: 'liuyao', result: saved, question: '继续追问', prompt: { liuyaoTemplate: 'shiye' } });
    assert.match(follow.prompt.text, /继续追问/);
    assert.ok(follow.prompt.text.includes(reference.templates.shiye));
    assert.ok(saved.data.branches.every((branch: any) => branch.data.evidenceAnalysis.topic === 'general'));
    assert.ok(follow.prompt.text.includes(original.originalName));
    assert.doesNotMatch(JSON.stringify(saved), /"(?:seed|samples|randomTrace)"|随机轨迹|随机种子|\breplay\b/i);
  }
});

test('范围分支覆盖节气、子时和不同固定时区的全部秒数', async () => {
  const cases = [
    { range, offset: 480 },
    { range: { start: '2024-02-09T14:30:00Z', end: '2024-02-09T16:30:00Z' }, offset: 480 },
    { range: { start: '2024-06-10T16:00:00Z', end: '2024-06-10T18:00:00Z' }, offset: 345 },
  ];
  for (const item of cases) {
    const saved = await calculate('liuyao', request({ method: 'manual', yaos: [6, 7, 8, 9, 7, 8], timezoneOffsetMinutes: item.offset }, item.range));
    const branches = saved.data.branches;
    assert.equal(branches[0].startTimestamp, Date.parse(item.range.start));
    assert.equal(branches.at(-1).endTimestamp, Date.parse(item.range.end));
    for (let timestamp = Date.parse(item.range.start); timestamp < Date.parse(item.range.end); timestamp += 1000) {
      const matching = branches.filter((branch: any) => branch.startTimestamp <= timestamp && timestamp < branch.endTimestamp);
      assert.equal(matching.length, 1);
      const branch = matching[0], wall = new Date(timestamp + item.offset * 60_000);
      const lunar = SolarTime.fromYmdHms(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds()).getLunarHour().getLunarDay();
      assert.deepEqual(branch.data.ganzhi, getDivinationTime(new Date(timestamp), item.offset).ganzhi);
      assert.deepEqual(branch.background.solar, { year: wall.getUTCFullYear(), month: wall.getUTCMonth() + 1, day: wall.getUTCDate() });
      assert.equal(branch.background.lunar.day, lunar.getDay());
      assert.equal(branch.background.lunar.month, Math.abs(lunar.getLunarMonth().getMonth()));
      assert.equal(branch.background.solarTerm, getSolarTermName(timestamp));
    }
  }
});

test('随机起卦只抽一次，追问不再调用随机源且拒绝被篡改的分支', async () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let calls = 0;
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues(values: Uint32Array) { calls++; values.fill(0); return values; } } });
    const saved = JSON.parse(JSON.stringify(await calculate('liuyao', request({ method: 'coins' }))));
    assert.equal(calls, 18);
    await reprompt({ method: 'liuyao', result: saved, question: '追问一' });
    await reprompt({ method: 'liuyao', result: saved, question: '追问二' });
    assert.equal(calls, 18);
    for (const mutate of [
      (data: any) => { data.branches[0].endTimestamp += 1000; },
      (data: any) => { data.branches[0].data.generation.coinThrows[0].total = 9; },
      (data: any) => { data.branches.at(-1).data.ganzhi.day = '甲子'; },
      (data: any) => { data.branches[0].background.solarTerm = '伪造'; },
      (data: any) => { data.source.endExclusive = false; },
      (data: any) => { data.input.liuyao.method = 'manual'; },
      (data: any) => { data.branches[0].data.generation.coinSource = 'user-record'; },
    ]) {
      const bad = structuredClone(saved); mutate(bad.data);
      await assert.rejects(() => reprompt({ method: 'liuyao', result: bad, question: '追问' }));
    }
    saved.data.branches[0].data.evidenceAnalysis = { fake: '伪造证据' };
    assert.doesNotMatch((await reprompt({ method: 'liuyao', result: saved, question: '追问' })).prompt.text, /伪造证据/);
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto); else Reflect.deleteProperty(globalThis, 'crypto');
  }
  await assert.rejects(() => calculate('liuyao', { ...request({ method: 'time' }), divinationTime: range.start }));
  await assert.rejects(() => calculate('liuyao', request({ method: 'time' }, { ...range, end: '2024-02-04T09:00:01Z' })));
  await assert.rejects(() => calculate('liuyao', request({ method: 'time' }, { ...range, pillars: { year: '甲子', month: '甲子', day: '甲子', hour: '甲子' } } as typeof range)));
});

test('Worker HTTP 与 MCP 均可计算和追问六爻范围', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'liuyao' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = request({ method: 'coins' });
  const response = await send('/api/calculate', { method: 'liuyao', input });
  assert.equal(response.status, 200); const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'liuyao', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'liuyao', arguments: input } });
  assert.equal((await mcp.json()).result.structuredContent.data.kind, 'range');
});
