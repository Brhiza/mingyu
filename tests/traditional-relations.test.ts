import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_MAPPINGS as appBaziMappings } from '../src/utils/bazi/baziMappingsData';
import {
  BASIC_MAPPINGS as coreBaziMappings,
  MONTH_COMMANDER as coreMonthCommander,
} from '../packages/core/src/bazi/baziMappingsData';
import { MONTH_COMMANDER as appMonthCommander } from '../src/utils/bazi/baziMappingsData';
import { TIAN_GAN_CHONG as appDivinationChong } from '../packages/core/src/divination/algorithms/_shared/wuxing';
import {
  TIAN_GAN_CHONG as coreDivinationChong,
  isHalfSanhe,
  isSanxing,
  getWuxingChangSheng,
} from '../packages/core/src/divination/algorithms/_shared/wuxing';
import { analyzeLifeStageProfile } from '../packages/core/src/bazi/lifeStageAnalysis';
import { analyzeRelationStructure } from '../packages/core/src/bazi/relationStructure';
import { analyzeTombStorage } from '../packages/core/src/bazi/tombStorage';
import { getTenGod, getWuxing } from '../packages/core/src/bazi/baziUtils';
import { analyzeGanzhiInteractions as analyzeAppQimenGanzhi } from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { analyzeGanzhiInteractions as analyzeCoreQimenGanzhi } from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality';
import { buildFortuneSelectionContext } from '../src/utils/bazi/fortuneSelection';
import type { BaziChartResult } from '../src/utils/bazi/baziTypes';

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
});

test('占法共享五行长生应与六爻奇门口径保持水土同长生在申', () => {
  assert.equal(getWuxingChangSheng('木'), '亥');
  assert.equal(getWuxingChangSheng('火'), '寅');
  assert.equal(getWuxingChangSheng('土'), '申');
  assert.equal(getWuxingChangSheng('金'), '巳');
  assert.equal(getWuxingChangSheng('水'), '申');
});
