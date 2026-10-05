import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import {
  BAZI_ZIPING_PATTERNS,
  getBaziZipingPatternAdvice,
} from '../packages/core/src/classics/bazi-ziping.ts';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer.ts';
import { MingluPatternUsefulGodSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPatternUsefulGodSection.tsx';

test('子平格局引文依论财、论印绶合论正偏的原典章节归属', () => {
  assert.equal(getBaziZipingPatternAdvice('偏财格')?.sourceBook, '子平真诠·论财');
  assert.equal(getBaziZipingPatternAdvice('偏印格')?.sourceBook, '子平真诠·论印绶');
  assert.equal(
    getBaziZipingPatternAdvice('正印格')?.verse,
    '印绶喜其生身，正偏同为美格，故财与印不分偏正，同为一格而论之。',
  );
  assert.equal(
    getBaziZipingPatternAdvice('七杀格')?.verse,
    '亦有煞重身轻，用食则身不能当，不若转而就印，虽不通根月令，亦为无情而有情。',
  );
  assert.match(getBaziZipingPatternAdvice('食神格')?.verse ?? '', /^食神本属泄气/);
  assert.match(getBaziZipingPatternAdvice('伤官格')?.verse ?? '', /查其气候，量其强弱/);
});

test('本局格名只映射同一原典格局，杂气取格不套普通格条文', () => {
  assert.equal(getBaziZipingPatternAdvice('建禄格')?.pattern, '建禄月劫格');
  assert.equal(getBaziZipingPatternAdvice('劫财格')?.pattern, '建禄月劫格');
  assert.equal(getBaziZipingPatternAdvice('月刃格')?.pattern, '阳刃格');
  assert.equal(getBaziZipingPatternAdvice('七杀格（身杀两停）')?.pattern, '七杀格');
  for (const pattern of ['杂气正官格', '杂气正财格', '杂气偏印格', '非正官格']) {
    assert.equal(getBaziZipingPatternAdvice(pattern), undefined, pattern);
  }

  const miscChart = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 12,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
  });
  assert.equal(miscChart.analysis.mingGe.pattern, '杂气正财格');
  assert.equal(buildEnhancedPatternUsefulGodSection(miscChart).zipingAdvice, undefined);

  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    useTrueSolarTime: false,
  });
  const withPattern = (pattern: string) =>
    buildEnhancedPatternUsefulGodSection({
      ...result,
      analysis: {
        ...result.analysis,
        mingGe: { ...result.analysis.mingGe, pattern },
      },
    });
  assert.equal(withPattern('建禄格').zipingAdvice?.title, '建禄格（参照建禄月劫格）');
});

test('命录格局将原文单独引用并保留格局条件和释义', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    useTrueSolarTime: false,
  });

  for (const entry of Object.values(BAZI_ZIPING_PATTERNS)) {
    const sample = {
      ...result,
      analysis: {
        ...result.analysis,
        mingGe: { ...result.analysis.mingGe, pattern: entry.pattern },
      },
    };
    const section = buildEnhancedPatternUsefulGodSection(sample);
    const advice = section.zipingAdvice;
    assert.ok(advice, entry.pattern);
    assert.deepEqual(advice.quotes, [entry.verse], entry.pattern);
    assert.ok(advice.summary.includes(entry.rule), entry.pattern);
    assert.ok(advice.summary.includes(entry.modernAdvice), entry.pattern);

    const html = renderToStaticMarkup(
      createElement(MingluPatternUsefulGodSection, { data: section }),
    );
    const blockquotes = [...html.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/g)].map(
      (match) => match[1],
    );
    assert.ok(
      blockquotes.some((quote) => quote.includes(entry.verse!)),
      entry.pattern,
    );
    assert.ok(
      blockquotes.every((quote) => !quote.includes(entry.rule)),
      entry.pattern,
    );
    assert.ok(html.includes(entry.rule), entry.pattern);
  }
});
