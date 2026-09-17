import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeConstraint,
  analyzeDayMasterStrength,
  analyzeFormation,
  analyzeRoot,
  analyzeSeasonalStatus,
  analyzeSupport,
} from '@core/bazi/baziStrengthAnalyzer';
import { HIDDEN_STEMS } from '@core/bazi/baziDefinitions';
import { getSeasonStatus, getWuxing } from '@core/bazi/baziUtils';
import type { HiddenStems, Pillars, Wuxing } from '@core/bazi/baziTypes';

const strictGetWuxing = getWuxing as (value: string) => Wuxing;

function runStrength(
  dayMaster: string,
  pillars: Pillars,
  hiddenStems: HiddenStems,
  monthCommander?: string,
) {
  const seasonalStatus = analyzeSeasonalStatus(
    dayMaster,
    pillars.month.zhi,
    getSeasonStatus,
    strictGetWuxing,
    monthCommander,
  );
  const formationAnalysis = analyzeFormation(dayMaster, pillars, strictGetWuxing);
  const rootAnalysis = analyzeRoot(dayMaster, pillars, hiddenStems, strictGetWuxing);
  const supportAnalysis = analyzeSupport(dayMaster, pillars, hiddenStems, strictGetWuxing);
  const constraintAnalysis = analyzeConstraint(dayMaster, pillars, hiddenStems, strictGetWuxing);

  return {
    seasonalStatus,
    formationAnalysis,
    rootAnalysis,
    supportAnalysis,
    constraintAnalysis,
    strength: analyzeDayMasterStrength(
      seasonalStatus,
      formationAnalysis,
      rootAnalysis,
      supportAnalysis,
      constraintAnalysis,
    ),
  };
}

test('夏月水失令时，浅根与帮身须结合全局克泄耗判定', () => {
  const pillars: Pillars = {
    year: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    month: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    day: { gan: '癸', zhi: '丑', ganZhi: '癸丑' },
    hour: { gan: '癸', zhi: '丑', ganZhi: '癸丑' },
  };
  const hiddenStems: HiddenStems = {
    year: HIDDEN_STEMS.午,
    month: HIDDEN_STEMS.午,
    day: HIDDEN_STEMS.丑,
    hour: HIDDEN_STEMS.丑,
  };

  const result = runStrength('癸', pillars, hiddenStems, '己');

  assert.equal(result.seasonalStatus.status, '囚');
  assert.equal(result.seasonalStatus.commanderEffect, '克身');
  assert.deepEqual(result.rootAnalysis.roots, [
    {
      position: 'day',
      branch: '丑(癸)',
      stable: true,
      actionable: true,
      clashStatus: '未受冲',
      strength: 1,
    },
    {
      position: 'hour',
      branch: '丑(癸)',
      stable: true,
      actionable: true,
      clashStatus: '未受冲',
      strength: 1,
    },
  ]);
  assert.equal(result.rootAnalysis.strongRoot, false);
  assert.deepEqual(
    result.supportAnalysis.supporters.map((item) => item.stem),
    ['庚', '丑(辛)', '癸', '丑(辛)'],
  );
  assert.equal(result.strength.status, '身弱');
  assert.equal(result.strength.details.hasRoot, true);
  assert.equal(result.strength.details.hasStrongRoot, false);
  assert.equal(result.strength.details.hasSupport, true);
  assert.equal(result.strength.details.hasConstraint, true);
});

test('未月木失令时区分未受冲浅根与被冲根气', () => {
  const pillars: Pillars = {
    year: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
    month: { gan: '己', zhi: '未', ganZhi: '己未' },
    day: { gan: '乙', zhi: '未', ganZhi: '乙未' },
    hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
  };
  const hiddenStems: HiddenStems = {
    year: HIDDEN_STEMS.戌,
    month: HIDDEN_STEMS.未,
    day: HIDDEN_STEMS.未,
    hour: HIDDEN_STEMS.辰,
  };

  const result = runStrength('乙', pillars, hiddenStems, '丁');

  assert.equal(result.seasonalStatus.status, '囚');
  assert.equal(result.seasonalStatus.commanderEffect, '泄身');
  assert.equal(result.rootAnalysis.hasRoot, true);
  assert.equal(result.rootAnalysis.strongRoot, false);
  assert.equal(result.rootAnalysis.roots.find((root) => root.position === 'month')?.stable, true);
  assert.equal(result.rootAnalysis.roots.find((root) => root.position === 'hour')?.stable, false);
  assert.equal(result.strength.status, '身弱');
});

test('无稳定同类根的透干印比只保留盘面事实，不直接形成有效帮扶', () => {
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '庚', zhi: '午', ganZhi: '庚午' },
    day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    hour: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
  };
  const hiddenStems: HiddenStems = {
    year: HIDDEN_STEMS.寅,
    month: HIDDEN_STEMS.午,
    day: HIDDEN_STEMS.寅,
    hour: HIDDEN_STEMS.戌,
  };

  const support = analyzeSupport('甲', pillars, hiddenStems, strictGetWuxing);

  assert.deepEqual(support, {
    supporters: [{ position: 'hour', stem: '壬', stable: false, actionable: false, strength: 1 }],
    totalStrength: 1,
    hasSupport: true,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(support)), support);
});

test('失令无根但有浮印时保留帮扶事实，不直接判为极弱', () => {
  const pillars: Pillars = {
    year: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    day: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  };
  const hiddenStems: HiddenStems = {
    year: HIDDEN_STEMS.午,
    month: HIDDEN_STEMS.酉,
    day: HIDDEN_STEMS.戌,
    hour: HIDDEN_STEMS.午,
  };

  const result = runStrength('甲', pillars, hiddenStems, '庚');

  assert.equal(result.rootAnalysis.hasRoot, false);
  assert.deepEqual(result.supportAnalysis.supporters, [
    { position: 'hour', stem: '壬', stable: false, actionable: false, strength: 1 },
  ]);
  assert.equal(result.strength.status, '身弱');
});

test('一条扶身成局不能短路多条有效克泄耗证据', () => {
  const result = analyzeDayMasterStrength(
    { status: '休', score: 0, isTimely: false },
    {
      formations: [
        {
          type: '三合',
          branches: ['亥', '卯', '未'],
          wuxing: '木',
          effect: '助身',
          strength: 2,
        },
      ],
      totalStrength: 2,
    },
    {
      roots: [{ position: 'month', branch: '未(乙)', stable: true, strength: 1 }],
      totalStrength: 1,
      hasRoot: true,
      strongRoot: false,
    },
    { supporters: [], totalStrength: 0, hasSupport: false },
    {
      constraints: [
        { position: 'year', stem: '庚', strength: 1 },
        { position: 'month', stem: '庚', strength: 1 },
        { position: 'hour', stem: '庚', strength: 1 },
      ],
      totalStrength: 3,
      hasConstraint: true,
    },
  );

  assert.equal(result.status, '偏弱');
  assert.match(
    result.details.ruleBasis[0] ?? '',
    /成局、明根明透及中余气合看为制身（明干本气优先，藏气次级）/,
  );
});

test('只有弱根与一条帮扶时，得令也不能直接抬成身强', () => {
  const result = analyzeDayMasterStrength(
    { status: '旺', score: 4, isTimely: true },
    { formations: [], totalStrength: 0 },
    {
      roots: [{ position: 'month', branch: '未(乙)', stable: true, strength: 1 }],
      totalStrength: 1,
      hasRoot: true,
      strongRoot: false,
    },
    {
      supporters: [{ position: 'hour', stem: '壬', strength: 1 }],
      totalStrength: 1,
      hasSupport: true,
    },
    { constraints: [], totalStrength: 0, hasConstraint: false },
  );

  assert.equal(result.status, '偏强');
});
