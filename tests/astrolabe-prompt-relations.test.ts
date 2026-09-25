import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import {
  formatAstrolabeAspectLine,
  formatAstrolabeAspectSections,
} from '../packages/core/src/divination/astrolabe-chart-facts';
import { formatAstrolabeForPrompt } from '../packages/core/src/prompt/astrolabe';
import { buildAstrolabeSynastryPrompt } from '../packages/core/src/prompt/astrolabe';
import { analyzeAstrolabeSynastry } from '../packages/core/src/divination/astrolabe-synastry';
import { buildInstantAstrolabePrompt } from '../src/lib/instant-prompt';
import { generateDivinationSession } from '../packages/core/src/divination/session';

test('倍五分相在普通、双盘与即时提示词中只呈现中文关系和角度', () => {
  const birth = {
    name: '样本',
    gender: '女',
    year: '1993',
    month: '4',
    day: '8',
    hour: '23',
    minute: '34',
    latitude: '1.3521',
    longitude: '103.8198',
    timezone: '8',
  };
  const chart = generateAstrolabe(birth);
  const aspect = chart.aspects.find((item) => item.symbol === 'bQ');
  assert.ok(aspect);
  assert.equal(aspect.type, '倍五分相');
  const line = formatAstrolabeAspectLine(aspect, [...chart.planets, ...chart.angles]);
  assert.match(line, /：倍五分相，目标角144°，实际角距/);
  assert.doesNotMatch(line, /bQ/);

  const synastry = analyzeAstrolabeSynastry(chart, chart);
  for (const prompt of [
    formatAstrolabeForPrompt(chart),
    buildAstrolabeSynastryPrompt({ chart1: chart, chart2: chart, synastry }),
    buildInstantAstrolabePrompt(chart, '请解读当前情况', '当地钟表时间'),
  ]) {
    assert.ok(prompt.includes(line));
    assert.doesNotMatch(prompt, /bQ/);
  }

  const session = generateDivinationSession({
    method: 'astrolabe',
    question: '请分析当前情况',
    astrolabe: birth,
  });
  assert.ok(session.summary.lines.join('\n').includes('倍五分相'));
  assert.match(session.aiPrompt, /星体：太阳/);
  assert.match(session.aiPrompt, /四轴：上升/);
  assert.match(session.aiPrompt, /相位：[^\n]*倍五分相，偏差/);
  assert.doesNotMatch(session.aiPrompt, /bQ|\bSun\b|\bAscendant\b/);
  assert.doesNotMatch(session.prompt, /bQ/);
  assert.equal(
    (session.data as typeof chart).aspects.find((item) => item.type === '倍五分相')?.symbol,
    'bQ',
  );
});

test('真实星盘相位将跨星座合相的位置与角距偏差分别给出', () => {
  const chart = generateAstrolabe({
    name: '事件',
    gender: '女',
    year: '2026',
    month: '5',
    day: '19',
    hour: '10',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
  });
  const points = [...chart.planets, ...chart.angles];
  const sun = chart.planets.find((point) => point.name === 'Sun')!;
  const mercury = chart.planets.find((point) => point.name === 'Mercury')!;
  const aspect = chart.aspects.find(
    (item) =>
      [item.body1, item.body2].includes(sun.label) &&
      [item.body1, item.body2].includes(mercury.label),
  )!;
  assert.ok(aspect);
  assert.equal(aspect.type, '合相');
  assert.notEqual(sun.sign, mercury.sign);
  const raw = Math.abs(sun.longitude - mercury.longitude);
  const angle = Math.min(raw, 360 - raw);
  assert.ok(Math.abs(angle - aspect.actualAngle!) < 0.01);
  assert.ok(Math.abs(angle - aspect.orb) < 0.01);
  const line = formatAstrolabeAspectLine(aspect, points);
  assert.ok(line.includes(sun.formatted));
  assert.ok(line.includes(mercury.formatted));
  assert.match(line, /跨星座/);
  assert.match(line, /目标角0°，实际角距[\d.]+°，偏差[\d.]+°，容许偏差上限/);
  assert.ok(formatAstrolabeForPrompt(chart).includes(line));
  for (const point of chart.angles) {
    assert.ok(formatAstrolabeForPrompt(chart).includes(`${point.label}：${point.formatted}`));
  }
  assert.ok(formatAstrolabeAspectSections(chart.aspects, points).join('\n').includes(line));
  const prompts = [
    [formatAstrolabeForPrompt(chart), 1],
    [
      buildAstrolabeSynastryPrompt({
        chart1: chart,
        chart2: chart,
        synastry: analyzeAstrolabeSynastry(chart, chart),
      }),
      2,
    ],
  ] as const;
  for (const [prompt, natalChartCount] of prompts) {
    assert.match(prompt, /相位主线：[^\n]*太阳与水星：合相/);
    assert.equal(prompt.split(line).length - 1, natalChartCount);
    for (const headline of prompt.match(/^相位主线：.*$/gm) ?? []) {
      assert.doesNotMatch(headline, /实际角距|容许偏差上限|第\d+宫/);
    }
  }
});

test('相位保留已知入相出相，未知时不补造阶段', () => {
  for (const applying of [true, false, null]) {
    const line = formatAstrolabeAspectLine({
      body1: '太阳',
      body2: '水星',
      type: '合相',
      symbol: '☌',
      orb: 3.32,
      applying,
    });
    if (applying === null) assert.doesNotMatch(line, /入相|出相/);
    else assert.ok(line.includes(applying ? '入相' : '出相'));
  }
});

test('四轴的零宫位占位值不作为实际宫位输出', () => {
  const line = formatAstrolabeAspectLine(
    { body1: '上升', body2: '天顶', type: '刑相', symbol: '□', orb: 1, applying: null },
    [
      {
        name: 'Ascendant',
        label: '上升',
        longitude: 0,
        sign: '白羊座',
        degree: 0,
        minute: 0,
        house: 0,
        formatted: '白羊座0°00′',
      },
      {
        name: 'Midheaven',
        label: '天顶',
        longitude: 91,
        sign: '巨蟹座',
        degree: 1,
        minute: 0,
        house: 0,
        formatted: '巨蟹座1°00′',
      },
    ],
  );
  assert.match(line, /白羊座0°00′/);
  assert.match(line, /巨蟹座1°00′/);
  assert.doesNotMatch(line, /第0宫|同宫|异宫/);
});

test('旧相位缺少角距和上限时只输出已有偏差，不补造角度与位置', () => {
  const line = formatAstrolabeAspectLine({
    body1: '太阳',
    body2: '水星',
    type: '合相',
    symbol: '☌',
    orb: 3.32,
    applying: null,
  });
  assert.match(line, /偏差3\.32°/);
  assert.doesNotMatch(line, /目标角|实际角距|上限|第\d+宫|同星座|跨星座/);
});
