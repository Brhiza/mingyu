import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { resolveSignByNumber } from '../packages/core/src/divination/algorithms/ssgw.ts';
import { buildDivinationPromptDocument } from '../packages/core/src/prompt/divination.ts';
import {
  buildBaziPromptForResult,
  buildPromptSelectionTask,
  getPromptMethodCapability,
  getPromptSubtopicOptions,
  requirePromptSelection,
  resolvePromptSelection,
} from '../packages/core/src/prompt/public-api.ts';
import {
  calculateWuyunLiuqi,
  buildWuyunLiuqiPrompt,
} from '../packages/core/src/wuyun-liuqi/index.ts';

test('统一选择解析严格区分默认值、旧映射和无效 ID', () => {
  const selection = requirePromptSelection({
    methodId: 'bazi',
    topicId: 'career',
    subtopicId: 'job-change',
    scope: 'natal',
  });

  assert.equal(selection.topicId, 'career');
  assert.equal(selection.subtopicId, 'job-change');
  assert.equal(selection.source, 'user');
  assert.equal(resolvePromptSelection({ methodId: 'bazi', topicId: 'job' }).ok, true);
  assert.equal(
    resolvePromptSelection({ methodId: 'bazi', topicId: 'not-a-topic' }).code,
    'INVALID_TOPIC',
  );
  assert.equal(resolvePromptSelection({ methodId: 'bazi', topicId: '' }).code, 'INVALID_TOPIC');
  assert.equal(
    resolvePromptSelection({ methodId: 'bazi', topicId: 'career', subtopicId: 'exam' }).code,
    'UNSUPPORTED_SUBTOPIC',
  );
});

test('方法能力目录提供类别、主题细项和范围约束', () => {
  const bazi = getPromptMethodCapability('bazi');
  assert.equal(bazi?.categoryId, 'chart');
  assert.ok(bazi?.topicIds.includes('career'));
  assert.ok(bazi?.scopeIds.includes('natal'));

  assert.equal(getPromptMethodCapability('astrolabe')?.defaultScope, 'yearly');
  assert.equal(getPromptMethodCapability('astrolabe-synastry')?.defaultScope, 'natal');

  const nameSubtopics = getPromptSubtopicOptions('general', 'name.generation');
  assert.deepEqual(nameSubtopics, [{ id: 'naming', label: '起名方案' }]);
  assert.deepEqual(getPromptSubtopicOptions('career', 'name.generation'), []);
});

test('主题与细项会改变任务重点并保留分析范围', () => {
  const general = requirePromptSelection({ methodId: 'bazi' });
  const career = requirePromptSelection({
    methodId: 'bazi',
    topicId: 'career',
    subtopicId: 'job-change',
    scope: 'yearly',
  });

  const generalTask = buildPromptSelectionTask('请依据盘面完成解读。', general);
  const careerTask = buildPromptSelectionTask('请依据盘面完成解读。', career);
  assert.notEqual(generalTask, careerTask);
  assert.match(careerTask, /事业/);
  assert.match(careerTask, /工作变动/);
  assert.match(careerTask, /流年/);
});

test('八字公开提示词接收统一选择并把主题写入任务', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const selection = requirePromptSelection({
    methodId: 'bazi',
    topicId: 'career',
    subtopicId: 'job-change',
    scope: 'natal',
  });
  const prompt = buildBaziPromptForResult({
    result,
    question: '本命事业结构如何？',
    fortuneScope: 'natal',
    selection,
  });

  assert.match(prompt, /【解读选择】/);
  assert.match(prompt, /工作变动/);
  assert.match(prompt, /本命/);
});

test('五运六气选择会进入任务，签谱不接受外加主题', () => {
  const result = calculateWuyunLiuqi({ year: 2026 });
  const selection = requirePromptSelection({
    methodId: 'wuyun-liuqi',
    topicId: 'health',
    scope: 'yearly',
  });
  const prompt = buildWuyunLiuqiPrompt(result, undefined, undefined, selection);
  assert.match(prompt, /身心/);
  assert.match(prompt, /流年/);

  const sign = resolveSignByNumber(1, new Date('2026-09-01T12:00:00+08:00'));
  assert.throws(
    () =>
      buildDivinationPromptDocument({
        method: 'ssgw',
        data: sign,
        topicId: 'career',
      }),
    /三山国王灵签提示词只接受本次签谱资料/,
  );
});
