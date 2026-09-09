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
  formatPromptCurrentTime,
  buildSection,
  buildTimeInfoText,
  formatSupplementaryInfoSection,
  getDivinationSummaryBlocks,
} from 'mingyu-core/prompt';

function createChart(gender: 'male' | 'female', day: number) {
  return baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day,
    timeIndex: 5,
    gender,
  });
}

test('八字五行方向随日主转换十神参照并保留生泄和克的方向', () => {
  const expectedRoles: Record<string, string[]> = {
    木: ['日主、比劫', '食伤', '财星', '官杀', '印星'],
    火: ['印星', '日主、比劫', '食伤', '财星', '官杀'],
    土: ['官杀', '印星', '日主、比劫', '食伤', '财星'],
    金: ['财星', '官杀', '印星', '日主、比劫', '食伤'],
    水: ['食伤', '财星', '官杀', '印星', '日主、比劫'],
  };
  const elements = ['木', '火', '土', '金', '水'];
  const seen = new Set<string>();
  for (let day = 1; day <= 10; day++) {
    const chart = createChart('female', day);
    seen.add(chart.dayMaster.element);
    const prompt = buildBaziPrompt({ result: chart, fortuneScope: 'natal' });
    const section = prompt.split('【五行作用方向】')[1].split('【核心判断】')[0];
    const labels = expectedRoles[chart.dayMaster.element].map((role, i) => `${role}${elements[i]}`);
    for (let i = 0; i < 5; i++) {
      const source = labels[i];
      const generated = labels[(i + 1) % 5];
      const controlled = labels[(i + 2) % 5];
      assert.ok(section.includes(`${source}生${generated}，${generated}泄${source}`));
      assert.ok(section.includes(`${source}克${controlled}`));
      assert.ok(!section.includes(`${generated}生${source}`));
      assert.ok(!section.includes(`${controlled}克${source}`));
    }
  }
  assert.equal(seen.size, 5);
});

test('npm 提示词入口应生成自包含的八字任务书', () => {
  const prompt = buildBaziPrompt({
    result: createChart('female', 15),
    topic: 'career',
    school: 'traditional',
    fortuneScope: 'full',
    question: '今年是否适合换工作？',
    currentTime: new Date('2026-08-06T12:30:00+08:00'),
  });

  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /【流派】/);
  assert.match(prompt, /【命限资料】/);
  assert.match(prompt, /今年是否适合换工作/);
  assert.match(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /API|MCP|仓库|项目名|工程上下文/);
});

test('npm 八字提示词入口应输出完整且有差异的盲派与新派资料', () => {
  const result = createChart('female', 15);
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

  assert.match(mangpai, /四柱宫位与十神落位/);
  assert.match(mangpai, /主宾定位/);
  assert.match(mangpai, /四柱组合与做功线索/);
  assert.match(mangpai, /透干通根/);
  assert.match(mangpai, /墓库与空亡/);
  assert.match(xinpai, /旺衰判定/);
  assert.match(xinpai, /十神结构/);
  assert.match(xinpai, /十神流通/);
  assert.match(xinpai, /喜忌落位/);
  assert.match(xinpai, /动态岁运/);
  assert.notEqual(mangpai, xinpai);
  assert.doesNotMatch(`${mangpai}\n${xinpai}`, /API|MCP|仓库|项目名|工程上下文/);
});

test('npm 八字提示词应保留指定岁运的上下层资料', () => {
  const result = createChart('female', 15);
  const cycle = result.luckInfo.cycles.find((item) => item.years.length > 0);
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
  assert.match(prompt, /该流年包含的流月/);
  assert.doesNotMatch(prompt, /交节时刻/);

  const sections = formatBaziFortuneSelection(context);
  assert.ok(sections);
  assert.match(sections.analysisObject, new RegExp(String(year.year)));
  assert.match(sections.focus, /选择日期：/);
  assert.match(sections.focus, /上层岁运：/);
  assert.match(sections.focus, /所选干支：/);
  assert.match(sections.focus, /主要触发：/);
  const boundaryContext = {
    ...context,
    cycleTimeRange: {
      ...context.cycleTimeRange,
      start: { year: 1997, month: 9, day: 21, hour: 3, minute: 4, second: 5 },
      end: { year: 2007, month: 9, day: 21, hour: 3, minute: 4, second: 5 },
    },
  };
  const boundary = formatBaziFortuneSelection(boundaryContext)!;
  assert.ok(boundary.focus.includes(`所选岁运背景：${context.cycleGanZhi}`));
  assert.match(boundary.focus, /1997年9月21日 03:04:05起，至2007年9月21日 03:04:05交接/);
  assert.match(boundary.focus, /起点归本运，终点归后续运段/);
  assert.ok(boundary.focus.includes(`该运交接年龄：${context.cycleAge}岁`));
});

test('八字岁运正文区分同干支冲、岁运并临与天克地冲，并保留流月流日身份', () => {
  const result = createChart('female', 15);
  const cycleIndex = result.luckInfo.cycles.findIndex((cycle) => cycle.years.length > 0);
  const context = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex,
    year: result.luckInfo.cycles[cycleIndex].years[0].year,
  });
  assert.ok(context);
  for (const [yearGanZhi, expected, excluded] of [
    ['癸酉', '地支相冲', '构成岁运并临|构成天克地冲|同柱伏吟'],
    ['癸卯', '构成岁运并临', '构成天克地冲'],
    ['丁酉', '构成天克地冲', '构成岁运并临|同柱伏吟'],
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
      .split('\n')
      .filter((line) => line.includes(`流年${yearGanZhi}与大运癸卯`))
      .join('\n');
    assert.match(pairLines, new RegExp(expected));
    assert.doesNotMatch(pairLines, new RegExp(excluded));
    if (yearGanZhi === '癸酉') assert.match(pairLines, /天干同干/);
    assert.match(focus, /流日甲申与节气流月甲寅天干同干/);
    assert.match(focus, /流日甲申与节气流月甲寅地支相冲/);
    assert.doesNotMatch(focus, /sourceLayerKey|已计算|反证事实|计算步骤|不得/);
  }
});

test('npm 提示词入口应生成八字双盘关系资料', () => {
  const prompt = buildBaziCompatibilityPrompt({
    result1: createChart('female', 15),
    result2: createChart('male', 20),
    compatibilityType: 'marriage',
    question: '双方适合长期共同生活吗？',
  });

  assert.match(prompt, /【第一人排盘信息】/);
  assert.match(prompt, /【第二人排盘信息】/);
  assert.match(prompt, /【双盘关系资料】/);
  assert.match(prompt, /双方适合长期共同生活吗/);
});

test('统一占法摘要应覆盖小六壬且不落回通用文案', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });
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
  assert.match(info, /定位用途：月宫.+用于确定初一的起数位置/);
  assert.ok(info.includes(`断事主证：时宫${data.primary.name}及其下列歌诀`));
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

  assert.match(liuyaoText, /用神：/);
  assert.match(liuyaoText, /月日触发：/);
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

test('npm 通用占法提示词保留求测人基本资料但不混入梅花设置', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });
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

test('当前时间公共格式化入口应包含公历和干支历', () => {
  const text = formatPromptCurrentTime(new Date('2026-08-06T12:30:00+08:00'));
  assert.match(text, /公历：/);
  assert.match(text, /干支历：/);
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
