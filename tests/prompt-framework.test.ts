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
  getAstrolabePromptShortcut,
  getBaziCompatibilityPromptPreset,
  getBaziPromptPreset,
} from '../packages/core/src/prompt/presets.ts';
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

  assert.ok(bazi);
  const original = structuredClone(bazi);
  const input = { methodId: 'bazi', topicId: 'career', subtopicId: 'job-change' };
  const selection = requirePromptSelection(input);
  const task = buildPromptSelectionTask('请依据盘面完成解读。', selection);
  const careerOption = bazi.subtopics.career![0];
  const originalCareerLabel = careerOption.label;
  try {
    bazi.methodLabel = '变造方法';
    bazi.defaultScope = 'yearly';
    careerOption.label = '变造主题';
    assert.deepEqual(getPromptMethodCapability('bazi'), original);
    const freshSelection = requirePromptSelection(input);
    assert.deepEqual(freshSelection, selection);
    assert.equal(buildPromptSelectionTask('请依据盘面完成解读。', freshSelection), task);
  } finally {
    bazi.methodLabel = original.methodLabel;
    bazi.defaultScope = original.defaultScope;
    careerOption.label = originalCareerLabel;
  }

  const subtopics = getPromptSubtopicOptions('career');
  assert.deepEqual(subtopics[0], { id: 'job-change', label: '工作变动' });
  try {
    subtopics[0].label = '变造细项';
    assert.deepEqual(getPromptSubtopicOptions('career')[0], {
      id: 'job-change',
      label: '工作变动',
    });
    assert.deepEqual(requirePromptSelection(input), selection);
  } finally {
    subtopics[0].label = '工作变动';
  }

  const preset = getBaziPromptPreset('ai-career')!;
  const compatibility = getBaziCompatibilityPromptPreset('ai-compat-marriage')!;
  const shortcut = getAstrolabePromptShortcut('事业')!;
  const originalPreset = { ...preset };
  const originalCompatibility = { ...compatibility };
  const originalShortcut = { ...shortcut };
  assert.equal(preset.topic, 'career');
  assert.equal(compatibility.compatibilityType, 'marriage');
  assert.equal(shortcut.topic, 'career');
  try {
    preset.topic = 'health';
    compatibility.compatibilityType = 'friendship';
    shortcut.topic = 'health';
    assert.deepEqual(getBaziPromptPreset('ai-career'), originalPreset);
    assert.deepEqual(getBaziCompatibilityPromptPreset('ai-compat-marriage'), originalCompatibility);
    assert.deepEqual(getAstrolabePromptShortcut('事业'), originalShortcut);
  } finally {
    Object.assign(preset, originalPreset);
    Object.assign(compatibility, originalCompatibility);
    Object.assign(shortcut, originalShortcut);
  }
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
