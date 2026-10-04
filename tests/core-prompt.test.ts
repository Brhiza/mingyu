import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeFortuneTriggers } from '@core/bazi/fortuneTriggerEvidence';

import { baziCalculator, buildFortuneSelectionContext } from 'mingyu-core/bazi';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import {
  buildBaziCompatibilityPrompt,
  buildBaziPrompt,
  buildDivinationPrompt,
  buildMetaphysicsPrompt,
  formatDetailedDivinationInfo,
  formatDivinationTime,
  formatDivinationInfo,
  formatEnhancedDivinationInfo,
  formatBaziFortuneSelection,
  formatBaziPatternConditions,
  formatPromptCurrentTime,
  buildSection,
  buildTimeInfoText,
  formatSupplementaryInfoSection,
  getDivinationSummaryBlocks,
  buildPromptTask,
  PROMPT_GUIDANCE_TEXT,
  PROMPT_METHOD_ANSWER_FRAMEWORKS,
} from 'mingyu-core/prompt';
import { formatBaziSchoolFacts } from '../packages/core/src/prompt/bazi-school.ts';
import './divination-micro-systems.cases.ts';
import './prompt-page-rules.cases.ts';
import './prompt-remediation.cases.ts';

function createChart(gender: 'male' | 'female', day: number) {
  return baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day,
    timeIndex: 5,
    gender,
  });
}

const FEMALE_DAY_15_CHART = createChart('female', 15);
const XIAOLIUREN_FIXED_CHART = generateXiaoliuren({
  customDate: new Date('2025-06-29T08:00:00+08:00'),
});

test('八字五行方向随日主转换十神参照并保留生克方向', () => {
  const expectedRoles: Record<string, string[]> = {
    木: ['日主、比劫', '食伤', '财星', '官杀', '印星'],
    火: ['印星', '日主、比劫', '食伤', '财星', '官杀'],
    土: ['官杀', '印星', '日主、比劫', '食伤', '财星'],
    金: ['财星', '官杀', '印星', '日主、比劫', '食伤'],
    水: ['食伤', '财星', '官杀', '印星', '日主、比劫'],
  };
  const elements = ['木', '火', '土', '金', '水'];
  const seen = new Set<string>();
  for (let day = 1; day <= 9; day += 2) {
    const chart = createChart('female', day);
    seen.add(chart.dayMaster.element);
    const prompt = buildBaziPrompt({ result: chart, fortuneScope: 'natal' });
    const section = prompt.split('【五行作用方向】')[1].split('【核心判断】')[0];
    const labels = expectedRoles[chart.dayMaster.element].map((role, i) => `${role}${elements[i]}`);
    for (let i = 0; i < 5; i++) {
      const source = labels[i];
      const generated = labels[(i + 1) % 5];
      const controlled = labels[(i + 2) % 5];
      assert.ok(section.includes(`${source}生${generated}`));
      assert.ok(section.includes(`${source}克${controlled}`));
      assert.ok(!section.includes(`${generated}生${source}`));
      assert.ok(!section.includes(`${controlled}克${source}`));
    }
  }
  assert.equal(seen.size, 5);
});

test('npm 提示词入口应生成自包含的八字任务书', () => {
  const currentTime = new Date('2026-08-06T12:30:00+08:00');
  const question = '今年是否适合换工作？';
  const buildBaziTaskbook = (result: typeof FEMALE_DAY_15_CHART) =>
    buildBaziPrompt({
      result,
      topic: 'career',
      school: 'traditional',
      fortuneScope: 'full',
      question,
      currentTime: new Date(currentTime.getTime()),
    });
  const baselineBaziChart = structuredClone(FEMALE_DAY_15_CHART);
  const prompt = buildBaziTaskbook(structuredClone(FEMALE_DAY_15_CHART));

  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /【流派】/);
  assert.match(prompt, /【命限资料】/);
  assert.match(prompt, /今年是否适合换工作/);
  assert.match(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /API|MCP|仓库|项目名|工程上下文/);

  const liuyaoInput = {
    timestamp: new Date('2025-06-18T10:30:00+08:00'),
    yaos: [7, 8, 9, 6, 7, 8] as const,
  };
  const liuyaoQuestion = '这次工作变动如何取舍？';
  const liuyaoCurrentTime = new Date('2025-06-18T02:30:00.000Z');
  const baselineLiuyaoChart = generateLiuyao(liuyaoInput.timestamp, {
    yaos: [...liuyaoInput.yaos],
  });
  const buildLiuyaoTaskbook = (data: typeof baselineLiuyaoChart) =>
    buildDivinationPrompt({
      method: 'liuyao',
      data,
      question: liuyaoQuestion,
      currentTime: new Date(liuyaoCurrentTime.getTime()),
    });
  const baselineLiuyaoTaskbook = buildLiuyaoTaskbook(baselineLiuyaoChart);
  const frameworkSwitchSource = '请依据当前资料回答【问题】。';
  const baselineLiuyaoTask = buildPromptTask(frameworkSwitchSource, 'liuyao');
  const baselineQimenTask = buildPromptTask(frameworkSwitchSource, 'qimen');
  const baselineSwitchedTask = buildPromptTask(baselineLiuyaoTask, 'qimen');
  assert.equal(baselineSwitchedTask, baselineQimenTask);
  assert.notEqual(baselineSwitchedTask, baselineLiuyaoTask);
  const originalBaziGuidance = structuredClone(PROMPT_GUIDANCE_TEXT.bazi);
  const originalLiuyaoGuidance = structuredClone(PROMPT_GUIDANCE_TEXT.liuyao);
  const originalBaziFramework = PROMPT_METHOD_ANSWER_FRAMEWORKS.bazi;
  const originalLiuyaoFramework = PROMPT_METHOD_ANSWER_FRAMEWORKS.liuyao;

  try {
    assert.equal(
      Reflect.set(PROMPT_GUIDANCE_TEXT.bazi, 'tradition', '外部变造的八字传统依据'),
      true,
    );
    assert.equal(
      Reflect.set(PROMPT_GUIDANCE_TEXT.liuyao, 'tradition', '外部变造的六爻传统依据'),
      true,
    );
    assert.equal(
      Reflect.set(PROMPT_METHOD_ANSWER_FRAMEWORKS, 'bazi', '外部变造的八字答题骨架'),
      true,
    );
    assert.equal(
      Reflect.set(PROMPT_METHOD_ANSWER_FRAMEWORKS, 'liuyao', '外部变造的六爻答题骨架'),
      true,
    );
    assert.equal(PROMPT_GUIDANCE_TEXT.bazi.tradition, '外部变造的八字传统依据');
    assert.equal(PROMPT_GUIDANCE_TEXT.liuyao.tradition, '外部变造的六爻传统依据');
    assert.equal(PROMPT_METHOD_ANSWER_FRAMEWORKS.bazi, '外部变造的八字答题骨架');
    assert.equal(PROMPT_METHOD_ANSWER_FRAMEWORKS.liuyao, '外部变造的六爻答题骨架');

    const freshBaziChart = createChart('female', 15);
    assert.deepEqual(freshBaziChart, baselineBaziChart);
    assert.equal(buildBaziTaskbook(freshBaziChart), prompt);

    const freshLiuyaoChart = generateLiuyao(new Date(liuyaoInput.timestamp.getTime()), {
      yaos: [...liuyaoInput.yaos],
    });
    assert.deepEqual(freshLiuyaoChart, baselineLiuyaoChart);
    assert.equal(buildLiuyaoTaskbook(freshLiuyaoChart), baselineLiuyaoTaskbook);
    assert.equal(
      buildPromptTask(buildPromptTask(frameworkSwitchSource, 'liuyao'), 'qimen'),
      baselineSwitchedTask,
    );
  } finally {
    Reflect.set(PROMPT_GUIDANCE_TEXT.bazi, 'tradition', originalBaziGuidance.tradition);
    Reflect.set(PROMPT_GUIDANCE_TEXT.liuyao, 'tradition', originalLiuyaoGuidance.tradition);
    Reflect.set(PROMPT_METHOD_ANSWER_FRAMEWORKS, 'bazi', originalBaziFramework);
    Reflect.set(PROMPT_METHOD_ANSWER_FRAMEWORKS, 'liuyao', originalLiuyaoFramework);
  }

  assert.deepEqual(PROMPT_GUIDANCE_TEXT.bazi, originalBaziGuidance);
  assert.deepEqual(PROMPT_GUIDANCE_TEXT.liuyao, originalLiuyaoGuidance);
  assert.equal(PROMPT_METHOD_ANSWER_FRAMEWORKS.bazi, originalBaziFramework);
  assert.equal(PROMPT_METHOD_ANSWER_FRAMEWORKS.liuyao, originalLiuyaoFramework);
});

test('npm 八字本命提示词入口应输出有差异的盲派与新派资料', () => {
  const result = structuredClone(FEMALE_DAY_15_CHART);
  const mangpai = buildBaziPrompt({
    result,
    school: 'mangpai',
    question: '事业和家庭的主线如何？',
  });
  const xinpai = buildBaziPrompt({
    result,
    school: 'xinpai',
    question: '事业和家庭的主线如何？',
  });

  assert.match(mangpai, /四柱宫位参照/);
  assert.match(mangpai, /主宾定位/);
  assert.match(mangpai, /四柱组合与做功线索/);
  assert.match(mangpai, /透干通根/);
  assert.match(mangpai, /墓库与空亡/);
  assert.match(xinpai, /旺衰判定/);
  assert.match(xinpai, /十神结构/);
  assert.match(xinpai, /喜忌落位/);
  assert.doesNotMatch(xinpai, /动态岁运/);
  assert.notEqual(mangpai, xinpai);
  assert.doesNotMatch(`${mangpai}\n${xinpai}`, /API|MCP|仓库|项目名|工程上下文/);
});

test('新派提示词保留十神显隐事实，不把共现组合写成已成立的流通', () => {
  const result = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 1,
    gender: 'male',
  });
  const prompt = formatBaziSchoolFacts(result, 'xinpai');

  assert.match(prompt, /十神结构：已见/);
  assert.doesNotMatch(prompt, /十神流通：候选链条|条件核验：|需日主能担财|食伤为用则吉/);
  assert.doesNotMatch(prompt, /API|MCP|仓库|项目名|工程上下文/);
});

test('npm 八字提示词应保留所选岁运与上层资料', () => {
  const result = structuredClone(FEMALE_DAY_15_CHART);
  const cycle = result.luckInfo.cycles.find((item) => item.years.length > 0 && !item.isXiaoyun);
  assert.ok(cycle);
  const year = cycle.years[0];
  assert.ok(year);
  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: result.luckInfo.cycles.indexOf(cycle),
    year: year.year,
  });
  assert.ok(context);

  const prompt = buildBaziPrompt({
    result,
    fortuneSelectionContext: context,
    question: '这一年的重点是什么？',
  });

  assert.match(prompt, /【岁运重点】/);
  assert.match(prompt, new RegExp(String(year.year)));
  assert.match(prompt, new RegExp(context.cycleLabel));
  assert.match(prompt, /上层岁运/);
  assert.doesNotMatch(prompt, /该流年包含的流月/);
  assert.doesNotMatch(prompt, /交节时刻/);

  const sections = formatBaziFortuneSelection(context);
  assert.ok(sections);
  assert.match(sections.analysisObject, new RegExp(String(year.year)));
  assert.match(sections.focus, /选择日期：/);
  assert.match(sections.focus, /上层岁运：/);
  assert.match(sections.focus, /所选干支：/);
  assert.match(sections.focus, /岁运干支关系：/);
  const boundaryContext = {
    ...context,
    cycleTimeRange: {
      ...context.cycleTimeRange,
      start: { year: 1997, month: 9, day: 21, hour: 3, minute: 4, second: 5 },
      end: { year: 2007, month: 9, day: 21, hour: 3, minute: 4, second: 5 },
    },
  };
  const boundary = formatBaziFortuneSelection(boundaryContext)!;
  assert.ok(boundary.focus.includes(`上层岁运：${context.cycleLabel}`));
  assert.match(boundary.focus, /1997年9月21日 03:04:05起，至2007年9月21日 03:04:05交接/);
  assert.match(boundary.focus, /起点归本运，终点归后续运段/);
  assert.ok(boundary.focus.includes(`该运交接年龄：${context.cycleAge}岁`));
});

test('八字岁运正文区分同干支冲、岁运并临与天克地冲，并保留流月流日身份', () => {
  const result = structuredClone(FEMALE_DAY_15_CHART);
  const cycleIndex = result.luckInfo.cycles.findIndex((cycle) => cycle.years.length > 0);
  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex,
    year: result.luckInfo.cycles[cycleIndex].years[0].year,
  });
  assert.ok(context);
  for (const [yearGanZhi, expected, excluded] of [
    ['癸酉', '六冲', '岁运并临|天克地冲|同柱伏吟'],
    ['癸卯', '岁运并临', '天克地冲'],
    ['丁酉', '天克地冲', '岁运并临|同柱伏吟'],
  ]) {
    const triggerEvidence = analyzeFortuneTriggers(result, [
      { id: 'dayun', type: 'dayun', label: '大运', ganZhi: '癸卯' },
      { id: 'year', type: 'year', label: '流年', ganZhi: yearGanZhi },
      { id: 'month', type: 'month', label: '节气流月', ganZhi: '甲寅' },
      { id: 'day', type: 'day', label: '流日', ganZhi: '甲申' },
    ]);
    const focus = formatBaziFortuneSelection({
      ...context,
      promptPayload: { ...context.promptPayload, triggerEvidence },
    })!.focus;
    const pairLines = focus
      .split('；')
      .filter((line) => line.includes(`流年${yearGanZhi}↔大运癸卯`))
      .join('\n');
    assert.match(pairLines, new RegExp(expected));
    assert.doesNotMatch(pairLines, new RegExp(excluded));
    if (yearGanZhi === '癸酉') assert.match(pairLines, /干同/);
    assert.match(focus, /流日甲申↔节气流月甲寅：干同、六冲/);
    assert.doesNotMatch(focus, /sourceLayerKey|已计算|反证事实|计算步骤|不得/);
  }
});

test('npm 提示词入口应生成八字双盘关系资料', () => {
  const result1 = structuredClone(FEMALE_DAY_15_CHART);
  const result2 = createChart('male', 20);
  const prompt = buildBaziCompatibilityPrompt({
    result1,
    result2,
    compatibilityType: 'marriage',
    question: '双方适合长期共同生活吗？',
  });

  assert.match(prompt, /【第一人排盘信息】/);
  assert.match(prompt, /【第二人排盘信息】/);
  assert.match(prompt, /当前成败判定：/);
  const result1Conditions = formatBaziPatternConditions(result1);
  if (result1Conditions) assert.match(prompt, /【第一人格局条件】/);
  else assert.doesNotMatch(prompt, /【第一人格局条件】/);
  const result2Conditions = formatBaziPatternConditions(result2);
  if (result2Conditions) assert.match(prompt, /【第二人格局条件】/);
  assert.match(prompt, /【双盘关系资料】/);
  assert.match(prompt, /双方适合长期共同生活吗/);
});

test('统一占法摘要应覆盖小六壬且不落回通用文案', () => {
  const data = structuredClone(XIAOLIUREN_FIXED_CHART);
  const summary = getDivinationSummaryBlocks('xiaoliuren', data);
  const info = formatDivinationInfo('xiaoliuren', data);
  const prompt = buildDivinationPrompt({
    method: 'xiaoliuren',
    data,
    question: '眼前事情如何推进？',
  });

  assert.equal(summary.title, '小六壬起课结果');
  assert.match(info, /占得宫/);
  assert.match(info, /起课过程/);
  assert.match(info, /定日宫：从月宫.+起初一（.+），顺数至.+日，落/u);
  assert.match(info, /定时宫：从日宫.+起子时，顺数至/u);
  assert.doesNotMatch(info, /定位用途：/u);
  assert.ok(info.includes(`占得宫：${data.primary.name}`));
  assert.doesNotMatch(info, /顺数轨迹/);
  assert.doesNotMatch(info, /mod\s*6|时序\d+/);
  assert.match(prompt, /依据本次顺数结果、时宫与歌诀/);
  assert.match(prompt, /眼前事情如何推进/);
  assert.match(formatDetailedDivinationInfo('xiaoliuren', data), /顺数/);
  assert.match(formatDivinationTime(data), /节气：/);
});

test('npm 占法增强格式化应直接提供前端使用的关键证据', () => {
  const liuyao = generateLiuyao(new Date('2025-01-01T00:21:00+08:00'));
  const qimen = generateQimen(new Date('2025-01-01T08:00:00+08:00'));

  const liuyaoText = formatEnhancedDivinationInfo('liuyao', liuyao);
  const qimenText = formatEnhancedDivinationInfo('qimen', qimen);

  assert.match(liuyaoText, /用神主线：事项用神待按具体问题取用/);
  assert.match(liuyaoText, /月日五行：[^\n]*月建子水[^\n]*日辰午火/u);
  assert.doesNotMatch(liuyaoText, /月日触发：/u);
  assert.doesNotMatch(liuyaoText, /应期资料：/);
  assert.match(qimenText, /值符值使与时干：/);
  assert.match(qimenText, /节令：/);
  assert.match(qimenText, /旬空与马星：/);
});

test('npm 奇门提示词应统一定局三元并输出年命落宫', () => {
  const qimen = generateQimen(new Date('2026-08-08T15:14:00+08:00'));
  const prompt = buildDivinationPrompt({
    method: 'qimen',
    data: qimen,
    question: '整体解读',
    supplementaryInfo: { birthYear: 1989 },
  });

  assert.match(prompt, /核心结构：阴遁5局；立秋 中元/);
  assert.doesNotMatch(prompt, /立秋上元/);
  assert.match(prompt, /年命资料：公历1989年按年中口径取年命干支己巳，命干己/);
  assert.match(prompt, /年命落宫（年中口径）：命干己落.+宫/);
  assert.doesNotMatch(prompt, /【补充信息】[\s\S]*出生年份/);
});

test('年家与月家奇门解读选择和主客依据沿用本次盘式', () => {
  for (const [scope, selectionLabel] of [
    ['year', '流年/年计'],
    ['month', '流月/月计'],
  ] as const) {
    const data = generateQimen(new Date('2026-08-08T15:14:00+08:00'), 'zhuanpan', scope);
    const prompt = buildDivinationPrompt({
      method: 'qimen',
      data,
      question: '整体解读',
      topicId: 'general',
      schools: ['zhuke'],
    });

    assert.match(prompt, /方法：占问 · 奇门遁甲/u);
    assert.ok(prompt.includes(`分析范围：${selectionLabel}`));
    assert.match(prompt, /结合本次主动干、值符值使和事项用神/u);
    assert.doesNotMatch(prompt, /时家奇门|结合日干、时干/u);
  }
});

test('npm 通用占法提示词保留求测人基本资料但不混入梅花设置', () => {
  const data = structuredClone(XIAOLIUREN_FIXED_CHART);
  const prompt = buildDivinationPrompt({
    method: 'xiaoliuren',
    data,
    question: '眼前事情如何推进？',
    supplementaryInfo: {
      gender: '女',
      birthYear: 1990,
      meihuaSettings: { method: 'number', number: 123 },
    },
  });

  assert.match(prompt, /【补充信息】\n求测人：女；出生年份：1990/);
  assert.doesNotMatch(prompt, /梅花起卦/);
});

test('npm 元学提示词入口应覆盖住宅类排盘', () => {
  const prompt = buildMetaphysicsPrompt(
    '【住宅风水排盘】\n坐山：子山，朝向：午向',
    '这个住宅的布局重点是什么？',
    { method: 'residential', measurement: '入户读数：0°' },
  );

  assert.match(prompt, /【传统依据】/);
  assert.match(prompt, /【测量换算】/);
  assert.match(prompt, /住宅风水/);
  assert.match(prompt, /这个住宅的布局重点是什么/);
  assert.match(prompt, /【任务】/);
});

test('当前时间公共格式化入口按北京时间处理 UTC 跨日', () => {
  const text = formatPromptCurrentTime(new Date('2026-08-06T23:30:00Z'));
  assert.match(text, /公历：2026年8月7日 7时30分（UTC\+08:00）/);
  assert.match(text, /^干支历：.+年 .+月 .+日 .+时$/m);
});

test('npm 提示词格式化适配器应覆盖时间、补充资料和通用分段', () => {
  const time = buildTimeInfoText({ timestamp: Date.parse('2026-08-06T12:30:00+08:00') } as never);
  assert.match(time, /节气：/);
  const supplementaryText = formatSupplementaryInfoSection('meihua', {
    gender: '女',
    birthYear: 1990,
    meihuaSettings: { method: 'number', number: 123 },
    currentSituation: '正在考虑换工作',
  });
  assert.equal(supplementaryText, '求测人：女；出生年份：1990\n当前情况：正在考虑换工作');
  assert.doesNotMatch(supplementaryText, /起卦方式|起卦数字/);
  assert.equal(buildSection('标题', '内容'), '标题\n内容');
  assert.equal(buildSection('标题', '  '), '');
});
