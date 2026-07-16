import test from 'node:test';
import assert from 'node:assert/strict';
import { generateXuanKong, flyStars, resolveXuanKongPeriod } from '../packages/core/src/xuan_kong/index.ts';

test('三元九运：2024 应落入下元九运区间附近可复现运表', () => {
  const period = resolveXuanKongPeriod(2024);
  assert.equal(period.yunStar, period.yun);
  assert.ok(period.startYear <= 2024 && period.endYear >= 2024);
  assert.match(period.label, /运/);
});

test('飞星入中：阳顺阴逆，中宫为入中星', () => {
  const yang = flyStars(1);
  assert.equal(yang[4], 1);
  const yin = flyStars(2);
  assert.equal(yin[4], 2);
});

test('玄空飞星可按坐山生成三盘与证据', () => {
  const result = generateXuanKong({ year: 2024, sitMountain: '子' });
  assert.equal(result.sitMountain, '子');
  assert.equal(result.facingMountain, '午');
  assert.equal(result.plates.yun.length, 9);
  assert.equal(result.plates.shan.length, 9);
  assert.equal(result.plates.xiang.length, 9);
  assert.equal(result.palaces.length, 9);
  assert.ok(result.prompt.includes('玄空飞星'));
  assert.equal(result.evidenceAnalysis.key, 'xuankong:evidence');
  assert.match(result.evidenceAnalysis.promptText, /定运|山向|飞布|限制/);
});

test('兼向过界应启用替卦，中心山向保持下卦', () => {
  // 子山中心约 0°，边界在 7.5°；取 7° 接近边界
  const ti = generateXuanKong({ year: 2024, sitDegree: 7 });
  assert.equal(ti.guaType, '替卦');
  assert.equal(ti.replacementApplied, true);

  const xia = generateXuanKong({ year: 2024, sitDegree: 0, guaType: '下卦' });
  assert.equal(xia.guaType, '下卦');
  assert.equal(xia.replacementApplied, false);
});

test('测量误差跨边界时标记山向边界敏感', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 7.2,
    measurementUncertaintyDegrees: 2,
  });
  assert.ok(result.measurement);
  assert.equal(result.measurement?.stability, '山向边界敏感');
});

test('玄空边界敏感时应输出候选山向', () => {
  const result = generateXuanKong({
    year: 2024,
    sitDegree: 7.5,
    measurementUncertaintyDegrees: 1,
  });
  assert.equal(result.measurement?.stability, '山向边界敏感');
  assert.ok((result.measurement?.candidateMountains?.length ?? 0) >= 1);
  assert.match(result.prompt, /候选/);
});

