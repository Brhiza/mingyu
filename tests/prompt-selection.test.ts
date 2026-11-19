import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import catalog from '../src/prompt-catalog.json';

const now = '2025-01-01T00:00:00Z';
const cases = {
  tarot: { question: '工作如何', currentTime: now, tarot: { spread: 'single', manualCards: [{ id: 1, reversed: false }] } },
  lenormand: { question: '工作如何', currentTime: now, lenormand: { spread: 'single', manualCardIds: [1] } },
  xiaoliuren: { question: '工作如何', currentTime: now, xiaoliuren: { rule: 'common' } },
};

test('独立术数的所有主题和子主题进入任务要求，不只显示标签', async () => {
  for (const method of Object.keys(cases) as Array<keyof typeof cases>) {
    const saved = await calculate(method, cases[method]);
    for (const topic of catalog[method].topicIds) {
      const topicPrompt = await reprompt({ method, result: saved, question: '新问题', prompt: { topicId: topic } });
      const task = topicPrompt.prompt.text.split('【任务】')[1].split('【问题】')[0];
      assert.match(topicPrompt.prompt.text, /分析范围：当前事项/);
      assert.match(task, /成立条件|相互制约/);
      const subtopics = (catalog[method].subtopics as Record<string, { id: string; label: string }[]>)[topic] ?? [];
      for (const subtopic of subtopics) {
        const result = await reprompt({ method, result: saved, question: '新问题', prompt: { topicId: topic, subtopicId: subtopic.id } });
        const selectedTask = result.prompt.text.split('【任务】')[1].split('【问题】')[0];
        assert.ok(selectedTask.includes(subtopic.label), `${method}/${topic}/${subtopic.id}`);
        assert.match(selectedTask, /现实核验点/);
      }
    }
    for (const scope of catalog[method].scopeIds) {
      const result = await reprompt({ method, result: saved, question: '新问题', prompt: { scope } });
      assert.match(result.prompt.text, /未提供对应时间资料时明确说明缺口/);
    }
    await assert.rejects(() => reprompt({ method, result: saved, question: '问题', prompt: { topicId: 'career', subtopicId: 'marriage' } }));
    await assert.rejects(() => reprompt({ method, result: saved, question: '问题', prompt: { subtopicId: '' } }));
  }
});

test('多口径提示词要求分别分析与比较，不混为单一判断', async () => {
  for (const [method, schools] of [
    ['tarot', ['rws', 'yuansu']],
    ['lenormand', ['combination', 'eventline']],
    ['xiaoliuren', ['shunshu', 'gongjue']],
  ] as const) {
    const result = await calculate(method, { ...cases[method], prompt: { schools } });
    assert.match(result.prompt.text, /多口径合参/);
    assert.match(result.prompt.text, /共同点、分歧/);
  }
});
