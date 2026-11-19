import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getPromptCatalog } from '../src/catalog';
import { baziTopicIds, baziTopics, baziSchoolIds, baziSchools } from '../src/systems/bazi/prompt-options';

const input = { question: '希望了解具体情况', birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 } };

test('独立八字各主题生成实际任务且不改变盘面', async () => {
  const baseline = await calculate('bazi', input);
  for (const topic of baziTopicIds) {
    const result = await calculate('bazi', { ...input, prompt: { topic } });
    assert.deepEqual(result.data, baseline.data);
    assert.ok(result.prompt.text.includes(`【主题：${baziTopics[topic].label}】`), topic);
    assert.ok(result.prompt.text.includes(baziTopics[topic].focus), topic);
    assert.ok(result.prompt.text.includes(baziTopics[topic].task), topic);
    assert.match(result.prompt.text, /不得将其当成已经算出的结论/);
  }
  const catalog = getPromptCatalog(['bazi'])['bazi'];
  assert.deepEqual(catalog.topics.map((x) => x.id), [...baziTopicIds]);
  assert.deepEqual(catalog.schools.map((x) => x.id), [...baziSchoolIds]);
});

test('多流派与主题在精确盘、时辰候选和追问中切换，不修改保存盘面', async () => {
  const initial = await calculate('bazi', { ...input, prompt: { topic: 'career', schools: [...baziSchoolIds] } });
  for (const school of baziSchoolIds) assert.ok(initial.prompt.text.includes(baziSchools[school].task));
  const result = JSON.parse(JSON.stringify(initial));
  const next = await reprompt({ method: 'bazi', result, question: '关系如何？', prompt: { topic: 'relationship', schools: ['mangpai'] } });
  assert.match(next.prompt.text, /【主题：关系】/); assert.match(next.prompt.text, /盲派/);
  assert.doesNotMatch(next.prompt.text, /【主题：事业】|子平派：|新派：/);
  const uncertain = await calculate('bazi', { ...input, birth: { ...input.birth, clock: { kind: 'shichen', index: 8 } }, prompt: { topic: 'children', schools: ['ziping'] } });
  assert.match(uncertain.prompt.text, /【主题：子女】/); assert.match(uncertain.prompt.text, /子平派/);
  assert.match(uncertain.prompt.text, /不得将某个候选时段当作已确定出生时间/);
  await assert.rejects(() => calculate('bazi', { ...input, prompt: { topic: '不存在' } }));
  await assert.rejects(() => calculate('bazi', { ...input, prompt: { schools: ['不存在'] } }));
});
