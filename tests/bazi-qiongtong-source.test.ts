import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { getBaziQiongtongAdvice } from 'mingyu-core/classics';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer';
import { MingluPatternUsefulGodSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPatternUsefulGodSection';

test('《穷通宝鉴》调候资料按原文校正取用先后', () => {
  assert.deepEqual(getBaziQiongtongAdvice('乙', '卯')?.primaryGods, ['丙', '癸']);
  assert.deepEqual(getBaziQiongtongAdvice('辛', '亥')?.primaryGods, ['壬', '丙']);
  assert.deepEqual(getBaziQiongtongAdvice('壬', '午')?.primaryGods, ['癸', '庚']);
  assert.deepEqual(getBaziQiongtongAdvice('癸', '卯')?.primaryGods, ['庚', '辛']);
  assert.deepEqual(getBaziQiongtongAdvice('癸', '巳')?.primaryGods, ['辛', '庚']);
});

test('乙酉条保留白露与秋分后的不同取用条件', () => {
  const entry = getBaziQiongtongAdvice('乙', '酉');
  assert.ok(entry);
  assert.match(entry.classicVerse, /白露之后.*耑用癸水/u);
  assert.match(entry.classicVerse, /秋分后.*宜用丙，癸水次之/u);
  assert.match(entry.seasonSummary, /秋分前.*秋分后/u);
  assert.match(entry.modernExplanation, /白露后.*秋分后/u);
  assert.equal(getBaziQiongtongAdvice('乙', '申'), undefined);
});

test('丙子引文保留壬戊原文且不再列甲为通用取用', () => {
  const entry = getBaziQiongtongAdvice('丙', '子');
  assert.ok(entry);
  assert.equal(entry.classicVerse, '十一月丙火，冬至一阳生，弱中复强，壬水为最，戊土佐之。');
  assert.deepEqual(entry.primaryGods, ['壬', '戊']);
});

test('命录调候释义补充取用作用，甲巳原文只展示一次', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 19,
    timeIndex: 5,
    gender: 'male',
    useTrueSolarTime: false,
  });
  const section = buildEnhancedPatternUsefulGodSection(result);
  const entry = getBaziQiongtongAdvice('甲', '巳')!;
  assert.equal(section.qiongtongAdvice?.summary, entry.modernExplanation);
  assert.deepEqual(section.qiongtongAdvice?.quotes, [entry.classicVerse]);
  const html = renderToStaticMarkup(
    createElement(MingluPatternUsefulGodSection, { data: section }),
  );
  assert.equal(html.split(entry.classicVerse).length - 1, 1);
  assert.ok(html.includes(entry.modernExplanation));
});
