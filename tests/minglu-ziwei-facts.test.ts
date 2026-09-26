import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildMingluArticle } from '../packages/core/src/minglu/builder';
import { buildEnhancedZiweiSection } from '../packages/core/src/minglu/ziwei-enhancer';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei';
import { MingluZiweiSection } from '../src/pages/ResultPage/components/MingluWiki/MingluZiweiSection';

test('命录紫微按实际星曜分类保留十二宫全部星曜及辅星生年四化', async () => {
  const runtime = await calculateZiweiChart(
    buildZiweiChartInput({
      name: '星曜核验',
      gender: 'male',
      dateType: 'solar',
      year: '1991',
      month: '5',
      day: '15',
      timeIndex: 1,
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
    { scopes: ['origin'], horoscopeContext: { dateStr: '2026-09-26', hourIndex: 6 } },
  );
  const source = runtime.payloadByScope.origin;
  const section = buildEnhancedZiweiSection(runtime);
  const malefics = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
  assert.deepEqual(
    section.palaces.flatMap((p) => p.maleficStars.map((s) => s.name)).sort(),
    malefics.sort(),
  );
  assert.ok(section.palaces.every((p) => p.minorStars.every((s) => !malefics.includes(s.name))));

  for (const palace of section.palaces) {
    const original = source.palaces.find((p) => p.index === palace.index)!;
    const sourceStars = [...original.major_stars, ...original.minor_stars, ...original.other_stars];
    const stars = [
      ...palace.majorStars,
      ...palace.minorStars,
      ...palace.maleficStars,
      ...palace.otherStars,
    ];
    assert.deepEqual(stars.map((s) => s.name).sort(), sourceStars.map((s) => s.name).sort());
    assert.equal(new Set(stars.map((s) => s.name)).size, stars.length);
    for (const star of stars) {
      const raw = sourceStars.find((s) => s.name === star.name)!;
      assert.equal(star.brightness, raw.brightness);
      assert.equal(star.birthMutagen, raw.birth_mutagen);
    }
  }

  const text = renderToStaticMarkup(createElement(MingluZiweiSection, { data: section })).replace(
    /<[^>]*>/g,
    '',
  );
  assert.match(text, /文昌\[[^\]]+\]化忌/);
  assert.match(text, /文曲\[[^\]]+\]化科/);
  assert.match(text, /煞曜：/);
  for (const star of section.palaces.flatMap((p) => p.otherStars))
    assert.ok(text.includes(star.name), star.name);
  const emptyPalaceSection = {
    ...section,
    palaces: [{ ...section.palaces[0]!, majorStars: [] }, ...section.palaces.slice(1)],
  };
  const emptyText = renderToStaticMarkup(
    createElement(MingluZiweiSection, { data: emptyPalaceSection }),
  ).replace(/<[^>]*>/g, '');
  assert.match(emptyText, /主星空宫 · 对宫/);
  assert.doesNotMatch(emptyText, /借对宫.*安星/);
  assert.match(text, /三方四正：/);
  assert.doesNotMatch(text, /命宫命宫/);
  assert.ok(section.palaces.some((p) => p.selfMutagens.length > 0));
  assert.match(text, /宫干自化：化/);

  const article = buildMingluArticle({
    person: { name: '星曜核验', gender: 'male' },
    baziResult: baziCalculator.calculateBazi({
      year: 1991,
      month: 5,
      day: 15,
      timeIndex: 1,
      gender: 'male',
      isLunar: false,
    }),
    ziweiRuntime: runtime,
  });
  assert.equal(
    article.statistics.totalZiweiStarsCount,
    source.palaces.reduce(
      (sum, p) => sum + p.major_stars.length + p.minor_stars.length + p.other_stars.length,
      0,
    ),
  );
});
