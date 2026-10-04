import test from 'node:test';
import assert from 'node:assert/strict';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { formatPatternBasisForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';
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
import { buildBaziZiweiPromptForResults } from '../packages/core/src/prompt/public-api';
import type { ScopeType } from '../src/types/analysis';

const samplePerson = {
  gender: 'male' as const,
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 6, // 午时
  isLunar: false,
};

let sampleBaziResult: ReturnType<typeof baziCalculator.calculateBazi> | undefined;
function getSampleBaziResult() {
  return (sampleBaziResult ??= baziCalculator.calculateBazi(samplePerson));
}

let sampleZiweiResult: ReturnType<typeof calculateZiweiChartForScopes> | undefined;
function getSampleZiweiResult() {
  if (sampleZiweiResult) return sampleZiweiResult;
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
  sampleZiweiResult = calculateZiweiChartForScopes(chartInput, ['origin' as ScopeType]);
  return sampleZiweiResult;
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

  const originalCareer = getThematicTopicConfig('career');
  const editedCareer = getThematicTopicConfig('career');
  editedCareer.baziFocusElements[0] = '变造返回八字焦点';
  editedCareer.ziweiFocusPalaces[0] = '变造返回紫微焦点';
  assert.deepEqual(getThematicTopicConfig('career'), originalCareer);

  const publicCareer = THEMATIC_TOPIC_CONFIGS.career;
  const originalPublicCareer = structuredClone(publicCareer);
  try {
    publicCareer.name = '变造公开主题';
    publicCareer.baziFocusElements[0] = '变造公开八字焦点';
    publicCareer.ziweiFocusPalaces[0] = '变造公开紫微焦点';
    assert.equal(publicCareer.name, '变造公开主题');
    assert.equal(publicCareer.baziFocusElements[0], '变造公开八字焦点');
    assert.equal(publicCareer.ziweiFocusPalaces[0], '变造公开紫微焦点');
    assert.deepEqual(getThematicTopicConfig('career'), originalCareer);
  } finally {
    Object.assign(publicCareer, originalPublicCareer);
  }
});

test('八字紫微双盘默认通用主题 (general) 合参提示词', async () => {
  const baziResult = getSampleBaziResult();
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
  assert.doesNotMatch(result.prompt, /【八字格局条件】/);
  assert.match(result.prompt, /当前成败判定：/);
  assert.ok(result.prompt.includes('【紫微盘面信息】'));
  assert.ok(result.prompt.includes('【任务】'));
  assert.ok(result.prompt.includes('【问题】'));
  assert.equal(result.selection.scope, 'decadal');
  assert.match(result.prompt, /紫微：大限\/大运。/);

  // 严格遵守 AGENTS.md 规范：不包含项目、代码或规则词汇
  assert.doesNotMatch(result.prompt, /API|MCP|repository|GitHub|项目|代码|待校|后人整理/i);
  assert.doesNotMatch(result.prompt, /【行动建议】|【风险提醒】/);
});

test('八字紫微核心合参提示词默认使用当前阶段范围', async () => {
  const baziResult = getSampleBaziResult();
  const ziweiResult = await getSampleZiweiResult();

  const prompt = buildBaziZiweiPromptForResults({
    baziResult,
    ziweiResult,
    question: '当前阶段的事业重点是什么？',
  });

  assert.doesNotMatch(prompt, /【八字格局条件】/);
  assert.match(prompt, /当前成败判定：/);
  assert.match(prompt, /紫微已给出运限范围，八字仍为本命资料，二者尚未对齐到同一日期。/);
});

test('感情大类主题 (relationship) 必须重点聚焦夫妻宫与配偶星', async () => {
  const baziResult = getSampleBaziResult();
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
  const baziResult = getSampleBaziResult();
  const ziweiResult = await getSampleZiweiResult();
  const currentTime = new Date('2025-01-01T00:00:00Z');
  const inputBefore = JSON.stringify({ baziResult, payloadByScope: ziweiResult.payloadByScope });

  const result = buildThematicConsultationPrompt({
    baziResult,
    ziweiResult,
    topic: 'career',
    currentTime,
  });

  assert.equal(result.topic, 'career');
  assert.equal(result.topicLabel, '事业');
  assert.ok(result.focusPalaces.includes('官禄'));
  assert.ok(result.focusElements.includes('正偏官杀'));
  assert.ok(result.prompt.includes('咨询主题：事业（事业职场与发展变动）'));

  const originalResult = structuredClone(result);
  result.focusElements[0] = '变造返回八字焦点';
  result.focusPalaces[0] = '变造返回紫微焦点';
  assert.equal(result.focusElements[0], '变造返回八字焦点');
  assert.equal(result.focusPalaces[0], '变造返回紫微焦点');
  const publicCareer = THEMATIC_TOPIC_CONFIGS.career;
  const originalPublicCareer = structuredClone(publicCareer);
  try {
    publicCareer.baziTask = '变造公开八字任务';
    publicCareer.ziweiTask = '变造公开紫微任务';
    publicCareer.combinedTask = '变造公开合参任务';
    assert.equal(publicCareer.combinedTask, '变造公开合参任务');
    const fresh = buildThematicConsultationPrompt({
      baziResult,
      ziweiResult,
      topic: 'career',
      currentTime,
    });
    assert.deepEqual(fresh, originalResult);
    assert.equal(
      JSON.stringify({ baziResult, payloadByScope: ziweiResult.payloadByScope }),
      inputBefore,
    );
  } finally {
    Object.assign(publicCareer, originalPublicCareer);
  }
});

test('财运大类主题 (wealth) 重点聚焦财帛宫、田宅宫与财星财库', async () => {
  const baziResult = getSampleBaziResult();
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
  const baziResult = getSampleBaziResult();
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
  assert.doesNotMatch(baziOnly.prompt, /【八字格局条件】/);
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

test('本命主题任务只依据已列本命盘事实，不生成岁运应期任务', async () => {
  const baziResult = getSampleBaziResult();
  const ziweiResult = await getSampleZiweiResult();
  for (const system of ['bazi', 'ziwei', 'bazi_ziwei'] as const) {
    const result = buildThematicConsultationPrompt({
      system,
      baziResult,
      ziweiResult,
      topic: 'career',
      scope: 'natal',
      ziweiScope: 'origin',
      question: '目前有哪些职业选择依据？',
    });
    const task = result.prompt.split('【任务】\n')[1]?.split('【问题】\n')[0] ?? '';
    assert.match(task, /已列|本命/);
    assert.doesNotMatch(task, /大运|流年|岁运|运限|应期|年份|时间节点|前后阶段/);
    assert.doesNotMatch(result.prompt, /未提供具体岁运资料|未提供具体运限资料/);
  }
});

test('本命健康主题结合医学资料核对传统取象', async () => {
  const baziResult = getSampleBaziResult();
  const ziweiResult = await getSampleZiweiResult();
  for (const system of ['bazi', 'ziwei', 'bazi_ziwei'] as const) {
    const prompt = buildThematicConsultationPrompt({
      system,
      baziResult,
      ziweiResult,
      topic: 'health',
      scope: 'natal',
      ziweiScope: 'origin',
      question: '结合体检结果看身体状态。',
    }).prompt;
    const task = prompt.split('【任务】\n')[1]?.split('【问题】\n')[0] ?? '';
    assert.match(task, /传统健康取象/);
    assert.match(task, /检查结果/);
    assert.match(task, /医学资料评估/);
    assert.doesNotMatch(task, /大运|流年|岁运|运限|应期/);
  }
});

test('主题任务说明以已列盘面及现实条件为依据', () => {
  const baziResult = getSampleBaziResult();
  const prompt = buildThematicConsultationPrompt({
    system: 'bazi',
    baziResult,
    topic: 'wealth',
    scope: 'yearly',
    question: '如何比较收入和债务压力？',
  }).prompt;
  const task = prompt.split('【任务】\n')[1]?.split('【问题】\n')[0] ?? '';
  assert.match(task, /收入、负债或合作事实/);
  assert.doesNotMatch(task, /丰盈年份|最佳决断窗口期|富贵贫贱/);
});

test('本命时机主题的默认问题定位于本命条件', () => {
  const baziResult = getSampleBaziResult();
  const prompt = buildThematicConsultationPrompt({
    system: 'bazi',
    baziResult,
    topic: 'timing',
    scope: 'natal',
  }).prompt;
  assert.match(prompt, /【问题】\n请说明本命结构中与时机取义相关的条件。/);
  assert.doesNotMatch(prompt, /近期关键动静时机/);
});

test('主题及双盘流派提示词只呈现一次八字格局判定与破格限制', async () => {
  const baziResult = baziCalculator.calculateBazi({
    ...samplePerson,
    year: 2013,
    month: 9,
    day: 25,
    timeIndex: 3,
  });
  const ziweiResult = await getSampleZiweiResult();
  const prompts = [
    buildThematicConsultationPrompt({
      baziResult,
      system: 'bazi',
      topic: 'career',
      baziSchool: 'ziping',
    }).prompt,
    buildBaziZiweiPromptForResults({
      baziResult,
      ziweiResult,
      question: '事业如何安排？',
      baziSchool: 'ziping',
    }),
  ];
  for (const prompt of prompts) {
    assert.doesNotMatch(prompt, /所取格局：/);
    assert.equal(prompt.match(/格局破格所忌：/g)?.length, 1);
    assert.doesNotMatch(prompt, /【八字格局条件】/);
    assert.match(prompt, /透干通根：/);
  }
});

test('八字紫微合参流派资料不重复通用八字盘面已列出的格局条件', async () => {
  const baziResult = baziCalculator.calculateBazi({
    year: 1980,
    month: 5,
    day: 3,
    timeIndex: 0,
    gender: 'male',
  });
  assert.equal(baziResult.analysis.mingGe.specialAdjudication?.kind, '从儿格');
  const basis = baziResult.analysis.mingGe.basis!;
  const satisfied = baziResult.analysis.mingGe.specialAdjudication!.satisfied;
  const baziOnlyPrompt = buildThematicConsultationPrompt({
    baziResult,
    system: 'bazi',
    topic: 'career',
    baziSchools: ['ziping', 'mangpai'],
  }).prompt;
  assert.equal(baziOnlyPrompt.split(formatPatternBasisForPrompt(basis)).length - 1, 1);
  assert.doesNotMatch(baziOnlyPrompt, /特殊格条件：|特殊格裁决：从儿格成立/);
  for (const condition of satisfied) {
    assert.equal(baziOnlyPrompt.split(formatPatternBasisForPrompt(condition)).length - 1, 1);
  }

  const ziweiResult = await getSampleZiweiResult();

  const prompt = buildBaziZiweiPromptForResults({
    baziResult,
    ziweiResult,
    question: '请分析事业方向。',
    baziSchools: ['ziping', 'mangpai'],
  });

  assert.equal(prompt.split(formatPatternBasisForPrompt(basis)).length - 1, 1);
  assert.doesNotMatch(prompt, /特殊格条件：|特殊格裁决：从儿格成立/);
  for (const condition of satisfied) {
    assert.equal(prompt.split(formatPatternBasisForPrompt(condition)).length - 1, 1);
  }
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
