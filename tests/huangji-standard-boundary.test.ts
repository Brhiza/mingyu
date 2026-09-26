import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHuangjiJingshi,
  calculateStandardHuangjiForecast,
  serialYearToCivil,
} from '@core/huangji-jingshi';

test('皇极底层值年算法拒绝纪元差值已经失去整数精度的年份', () => {
  for (const year of [Number.MAX_SAFE_INTEGER - 60_000, Number.MAX_SAFE_INTEGER - 50_000]) {
    assert.throws(() => calculateStandardHuangjiForecast(year), /安全整数/);
  }
});

test('皇极连续年号转公元纪年不能产生超出安全整数的公元前年份', () => {
  assert.throws(() => serialYearToCivil(Number.MIN_SAFE_INTEGER), /安全整数/);
  assert.equal(serialYearToCivil(Number.MIN_SAFE_INTEGER + 1), Number.MIN_SAFE_INTEGER);
  assert.equal(serialYearToCivil(0), -1);
  assert.equal(serialYearToCivil(1), 1);
});

test('通行排法跨元界后盘面本元起点与已过年数应随周期更新', () => {
  const last = calculateHuangjiJingshi({ year: 62583 });
  const first = calculateHuangjiJingshi({ year: 62584 });
  const second = calculateHuangjiJingshi({ year: 62585 });

  assert.equal(last.position.yuan.indexFromEpoch, 1);
  assert.equal(last.position.yuan.endYear, 62583);
  assert.match(last.calculationChain[0], /距本元起点已过129599年/);
  assert.equal(first.input.elapsedYears, 129600);
  assert.equal(first.position.yuan.indexFromEpoch, 2);
  assert.equal(first.position.yuan.startYear, 62584);
  assert.equal(first.position.year.indexInYuan, 1);
  assert.match(first.calculationChain[0], /距本元起点已过0年/);
  assert.match(first.prompt, /以公元62584年为本元起点/);
  assert.doesNotMatch(first.prompt, /以公元前67017年为本元起点/);
  assert.match(second.calculationChain[0], /距本元起点已过1年/);
});
