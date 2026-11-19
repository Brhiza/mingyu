import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { renderQizhengData } from '../src/systems/qizheng';
import { qizhengFocus } from '../src/systems/qizheng/prompt-focus';
import topics from '../src/systems/qizheng/prompt-topics.json';
import worker from '../src/worker';

const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, latitude: 39.9, longitude: 116.4, timezone: 8 };
const input = { question: '请解释这张盘。', birth };
type TopicId = NonNullable<Parameters<typeof renderQizhengData>[2]>['topicId'];

test('所有七政主题和子主题有对应任务，优先宫位来自真实盘面', async () => {
  const result = await calculate('qizheng', input);
  assert.deepEqual(Object.keys(qizhengFocus).sort(), [...topics.topicIds].sort());
  const subtasks = new Set<string>();
  for (const topic of topics.topicIds) {
    const focus = qizhengFocus[topic];
    const prompt = renderQizhengData(result.data, input.question, { topicId: topic as TopicId }).text;
    assert.ok(prompt.includes(focus.task), topic);
    for (const name of focus.palaces) {
      const palace = result.data.twelvePalaces.find((item) => item.palace === name)!;
      const stars = result.data.stars.filter((star) => star.palace === name).map((star) => `${star.name}（${star.dignity}）`);
      assert.ok(prompt.includes(`${name}${palace.signBranch}宫：${stars.join('、') || '无所列星曜'}`), `${topic}/${name}`);
    }
    const catalog = (topics.subtopics as Record<string, { id: string }[]>)[topic] ?? [];
    assert.deepEqual(Object.keys(focus.subtopics ?? {}).sort(), catalog.map((item) => item.id).sort(), topic);
    for (const { id } of catalog) {
      const text = renderQizhengData(result.data, input.question, { topicId: topic as TopicId, subtopicId: id }).text;
      assert.ok(text.includes(focus.subtopics![id]), `${topic}/${id}`);
      subtasks.add(focus.subtopics![id]);
    }
  }
  assert.equal(subtasks.size, 21);
  assert.match(renderQizhengData(result.data, input.question, { topicId: 'timing' }).text, /未选择流曜资料/);
  assert.throws(() => renderQizhengData(result.data, input.question, { topicId: 'career', subtopicId: 'partner' }), /不属于当前主题/);
});

test('保存盘面切换主题只改变任务；范围、HTTP 和 MCP 使用同一提示词', async () => {
  const saved = await calculate('qizheng', input);
  const originalData = structuredClone(saved.data);
  const followup = await reprompt({ method: 'qizheng', result: saved, question: '是否换工作？', prompt: { topicId: 'career', subtopicId: 'job-change' } });
  assert.match(followup.prompt.text, /比较变动的动机/);
  assert.deepEqual(saved.data, originalData);
  const timing = await calculate('qizheng', { ...input, flow: { kind: 'year', year: 2026 }, prompt: { topicId: 'timing', subtopicId: 'yearly' } });
  assert.match(timing.prompt.text, /所选年度/);
  assert.doesNotMatch(timing.prompt.text, /当前未选择流曜资料/);
  const range = await calculate('qizheng-range', { ...input, range: { start: '1990-05-15T14:30:00+08:00', end: '1990-05-15T14:30:02+08:00' }, prompt: { topicId: 'health', subtopicId: 'body' } });
  assert.match(range.prompt.text, /无法从盘面确定疾病/);
  const args = { ...input, prompt: { topicId: 'career', subtopicId: 'job-change' } };
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'qizheng' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'qizheng', input: args }); assert.equal(http.status, 200);
  const a: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'qizheng', arguments: args } }); assert.equal(mcp.status, 200);
  const b: any = await mcp.json();
  assert.equal(a.prompt.text, b.result.structuredContent.prompt.text);
  assert.match(a.prompt.text, /比较变动的动机/);
});
