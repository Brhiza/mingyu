import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildEnhancedAstrolabeSection } from '../packages/core/src/minglu/astrolabe-enhancer.ts';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';
import {
  buildAstrolabePromptDocument,
  formatAstrolabeForPrompt,
} from '../packages/core/src/prompt/astrolabe.ts';
import { MingluAstrolabeSection } from '../src/pages/ResultPage/components/MingluWiki/MingluAstrolabeSection.tsx';

test('占星元素与模式占比以十大星体计数，并在界面和提示词中明确口径', () => {
  const chart = generateAstrolabe({
    name: '占星分布统计核验',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });
  const section = buildEnhancedAstrolabeSection(chart);
  const planetCount = Object.values(chart.summary.elements).reduce(
    (sum, members) => sum + members.length,
    0,
  );

  assert.ok(chart.planets.length > 10, '盘面含十大星体以外的扩展计算点');
  assert.equal(planetCount, 10);
  assert.equal(
    Object.values(chart.summary.modalities).reduce((sum, members) => sum + members.length, 0),
    10,
  );
  for (const distribution of [section.distributions.elements, section.distributions.modalities]) {
    assert.equal(
      Object.values(distribution).reduce((sum, item) => sum + item.percentage, 0),
      100,
    );
    for (const item of Object.values(distribution)) {
      assert.equal(item.percentage, Number(((item.count / 10) * 100).toFixed(1)));
    }
  }

  const html = renderToStaticMarkup(createElement(MingluAstrolabeSection, { data: section }));
  assert.match(html, /四元素与三形态星体统计/u);
  assert.match(html, /按太阳至冥王星十颗本命星体逐颗计数/u);
  assert.match(html, /四元素星体数占比/u);
  assert.match(html, /三形态星体数占比/u);
  assert.doesNotMatch(html, /能量比例|能量分布/u);

  const prompt = formatAstrolabeForPrompt(chart);
  assert.match(
    prompt,
    /元素与模式分布口径：按太阳至冥王星十颗本命星体逐颗归类，每颗星体计作一个成员/u,
  );
  assert.match(prompt, /元素分布（十大星体）：/u);
  assert.match(prompt, /模式分布（十大星体）：/u);

  const originalChart = structuredClone(chart);
  const originalSection = structuredClone(section);
  const originalDistributions = originalSection.distributions;
  const originalMarkup = html;
  const originalTaskbook = buildAstrolabePromptDocument({
    chart,
    question: '核对元素与模式统计',
    currentTime: new Date('2026-10-04T00:00:00.000Z'),
  }).text;
  assert.match(originalTaskbook, /【星盘资料】/u);
  assert.match(originalTaskbook, /【任务】/u);
  assert.match(originalTaskbook, /元素分布（十大星体）：/u);
  assert.match(originalTaskbook, /模式分布（十大星体）：/u);

  section.distributions.elements.火.points.push('污染元素点');
  section.distributions.modalities.固定.points.push('污染形态点');
  assert.deepEqual(chart, originalChart);

  const freshSection = buildEnhancedAstrolabeSection(chart);
  assert.deepEqual(freshSection, originalSection);
  assert.deepEqual(freshSection.distributions, originalDistributions);
  const freshMarkup = renderToStaticMarkup(
    createElement(MingluAstrolabeSection, { data: freshSection }),
  );
  assert.equal(freshMarkup, originalMarkup);
  assert.doesNotMatch(freshMarkup, /污染元素点|污染形态点/u);
  assert.equal(formatAstrolabeForPrompt(chart), prompt);
  const freshTaskbook = buildAstrolabePromptDocument({
    chart,
    question: '核对元素与模式统计',
    currentTime: new Date('2026-10-04T00:00:00.000Z'),
  }).text;
  assert.equal(freshTaskbook, originalTaskbook);
  assert.match(freshTaskbook, /【任务】[\s\S]*核对元素与模式统计/u);

  const sparse = {
    ...chart,
    summary: {
      ...chart.summary,
      elements: { 火: ['太阳'], 土: [], 风: [], 水: [] },
      modalities: { 开创: [], 固定: ['太阳'], 变动: [] },
    },
  };
  const sparsePrompt = formatAstrolabeForPrompt(sparse);
  assert.match(sparsePrompt, /^元素分布（十大星体）：火太阳$/mu);
  assert.match(sparsePrompt, /^模式分布（十大星体）：固定太阳$/mu);
  sparse.summary.elements.火 = [];
  sparse.summary.modalities.固定 = [];
  assert.doesNotMatch(formatAstrolabeForPrompt(sparse), /元素与模式分布口径|元素分布|模式分布/u);
});
