import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator, buildFortuneSelectionContext } from 'mingyu-core/bazi';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import {
  buildBaziZiweiPrompt,
  buildBaziCompatibilityPrompt,
  buildBaziPrompt,
  buildDivinationPrompt,
  buildMetaphysicsPrompt,
  formatDetailedDivinationInfo,
  formatDivinationTime,
  buildZiweiCompatibilityPrompt,
  buildZiweiTaskBookPrompt,
  formatDivinationInfo,
  formatEnhancedDivinationInfo,
  formatBaziFortuneSelection,
  formatPromptCurrentTime,
  buildSection,
  buildTimeInfoText,
  formatSupplementaryInfoSection,
  getDivinationSummaryBlocks,
} from 'mingyu-core/prompt';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei/runtime';

function createChart(gender: 'male' | 'female', day: number) {
  return baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day,
    timeIndex: 5,
    gender,
  });
}

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
  assert.doesNotMatch(prompt, /该流年包含的流月/);
  assert.doesNotMatch(prompt, /交节时刻/);

  const sections = formatBaziFortuneSelection(context);
  assert.ok(sections);
  assert.match(sections.analysisObject, new RegExp(String(year.year)));
  assert.match(sections.focus, /选择日期：/);
  assert.match(sections.focus, /上层岁运：/);
  assert.match(sections.focus, /所选干支：/);
  assert.match(sections.focus, /主要触发：/);
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
  assert.doesNotMatch(info, /顺数轨迹/);
  assert.match(prompt, /依据占得宫与歌诀/);
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

test('npm 通用占法提示词不混入未参与排盘的个人字段和梅花设置', () => {
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

  assert.doesNotMatch(prompt, /【补充信息】|性别：女|出生年份：1990|梅花起卦/);
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
  assert.equal(supplementaryText, '当前情况：正在考虑换工作');
  assert.doesNotMatch(supplementaryText, /起卦方式|起卦数字/);
  assert.doesNotMatch(supplementaryText, /性别|出生年份/);
  assert.equal(buildSection('标题', '内容'), '标题\n内容');
  assert.equal(buildSection('标题', '  '), '');
});

test('npm 提示词入口应覆盖紫微任务书、紫微合盘和八字紫微联合资料', async () => {
  const draft = {
    name: '提示词样例',
    gender: 'female',
    dateType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 4,
    isLeapMonth: false,
  } as const;
  const input = buildZiweiChartInput(draft);
  const first = await calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  });
  const second = await calculateZiweiChart(buildZiweiChartInput({ ...draft, name: '另一人' }), {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  });
  const taskBook = buildZiweiTaskBookPrompt({
    runtime: first,
    topic: 'career-wealth',
    focusPalaceNames: ['命宫', '官禄'],
  });
  const compatibility = buildZiweiCompatibilityPrompt({
    payload1: first.payloadByScope.origin,
    payload2: second.payloadByScope.origin,
    topic: 'relationship',
    schools: ['sanhe', 'feixing', 'sihua'],
  });
  const baziZiwei = buildBaziZiweiPrompt({
    bazi: createChart('female', 15),
    ziwei: first,
    topic: '事业财运',
    baziSchools: ['ziping', 'mangpai', 'xinpai'],
    ziweiSchools: ['sanhe', 'feixing', 'sihua'],
  });

  assert.match(taskBook, /【任务】/);
  assert.match(taskBook, /事业财运/);
  assert.match(compatibility, /【双盘关系资料】/);
  assert.match(compatibility, /【多派合参】/);
  assert.match(baziZiwei, /【八字盘面资料】/);
  assert.match(baziZiwei, /【紫微盘面资料】/);
  assert.match(baziZiwei, /【八字多派合参】/);
  assert.match(baziZiwei, /【紫微多派合参】/);
});
