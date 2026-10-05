import assert from 'node:assert/strict';
import test from 'node:test';

import { generateDivinationSession } from '../packages/core/src/divination/session';
import type { KongmingHexagramResult, ZhugeNumberResult } from '../packages/core/src/name-number';

const currentTime = '2026-10-01T04:00:00Z';

test('诸葛神数在线任务书使用第1签完整签谱，取数留在结构化结果', () => {
  const session = generateDivinationSession({
    method: 'zhuge',
    zhuge: { text: '夏夏一' },
    question: '如何准备这次评选？',
    currentTime,
  });
  const data = session.data as ZhugeNumberResult;
  const interpretation = data.interpretation!;
  const prompt = session.aiPrompt;

  assert.equal(data.number, 1);
  assert.deepEqual(data.strokes, [10, 10, 1]);
  assert.deepEqual(data.digits, [0, 0, 1]);
  assert.equal(data.rawNumber, 1);
  assert.equal(interpretation.quote, '秋高听鹿鸣');
  assert.ok(data.sign.poem.includes(interpretation.quote));
  assert.equal(prompt.split(interpretation.quote).length - 1, 1);
  assert.equal(prompt, session.prompt);
  for (const fact of [
    `签号：第${data.number}签`,
    `签诗：${data.sign.poem}`,
    `典故：${interpretation.classicalImage}`,
    `基础解签：${interpretation.imageMeaning}；${interpretation.interpretation}`,
    `补充解释：${interpretation.condition}`,
  ]) {
    assert.ok(prompt.includes(fact), `在线任务书缺少：${fact}`);
  }
  assert.doesNotMatch(prompt, /夏夏一|三字：|康熙笔画|取数：|【当前时间】|【起课时间】/u);
});

test('孔明神卦在线任务书使用第2签完整签谱，五枚结果留在结构化结果', () => {
  const session = generateDivinationSession({
    method: 'kongming',
    kongming: { pattern: '10000' },
    question: '这次转变如何准备？',
    currentTime,
  });
  const data = session.data as KongmingHexagramResult;
  const interpretation = data.interpretation;
  const classicalImage = interpretation.classicalImage!;
  const prompt = session.aiPrompt;

  assert.equal(data.number, 2);
  assert.equal(data.symbol, '●○○○○');
  assert.equal(data.name, '从革卦');
  assert.equal(data.grade, '上平');
  assert.equal(interpretation.quote, '龙门鱼跃过');
  assert.ok(data.poem.includes(interpretation.quote));
  assert.equal(prompt.split(interpretation.quote).length - 1, 1);
  assert.deepEqual(
    data.draws.map((draw) => draw.polarity),
    ['阳', '阴', '阴', '阴', '阴'],
  );
  assert.equal(prompt, session.prompt);
  for (const fact of [
    `签号：第${data.number}签`,
    `签题：${data.name}`,
    `签诗：${data.poem}`,
    `吉凶级别：${data.grade}`,
    `典故：${classicalImage.title}“${classicalImage.quote}”；${classicalImage.meaning}`,
    `基础解签：${interpretation.imageMeaning}；${interpretation.interpretation}`,
    `补充解释：${interpretation.condition}`,
  ]) {
    assert.ok(prompt.includes(fact), `在线任务书缺少：${fact}`);
  }
  assert.doesNotMatch(prompt, /10000|●○○○○|卦象：|五枚硬币|【当前时间】|【起课时间】/u);
});
