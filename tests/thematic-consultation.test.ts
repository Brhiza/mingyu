import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import {
  buildZiweiChartInput,
  calculateZiweiChartForScopes,
} from '../src/lib/full-chart-engine/ziwei';
import {
  THEMATIC_TOPICS,
  THEMATIC_TOPIC_CONFIGS,
  normalizeThematicTopic,
  getThematicTopicConfig,
  buildThematicConsultationPrompt,
} from '../packages/core/src/prompt/thematic';
import type { ScopeType } from '../src/types/analysis';

const samplePerson = {
  gender: 'male' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 6, // 午时
  isLunar: false,
};

async function getSampleZiweiResult() {
  const chartInput = buildZiweiChartInput({
    name: '张三',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 6,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  return calculateZiweiChartForScopes(chartInput, ['origin' as ScopeType]);
}

test('大类主题枚举完整性与别名/旧子主题平滑归一化', () => {
  assert.equal(THEMATIC_TOPICS.length, 8);
  assert.deepEqual(
    [...THEMATIC_TOPICS],
    ['general', 'relationship', 'career', 'wealth', 'health', 'family', 'academic', 'timing'],
  );

  // 默认与空值回退
  assert.equal(normalizeThematicTopic(undefined), 'general');
  assert.equal(normalizeThematicTopic(null), 'general');
  assert.equal(normalizeThematicTopic(''), 'general');
  assert.equal(normalizeThematicTopic('unknown-topic'), 'general');

  // 精确匹配
  for (const topic of THEMATIC_TOPICS) {
    assert.equal(normalizeThematicTopic(topic), topic);
    const config = getThematicTopicConfig(topic);
    assert.ok(config.title.length > 0);
    assert.ok(config.name.length > 0);
    assert.ok(config.baziTask.length > 0);
    assert.ok(config.ziweiTask.length > 0);
    assert.ok(config.combinedTask.length > 0);
  }

  // 历史细分与别名映射
  assert.equal(normalizeThematicTopic('marriage'), 'relationship');
  assert.equal(normalizeThematicTopic('relationship-push'), 'relationship');
  assert.equal(normalizeThematicTopic('婚恋'), 'relationship');
  assert.equal(normalizeThematicTopic('job-change'), 'career');
  assert.equal(normalizeThematicTopic('startup-partnership'), 'career');
  assert.equal(normalizeThematicTopic('职场'), 'career');
  assert.equal(normalizeThematicTopic('investment-partnership'), 'wealth');
  assert.equal(normalizeThematicTopic('投资'), 'wealth');
  assert.equal(normalizeThematicTopic('exam-landing'), 'academic');
  assert.equal(normalizeThematicTopic('study-advance'), 'academic');
  assert.equal(normalizeThematicTopic('考公上岸'), 'academic');
  assert.equal(normalizeThematicTopic('home-move'), 'family');
  assert.equal(normalizeThematicTopic('settle-relocate'), 'family');
  assert.equal(normalizeThematicTopic('recent'), 'timing');
  assert.equal(normalizeThematicTopic('流年运势'), 'timing');
});

test('八字紫微双盘默认通用主题 (general) 合参提示词', async () => {
  const baziResult = baziCalculator.calculateBazi(samplePerson);
  const ziweiResult = await getSampleZiweiResult();

  const result = buildThematicConsultationPrompt({
    baziResult,
    ziweiResult,
  });

  assert.equal(result.system, 'bazi_ziwei');
  assert.equal(result.topic, 'general');
  assert.equal(result.topicLabel, '通用');
  assert.ok(result.prompt.includes('【当前时间】'));
  assert.ok(result.prompt.includes('【分析主题】'));
  assert.ok(result.prompt.includes('咨询主题：通用（综合大局与命身全景）'));
  assert.ok(result.prompt.includes('【八字排盘信息】'));
  assert.ok(result.prompt.includes('【紫微盘面信息】'));
  assert.ok(result.prompt.includes('【任务】'));
  assert.ok(result.prompt.includes('【问题】'));

  // 严格遵守 AGENTS.md 规范：不包含项目、代码或规则词汇
  assert.doesNotMatch(result.prompt, /API|MCP|repository|GitHub|项目|代码|待校|后人整理/i);
  assert.doesNotMatch(result.prompt, /【行动建议】|【风险提醒】/);
});

test('感情大类主题 (relationship) 必须重点聚焦夫妻宫与配偶星', async () => {
  const baziResult = baziCalculator.calculateBazi(samplePerson);
  const ziweiResult = await getSampleZiweiResult();

  const result = buildThematicConsultationPrompt({
    baziResult,
    ziweiResult,
    topic: 'relationship',
  });

  assert.equal(result.topic, 'relationship');
  assert.equal(result.topicLabel, '感情');
  assert.ok(result.focusPalaces.includes('夫妻'));
  assert.ok(result.focusElements.includes('配偶星'));
  assert.ok(result.focusElements.includes('夫妻宫日支'));

  assert.ok(result.prompt.includes('咨询主题：感情（婚恋情感与配偶桃花）'));
  assert.ok(result.prompt.includes('夫妻宫'));
  assert.ok(result.prompt.includes('配偶星'));
});

test('事业大类主题 (career) 重点聚焦官禄宫与官杀印星', async () => {
  const baziResult = baziCalculator.calculateBazi(samplePerson);
  const ziweiResult = await getSampleZiweiResult();

  const result = buildThematicConsultationPrompt({
    baziResult,
    ziweiResult,
    topic: 'career',
  });

  assert.equal(result.topic, 'career');
  assert.equal(result.topicLabel, '事业');
  assert.ok(result.focusPalaces.includes('官禄'));
  assert.ok(result.focusElements.includes('正偏官杀'));
  assert.ok(result.prompt.includes('咨询主题：事业（事业职场与发展变动）'));
});

test('财运大类主题 (wealth) 重点聚焦财帛宫、田宅宫与财星财库', async () => {
  const baziResult = baziCalculator.calculateBazi(samplePerson);
  const ziweiResult = await getSampleZiweiResult();

  const result = buildThematicConsultationPrompt({
    baziResult,
    ziweiResult,
    topic: 'wealth',
  });

  assert.equal(result.topic, 'wealth');
  assert.equal(result.topicLabel, '财运');
  assert.ok(result.focusPalaces.includes('财帛'));
  assert.ok(result.focusPalaces.includes('田宅'));
  assert.ok(result.focusElements.includes('正偏财星'));
  assert.ok(result.prompt.includes('咨询主题：财运（求财路径与财富运势）'));
});

test('单系统模式 (system: bazi 或 system: ziwei) 独立生成自包含提示词', async () => {
  const baziResult = baziCalculator.calculateBazi(samplePerson);
  const ziweiResult = await getSampleZiweiResult();

  // 1. 纯八字
  const baziOnly = buildThematicConsultationPrompt({
    baziResult,
    system: 'bazi',
    topic: 'health',
  });
  assert.equal(baziOnly.system, 'bazi');
  assert.equal(baziOnly.topic, 'health');
  assert.ok(baziOnly.prompt.includes('【排盘信息】'));
  assert.ok(!baziOnly.prompt.includes('【紫微盘面信息】'));
  assert.ok(baziOnly.prompt.includes('五行'));

  // 2. 纯紫微
  const ziweiOnly = buildThematicConsultationPrompt({
    ziweiResult,
    system: 'ziwei',
    topic: 'academic',
  });
  assert.equal(ziweiOnly.system, 'ziwei');
  assert.equal(ziweiOnly.topic, 'academic');
  assert.ok(ziweiOnly.prompt.includes('【紫微盘面资料】'));
  assert.ok(!ziweiOnly.prompt.includes('【八字排盘信息】'));
  assert.ok(ziweiOnly.prompt.includes('官禄宫'));
});

test('三柱缺时辰降级时八字主题提示词仍可稳定生成', () => {
  const threePillarsPerson = {
    ...samplePerson,
    timeIndex: undefined,
    isThreePillars: true,
  };
  const baziResult = baziCalculator.calculateBazi(threePillarsPerson);

  const result = buildThematicConsultationPrompt({
    baziResult,
    system: 'bazi',
    topic: 'career',
  });

  assert.equal(result.system, 'bazi');
  assert.ok(result.prompt.includes('咨询主题：事业'));
  assert.ok(result.prompt.includes('【排盘信息】'));
});
