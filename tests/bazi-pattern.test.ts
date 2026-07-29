import test from 'node:test';
import assert from 'node:assert/strict';

import { determinePattern } from '@core/bazi/baziPatternStrategy';
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
