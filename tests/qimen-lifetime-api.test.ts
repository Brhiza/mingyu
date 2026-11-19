import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, timezone: 8 };
const currentTime = '2025-01-01T00:00:00Z';
const input = { birth, gender: 'male', stagePolicy: { model: 'decadalGanzhi' }, topics: ['career', 'wealth'], question: '事业如何？', currentTime };

test('终身局本命与全部阶段提示词使用真实盘面和所选主题', async () => {
  const result = await calculate('qimen-lifetime', { ...input, prompt: { schools: ['gongwei', 'geju'], includeClassics: true } });
  assert.equal(result.data.stages.length, 13);
  for (const text of ['奇门终身局基础盘', '九宫', '个人标记', '事业官禄', '资产财帛', '第12步', '八字交节起运', '宫位用神法', '格局取象法', '经典资料摘要', '事业如何？', '不得虚构']) assert.ok(result.prompt.text.includes(text), text);
  assert.doesNotMatch(result.prompt.text, /【人生主题候选宫】\n婚恋配偶/);
  assert.ok(result.prompt.text.includes(result.data.baseChart.zhiFu));
  const natal = await calculate('qimen-lifetime', { ...input, prompt: { scope: 'natal' } });
  assert.doesNotMatch(natal.prompt.text, /【阶段运限】/);
  const stage = await calculate('qimen-lifetime', { ...input, prompt: { scope: 'stage', stageIndex: 2 } });
  assert.match(stage.prompt.text, /第2步/);
  assert.doesNotMatch(stage.prompt.text, /第3步/);
  await assert.rejects(() => calculate('qimen-lifetime', { ...input, prompt: { scope: 'stage', stageIndex: 99 } }), /阶段索引/);
});

test('保存后追问重算核验出生盘、阶段与证据，允许更换范围', async () => {
  const original = await calculate('qimen-lifetime', input);
  const saved = JSON.parse(JSON.stringify(original));
  const followup = await reprompt({ method: 'qimen-lifetime', result: saved, question: '感情呢？', prompt: { scope: 'stage', stageIndex: 1 } });
  assert.match(followup.prompt.text, /感情呢？/);
  assert.match(followup.prompt.text, /第1步/);
  for (const mutate of [
    (d: any) => { d.baseChart.jiuGongGe[0].tianPan.stem = '伪造'; },
    (d: any) => { d.personalMarkers[0].palace = 99; },
    (d: any) => { d.topicCandidates[0].basis = '伪造'; },
    (d: any) => { d.stages[0].calendarStart = '2000-01-01'; },
    (d: any) => { d.baseChart.evidenceAnalysis.calculationEvidenceFacts[0].promptText = '伪造'; },
  ]) {
    const modified = structuredClone(saved); mutate(modified.data);
    await assert.rejects(() => reprompt({ method: 'qimen-lifetime', result: modified, question: '继续问' }), /不一致/);
  }
});

test('时区、真太阳时、农历及未知输入的公开校验', async () => {
  const local = await calculate('qimen-lifetime', { question: '问题', birth: { year: 2024, month: 5, day: 15, hour: 14, minute: 30, second: 0, timeZoneId: 'America/New_York', timeStandard: 'true-solar', longitude: -74 } });
  assert.match(local.prompt.text, /America\/New_York/);
  assert.match(local.prompt.text, /真太阳时钟表/);
  assert.match(local.prompt.text, /相对当地民用时间修正/);
  const lunar = await calculate('qimen-lifetime', { question: '问题', birth: { ...birth, month: 4, day: 21, calendar: 'lunar' } });
  assert.equal(lunar.data.basis.birthTimestamp, Date.parse('1990-05-15T06:30:00Z'));
  await assert.rejects(() => calculate('qimen-lifetime', { ...input, periodRange: { startDate: '2024-01-01', endDate: '2055-01-01' } }));
  await assert.rejects(() => calculate('qimen-lifetime', { ...input, prompt: { scope: 'natal', stageIndex: 1 } }));
  await assert.rejects(() => calculate('qimen-lifetime', { ...input, birth: { ...birth, calendar: 'solar', leapMonth: true } }));
});

test('Worker HTTP、MCP 计算与追问使用同一终身局', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qimen-lifetime' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'qimen-lifetime', input });
  assert.equal(http.status, 200);
  const saved = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qimen-lifetime', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.deepEqual((await mcp.json()).result.structuredContent.data, saved.data);
  const followup = await send('/api/prompt', { method: 'qimen-lifetime', result: saved, question: '继续问' });
  assert.equal(followup.status, 200);
  const altered = structuredClone(saved); altered.data.stages[1].title = '伪造';
  assert.equal((await send('/api/prompt', { method: 'qimen-lifetime', result: altered, question: '继续问' })).status, 400);
});
