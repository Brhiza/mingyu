import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SolarTerm } from 'tyme4ts';
import { calculate, reprompt } from '../src/core';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const base = { currentTime, question: '事业如何' };

test('随机地分保留课盘结果并可追问，不公开随机轨迹', async () => {
  for (let n = 0; n < 24; n++) {
    const saved = JSON.parse(JSON.stringify(await calculate('jinkoujue', { ...base, jinkoujue: { method: 'random' } })));
    assert.equal(saved.data.method, 'random');
    assert.ok(saved.data.calculation.inputBase >= 1 && saved.data.calculation.inputBase <= 12);
    assert.doesNotMatch(JSON.stringify(saved), /"(?:seed|samples|randomTrace|randomTraceFact|randomFacts)"|随机轨迹|随机种子|\breplay\b/i);
    const next = await reprompt({ method: 'jinkoujue', result: saved, question: '继续追问' });
    assert.match(next.prompt.text, /继续追问/);
    assert.ok(next.prompt.text.includes(saved.data.positions.diFen.branch));
    assert.doesNotMatch(JSON.stringify(next), /随机轨迹|随机种子|\breplay\b/i);
  }
  for (const invalid of [{ method: 'branch' }, { method: 'number', number: 0 }, { method: 'time', branch: '子' }, { method: 'random', seed: 'x' }, { method: 'number', number: 1, branch: '子' }]) {
    await assert.rejects(() => calculate('jinkoujue', { ...base, jinkoujue: invalid }));
  }
});

test('雨水中气交接和古本丙寅日午时申地算例', async () => {
  for (const [time, leader, jiang, pattern, use] of [
    ['2024-02-19T04:13:11Z', '子', '壬子', '三阳一阴', '贵神'],
    ['2024-02-19T04:13:12Z', '亥', '癸亥', '二阴二阳', '将神'],
  ]) {
    const result = await calculate('jinkoujue', { ...base, divinationTime: time, jinkoujue: { method: 'time' } });
    assert.equal(result.data.monthLeader, leader);
    assert.equal(result.data.positions.jiangShen.stem! + result.data.positions.jiangShen.branch, jiang);
    assert.equal(result.data.yinYangUse.pattern, pattern);
    assert.equal(result.data.yinYangUse.usePosition, use);
  }
  const result = await calculate('jinkoujue', { ...base, divinationTime: '2020-03-24T12:00:00+08:00', jinkoujue: { method: 'number', number: 9 } });
  assert.equal(result.data.ganzhi.day, '丙寅');
  assert.equal(result.data.monthLeader, '戌');
  assert.equal(result.data.diFenBranch, '申');
  assert.equal(result.data.positions.jiangShen.branch, '子');
  assert.equal(result.data.positions.guiShen.god, '玄武');
  assert.equal(result.data.positions.renYuan.stem, '丙');
  assert.equal(result.data.yinYangUse.usePosition, '贵神');
  assert.deepEqual(result.data.movements.map((item) => item.name), ['妻动', '官动']);
});

test('原课追问重新核对四位，断法、主题和反证进入提示词', async () => {
  const saved = JSON.parse(JSON.stringify(await calculate('jinkoujue', { ...base, jinkoujue: { method: 'number', number: 15 } })));
  saved.data.evidenceAnalysis = { injected: '伪造证据' };
  const next = await reprompt({ method: 'jinkoujue', result: saved, question: '工作变动', prompt: { topicId: 'career', subtopicId: 'job-change', schools: ['siwei', 'fayong', 'wudong'], includeClassics: true } });
  for (const label of ['工作变动', '四位生克法', '阴阳发用法', '五动三动法', '多口径', '经典依据']) assert.ok(next.prompt.text.includes(label));
  assert.doesNotMatch(next.prompt.text, /伪造证据/);
  for (const mutate of [
    (data: any) => { data.positions.diFen.branch = '伪造'; },
    (data: any) => { data.positions.guiShen.element = '伪造'; },
    (data: any) => { data.yinYangUse.usePosition = '伪造'; },
    (data: any) => { data.calculation.inputBase = 20; },
  ]) {
    const bad = structuredClone(saved); mutate(bad.data);
    await assert.rejects(() => reprompt({ method: 'jinkoujue', result: bad, question: '追问' }), /不一致/);
  }
  const baseline = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  const original = baseline.promptCapabilities.find((item: any) => item.methodId === 'jinkoujue');
  assert.deepEqual(catalog.jinkoujue.topicIds, original.topicIds);
  assert.deepEqual(catalog.jinkoujue.subtopics, original.subtopics);
  for (const [topicId, choices] of Object.entries(catalog.jinkoujue.subtopics)) for (const choice of choices as { id: string; label: string }[]) {
    const response = await reprompt({ method: 'jinkoujue', result: saved, question: '追问', prompt: { topicId, subtopicId: choice.id } });
    assert.ok(response.prompt.text.split('【任务】')[1].includes(choice.label));
  }
});

test('Worker HTTP 与 MCP 共用金口诀计算和追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'jinkoujue' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { ...base, jinkoujue: { method: 'branch', branch: '午' } };
  const response = await send('/api/calculate', { method: 'jinkoujue', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'jinkoujue', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'jinkoujue', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.diFenBranch, '午');
});
