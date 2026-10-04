import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPromptTask,
  getPromptAnswerFramework,
  PROMPT_ANSWER_FRAMEWORK,
  PROMPT_METHOD_ANSWER_FRAMEWORKS,
} from '../packages/core/src/prompt/guidance';

test('切换术式应替换末尾旧骨架，保留实际问题并只使用新术式推导', () => {
  const original = '请比较这次调岗与留任的条件。';
  const generic = buildPromptTask(original);
  const liuyao = buildPromptTask(generic, 'liuyao');
  assert.ok(liuyao.startsWith(original));
  assert.ok(liuyao.endsWith(getPromptAnswerFramework('liuyao')));
  assert.ok(!liuyao.includes(PROMPT_ANSWER_FRAMEWORK));
  const qimen = buildPromptTask(liuyao, 'qimen');
  assert.ok(!qimen.includes(getPromptAnswerFramework('liuyao')));
  assert.equal(buildPromptTask(qimen, 'qimen'), qimen);
});

test('任务中的引用保持原文，末尾答题规则按当前方法确定', () => {
  const quoted = `请分析这段说法：“${getPromptAnswerFramework('tarot')}”是否适用于本次六爻问题。`;
  const task = buildPromptTask(quoted, 'liuyao');
  assert.ok(task.startsWith(quoted));
  assert.ok(task.endsWith(getPromptAnswerFramework('liuyao')));
});

test('专业骨架保持紧凑，单盘、单牌、合参和时限任务保持各自证据粒度', () => {
  assert.ok(PROMPT_ANSWER_FRAMEWORK.length <= 70);
  for (const [method, text] of Object.entries(PROMPT_METHOD_ANSWER_FRAMEWORKS)) {
    assert.ok(text.length <= 80, `${method}：${text.length}字`);
    assert.doesNotMatch(text, /直断|决断吉凶成败|行动建议|风险提醒|不得|禁止/);
  }
  assert.match(getPromptAnswerFramework('bazi-compatibility'), /所属人及柱位/);
  assert.match(getPromptAnswerFramework('ziwei-compatibility'), /发出方.*接收方/);
  assert.match(getPromptAnswerFramework('tarot-single'), /唯一牌位/);
  assert.doesNotMatch(getPromptAnswerFramework('tarot-single'), /邻牌|过去.*未来/);
  assert.match(getPromptAnswerFramework('almanac'), /参与人.*冲犯.*每个候选日.*首选与备选/);
});
