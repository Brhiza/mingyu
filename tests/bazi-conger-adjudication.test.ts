import assert from 'node:assert/strict';
import test from 'node:test';

import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter.ts';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { assessCongErPattern } from '../packages/core/src/bazi/baziCongErStrategy.ts';
import { SIXTY_CYCLE } from '../packages/core/src/bazi/baziDefinitions.ts';
import { determinePattern } from '../packages/core/src/bazi/baziPatternStrategy.ts';
import type { Pillars } from '../packages/core/src/bazi/baziTypes.ts';
import { getTenGod } from '../packages/core/src/bazi/baziUtils.ts';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer.ts';
import { buildBaziPromptForResult } from '../packages/core/src/prompt/public-api.ts';

const POSITIONS = ['year', 'month', 'day', 'hour'] as const;
const CLASSIC_INPUT = {
  year: 1987,
  month: 2,
  day: 23,
  timeIndex: 4,
  gender: 'male' as const,
  isLunar: false,
};

function makePillars(values: [string, string, string, string]): Pillars {
  values.forEach((ganZhi) => assert.ok(SIXTY_CYCLE.includes(ganZhi), `${ganZhi}须为六十甲子`));
  return Object.fromEntries(
    POSITIONS.map((position, index) => [
      position,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}

test('经典丁卯壬寅癸卯丙辰由完整历法链裁为从儿，不受身弱标签与辰藏官误阻', () => {
  const chart = baziCalculator.calculateBazi(CLASSIC_INPUT);
  const special = chart.analysis.mingGe.specialAdjudication;

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['丁卯', '壬寅', '癸卯', '丙辰'],
  );
  assert.equal(chart.analysis.dayMasterStrength.status, '身弱');
  assert.equal(chart.analysis.mingGe.pattern, '从儿格');
  assert.equal(chart.analysis.mingGe.isSpecial, true);
  assert.equal(special?.kind, '从儿格');
  assert.equal(special?.status, '成立');
  assert.equal(special?.route, '三会食伤成气');
  if (special?.kind !== '从儿格') assert.fail('应返回从儿结构化裁决');
  assert.deepEqual(special.visibleWealthStems, ['丁', '丙']);
  assert.match(special.functionalResolutions.join('；'), /年干丁与月干壬紧贴合木/);
  assert.match(special.retainedHiddenFacts.join('；'), /辰藏戊正官/);
  assert.deepEqual(special.blockers, []);

  const useful = chart.analysis.usefulGod;
  assert.deepEqual(useful.favorableWuxing, ['火', '木']);
  assert.deepEqual(useful.unfavorableWuxing, ['金', '土']);
  assert.equal(useful.primaryUseful, '财星');
  assert.equal(useful.primaryAvoid, '印星');
  assert.equal(useful.decisionEvidence?.base.ruleId, 'follow-conger');
  assert.equal(
    useful.favorable.some((item) => ['正官', '七杀'].includes(item)),
    false,
  );
  assert.equal(
    useful.unfavorable.some((item) => ['比肩', '劫财'].includes(item)),
    false,
  );
});

test('从儿裁决不读取人工旺衰枚举作为入口或否决条件', () => {
  const chart = baziCalculator.calculateBazi(CLASSIC_INPUT);
  for (const strength of ['极强', '身强', '偏强', '中和', '偏弱', '身弱', '极弱']) {
    const pattern = determinePattern(chart.pillars, strength, getTenGod, chart.monthCommander);
    assert.equal(pattern.pattern, '从儿格', `${strength}不应改变已证食伤顺局`);
    assert.equal(pattern.specialAdjudication?.status, '成立');
  }
});

test('原典非食伤月例按食伤并透坐支同气路径成立，藏财结构根可承接', () => {
  const woodDay = assessCongErPattern(makePillars(['甲午', '丁丑', '甲午', '丙寅']), getTenGod);
  const fireDay = assessCongErPattern(makePillars(['己未', '丁丑', '丙戌', '戊戌']), getTenGod);
  const earthDay = assessCongErPattern(makePillars(['庚子', '庚辰', '戊申', '辛酉']), getTenGod);

  assert.equal(woodDay.established, true);
  assert.equal(woodDay.route, '食伤并透坐支同气');
  assert.match(woodDay.matchedConditions.join('；'), /丑藏己本气.*结构财气/);
  assert.equal(fireDay.established, true);
  assert.match(fireDay.adjudication?.wealthRootFacts.join('；') || '', /丑藏辛正库/);
  assert.equal(earthDay.established, true);
  assert.match(earthDay.matchedConditions.join('；'), /子藏癸本气.*结构财气/);
});

test('辛财轻根与癸比肩争财只记原局质量，不把已证从儿结构判作不成立', () => {
  const lightWealth = assessCongErPattern(makePillars(['己未', '辛未', '丙戌', '戊戌']), getTenGod);
  const companionCompetes = assessCongErPattern(
    makePillars(['丁巳', '癸卯', '癸卯', '丙辰']),
    getTenGod,
  );

  assert.equal(lightWealth.established, true);
  assert.match(lightWealth.adjudication?.wealthRootFacts.join('；') || '', /戌藏辛余气/);
  assert.equal(companionCompetes.established, true);
  assert.equal(
    companionCompetes.blockers.some((item) => /比肩|争财/.test(item)),
    false,
  );
});

test('顺局章九个原典命例均由月建、成局或食伤并透坐支同气的结构路径闭合', () => {
  const examples: Array<{
    pillars: [string, string, string, string];
    route: NonNullable<ReturnType<typeof assessCongErPattern>['route']>;
  }> = [
    { pillars: ['丁卯', '壬寅', '癸卯', '丙辰'], route: '三会食伤成气' },
    { pillars: ['丁巳', '癸卯', '癸卯', '丙辰'], route: '月建食伤当权' },
    { pillars: ['己未', '丁丑', '丙戌', '戊戌'], route: '月建食伤当权' },
    { pillars: ['己未', '辛未', '丙戌', '戊戌'], route: '月建食伤当权' },
    { pillars: ['甲午', '丁丑', '甲午', '丙寅'], route: '食伤并透坐支同气' },
    { pillars: ['辛丑', '辛丑', '戊申', '壬子'], route: '食伤并透坐支同气' },
    { pillars: ['庚子', '庚辰', '戊申', '辛酉'], route: '食伤并透坐支同气' },
    { pillars: ['壬寅', '辛亥', '辛亥', '壬辰'], route: '月建食伤当权' },
    { pillars: ['壬子', '辛亥', '辛卯', '辛卯'], route: '月建食伤当权' },
  ];

  for (const example of examples) {
    const assessment = assessCongErPattern(makePillars(example.pillars), getTenGod);
    assert.equal(assessment.established, true, example.pillars.join(' '));
    assert.equal(assessment.route, example.route, example.pillars.join(' '));
    assert.equal(assessment.blockers.length, 0, example.pillars.join(' '));
  }
});

test('从儿与从财按财气归宿裁决，不把同章三个从财原例误抢为从儿', () => {
  const examples = [
    {
      input: { year: 2018, month: 5, day: 3, timeIndex: 10, gender: 'male' as const },
      pillars: ['戊戌', '丙辰', '乙未', '丙戌'],
      route: '四支本气皆财',
    },
    {
      input: { year: 1962, month: 2, day: 21, timeIndex: 2, gender: 'male' as const },
      pillars: ['壬寅', '壬寅', '庚寅', '戊寅'],
      route: '四支本气皆财',
    },
    {
      input: { year: 1926, month: 2, day: 22, timeIndex: 5, gender: 'male' as const },
      pillars: ['丙寅', '庚寅', '壬午', '乙巳'],
      route: '食伤当令而财归日时',
    },
  ] as const;

  for (const example of examples) {
    const chart = baziCalculator.calculateBazi({ ...example.input, isLunar: false });
    const assessment = assessCongErPattern(chart.pillars, getTenGod, chart.monthCommander);

    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      example.pillars,
    );
    assert.equal(assessment.competingPattern?.route, example.route);
    assert.equal(chart.analysis.mingGe.pattern, '从财格');
    assert.equal(chart.analysis.mingGe.isSpecial, true);
    assert.match(chart.analysis.mingGe.basis || '', /《滴天髓阐微·从象》从财法成立/);
  }

  const disputed = baziCalculator.calculateBazi({
    year: 1926,
    month: 2,
    day: 22,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
  });
  const disputedAssessment = assessCongErPattern(
    disputed.pillars,
    getTenGod,
    disputed.monthCommander,
  );
  assert.equal(disputedAssessment.established, false);
  assert.match(disputedAssessment.blockers.join('；'), /顺生归宿在财，应先按从财裁决/);
});

test('四支本气皆财仍须食伤明透引通，不以财支数量单独升级从财', () => {
  const noVisibleOutput = makePillars(['戊戌', '壬辰', '乙未', '己丑']);
  const assessment = assessCongErPattern(noVisibleOutput, getTenGod);
  const pattern = determinePattern(noVisibleOutput, '身弱', getTenGod);

  assert.equal(assessment.competingPattern, undefined);
  assert.notEqual(pattern.pattern, '从财格');
});

test('四支本气皆财但印比明透并有可用同类根时不越过实际扶身直接从财', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2012,
    month: 4,
    day: 4,
    timeIndex: 10,
    gender: 'male',
    isLunar: false,
  });
  const assessment = assessCongErPattern(chart.pillars, getTenGod, chart.monthCommander);

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['壬辰', '甲辰', '乙未', '丙戌'],
  );
  assert.equal(assessment.competingPattern, undefined);
  assert.notEqual(chart.analysis.mingGe.pattern, '从财格');
});

test('食伤月令的财归日时路径仍排除无根透比争财，不以日主无根代替同党核验', () => {
  const visibleCompanion = assessCongErPattern(
    makePillars(['丙寅', '壬寅', '壬午', '乙巳']),
    getTenGod,
  );

  assert.equal(visibleCompanion.competingPattern, undefined);
  assert.equal(visibleCompanion.established, true);
});

test('非食伤月仅一位食伤透根的普通伤官生财不被泛化为从儿', () => {
  const ordinary = makePillars(['丁卯', '己丑', '甲寅', '戊辰']);
  const assessment = assessCongErPattern(ordinary, getTenGod);
  const pattern = determinePattern(ordinary, '身弱', getTenGod);

  assert.equal(assessment.structuralMatch, false);
  assert.notEqual(pattern.pattern, '从儿格');
  assert.equal(pattern.specialAdjudication?.kind, undefined);
});

test('月建食伤不因日支比肩或年时主气位置被加上无原典依据的非对称门槛', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1987,
    month: 7,
    day: 5,
    timeIndex: 6,
    gender: 'female',
    isLunar: false,
  });
  const assessment = assessCongErPattern(chart.pillars, getTenGod, chart.monthCommander);

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['丁卯', '丙午', '乙卯', '壬午'],
  );
  assert.equal(assessment.structuralMatch, true);
  assert.equal(assessment.route, '月建食伤当权');
  assert.equal(assessment.established, true);
  assert.equal(assessment.blockers.length, 0);
  assert.equal(chart.analysis.mingGe.pattern, '从儿格');
  assert.equal(chart.analysis.mingGe.isSpecial, true);
});

test('月干印星有根并同柱制月建食伤时构成实际反证，完整历法链回落普通格', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2021,
    month: 4,
    day: 4,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
  });

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['辛丑', '辛卯', '壬午', '乙巳'],
  );
  assert.notEqual(chart.analysis.mingGe.pattern, '从儿格');
  assert.equal(chart.analysis.mingGe.specialAdjudication?.status, '不成立');
  assert.match(
    chart.analysis.mingGe.specialAdjudication?.blockers.join('；') || '',
    /月干辛正印明透有根.*实际制约/,
  );
});

test('合成位置单元区分月建与司权，并要求财星有可用根才可制印救应', () => {
  const monthBuild = makePillars(['丙午', '甲寅', '癸卯', '丁巳']);
  const monthBuildAssessment = assessCongErPattern(monthBuild, getTenGod, '丙');
  const resourceWithRemedy = assessCongErPattern(
    makePillars(['丁巳', '辛卯', '癸卯', '乙巳']),
    getTenGod,
  );
  const rootlessWealthCannotRescue = assessCongErPattern(
    makePillars(['丁丑', '辛卯', '癸卯', '乙亥']),
    getTenGod,
  );

  assert.equal(monthBuildAssessment.established, true);
  assert.equal(monthBuildAssessment.route, '月建食伤当权');
  assert.match(monthBuildAssessment.matchedConditions.join('；'), /月支寅本气甲为伤官/);
  assert.match(
    monthBuildAssessment.matchedConditions.join('；'),
    /分日司权丙为正财仅作当日月气事实/,
  );
  assert.equal(resourceWithRemedy.established, true);
  assert.match(
    resourceWithRemedy.matchedConditions.join('；'),
    /年干丁财星有可用根，紧贴制月干辛偏印，印夺食有救/,
  );
  assert.equal(resourceWithRemedy.blockers.length, 0);
  assert.equal(rootlessWealthCannotRescue.established, false);
  assert.match(rootlessWealthCannotRescue.blockers.join('；'), /月干辛偏印.*实际制约/);
  assert.doesNotMatch(rootlessWealthCannotRescue.matchedConditions.join('；'), /印夺食有救/);
});

test('合法完整历法输入中有根财星紧贴制印，解除月干印星对月建食伤的制约', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1966,
    month: 2,
    day: 23,
    timeIndex: 3,
    gender: 'male',
    isLunar: false,
  });

  assert.deepEqual(
    Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
    ['丙午', '庚寅', '癸丑', '乙卯'],
  );
  assert.equal(chart.analysis.mingGe.pattern, '从儿格');
  assert.equal(chart.analysis.mingGe.specialAdjudication?.status, '成立');
  assert.match(
    chart.analysis.mingGe.specialAdjudication?.functionalResolutions.join('；') || '',
    /年干丙财星有可用根，紧贴制月干庚正印，印夺食有救/,
  );
});

test('合法完整历法输入按五合终局区分破合后的原干作用与合绊未决救应', () => {
  const clashBreak = baziCalculator.calculateBazi({
    year: 1906,
    month: 3,
    day: 10,
    timeIndex: 3,
    gender: 'male',
    isLunar: false,
  });
  const bound = baziCalculator.calculateBazi({
    year: 1906,
    month: 3,
    day: 10,
    timeIndex: 2,
    gender: 'male',
    isLunar: false,
  });

  assert.deepEqual(
    Object.values(clashBreak.pillars).map((pillar) => pillar.ganZhi),
    ['丙午', '辛卯', '癸丑', '乙卯'],
  );
  assert.equal(clashBreak.analysis.mingGe.pattern, '从儿格');
  assert.match(
    clashBreak.analysis.mingGe.specialAdjudication?.functionalResolutions.join('；') || '',
    /丙辛五合逢冲破合，保留原干作用；年干丙财星有可用根.*印夺食有救/,
  );

  assert.deepEqual(
    Object.values(bound.pillars).map((pillar) => pillar.ganZhi),
    ['丙午', '辛卯', '癸丑', '甲寅'],
  );
  assert.notEqual(bound.analysis.mingGe.pattern, '从儿格');
  assert.match(
    bound.analysis.mingGe.specialAdjudication?.blockers.join('；') || '',
    /月干辛偏印.*实际制约；年干丙与月干辛合而不化.*未据此认定财制印有救/,
  );
});

test('真实历法输入的支藏印星救应不误作同柱明透天干五合', () => {
  const examples = [
    { input: [2008, 6, 3, 6], pillars: ['戊子', '丁巳', '甲戌', '庚午'], hidden: '年柱子藏癸正印' },
    { input: [2008, 7, 3, 7], pillars: ['戊子', '戊午', '甲辰', '辛未'], hidden: '年柱子藏癸正印' },
    { input: [2014, 3, 3, 3], pillars: ['甲午', '丙寅', '癸酉', '乙卯'], hidden: '日柱酉藏辛偏印' },
  ] as const;

  for (const { input, pillars, hidden } of examples) {
    const [year, month, day, timeIndex] = input;
    const chart = baziCalculator.calculateBazi({
      year,
      month,
      day,
      timeIndex,
      gender: 'male',
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
    });
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      pillars,
    );
    const resolutions =
      chart.analysis.mingGe.specialAdjudication?.functionalResolutions.join('；') || '';
    assert.match(resolutions, new RegExp(`制${hidden}，印夺食有救`));
    assert.doesNotMatch(resolutions, /戊癸五合|丙辛五合|年干癸|日干辛/);
  }
});

test('合成位置单元不把甲己等其余天干五合泛化成从儿顺局的已解决作用', () => {
  const unsupportedHarmony = assessCongErPattern(
    makePillars(['甲寅', '己未', '丙辰', '庚申']),
    getTenGod,
  );

  assert.equal(unsupportedHarmony.established, false);
  assert.match(unsupportedHarmony.blockers.join('；'), /年干甲偏印.*实际制约/);
  assert.doesNotMatch(
    unsupportedHarmony.adjudication?.functionalResolutions.join('；') || '',
    /甲.*己.*合土/,
  );
});

test('三个原典非首例由真实历法输入进入同一从儿裁决，不依赖强制旺衰', () => {
  const examples = [
    {
      input: { year: 1955, month: 2, day: 2, timeIndex: 2, gender: 'male' as const },
      pillars: ['甲午', '丁丑', '甲午', '丙寅'],
      strength: '偏弱',
    },
    {
      input: { year: 1900, month: 4, day: 5, timeIndex: 9, gender: 'male' as const },
      pillars: ['庚子', '庚辰', '戊申', '辛酉'],
      strength: '中和',
    },
    {
      input: { year: 1920, month: 1, day: 29, timeIndex: 10, gender: 'male' as const },
      pillars: ['己未', '丁丑', '丙戌', '戊戌'],
      strength: '身弱',
    },
  ];

  for (const example of examples) {
    const chart = baziCalculator.calculateBazi({ ...example.input, isLunar: false });
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      example.pillars,
    );
    assert.equal(chart.analysis.dayMasterStrength.status, example.strength);
    assert.equal(chart.analysis.mingGe.pattern, '从儿格');
    assert.equal(chart.analysis.mingGe.specialAdjudication?.status, '成立');
  }
});

test('缺少财星承接或明透有根印官形成实际逆局时回落普通格并保留明确反证', () => {
  const noWealth = makePillars(['乙卯', '乙卯', '癸亥', '乙卯']);
  const activeResource = makePillars(['庚申', '乙卯', '癸亥', '丙辰']);
  const activeOfficer = makePillars(['戊辰', '乙卯', '癸亥', '丙辰']);

  const noWealthPattern = determinePattern(noWealth, '极弱', getTenGod);
  const resourcePattern = determinePattern(activeResource, '极弱', getTenGod);
  const officerPattern = determinePattern(activeOfficer, '极弱', getTenGod);

  assert.notEqual(noWealthPattern.pattern, '从儿格');
  assert.notEqual(noWealthPattern.pattern, '从势格');
  assert.equal(noWealthPattern.specialAdjudication?.status, '不成立');
  assert.match(noWealthPattern.basis || '', /未见财星.*承接食伤/);
  assert.notEqual(resourcePattern.pattern, '从儿格');
  assert.match(resourcePattern.specialAdjudication?.blockers.join('；') || '', /正印.*实际制约/);
  assert.notEqual(officerPattern.pattern, '从儿格');
  assert.match(
    officerPattern.specialAdjudication?.blockers.join('；') || '',
    /正官.*财星顺生转向官杀/,
  );
});

test('月建食伤路径仍受异柱明透有根印星制约，不把普通食神格破格升级成从儿', () => {
  const ordinaryBroken = makePillars(['丙申', '己巳', '甲子', '壬申']);
  const assessment = assessCongErPattern(ordinaryBroken, getTenGod, '丙');
  const pattern = determinePattern(ordinaryBroken, '身弱', getTenGod, '丙');

  assert.equal(assessment.established, false);
  assert.match(assessment.blockers.join('；'), /时干壬偏印.*实际制约/);
  assert.equal(pattern.pattern, '食神格');
  assert.equal(pattern.specialAdjudication?.status, '不成立');
});

test('格式化、提示词与命录消费同一从儿终局和取用，不泄露内部字段名', () => {
  const chart = baziCalculator.calculateBazi(CLASSIC_INPUT);
  const chartText = formatBaziForPrompt(chart);
  const prompt = buildBaziPromptForResult({ result: chart, question: '请分析本命格局与取用。' });
  const minglu = buildEnhancedPatternUsefulGodSection(chart);

  assert.match(prompt, /格局: 从儿格（[^\n]*从儿法成立：三会食伤成气/);
  assert.doesNotMatch(prompt, /特殊格裁决：从儿格成立/);
  assert.equal(prompt.match(/三会食伤成气/g)?.length, 1);
  assert.equal(prompt.match(/《滴天髓阐微·顺局》从儿法/g)?.length, 1);
  assert.match(prompt, /从儿五行流向：食伤木生财火/);
  assert.equal(prompt.match(/年干丁与月干壬紧贴合木/g)?.length, 1);
  assert.doesNotMatch(prompt, /顺局作用：年干丁与月干壬紧贴合木/);
  assert.doesNotMatch(prompt, /支藏印官未构成从儿格的实际反证/);
  assert.doesNotMatch(prompt, /原支藏印官事实：/);
  assert.match(prompt, /取用: 主用火，辅木/);
  assert.doesNotMatch(prompt, /specialAdjudication|functionalResolutions|retainedHiddenFacts/);
  assert.match(chartText, /格局: 从儿格/);
  assert.equal(minglu.pattern.name, '从儿格');
  assert.deepEqual(minglu.pattern.specialAdjudication, chart.analysis.mingGe.specialAdjudication);
  assert.equal(minglu.usefulGods.usefulGodCategory, '从儿顺局');
  assert.match(minglu.usefulGods.reasoning, /财星、食伤顺局/);
});
