import test from 'node:test';
import assert from 'node:assert/strict';

import type { BaziChartResult } from '@core/bazi/baziTypes';
import { evaluateShaYaoCorroboration } from '@core/synthesis/corroboration';
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
