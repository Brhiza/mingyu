import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { buildEnhancedAstrolabeSection } from '../packages/core/src/minglu/astrolabe-enhancer.ts';
import { buildMingluArticle } from '../packages/core/src/minglu/builder.ts';
import { buildZiweiChartInput, calculateZiweiChart } from '../packages/core/src/ziwei/runtime.ts';
import { MingluAstrolabeSection } from '../src/pages/ResultPage/components/MingluWiki/MingluAstrolabeSection';
import { MingluCrossSynthesisSection } from '../src/pages/ResultPage/components/MingluWiki/MingluCrossSynthesisSection';

test('命录占星保留轴点与衍生点的无宫位和无运动状态，不显示为第0宫或顺行', () => {
  const source = generateAstrolabe({
    name: '命录占星展示核验',
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
  const originalSource = structuredClone(source);
  const section = buildEnhancedAstrolabeSection(source);

  assert.ok(source.angles.every((angle) => angle.house === 0));
  assert.ok(section.angles.every((angle) => angle.house === undefined));

  const sunSource = source.planets.find((point) => point.name === 'Sun')!;
  const sun = section.points.find((point) => point.name === 'Sun')!;
  assert.equal(sun.house, sunSource.house);
  assert.equal(sun.isRetrograde, sunSource.retrograde);

  const fortuneSource = source.planets.find((point) => point.name === 'Part of Fortune')!;
  const fortune = section.points.find((point) => point.name === 'Part of Fortune')!;
  assert.equal(fortuneSource.retrograde, false);
  assert.equal(fortuneSource.longitudeSpeed, undefined);
  assert.equal(fortune.isRetrograde, undefined);

  const html = renderToStaticMarkup(createElement(MingluAstrolabeSection, { data: section }));
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)].map((match) => match[1]!);
  const axisRows = rows.filter((row) => /Ascendant|Midheaven|Descendant|Imum Coeli/u.test(row));
  assert.equal(axisRows.length, 4);
  for (const row of axisRows) {
    assert.match(row, /<td>四轴<\/td>/u);
    assert.match(row, /<td>—<\/td>/u);
    assert.doesNotMatch(row, /第\s*0\s*宫|顺行|逆行/u);
  }

  const fortuneRow = rows.find((row) => row.includes('Part of Fortune'))!;
  assert.match(fortuneRow, /<td>—<\/td>/u);
  assert.doesNotMatch(fortuneRow, /顺行|逆行/u);
  assert.doesNotMatch(html, /第\s*0\s*宫/u);
  assert.match(html, /星体、计算点与四轴落点/u);

  assert.deepEqual(section.distributions.elements.土, {
    count: 3,
    percentage: 30,
    points: ['太阳', '金星', '海王星'],
  });
  assert.deepEqual(section.distributions.elements.风, {
    count: 3,
    percentage: 30,
    points: ['月亮', '水星', '天王星'],
  });
  const baziResult = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 6,
    gender: 'female',
    isLunar: false,
    useTrueSolarTime: false,
  });
  const person = { name: source.birth.name, gender: 'female' as const };
  const article = buildMingluArticle({ person, baziResult, astrolabeData: source });
  assert.equal(article.metadata.astrolabeSummary?.dominantElement, '土、风');
  assert.deepEqual(article.astrolabeSection, section);

  const emptyElements = {
    ...source,
    summary: { ...source.summary, elements: { 火: [], 土: [], 风: [], 水: [] } },
  };
  const originalEmptyElements = structuredClone(emptyElements);
  const emptyArticle = buildMingluArticle({ person, baziResult, astrolabeData: emptyElements });
  assert.equal(emptyArticle.metadata.astrolabeSummary?.dominantElement, '—');
  assert.deepEqual(emptyElements, originalEmptyElements);
  assert.deepEqual(source, originalSource);
});

test('命录占星缺太阳高度时沿用已有昼夜盘资料，两者均缺则保留待定', () => {
  const source = generateAstrolabe({
    name: '昼夜盘资料核验',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '0',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });
  const nightSection = buildEnhancedAstrolabeSection({
    ...source,
    solarIllumination: undefined,
    dayChart: false,
  });
  assert.equal(nightSection.dayNight.isDayChart, false);
  const nightHtml = renderToStaticMarkup(
    createElement(MingluAstrolabeSection, { data: nightSection }),
  );
  assert.match(nightHtml, /夜生盘/u);

  const unknownSection = buildEnhancedAstrolabeSection({
    ...source,
    solarIllumination: undefined,
    dayChart: undefined,
  });
  assert.equal(unknownSection.dayNight.isDayChart, undefined);
  const html = renderToStaticMarkup(
    createElement(MingluAstrolabeSection, { data: unknownSection }),
  );
  assert.match(html, /昼夜待定/u);
  assert.doesNotMatch(html, /日生盘|夜生盘/u);
});

test('命录跨体系主题逐项传递原始盘面资料，不把资料并置表述为互证', async () => {
  const person = { name: '三盘传递核验', gender: 'male' as const };
  const baziResult = baziCalculator.calculateBazi({
    year: 1991,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: person.gender,
    isLunar: false,
    useTrueSolarTime: false,
  });
  const ziweiRuntime = await calculateZiweiChart(
    buildZiweiChartInput({
      name: person.name,
      gender: person.gender,
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
  const astrolabeData = generateAstrolabe({
    name: person.name,
    gender: '男',
    year: '1991',
    month: '5',
    day: '15',
    hour: '1',
    minute: '0',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });
  const article = buildMingluArticle({
    person,
    baziResult,
    ziweiRuntime,
    astrolabeData,
  });
  const theme = article.crossSynthesisSection?.find((item) => item.themeId === 'temperament')!;
  const ziweiOrigin = ziweiRuntime.payloadByScope.origin!;
  const ziweiSoulPalace = ziweiOrigin.palaces.find((palace) => palace.name === '命宫')!;
  const sun = astrolabeData.planets.find((point) => point.name === 'Sun')!;
  const moon = astrolabeData.planets.find((point) => point.name === 'Moon')!;
  const ascendant = astrolabeData.angles.find((angle) => angle.name === 'Ascendant')!;

  assert.deepEqual(theme.baziEvidence, [
    `日主${baziResult.dayMaster.gan}(${baziResult.dayMaster.element})，${baziResult.analysis.dayMasterStrength.status}`,
    `主格局为【${baziResult.analysis.mingGe.pattern}】`,
  ]);
  assert.deepEqual(theme.ziweiEvidence, [
    `命宫坐${ziweiSoulPalace.major_stars.map((star) => star.name).join('、') || '空宫'}`,
    `身主${ziweiOrigin.basic_info.body}，命主${ziweiOrigin.basic_info.soul}`,
  ]);
  assert.deepEqual(theme.astrolabeEvidence, [
    `太阳落${sun.sign}`,
    `月亮落${moon.sign}`,
    `上升点位于${ascendant.sign}`,
  ]);
  assert.ok(
    article.crossSynthesisSection?.every((item) => item.crossVerificationNotes.length === 0),
  );

  const html = renderToStaticMarkup(
    createElement(MingluCrossSynthesisSection, { themes: article.crossSynthesisSection! }),
  );
  assert.match(html, /八字资料：/u);
  assert.match(html, /紫微资料：/u);
  assert.match(html, /占星资料：/u);
  assert.doesNotMatch(html, /互证|高度印证|同步对齐|行运重在时位相应/u);
});
