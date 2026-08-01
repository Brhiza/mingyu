import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthBranch, HeavenStem, SixtyCycle } from 'tyme4ts';
import { BASIC_MAPPINGS as appBaziMappings } from '@core/bazi/baziMappingsData';
import {
  BASIC_MAPPINGS as coreBaziMappings,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  HIDDEN_STEMS,
  MONTH_COMMANDER as coreMonthCommander,
  NAYIN_MAP,
  SIXTY_CYCLE,
  TWELVE_STAGES_MAP,
} from '../packages/core/src/bazi/baziMappingsData';
import { MONTH_COMMANDER as appMonthCommander } from '@core/bazi/baziMappingsData';
import { TIAN_GAN_CHONG as appDivinationChong } from '../packages/core/src/divination/algorithms/_shared/wuxing';
import {
  BRANCH_HIDDEN_STEMS,
  LIUCHONG_MAP,
  LIUHAI_MAP,
  LIUHE_MAP,
  COMPLETE_SANXING_GROUPS,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  TIAN_GAN_HE as coreDivinationGanHe,
  TIAN_GAN_CHONG as coreDivinationChong,
  getBranchWuxing,
  getHiddenMainStem,
  getSeasonState,
  isHalfSanhe,
  isSanheArch,
  findCompleteSanxingGroups,
  isLiupo,
  isSanxing,
  getWuxingChangSheng,
} from '../packages/core/src/divination/algorithms/_shared/wuxing';
import { analyzeLifeStageProfile } from '../packages/core/src/bazi/lifeStageAnalysis';
import { analyzeNayinProfile } from '../packages/core/src/bazi/nayinAnalysis';
import { getLifeStage as getBaziValueLifeStage } from '../packages/core/src/bazi/baziValues';
import { analyzeRelationStructure } from '../packages/core/src/bazi/relationStructure';
import { analyzePillarRelations } from '../packages/core/src/bazi/baziPromptEnhancement';
import {
  analyzeExposedStemProfile,
  analyzeStemRootProfile,
} from '../packages/core/src/bazi/stemRootAnalysis';
import { analyzeTombStorage } from '../packages/core/src/bazi/tombStorage';
import {
  getSeasonStatus,
  getTenGod,
  getTenGodForBranch,
  getWuxing,
} from '../packages/core/src/bazi/baziUtils';
import { analyzeGanzhiInteractions as analyzeAppQimenGanzhi } from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { analyzeGanzhiInteractions as analyzeCoreQimenGanzhi } from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { LIU_HE_BRANCH as ziweiLiuHeBranch } from '../packages/core/src/ziwei/iztro/build-analysis-payload/helpers/palace-lookup';
import { buildFortuneSelectionContext } from '@core/bazi/fortuneSelection';
import type { BaziChartResult } from '@core/bazi/baziTypes';

function createFortuneMockResult(): BaziChartResult {
  return {
    pillars: {
      year: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    },
    dayMaster: {
      gan: '甲',
      element: '木',
      yinYang: '阳',
    },
    luckInfo: {
      startInfo: '',
      handoverInfo: '',
      cycles: [
        {
          age: 8,
          year: 2008,
          ganZhi: '甲子',
          isXiaoyun: false,
          type: '大运',
          years: [
            {
              year: 2008,
              age: 8,
              ganZhi: '戊子',
              tenGod: '',
              tenGodZhi: '',
            },
          ],
        },
      ],
    },
  } as BaziChartResult;
}

test('天干相冲按主流传统口径不应包含戊己冲', () => {
  for (const chongMap of [
    appBaziMappings.TIAN_GAN_CHONG,
    coreBaziMappings.TIAN_GAN_CHONG,
    appDivinationChong,
    coreDivinationChong,
  ]) {
    assert.equal(chongMap.甲, '庚');
    assert.equal(chongMap.乙, '辛');
    assert.equal(chongMap.丙, '壬');
    assert.equal(chongMap.丁, '癸');
    assert.equal(chongMap.戊, undefined);
    assert.equal(chongMap.己, undefined);
  }
});

test('奇门干支互动不应把戊己识别为天干相冲', () => {
  const ganzhi = {
    year: '戊子',
    month: '己丑',
    day: '甲寅',
    hour: '庚申',
  };

  for (const analyze of [analyzeAppQimenGanzhi, analyzeCoreQimenGanzhi]) {
    const stemChong = analyze(ganzhi).filter((item) => item.type === '天干相冲');
    assert.ok(stemChong.some((item) => item.values.join('') === '甲庚'));
    assert.ok(!stemChong.some((item) => item.values.join('') === '戊己'));
  }
});

test('奇门干支互动只登记子卯、自刑与三支齐见的完整三刑结构', () => {
  const partial = {
    year: '乙巳',
    month: '丙寅',
    day: '丁未',
    hour: '戊戌',
  };

  for (const analyze of [analyzeAppQimenGanzhi, analyzeCoreQimenGanzhi]) {
    assert.equal(analyze(partial).filter((item) => item.type === '相刑').length, 0);

    const complete = analyze({
      year: '甲寅',
      month: '己巳',
      day: '壬申',
      hour: '戊辰',
    }).filter((item) => item.type === '相刑');
    assert.equal(complete.length, 1);
    assert.deepEqual(complete[0].values, ['寅', '巳', '申']);
    assert.match(complete[0].description, /无恩之刑.*三支齐见.*不把任意两支自动命名/);
  }
});

test('奇门四柱两两关系应穷举六十甲子乘六十甲子并拒绝半合拱局旁路', () => {
  const selfPunishments = new Set(['辰', '午', '酉', '亥']);

  for (const first of SIXTY_CYCLE) {
    for (const second of SIXTY_CYCLE) {
      const firstBranch = first.charAt(1);
      const secondBranch = second.charAt(1);
      const excludedBranches = new Set([firstBranch, secondBranch]);
      const fillers = SIXTY_CYCLE.filter(
        (ganZhi, index, values) =>
          !excludedBranches.has(ganZhi.charAt(1)) &&
          values.findIndex((item) => item.charAt(1) === ganZhi.charAt(1)) === index,
      ).slice(0, 2);
      const relations = analyzeCoreQimenGanzhi({
        year: first,
        month: second,
        day: fillers[0],
        hour: fillers[1],
      });
      const actual = new Set(
        relations
          .filter(
            (item) =>
              item.pillars.length === 2 &&
              item.pillars.includes('year') &&
              item.pillars.includes('month'),
          )
          .map((item) => item.type),
      );
      const expected = new Set<string>();

      if (LIUHE_MAP[firstBranch] === secondBranch) expected.add('六合');
      if (LIUCHONG_MAP[firstBranch] === secondBranch) expected.add('六冲');
      if (LIUHAI_MAP[firstBranch] === secondBranch) expected.add('相害');
      if (
        (firstBranch === '子' && secondBranch === '卯') ||
        (firstBranch === '卯' && secondBranch === '子') ||
        (firstBranch === secondBranch && selfPunishments.has(firstBranch))
      ) {
        expected.add('相刑');
      }
      if (coreDivinationGanHe[first.charAt(0)]?.partner === second.charAt(0)) {
        expected.add('天干五合');
      }
      if (coreDivinationChong[first.charAt(0)] === second.charAt(0)) {
        expected.add('天干相冲');
      }

      assert.deepEqual([...actual].sort(), [...expected].sort(), `${first}与${second}的固定关系`);
      assert.ok(relations.every((item) => !['半合', '拱局'].includes(item.type)));
    }
  }
});

test('奇门完整三合与三刑应覆盖全部支组排列并保留重复支柱位', () => {
  const representativeByBranch = Object.fromEntries(
    EARTHLY_BRANCHES.map((branch) => [
      branch,
      SIXTY_CYCLE.find((ganZhi) => ganZhi.charAt(1) === branch)!,
    ]),
  );
  const uniquePermutations = (values: string[]): string[][] => {
    if (values.length <= 1) return [values];
    const results = new Map<string, string[]>();
    values.forEach((value, index) => {
      for (const tail of uniquePermutations(values.filter((_, current) => current !== index))) {
        const result = [value, ...tail];
        results.set(result.join('|'), result);
      }
    });
    return [...results.values()];
  };

  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    for (const branches of uniquePermutations([...members, members[0]])) {
      const [year, month, day, hour] = branches.map((branch) => representativeByBranch[branch]);
      const matches = analyzeCoreQimenGanzhi({ year, month, day, hour }).filter(
        (item) => item.type === '三合' && item.values.join('') === members.join(''),
      );
      assert.equal(matches.length, 1, `${group}/${branches.join('')}`);
      assert.deepEqual(matches[0].pillars, ['year', 'month', 'day', 'hour']);
      assert.match(matches[0].description, /三支齐见.*不等于已经成局、合化或产生吉凶/);
    }
  }

  for (const punishment of [
    { name: '无恩之刑', members: ['寅', '巳', '申'] },
    { name: '恃势之刑', members: ['丑', '戌', '未'] },
  ]) {
    for (const branches of uniquePermutations([...punishment.members, punishment.members[0]])) {
      const [year, month, day, hour] = branches.map((branch) => representativeByBranch[branch]);
      const matches = analyzeCoreQimenGanzhi({ year, month, day, hour }).filter(
        (item) => item.type === '相刑' && item.values.join('') === punishment.members.join(''),
      );
      assert.equal(matches.length, 1, `${punishment.name}/${branches.join('')}`);
      assert.deepEqual(matches[0].pillars, ['year', 'month', 'day', 'hour']);
    }
  }
});

test('八字关系结构只登记子卯、自刑与三支齐见的完整三刑成员', () => {
  const first = analyzeRelationStructure([
    { zhi: '申' },
    { zhi: '寅' },
    { zhi: '辰' },
    { zhi: '辰' },
  ]);
  assert.ok(!first.items.some((item) => ['无恩之刑', '恃势之刑'].includes(item.name)));
  assert.ok(first.items.some((item) => item.name === '自刑' && item.values.join('') === '辰辰'));

  const second = analyzeRelationStructure([
    { zhi: '寅' },
    { zhi: '巳' },
    { zhi: '申' },
    { zhi: '寅' },
  ]);
  const complete = second.items.filter((item) => item.name === '无恩之刑');
  assert.equal(complete.length, 1);
  assert.deepEqual(complete[0].values, ['寅', '巳', '申']);
  assert.deepEqual(complete[0].pillars, ['year', 'month', 'day', 'hour']);
  assert.match(complete[0].evidence, /三支齐见.*不把任意两支自动命名/);
});

test('八字岁运提示不应把戊流年与己原局误写成天干冲', () => {
  const context = buildFortuneSelectionContext(createFortuneMockResult(), {
    scope: 'year',
    cycleIndex: 0,
    year: 2008,
  });

  assert.ok(context);
  const summary = context.promptPayload.summaryLines.join('\n');
  assert.match(summary, /流年触发：/);
  assert.doesNotMatch(summary, /天干戊冲月柱己/);
});

test('申月司令初气应为戊土而不是己土', () => {
  for (const commander of [appMonthCommander, coreMonthCommander]) {
    assert.deepEqual(commander.申, [
      ['戊', 7],
      ['壬', 7],
      ['庚', 16],
    ]);
  }
});

test('天干五合表应与 tyme4ts 合干合化保持一致', () => {
  for (const stem of HEAVENLY_STEMS) {
    const currentStem = HeavenStem.fromName(stem);
    const expectedPartner = currentStem.getCombine().getName();
    const expectedElement = currentStem.combine(HeavenStem.fromName(expectedPartner))?.getName();

    assert.equal(appBaziMappings.TIAN_GAN_WU_HE[stem], expectedPartner, stem);
    assert.equal(coreBaziMappings.TIAN_GAN_WU_HE[stem], expectedPartner, stem);
    assert.equal(coreDivinationGanHe[stem]?.partner, expectedPartner, stem);
    assert.equal(coreDivinationGanHe[stem]?.wuxing, expectedElement, stem);
  }
});

test('六十甲子纳音表应与 tyme4ts 纳音保持一致', () => {
  for (const ganZhi of SIXTY_CYCLE) {
    const expected = SixtyCycle.fromName(ganZhi).getSound().getName();

    assert.equal(NAYIN_MAP[ganZhi], expected, ganZhi);
  }
});

test('地支藏干表应与 tyme4ts 本气中气余气顺序保持一致', () => {
  for (const branch of EARTHLY_BRANCHES) {
    const expected = EarthBranch.fromName(branch)
      .getHideHeavenStems()
      .map((stem) => stem.getName());

    assert.deepEqual(HIDDEN_STEMS[branch], expected, branch);
    assert.deepEqual(BRANCH_HIDDEN_STEMS[branch], expected, branch);
  }
});

test('八字十二长生表应与 tyme4ts 十干十二运保持一致', () => {
  for (const stem of HEAVENLY_STEMS) {
    for (const branch of EARTHLY_BRANCHES) {
      const expected = HeavenStem.fromName(stem).getTerrain(EarthBranch.fromName(branch)).getName();

      assert.equal(TWELVE_STAGES_MAP[stem]?.[branch], expected, `${stem}${branch}`);
      assert.equal(getBaziValueLifeStage(stem, branch), expected, `${stem}${branch}`);
    }
  }

  assert.throws(() => getBaziValueLifeStage('甲', '不存在'), /地支无效/);
  assert.throws(() => getBaziValueLifeStage('不存在', '子'), /天干无效/);
});

test('十神算法应与 tyme4ts 十神关系保持一致', () => {
  for (const dayMaster of HEAVENLY_STEMS) {
    for (const targetStem of HEAVENLY_STEMS) {
      const expected = HeavenStem.fromName(dayMaster)
        .getTenStar(HeavenStem.fromName(targetStem))
        .getName();

      assert.equal(getTenGod(targetStem, dayMaster), expected, `${dayMaster}见${targetStem}`);
    }
  }

  assert.equal(getTenGod('不存在', '甲'), '未知');
  assert.equal(getTenGod('甲', '不存在'), '未知');
});

test('地支十神应按 tyme4ts 藏干主气取十神', () => {
  for (const dayMaster of HEAVENLY_STEMS) {
    for (const branch of EARTHLY_BRANCHES) {
      const mainHiddenStem = EarthBranch.fromName(branch).getHideHeavenStems()[0].getName();
      const expected = HeavenStem.fromName(dayMaster)
        .getTenStar(HeavenStem.fromName(mainHiddenStem))
        .getName();

      assert.equal(getTenGodForBranch(branch, dayMaster), expected, `${dayMaster}见${branch}`);
    }
  }

  assert.equal(getTenGodForBranch('不存在', '甲'), '未知');
  assert.equal(getTenGodForBranch('子', '不存在'), '未知');
});

test('地支六合六冲六害表应与 tyme4ts 地支关系保持一致', () => {
  for (const branch of EARTHLY_BRANCHES) {
    const currentBranch = EarthBranch.fromName(branch);
    const expectedLiuhe = currentBranch.getCombine().getName();
    const expectedLiuchong = currentBranch.getOpposite().getName();
    const expectedLiuhai = currentBranch.getHarm().getName();

    assert.equal(appBaziMappings.DI_ZHI_LIU_HE[branch], expectedLiuhe, branch);
    assert.equal(coreBaziMappings.DI_ZHI_LIU_HE[branch], expectedLiuhe, branch);
    assert.equal(LIUHE_MAP[branch], expectedLiuhe, branch);
    assert.equal(ziweiLiuHeBranch[branch], expectedLiuhe, branch);

    assert.equal(appBaziMappings.DI_ZHI_CHONG[branch], expectedLiuchong, branch);
    assert.equal(coreBaziMappings.DI_ZHI_CHONG[branch], expectedLiuchong, branch);
    assert.equal(LIUCHONG_MAP[branch], expectedLiuchong, branch);

    assert.equal(appBaziMappings.DI_ZHI_HAI[branch], expectedLiuhai, branch);
    assert.equal(coreBaziMappings.DI_ZHI_HAI[branch], expectedLiuhai, branch);
    assert.equal(LIUHAI_MAP[branch], expectedLiuhai, branch);
  }
});

test('核心十二长生分析应按天干阴阳顺逆取位', () => {
  const stages = analyzeLifeStageProfile([
    { gan: '甲', zhi: '亥' },
    { gan: '乙', zhi: '午' },
    { gan: '辛', zhi: '子' },
    { gan: '己', zhi: '酉' },
  ]);

  assert.deepEqual(
    stages.map((item) => item.stage),
    ['长生', '长生', '长生', '长生'],
  );

  assert.throws(
    () =>
      analyzeLifeStageProfile([
        { gan: '甲', zhi: '亥' },
        { gan: '乙', zhi: '午' },
        { gan: '辛', zhi: '子' },
      ]),
    /四柱数量无效/,
  );
  assert.throws(
    () =>
      analyzeLifeStageProfile([
        { gan: '甲', zhi: '亥' },
        { gan: '乙', zhi: '午' },
        { gan: '辛', zhi: '子' },
        { gan: '风', zhi: '酉' },
      ]),
    /天干无效/,
  );
});

test('核心纳音分析应拒绝非法四柱，不应默认未知或土五行', () => {
  const profile = analyzeNayinProfile([
    { gan: '甲', zhi: '子' },
    { gan: '乙', zhi: '丑' },
    { gan: '丙', zhi: '寅' },
    { gan: '丁', zhi: '卯' },
  ]);

  assert.deepEqual(
    profile.items.map((item) => item.element),
    ['金', '金', '火', '火'],
  );
  assert.throws(
    () =>
      analyzeNayinProfile([
        { gan: '甲', zhi: '子' },
        { gan: '乙', zhi: '丑' },
        { gan: '丙', zhi: '寅' },
      ]),
    /四柱数量无效/,
  );
  assert.throws(
    () =>
      analyzeNayinProfile([
        { gan: '甲', zhi: '子' },
        { gan: '乙', zhi: '丑' },
        { gan: '丙', zhi: '寅' },
        { gan: '甲', zhi: '丑' },
      ]),
    /hour柱不是有效六十甲子/,
  );
});

test('八字关系结构在相邻冲破透干条件不足时应关闭半合与拱局命名', () => {
  const relation = analyzeRelationStructure([
    { zhi: '寅' },
    { zhi: '午' },
    { zhi: '子' },
    { zhi: '丑' },
  ]);

  assert.ok(relation.items.every((item) => item.category !== '半合拱局'));
  assert.ok(relation.items.every((item) => !/半合|拱局/.test(item.name + item.evidence)));
});

test('八字本命四支关系应穷举十二支四次方并只输出条件闭合结构', () => {
  const representativeByBranch = Object.fromEntries(
    EARTHLY_BRANCHES.map((branch) => [
      branch,
      SIXTY_CYCLE.find((ganZhi) => ganZhi.charAt(1) === branch)!,
    ]),
  );
  const toPillar = (branch: string) => {
    const ganZhi = representativeByBranch[branch];
    return { gan: ganZhi.charAt(0), zhi: branch, ganZhi };
  };

  for (const year of EARTHLY_BRANCHES) {
    for (const month of EARTHLY_BRANCHES) {
      for (const day of EARTHLY_BRANCHES) {
        for (const hour of EARTHLY_BRANCHES) {
          const branches = [year, month, day, hour];
          const label = branches.join('');
          const relation = analyzeRelationStructure(branches.map((zhi) => ({ zhi })));
          const promptRelations = analyzePillarRelations({
            pillars: {
              year: toPillar(year),
              month: toPillar(month),
              day: toPillar(day),
              hour: toPillar(hour),
            },
          });
          const expectedSanhe = Object.values(SANHE_GROUPS).filter((members) =>
            members.every((branch) => branches.includes(branch)),
          ).length;
          const expectedSanhui = Object.values(SANHUI_GROUPS).filter((members) =>
            members.every((branch) => branches.includes(branch)),
          ).length;
          const expectedPunishments =
            (branches.includes('子') && branches.includes('卯') ? 1 : 0) +
            ['辰', '午', '酉', '亥'].filter(
              (branch) => branches.filter((value) => value === branch).length >= 2,
            ).length +
            Object.values(COMPLETE_SANXING_GROUPS).filter((members) =>
              members.every((branch) => branches.includes(branch)),
            ).length;
          const actualPunishments = relation.items.filter((item) =>
            ['子卯相刑', '自刑', '无恩之刑', '恃势之刑'].includes(item.name),
          );
          const promptPunishments = promptRelations.xingChong.filter((item) =>
            /相刑固定支对|自刑固定结构|完整成员结构/.test(item),
          );

          assert.equal(
            relation.items.filter((item) => item.name === '三合三支齐见').length,
            expectedSanhe,
            `${label}/三合`,
          );
          assert.equal(
            relation.items.filter((item) => item.name === '三会三支齐见').length,
            expectedSanhui,
            `${label}/三会`,
          );
          assert.equal(actualPunishments.length, expectedPunishments, `${label}/三刑`);
          assert.equal(promptPunishments.length, expectedPunishments, `${label}/提示词三刑`);
          assert.equal(
            promptRelations.xingChong.filter((item) => item.includes('三合所需三支齐见')).length,
            expectedSanhe,
            `${label}/提示词三合`,
          );
          assert.equal(
            promptRelations.xingChong.filter((item) => item.includes('三会所需三支齐见')).length,
            expectedSanhui,
            `${label}/提示词三会`,
          );
          assert.ok(
            relation.items.every((item) => !/半合|拱局|合成|会合/.test(item.name + item.evidence)),
            `${label}/关系边界`,
          );
          assert.ok(
            promptRelations.xingChong.every((item) => !/半合|拱局|地支成/.test(item)),
            `${label}/提示词边界`,
          );
        }
      }
    }
  }
});

test('八字透干通根应扫描四柱地支，不应只看本柱坐支', () => {
  const profile = analyzeStemRootProfile(
    [
      { gan: '甲', zhi: '子' },
      { gan: '丙', zhi: '辰' },
      { gan: '庚', zhi: '寅' },
      { gan: '辛', zhi: '未' },
    ],
    '庚',
    getWuxing,
    getTenGod,
  );

  const yearStem = profile.items.find((item) => item.pillar === 'year');

  assert.equal(yearStem?.stem, '甲');
  assert.equal(yearStem?.status, '有本根');
  assert.equal(yearStem?.status, '有本根');
  assert.ok(profile.items.every((item) => !('rootScore' in item)));

  assert.throws(
    () =>
      analyzeStemRootProfile(
        [
          { gan: '甲', zhi: '子' },
          { gan: '丙', zhi: '辰' },
          { gan: '庚', zhi: '寅' },
        ],
        '庚',
        getWuxing,
        getTenGod,
      ),
    /四柱数量无效/,
  );
  assert.throws(
    () =>
      analyzeStemRootProfile(
        [
          { gan: '甲', zhi: '子' },
          { gan: '丙', zhi: '辰' },
          { gan: '风', zhi: '寅' },
          { gan: '辛', zhi: '未' },
        ],
        '庚',
        getWuxing,
        getTenGod,
      ),
    /第3柱天干无效/,
  );
  assert.throws(
    () =>
      analyzeStemRootProfile(
        [
          { gan: '甲', zhi: '子' },
          { gan: '丙', zhi: '辰' },
          { gan: '庚', zhi: '寅' },
          { gan: '辛', zhi: '未' },
        ],
        '甲',
        getWuxing,
        getTenGod,
      ),
    /日主与日柱天干不一致/,
  );
});

test('八字透干事实应真实计算月令、司令与四支通根，不保留占位状态', () => {
  const pillars = [
    { gan: '甲', zhi: '子' },
    { gan: '戊', zhi: '辰' },
    { gan: '庚', zhi: '寅' },
    { gan: '辛', zhi: '未' },
  ];
  const profile = analyzeExposedStemProfile(pillars, '庚', getWuxing, getTenGod, '戊', '辰');

  assert.deepEqual(
    profile.items.map((item) => [
      item.stem,
      item.seasonStatus,
      item.commandStatus,
      item.rootStatus,
    ]),
    [
      ['甲', '囚', '未见月令同干同气', '有本根'],
      ['戊', '旺', '司令透出', '有本根'],
      ['庚', '相', '未见月令同干同气', '未见同气根'],
      ['辛', '相', '未见月令同干同气', '未见同气根'],
    ],
  );
  assert.ok(profile.items.every((item) => item.seasonStatus !== ('平' as string)));
  assert.ok(profile.items.every((item) => item.rootStatus !== ('待定' as string)));
  assert.match(profile.limitation, /不表示.*综合力量/);

  assert.throws(
    () => analyzeExposedStemProfile(pillars, '庚', getWuxing, getTenGod, undefined, '寅'),
    /传入月支与月柱地支不一致/,
  );
  assert.throws(
    () => analyzeExposedStemProfile(pillars, '庚', getWuxing, getTenGod, '甲', '辰'),
    /司令天干不属于月支藏干/,
  );
  assert.throws(
    () => analyzeExposedStemProfile(pillars, '庚', () => '木', getTenGod, '戊', '辰'),
    /五行函数与项目标准映射不一致/,
  );
  assert.throws(
    () => analyzeExposedStemProfile(pillars, '庚', getWuxing, () => '正财', '戊', '辰'),
    /十神函数与项目标准映射不一致/,
  );
});

test('八字透干事实应穷举十干与十二月支的120种月令组合', () => {
  const seasonStatuses = new Set<string>();
  const commandStatuses = new Set<string>();
  const rootStatuses = new Set<string>();

  for (const monthBranch of EARTHLY_BRANCHES) {
    const monthGanZhi = SIXTY_CYCLE.find((ganZhi) => ganZhi[1] === monthBranch);
    assert.ok(monthGanZhi, `缺少${monthBranch}月干支夹具`);

    for (const stem of HEAVENLY_STEMS) {
      const yearGanZhi = SIXTY_CYCLE.find((ganZhi) => ganZhi[0] === stem);
      assert.ok(yearGanZhi, `缺少${stem}年干支夹具`);
      const pillars = [
        { gan: yearGanZhi[0], zhi: yearGanZhi[1] },
        { gan: monthGanZhi[0], zhi: monthGanZhi[1] },
        { gan: '戊', zhi: '午' },
        { gan: '庚', zhi: '申' },
      ];
      const item = analyzeExposedStemProfile(
        pillars,
        '戊',
        getWuxing,
        getTenGod,
        undefined,
        monthBranch,
      ).items[0];
      const element = getWuxing(stem);
      const monthHiddenStems = HIDDEN_STEMS[monthBranch];
      const allHiddenStems = pillars.flatMap((pillar) => HIDDEN_STEMS[pillar.zhi]);
      const expectedCommandStatus = monthHiddenStems.includes(stem)
        ? '月令藏干透出'
        : getWuxing(monthHiddenStems[0]) === element
          ? '月支主气同五行'
          : '未见月令同干同气';
      const expectedRootStatus = allHiddenStems.includes(stem)
        ? '有本根'
        : allHiddenStems.some((hiddenStem) => getWuxing(hiddenStem) === element)
          ? '有同气根'
          : '未见同气根';

      assert.equal(
        item.seasonStatus,
        getSeasonStatus(monthBranch)[element],
        `${stem}/${monthBranch}`,
      );
      assert.equal(item.commandStatus, expectedCommandStatus, `${stem}/${monthBranch}`);
      assert.equal(item.rootStatus, expectedRootStatus, `${stem}/${monthBranch}`);
      seasonStatuses.add(item.seasonStatus);
      commandStatuses.add(item.commandStatus);
      rootStatuses.add(item.rootStatus);
    }
  }

  assert.deepEqual(seasonStatuses, new Set(['旺', '相', '休', '囚', '死']));
  assert.deepEqual(
    commandStatuses,
    new Set(['月令藏干透出', '月支主气同五行', '未见月令同干同气']),
  );
  assert.deepEqual(rootStatuses, new Set(['有本根', '有同气根', '未见同气根']));
});

test('占法共享半合判断不应把重复地支当作两个成员', () => {
  assert.equal(isHalfSanhe(['申', '子']), '水局');
  assert.equal(isHalfSanhe(['申', '辰']), null);
  assert.equal(isHalfSanhe(['申', '申']), null);
  assert.equal(isHalfSanhe(['寅', '寅', '午']), '火局');
  assert.equal(isSanheArch(['申', '辰']), '水局');
  assert.equal(isSanheArch(['申', '子']), null);
});

test('奇门干支互动在相邻冲破透干条件不足时应关闭半合与拱局命名', () => {
  const arch = analyzeCoreQimenGanzhi({
    year: '甲寅',
    month: '甲戌',
    day: '甲子',
    hour: '乙丑',
  });
  assert.ok(arch.every((item) => !['半合', '拱局'].includes(item.type)));

  const half = analyzeCoreQimenGanzhi({
    year: '甲寅',
    month: '庚午',
    day: '甲子',
    hour: '乙丑',
  });
  assert.ok(half.every((item) => !['半合', '拱局'].includes(item.type)));
});

test('占法共享三刑应穷举144组双支固定关系与1728组三支完整成员', () => {
  let pairCount = 0;
  for (const left of EARTHLY_BRANCHES) {
    for (const right of EARTHLY_BRANCHES) {
      pairCount += 1;
      const expected =
        (left === '子' && right === '卯') ||
        (left === '卯' && right === '子') ||
        (left === right && ['辰', '午', '酉', '亥'].includes(left));
      assert.equal(isSanxing(left, right), expected, `${left}/${right}双支固定相刑`);
    }
  }
  assert.equal(pairCount, 144);

  let tripleCount = 0;
  for (const first of EARTHLY_BRANCHES) {
    for (const second of EARTHLY_BRANCHES) {
      for (const third of EARTHLY_BRANCHES) {
        tripleCount += 1;
        const branches = [first, second, third];
        const expected = Object.entries(COMPLETE_SANXING_GROUPS)
          .filter(([, members]) => members.every((branch) => branches.includes(branch)))
          .map(([name]) => name);
        assert.deepEqual(
          findCompleteSanxingGroups(branches).map((item) => item.name),
          expected,
          `${branches.join('/')}三支完整成员`,
        );
      }
    }
  }
  assert.equal(tripleCount, 1728);
});

test('占法共享相破关系应覆盖六破定例', () => {
  assert.equal(isLiupo('子', '酉'), true);
  assert.equal(isLiupo('酉', '子'), true);
  assert.equal(isLiupo('丑', '辰'), true);
  assert.equal(isLiupo('卯', '午'), true);
  assert.equal(isLiupo('午', '卯'), true);
  assert.equal(isLiupo('巳', '申'), true);
  assert.equal(isLiupo('未', '戌'), true);
  assert.equal(isLiupo('子', '午'), false);
});

test('八字墓库分析应按日主天干十二长生取墓位', () => {
  const pillars = [
    { gan: '戊', zhi: '辰' },
    { gan: '戊', zhi: '戌' },
    { gan: '己', zhi: '丑' },
    { gan: '己', zhi: '未' },
  ];
  const expectedTombs: Record<string, string> = {
    甲: '未',
    乙: '戌',
    丙: '戌',
    丁: '丑',
    戊: '戌',
    己: '丑',
    庚: '丑',
    辛: '辰',
    壬: '辰',
    癸: '未',
  };

  for (const [dayMaster, expectedBranch] of Object.entries(expectedTombs)) {
    const profile = analyzeTombStorage(pillars, dayMaster, getWuxing, getTenGod);
    const dayMasterTombs = profile.items
      .filter((item) => item.isDayMasterTomb)
      .map((item) => item.branch);

    assert.deepEqual(dayMasterTombs, [expectedBranch]);
  }

  assert.throws(() => analyzeTombStorage(pillars, '风', getWuxing, getTenGod), /日主无效/);
  assert.throws(
    () =>
      analyzeTombStorage(
        [
          { gan: '戊', zhi: '辰' },
          { gan: '戊', zhi: '戌' },
          { gan: '己', zhi: '丑' },
          { gan: '己', zhi: '风' },
        ],
        '甲',
        getWuxing,
        getTenGod,
      ),
    /第4柱地支无效/,
  );
});

test('占法共享五行长生统一土长生在寅（与八字/奇门/tyme4ts 一致）', () => {
  // 木长生在亥、火长生在寅、金长生在巳、水长生在申（不变）
  assert.equal(getWuxingChangSheng('木'), '亥');
  assert.equal(getWuxingChangSheng('火'), '寅');
  // 土统一为「土长生在寅」流派（火土同宫），与八字/奇门所用 tyme4ts 一致
  assert.equal(getWuxingChangSheng('土'), '寅');
  assert.equal(getWuxingChangSheng('金'), '巳');
  assert.equal(getWuxingChangSheng('水'), '申');
  assert.throws(() => getWuxingChangSheng('风'), /五行无效/);
  // 注：六爻(liuyao)为独立占法体系，其土长生在申不在本共享表范围内，不受影响
});

test('占法共享月令旺衰应按古籍口径区分囚死', () => {
  assert.equal(getSeasonState('水', '子'), '旺');
  assert.equal(getSeasonState('木', '子'), '相');
  assert.equal(getSeasonState('金', '子'), '休');
  assert.equal(getSeasonState('土', '子'), '囚');
  assert.equal(getSeasonState('火', '子'), '死');
  assert.equal(getBranchWuxing('子'), '水');
  assert.equal(getHiddenMainStem('辰'), '戊');
  assert.throws(() => getSeasonState('风', '子'), /爻五行无效/);
  assert.throws(() => getSeasonState('水', '风'), /月支无效/);
  assert.throws(() => getBranchWuxing('风'), /地支无效/);
  assert.throws(() => getHiddenMainStem('风'), /地支无效/);
});

test('十二月司令表应完整覆盖每月三十日，并以月支本气收尾', () => {
  assert.equal(Object.keys(coreMonthCommander).length, 12);
  assert.deepEqual(coreMonthCommander, appMonthCommander);

  for (const branch of EARTHLY_BRANCHES) {
    const entries = coreMonthCommander[branch];
    assert.ok(entries, `${branch}月缺少司令数据`);
    assert.equal(
      entries.reduce((total, [, days]) => total + days, 0),
      30,
      `${branch}月司令天数应合计三十日`,
    );
    entries.forEach(([stem, days]) => {
      assert.ok(HEAVENLY_STEMS.includes(stem), `${branch}月司令天干${stem}无效`);
      assert.ok(Number.isInteger(days) && days > 0, `${branch}月司令天数必须是正整数`);
    });
    assert.equal(entries.at(-1)?.[0], HIDDEN_STEMS[branch][0], `${branch}月末段应由本气司令`);
  }
});
