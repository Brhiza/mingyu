import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeBladePatternStructure } from '@core/bazi/baziBladePattern';
import { analyzeHurtPatternStructure } from '@core/bazi/baziHurtPattern';
import { analyzeLuPatternStructure } from '@core/bazi/baziLuPattern';
import { determinePattern } from '@core/bazi/baziPatternStrategy';
import { analyzeKillerPatternStructure } from '@core/bazi/baziKillerPattern';
import {
  HIDDEN_STEMS,
  LU_BRANCH_MAP,
  REN_BRANCH_MAP,
  SIXTY_CYCLE,
} from '@core/bazi/baziDefinitions';
import { getTenGod } from '@core/bazi/baziUtils';
import type { Pillar, Pillars } from '@core/bazi/baziTypes';

function createPillar(match: (ganZhi: string) => boolean): Pillar {
  const ganZhi = SIXTY_CYCLE.find(match);
  assert.ok(ganZhi, '测试夹具必须能找到有效六十甲子');
  return { gan: ganZhi[0], zhi: ganZhi[1], ganZhi };
}

function createPillars(year: string, month: string, day: string, hour: string): Pillars {
  return {
    year: createPillar((ganZhi) => ganZhi === year),
    month: createPillar((ganZhi) => ganZhi === month),
    day: createPillar((ganZhi) => ganZhi === day),
    hour: createPillar((ganZhi) => ganZhi === hour),
  };
}

test('魁罡外格标记也须服从月令用舍前提', () => {
  const eligible = determinePattern(
    createPillars('壬子', '辛亥', '壬辰', '庚子'),
    '平衡',
    getTenGod,
  );
  const monthUseAlreadyAvailable = determinePattern(
    createPillars('戊辰', '甲寅', '壬辰', '庚子'),
    '平衡',
    getTenGod,
  );

  assert.equal(eligible.isKuiGang, true);
  assert.equal(monthUseAlreadyAvailable.isKuiGang, false);
});

function createPatternPillars(
  dayMaster: string,
  monthBranch: string,
  exposedStem: string,
): Pillars {
  return {
    year: createPillar((ganZhi) => ganZhi[0] === exposedStem),
    month: createPillar((ganZhi) => ganZhi[1] === monthBranch),
    day: createPillar((ganZhi) => ganZhi[0] === dayMaster),
    hour: createPillar((ganZhi) => ganZhi === '甲子'),
  };
}

test('特殊从格判断不能忽略地支副气里的印比', () => {
  const pillars: Pillars = {
    year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    month: { gan: '庚', zhi: '戌', ganZhi: '庚戌' },
    day: { gan: '丙', zhi: '申', ganZhi: '丙申' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  };

  const result = determinePattern(pillars, '极弱', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.match(result.pattern, /^(?!从)/); // 不应是从格（从财/从杀/从儿/从势）
});

test('异党会局不能掩盖明透印星，日主有直接生扶时不得按从格处理', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    day: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  };

  const result = determinePattern(pillars, '极弱', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.doesNotMatch(result.pattern, /^从/);
});

test('异党会局不能掩盖局外本气根，日主有根时不得按从格处理', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    hour: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
  };

  const result = determinePattern(pillars, '极弱', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.doesNotMatch(result.pattern, /^从/);
});

test('专旺格判断不能忽略地支副气里的财官食伤', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    day: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    hour: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
  };

  const result = determinePattern(pillars, '极强', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.notEqual(result.pattern, '专旺格');
});

test('同党会局不能掩盖明透官星，存在直接逆势克制时不得按专旺格处理', () => {
  const pillars: Pillars = {
    year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    month: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    day: { gan: '己', zhi: '未', ganZhi: '己未' },
    hour: { gan: '己', zhi: '巳', ganZhi: '己巳' },
  };

  const result = determinePattern(pillars, '极强', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.notEqual(result.pattern, '专旺格');
});

test('同党会局不能掩盖局外官杀本气，存在直接逆势克制时不得按专旺格处理', () => {
  const pillars: Pillars = {
    year: { gan: '己', zhi: '巳', ganZhi: '己巳' },
    month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
    hour: { gan: '己', zhi: '未', ganZhi: '己未' },
  };

  const result = determinePattern(pillars, '极强', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.notEqual(result.pattern, '专旺格');
});

test('建禄应按日干禄位精确取格，不应被初气司令透干改判为偏财格', () => {
  const pillars: Pillars = {
    year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
  };

  const result = determinePattern(pillars, '身强', getTenGod, '戊');

  assert.equal(result.isSpecial, false);
  assert.equal(result.pattern, '建禄格');
  assert.match(result.basis || '', /禄位/);
});

test('十干建禄应按固定禄位命中，包括月支本气不是比肩的戊己土', () => {
  Object.entries(LU_BRANCH_MAP).forEach(([dayMaster, monthBranch]) => {
    const monthStems = HIDDEN_STEMS[monthBranch];
    const commander = monthStems.find((stem) => stem !== dayMaster) || monthStems[0];
    const result = determinePattern(
      createPatternPillars(dayMaster, monthBranch, commander),
      '身强',
      getTenGod,
      commander,
    );

    assert.equal(result.pattern, '建禄格', `${dayMaster}日${monthBranch}月应为建禄格`);
    assert.match(result.basis || '', /禄位/);
  });
});

test('五阳干月刃应按固定刃位命中，包括月支本气不是劫财的戊土', () => {
  Object.entries(REN_BRANCH_MAP).forEach(([dayMaster, monthBranch]) => {
    const monthStems = HIDDEN_STEMS[monthBranch];
    const commander = monthStems.find((stem) => stem !== dayMaster) || monthStems[0];
    const result = determinePattern(
      createPatternPillars(dayMaster, monthBranch, commander),
      '身强',
      getTenGod,
      commander,
    );

    assert.equal(result.pattern, '月刃格', `${dayMaster}日${monthBranch}月应为月刃格`);
    assert.match(result.basis || '', /羊刃位/);
  });
});

test('丁火生巳月时不应被透出的庚金误判为正财格', () => {
  const pillars: Pillars = {
    year: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    month: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
    day: { gan: '丁', zhi: '酉', ganZhi: '丁酉' },
    hour: { gan: '庚', zhi: '子', ganZhi: '庚子' },
  };

  const result = determinePattern(pillars, '身强', getTenGod, '庚');

  assert.equal(result.isSpecial, false);
  assert.equal(result.pattern, '劫财格');
  assert.match(result.basis || '', /月令本气为丙/);
});

test('交节过渡气即使透干也只保留司权事实，不得替换本月唯一藏干格名', () => {
  const pillars = createPatternPillars('癸', '卯', '甲');
  const result = determinePattern(pillars, '身强', getTenGod, '甲');

  assert.equal(result.pattern, '食神格');
  assert.match(result.basis || '', /月令只有乙一项藏干/);
  assert.match(result.basis || '', /甲为交节过渡气且已透干/);
  assert.match(result.basis || '', /不替换本月唯一藏干/);
});

test('交节过渡气透干时不得替月内多项未透藏干强定单一格局', () => {
  const pillars: Pillars = {
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '壬', zhi: '午', ganZhi: '壬午' },
    day: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
    hour: { gan: '丙', zhi: '戌', ganZhi: '丙戌' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '丙');

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /丁（食神）、己（偏财）均未透出/);
  assert.match(result.basis || '', /丙为交节过渡气且已透干/);
  assert.match(result.basis || '', /不替换当前月支藏干取格边界/);
});

test('外部交节过渡气不得给当前月支单透藏干无来源地增加杂气前缀', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '乙', zhi: '未', ganZhi: '乙未' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '甲');

  assert.equal(result.pattern, '正印格');
  assert.match(result.basis || '', /乙为月令藏干，单独透于时干/);
  assert.match(result.basis || '', /甲为交节过渡气且已透干/);
  assert.doesNotMatch(result.pattern, /^杂气/);
});

test('月令多项藏干全不透时不得只凭未透司令强定单一格局', () => {
  const pillars: Pillars = {
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    hour: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '乙');

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /戊（比肩）、乙（正官）、癸（正财）均未透出/);
  assert.match(result.basis || '', /乙司权只作得时事实/);
  assert.match(result.basis || '', /轻重、有力程度及克合后取舍/);
  assert.match(result.basis || '', /不只凭司令阶段或藏干数组本气强定/);
});

test('月令只有一项藏干且未透时仍可取格，未透交节余气司令不得替换格名', () => {
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '甲');

  assert.equal(result.pattern, '食神格');
  assert.match(result.basis || '', /月令只有乙一项藏干/);
  assert.match(result.basis || '', /按乙（食神）记录格名/);
  assert.match(result.basis || '', /甲为交节过渡气，只作司权事实，不替换本月唯一藏干/);
});

test('月令藏干兼透时不得按藏干次序或透干柱位强定单一格局', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  };

  const result = determinePattern(pillars, '身强', getTenGod, '戊');

  assert.equal(result.isSpecial, false);
  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /辛（正官）、丁（伤官）同时透出/);
  assert.match(result.basis || '', /一透则一用，兼透则兼用/);
  assert.match(result.basis || '', /不按藏干次序、重复透出次数或年、月、时柱位强定/);
  assert.doesNotMatch(result.basis || '', /古籍同型关系/);
});

test('原典明举的官印相生与财生官兼透应记录局部有情', () => {
  const officerResource: Pillars = {
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '癸', zhi: '巳', ganZhi: '癸巳' },
  };
  const wealthOfficer: Pillars = {
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '辛', zhi: '未', ganZhi: '辛未' },
  };

  const officerResourceResult = determinePattern(officerResource, '待综合判断', getTenGod);
  const wealthOfficerResult = determinePattern(wealthOfficer, '待综合判断', getTenGod);

  assert.equal(officerResourceResult.pattern, '待综合判断');
  assert.match(officerResourceResult.basis || '', /癸官与乙印同透/);
  assert.match(officerResourceResult.basis || '', /官印相生且乙制辰中戊土/);
  assert.match(officerResourceResult.basis || '', /合而有情/);
  assert.equal(wealthOfficerResult.pattern, '待综合判断');
  assert.match(wealthOfficerResult.basis || '', /己财与辛官同透/);
  assert.match(wealthOfficerResult.basis || '', /财能生官/);
  assert.match(wealthOfficerResult.basis || '', /合而有情/);
});

test('原典明举的财印相合与相克应记录局部无情', () => {
  const wealthResourceCombined: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
  };
  const wealthResourceClashed: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '壬', zhi: '申', ganZhi: '壬申' },
  };

  const combinedResult = determinePattern(wealthResourceCombined, '待综合判断', getTenGod);
  const clashedResult = determinePattern(wealthResourceClashed, '待综合判断', getTenGod);

  assert.match(combinedResult.basis || '', /戊癸相合使财印两失/);
  assert.match(combinedResult.basis || '', /合而无情/);
  assert.match(clashedResult.basis || '', /财印相克而贪财坏印/);
  assert.match(clashedResult.basis || '', /合而无情/);
});

test('壬印丙食是否会水应按原典区分有情终变', () => {
  const withoutWaterFormation: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
  };
  const withWaterFormation: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '壬', zhi: '申', ganZhi: '壬申' },
  };

  const withoutWaterResult = determinePattern(withoutWaterFormation, '待综合判断', getTenGod);
  const withWaterResult = determinePattern(withWaterFormation, '待综合判断', getTenGod);

  assert.match(withoutWaterResult.basis || '', /未会申子水局/);
  assert.match(withoutWaterResult.basis || '', /有情而卒成无情/);
  assert.doesNotMatch(withoutWaterResult.basis || '', /壬印透出、不露丙而又见戌冲辰/);
  assert.match(withWaterResult.basis || '', /申子辰会水扶印/);
  assert.match(withWaterResult.basis || '', /丙食不再碍印，局部关系仍有情/);
});

test('壬印透而不露丙又逢辰戌冲应按原典记录有情卒无情', () => {
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
    month: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '子', ganZhi: '甲子' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /壬印透出、不露丙而又见戌冲辰/);
  assert.match(result.basis || '', /月令土动使壬印难通月令/);
  assert.match(result.basis || '', /有情而卒成无情/);
});

test('四墓月令相冲都只记录冲动，不得据冲宣称开库或自动成格', () => {
  const cases: Array<{ pillars: Pillars; pattern: string; clash: string }> = [
    {
      pillars: {
        year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
        day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        hour: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
      },
      pattern: '偏财格',
      clash: '辰与戌相冲',
    },
    {
      pillars: {
        year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        month: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
        day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
      },
      pattern: '偏财格',
      clash: '戌与辰相冲',
    },
    {
      pillars: {
        year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
        month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
        day: { gan: '壬', zhi: '申', ganZhi: '壬申' },
        hour: { gan: '丁', zhi: '未', ganZhi: '丁未' },
      },
      pattern: '正官格',
      clash: '丑与未相冲',
    },
    {
      pillars: {
        year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        month: { gan: '辛', zhi: '未', ganZhi: '辛未' },
        day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
        hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
      },
      pattern: '劫财格',
      clash: '未与丑相冲',
    },
  ];

  cases.forEach(({ pillars, pattern, clash }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);

    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', new RegExp(clash));
    assert.match(result.basis || '', /四墓不忌刑冲，刑冲未必成格/);
    assert.match(result.basis || '', /不据此宣称开库、出库或自动成格/);
    assert.match(result.basis || '', /仍以透干、会支取清用/);
    assert.match(result.basis || '', /不改变既有格名/);
  });
});

test('甲辰财透或未透遇戌冲时应按原典区分取清边界', () => {
  const exposedWealth: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
  };
  const hiddenWealth: Pillars = {
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
  };

  const exposedResult = determinePattern(exposedWealth, '待综合判断', getTenGod);
  const hiddenResult = determinePattern(hiddenWealth, '待综合判断', getTenGod);

  assert.equal(exposedResult.pattern, '偏财格');
  assert.match(exposedResult.basis || '', /戊财已透为干头清用/);
  assert.match(exposedResult.basis || '', /辰戌冲不是取财的必要条件/);
  assert.equal(hiddenResult.pattern, '劫财格');
  assert.match(hiddenResult.basis || '', /戊财未透/);
  assert.match(hiddenResult.basis || '', /仅见辰戌冲仍不能据此取为清财格/);
});

test('原典明举的墓库透干遇冲应分别记录官印财的局部影响', () => {
  const resourceClashed: Pillars = {
    year: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
    month: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '子', ganZhi: '甲子' },
  };
  const officerAlreadyExposed: Pillars = {
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    day: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    hour: { gan: '丁', zhi: '未', ganZhi: '丁未' },
  };
  const wealthHarmed: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
    day: { gan: '己', zhi: '巳', ganZhi: '己巳' },
    hour: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
  };
  const officerHarmed: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
    day: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    hour: { gan: '庚', zhi: '戌', ganZhi: '庚戌' },
  };
  const officerNotAutomaticallyBroken: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
  };

  const resourceResult = determinePattern(resourceClashed, '待综合判断', getTenGod);
  const exposedOfficerResult = determinePattern(officerAlreadyExposed, '待综合判断', getTenGod);
  const wealthResult = determinePattern(wealthHarmed, '待综合判断', getTenGod);
  const harmedOfficerResult = determinePattern(officerHarmed, '待综合判断', getTenGod);
  const preservedOfficerResult = determinePattern(
    officerNotAutomaticallyBroken,
    '待综合判断',
    getTenGod,
  );

  assert.match(resourceResult.basis || '', /壬印透出又遇辰戌冲/);
  assert.match(resourceResult.basis || '', /冲动月令土而累印/);
  assert.match(resourceResult.basis || '', /不得解释为冲开印库/);
  assert.match(exposedOfficerResult.basis || '', /己官已透为干头清用/);
  assert.match(exposedOfficerResult.basis || '', /丑未冲不是取官的必要条件/);
  assert.match(wealthResult.basis || '', /戌中土劫随冲而动，对水财无益/);
  assert.match(harmedOfficerResult.basis || '', /戌中戊土伤官随冲而动，对壬官有害/);
  assert.match(preservedOfficerResult.basis || '', /辰戌冲只作四墓冲动/);
  assert.match(preservedOfficerResult.basis || '', /不据此单独判定破格/);
});

test('官财印食为明确月令用神时应记录对应明透冲突与救应边界', () => {
  const officerWithOutput: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
  };
  const wealthWithPeer: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
  };
  const resourceWithWealth: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
  };
  const foodWithResource: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
  };

  const officerResult = determinePattern(officerWithOutput, '待综合判断', getTenGod);
  const wealthResult = determinePattern(wealthWithPeer, '待综合判断', getTenGod);
  const resourceResult = determinePattern(resourceWithWealth, '待综合判断', getTenGod);
  const foodResult = determinePattern(foodWithResource, '待综合判断', getTenGod);

  assert.equal(officerResult.pattern, '正官格');
  assert.match(officerResult.basis || '', /正官为当前月令所用，又见食神明透/);
  assert.match(officerResult.basis || '', /官忌食伤/);
  assert.match(officerResult.basis || '', /财印、合伤等救应/);
  assert.equal(wealthResult.pattern, '正财格');
  assert.match(wealthResult.basis || '', /财星为当前月令所用，又见比肩明透/);
  assert.match(wealthResult.basis || '', /财畏比劫/);
  assert.match(wealthResult.basis || '', /财之轻重及食官等救应/);
  assert.equal(resourceResult.pattern, '正印格');
  assert.match(resourceResult.basis || '', /印星为当前月令所用，又见偏财明透/);
  assert.match(resourceResult.basis || '', /印惧财破/);
  assert.match(resourceResult.basis || '', /印之轻重、财根与透干位置/);
  assert.equal(foodResult.pattern, '食神格');
  assert.match(foodResult.basis || '', /食神为当前月令所用，又见正印明透/);
  assert.match(foodResult.basis || '', /食畏印夺/);
  assert.match(foodResult.basis || '', /制化与护食救应/);
});

test('正官月令所受刑冲破害应逐柱记录且不直接等同破格', () => {
  const clashBreakHarm = createPillars('丁卯', '癸酉', '甲子', '甲戌');
  const selfPunishment = createPillars('辛酉', '癸酉', '甲子', '戊辰');

  const relationResult = determinePattern(clashBreakHarm, '待综合判断', getTenGod);
  const punishmentResult = determinePattern(selfPunishment, '待综合判断', getTenGod);

  assert.equal(relationResult.pattern, '正官格');
  assert.match(relationResult.basis || '', /年支卯与月令酉相冲/);
  assert.match(relationResult.basis || '', /日支子与月令酉相破/);
  assert.match(relationResult.basis || '', /时支戌与月令酉相害/);
  assert.match(relationResult.basis || '', /单项关系不直接等同于破格/);
  assert.equal(punishmentResult.pattern, '正官格');
  assert.match(punishmentResult.basis || '', /年支酉与月令酉相刑/);
  assert.match(punishmentResult.basis || '', /正官格成败边界/);
});

test('正官格财印并透应按相隔、相邻五合与直接相克区分相碍关系', () => {
  const separated = createPillars('甲申', '癸酉', '甲午', '戊辰');
  const combined = createPillars('壬戌', '丁卯', '戊午', '乙卯');
  const controlled = createPillars('己未', '癸酉', '甲午', '戊辰');

  const separatedResult = determinePattern(separated, '待综合判断', getTenGod);
  const combinedResult = determinePattern(combined, '待综合判断', getTenGod);
  const controlledResult = determinePattern(controlled, '待综合判断', getTenGod);

  assert.equal(separatedResult.pattern, '正官格');
  assert.match(separatedResult.basis || '', /月干癸（正印）/);
  assert.match(separatedResult.basis || '', /时干戊（偏财）/);
  assert.match(separatedResult.basis || '', /均有其他柱干隔开/);
  assert.match(separatedResult.basis || '', /财印不相碍.*柱位候选/);
  assert.equal(combinedResult.pattern, '正官格');
  assert.match(combinedResult.basis || '', /年干壬（偏财）与月干丁（正印）相邻五合/);
  assert.match(combinedResult.basis || '', /财印直接相合的相碍事实/);
  assert.equal(controlledResult.pattern, '正官格');
  assert.match(controlledResult.basis || '', /年干己（正财）与月干癸（正印）相邻/);
  assert.match(controlledResult.basis || '', /财五行直接克印五行/);
  assert.match(controlledResult.basis || '', /财印直接相碍的局部冲突/);
});

test('正官遇伤佩印应同时识别伤官明透与完整会局伤官结构', () => {
  const exposedHurt = createPillars('辛酉', '丁卯', '戊午', '壬子');
  const formedHurt = createPillars('己卯', '辛未', '壬寅', '辛亥');

  const exposedResult = determinePattern(exposedHurt, '待综合判断', getTenGod);
  const formedResult = determinePattern(formedHurt, '待综合判断', getTenGod);

  assert.equal(exposedResult.pattern, '正官格');
  assert.match(exposedResult.basis || '', /年干辛伤官明透/);
  assert.match(exposedResult.basis || '', /遇伤佩印.*局部救应候选/);
  assert.equal(formedResult.pattern, '待综合判断');
  assert.match(formedResult.basis || '', /原典宣参国精确例型己卯、辛未、壬寅、辛亥/);
  assert.match(formedResult.basis || '', /亥卯未完整三合木局成伤官结构/);
  assert.match(formedResult.basis || '', /两辛印明透制伤/);
  assert.match(formedResult.basis || '', /不覆盖透干会支并用的格名边界/);
});

test('正官格混杀应区分相邻五合取清候选与未合官杀混杂', () => {
  const killerCombined = createPillars('庚寅', '乙酉', '甲子', '戊辰');
  const killerUnresolved = createPillars('庚寅', '丁酉', '甲子', '戊辰');

  const combinedResult = determinePattern(killerCombined, '待综合判断', getTenGod);
  const unresolvedResult = determinePattern(killerUnresolved, '待综合判断', getTenGod);

  assert.equal(combinedResult.pattern, '正官格');
  assert.match(combinedResult.basis || '', /年干庚七杀与月干乙（劫财）相邻五合/);
  assert.match(combinedResult.basis || '', /合杀留官.*局部取清候选/);
  assert.match(combinedResult.basis || '', /不证明已经合化或最终取清/);
  assert.equal(unresolvedResult.pattern, '正官格');
  assert.match(unresolvedResult.basis || '', /七杀明透，形成官杀混杂待复核/);
  assert.doesNotMatch(unresolvedResult.basis || '', /合杀留官/);
});

test('官伤印财同透应记录一般带忌并保留原典双印分工例外', () => {
  const generalConflict = createPillars('辛酉', '丁卯', '戊午', '壬子');
  const fanTaifuExample = createPillars('丁丑', '壬寅', '己巳', '丙寅');

  const conflictResult = determinePattern(generalConflict, '待综合判断', getTenGod);
  const exceptionResult = determinePattern(fanTaifuExample, '待综合判断', getTenGod);

  assert.equal(conflictResult.pattern, '正官格');
  assert.match(conflictResult.basis || '', /伤官、印星、财星同时明透/);
  assert.match(conflictResult.basis || '', /财去印而护伤为一般带忌条件/);
  assert.match(conflictResult.basis || '', /是否尚有另一印星制伤/);
  assert.equal(exceptionResult.pattern, '正印格');
  assert.match(exceptionResult.basis || '', /原典范太傅精确例型丁丑、壬寅、己巳、丙寅/);
  assert.match(exceptionResult.basis || '', /巳丑拱金为伤官结构而丙丁双印明透/);
  assert.match(exceptionResult.basis || '', /丁壬五合与另一丙印制伤分工并存/);
  assert.match(exceptionResult.basis || '', /不改变既有格名/);
  assert.match(exceptionResult.basis || '', /不推导富贵、官职、品级、分数或概率/);
});

test('食神制杀透财、杀逢食制透印与财生官露食应记录原典带忌条件', () => {
  const foodKillerWealth: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '己', zhi: '未', ganZhi: '己未' },
  };
  const killerFoodResource: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '己', zhi: '巳', ganZhi: '己巳' },
    hour: { gan: '辛', zhi: '未', ganZhi: '辛未' },
  };
  const wealthOfficerFood: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  };

  const foodResult = determinePattern(foodKillerWealth, '待综合判断', getTenGod);
  const killerResult = determinePattern(killerFoodResource, '待综合判断', getTenGod);
  const wealthResult = determinePattern(wealthOfficerFood, '待综合判断', getTenGod);

  assert.equal(foodResult.pattern, '食神格');
  assert.match(foodResult.basis || '', /七杀与偏财同见明透/);
  assert.match(foodResult.basis || '', /财能生杀而妨碍食神制杀/);
  assert.match(foodResult.basis || '', /财能破格/);
  assert.equal(killerResult.pattern, '七杀格');
  assert.match(killerResult.basis || '', /食神与偏印同见明透/);
  assert.match(killerResult.basis || '', /印来护杀并妨碍食神制杀/);
  assert.match(killerResult.basis || '', /印能破格/);
  assert.equal(wealthResult.pattern, '正财格');
  assert.match(wealthResult.basis || '', /正官与食神同见明透/);
  assert.match(wealthResult.basis || '', /财能生官而又露食使结构混杂/);
  assert.match(wealthResult.basis || '', /食能破格/);
  assert.match(wealthResult.basis || '', /不据此直接判定最终成败/);
});

test('春木见火与官但火旺条件未闭合时不得硬套四吉神破格结论', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '建禄格');
  assert.doesNotMatch(result.basis || '', /四吉神能破格/);
  assert.doesNotMatch(result.basis || '', /见官则忌/);
});

test('财格逢比劫并透伤官时应记录化劫生财的局部救应', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '偏财格');
  assert.match(result.basis || '', /四吉神能破格边界/);
  assert.match(result.basis || '', /财畏比劫/);
  assert.match(result.basis || '', /四凶神能成格边界/);
  assert.match(result.basis || '', /比肩与伤官同见明透/);
  assert.match(result.basis || '', /伤官可化劫生财/);
  assert.match(result.basis || '', /不改变既有格名，也不据此直接判定最终成败/);
});

test('食神带杀无财透枭时应记录弃食就杀边界，支藏财则不得套用', () => {
  const noWealth: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  };
  const hiddenWealth: Pillars = {
    ...noWealth,
    year: { gan: '甲', zhi: '申', ganZhi: '甲申' },
  };

  const noWealthResult = determinePattern(noWealth, '待综合判断', getTenGod);
  const hiddenWealthResult = determinePattern(hiddenWealth, '待综合判断', getTenGod);

  assert.equal(noWealthResult.pattern, '食神格');
  assert.match(noWealthResult.basis || '', /食畏印夺/);
  assert.match(noWealthResult.basis || '', /七杀与偏印同见明透/);
  assert.match(noWealthResult.basis || '', /年、月、时干及四支藏干均无正偏财/);
  assert.match(noWealthResult.basis || '', /食带煞而无财，弃食就煞而透印/);
  assert.match(noWealthResult.basis || '', /枭可作为局部救应/);
  assert.equal(hiddenWealthResult.pattern, '食神格');
  assert.match(hiddenWealthResult.basis || '', /食畏印夺/);
  assert.doesNotMatch(hiddenWealthResult.basis || '', /弃食就煞而透印/);
  assert.doesNotMatch(hiddenWealthResult.basis || '', /枭可作为局部救应/);
});

test('财格见杀只在五阳干实际出现阳刃支时记录刃可解厄', () => {
  const yangBlade: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    hour: { gan: '壬', zhi: '子', ganZhi: '壬子' },
  };
  const yinPeak: Pillars = {
    year: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    day: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
    hour: { gan: '庚', zhi: '子', ganZhi: '庚子' },
  };

  const yangResult = determinePattern(yangBlade, '待综合判断', getTenGod);
  const yinResult = determinePattern(yinPeak, '待综合判断', getTenGod);

  assert.equal(yangResult.pattern, '偏财格');
  assert.match(yangResult.basis || '', /七杀明透及日主阳刃支午/);
  assert.match(yangResult.basis || '', /财逢七煞，刃可解厄/);
  assert.equal(yinResult.pattern, '偏财格');
  assert.doesNotMatch(yinResult.basis || '', /四凶神能成格边界/);
  assert.doesNotMatch(yinResult.basis || '', /刃可解厄/);
});

test('财格根气、明透数量与财生官只记录客观候选，不替代强弱判断', () => {
  const cases = [
    {
      pillars: createPillars('甲子', '丙子', '戊辰', '壬子'),
      pattern: '正财格',
      expected: [/“寅透乙、卯透甲”类一位不为太露/, /这里只证明有财根/, /“透一位以清用”的数量候选/],
    },
    {
      pillars: createPillars('甲子', '丁卯', '庚午', '甲申'),
      pattern: '正财格',
      expected: [/多露可有例外/, /具“财旺生官”的客观部分/, /不能直接判多露无碍/],
    },
    {
      pillars: createPillars('甲子', '丁卯', '辛未', '甲午'),
      pattern: '偏财格',
      expected: [/“不宜太露”的数量带忌候选/, /根深、财旺及是否另有官护仍须全局复核/],
    },
  ];

  cases.forEach(({ pillars, pattern, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', /财格成败边界/);
    expected.forEach((marker) => assert.match(result.basis || '', marker));
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:富贵|贫贱)|必(?:富|贵|贫|败)|妻妾(?:必|定)|格局评分|成功率/,
    );
  });
});

test('财格食官印组合应区分隔位、相碍、暗官与会局边界', () => {
  const cases = [
    {
      pillars: createPillars('甲子', '丙子', '戊辰', '庚申'),
      expected: [
        /具“财用食生”的局部结构/,
        /财用食印时食印相克的位置冲突/,
        /“制杀生财”的局部取清候选/,
      ],
    },
    {
      pillars: createPillars('甲子', '丙子', '己巳', '辛未'),
      expected: [/财用食生结构又见.*正官明透/, /不把官星单独判为格坏/],
    },
    {
      pillars: createPillars('乙丑', '己卯', '庚午', '丙子'),
      expected: [/财格佩印时财印相碍/, /年干乙正财与月干己正印相邻且财克印/],
    },
    {
      pillars: createPillars('甲子', '癸酉', '丙寅', '戊子'),
      expected: [/“财格佩印、财印不相碍”/, /“食与印两不相碍”的精确位置候选/],
    },
    {
      pillars: createPillars('甲子', '庚午', '壬申', '丁未'),
      expected: [/印去食护暗官的局部候选/, /“单透财而月令有暗官”的结构事实/],
    },
    {
      pillars: createPillars('乙丑', '己卯', '庚子', '丁亥'),
      expected: [/完整三会水局成食神结构/, /会局食神不能套用外干年时隔位/],
    },
  ];

  cases.forEach(({ pillars, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.match(result.pattern, /财格$/);
    expected.forEach((marker) => assert.match(result.basis || '', marker));
    assert.match(result.basis || '', /身强弱|身强|强弱/);
    assert.doesNotMatch(result.basis || '', /已经合化|判定为(?:富贵|贫贱)|格局评分|成功率/);
  });
});

test('财格带伤杀及杀印应并列取清与冲突候选，不抢先定案', () => {
  const cases = [
    {
      pillars: createPillars('甲子', '丙子', '戊辰', '辛酉'),
      expected: [/财带伤官的条件待复核/],
    },
    {
      pillars: createPillars('甲子', '丁丑', '甲子', '己巳'),
      expected: [/具伤官化劫生财的局部候选/],
    },
    {
      pillars: createPillars('甲子', '己巳', '癸酉', '丙辰'),
      expected: [/“合杀存财”的局部取清候选/, /五合不等于已经合化或最终取清/],
    },
    {
      pillars: createPillars('甲子', '丙子', '戊辰', '壬子'),
      expected: [/保留财带七杀待复核/, /财、杀、印同时明透/],
    },
    {
      pillars: createPillars('甲子', '丙子', '戊辰', '甲寅'),
      expected: [/“财用杀印、印化杀”的局部候选/, /未见财星明透/],
    },
    {
      pillars: createPillars('甲子', '丙子', '戊辰', '戊午'),
      expected: [/“弃财就杀”的条件候选/, /另一候选并存复核/],
    },
    {
      pillars: createPillars('甲子', '己巳', '壬申', '丙午'),
      expected: [/“弃杀就财”的局部取舍候选/, /是否真正存财弃杀仍须结合全局复核/],
    },
  ];

  cases.forEach(({ pillars, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    expected.forEach((marker) => assert.match(result.basis || '', marker));
    assert.match(result.basis || '', /最终取舍仍须全局复核/);
    assert.doesNotMatch(result.basis || '', /判定为(?:富贵|贫贱)|必(?:富|贵|贫|败)|分数或概率.*\d/);
  });
});

test('论财五个原典例型只保存精确结构且不强改现有格名', () => {
  const cases = [
    {
      pillars: createPillars('壬寅', '壬寅', '庚辰', '辛巳'),
      pattern: '待综合判断',
      expected: /原典杨待郎精确例型.*略带一位比劫/,
    },
    {
      pillars: createPillars('壬辰', '乙巳', '癸巳', '辛酉'),
      pattern: '待综合判断',
      expected: /原典平江伯精确例型.*印制食以护暗官/,
    },
    {
      pillars: createPillars('甲子', '辛未', '辛酉', '壬辰'),
      pattern: '待综合判断',
      expected: /原典汪学士精确例型.*伤官化劫生财/,
    },
    {
      pillars: createPillars('乙酉', '庚辰', '甲午', '戊辰'),
      pattern: '待综合判断',
      expected: /原典毛状元精确例型.*合杀存财/,
    },
    {
      pillars: createPillars('丙辰', '丙申', '丙午', '壬辰'),
      pattern: '七杀格',
      expected: /原典尚书精确例型.*弃财就杀例型/,
    },
  ];

  cases.forEach(({ pillars, pattern, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', expected);
    assert.match(result.basis || '', /不改变既有格名/);
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:富贵|贫贱)|必(?:富|贵|贫|败)|妻妾(?:必|定)|格局评分|成功率/,
    );
  });
});

test('印格官、食伤与七杀只记录局部结构并保留身印强弱分叉', () => {
  const cases = [
    {
      pillars: createPillars('丙寅', '戊戌', '辛酉', '戊子'),
      pattern: '正印格',
      expected: [/“印用官”的官清纯客观部分/, /身旺、印强、官清及三者实际轻重仍须全局复核/],
    },
    {
      pillars: createPillars('丙戌', '戊戌', '辛未', '壬辰'),
      pattern: '正印格',
      expected: [/印制食伤以护官的局部结构/, /“印用食伤”以泄秀的局部结构/],
    },
    {
      pillars: createPillars('庚寅', '丙子', '甲辰', '丙寅'),
      pattern: '正印格',
      expected: [/“印用七杀”的局部结构/, /杀有食伤制、印生身而食伤泄身的局部制泄结构/],
    },
  ];

  cases.forEach(({ pillars, pattern, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', /印格成败边界/);
    expected.forEach((marker) => assert.match(result.basis || '', marker));
    assert.match(result.basis || '', /不以明透或藏干数量硬判|不能由十神数量直接判定|全局复核/);
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:富贵|贫贱)|必(?:富|贵|贫|败)|格局评分|成功率/,
    );
  });
});

test('印财食同见应区分食合印、财合印和无相邻五合三类', () => {
  const cases = [
    {
      pillars: createPillars('庚寅', '乙酉', '癸亥', '丙辰'),
      pattern: '偏印格',
      expected: [/食合印存财.*局部取清候选/, /五合事实不证明已经合化/],
    },
    {
      pillars: createPillars('己未', '甲戌', '辛未', '癸巳'),
      pattern: '待综合判断',
      expected: [/财合印存食.*局部取清候选/, /不认定已经合化|五合不等于已经合化/],
    },
    {
      pillars: createPillars('甲子', '戊戌', '辛未', '癸巳'),
      pattern: '正印格',
      expected: [/印、财、食神同见/, /保留三者混合结构待复核/],
    },
  ];

  cases.forEach(({ pillars, pattern, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', /印格成败边界/);
    expected.forEach((marker) => assert.match(result.basis || '', marker));
    assert.match(result.basis || '', /财根|无财根/);
    assert.doesNotMatch(result.basis || '', /已经合化.*成立|根深已定|印重已定|财轻已定/);
  });
});

test('印格官杀竞透应区分合杀、食伤制与未取清，并记录劫财存杀印候选', () => {
  const cases = [
    {
      pillars: createPillars('乙丑', '庚子', '甲辰', '辛巳'),
      expected: [/“合杀留官”的局部取清候选/, /五合不等于已经合化或最终取清/],
    },
    {
      pillars: createPillars('壬子', '癸卯', '丙子', '己亥'),
      expected: [/食伤制官杀的局部取清候选/, /是否尽制及最终留官留杀仍须复核/],
    },
    {
      pillars: createPillars('辛酉', '庚子', '甲辰', '戊辰'),
      expected: [/官杀竞透而未见相邻五合或食伤明透、成局的取清组件/, /官杀混杂待复核/],
    },
    {
      pillars: createPillars('庚戌', '戊子', '甲戌', '乙亥'),
      expected: [/劫财制财以存杀印的局部救应候选/, /财劫杀印强弱与最终取舍仍须全局复核/],
    },
  ];

  cases.forEach(({ pillars, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, '正印格');
    assert.match(result.basis || '', /印格成败边界/);
    expected.forEach((marker) => assert.match(result.basis || '', marker));
  });
});

test('论印十三个原典例型只保存精确结构且半合不得自动化印为劫', () => {
  const cases = [
    ['丙寅', '戊戌', '辛酉', '戊子', /原典张参政精确例型.*印用官/],
    ['丙戌', '戊戌', '辛未', '壬辰', /原典朱尚书精确例型.*印制伤官以护官/],
    ['乙亥', '己卯', '丁酉', '壬寅', /原典临淮侯精确例型.*印用食神/],
    ['戊戌', '乙卯', '丙午', '乙亥', /原典李状元精确例型.*不以印星数量判印旺身强/],
    ['己巳', '癸酉', '癸未', '庚申', /原典茅状元精确例型.*印用七杀/],
    ['壬寅', '戊申', '壬辰', '壬寅', /原典马参政精确例型.*不以比肩数量/],
    ['辛酉', '丙申', '壬申', '辛亥', /原典汪侍郎精确例型.*印多用财/],
    ['庚寅', '乙酉', '癸亥', '丙辰', /原典牛监簿精确例型.*食合印存财/],
    ['己未', '甲戌', '辛未', '癸巳', /原典合财存食精确例型.*财合印存食/],
    ['辛亥', '庚子', '甲辰', '乙亥', /原典合杀留官精确例型.*合杀留官候选/],
    ['壬子', '癸卯', '丙子', '己亥', /原典官杀有制精确例型.*食伤制官杀/],
    ['丙午', '庚寅', '丙午', '癸巳', /原典化印为劫精确例型.*半合不作为完整三合火局运行/],
    ['庚戌', '戊子', '甲戌', '乙亥', /原典劫财存杀印精确例型.*劫财制财以存杀印/],
  ] as const;

  cases.forEach(([year, month, day, hour, expected]) => {
    const result = determinePattern(createPillars(year, month, day, hour), '待综合判断', getTenGod);
    assert.match(result.basis || '', expected);
    assert.match(result.basis || '', /不改变既有格名/);
    assert.doesNotMatch(
      result.basis || '',
      /印已化劫(?:成立|成功)|弃印就财官(?:成立|成功)|判定为(?:富贵|贫贱)|格局评分|成功率/,
    );
  });
});

test('印格见杀但根轻条件未闭合时不得硬判杀能成格', () => {
  const pillars: Pillars = {
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '正印格');
  assert.doesNotMatch(result.basis || '', /四凶神能成格边界/);
  assert.doesNotMatch(result.basis || '', /根轻|杀能成格|煞能成格/);
});

test('正官印食杀四格应按全部明透位置记录原典先后关系', () => {
  const cases = [
    {
      pillars: createPillars('甲子', '戊辰', '癸酉', '丙辰'),
      pattern: '正官格',
      expected: /伤官全部先于财星明透，后财可作解伤护官/,
    },
    {
      pillars: createPillars('丙寅', '戊戌', '癸酉', '甲寅'),
      pattern: '正官格',
      expected: /财星全部先于伤官明透，后伤仍构成损官/,
    },
    {
      pillars: createPillars('甲子', '戊辰', '庚午', '丙子'),
      pattern: '偏印格',
      expected: /财星全部先于印星明透，后印承接月令用神/,
    },
    {
      pillars: createPillars('甲子', '丁卯', '丙寅', '庚寅'),
      pattern: '正印格',
      expected: /印星全部先于财星明透，后财构成坏印/,
    },
    {
      pillars: createPillars('甲子', '戊辰', '丙寅', '庚寅'),
      pattern: '食神格',
      expected: /偏印全部先于财星明透，后财可作制枭护食/,
    },
    {
      pillars: createPillars('甲子', '丁卯', '癸酉', '辛酉'),
      pattern: '食神格',
      expected: /财星全部先于偏印明透，后枭仍构成夺食/,
    },
    {
      pillars: createPillars('乙丑', '癸未', '己巳', '辛未'),
      pattern: '七杀格',
      expected: /财星全部先于食神明透，后食可作制杀/,
    },
    {
      pillars: createPillars('甲子', '戊辰', '壬午', '丙午'),
      pattern: '七杀格',
      expected: /食神全部先于财星明透，后财仍有泄食生杀/,
    },
  ];

  cases.forEach(({ pillars, pattern, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', /生克先后边界/);
    assert.match(result.basis || '', expected);
    assert.match(result.basis || '', /不改变既有格名/);
    assert.doesNotMatch(result.basis || '', /必亨|大贵|萧索|难永寿|子嗣亦难|晚景亦悴/);
  });
});

test('同类明透分居另一类前后时不得硬判单一生克先后', () => {
  const cases = [
    createPillars('丁卯', '己酉', '甲子', '丁卯'),
    createPillars('甲子', '戊辰', '辛未', '甲午'),
    createPillars('丙寅', '辛卯', '癸酉', '丙辰'),
    createPillars('丁卯', '己酉', '乙丑', '丁丑'),
  ];

  cases.forEach((pillars) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.doesNotMatch(result.basis || '', /生克先后边界/);
  });
});

test('原典三个合法隔位例型只记录精确位置关系且不改变格名', () => {
  const cases = [
    {
      pillars: createPillars('癸酉', '甲寅', '丙寅', '戊子'),
      pattern: '待综合判断',
      expected: /月干甲隔于癸官、戊食之间，只记录戊不越甲合癸/,
    },
    {
      pillars: createPillars('癸酉', '辛酉', '丙寅', '己丑'),
      pattern: '正财格',
      expected: /月干辛财隔于癸官、己伤之间，只记录财间伤官/,
    },
    {
      pillars: createPillars('壬申', '戊申', '辛丑', '丙申'),
      pattern: '待综合判断',
      expected: /月干戊印隔于壬伤、丙官之间，只记录印隔伤官/,
    },
  ];

  cases.forEach(({ pillars, pattern, expected }) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.equal(result.pattern, pattern);
    assert.match(result.basis || '', /生克先后边界/);
    assert.match(result.basis || '', expected);
    assert.doesNotMatch(result.basis || '', /大贵|小贵|格尽破|无望其贵/);
  });
});

test('隔位例型缺少原典指定年干时不得按相似位置泛化', () => {
  const cases = [
    createPillars('戊子', '甲寅', '丙寅', '戊子'),
    createPillars('戊子', '辛酉', '丙寅', '己丑'),
    createPillars('丁卯', '戊申', '辛丑', '丙申'),
  ];

  cases.forEach((pillars) => {
    const result = determinePattern(pillars, '待综合判断', getTenGod);
    assert.doesNotMatch(result.basis || '', /原典隔位关系/);
  });
});

test('官制月劫与食神制杀应按原典记录无情终转有情', () => {
  const officerControlsRobbery: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
  };
  const outputControlsKiller: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  };

  const officerResult = determinePattern(officerControlsRobbery, '待综合判断', getTenGod);
  const outputResult = determinePattern(outputControlsKiller, '待综合判断', getTenGod);

  assert.match(officerResult.basis || '', /戊官透出而申子辰会水劫/);
  assert.match(officerResult.basis || '', /官制月劫正合所用/);
  assert.match(officerResult.basis || '', /无情而终为有情/);
  assert.equal(outputResult.pattern, '食神格');
  assert.match(outputResult.basis || '', /戊食与壬杀同透/);
  assert.match(outputResult.basis || '', /食神制杀各得其用/);
  assert.match(outputResult.basis || '', /无情而终为有情/);
  assert.match(outputResult.basis || '', /不据此直接判定最终成败/);
});

test('月令单透同时会支时必须透与会并用，不得只按透干强定单格', () => {
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /癸（正印）透出/);
  assert.match(result.basis || '', /月支辰参与地支申子辰完整三合水结构（水印星）/);
  assert.match(result.basis || '', /透而又会，则透与会并用/);
  assert.match(result.basis || '', /有情无情判断成败/);
});

test('壬生未月己官透而会亥卯木伤官时应按原典记录局部无情', () => {
  const pillars: Pillars = {
    year: { gan: '己', zhi: '亥', ganZhi: '己亥' },
    month: { gan: '辛', zhi: '未', ganZhi: '辛未' },
    day: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    hour: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /己（正官）透出/);
  assert.match(result.basis || '', /月支未参与地支亥卯未完整三合木结构（木食伤）/);
  assert.match(result.basis || '', /己官透出而亥卯未会木伤官/);
  assert.match(result.basis || '', /官与伤官相背/);
  assert.match(result.basis || '', /合而无情/);
  assert.match(result.basis || '', /不据此直接判定最终成败/);
});

test('月令兼透又会支时必须把会支一并写入综合判断依据', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
    month: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /戊（偏财）、辛（正官）透出/);
  assert.match(result.basis || '', /月支戌参与地支寅午戌完整三合火结构（火食伤）/);
  assert.match(result.basis || '', /透而又会，则透与会并用/);
});

test('甲生辰月藏干全不透而会申子时应按水印会支取用', () => {
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '印格');
  assert.match(result.basis || '', /月令藏干均未透出/);
  assert.match(result.basis || '', /月支辰参与地支申子辰完整三合水结构（水印星）/);
  assert.match(result.basis || '', /何谓会支/);
  assert.match(result.basis || '', /不凭会局五行补造正偏极性/);
});

test('月令只有一项藏干且会局同类时应保留正偏格名并补全会支依据', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '正印格');
  assert.match(result.basis || '', /月令只有乙一项藏干且未透出/);
  assert.match(result.basis || '', /月支卯参与地支寅卯辰完整三会木结构（木印星）/);
  assert.match(result.basis || '', /唯一藏干与会局五行一致/);
});

test('乙生寅月藏干全不透而会午戌时应由月劫改按食伤会支取用', () => {
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
    month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    day: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '戊');

  assert.equal(result.pattern, '食伤格');
  assert.match(result.basis || '', /月支寅参与地支寅午戌完整三合火结构（火食伤）/);
  assert.match(result.basis || '', /当前戊司权另作得时事实，不覆盖会支取用/);
  assert.doesNotMatch(result.pattern, /劫财格/);
});

test('建禄遇月支完整会局时应保留月令底格并补充格外取用事实', () => {
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
    month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '建禄格');
  assert.match(result.basis || '', /月令底格仍按建禄格/);
  assert.match(result.basis || '', /月支寅参与地支寅午戌完整三合火结构（火食伤）/);
  assert.match(result.basis || '', /年干壬（偏印）、月干壬（偏印）、时干壬（偏印）明透/);
  assert.match(result.basis || '', /透干会支，另取用神/);
  assert.match(result.basis || '', /不据三支齐全直接宣称已经合化、化劫、成格或破格/);
});

test('建禄会财且财官伤并透时不得只报固定格名而漏掉取用条件', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '癸', zhi: '巳', ganZhi: '癸巳' },
    day: { gan: '丙', zhi: '戌', ganZhi: '丙戌' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '戊');

  assert.equal(result.pattern, '建禄格');
  assert.match(result.basis || '', /月支巳参与地支巳酉丑完整三合金结构（金财星）/);
  assert.match(result.basis || '', /年干辛（正财）、月干癸（正官）、时干己（伤官）明透/);
  assert.match(result.basis || '', /当前戊司权另作得时事实/);
});

test('月刃遇会印并见杀财伤时应保留制刃配合事实而不提前判成败', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
    hour: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '丁');

  assert.equal(result.pattern, '月刃格');
  assert.match(result.basis || '', /月令底格仍按月刃格/);
  assert.match(result.basis || '', /月支午参与地支寅午戌完整三合火结构（火印星）/);
  assert.match(result.basis || '', /年干辛（伤官）、月干甲（七杀）、时干壬（偏财）明透/);
  assert.match(result.basis || '', /阳刃喜官杀制伏，并须合看财印、伤食配合/);
  assert.match(result.basis || '', /不据三支齐全直接宣称已经合化、化刃、成格或破格/);
});

test('不含月支的局外完整会局不得冒充无透干会支取用', () => {
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '庚', zhi: '戌', ganZhi: '庚戌' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '待综合判断');
  assert.match(result.basis || '', /月令藏干戊（偏财）、乙（劫财）、癸（正印）均未透出/);
  assert.doesNotMatch(result.basis || '', /何谓会支/);
});

test('完整会局未包含月支时不得冒充月令会支改写单透格局', () => {
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod);

  assert.equal(result.pattern, '偏财格');
  assert.match(result.basis || '', /戊为月令藏干，单独透于月干/);
  assert.doesNotMatch(result.basis || '', /透而又会/);
});

test('月令藏干只有一项透出时仍按一透一用取格', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  };

  const result = determinePattern(pillars, '身强', getTenGod, '戊');

  assert.equal(result.isSpecial, false);
  assert.equal(result.pattern, '杂气正官格');
  assert.match(result.basis || '', /辛为月令藏干，单独透于年干/);
  assert.match(result.basis || '', /一透则一用/);
});

test('甲生辰月单透乙劫财时应按一透一用，不得跳过同党透干退回未透本气', () => {
  const pillars: Pillars = {
    year: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    month: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '戊');

  assert.equal(result.pattern, '杂气劫财格');
  assert.match(result.basis || '', /乙为月令藏干，单独透于年干/);
  assert.match(result.basis || '', /一透则一用/);
  assert.match(result.basis || '', /戊司权另作月令得时事实，不覆盖已透藏干/);
});

test('庚生午月单透己印时应以透干定格，丁司令只作得时事实', () => {
  const pillars: Pillars = {
    year: { gan: '己', zhi: '未', ganZhi: '己未' },
    month: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    day: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  };

  const result = determinePattern(pillars, '待综合判断', getTenGod, '丁');

  assert.equal(result.pattern, '杂气正印格');
  assert.match(result.basis || '', /己为月令藏干，单独透于年干/);
  assert.match(result.basis || '', /丁司权另作月令得时事实，不覆盖已透藏干/);
});

test('特殊格判断应把月令司权计入，不应只看月支藏干整体属性', () => {
  const pillars: Pillars = {
    year: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '壬', zhi: '子', ganZhi: '壬子' },
  };

  const result = determinePattern(pillars, '极强', getTenGod, '戊');

  assert.equal(result.isSpecial, false);
  assert.notEqual(result.pattern, '专旺格');
});

test('亥卯未木局成势且月令司权同党时，不应因未中副气而漏判专旺格', () => {
  const pillars: Pillars = {
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '癸', zhi: '未', ganZhi: '癸未' },
  };

  const result = determinePattern(pillars, '极强', getTenGod, '乙');

  assert.equal(result.isSpecial, true);
  assert.equal(result.pattern, '专旺格');
  assert.match(result.basis || '', /局外未见明透或本气破格/);
});

test('巳酉丑金局成势且月令司权异党时，不应因丑中一点印星而漏判从格', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '己', zhi: '巳', ganZhi: '己巳' },
  };

  const result = determinePattern(pillars, '极弱', getTenGod, '己');

  assert.equal(result.isSpecial, true);
  // 从格已细分为从财格/从杀格/从儿格/从势格，此局金旺克甲木为官杀，应为从杀格
  assert.match(result.pattern, /^从(财|杀|儿|势|格)格?$/);
  assert.match(result.basis || '', /局外未见明透或本气扶身/);
});

test('特殊格主气判断不应被任意数值缩放或七成阈值左右', () => {
  const mixedOppositePillars: Pillars = {
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  };

  const result = determinePattern(mixedOppositePillars, '极弱', getTenGod);

  assert.equal(result.isSpecial, false);
  assert.doesNotMatch(result.pattern, /^从/);
});

test('格局判定应拒绝不存在的六十甲子，避免测试夹具污染算法', () => {
  assert.throws(
    () =>
      determinePattern(
        {
          year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
          month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
          day: { gan: '甲', zhi: '巳', ganZhi: '甲巳' },
          hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
        },
        '极弱',
        getTenGod,
        '己',
      ),
    /day柱不是有效六十甲子/,
  );
});

test('食神生财应记录财透与财根且不强求正偏财叠出', () => {
  const singleWealth = determinePattern(
    createPillars('丁未', '癸卯', '癸亥', '癸丑'),
    '待综合判断',
    getTenGod,
  );
  const mixedWealth = determinePattern(
    createPillars('甲午', '丁卯', '癸丑', '丙辰'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(singleWealth.pattern, '食神格');
  assert.match(singleWealth.basis || '', /食神生财.*局部结构/);
  assert.match(singleWealth.basis || '', /年支未藏丁.*见根气/);
  assert.match(singleWealth.basis || '', /不必正偏叠出/);
  assert.match(singleWealth.basis || '', /身强、食旺与财的实际轻重仍须全局复核/);
  assert.equal(mixedWealth.pattern, '食神格');
  assert.match(mixedWealth.basis || '', /丙正财、丁偏财同透/);
  assert.match(mixedWealth.basis || '', /正偏财叠出结构/);
  assert.match(mixedWealth.basis || '', /不推导富贵等级/);
});

test('食神格藏食露伤只记录客观结构而不推导性情', () => {
  const result = determinePattern(
    createPillars('丁亥', '癸卯', '癸卯', '甲寅'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(result.pattern, '食神格');
  assert.match(result.basis || '', /月令藏乙食神而外干见时干甲伤官/);
  assert.match(result.basis || '', /藏食露伤.*客观结构/);
  assert.match(result.basis || '', /不据此推导性情/);
  assert.doesNotMatch(result.basis || '', /性刚|性情刚强/);
});

test('食神用杀应区分杀印并见与无印无财单露七杀', () => {
  const killerResource = determinePattern(
    createPillars('辛卯', '辛卯', '癸酉', '己未'),
    '待综合判断',
    getTenGod,
  );
  const killerOnly = determinePattern(
    createPillars('戊戌', '壬戌', '丙子', '戊戌'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(killerResource.pattern, '食神格');
  assert.match(killerResource.basis || '', /不用财而就杀印.*局部结构/);
  assert.match(killerResource.basis || '', /无财星明透/);
  assert.doesNotMatch(killerResource.basis || '', /无印而单露偏官/);
  assert.equal(killerOnly.pattern, '食神格');
  assert.match(killerOnly.basis || '', /月干壬七杀单露/);
  assert.match(killerOnly.basis || '', /无印而单露偏官、无财透/);
  assert.match(killerOnly.basis || '', /不据此认定贵格/);
});

test('食神格气候例外应保留金水与夏木前提而不以月份代判调候成败', () => {
  const summerWealth = determinePattern(
    createPillars('己未', '己巳', '甲寅', '丙寅'),
    '待综合判断',
    getTenGod,
  );
  const summerResource = determinePattern(
    createPillars('丙午', '癸巳', '甲子', '丙寅'),
    '待综合判断',
    getTenGod,
  );
  const metalWaterKiller = determinePattern(
    createPillars('丁亥', '壬子', '辛巳', '丁酉'),
    '待综合判断',
    getTenGod,
  );
  const metalWaterOfficer = determinePattern(
    createPillars('壬申', '壬子', '辛巳', '丙申'),
    '待综合判断',
    getTenGod,
  );

  assert.match(summerWealth.basis || '', /夏木用财.*气候候选/);
  assert.match(summerWealth.basis || '', /火炎土燥是否成立仍须结合全局复核/);
  assert.match(summerResource.basis || '', /夏火太炎、透印不碍.*调候候选/);
  assert.match(summerResource.basis || '', /火炎木焦不能由月份或印星数量单独闭合/);
  assert.match(metalWaterKiller.basis || '', /金水食神用杀.*气候类别候选/);
  assert.match(metalWaterOfficer.basis || '', /金水食神见官不忌.*气候例外候选/);
  assert.doesNotMatch(
    [summerWealth, summerResource, metalWaterKiller, metalWaterOfficer]
      .map((item) => item.basis)
      .join('\n'),
    /判定为(?:贵格|富贵)|必贵|武职已定/,
  );
});

test('食神格应区分财解夺食、官杀竞出、合杀存财与财食杀位置', () => {
  const wealthSavesFood = determinePattern(
    createPillars('甲子', '丁卯', '癸酉', '庚申'),
    '待综合判断',
    getTenGod,
  );
  const officerKiller = determinePattern(
    createPillars('庚申', '己卯', '癸酉', '戊午'),
    '待综合判断',
    getTenGod,
  );
  const combinedKiller = determinePattern(
    createPillars('丁卯', '壬子', '辛未', '戊子'),
    '待综合判断',
    getTenGod,
  );
  const ordered = determinePattern(
    createPillars('癸酉', '辛酉', '己卯', '乙亥'),
    '待综合判断',
    getTenGod,
  );

  assert.match(wealthSavesFood.basis || '', /印来夺食、透财以解.*局部救应候选/);
  assert.match(wealthSavesFood.basis || '', /财能否实际制印护食仍须.*复核/);
  assert.match(officerKiller.basis || '', /官杀竞出结构/);
  assert.match(officerKiller.basis || '', /不抢先认定已经取清或最终成败/);
  assert.match(combinedKiller.basis || '', /年干丁七杀与月干壬伤官相邻五合/);
  assert.match(combinedKiller.basis || '', /食神格“合杀存财”的局部取清候选/);
  assert.match(ordered.basis || '', /年干癸偏财在先、月干辛食神居中、时干乙七杀在后/);
  assert.match(ordered.basis || '', /财先杀后、食以间之/);
  assert.match(ordered.basis || '', /不据此推导贵贱/);
});

test('论食神十个原典例型应保留结构事实且不覆盖既有格名边界', () => {
  const examples: Array<{
    pillars: [string, string, string, string];
    marker: RegExp;
  }> = [
    { pillars: ['丁未', '癸卯', '癸亥', '癸丑'], marker: /原典梁丞相精确例型/ },
    { pillars: ['己未', '壬申', '戊子', '庚申'], marker: /原典谢阁老精确例型/ },
    { pillars: ['丁亥', '癸卯', '癸卯', '甲寅'], marker: /原典沈路分精确例型/ },
    { pillars: ['甲午', '丁卯', '癸丑', '丙辰'], marker: /原典龚知县精确例型/ },
    { pillars: ['己未', '己巳', '甲寅', '丙寅'], marker: /原典黄都督精确例型/ },
    { pillars: ['辛卯', '辛卯', '癸酉', '己未'], marker: /原典常国公精确例型/ },
    { pillars: ['戊戌', '壬戌', '丙子', '戊戌'], marker: /原典胡会元精确例型/ },
    { pillars: ['丁亥', '壬子', '辛巳', '丁酉'], marker: /原典舒尚书精确例型/ },
    { pillars: ['丙午', '癸巳', '甲子', '丙寅'], marker: /原典钱参政精确例型/ },
    { pillars: ['癸酉', '辛酉', '己卯', '乙亥'], marker: /原典刘提台精确例型/ },
  ];

  examples.forEach(({ pillars, marker }) => {
    const result = determinePattern(createPillars(...pillars), '待综合判断', getTenGod);
    assert.match(result.basis || '', marker);
    assert.doesNotMatch(result.basis || '', /格局评分|成功率|现实财富必然/);
  });
  assert.equal(
    determinePattern(createPillars('己未', '壬申', '戊子', '庚申'), '待综合判断', getTenGod)
      .pattern,
    '待综合判断',
  );
});

test('伤官生财、财伤同根与化伤为财应分别保留客观结构和合化边界', () => {
  const sharedMonthPillars = createPillars('己卯', '丁丑', '丙寅', '庚寅');
  const sharedMonth = determinePattern(sharedMonthPillars, '待综合判断', getTenGod);
  const transformedPillars = createPillars('甲子', '丁卯', '壬申', '庚戌');
  const transformed = determinePattern(transformedPillars, '待综合判断', getTenGod);

  assert.equal(sharedMonth.pattern, '伤官格');
  assert.match(sharedMonth.basis || '', /伤官生财.*局部结构/);
  assert.match(sharedMonth.basis || '', /财伤同根月令.*类别事实/);
  assert.match(sharedMonth.basis || '', /不以藏干层级或数量推导秀气与贵贱/);
  assert.equal(transformed.pattern, '伤官格');
  assert.match(transformed.basis || '', /卯戌六合火.*财星五行.*固定关系/);
  assert.match(transformed.basis || '', /化伤为财.*关系候选/);
  assert.match(transformed.basis || '', /不等于已经合化/);
  assert.equal(
    analyzeHurtPatternStructure(transformedPillars, transformed.pattern, getTenGod)
      .wealthTransformationFacts[0]?.type,
    '六合',
  );
  assert.doesNotMatch(transformed.basis || '', /六合已经化火|已化财成格/);
});

test('伤官佩印与财印兼用应区分偏正叠出、隔位两清和相邻相碍', () => {
  const mixedResource = determinePattern(
    createPillars('乙丑', '戊子', '庚午', '己卯'),
    '待综合判断',
    getTenGod,
  );
  const separated = determinePattern(
    createPillars('丁酉', '己酉', '戊子', '壬子'),
    '待综合判断',
    getTenGod,
  );
  const obstructed = determinePattern(
    createPillars('甲子', '辛未', '丙寅', '己丑'),
    '待综合判断',
    getTenGod,
  );

  assert.match(mixedResource.basis || '', /伤官佩印.*局部结构/);
  assert.match(mixedResource.basis || '', /偏正印叠出结构/);
  assert.match(mixedResource.basis || '', /不由叠出数量直接判定/);
  assert.match(separated.basis || '', /壬偏财与年干丁正印外干隔位/);
  assert.match(separated.basis || '', /干头两清而不相碍.*客观位置条件/);
  assert.match(separated.basis || '', /财太旺而带印或印太重而带财均不能由数量代判/);
  assert.match(obstructed.basis || '', /辛正财与年干甲偏印相邻/);
  assert.match(obstructed.basis || '', /财克印在干头直接相碍/);
  assert.match(obstructed.basis || '', /不能闭合“两清不相碍”/);
});

test('伤官用杀印应把无财作为全局藏透边界而不由杀印数量代判强弱', () => {
  const noWealthPillars = createPillars('乙丑', '己卯', '壬申', '戊申');
  const noWealth = determinePattern(noWealthPillars, '待综合判断', getTenGod);
  const hiddenWealth = determinePattern(
    createPillars('己未', '丙子', '庚子', '丙子'),
    '待综合判断',
    getTenGod,
  );

  assert.match(noWealth.basis || '', /伤官用杀印.*组成候选/);
  assert.match(noWealth.basis || '', /明透及藏干均未见财星.*“无财”.*客观边界/);
  assert.match(noWealth.basis || '', /伤多身弱.*实际力度仍须复核/);
  assert.equal(
    analyzeHurtPatternStructure(noWealthPillars, noWealth.pattern, getTenGod).wealthHiddenFacts
      .length,
    0,
  );
  assert.match(hiddenWealth.basis || '', /未中.*藏乙正财/);
  assert.match(hiddenWealth.basis || '', /未闭合“无财”边界/);
  assert.doesNotMatch(hiddenWealth.basis || '', /无财条件已经成立|判定为贵格/);
});

test('伤官格气候类别应区分夏木见水、金水用官与非金水化财见官', () => {
  const summerWood = determinePattern(
    createPillars('乙丑', '壬午', '甲子', '丁卯'),
    '待综合判断',
    getTenGod,
  );
  const metalWater = determinePattern(
    createPillars('戊申', '甲子', '庚午', '丁丑'),
    '待综合判断',
    getTenGod,
  );
  const nonMetalTransformed = determinePattern(
    createPillars('甲子', '丁卯', '壬戌', '己酉'),
    '待综合判断',
    getTenGod,
  );

  assert.match(summerWood.basis || '', /夏木见水.*调候类别候选/);
  assert.match(summerWood.basis || '', /不能由月份或印数单独闭合/);
  assert.match(metalWater.basis || '', /金水伤官用官.*气候类别候选/);
  assert.match(metalWater.basis || '', /财印辅助/);
  assert.match(metalWater.basis || '', /伤官藏而未透.*官伤不并透/);
  assert.match(nonMetalTransformed.basis || '', /非金水伤官见官/);
  assert.match(nonMetalTransformed.basis || '', /只有合化另经全局成立后.*财旺生官/);
  assert.match(nonMetalTransformed.basis || '', /不直接排除伤官见官冲突/);
});

test('伤官格官杀并透必须有实际干头组件才可列取清候选', () => {
  const withoutComponent = determinePattern(
    createPillars('甲子', '丙子', '庚午', '丁丑'),
    '待综合判断',
    getTenGod,
  );
  const withComponentPillars = createPillars('乙丑', '己卯', '壬申', '戊申');
  const withComponent = determinePattern(withComponentPillars, '待综合判断', getTenGod);

  assert.match(withoutComponent.basis || '', /正官与月干丙七杀并透/);
  assert.match(withoutComponent.basis || '', /未见伤官制官或相邻五合取清组件/);
  assert.match(withoutComponent.basis || '', /不能仅凭官杀同见宣称已经取清/);
  assert.equal(
    analyzeHurtPatternStructure(
      createPillars('甲子', '丙子', '庚午', '丁丑'),
      withoutComponent.pattern,
      getTenGod,
    ).clearingComponents.length,
    0,
  );
  assert.match(withComponent.basis || '', /年干乙伤官制月干己正官/);
  assert.match(withComponent.basis || '', /干头取清组件候选/);
  assert.match(withComponent.basis || '', /不等于官杀已经取清/);
  assert.ok(
    analyzeHurtPatternStructure(withComponentPillars, withComponent.pattern, getTenGod)
      .clearingComponents.length > 0,
  );
});

test('论伤官十个完整原典例型应保存结构事实并排除残缺三柱伪例', () => {
  const examples: Array<{
    pillars: [string, string, string, string];
    marker: RegExp;
  }> = [
    { pillars: ['壬午', '己酉', '戊午', '庚申'], marker: /原典史春芳精确例型/ },
    { pillars: ['甲子', '乙亥', '辛未', '戊子'], marker: /原典罗状元精确例型/ },
    { pillars: ['己卯', '丁丑', '丙寅', '庚寅'], marker: /原典秦龙图精确例型/ },
    { pillars: ['壬申', '丙午', '甲午', '壬申'], marker: /原典孛罗平章精确例型/ },
    { pillars: ['丁酉', '己酉', '戊子', '壬子'], marker: /原典都统制精确例型/ },
    { pillars: ['壬戌', '己酉', '戊午', '丁巳'], marker: /原典丞相精确例型/ },
    { pillars: ['己未', '丙子', '庚子', '丙子'], marker: /原典蔡贵妃精确例型/ },
    { pillars: ['戊申', '甲子', '庚午', '丁丑'], marker: /原典金水伤官用官精确例型/ },
    { pillars: ['丙申', '己亥', '辛未', '己亥'], marker: /原典郑丞相精确例型/ },
    { pillars: ['甲子', '壬申', '己亥', '辛未'], marker: /原典章丞相精确例型/ },
  ];

  examples.forEach(({ pillars, marker }) => {
    const result = determinePattern(createPillars(...pillars), '待综合判断', getTenGod);
    assert.match(result.basis || '', marker);
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:贵格|富贵|贫贱)|必贵|大贵已定|官品已定|格局评分|成功率/,
    );
  });
  assert.doesNotMatch(
    examples
      .map(
        ({ pillars }) => determinePattern(createPillars(...pillars), '待综合判断', getTenGod).basis,
      )
      .join('\n'),
    /夏阁老精确例型|壬寅、丁未、丙寅、[甲乙丙丁戊己庚辛壬癸]/,
  );
});

test('七杀用食制只记录局部结构，不以十神数量代判强弱贵贱', () => {
  const result = determinePattern(
    createPillars('乙亥', '乙酉', '乙卯', '丁丑'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(result.pattern, '七杀格');
  assert.match(result.basis || '', /七杀格成败边界/);
  assert.match(result.basis || '', /时干丁食神明透.*杀用食制.*局部结构/);
  assert.match(result.basis || '', /杀旺、食强、身健与制杀力度均须全局复核/);
  assert.doesNotMatch(result.basis || '', /判定为(?:贵格|富贵)|极等之贵|王侯将相/);
});

test('七杀食制见财应让一般冲突与财食先后候选并存', () => {
  const wealthBeforeOutput = determinePattern(
    createPillars('乙丑', '壬午', '辛未', '丁酉'),
    '待综合判断',
    getTenGod,
  );
  const outputBeforeWealth = determinePattern(
    createPillars('甲子', '丁丑', '癸酉', '己未'),
    '待综合判断',
    getTenGod,
  );

  assert.match(wealthBeforeOutput.basis || '', /财泄食伤、生杀而妨碍制杀的一般冲突/);
  assert.match(wealthBeforeOutput.basis || '', /财星全部先于食伤明透/);
  assert.match(wealthBeforeOutput.basis || '', /财先食后.*与财生杀的一般冲突并存/);
  assert.match(outputBeforeWealth.basis || '', /食伤全部先于财星明透/);
  assert.match(outputBeforeWealth.basis || '', /后财仍有泄食伤、生杀的局部影响/);
});

test('七杀食制见印应保留印护杀冲突及印先食后的条件例外', () => {
  const result = determinePattern(
    createPillars('甲子', '丙子', '丁卯', '戊申'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(result.pattern, '七杀格');
  assert.match(result.basis || '', /印制食伤、护杀而妨碍制杀的一般冲突/);
  assert.match(result.basis || '', /印星全部先于食伤明透/);
  assert.match(result.basis || '', /食伤太旺另经全局成立/);
  assert.match(result.basis || '', /不据此直接成格/);
});

test('七杀用印应区分同通月令与未同通月令的转印条件', () => {
  const sharedMonthPillars = createPillars('丙寅', '戊戌', '壬戌', '辛丑');
  const sharedMonth = determinePattern(sharedMonthPillars, '待综合判断', getTenGod);
  const notSharedMonth = determinePattern(
    createPillars('甲子', '丙子', '丁卯', '癸卯'),
    '待综合判断',
    getTenGod,
  );

  assert.match(sharedMonth.basis || '', /戊七杀与辛正印.*同通月令/);
  assert.match(sharedMonth.basis || '', /杀印有情.*局部结构/);
  assert.equal(
    analyzeKillerPatternStructure(sharedMonthPillars, sharedMonth.pattern, getTenGod)
      .killerResourceShareMonth,
    true,
  );
  assert.match(notSharedMonth.basis || '', /但未闭合杀印同通月令/);
  assert.match(notSharedMonth.basis || '', /杀重身轻另经全局成立.*转而就印/);
});

test('七杀格食印财同透与无食伤印财同透应保留不同取清方向', () => {
  const wealthRemovesResource = determinePattern(
    createPillars('乙丑', '戊子', '丁卯', '庚子'),
    '待综合判断',
    getTenGod,
  );
  const wealthClearsTransformedKiller = determinePattern(
    createPillars('甲子', '丙子', '丁卯', '庚子'),
    '待综合判断',
    getTenGod,
  );

  assert.match(wealthRemovesResource.basis || '', /食伤、印星与财星同时明透/);
  assert.match(wealthRemovesResource.basis || '', /财去印、保存食伤制杀.*救应候选/);
  assert.match(wealthClearsTransformedKiller.basis || '', /无食伤明透/);
  assert.match(wealthClearsTransformedKiller.basis || '', /杀化印若成立时借财清格/);
  assert.match(wealthClearsTransformedKiller.basis || '', /没有固定事实足以闭合“杀化印”/);
});

test('杂气七杀无财透与官杀两类取清均不得直接闭合结果', () => {
  const mixedKiller = determinePattern(
    createPillars('甲子', '丁丑', '乙丑', '辛巳'),
    '待综合判断',
    getTenGod,
    '己',
  );
  const removeOfficer = determinePattern(
    createPillars('癸卯', '丁巳', '庚寅', '庚辰'),
    '待综合判断',
    getTenGod,
  );
  const removeKiller = determinePattern(
    createPillars('丙子', '甲午', '辛亥', '辛卯'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(mixedKiller.pattern, '杂气七杀格');
  assert.match(mixedKiller.basis || '', /干头不透财.*客观条件/);
  assert.match(mixedKiller.basis || '', /不据此判清格或富贵/);
  assert.match(removeOfficer.basis || '', /伤官去官留杀.*取清候选/);
  assert.match(removeOfficer.basis || '', /不宣称已经取清/);
  assert.match(removeKiller.basis || '', /子午相冲.*子中癸食神克杀/);
  assert.match(removeKiller.basis || '', /去杀留官.*取清候选/);
  assert.match(removeKiller.basis || '', /不以一冲直接判定取清完成/);
});

test('七杀无食制用印及杀化印均不得由藏印或六合自动定案', () => {
  const usesResource = determinePattern(
    createPillars('戊辰', '甲寅', '戊寅', '戊午'),
    '待综合判断',
    getTenGod,
  );
  const branchCombination = determinePattern(
    createPillars('甲申', '乙亥', '丙戌', '庚寅'),
    '待综合判断',
    getTenGod,
  );

  assert.match(usesResource.basis || '', /外干无食伤.*寅午均藏丙偏印/);
  assert.match(usesResource.basis || '', /无食制而用印.*组成事实/);
  assert.match(usesResource.basis || '', /印是否用当仍须全局复核/);
  assert.match(branchCombination.basis || '', /寅亥六合不等于已经化木/);
  assert.doesNotMatch(branchCombination.basis || '', /已经化印|已化木成格/);
});

test('论七杀八个原典例型应保存结构事实并禁止高风险强断', () => {
  const examples: Array<{
    pillars: [string, string, string, string];
    marker: RegExp;
  }> = [
    { pillars: ['乙亥', '乙酉', '乙卯', '丁丑'], marker: /原典七杀食制精确例型/ },
    { pillars: ['壬辰', '甲辰', '丙戌', '戊戌'], marker: /原典脱丞相精确例型/ },
    { pillars: ['丙寅', '戊戌', '壬戌', '辛丑'], marker: /原典何参政精确例型/ },
    { pillars: ['戊戌', '甲子', '丁未', '庚戌'], marker: /原典周丞相精确例型/ },
    { pillars: ['甲申', '乙亥', '丙戌', '庚寅'], marker: /原典刘运使精确例型/ },
    { pillars: ['癸卯', '丁巳', '庚寅', '庚辰'], marker: /原典岳统制精确例型/ },
    { pillars: ['丙子', '甲午', '辛亥', '辛卯'], marker: /原典沈郎中精确例型/ },
    { pillars: ['戊辰', '甲寅', '戊寅', '戊午'], marker: /原典赵员外精确例型/ },
  ];

  examples.forEach(({ pillars, marker }) => {
    const result = determinePattern(createPillars(...pillars), '待综合判断', getTenGod);
    assert.match(result.basis || '', marker);
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:贵格|富贵|贫贱)|必贵|大贵已定|官品|格局评分|成功率/,
    );
  });
});

test('月刃官杀制伏应区分明透、藏根与财印相随，不按数量判高低', () => {
  const exposedPillars = createPillars('己酉', '丙子', '壬寅', '丙午');
  const exposed = determinePattern(exposedPillars, '待综合判断', getTenGod);
  const hiddenPillars = createPillars('甲午', '癸酉', '庚寅', '戊寅');
  const hidden = determinePattern(hiddenPillars, '待综合判断', getTenGod);

  assert.equal(exposed.pattern, '月刃格');
  assert.match(exposed.basis || '', /阳刃格成败边界/);
  assert.match(exposed.basis || '', /日主壬为五阳干.*月支子确为其真阳刃位/);
  assert.match(exposed.basis || '', /年干己正官明透.*官杀制刃的组成候选/);
  assert.match(exposed.basis || '', /只证明存在官杀同类藏根.*不按根数或藏干层级判“根深”/);
  assert.match(exposed.basis || '', /官杀制刃候选同时见月干丙偏财、时干丙偏财.*财印相随/);
  assert.match(hidden.basis || '', /外干未见官杀/);
  assert.match(hidden.basis || '', /午藏丁正官.*寅藏丙七杀/);
  assert.match(hidden.basis || '', /只闭合“官杀藏而不露”的客观类别/);
  assert.equal(
    analyzeBladePatternStructure(exposedPillars, exposed.pattern, getTenGod).isBladePattern,
    true,
  );
  assert.doesNotMatch(exposed.basis || '', /判定为(?:大贵|小贵|贵格)|官品已定/);
});

test('阳刃透出应区分用官不虑与用杀五合冲突，并禁止自动认定贪合无成', () => {
  const officerPillars = createPillars('丁酉', '丙午', '丙申', '癸巳');
  const officer = determinePattern(officerPillars, '待综合判断', getTenGod);
  const killerPillars = createPillars('丁酉', '丙午', '丙申', '壬辰');
  const killer = determinePattern(killerPillars, '待综合判断', getTenGod);
  const killerStructure = analyzeBladePatternStructure(killerPillars, killer.pattern, getTenGod);

  assert.match(officer.basis || '', /阳刃用官候选另见年干丁劫财透出/);
  assert.match(officer.basis || '', /“透刃不虑”的局部边界/);
  assert.match(killer.basis || '', /年干丁刃星与时干壬七杀构成天干五合固定关系/);
  assert.match(killer.basis || '', /“贪合忘克”的冲突候选/);
  assert.match(killer.basis || '', /不等于已经合化、七杀必然失去制刃作用或格局无成/);
  assert.equal(killerStructure.bladeKillerCombinationFacts.length, 1);
  assert.doesNotMatch(killer.basis || '', /七杀已经贪合忘克|判定为无成|已合化/);
});

test('官杀制刃带伤食应保留印护、裁损与留杀取清三个条件方向', () => {
  const protectedResult = determinePattern(
    createPillars('甲午', '癸酉', '庚寅', '戊寅'),
    '待综合判断',
    getTenGod,
  );
  const reduced = determinePattern(
    createPillars('甲寅', '庚午', '戊申', '甲寅'),
    '待综合判断',
    getTenGod,
  );
  const clearedPillars = createPillars('丙戌', '丁酉', '庚申', '壬午');
  const cleared = determinePattern(clearedPillars, '待综合判断', getTenGod);

  assert.match(protectedResult.basis || '', /戊偏印与癸伤官五合/);
  assert.match(protectedResult.basis || '', /印护固定组件/);
  assert.match(protectedResult.basis || '', /不认定五合已经成化、官星已获保护/);
  assert.match(reduced.basis || '', /庚食神明透.*食神制杀的裁损组件/);
  assert.match(reduced.basis || '', /杀太重、根太重与制杀适度均须全局复核/);
  assert.match(cleared.basis || '', /丙七杀、丁正官、壬食神并透/);
  assert.match(cleared.basis || '', /壬与丁五合/);
  assert.match(cleared.basis || '', /阳刃格利留杀的取清组件候选/);
  assert.match(cleared.basis || '', /不等于官星已去、七杀已留或清格完成/);
  assert.ok(
    analyzeBladePatternStructure(clearedPillars, cleared.pattern, getTenGod).clearingComponents
      .length > 0,
  );
});

test('官杀并透没有实际制合组件时应保持混杂，不因月刃喜杀自动取清', () => {
  const result = determinePattern(
    createPillars('壬子', '丙午', '丙申', '癸巳'),
    '待综合判断',
    getTenGod,
  );

  assert.equal(result.pattern, '月刃格');
  assert.match(result.basis || '', /时干癸正官与年干壬七杀并透/);
  assert.match(result.basis || '', /未见伤官制官或食伤五合正官的实际取清组件/);
  assert.match(result.basis || '', /保持官杀混杂/);
  assert.match(result.basis || '', /不因月刃喜杀直接宣称已经留杀取清/);
});

test('戊午透丙会火只列化刃为印候选，财杀并露不得套作生杀制刃', () => {
  const transformedPillars = createPillars('丙戌', '甲午', '戊申', '甲寅');
  const transformed = determinePattern(transformedPillars, '待综合判断', getTenGod);
  const conflictedPillars = createPillars('丙寅', '甲午', '戊申', '壬戌');
  const conflicted = determinePattern(conflictedPillars, '待综合判断', getTenGod);
  const conflictedStructure = analyzeBladePatternStructure(
    conflictedPillars,
    conflicted.pattern,
    getTenGod,
  );

  assert.match(transformed.basis || '', /戊日生午月.*透丙偏印/);
  assert.match(transformed.basis || '', /寅午戌三合火固定结构.*“化刃为印”的固定结构候选/);
  assert.match(transformed.basis || '', /不等于已经合化或刃已转印/);
  assert.match(transformed.basis || '', /“去刃存印”的进一步复核方向/);
  assert.match(conflicted.basis || '', /财杀并露/);
  assert.match(conflicted.basis || '', /财坏印、财生杀与杀制刃之间的冲突/);
  assert.match(conflicted.basis || '', /不得直接套作“生杀制刃”或输出富贵两空结论/);
  assert.equal(conflictedStructure.hasWuFireTransformationCandidate, true);
  assert.doesNotMatch(conflicted.basis || '', /已经化刃为印|判定为富贵两空/);
});

test('阳刃用财应区分伤食转关与刃财相搏，财根深仍须全局复核', () => {
  const redirected = determinePattern(
    createPillars('辛酉', '甲午', '戊寅', '壬戌'),
    '待综合判断',
    getTenGod,
  );
  const conflicted = determinePattern(
    createPillars('辛酉', '甲午', '丙申', '壬辰'),
    '待综合判断',
    getTenGod,
  );

  assert.match(redirected.basis || '', /财星取用事实/);
  assert.match(redirected.basis || '', /四支未见财星藏干.*“财根深”前提尚未闭合/);
  assert.match(redirected.basis || '', /伤食来源.*“转刃生财”的组成候选/);
  assert.match(redirected.basis || '', /不据此直接认定财根深、已经转生、取贵或就富/);
  assert.match(conflicted.basis || '', /只证明存在财根.*不按支数或藏干层级判“财根深”/);
  assert.match(conflicted.basis || '', /未见伤食明透或完整会局作为转关组件/);
  assert.match(conflicted.basis || '', /保存刃财相搏的局部冲突/);
  assert.match(conflicted.basis || '', /不据单项直接宣称不成局/);
});

test('论阳刃五个原典例型应保存精确结构并禁止高风险强断', () => {
  const examples: Array<{
    pillars: [string, string, string, string];
    marker: RegExp;
  }> = [
    { pillars: ['己酉', '丙子', '壬寅', '丙午'], marker: /原典阳刃用官精确例型/ },
    { pillars: ['辛酉', '甲午', '丙申', '壬辰'], marker: /原典阳刃露杀精确例型/ },
    { pillars: ['甲午', '癸酉', '庚寅', '戊寅'], marker: /原典穆同知精确例型/ },
    { pillars: ['甲寅', '庚午', '戊申', '甲寅'], marker: /原典贾平章精确例型/ },
    { pillars: ['丙戌', '丁酉', '庚申', '壬午'], marker: /原典阳刃官杀取清精确例型/ },
  ];

  examples.forEach(({ pillars, marker }) => {
    const result = determinePattern(createPillars(...pillars), '待综合判断', getTenGod);
    assert.equal(result.pattern, '月刃格');
    assert.match(result.basis || '', marker);
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:成格|破格|富贵|贫贱|贵格)|必贵|大贵已定|官品已定|格局评分|成功率/,
    );
  });
});

test('建禄结构分析应区分完整会支、半合拱局、外干隔位与固定五合', () => {
  const separatedPillars = createPillars('庚午', '戊子', '癸卯', '丁巳');
  const separated = analyzeLuPatternStructure(separatedPillars, '建禄格', getTenGod);
  const arched = analyzeLuPatternStructure(
    createPillars('己未', '己巳', '丁未', '辛丑'),
    '建禄格',
    getTenGod,
  );
  const halfCombined = analyzeLuPatternStructure(
    createPillars('庚子', '甲申', '庚子', '甲申'),
    '建禄格',
    getTenGod,
  );
  const hurtCombined = analyzeLuPatternStructure(
    createPillars('己酉', '乙亥', '壬戌', '庚子'),
    '建禄格',
    getTenGod,
  );

  assert.equal(separated.isLuPattern, true);
  assert.equal(separated.officerSeparationFacts.length, 1);
  assert.equal(arched.monthWealthTransformationFacts[0]?.type, '拱局');
  assert.deepEqual(arched.monthWealthTransformationFacts[0]?.branches, ['巳', '丑']);
  assert.equal(halfCombined.monthOutputTransformationFacts[0]?.type, '半合');
  assert.deepEqual(halfCombined.monthOutputTransformationFacts[0]?.branches, ['申', '子']);
  assert.equal(hurtCombined.resourceHurtCombinationFacts.length, 1);
});

test('建禄用官应区分印护、财助、官隔财印、孤官及官伤救应', () => {
  const protectedOfficer = determinePattern(
    createPillars('庚戌', '戊子', '癸酉', '癸亥'),
    '待综合判断',
    getTenGod,
  );
  const financedOfficer = determinePattern(
    createPillars('丁酉', '丙午', '丁巳', '壬寅'),
    '待综合判断',
    getTenGod,
  );
  const separatedOfficer = determinePattern(
    createPillars('庚午', '戊子', '癸卯', '丁巳'),
    '待综合判断',
    getTenGod,
  );
  const loneOfficer = determinePattern(
    createPillars('壬子', '戊子', '癸卯', '癸亥'),
    '待综合判断',
    getTenGod,
  );
  const combinedHurt = determinePattern(
    createPillars('己酉', '乙亥', '壬戌', '庚子'),
    '待综合判断',
    getTenGod,
  );

  assert.match(protectedOfficer.basis || '', /庚正印明透.*印护官.*财印相随/);
  assert.match(financedOfficer.basis || '', /酉藏辛偏财.*财助官.*财印相随/);
  assert.match(separatedOfficer.basis || '', /官隔财印.*外干位置事实/);
  assert.match(loneOfficer.basis || '', /孤官无辅.*不据当前缺项直接判定破格或贫贱/);
  assert.match(combinedHurt.basis || '', /官伤冲突/);
  assert.match(combinedHurt.basis || '', /乙伤官与时干庚偏印五合.*合伤存官/);
  assert.match(combinedHurt.basis || '', /不据五合直接认定伤官已去、官星已存或全局破格/);
});

test('建禄用财应区分食伤转关、转关缺项、化劫为财与化劫为生', () => {
  const redirected = determinePattern(
    createPillars('甲子', '丙子', '癸丑', '壬子'),
    '待综合判断',
    getTenGod,
  );
  const missingOutput = determinePattern(
    createPillars('丁酉', '壬子', '癸丑', '癸亥'),
    '待综合判断',
    getTenGod,
  );
  const transformedWealth = determinePattern(
    createPillars('己未', '己巳', '丁未', '辛丑'),
    '待综合判断',
    getTenGod,
  );
  const transformedOutput = determinePattern(
    createPillars('庚子', '甲申', '庚子', '甲申'),
    '待综合判断',
    getTenGod,
  );

  assert.match(redirected.basis || '', /食伤转劫生财的组成候选/);
  assert.match(missingOutput.basis || '', /用财无食伤.*转关缺项/);
  assert.match(transformedWealth.basis || '', /巳丑拱局金固定关系.*化劫为财/);
  assert.match(transformedWealth.basis || '', /不等于已经合化/);
  assert.match(transformedOutput.basis || '', /申子半合水固定关系.*化劫为生/);
  assert.match(transformedOutput.basis || '', /不等于已经合化、食伤有力或最终取用完成/);
});

test('建禄用杀应保留制伏、财党杀、合杀存财及无制伏边界', () => {
  const controlled = determinePattern(
    createPillars('丁巳', '壬子', '癸卯', '己未'),
    '待综合判断',
    getTenGod,
  );
  const preservedWealth = determinePattern(
    createPillars('戊辰', '癸亥', '壬午', '丙午'),
    '待综合判断',
    getTenGod,
  );
  const uncontrolled = determinePattern(
    createPillars('丁酉', '壬子', '癸丑', '己未'),
    '待综合判断',
    getTenGod,
  );

  assert.match(controlled.basis || '', /卯未半合木固定关系.*食伤制伏七杀/);
  assert.match(controlled.basis || '', /制杀力度、杀食轻重与制伏是否适度仍须全局复核/);
  assert.match(preservedWealth.basis || '', /财党杀.*冲突候选/);
  assert.match(preservedWealth.basis || '', /戊七杀与月干癸劫财五合.*合杀存财/);
  assert.match(uncontrolled.basis || '', /用杀无制伏.*不据当前缺项直接判定七杀重、身危/);
  assert.match(preservedWealth.basis || '', /五合不等于七杀已去、财星已存或格局已经取清/);
});

test('建禄无财官用伤食应保留春木秋金类别，不把气候类别当成格局结论', () => {
  const springWood = determinePattern(
    createPillars('甲子', '丙寅', '甲子', '丙寅'),
    '待综合判断',
    getTenGod,
  );
  const autumnMetal = determinePattern(
    createPillars('癸卯', '庚申', '庚子', '庚辰'),
    '待综合判断',
    getTenGod,
  );

  assert.match(springWood.basis || '', /无财官而用伤食.*春木用食神气候类别/);
  assert.match(autumnMetal.basis || '', /无财官而用伤食.*秋金用伤官气候类别/);
  assert.match(autumnMetal.basis || '', /气候类别不等于食伤有力、调候完成或贵格成立/);
});

test('建禄官杀竞出及两官竞出应只列固定取清和制伏候选', () => {
  const combinedKiller = determinePattern(
    createPillars('辛丑', '庚寅', '甲辰', '乙亥'),
    '待综合判断',
    getTenGod,
  );
  const controlledKiller = determinePattern(
    createPillars('辛亥', '庚寅', '甲申', '丙寅'),
    '待综合判断',
    getTenGod,
  );
  const uncleared = determinePattern(
    createPillars('辛丑', '庚寅', '甲辰', '甲子'),
    '待综合判断',
    getTenGod,
  );
  const twoOfficers = determinePattern(
    createPillars('戊辰', '戊子', '癸酉', '甲寅'),
    '待综合判断',
    getTenGod,
  );
  const twoUncontrolledOfficers = determinePattern(
    createPillars('戊辰', '戊子', '癸酉', '癸亥'),
    '待综合判断',
    getTenGod,
  );

  assert.match(combinedKiller.basis || '', /五合七杀，候选合杀留官/);
  assert.match(controlledKiller.basis || '', /食伤明透，候选制杀留官/);
  assert.match(uncleared.basis || '', /官杀混杂待复核/);
  assert.match(twoOfficers.basis || '', /两处以上正官竞出.*伤官制伏竞官/);
  assert.match(twoUncontrolledOfficers.basis || '', /两官竞出无伤制伏/);
  assert.match(twoUncontrolledOfficers.basis || '', /不据数量直接称官杀重、日主弱、身危/);
  assert.match(combinedKiller.basis || '', /制合事实不等于已经取清/);
  assert.match(controlledKiller.basis || '', /制伏是否适度仍须全局复核/);
  assert.match(twoOfficers.basis || '', /不据官星数量或单一伤官直接判定官重/);
});

test('论建禄月劫十三个原典例型应唯一保存精确结构并禁止高风险强断', () => {
  const examples: Array<{
    pillars: [string, string, string, string];
    marker: RegExp;
  }> = [
    { pillars: ['庚戌', '戊子', '癸酉', '癸亥'], marker: /原典建禄用官印护精确例型/ },
    { pillars: ['丁酉', '丙午', '丁巳', '壬寅'], marker: /原典建禄用官财助精确例型/ },
    { pillars: ['庚午', '戊子', '癸卯', '丁巳'], marker: /原典建禄官隔财印精确例型/ },
    { pillars: ['甲子', '丙子', '癸丑', '壬子'], marker: /原典建禄用财带伤食精确例型/ },
    { pillars: ['己未', '己巳', '丁未', '辛丑'], marker: /原典建禄化劫为财精确例型/ },
    { pillars: ['庚子', '甲申', '庚子', '甲申'], marker: /原典建禄化劫为生精确例型/ },
    { pillars: ['丁巳', '壬子', '癸卯', '己未'], marker: /原典建禄用杀制伏精确例型/ },
    { pillars: ['戊辰', '癸亥', '壬午', '丙午'], marker: /原典建禄合杀存财精确例型/ },
    { pillars: ['甲子', '丙寅', '甲子', '丙寅'], marker: /原典春木建禄用食神精确例型/ },
    { pillars: ['癸卯', '庚申', '庚子', '庚辰'], marker: /原典秋金建禄用伤官精确例型/ },
    { pillars: ['辛丑', '庚寅', '甲辰', '乙亥'], marker: /原典建禄合杀留官精确例型/ },
    { pillars: ['辛亥', '庚寅', '甲申', '丙寅'], marker: /原典建禄制杀留官精确例型/ },
    { pillars: ['己酉', '乙亥', '壬戌', '庚子'], marker: /原典建禄合伤存官精确例型/ },
  ];

  examples.forEach(({ pillars, marker }) => {
    const result = determinePattern(createPillars(...pillars), '待综合判断', getTenGod);
    const exactMarkers = result.basis?.match(/原典[^；]+精确例型/g) ?? [];
    assert.equal(result.pattern, pillars[1] === '己巳' ? '劫财格' : '建禄格');
    assert.match(result.basis || '', marker);
    assert.equal(exactMarkers.length, 1, `${pillars.join('、')}只应命中一个原典例型`);
    assert.doesNotMatch(
      result.basis || '',
      /判定为(?:成格|破格|富贵|贫贱|贵格)|必贵|大贵已定|官品已定|格局评分|成功率/,
    );
  });
});
