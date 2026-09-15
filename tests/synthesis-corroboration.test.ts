import test from 'node:test';
import assert from 'node:assert/strict';

import type { BaziChartResult } from '@core/bazi/baziTypes';
import { baziCalculator } from '@core/bazi/baziCalculator';
import {
  evaluateGuiRenCorroboration,
  evaluateShaYaoCorroboration,
} from '@core/synthesis/corroboration';
import type { ZiweiRuntime } from '@core/ziwei/runtime';

function buildBazi(status: string, hasYangRen = true): BaziChartResult {
  return {
    dayMaster: { gan: '甲' },
    pillars: {
      year: { gan: '丙', zhi: '子' },
      month: { gan: '戊', zhi: '午' },
      day: { gan: '甲', zhi: hasYangRen ? '卯' : '辰' },
      hour: { gan: '庚', zhi: '巳' },
    },
    shensha: {
      year: [],
      month: [],
      day: hasYangRen ? ['羊刃'] : [],
      hour: [],
    },
    analysis: {
      dayMasterStrength: { status },
    },
  } as unknown as BaziChartResult;
}

function buildZiwei(hasShaStar = true): ZiweiRuntime {
  return {
    payloadByScope: {
      origin: {
        palaces: [
          {
            name: '命宫',
            is_body_palace: false,
            major_stars: [],
            minor_stars: hasShaStar ? [{ name: '擎羊' }] : [],
          },
        ],
      },
    },
  } as unknown as ZiweiRuntime;
}

function buildGuiZiwei(options: { brightness?: string; palaceName?: string } = {}): ZiweiRuntime {
  return {
    payloadByScope: {
      origin: {
        palaces: [
          {
            name: options.palaceName ?? '命宫',
            index: 0,
            is_body_palace: false,
            major_stars: [
              {
                name: '天魁',
                kind: '辅星',
                ...(options.brightness ? { brightness: options.brightness } : {}),
              },
            ],
            minor_stars: [],
          },
        ],
      },
    },
  } as unknown as ZiweiRuntime;
}

function buildGuiBazi(): BaziChartResult {
  return {
    dayMaster: { gan: '甲' },
    pillars: {
      year: { gan: '丙', zhi: '丑' },
      month: { gan: '戊', zhi: '午' },
      day: { gan: '甲', zhi: '辰' },
      hour: { gan: '庚', zhi: '巳' },
    },
    shensha: {
      year: ['天乙贵人'],
      month: [],
      day: [],
      hour: [],
    },
    analysis: {
      dayMasterStrength: { status: '中和' },
    },
  } as unknown as BaziChartResult;
}

test('合参煞曜应按结构化强弱状态触发强分支', () => {
  for (const status of ['极强', '身强', '偏强']) {
    const result = evaluateShaYaoCorroboration(buildBazi(status), buildZiwei());

    assert.equal(result.isHarmonized, true, status);
    assert.match(result.judgment, /权柄相济/);
    assert.doesNotMatch(result.judgment, /煞为我用/);
  }
});

test('合参煞曜的弱、中和与缺盘状态不得误触发强分支', () => {
  for (const status of ['极弱', '身弱', '偏弱', '中和', '未知']) {
    const result = evaluateShaYaoCorroboration(buildBazi(status), buildZiwei());
    assert.equal(result.isHarmonized, false, status);
  }

  const missingOrigin = evaluateShaYaoCorroboration(buildBazi('身强'), {
    payloadByScope: { origin: undefined },
  } as unknown as ZiweiRuntime);
  assert.equal(missingOrigin.isHarmonized, false);
  assert.equal(missingOrigin.ziweiCheckStatus, 'origin-missing');
});

test('贵人合参保留八字柱位、紫微宫位与星曜状态，不把共现写成终身断语', () => {
  const result = evaluateGuiRenCorroboration(buildGuiBazi(), buildGuiZiwei({ brightness: '旺' }));

  assert.equal(result.isDoubleBlessed, true);
  assert.deepEqual(result.baziTianYiPositions, [
    { rule: '天乙贵人', pillar: 'year', pillarName: '年柱', branch: '丑' },
  ]);
  assert.deepEqual(result.ziweiGuiEvidence[0], {
    name: '天魁',
    palaceIndex: 0,
    palaceName: '命宫',
    palaceRole: '命宫',
    kind: '辅星',
    state: { brightness: '旺' },
  });
  assert.match(result.judgment, /年柱丑/);
  assert.match(result.judgment, /天魁入命宫（旺）/);
  assert.match(result.judgment, /结构线索/);
  assert.doesNotMatch(result.judgment, /生平逢凶化吉/);
  assert.equal(
    result.effectConditions.find((item) => item.key === 'ziwei.gui-star-state')?.status,
    '满足',
  );
  assert.equal(
    result.effectConditions.find((item) => item.key === 'timing.period')?.status,
    '资料不足',
  );
});

test('默认无庙旺表的贵人星按位置取证，运限缺口独立保留', () => {
  const result = evaluateGuiRenCorroboration(buildGuiBazi(), buildGuiZiwei());

  assert.equal(result.isDoubleBlessed, true);
  assert.equal(
    result.effectConditions.find((item) => item.key === 'ziwei.gui-star-state')?.status,
    '满足',
  );
  assert.match(
    result.effectConditions.find((item) => item.key === 'timing.period')!.detail,
    /不能外推终身/,
  );
  assert.doesNotMatch(result.judgment, /生平逢凶化吉/);
  assert.equal(
    evaluateShaYaoCorroboration(buildBazi('身强'), buildZiwei()).effectConditions.find(
      (item) => item.key === 'ziwei.sha-star-state',
    )?.status,
    '资料不足',
  );
});

test('合参天乙贵人应保留公共神煞的年干命中柱位', () => {
  const bazi = baziCalculator.calculateBazi({
    year: 2006,
    month: 9,
    day: 21,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
  });
  assert.ok(bazi.shensha.month.includes('天乙贵人'));

  const result = evaluateGuiRenCorroboration(bazi, buildZiwei(false));
  assert.deepEqual(result.baziTianYiPositions, [
    { rule: '天乙贵人', pillar: 'month', pillarName: '月柱', branch: '酉' },
  ]);
  assert.equal(result.hasBaziTianYi, true);
  assert.doesNotMatch(result.judgment, /八字四柱未记录天乙/);
});

test('合参缺少八字神煞资料时应保留无法核验状态', () => {
  const bazi = buildBazi('身强');
  delete (bazi as { shensha?: unknown }).shensha;
  const sha = evaluateShaYaoCorroboration(bazi, buildZiwei());
  const gui = evaluateGuiRenCorroboration(bazi, buildGuiZiwei());
  assert.equal(
    sha.effectConditions.find((item) => item.key === 'bazi.yang-ren-position')?.status,
    '资料不足',
  );
  assert.match(
    sha.effectConditions.find((item) => item.key === 'bazi.yang-ren-position')!.detail,
    /资料未提供.*无法.*羊刃/,
  );
  assert.equal(
    gui.effectConditions.find((item) => item.key === 'bazi.tianyi-position')?.status,
    '资料不足',
  );
  assert.match(gui.judgment, /资料未提供.*无法核验天乙/);
});

test('合参区分亮度已列与落陷制约，运限按宫位及四化星曜双重定位', () => {
  const ziwei = buildGuiZiwei({ brightness: '陷' });
  ziwei.payloadByScope.yearly = {
    ...ziwei.payloadByScope.origin,
    active_scope: {
      scope: 'yearly',
      label: '流年',
      solar_date: '2026-09-14',
      lunar_date: '',
      nominal_age: 37,
      palace_index: 0,
      palace_name: '命宫',
      mutagen_map: [],
    },
  };
  const constrained = evaluateGuiRenCorroboration(buildGuiBazi(), ziwei);
  assert.equal(
    constrained.effectConditions.find((item) => item.key === 'ziwei.gui-star-state')?.status,
    '不满足',
  );
  assert.match(
    constrained.effectConditions.find((item) => item.key === 'ziwei.gui-star-state')!.detail,
    /落陷/,
  );
  const timing = constrained.effectConditions.find((item) => item.key === 'timing.period')!;
  assert.equal(timing.status, '满足');
  assert.match(timing.detail, /2026-09-14.*天魁同宫/);
  ziwei.payloadByScope.yearly.active_scope.palace_index = 1;
  assert.equal(
    evaluateGuiRenCorroboration(buildGuiBazi(), ziwei).effectConditions.find(
      (item) => item.key === 'timing.period',
    )?.status,
    '不满足',
  );
  ziwei.payloadByScope.yearly.active_scope.palace_index = undefined;
  assert.equal(
    evaluateGuiRenCorroboration(buildGuiBazi(), ziwei).effectConditions.find(
      (item) => item.key === 'timing.period',
    )?.status,
    '不满足',
  );
  ziwei.payloadByScope.origin.palaces[0].major_stars[0].name = '左辅';
  ziwei.payloadByScope.yearly.active_scope.mutagen_map = [
    { mutagen: '科', star: '左辅', palace_index: 0, palace_name: '命宫' },
  ];
  const transformed = evaluateGuiRenCorroboration(buildGuiBazi(), ziwei).effectConditions.find(
    (item) => item.key === 'timing.period',
  )!;
  assert.equal(transformed.status, '满足');
  assert.match(transformed.detail, /左辅化科入命宫/);
  ziwei.payloadByScope.yearly.active_scope.mutagen_map[0].palace_index = 1;
  assert.equal(
    evaluateGuiRenCorroboration(buildGuiBazi(), ziwei).effectConditions.find(
      (item) => item.key === 'timing.period',
    )?.status,
    '不满足',
  );
});
