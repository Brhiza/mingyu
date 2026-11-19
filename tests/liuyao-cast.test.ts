import assert from 'node:assert/strict';
import test from 'node:test';
import { castLiuyao, castYarrow } from '../src/systems/liuyao/cast';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const instant = '2025-01-01T00:00:00Z';

test('随机蓍草分堆能按实际过程核对', () => {
  for (let i = 0; i < 48; i++) {
    const result = castYarrow();
    const splits = result.lines.flatMap((line) => line.changes.map((step) => step.left));
    const reconstructed = castYarrow(splits);
    assert.deepEqual(result.lines, reconstructed.lines);
    assert.deepEqual(result.yaos, reconstructed.yaos);
    assert.equal(result.samplingModel, '余数等概率，类内分堆等概率');
    assert.doesNotMatch(JSON.stringify(result), /"(?:seed|samples|randomTrace|replay)"/i);
  }
  assert.throws(() => castYarrow(Array(18).fill(0)));
  assert.throws(() => castYarrow([1, 2]));
});

test('时间取数、程序模拟三钱与用户提供的三钱在结果和提示词中区分', async () => {
  const question = '原问题';
  const time = await calculate('liuyao', { currentTime: instant, question, liuyao: { method: 'time' } });
  assert.deepEqual(time.data.generation, { method: 'time' });
  assert.equal(time.data.evidenceAnalysis.generationFact.recordedLineCount, 6);
  assert.match(time.prompt.text, /时间戳确定性模拟三钱/);
  assert.match(time.prompt.text, /未实摇铜钱/);
  const again = await calculate('liuyao', { currentTime: instant, question, liuyao: { method: 'time' } });
  assert.deepEqual(time.data.yaoArray, again.data.yaoArray);
  const offset = await calculate('liuyao', { currentTime: instant, question, liuyao: { method: 'time', timezoneOffsetMinutes: -300 } });
  assert.deepEqual(time.data.yaoArray, offset.data.yaoArray);
  assert.match((await reprompt({ method: 'liuyao', result: JSON.parse(JSON.stringify(time)), question: '追问' })).prompt.text, /未实摇铜钱/);

  const throws = Array.from({ length: 6 }, () => ({ coins: [2, 2, 3], total: 7 }));
  const recorded = await calculate('liuyao', { currentTime: instant, question, liuyao: { method: 'coins', coinThrows: throws } });
  const simulated = await calculate('liuyao', { currentTime: instant, question, liuyao: { method: 'coins' } });
  assert.equal(recorded.data.generation.coinSource, 'user-record');
  assert.equal(simulated.data.generation.coinSource, 'simulated');
  assert.match(recorded.prompt.text, /三钱结果由调用方提供，服务无法证明线下投掷来源/);
  assert.match(simulated.prompt.text, /三钱结果由程序随机模拟，并非线下实摇/);
  for (const saved of [recorded, simulated]) {
    const reply = await reprompt({ method: 'liuyao', result: JSON.parse(JSON.stringify(saved)), question: '追问' });
    assert.match(reply.prompt.text, saved === recorded ? /调用方提供/ : /程序随机模拟/);
    const invalid = structuredClone(saved); invalid.data.generation.coinSource = 'unknown' as never;
    await assert.rejects(() => reprompt({ method: 'liuyao', result: invalid, question: '追问' }), /三钱来源/);
  }
});

test('时间、手摇、随机三钱、手工爻及随机与手工蓍草均可保存追问', async () => {
  const yarrow = castYarrow();
  const yarrowSplits = yarrow.lines.flatMap((line) => line.changes.map((step) => step.left));
  const coinThrows = Array.from({ length: 6 }, () => ({ coins: [2, 2, 3], total: 7 }));
  const methods = [
    { method: 'time' }, { method: 'manual', yaos: [6, 7, 8, 9, 7, 8] },
    { method: 'coins' }, { method: 'coins', coinThrows },
    { method: 'yarrow' }, { method: 'yarrow', yarrowSplits },
  ];
  for (const liuyao of methods) {
    const saved = JSON.parse(JSON.stringify(await calculate('liuyao', { currentTime: instant, question: '原问题', liuyao })));
    const reply = await reprompt({ method: 'liuyao', result: saved, question: '继续追问' });
    assert.match(reply.prompt.text, /继续追问/);
    assert.ok(reply.prompt.text.includes(saved.data.originalName));
    assert.doesNotMatch(JSON.stringify(saved), /"(?:seed|samples|randomTrace|randomTraceStatus)"|随机轨迹|随机种子|\breplay\b|重放/i);
    assert.doesNotMatch(JSON.stringify(reply), /随机轨迹|随机种子|\breplay\b|重放/i);
    if (liuyao.method === 'coins') {
      const altered = structuredClone(saved);
      altered.data.generation.coinThrows[0].total = altered.data.generation.coinThrows[0].total === 6 ? 7 : 6;
      await assert.rejects(() => reprompt({ method: 'liuyao', result: altered, question: '追问' }));
    }
    if (liuyao.method === 'yarrow') {
      assert.match(saved.prompt.text, 'yarrowSplits' in liuyao ? /调用方提供的蓍草分堆/ : /程序随机模拟蓍草分堆/);
      const altered = structuredClone(saved);
      altered.data.generation.yarrow.lines[0].changes[0].remaining++;
      await assert.rejects(() => reprompt({ method: 'liuyao', result: altered, question: '追问' }));
    }
  }
  await assert.rejects(() => calculate('liuyao', { currentTime: instant, question: '问题', liuyao: { method: 'coins', coinThrows: coinThrows.map((item, i) => i ? item : { ...item, total: 8 }) } }));
});

test('Worker HTTP 与 MCP 使用 V2 起卦并复用保存的卦', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'liuyao' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body),
  }), env);
  for (const method of ['time', 'coins', 'yarrow']) {
    const response = await send('/api/calculate', { method: 'liuyao', input: { question: '问题', currentTime: instant, liuyao: { method } } });
    assert.equal(response.status, 200, method);
    const result = await response.json();
    assert.equal(result.data.generation.method, method);
    if (method === 'time') { assert.equal(result.data.generation.coinThrows, undefined); assert.match(result.prompt.text, /未实摇铜钱/); }
    if (method === 'coins') { assert.equal(result.data.generation.coinSource, 'simulated'); assert.match(result.prompt.text, /程序随机模拟/); }
    assert.equal((await send('/api/prompt', { method: 'liuyao', result, question: '继续追问' })).status, 200);
  }
  const response = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'liuyao', arguments: { currentTime: instant, question: '问题', liuyao: { method: 'yarrow' } } } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.structuredContent.data.generation.yarrow.lines.length, 6);
  const time = await send('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'liuyao', arguments: { currentTime: instant, question: '问题' } } });
  const timeResult = (await time.json()).result.structuredContent;
  assert.equal(timeResult.data.generation.coinThrows, undefined);
  assert.match(timeResult.prompt.text, /时间戳确定性模拟三钱/);
});
