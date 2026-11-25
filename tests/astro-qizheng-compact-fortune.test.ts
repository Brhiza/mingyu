import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { methodExamples } from '../scripts/method-examples.mjs';
import { getYearSixtyCycle } from '../src/systems/ganzhi-foundation';

const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function extractSection(text: string, header: string): string {
  const marker = `${header}\n`;
  const idx = text.indexOf(marker);
  assert.ok(idx >= 0, `缺少区块 ${header}`);
  const rest = text.slice(idx + marker.length);
  const nextIdx = rest.indexOf('\n\n【');
  return (nextIdx >= 0 ? rest.slice(0, nextIdx) : rest).trim();
}

test('西洋星盘原生输出超紧凑 2 行小限年运块，支持 Annual Profection 与推运附注', async () => {
  const birth = { year: 1992, month: 6, day: 15, hour: 10, minute: 30, latitude: 31.23, longitude: 121.47, timezone: 8 };
  const natal = await calculate('astrolabe', {
    birth,
    question: '我2026年事业和感情怎么样？',
  });
  const block = extractSection(natal.prompt.text, '【小限与年运窗口（压平精要）】');
  const lines = block.split('\n');
  assert.equal(lines.length, 2, '小限与年运窗口应严格为 2 行');
  assert.ok(block.length >= 80 && block.length <= 260, `区块长度应紧凑（实际 ${block.length}）`);
  assert.equal(ISO_RE.test(block), false, '压平小限块不应包含 ISO 时间戳');

  // 1992年生在2026年为34周岁，34 % 12 + 1 = 11 宫；2025年33岁为10宫，2027年35岁为12宫
  const h10 = natal.data.houses[9];
  const h11 = natal.data.houses[10];
  const h12 = natal.data.houses[11];
  assert.ok(lines[0].includes(`2025(33岁·10宫${h10.sign}·年主`), lines[0]);
  assert.ok(lines[0].includes(`2026(34岁·11宫${h11.sign}·年主`), lines[0]);
  assert.ok(lines[0].includes(`2027(35岁·12宫${h12.sign}·年主`), lines[0]);
  assert.match(lines[1], /^当前年主：/);
  assert.ok(lines[1].includes('未附行运快照'));

  // 追问未来五年应自动扩窗至 5 年且不破坏 reprompt 校验
  const fiveYear = await reprompt({
    method: 'astrolabe',
    result: JSON.parse(JSON.stringify(natal)),
    question: '未来五年事业走势如何？',
  });
  const fiveBlock = extractSection(fiveYear.prompt.text, '【小限与年运窗口（压平精要）】');
  const yearItems = fiveBlock.split('\n')[0].replace(/^小限年运：/, '').split('｜');
  assert.equal(yearItems.length, 5, '未来五年提问应输出 5 个目标年份');
  assert.equal(ISO_RE.test(fiveBlock), false);

  // 带推运快照时，以推运参考年为准并在第 2 行附注行运焦点
  const withFlow = await calculate('astrolabe', {
    birth,
    question: '今年运势如何？',
    flow: { reference: { kind: 'year', year: 2026 }, techniques: ['transit'] },
  });
  const flowBlock = extractSection(withFlow.prompt.text, '【小限与年运窗口（压平精要）】');
  const flowLines = flowBlock.split('\n');
  assert.equal(flowLines.length, 2);
  assert.ok(flowLines[0].includes('2026(34岁·11宫') && flowLines[0].includes('·当前)'), flowLines[0]);
  assert.match(flowLines[1], /行运焦点：|行运快照已附/);
  assert.equal(ISO_RE.test(flowBlock), false);
});

test('七政四余原生输出超紧凑 2 行行限与流年小限块，含精准干支与恩用仇难标注', async () => {
  const birth = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, latitude: 39.9, longitude: 116.4, timezone: 8 };
  const natal = await calculate('qizheng', {
    birth,
    question: '我2026年到2028年事业财运走势？',
  });
  const block = extractSection(natal.prompt.text, '【行限与流年小限（压平精要）】');
  const lines = block.split('\n');
  assert.equal(lines.length, 2, '七政行限压平块应严格为 2 行');
  assert.ok(block.length >= 90 && block.length <= 260, `区块长度应紧凑（实际 ${block.length}）`);
  assert.equal(ISO_RE.test(block), false, '压平小限块不应包含 ISO 时间戳');
  assert.match(lines[0], /^洞微大限：/);
  assert.match(lines[1], /^流年小限：/);

  // 1990年生：2026年37虚岁 -> (37-1)%12 = 0 (命宫)，2027年38虚岁 -> 1 (财帛)
  const p0 = natal.data.twelvePalaces[0];
  const p1 = natal.data.twelvePalaces[1];
  assert.ok(lines[1].includes(`2026${getYearSixtyCycle(2026)}(37虚岁·小限${p0.signBranch}${p0.palace}·主星`), lines[1]);
  assert.ok(lines[1].includes(`2027${getYearSixtyCycle(2027)}(38虚岁·小限${p1.signBranch}${p1.palace}·主星`), lines[1]);
  assert.match(lines[1], /\[(恩|用|仇|难|命主|比)\]/);

  // 带 flow + gender 时，直接压平标出当前洞微大限与太岁，且支持 reprompt
  const withFlow = await calculate('qizheng', {
    birth,
    gender: 'male',
    flow: { kind: 'year', year: 2026 },
    question: '今年整体运势如何？',
  });
  const flowBlock = extractSection(withFlow.prompt.text, '【行限与流年小限（压平精要）】');
  const flowLines = flowBlock.split('\n');
  assert.equal(flowLines.length, 2);
  assert.ok(flowLines[0].includes(`洞微大限：${withFlow.data.timeLords!.nominalAge}虚岁行${withFlow.data.timeLords!.dongweiStandard.activeLimit.signBranch}宫${withFlow.data.timeLords!.dongweiStandard.activeLimit.palace}`), flowLines[0]);
  assert.ok(flowLines[0].includes(`流年太岁${withFlow.data.timeLords!.annualBranch}入${withFlow.data.timeLords!.annualPalace.palace}`), flowLines[0]);
  assert.equal(ISO_RE.test(flowBlock), false);

  const follow = await reprompt({
    method: 'qizheng',
    result: JSON.parse(JSON.stringify(withFlow)),
    question: '2029年和2030年怎么样？',
  });
  const followBlock = extractSection(follow.prompt.text, '【行限与流年小限（压平精要）】');
  assert.ok(followBlock.includes(`2029${getYearSixtyCycle(2029)}`), followBlock);
  assert.ok(followBlock.includes(`2030${getYearSixtyCycle(2030)}`), followBlock);
});

test('八字默认精简模式无损去重瘦身，保留全部核心标题与盘面事实，完整模式不受影响', async () => {
  const input = { ...methodExamples.bazi, question: '我2026年事业运势如何？' };
  const compact = await calculate('bazi', input);
  const full = await calculate('bazi', { ...input, prompt: { detailMode: 'full' } });

  // 默认模式应显著短于完整模式（瘦身超 10%，且无损保留全部标题与盘面事实）
  assert.ok(compact.prompt.text.length < full.prompt.text.length * 0.75, `默认模式(${compact.prompt.text.length})应显著短于完整模式(${full.prompt.text.length})`);
  assert.ok(compact.prompt.text.length < 4950, `默认八字提示词应完成 10%–20% 瘦身（当前 ${compact.prompt.text.length} 字）`);

  for (const heading of [
    '【八字命盘】',
    '【四柱】',
    '【本命神煞（56项）】',
    '【本命结构】',
    '【通根与月令透干】',
    '【日主旺衰条件模型】',
    '【普通月令取格候选】',
    '【已迁移路线的格局排序】',
    '【格局组合与互制关系】',
    '【格局透干与根气条件】',
    '【取用基础取向】',
    '【调候条件候选】',
    '【调候条件协调】',
    '【司权、病药与通关候选】',
    '【用神裁定与落位】',
    '【十神分布】',
    '【大运】',
    '【岁运动态与格局引动（压平精要）】',
    '【指定时刻岁运】',
    '【岁运神煞】',
  ]) {
    assert.ok(compact.prompt.text.includes(heading), `默认模式缺少标题 ${heading}`);
  }

  // 默认模式已去除中段重复的冗长 limitation 套话
  for (const redundant of [
    '不同文献的分日口径可能不同',
    '不可单凭命中推断现实结果',
    '不可直接作为最终用神',
    '不是最终用神',
    '不替换本命年柱',
  ]) {
    assert.equal(compact.prompt.text.includes(redundant), false, `默认模式不应保留重复套话：${redundant}`);
    assert.equal(full.prompt.text.includes(redundant), true, `完整模式应保留明细说明：${redundant}`);
  }

  // 追问重算校验正常
  const follow = await reprompt({
    method: 'bazi',
    result: JSON.parse(JSON.stringify(compact)),
    question: '2027年财运如何？',
  });
  assert.ok(follow.prompt.text.includes('2027丁未'));
});
