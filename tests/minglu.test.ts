import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { buildMingluArticle, formsPairRelation } from '../packages/core/src/minglu/index.ts';
import { MINGLU_GLOSSARY_DATABASE } from '../packages/core/src/minglu/glossary-data.ts';
import { getBaZhaiPalace } from '../packages/core/src/direction/index.ts';
import { MingluCrossSynthesisSection } from '../src/pages/ResultPage/components/MingluWiki/MingluCrossSynthesisSection';
import { MingluGlossarySection } from '../src/pages/ResultPage/components/MingluWiki/MingluGlossarySection';
import {
  buildBeginnerGuide,
  buildEnhancedPillarsSection,
  buildEnhancedFiveElementsSection,
  buildEnhancedInteractions,
  buildEnhancedPatternUsefulGodSection,
  buildEnhancedTenGodsSection,
} from '../packages/core/src/minglu/bazi-enhancer.ts';
import { MingluInteractionsSection } from '../src/pages/ResultPage/components/MingluWiki/MingluInteractionsSection';
import { MingluFiveElementsSection } from '../src/pages/ResultPage/components/MingluWiki/MingluFiveElementsSection';

let sharedMingluBaziResult: ReturnType<typeof baziCalculator.calculateBazi> | undefined;

function getSharedMingluBaziResult() {
  sharedMingluBaziResult ??= baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'male',
  });
  return structuredClone(sharedMingluBaziResult);
}

test('命录五合六合依实盘条件展示合绊、争合与成化', () => {
  const samples = [
    {
      date: [1990, 1, 7, 5],
      category: '地支六合',
      name: '巳申六合',
      status: '合而不化',
      transformElement: undefined,
    },
    {
      date: [1990, 9, 5, 6],
      category: '天干五合',
      name: '戊癸相合',
      status: '合而不化',
      transformElement: undefined,
    },
    {
      date: [1994, 1, 3, 0],
      category: '天干五合',
      name: '甲己相合',
      status: '争合不专',
      transformElement: undefined,
    },
    {
      date: [1994, 3, 17, 4],
      category: '天干五合',
      name: '丁壬相合',
      status: '成化',
      transformElement: '木',
    },
    {
      date: [1994, 3, 17, 4],
      category: '地支六合',
      name: '卯戌六合',
      status: '逢冲破合',
      transformElement: undefined,
    },
  ] as const;
  for (const sample of samples) {
    const [year, month, day, timeIndex] = sample.date;
    const chart = baziCalculator.calculateBazi({
      year,
      month,
      day,
      timeIndex,
      gender: 'male',
      useTrueSolarTime: false,
    });
    const items = buildEnhancedInteractions(chart);
    const item = items.find(
      (entry) =>
        entry.category === sample.category &&
        entry.name === sample.name &&
        (sample.name !== '巳申六合' || entry.involvedPillars.join('、') === '日柱、时柱'),
    );
    assert.ok(item, `${sample.date.join('-')} ${sample.name}`);
    assert.equal(item.conditionStatus, sample.status);
    assert.equal(item.transformElement, sample.transformElement);
    assert.equal(item.nature, '中性');
    assert.doesNotMatch(item.name, /合化|六合化/u);
    assert.doesNotMatch(item.description, /厚德重信|安定稳固|晚景光明/u);
    if (sample.status !== '成化') {
      assert.doesNotMatch(item.conditionEvidence?.join('；') ?? '', /合化[木火土金水]/u);
      if (sample.category === '天干五合') {
        assert.ok(item.conditionEvidence?.some((evidence) => evidence.startsWith('月令')));
      }
    }
    const html = renderToStaticMarkup(createElement(MingluInteractionsSection, { items: [item] }));
    assert.match(html, new RegExp(sample.name, 'u'));
    assert.match(html, new RegExp(sample.status, 'u'));
    assert.equal(html.includes('对应五行：'), sample.status === '成化');
  }
});

test('命录只将当前月直录的调候条文列为本月评注', () => {
  for (const sample of [
    {
      year: 1990,
      month: 4,
      day: 10,
      dayMaster: '乙',
      monthBranch: '辰',
      verse: '三月乙木，阳气愈炽，先癸后丙。',
      adjacentVerse: /二月乙木|四月乙木/u,
    },
    {
      year: 1990,
      month: 9,
      day: 12,
      dayMaster: '庚',
      monthBranch: '酉',
      verse: '八月庚金，刚锐未退，用丁用甲，丙不可少。',
      adjacentVerse: /七月庚金|九月庚金/u,
    },
  ]) {
    const result = baziCalculator.calculateBazi({
      year: sample.year,
      month: sample.month,
      day: sample.day,
      timeIndex: 1,
      gender: 'male',
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
    });
    assert.equal(result.dayMaster.gan, sample.dayMaster);
    assert.equal(result.pillars.month.zhi, sample.monthBranch);
    const advice = buildEnhancedPatternUsefulGodSection(result).qiongtongAdvice;
    assert.equal(advice?.title, `${sample.dayMaster}生于${sample.monthBranch}月`);
    assert.deepEqual(advice?.quotes, [sample.verse]);
    assert.doesNotMatch(advice?.quotes.join('；') ?? '', sample.adjacentVerse);
  }
});

test('命录应正确生成全息百科大报告与所有补齐计算', () => {
  const person = {
    name: '张三',
    gender: 'male' as const,
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 15,
    birthHour: 10,
    birthMinute: 30,
  };

  const baziResult = getSharedMingluBaziResult();

  const article = buildMingluArticle({
    person,
    baziResult,
  });

  const themes = article.crossSynthesisSection!;
  assert.deepEqual(
    themes.map((theme) => theme.themeId),
    ['temperament', 'career-wealth', 'timing-cycles'],
  );
  assert.ok(themes.every((theme) => theme.ziweiEvidence.length === 0));
  assert.ok(themes.every((theme) => !theme.astrolabeEvidence?.length));
  assert.ok(themes.every((theme) => theme.crossVerificationNotes.length === 0));
  assert.deepEqual(themes.find((theme) => theme.themeId === 'timing-cycles')?.baziEvidence, [
    `起运岁数：约${article.luckChronicleSection.startAge}岁起运`,
    `首步大运：${article.luckChronicleSection.cycles.find((cycle) => !cycle.isXiaoyun)?.ganZhi}运（约${article.luckChronicleSection.startAge}岁起始）`,
  ]);
  const themeHtml = renderToStaticMarkup(createElement(MingluCrossSynthesisSection, { themes }));
  assert.match(themeHtml, /第十二章：盘面主题资料/);
  assert.doesNotMatch(themeHtml, /紫微资料|占星资料|互证|同步对齐|行运重在时位相应/);

  // 1. 元数据验证
  assert.ok(article.metadata);
  assert.equal(article.metadata.subjectName, '张三');
  assert.equal(article.metadata.gender, 'male');
  assert.equal(article.metadata.genderLabel, '乾造 (男命)');
  assert.ok(article.metadata.baziFourPillars.year);
  assert.ok(article.metadata.baziFourPillars.month);
  assert.ok(article.metadata.baziFourPillars.day);
  assert.ok(article.metadata.baziFourPillars.hour);

  // 2. 小白导读与目录树验证
  assert.ok(article.beginnerGuide);
  assert.ok(article.beginnerGuide.coreArchetype);
  assert.ok(article.beginnerGuide.natureAnalogy);
  assert.ok(article.beginnerGuide.strengthPlain);
  assert.ok(article.beginnerGuide.fourPillarsMetaphor.year);

  assert.ok(article.tableOfContents.length >= 8);
  assert.ok(article.tableOfContents.some((item) => item.title.includes('入门指南')));
  assert.ok(article.tableOfContents.some((item) => item.title.includes('命录提纲')));
  assert.ok(article.tableOfContents.some((item) => item.title.includes('五行能量')));
  assert.ok(article.tableOfContents.some((item) => item.title.includes('格局成败')));
  assert.ok(article.tableOfContents.some((item) => item.title.includes('全量柱间作用')));
  assert.ok(article.tableOfContents.some((item) => item.title.includes('八字神煞与传统取象')));
  assert.ok(article.tableOfContents.some((item) => item.title.includes('术语百科词典')));

  // 3. 四柱全息矩阵（含三垣、月令司令、命卦）
  assert.equal(article.pillarsSection.columns.length, 4);
  assert.ok(article.pillarsSection.sanYuan.taiYuan.ganZhi);
  assert.ok(article.pillarsSection.sanYuan.taiXi.ganZhi);
  assert.ok(article.pillarsSection.sanYuan.mingGong.ganZhi);
  assert.ok(article.pillarsSection.sanYuan.shenGong.ganZhi);
  assert.ok(article.pillarsSection.seasonInfo.monthCommander);

  // 4. 五行能量与日主强弱
  assert.equal(article.fiveElementsSection.elements.length, 5);
  assert.ok(article.fiveElementsSection.dayMasterStrength.score >= 0);
  assert.ok(article.fiveElementsSection.dayMasterStrength.sameRatio >= 0);
  assert.ok(article.fiveElementsSection.dayMasterStrength.diffRatio >= 0);
  assert.equal(article.fiveElementsSection.healthTcmAdvice, undefined);
  assert.deepEqual(
    article.fiveElementsSection.elements.map(({ wuxing, count }) => [wuxing, count]),
    [
      ['木', 0],
      ['火', 3],
      ['土', 1],
      ['金', 4],
      ['水', 0],
    ],
  );

  // 5. 格局与用神
  assert.ok(article.patternUsefulGodSection.pattern.name);
  assert.ok(article.patternUsefulGodSection.usefulGods.primaryUseful);
  const fulfillment = baziResult.analysis.mingGe.fulfillment;
  assert.ok(fulfillment);
  assert.equal(article.patternUsefulGodSection.pattern.fulfillment?.status, fulfillment.status);
  assert.equal(
    article.patternUsefulGodSection.pattern.fulfillment?.conditionFacts?.length,
    fulfillment.conditionFacts?.length,
  );
  assert.equal(
    article.patternUsefulGodSection.pattern.fulfillment?.contradiction,
    fulfillment.contradiction,
  );
  assert.deepEqual(
    article.patternUsefulGodSection.pattern.fulfillment?.pathEvaluations?.map((path) => path.key),
    fulfillment.pathEvaluations?.map((path) => path.key),
  );

  // 6. 柱间作用网络
  assert.ok(Array.isArray(article.interactionsSection));

  // 7. 全息神煞谱系
  assert.ok(article.shenShaSection.length > 0);
  assert.ok(article.shenShaSection.every((s) => s.name && s.traditionalDescription));

  // 8. 十神心性与六亲
  assert.equal(article.tenGodsSection.godsList.length, 10);
  assert.equal(article.tenGodsSection.housesSixKin.length, 4);

  // 9. 十二长生全景矩阵
  assert.equal(article.lifeStagesSection.tableMatrix.length, 10);
  assert.equal(article.lifeStagesSection.natalStages.length, 4);

  // 10. 大运流年流月全息大表与深度事件
  assert.ok(article.luckChronicleSection.cycles.length > 0);
  const firstCycle = article.luckChronicleSection.cycles[0];
  assert.ok(firstCycle.lifeTheme);
  assert.equal(firstCycle.entryType, '小运');
  assert.equal(firstCycle.careerAdvice, '');
  const firstDayun = article.luckChronicleSection.cycles.find(
    (cycle) => cycle.entryType === '大运',
  );
  assert.ok(firstDayun?.careerAdvice);
  assert.equal(firstCycle.healthAdvice, undefined);
  assert.ok(
    article.luckChronicleSection.cycles.every(
      (cycle) => !/财富丰隆|德高望重/.test(cycle.lifeTheme),
    ),
  );
  assert.ok(firstCycle.annualYears.length > 0);

  const firstYear = firstCycle.annualYears[0];
  assert.ok(firstYear.yearTheme);
  assert.ok(firstYear.months);
  assert.ok(firstYear.months.length > 0 && firstYear.months.length <= 12);
  assert.equal(firstYear.months[0].startDateTime, firstCycle.startDateTime);
  assert.ok(firstYear.months[0].solarTerm);
  assert.ok(firstYear.months[0].ganZhi);
  assert.ok(firstYear.months[0].commander);

  // 11. 术语百科词典
  assert.equal(MINGLU_GLOSSARY_DATABASE.length, 33);
  assert.equal(MINGLU_GLOSSARY_DATABASE[0]?.term, '甲木');
  assert.equal(article.glossary.length, 33);
  assert.ok(article.statistics.totalSections >= 8);
  assert.equal(article.statistics.totalGlossaryEntries, 33);
  assert.equal(article.glossary[0]?.term, '甲木');
  assert.deepEqual(article.glossary[0]?.relatedTerms, ['乙木', '阳木', '天干五合', '仁']);
  assert.equal(
    article.glossary[0]?.classicSource,
    '《滴天髓·天干论·甲木》：“甲木参天，脱胎要火。”',
  );
  const originalArticle = structuredClone(article);
  const originalGlossary = originalArticle.glossary;
  const originalGlossaryMarkup = renderToStaticMarkup(
    createElement(MingluGlossarySection, { entries: originalGlossary }),
  );
  const publicJiaMu = MINGLU_GLOSSARY_DATABASE[0]!;
  const publicRelatedTerms = publicJiaMu.relatedTerms!;
  const publicJiaMuSnapshot = {
    term: publicJiaMu.term,
    classicSource: publicJiaMu.classicSource,
    relatedTerms: [...publicRelatedTerms],
  };
  const publicGlossaryLength = MINGLU_GLOSSARY_DATABASE.length;
  const returnedJiaMu = article.glossary[0]!;
  const returnedRelatedTerms = returnedJiaMu.relatedTerms!;
  const originalChart = structuredClone(baziResult);
  const returnedPillars = buildEnhancedPillarsSection(baziResult);
  assert.deepEqual(returnedPillars, originalArticle.pillarsSection);

  let freshArticle: typeof article | undefined;
  try {
    publicJiaMu.term = '外部变造词条';
    publicJiaMu.classicSource = '外部变造典籍';
    publicRelatedTerms.splice(0, publicRelatedTerms.length, '外部变造相关词条');
    MINGLU_GLOSSARY_DATABASE.push({ ...structuredClone(publicJiaMu), term: '外部新增词条' });
    assert.deepEqual(article.glossary, originalGlossary);
    returnedJiaMu.term = '文章变造词条';
    returnedJiaMu.classicSource = '文章变造典籍';
    returnedRelatedTerms.splice(0, returnedRelatedTerms.length, '文章变造相关词条');
    article.glossary.push({ ...structuredClone(article.glossary[1]!), term: '文章新增词条' });
    assert.equal(MINGLU_GLOSSARY_DATABASE[0]?.term, '外部变造词条');
    assert.deepEqual(MINGLU_GLOSSARY_DATABASE[0]?.relatedTerms, ['外部变造相关词条']);

    for (const column of [...returnedPillars.columns, ...article.pillarsSection.columns]) {
      column.kongWang.push('临时空亡');
      column.shensha.push('临时神煞');
    }
    assert.ok(firstYear.xiaoyun);
    firstYear.xiaoyun.ganZhi = '临时小运';
    firstYear.xiaoyun.tenGod = '临时十神';
    firstYear.xiaoyun.tenGodZhi = '临时地支十神';
    assert.deepEqual(baziResult, originalChart);

    freshArticle = buildMingluArticle({
      person,
      baziResult: structuredClone(baziResult),
    });
    assert.equal(freshArticle.glossary.length, 33);
    assert.deepEqual(freshArticle, originalArticle);
    assert.deepEqual(freshArticle.glossary, originalGlossary);
    assert.equal(freshArticle.glossary[0]?.term, '甲木');
    assert.deepEqual(freshArticle.glossary[0]?.relatedTerms, ['乙木', '阳木', '天干五合', '仁']);
    assert.equal(
      freshArticle.glossary[0]?.classicSource,
      '《滴天髓·天干论·甲木》：“甲木参天，脱胎要火。”',
    );
    assert.equal(freshArticle.statistics.totalGlossaryEntries, 33);
    const freshGlossaryMarkup = renderToStaticMarkup(
      createElement(MingluGlossarySection, { entries: freshArticle.glossary }),
    );
    assert.equal(freshGlossaryMarkup, originalGlossaryMarkup);
    assert.match(freshGlossaryMarkup, /共收录 33 个词条/u);
    assert.match(freshGlossaryMarkup, /相关词条：乙木 · 阳木 · 天干五合 · 仁/u);
    assert.match(freshGlossaryMarkup, /《滴天髓·天干论·甲木》/u);
    assert.doesNotMatch(freshGlossaryMarkup, /外部变造|文章变造|新增词条/u);
  } finally {
    publicJiaMu.term = publicJiaMuSnapshot.term;
    publicJiaMu.classicSource = publicJiaMuSnapshot.classicSource;
    publicRelatedTerms.splice(0, publicRelatedTerms.length, ...publicJiaMuSnapshot.relatedTerms);
    MINGLU_GLOSSARY_DATABASE.splice(publicGlossaryLength);
  }
  assert.equal(MINGLU_GLOSSARY_DATABASE.length, 33);
  assert.equal(MINGLU_GLOSSARY_DATABASE[0]?.term, '甲木');
  assert.deepEqual(MINGLU_GLOSSARY_DATABASE[0]?.relatedTerms, ['乙木', '阳木', '天干五合', '仁']);
  assert.equal(
    MINGLU_GLOSSARY_DATABASE[0]?.classicSource,
    '《滴天髓·天干论·甲木》：“甲木参天，脱胎要火。”',
  );
});

test('命录性别元数据按排盘结果标注，未指定性别不冒充男命或女命', () => {
  const input = { year: 1990, month: 5, day: 15, timeIndex: 5 };
  const femaleChart = baziCalculator.calculateBazi({ ...input, gender: 'female' });
  const femaleArticle = buildMingluArticle({
    person: { name: '样例', gender: 'male' },
    baziResult: femaleChart,
  });
  assert.equal(femaleArticle.metadata.gender, 'female');
  assert.equal(femaleArticle.metadata.genderLabel, '坤造 (女命)');

  const unspecifiedChart = { ...femaleChart, gender: '' };
  const unspecifiedArticle = buildMingluArticle({
    person: { name: '样例', gender: '' },
    baziResult: unspecifiedChart,
  });
  assert.equal(unspecifiedArticle.metadata.gender, '');
  assert.equal(unspecifiedArticle.metadata.genderLabel, '未指定');
});

test('命录缺时辰只保留已确定柱与候选场景，不套用空日主或空时柱', () => {
  const baziResult = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 6,
    gender: 'male',
    isThreePillars: true,
  });

  const article = buildMingluArticle({
    person: { name: '缺时', gender: 'male' },
    baziResult,
  });

  assert.equal(article.metadata.baziFourPillars.hour, '待补时');
  assert.equal(article.patternUsefulGodSection.pattern.name, '待补时');
  assert.equal(article.patternUsefulGodSection.unknownTimeAnalysis?.scenarios.length, 15);
  assert.equal(article.fiveElementsSection.dayMasterStrength.status, '未知（待补时）');
  assert.equal(article.luckChronicleSection.direction, '待补时');
  assert.deepEqual(article.luckChronicleSection.cycles, []);
  assert.ok(article.crossSynthesisSection?.every((theme) => theme.themeId !== 'timing-cycles'));
  assert.deepEqual(article.interactionsSection, []);
  assert.match(article.beginnerGuide?.strengthPlain ?? '', /旺衰、格局与喜忌暂不判定/);

  const originalChart = structuredClone(baziResult);
  const originalPillars = structuredClone(article.pillarsSection);
  for (const column of article.pillarsSection.columns) {
    column.kongWang.push('临时空亡');
    column.shensha.push('临时神煞');
  }
  assert.deepEqual(baziResult, originalChart);
  assert.deepEqual(buildEnhancedPillarsSection(baziResult), originalPillars);
});

test('命录未知时辰按各柱稳定状态展示事实，不把未见五行断为缺失', () => {
  const boundary = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    gender: 'female',
  });
  assert.deepEqual(boundary.unknownTimeAnalysis?.uncertainPillars, ['year', 'month', 'day']);
  const article = buildMingluArticle({
    person: { name: '临界', gender: 'female' },
    baziResult: boundary,
  });
  assert.deepEqual(Object.values(article.metadata.baziFourPillars), Array(4).fill('待补时'));
  assert.equal(
    article.patternUsefulGodSection.unknownTimeAnalysis?.scenarios.length,
    boundary.unknownTimeAnalysis?.scenarios.length,
  );
  assert.ok(
    article.tenGodsSection.housesSixKin.every((item) => item.pillarLabel.includes('待补时')),
  );
  assert.doesNotMatch(
    Object.values(article.beginnerGuide!.fourPillarsMetaphor).join('；'),
    /已确定资料/,
  );
  assert.ok(article.fiveElementsSection.elements.every((item) => !item.isMissing));
  const fiveElementsMarkup = renderToStaticMarkup(
    createElement(MingluFiveElementsSection, { data: article.fiveElementsSection }),
  );
  assert.doesNotMatch(
    fiveElementsMarkup,
    /已确定柱|缺此行|加权计数 \(0%\)|不得令|无明显根|无印生|透干无比劫|同类生扶 \(印比帮身\): 0分/,
  );
  assert.match(fiveElementsMarkup, /同类生扶：待补时/);
  assert.match(fiveElementsMarkup, /异类耗泄：待补时/);
  assert.doesNotMatch(article.crossSynthesisSection![0].focus, /已确定柱/);
  assert.doesNotMatch(boundary.evidenceAnalysis!.calculationChain.join('；'), /已确定的柱/);
  assert.doesNotMatch(
    boundary.evidenceAnalysis!.calculationChain.join('；'),
    /日主资料与日柱不一致|由四柱和日主推导|形成旺衰未知/,
  );
  assert.match(
    boundary.evidenceAnalysis!.calculationChain.join('；'),
    /年、月、日、时柱按出生时分候选定位；日主待补时/,
  );
  assert.match(
    boundary.evidenceAnalysis!.counterEvidenceFacts.find((item) => item.type === '排盘边界覆盖')
      ?.promptText ?? '',
    /年柱、月柱、日柱按候选场景核对/,
  );

  const partlyKnown = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    gender: 'male',
  });
  const partialArticle = buildMingluArticle({
    person: { name: '部分确定', gender: 'male' },
    baziResult: partlyKnown,
  });
  assert.deepEqual(partlyKnown.unknownTimeAnalysis?.uncertainPillars, ['day']);
  assert.equal(partialArticle.metadata.baziFourPillars.year, '己卯');
  assert.equal(partialArticle.metadata.baziFourPillars.month, '丁丑');
  assert.equal(partialArticle.metadata.baziFourPillars.day, '待补时');
  assert.deepEqual(
    partialArticle.pillarsSection.columns[0].hiddenStems.map((item) => item.stem),
    ['乙'],
  );
  assert.deepEqual(
    partialArticle.pillarsSection.columns[1].hiddenStems.map((item) => item.stem),
    ['己', '癸', '辛'],
  );
  assert.deepEqual(
    partlyKnown.evidenceAnalysis?.pillarFacts.find((item) => item.pillar === '年柱')?.hiddenStems,
    ['乙'],
  );
  assert.doesNotMatch(
    partlyKnown.evidenceAnalysis?.pillarFacts.find((item) => item.pillar === '日柱')?.promptText ??
      '',
    /藏干资料与地支不一致/,
  );
  assert.match(partialArticle.tenGodsSection.housesSixKin[0].pillarLabel, /年柱（已确定柱）/);
  assert.match(partialArticle.tenGodsSection.housesSixKin[2].pillarLabel, /日柱（待补时）/);

  const stableDay = baziCalculator.calculateBazi({
    year: 2026,
    month: 4,
    day: 5,
    gender: 'female',
    timeZoneId: 'Pacific/Auckland',
    timezone: 13,
  });
  assert.deepEqual(stableDay.unknownTimeAnalysis?.uncertainPillars, []);
  const stableDayArticle = buildMingluArticle({
    person: { name: '日柱确定', gender: 'female' },
    baziResult: stableDay,
  });
  assert.equal(stableDayArticle.metadata.baziFourPillars.day, '己酉');
  assert.match(
    stableDay.evidenceAnalysis!.counterEvidenceFacts.find((item) => item.type === '排盘边界覆盖')
      ?.promptText ?? '',
    /年、月、日柱已确定；出生时分与时柱待补充/,
  );
  assert.match(stableDayArticle.tenGodsSection.godsList[0].psychology, /日主己已确定/);
  assert.match(stableDayArticle.crossSynthesisSection![0].baziEvidence.join('；'), /日主己已确定/);
  assert.doesNotMatch(stableDayArticle.tenGodsSection.godsList[0].psychology, /日主未定/);
});

test('命录岁运并临不应同时误判天地合或天克地冲，冲合判定须两字不同', () => {
  const baziResult = getSharedMingluBaziResult();
  const article = buildMingluArticle({ person: { name: '张三', gender: 'male' }, baziResult });

  let sawBinglin = false;
  for (const cycle of article.luckChronicleSection.cycles) {
    for (const year of cycle.annualYears) {
      const events = year.specialEvents.join('；');
      if (year.ganZhi === cycle.ganZhi && cycle.ganZhi.length === 2) {
        sawBinglin = true;
        assert.match(events, /岁运并临/);
        assert.doesNotMatch(events, /岁运天地合|岁运天克地冲/);
      }
      if (events.includes('太岁冲日支')) {
        assert.notEqual(year.ganZhi.slice(1), baziResult.pillars.day.zhi, '同支不得记为太岁冲日支');
      }
      if (events.includes('太岁冲提纲')) {
        assert.notEqual(
          year.ganZhi.slice(1),
          baziResult.pillars.month.zhi,
          '同支不得记为太岁冲提纲',
        );
      }
    }
  }
  assert.ok(sawBinglin, '十二年大运流年表中应至少出现一次岁运并临');
});

test('岁运天克地冲包含戊壬己癸的土水相克，关系标签保留条件', () => {
  const clashes: Record<string, string> = {
    子: '午',
    丑: '未',
    寅: '申',
    卯: '酉',
    辰: '戌',
    巳: '亥',
    午: '子',
    未: '丑',
    申: '寅',
    酉: '卯',
    戌: '辰',
    亥: '巳',
  };
  const earthWater = new Set(['戊壬', '壬戊', '己癸', '癸己']);
  let checked = 0;
  for (const gender of ['male', 'female'] as const) {
    const baziResult = baziCalculator.calculateBazi({
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 5,
      gender,
    });
    const article = buildMingluArticle({ person: { name: '结构核验', gender }, baziResult });
    for (const cycle of article.luckChronicleSection.cycles) {
      for (const year of cycle.annualYears) {
        const events = year.specialEvents.join('；');
        if (
          earthWater.has(cycle.ganZhi[0] + year.ganZhi[0]) &&
          clashes[cycle.ganZhi[1]] === year.ganZhi[1]
        ) {
          checked += 1;
          assert.match(events, /岁运天克地冲/);
        }
        assert.doesNotMatch(events, /诸事和顺|良缘相聚|蜕变契机|【枭神夺食】/);
      }
    }
  }
  assert.ok(checked > 0, '真实岁运样本须覆盖土水相克且地支相冲');
});

test('命录命卦方位应与公共八宅大游年表逐卦一致', () => {
  const baziResult = getSharedMingluBaziResult();
  const article = buildMingluArticle({ person: { name: '张三', gender: 'male' }, baziResult });
  const gua = baziResult.mingGua!.gua;
  const palaceTable = getBaZhaiPalace(gua);
  const directionOf = (label: string) => palaceTable.find((p) => p.label === label)!.direction;

  const pillarsDirections = article.pillarsSection.mingGuaInfo!.directions;
  assert.equal(pillarsDirections.find((d) => d.name === '生气方')!.direction, directionOf('生气'));
  assert.equal(pillarsDirections.find((d) => d.name === '延年方')!.direction, directionOf('延年'));
  assert.equal(pillarsDirections.find((d) => d.name === '绝命方')!.direction, directionOf('绝命'));

  const fengshui = article.fengshuiSection!.mingGua;
  assert.equal(
    fengshui.beneficialDirections.find((d) => d.name === '天医方')!.direction,
    directionOf('天医'),
  );
  assert.equal(
    fengshui.unfavorableDirections.find((d) => d.name === '五鬼方')!.direction,
    directionOf('五鬼'),
  );
});

test('岁运合冲判定穷举：十干100组、地支144组正反向与同字', () => {
  // R18 验收建议：两两组合穷举，保证同字不成合冲、组内异字正反向均命中、组外不误判
  const stemCombos = [
    { pair: ['甲', '己'] },
    { pair: ['乙', '庚'] },
    { pair: ['丙', '辛'] },
    { pair: ['丁', '壬'] },
    { pair: ['戊', '癸'] },
  ];
  const liuhe = [
    { pair: ['子', '丑'] },
    { pair: ['寅', '亥'] },
    { pair: ['卯', '戌'] },
    { pair: ['辰', '酉'] },
    { pair: ['巳', '申'] },
    { pair: ['午', '未'] },
  ];
  const liuchong = [
    { pair: ['子', '午'] },
    { pair: ['丑', '未'] },
    { pair: ['寅', '申'] },
    { pair: ['卯', '酉'] },
    { pair: ['辰', '戌'] },
    { pair: ['巳', '亥'] },
  ];
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const expected = (pairs: Array<{ pair: string[] }>, a: string, b: string, same: boolean) =>
    a !== b &&
    pairs.some(
      (c) => (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a),
    ) &&
    !same;

  let checked = 0;
  for (const a of stems) {
    for (const b of stems) {
      const same = a === b;
      const actual = formsPairRelation(stemCombos, a, b);
      assert.equal(actual, same ? false : expected(stemCombos, a, b, false), `天干${a}${b}`);
      checked += 1;
    }
  }
  assert.equal(checked, 100);

  checked = 0;
  for (const a of branches) {
    for (const b of branches) {
      const same = a === b;
      const expectLiuhe = expected(liuhe, a, b, same);
      const expectChong = expected(liuchong, a, b, same);
      assert.equal(formsPairRelation(liuhe, a, b), expectLiuhe, `六合${a}${b}`);
      assert.equal(formsPairRelation(liuchong, a, b), expectChong, `六冲${a}${b}`);
      checked += 1;
    }
  }
  assert.equal(checked, 144);
});

test('命录保留中和待判与实际原局作用，印星及透干比劫分别取证', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1990,
    month: 1,
    day: 4,
    timeIndex: 5,
    gender: 'male',
  });
  assert.equal(chart.analysis.dayMasterStrength.status, '中和');
  assert.equal(chart.analysis.usefulGod.incrementStatus, '待判');
  const guide = buildBeginnerGuide(chart);
  assert.match(guide.strengthPlain, /日主中和/);
  assert.match(guide.strengthPlain, /增补五行喜忌待判/);
  assert.ok(guide.strengthPlain.includes(chart.analysis.usefulGod.primaryUseful!));
  assert.ok(
    guide.strengthPlain.includes(chart.analysis.usefulGod.primaryFavorableWuxing!) ||
      chart.analysis.usefulGod.primaryFavorableWuxing === undefined,
  );
  assert.match(guide.favorableHabitsPlain[0], /增补五行喜忌待判/);
  assert.doesNotMatch(guide.strengthPlain, /日主偏弱|印比为喜用/);
  const tenGods = buildEnhancedTenGodsSection(chart);
  assert.equal(tenGods.godsList.find((god) => god.tenGod === '正官')!.count, 0);
  assert.equal(tenGods.godsList.find((god) => god.tenGod === '七杀')!.count, 0);
  assert.ok(tenGods.flowAnalysis.channels.length > 0);
  assert.equal(
    tenGods.flowAnalysis.channels.some(
      (channel) => channel.from === '官杀' || channel.to === '官杀',
    ),
    false,
  );

  // 甲寅、丙寅、甲寅、丙寅：仅甲丙戊，透干有比肩而全盘无水印。
  const noResource = {
    ...chart,
    dayMaster: { ...chart.dayMaster, gan: '甲', element: '木' as const },
    pillars: {
      year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    },
  };
  const companion = buildEnhancedFiveElementsSection(noResource);
  assert.equal(companion.dayMasterStrength.dimensions.assisted, true);
  assert.equal(companion.dayMasterStrength.dimensions.supported, false);
  // 己日明干丙辛辛均非比劫，保留原局巳火印；二者不能共用hasSupport。
  const noCompanion = {
    ...chart,
    pillars: {
      ...chart.pillars,
      year: { gan: '丙', zhi: '午', ganZhi: '丙午' },
      month: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
      hour: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
    },
  };
  const resource = buildEnhancedFiveElementsSection(noCompanion);
  assert.equal(resource.dayMasterStrength.dimensions.supported, true);
  assert.equal(resource.dayMasterStrength.dimensions.assisted, false);
  const competing = {
    ...noResource,
    pillars: {
      year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      month: { gan: '己', zhi: '巳', ganZhi: '己巳' },
      day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    },
  };
  const harmony = buildEnhancedInteractions(competing).filter(
    (item) => item.category === '天干五合',
  );
  assert.equal(harmony.length, 2);
  assert.ok(
    harmony.every((item) => item.conditionEvidence?.some((evidence) => evidence.includes('争合'))),
  );
  assert.ok(harmony.every((item) => item.conditionStatus !== '成化' && item.nature !== '吉'));

  // 复用盘面资料，独立核对三会、三合、半合及两种相刑返回数组的可写边界。
  for (const sample of [
    {
      pillars: ['甲寅', '乙卯', '甲辰', '壬子'],
      names: ['寅卯辰三会东方木', '子卯相刑（无礼之刑）'],
    },
    {
      pillars: ['癸亥', '乙卯', '己未', '壬子'],
      names: ['亥卯未三合木局', '亥卯半合木局（生地半合）'],
    },
    { pillars: ['丙寅', '丁巳', '甲申', '戊午'], names: ['寅巳申三刑（无恩之刑）'] },
  ]) {
    const projected = structuredClone(chart);
    for (const [index, key] of (['year', 'month', 'day', 'hour'] as const).entries()) {
      const ganZhi = sample.pillars[index]!;
      Object.assign(projected.pillars[key], { gan: ganZhi[0], zhi: ganZhi[1], ganZhi });
    }
    const originalProjection = structuredClone(projected);
    const expected = structuredClone(buildEnhancedInteractions(projected));
    for (const name of sample.names) {
      assert.ok(
        expected.some((item) => item.name === name),
        name,
      );
    }
    const returned = buildEnhancedInteractions(projected);
    for (const item of returned) item.involvedStemsBranches[0] = '临时地支';
    assert.deepEqual(projected, originalProjection);
    assert.deepEqual(buildEnhancedInteractions(projected), expected);
  }
});
