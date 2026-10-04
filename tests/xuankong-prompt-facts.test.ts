import assert from 'node:assert/strict';
import test from 'node:test';
import { generateXuanKong } from '../packages/core/src/xuan_kong/index.ts';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';
import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';
import { assertPromptHasSingleRole } from './prompt-assertions';

const nineYunWuChart = generateXuanKong({ year: 2024, sitMountain: '午' });
const nineYunWuMonthlyChart = generateXuanKong({
  year: 2024,
  sitMountain: '午',
  flowYear: 2026,
  flowMonth: 5,
  flowDay: 19,
});

test('九运玄空正文明确星数五行与山向运的生克施受', () => {
  const result = structuredClone(nineYunWuChart);
  assert.match(
    result.prompt,
    /运5（土，暂按9运煞气） 山9（火，暂按9运当运） 向9（火，暂按9运当运）/,
  );
  assert.match(result.prompt, /山星9火生运星5土/);
  assert.match(result.prompt, /向星9火生运星5土/);
  assert.match(result.prompt, /山向生入：向星2土生山星7金/);
  assert.match(result.prompt, /山向克入：向星8土克山星1水/);
  assert.match(result.prompt, /运8（土，暂按9运退气）/);
  assert.match(result.prompt, /【任务】[\s\S]*【盘面资料】[\s\S]*【传统依据】/);
  assert.doesNotMatch(result.prompt, /流年|流月|五黄落宫：|本次资料层级：/);
});

test('玄空提示词只列起法与盘面，不夹带输入过程说明', () => {
  const defaultChart = generateXuanKong({ year: 2024, sitMountain: '子' });
  const replacementChart = generateXuanKong({ year: 2008, sitMountain: '壬', guaType: '替卦' });
  assert.match(defaultChart.prompt, /卦型：下卦/);
  assert.match(replacementChart.prompt, /卦型：替卦/);
  for (const chart of [defaultChart, replacementChart]) {
    assert.doesNotMatch(chart.prompt, /输入明确指定|未指定卦型|由调用方核定/);
    assert.doesNotMatch(chart.evidenceAnalysis.promptText, /输入明确指定|未指定卦型|由调用方核定/);
  }
});

test('玄空年盘月盘仅随实际计算结果加入正文与各宫', () => {
  const yearly = generateXuanKong({ year: 2024, sitMountain: '午', flowYear: 2026 });
  assert.match(yearly.prompt, /流年飞星：/);
  assert.doesNotMatch(yearly.prompt, /流月/);
  assert.doesNotMatch(JSON.stringify(yearly.evidenceAnalysis.limitationFacts), /流月/);
  const monthly = structuredClone(nineYunWuMonthlyChart);
  assert.match(monthly.prompt, /流年飞星：[\s\S]*流月飞星：/);
  assert.equal(monthly.flowStars?.yearPlate.centerStar, 1);
  assert.deepEqual([...monthly.plates.year!].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const center = monthly.prompt.split('\n').find((line) => line.startsWith('中五（中）：'))!;
  assert.match(center, /年1（水）/);
  assert.doesNotMatch(monthly.prompt, /宅盘与流年流月逐宫叠加|五黄落宫：/);
});

test('玄空证据提示词复用完整盘面，不重复来源与格局说明', () => {
  const result = structuredClone(nineYunWuMonthlyChart);
  assert.equal(result.evidenceAnalysis.promptText, result.prompt);
  assert.doesNotMatch(result.prompt, /来源：|@soul-atelier|mingyu-core|tyme4ts|项目|已登记组合/);
  assert.doesNotMatch(result.prompt, /主突发灾祸|破败|影响财富、事业、名声/);
  assert.equal(result.prompt.split('三盘九宫：').length - 1, 1);
  assert.equal(result.prompt.split('局型：').length - 1, 1);
  assert.ok(result.evidenceAnalysis.facts.some((item) => item.key === 'xuankong:fact:formation'));
  assert.ok(result.evidenceAnalysis.sources.some((item) => item.role === '公共算法来源'));
});

test('玄空在线任务书沿用盘面任务与传统依据，不二次追加通用段落', () => {
  const result = structuredClone(nineYunWuChart);
  const extractTraditionalBody = (text: string) => {
    const headingStart = text.search(/^【传统依据】$/m);
    if (headingStart < 0) return '';

    const headingEnd = text.indexOf('\n', headingStart);
    if (headingEnd < 0) return '';

    const bodyStart = headingEnd + 1;
    const nextHeadingStart = text.indexOf('\n【', bodyStart);
    return text.slice(bodyStart, nextHeadingStart < 0 ? undefined : nextHeadingStart).trim();
  };
  const originalTradition = extractTraditionalBody(result.prompt);
  assert.match(originalTradition, /\S/, '真实玄空盘应带有非空传统依据');

  const prompt = buildMetaphysicsPrompt(result.prompt, '这套宅的飞星怎么看？', {
    method: 'xuankong',
    currentTime: new Date('2026-05-19T04:00:00Z'),
  });
  assertPromptHasSingleRole(prompt);
  const wrappedTradition = extractTraditionalBody(prompt);
  assert.equal(wrappedTradition, originalTradition, '在线包装应完整保留真实盘面的传统依据');
  for (const heading of ['【任务】', '【传统依据】', '【当前时间】', '【问题】']) {
    assert.equal(prompt.split(heading).length - 1, 1, `${heading}不应重复`);
  }
  assert.match(prompt, /【问题】\n这套宅的飞星怎么看？$/);
  assert.doesNotMatch(prompt, /@soul-atelier|mingyu-core|tyme4ts|来源：/);
});

test('玄空命中组合集中列出实际宫位', () => {
  const result = structuredClone(nineYunWuChart);
  assert.ok(result.combinations.length > 0);
  const line = result.prompt.split('\n').find((item) => item.startsWith('组合：'))!;
  for (const combo of result.combinations) {
    assert.ok(line.includes(combo.name));
    for (const gong of combo.palaces ?? []) {
      const palace = result.palaces.find((item) => item.gong === gong)!;
      assert.ok(line.includes(`${palace.name}${palace.direction}`));
    }
  }
  assert.doesNotMatch(result.prompt, /；组合|组合：未检出/);
});

test('旺山旺向只列一次成立条件，替卦到山到向例外仍明确显示', () => {
  const wang = generateXuanKong({ year: 1974, sitMountain: '壬', guaType: '替卦' });
  assert.equal(wang.formation, '旺山旺向');
  assert.equal(wang.daoShanXiang.shanToMountain, true);
  assert.equal(wang.daoShanXiang.xiangToFacing, true);
  assert.match(wang.prompt, /局型：旺山旺向/);
  assert.doesNotMatch(wang.prompt, /到山到向：本宅运星到山且到向/);

  const exception = generateXuanKong({ year: 1930, sitMountain: '甲', guaType: '替卦' });
  assert.equal(exception.formation, '替卦到山到向未成旺局');
  assert.equal(exception.daoShanXiang.shanToMountain, true);
  assert.equal(exception.daoShanXiang.xiangToFacing, true);
  assert.match(exception.prompt, /局型：替卦到山到向未成旺局/);
  assert.match(exception.prompt, /到山到向：本宅运星到山且到向/);
});

test('住宅合参保留玄空原生星性与关系而非另行补写', () => {
  const result = generateResidentialFengshui({ year: 2024, sitMountain: '子' });
  assert.ok(result.xuankong);
  const chartLines = result.xuankong.prompt
    .split('【盘面资料】\n')[1]
    .split('\n')
    .filter((item) => !/^【.+】$/.test(item));
  for (const line of chartLines) {
    assert.ok(result.prompt.includes(line.trim()), `住宅正文缺少玄空资料：${line}`);
  }
  assert.match(result.prompt, /山向克出：山星8土克向星1水/);
  assert.match(result.prompt, /运8（土，暂按9运退气）/);
});
