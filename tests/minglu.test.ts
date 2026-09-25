import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { buildMingluArticle, formsPairRelation } from '../packages/core/src/minglu/index.ts';
import { MINGLU_GLOSSARY_DATABASE } from '../packages/core/src/minglu/glossary-data.ts';
import { getBaZhaiPalace } from '../packages/core/src/direction/index.ts';
import {
  buildBeginnerGuide,
  buildEnhancedFiveElementsSection,
  buildEnhancedInteractions,
  buildEnhancedTenGodsSection,
} from '../packages/core/src/minglu/bazi-enhancer.ts';

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

  const baziResult = baziCalculator.calculateBazi({
    year: person.birthYear,
    month: person.birthMonth,
    day: person.birthDay,
    timeIndex: 5,
    gender: person.gender,
  });

  const article = buildMingluArticle({
    person,
    baziResult,
  });

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
  assert.ok(article.tableOfContents.some((item) => item.title.includes('全息神煞谱系')));
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
  assert.ok(firstCycle.careerAdvice);
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
  assert.equal(firstYear.months.length, 12);
  assert.ok(firstYear.months[0].solarTerm);
  assert.ok(firstYear.months[0].ganZhi);
  assert.ok(firstYear.months[0].commander);

  // 11. 术语百科词典
  assert.ok(article.glossary.length >= 20);
  assert.ok(article.statistics.totalSections >= 8);
  assert.ok(article.statistics.totalGlossaryEntries >= 20);
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
  assert.deepEqual(article.interactionsSection, []);
  assert.match(article.beginnerGuide?.strengthPlain ?? '', /旺衰、格局与喜忌暂不判定/);
});

test('命录岁运并临不应同时误判天地合或天克地冲，冲合判定须两字不同', () => {
  const baziResult = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'male',
  });
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
  const baziResult = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'male',
  });
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
});
