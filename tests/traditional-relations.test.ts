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
  TIAN_GAN_HE as coreDivinationGanHe,
  TIAN_GAN_CHONG as coreDivinationChong,
  getBranchWuxing,
  getHiddenMainStem,
  getSeasonState,
  isHalfSanhe,
  isLiupo,
  isSanxing,
  getWuxingChangSheng,
} from '../packages/core/src/divination/algorithms/_shared/wuxing';
import { analyzeLifeStageProfile } from '../packages/core/src/bazi/lifeStageAnalysis';
import { analyzeNayinProfile } from '../packages/core/src/bazi/nayinAnalysis';
import { getLifeStage as getBaziValueLifeStage } from '../packages/core/src/bazi/baziValues';
import { analyzeRelationStructure } from '../packages/core/src/bazi/relationStructure';
import { analyzeStemRootProfile } from '../packages/core/src/bazi/stemRootAnalysis';
import { analyzeTombStorage } from '../packages/core/src/bazi/tombStorage';
import { getTenGod, getTenGodForBranch, getWuxing } from '../packages/core/src/bazi/baziUtils';
import { analyzeGanzhiInteractions as analyzeAppQimenGanzhi } from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { analyzeGanzhiInteractions as analyzeCoreQimenGanzhi } from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { evaluateChangSheng } from '../packages/core/src/divination/algorithms/qimen/helpers/chang-sheng';
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

test('奇门干支互动中的三刑不应因柱位顺序不同而漏判', () => {
  const ganzhi = {
    year: '乙巳',
    month: '丙寅',
    day: '丁未',
    hour: '戊戌',
  };

  for (const analyze of [analyzeAppQimenGanzhi, analyzeCoreQimenGanzhi]) {
    const punishments = analyze(ganzhi).filter((item) => item.type === '相刑');
    assert.ok(
      punishments.some(
        (item) => item.values.join('') === '巳寅' && item.description.includes('无恩之刑'),
      ),
    );
    assert.ok(
      punishments.some(
        (item) => item.values.join('') === '未戌' && item.description.includes('恃势之刑'),
      ),
    );
  }
});

test('八字关系结构中的三刑应复用共享口径', () => {
  const first = analyzeRelationStructure([
    { zhi: '申' },
    { zhi: '寅' },
    { zhi: '辰' },
    { zhi: '辰' },
  ]);
  const firstPunishments = first.items.filter((item) => item.name === '三刑');
  assert.ok(firstPunishments.some((item) => item.values.join('') === '申寅'));
  assert.ok(firstPunishments.some((item) => item.values.join('') === '辰辰'));

  const second = analyzeRelationStructure([
    { zhi: '戌' },
    { zhi: '未' },
    { zhi: '子' },
    { zhi: '午' },
  ]);
  const secondPunishments = second.items.filter((item) => item.name === '三刑');
  assert.ok(secondPunishments.some((item) => item.values.join('') === '戌未'));
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

test('八字关系结构应识别寅午火局生地半合', () => {
  const relation = analyzeRelationStructure([
    { zhi: '寅' },
    { zhi: '午' },
    { zhi: '子' },
    { zhi: '丑' },
  ]);

  assert.ok(
    relation.items.some(
      (item) =>
        item.category === '半合拱局' &&
        item.name === '生地半合' &&
        item.element === '火' &&
        item.values.join('') === '寅午',
    ),
  );
});

test('八字透干通根应扫描四柱地支，不应只看本柱坐支', () => {
  const profile = analyzeStemRootProfile(
    [
      { gan: '甲', zhi: '子' },
      { gan: '丙', zhi: '辰' },
      { gan: '庚', zhi: '寅' },
      { gan: '辛', zhi: '午' },
    ],
    '甲',
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
        '甲',
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
          { gan: '辛', zhi: '午' },
        ],
        '甲',
        getWuxing,
        getTenGod,
      ),
    /第3柱天干无效/,
  );
});

test('占法共享半合判断不应把重复地支当作两个成员', () => {
  assert.equal(isHalfSanhe(['申', '子']), '水局');
  assert.equal(isHalfSanhe(['申', '申']), null);
  assert.equal(isHalfSanhe(['寅', '寅', '午']), '火局');
});

test('占法共享三刑关系应按同组三刑互见判断，不因传入顺序漏判', () => {
  assert.equal(isSanxing('寅', '申'), true);
  assert.equal(isSanxing('申', '寅'), true);
  assert.equal(isSanxing('未', '戌'), true);
  assert.equal(isSanxing('戌', '未'), true);
  assert.equal(isSanxing('子', '卯'), true);
  assert.equal(isSanxing('辰', '辰'), true);
  assert.equal(isSanxing('寅', '寅'), false);
  assert.equal(isSanxing('子', '午'), false);
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

test('奇门十二长生应与 tyme4ts 十干十二运保持一致', () => {
  const palaceBranches: Record<number, string> = {
    1: '子',
    2: '未',
    3: '卯',
    4: '辰',
    6: '戌',
    7: '酉',
    8: '丑',
    9: '午',
  };

  for (const stem of ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']) {
    for (const [palace, branch] of Object.entries(palaceBranches)) {
      const expected = HeavenStem.fromName(stem).getTerrain(EarthBranch.fromName(branch)).getName();

      assert.equal(evaluateChangSheng(stem, Number(palace)).stage, expected);
    }
  }
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
