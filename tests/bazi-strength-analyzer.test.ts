import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeConstraint,
  analyzeDayMasterStrength,
  analyzeFormation,
  analyzeSeasonalStatus,
  analyzeSupport,
} from '@core/bazi/baziStrengthAnalyzer';
import { analyzeMonthQiProfile } from '@core/bazi/monthCommand';
import { analyzeTenGodStructure } from '@core/bazi/tenGodAnalysis';
import { getSeasonStatus, getTenGod, getWuxing } from '@core/bazi/baziUtils';
import { SEASON_STATUS } from '@core/bazi/baziDefinitions';
import type { Wuxing } from '@core/bazi/baziTypes';
import {
  collectCompleteBranchFormations,
  collectEstablishedBranchFormations,
} from '@core/bazi/baziFormationUtils';
import { WuxingCalculator } from '@core/bazi/WuxingCalculator';

test('月令司令天干应进入日主旺衰条件判断，避免辰戌丑未只按月支本气粗断', () => {
  const seasonalStatus = analyzeSeasonalStatus(
    '甲',
    '辰',
    getSeasonStatus,
    getWuxing as (value: string) => Wuxing,
    '乙',
  );
  const result = analyzeDayMasterStrength(
    seasonalStatus,
    { formations: [] },
    { roots: [], hasRoot: false, strongRoot: false },
    { supporters: [], hasSupport: false },
    { constraints: [], hasConstraint: false },
  );

  assert.equal(seasonalStatus.status, '囚');
  assert.equal(seasonalStatus.commanderEffect, '助身');
  assert.ok(!('score' in seasonalStatus));
  assert.ok(!('baseScore' in seasonalStatus));
  assert.ok(!('commanderScore' in seasonalStatus));
  assert.equal(result.details.seasonalEffect, '削弱');
  assert.equal(result.details.commanderEffect, '助身');
  assert.ok(!('score' in result));
  assert.ok(
    [
      'seasonalScore',
      'commanderScore',
      'formationStrength',
      'rootStrength',
      'supportStrength',
      'constraintStrength',
    ].every((field) => !(field in result.details)),
  );
});

test('月令气数应输出状态和司令依据，不伪造五行力量百分比', () => {
  const profile = analyzeMonthQiProfile('辰', '乙');
  const wood = profile.items.find((item) => item.element === '木');

  assert.ok(
    profile.items.some(
      (item) =>
        item.ruleBasis.length > 0 &&
        !('weightSharePercent' in item) &&
        item.score === undefined &&
        item.percent === undefined,
    ),
  );
  assert.ok(profile.leadingElements.includes('土'));
  assert.ok(profile.leadingElements.includes('木'));
  assert.ok((wood?.count ?? 0) >= 2);
  assert.equal(wood?.commanderApplied, true);
  assert.match(wood?.summary ?? '', /乙司令/);
  assert.match(wood?.summary ?? '', /不换算百分比/);
});

test('五行出现与缺失只登记天干和全部藏干事实，不输出任意结构优先结论', () => {
  const calculator = new WuxingCalculator();
  const pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    hour: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
  };

  const withCommander = calculator.calculateWuxingStrength(pillars, '癸');

  assert.deepEqual(withCommander.present, ['木', '火', '土', '金', '水']);
  assert.deepEqual(withCommander.missing, []);
  assert.ok(!('dominantByRule' in withCommander));
  assert.equal(withCommander.commanderElement, '水');
  assert.ok(withCommander.ruleBasis.some((item) => item.includes('全部藏干')));
  assert.ok(withCommander.ruleBasis.some((item) => item.includes('不据出现次数比较强弱')));
  assert.ok(withCommander.ruleBasis.some((item) => item.includes('不额外增加五行比例')));
});

test('藏干中未见的五行应明确列为缺失', () => {
  const result = new WuxingCalculator().calculateWuxingStrength({
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  });

  assert.deepEqual(result.present, ['木', '火', '土', '水']);
  assert.deepEqual(result.missing, ['金']);
  assert.equal(result.commanderElement, undefined);
});

test('五行结构入口应拒绝非法四柱和非法司令，不静默降级为未知五行', () => {
  const calculator = new WuxingCalculator();
  const pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
    hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
  };

  assert.throws(
    () =>
      calculator.calculateWuxingStrength({
        ...pillars,
        day: { gan: '甲', zhi: '丑', ganZhi: '甲丑' },
      }),
    /day柱不是有效六十甲子/,
  );
  assert.throws(() => calculator.calculateWuxingStrength(pillars, 'A'), /月令司权天干无效/);
});

test('月令气数应拒绝非法月支和司令天干，不应降级成平气', () => {
  assert.throws(() => analyzeMonthQiProfile('不存在'), /月支无效/);
  assert.throws(() => analyzeMonthQiProfile('辰', '不存在'), /司令天干无效/);
});

test('十神结构应按透干与藏支事实分类，不以隐藏权重裁定强弱', () => {
  const profile = analyzeTenGodStructure(
    [
      { gan: '甲', zhi: '子', hiddenStems: ['癸'] },
      { gan: '丙', zhi: '寅', hiddenStems: ['甲', '丙', '戊'] },
      { gan: '戊', zhi: '午', hiddenStems: ['丁', '己'] },
      { gan: '庚', zhi: '申', hiddenStems: ['庚', '壬', '戊'] },
    ],
    '戊',
    getTenGod,
  );

  assert.ok(profile.distributions.length > 0);
  assert.ok(profile.distributions.every((item) => item.totalCount >= 0));
  assert.ok(profile.distributions.every((item) => !('score' in item)));
  assert.ok(profile.familyDistributions.every((item) => !('score' in item)));
  assert.ok(profile.distributions.every((item) => item.tenGod !== '日主'));
  assert.equal(profile.distributions.find((item) => item.tenGod === '正财')?.status, '仅藏');
  assert.equal(profile.distributions.find((item) => item.tenGod === '食神')?.status, '透藏并见');
  assert.deepEqual(
    profile.familyDistributions.find((item) => item.family === '财才'),
    {
      family: '财才',
      visibleCount: 0,
      hiddenCount: 2,
      totalCount: 2,
      status: '仅藏',
    },
  );
});

test('无根失令但仍有帮扶时，整体旺衰应保留待综合判断', () => {
  const result = analyzeDayMasterStrength(
    { status: '休', isTimely: false },
    { formations: [] },
    { roots: [], hasRoot: false, strongRoot: false },
    {
      supporters: [{ position: 'hour', stem: '丁' }],
      hasSupport: true,
    },
    { constraints: [], hasConstraint: false },
  );

  assert.equal(result.status, '待综合判断');
  assert.equal(result.details.hasSupport, true);
  assert.ok(!('score' in result));
});

test('无根失令且无帮扶时，底层仍不自动裁定极弱', () => {
  const result = analyzeDayMasterStrength(
    { status: '休', isTimely: false },
    { formations: [] },
    { roots: [], hasRoot: false, strongRoot: false },
    { supporters: [], hasSupport: false },
    { constraints: [], hasConstraint: false },
  );

  assert.equal(result.status, '待综合判断');
  assert.ok(!('score' in result));
});

test('月令、司令、根气、帮扶、克泄耗与成局条件穷举时均不自动裁定整体旺衰', () => {
  const seasonalStatuses = ['旺', '相', '休', '囚', '死'];
  const commanderEffects = ['助身', '生身', '泄身', '耗身', '克身', '中性'] as const;
  const roots = [
    { roots: [], hasRoot: false, strongRoot: false },
    { roots: [{ position: 'day', branch: '辰' }], hasRoot: true, strongRoot: false },
    { roots: [{ position: 'day', branch: '寅' }], hasRoot: true, strongRoot: true },
  ];
  const formations = [
    { formations: [] },
    {
      formations: [
        {
          type: '三合',
          branches: ['亥', '卯', '未'],
          wuxing: '木' as const,
          effect: '助身' as const,
        },
      ],
    },
    {
      formations: [
        {
          type: '三合',
          branches: ['巳', '酉', '丑'],
          wuxing: '金' as const,
          effect: '克身' as const,
        },
      ],
    },
    {
      formations: [
        {
          type: '三合',
          branches: ['亥', '卯', '未'],
          wuxing: '木' as const,
          effect: '助身' as const,
        },
        {
          type: '三会',
          branches: ['巳', '午', '未'],
          wuxing: '火' as const,
          effect: '泄身' as const,
        },
      ],
    },
  ];

  let combinationCount = 0;
  seasonalStatuses.forEach((status) => {
    commanderEffects.forEach((commanderEffect) => {
      roots.forEach((rootAnalysis) => {
        [false, true].forEach((hasSupport) => {
          [false, true].forEach((hasConstraint) => {
            formations.forEach((formationAnalysis) => {
              const result = analyzeDayMasterStrength(
                { status, commanderEffect, isTimely: status === '旺' || status === '相' },
                formationAnalysis,
                rootAnalysis,
                {
                  supporters: hasSupport ? [{ position: 'hour', stem: '壬' }] : [],
                  hasSupport,
                },
                {
                  constraints: hasConstraint ? [{ position: 'year', stem: '庚' }] : [],
                  hasConstraint,
                },
              );

              combinationCount += 1;
              assert.equal(result.status, '待综合判断');
              assert.equal(result.details.hasRoot, rootAnalysis.hasRoot);
              assert.equal(result.details.hasStrongRoot, rootAnalysis.strongRoot);
              assert.equal(result.details.hasSupport, hasSupport);
              assert.equal(result.details.hasConstraint, hasConstraint);
              assert.equal(result.details.commanderEffect, commanderEffect);
            });
          });
        });
      });
    });
  });

  assert.equal(combinationCount, 1440);
});

test('根、透、克泄耗证据并见时不应按出现数量多数决', () => {
  const args = {
    seasonalStatus: {
      status: '囚',
      commanderEffect: '助身' as const,
      isTimely: false,
    },
    formationAnalysis: { formations: [] },
    rootAnalysis: {
      roots: [{ position: 'day', branch: '寅' }],
      hasRoot: true,
      strongRoot: true,
    },
    supportAnalysis: {
      supporters: [{ position: 'hour', stem: '壬' }],
      hasSupport: true,
    },
    constraintAnalysis: {
      constraints: [{ position: 'year', stem: '庚' }],
      hasConstraint: true,
    },
  };
  const result = analyzeDayMasterStrength(
    args.seasonalStatus,
    args.formationAnalysis,
    args.rootAnalysis,
    args.supportAnalysis,
    args.constraintAnalysis,
  );

  assert.equal(result.status, '待综合判断');
  assert.ok(Object.values(args).every((analysis) => !('score' in analysis)));
  assert.ok(Object.values(args).every((analysis) => !('totalStrength' in analysis)));
  assert.ok(result.details.ruleBasis.some((item) => item.includes('不按条件数量')));
});

test('印星落在地支主气或藏干时，也应计入帮扶，但不应把主气与同支本气重复计分', () => {
  const result = analyzeSupport(
    '甲',
    {
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      hour: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['辛'],
      day: ['丁', '己'],
      hour: ['壬', '甲'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.hasSupport, true);
  assert.equal(result.supporters.length, 2);
  assert.ok(result.supporters.every((item) => !('strength' in item)));
  assert.ok(!('totalStrength' in result));
  assert.ok(result.supporters.some((item) => item.stem === '申(壬)'));
  assert.ok(result.supporters.some((item) => item.stem === '亥'));
  assert.ok(!result.supporters.some((item) => item.stem === '亥(壬)'));
});

test('日支印星应计入帮扶，但日干自身不应重复计入', () => {
  const result = analyzeSupport(
    '甲',
    {
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['辛'],
      day: ['癸'],
      hour: ['丁', '己'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.hasSupport, true);
  assert.equal(result.supporters.length, 2);
  assert.ok(result.supporters.every((item) => !('strength' in item)));
  assert.ok(!('totalStrength' in result));
  assert.ok(result.supporters.some((item) => item.position === 'day' && item.stem === '子'));
  assert.ok(result.supporters.some((item) => item.stem === '申(壬)'));
  assert.ok(!result.supporters.some((item) => item.position === 'day' && item.stem === '甲'));
  assert.ok(!result.supporters.some((item) => item.stem === '子(癸)'));
});

test('克泄耗重压存在时仍只登记条件，不自动裁定极强', () => {
  const result = analyzeDayMasterStrength(
    { status: '旺', isTimely: true },
    { formations: [] },
    {
      roots: [
        { position: 'month', branch: '寅' },
        { position: 'day', branch: '卯' },
      ],
      hasRoot: true,
      strongRoot: true,
    },
    { supporters: [], hasSupport: false },
    {
      constraints: [
        { position: 'year', stem: '庚' },
        { position: 'hour', stem: '辛' },
        { position: 'year', stem: '申' },
      ],
      hasConstraint: true,
    },
  );

  assert.equal(result.status, '待综合判断');
  assert.equal(result.details.hasConstraint, true);
});

test('三合三会成局时，旺衰条件应记录成局助势，而不是只按单个地支零散看待', () => {
  const result = analyzeFormation(
    '甲',
    {
      year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
      month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '辛', zhi: '未', ganZhi: '辛未' },
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.formations.length, 1);
  assert.equal(result.formations[0]?.type, '三合');
  assert.equal(result.formations[0]?.effect, '助身');
  assert.ok(result.formations.every((item) => !('strength' in item)));
  assert.ok(!('totalStrength' in result));
});

test('三合三会三支齐全但月令不支持时，只记录结构，不应计入成势力量', () => {
  const pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    day: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    hour: { gan: '辛', zhi: '未', ganZhi: '辛未' },
  };

  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 0);
  assert.deepEqual(analyzeFormation('丁', pillars, getWuxing as (value: string) => Wuxing), {
    formations: [],
  });
});

test('三合三会被局外地支冲破时，只记录结构，不应计入成势力量', () => {
  const pillars = {
    year: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    month: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    day: { gan: '辛', zhi: '未', ganZhi: '辛未' },
    hour: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
  };

  assert.equal(collectCompleteBranchFormations(pillars).length, 1);
  assert.equal(collectEstablishedBranchFormations(pillars).length, 0);
  assert.deepEqual(analyzeFormation('辛', pillars, getWuxing as (value: string) => Wuxing), {
    formations: [],
  });
});

test('克泄耗一方三合成局不能抹去已经存在的帮扶证据', () => {
  const formation = analyzeFormation(
    '甲',
    {
      year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '己', zhi: '巳', ganZhi: '己巳' },
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );
  const result = analyzeDayMasterStrength(
    { status: '休', isTimely: false },
    formation,
    { roots: [], hasRoot: false, strongRoot: false },
    {
      supporters: [{ position: 'month', stem: '己' }],
      hasSupport: true,
    },
    { constraints: [], hasConstraint: false },
  );

  assert.equal(formation.formations[0]?.effect, '克身');
  assert.ok(formation.formations.every((item) => !('strength' in item)));
  assert.ok(!('totalStrength' in formation));
  assert.equal(result.details.formationEffect, '削弱');
  assert.equal(result.status, '待综合判断');
});

test('无根失令但扶身一方已经成局时，应保留综合判断而不直接判弱', () => {
  const result = analyzeDayMasterStrength(
    { status: '死', isTimely: false },
    {
      formations: [
        {
          type: '三合',
          branches: ['申', '子', '辰'],
          wuxing: '水',
          effect: '生身',
        },
      ],
    },
    { roots: [], hasRoot: false, strongRoot: false },
    { supporters: [], hasSupport: false },
    {
      constraints: [{ position: 'year', stem: '庚' }],
      hasConstraint: true,
    },
  );

  assert.equal(result.status, '待综合判断');
  assert.equal(result.details.formationEffect, '支持');
});

test('财官食伤在天干地支成势时，也应计入克泄耗', () => {
  const result = analyzeConstraint(
    '甲',
    {
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
      day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['丁', '己'],
      day: ['甲', '丙', '戊'],
      hour: ['戊', '乙', '癸'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.hasConstraint, true);
  assert.ok(result.constraints.every((item) => !('strength' in item)));
  assert.ok(!('totalStrength' in result));
  assert.ok(result.constraints.some((item) => item.stem === '庚'));
  assert.ok(result.constraints.some((item) => item.stem === '申'));
  assert.ok(result.constraints.some((item) => item.stem === '午'));
  assert.ok(result.constraints.some((item) => item.stem === '戊'));
});

test('克泄耗统计不应把地支主气与同支本气藏干重复计入', () => {
  const result = analyzeConstraint(
    '甲',
    {
      year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
      month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
      day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      hour: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['丁', '己'],
      day: ['甲', '丙', '戊'],
      hour: ['辛'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.ok(result.constraints.some((item) => item.stem === '申'));
  assert.ok(result.constraints.some((item) => item.stem === '酉'));
  assert.ok(!result.constraints.some((item) => item.stem === '申(庚)'));
  assert.ok(!result.constraints.some((item) => item.stem === '酉(辛)'));
});

test('旺衰分析器应拒绝坏输入，不应把缺失旺衰或未知五行按零分继续计算', () => {
  assert.throws(
    () =>
      analyzeSeasonalStatus(
        '甲',
        '辰',
        () => ({ 木: '未知状态' }),
        getWuxing as (value: string) => Wuxing,
      ),
    /月令旺衰状态无效/,
  );
  assert.throws(
    () => analyzeSeasonalStatus('甲', '辰', () => ({}), getWuxing as (value: string) => Wuxing),
    /月令旺衰数据缺失/,
  );
  assert.throws(
    () => analyzeSeasonalStatus('甲', '辰', getSeasonStatus, () => '未知' as Wuxing),
    /日主五行无效/,
  );
  assert.throws(
    () =>
      analyzeSupport(
        '乙',
        {
          year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
          month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
          day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
          hour: { gan: '辛', zhi: '亥', ganZhi: '辛亥' },
        },
        {
          year: ['庚', '壬', '戊'],
          month: ['辛'],
          day: ['癸'],
          hour: ['壬', '甲'],
        },
        getWuxing as (value: string) => Wuxing,
      ),
    /日主与日柱天干不一致/,
  );
  assert.throws(
    () =>
      analyzeConstraint(
        '甲',
        {
          year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
          month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
          day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
          hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        },
        {
          year: ['庚', '壬', '戊'],
          month: ['风'],
          day: ['甲', '丙', '戊'],
          hour: ['戊', '乙', '癸'],
        },
        getWuxing as (value: string) => Wuxing,
      ),
    /month柱藏干无效/,
  );
  assert.throws(
    () =>
      analyzeConstraint(
        '甲',
        {
          year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
          month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
          day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
          hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        },
        {
          year: ['庚', '壬', '戊'],
          month: ['丁', '己'],
          day: ['甲', '丙', '戊'],
          hour: ['戊', '癸', '乙'],
        },
        getWuxing as (value: string) => Wuxing,
      ),
    /hour柱藏干与地支辰不一致/,
  );
});
