import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildMingluArticle } from '../packages/core/src/minglu/builder';
import {
  buildEnhancedFiveElementsSection,
  buildEnhancedPatternUsefulGodSection,
} from '../packages/core/src/minglu/bazi-enhancer';
import { MingluPatternUsefulGodSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPatternUsefulGodSection';
import { formatMingluPatternCopy } from '../src/pages/ResultPage/components/MingluWiki/minglu-copy';

for (const sample of [
  { label: '成化', year: 1994, month: 3, day: 17, timeIndex: 4, status: '成化' },
  { label: '存在反证', year: 1990, month: 9, day: 5, timeIndex: 6, status: '存在反证' },
] as const) {
  test(`${sample.label}盘的化气依据和条件只在命录格局卡片完整列出`, () => {
    const baziResult = baziCalculator.calculateBazi({
      year: sample.year,
      month: sample.month,
      day: sample.day,
      timeIndex: sample.timeIndex,
      gender: 'male',
      isLunar: false,
      useTrueSolarTime: false,
    });
    const transformation = baziResult.analysis.mingGe.transformation;
    assert.equal(transformation?.status, sample.status);
    assert.ok(transformation);
    assert.ok(transformation.evidence.length > 0);
    assert.ok(transformation.conditions.length > 0);

    const article = buildMingluArticle({
      person: { name: '化气核验', gender: 'male' },
      baziResult,
    });
    const { pattern } = article.patternUsefulGodSection;
    assert.equal(pattern.formationAnalysis, '');
    assert.deepEqual(pattern.transformation, transformation);
    const copiedPattern = formatMingluPatternCopy(article);
    assert.equal(copiedPattern.split(transformation.basis).length - 1, 1);
    for (const condition of transformation.conditions) {
      assert.equal(copiedPattern.split(condition).length - 1, 1);
    }
    if (sample.status === '成化') {
      assert.match(copiedPattern, /- 取用主体：化神木/);
      assert.match(copiedPattern, /- 原日主十神映射：食伤（本命事实）/);
      assert.doesNotMatch(copiedPattern, /- 核心用神：食伤/);
    } else {
      assert.match(copiedPattern, /- 核心用神：待判/);
      assert.doesNotMatch(copiedPattern, /- 原日主十神映射：/);
    }

    const html = renderToStaticMarkup(
      createElement(MingluPatternUsefulGodSection, { data: article.patternUsefulGodSection }),
    );
    assert.equal(html.split(transformation.basis).length - 1, 1);
    for (const evidence of transformation.evidence) {
      assert.equal(html.split(evidence).length - 1, 1);
    }
    for (const condition of transformation.conditions) {
      assert.equal(html.split(condition).length - 1, 1);
    }
    if (sample.status === '成化') {
      const usefulConditions =
        baziResult.analysis.usefulGod.decisionEvidence?.transformation?.conditions.filter(
          (condition) => !transformation.conditions.includes(condition),
        ) ?? [];
      assert.ok(usefulConditions.length > 0);
      for (const condition of usefulConditions) {
        assert.equal(html.split(condition).length - 1, 1);
      }
    }

    const guideAndSynthesis = [
      article.beginnerGuide?.strengthPlain,
      ...(article.beginnerGuide?.favorableHabitsPlain ?? []),
      ...(article.crossSynthesisSection ?? []).flatMap((theme) => theme.baziEvidence),
    ].join('\n');
    for (const fact of [
      transformation.basis,
      ...transformation.evidence,
      ...transformation.conditions,
    ]) {
      assert.equal(guideAndSynthesis.includes(fact), false, fact);
    }
    const careerEvidence =
      article.crossSynthesisSection?.find((theme) => theme.themeId === 'career-wealth')
        ?.baziEvidence ?? [];
    if (sample.status === '成化') {
      assert.match(article.beginnerGuide?.strengthPlain ?? '', /化神木为取用主体/);
      assert.ok(careerEvidence.includes(`成化取用以化神${transformation.element}为主体`));
    } else {
      assert.doesNotMatch(guideAndSynthesis, /成化取用以化神/);
      assert.doesNotMatch(html, /取用主体：化神/);
    }

    const originalChart = structuredClone(baziResult);
    const originalArticle = structuredClone(article);
    const originalPattern = structuredClone(buildEnhancedPatternUsefulGodSection(baziResult));
    const originalElements = structuredClone(buildEnhancedFiveElementsSection(baziResult));
    const returnedPattern = buildEnhancedPatternUsefulGodSection(baziResult);
    const returnedElements = buildEnhancedFiveElementsSection(baziResult);
    returnedPattern.pattern.transformation!.conditions.push('临时化气条件');
    returnedPattern.usefulGods.favorable.push('临时喜神');
    returnedPattern.usefulGods.unfavorable.push('临时忌神');
    if (returnedPattern.usefulGods.transformation) {
      returnedPattern.usefulGods.transformation.conditions.push('临时取用条件');
    }
    if (returnedPattern.pattern.specialAdjudication) {
      returnedPattern.pattern.specialAdjudication.satisfied.push('临时特殊格局条件');
    }
    returnedElements.dayMasterStrength.ruleBasis.push('临时旺衰依据');
    assert.deepEqual(baziResult, originalChart);
    assert.deepEqual(buildEnhancedPatternUsefulGodSection(baziResult), originalPattern);
    assert.deepEqual(buildEnhancedFiveElementsSection(baziResult), originalElements);
    assert.deepEqual(
      buildMingluArticle({ person: { name: '化气核验', gender: 'male' }, baziResult }),
      originalArticle,
    );
  });
}
