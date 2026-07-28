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

test('交节初段的上一月余气司权即使不在本月藏干中，也应按实际司令十神取格', () => {
  const pillars = createPatternPillars('癸', '卯', '甲');
  const result = determinePattern(pillars, '身强', getTenGod, '甲');

  assert.equal(result.pattern, '伤官格');
  assert.match(result.basis || '', /司权为甲/);
});

test('杂气多透时本气优先于透干柱位，不应只按透干柱位优先定格', () => {
  const pillars: Pillars = {
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  };

  const result = determinePattern(pillars, '身强', getTenGod, '戊');

  assert.equal(result.isSpecial, false);
  assert.equal(result.pattern, '杂气正官格');
  assert.match(result.basis || '', /透干/);
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
  assert.match(result.basis || '', /副气未至破格/);
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
  assert.match(result.basis || '', /同党余气未至破格/);
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
