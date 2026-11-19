import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculate, reprompt } from '../src/core';
import catalog from '../src/prompt-catalog.json';
import worker from '../src/worker';

const currentTime = '2025-01-01T00:00:00Z';
const question = '年度运气节律如何';

test('原盘追问校验年度资料，主题和细项进入任务', async () => {
  for (const wuyun of [{ year: 2025 }, { yearGanZhi: '乙巳' }, { year: 2025, yearGanZhi: '乙巳' }]) {
    const saved = JSON.parse(JSON.stringify(await calculate('wuyun-liuqi', { currentTime, question, wuyun })));
    const next = await reprompt({ method: 'wuyun-liuqi', result: saved, question: '如何理解节律', prompt: { topicId: 'health', subtopicId: 'routine' } });
    assert.match(next.prompt.text, /如何理解节律/);
    assert.match(next.prompt.text.split('【任务】')[1], /作息调护/);
    for (const change of [
      (data: any) => { data.chart.sitian.name = '伪造'; },
      (data: any) => { data.chart.qiSteps[0].guestQi.name = '伪造'; },
      (data: any) => { data.chart.pathomechanism.summary = '伪造'; },
    ]) {
      const bad = structuredClone(saved); change(bad.data);
      await assert.rejects(() => reprompt({ method: 'wuyun-liuqi', result: bad, question: '追问' }), /不一致/);
    }
  }
  const baseline = JSON.parse(readFileSync(new URL('../docs/v2-capability-baseline.json', import.meta.url), 'utf8'));
  const original = baseline.promptCapabilities.find((item: any) => item.methodId === 'wuyun-liuqi');
  assert.deepEqual(catalog['wuyun-liuqi'].topicIds, original.topicIds);
  assert.deepEqual(catalog['wuyun-liuqi'].subtopics, original.subtopics);
});

test('Worker HTTP 与 MCP 支持五运六气计算和原盘追问', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'wuyun-liuqi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { currentTime, question, wuyun: { year: 2025 } };
  const response = await send('/api/calculate', { method: 'wuyun-liuqi', input });
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal((await send('/api/prompt', { method: 'wuyun-liuqi', result: saved, question: '追问' })).status, 200);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'wuyun-liuqi', arguments: input } });
  assert.equal(mcp.status, 200);
  assert.equal((await mcp.json()).result.structuredContent.data.chart.input.yearGanZhi, '乙巳');
});
