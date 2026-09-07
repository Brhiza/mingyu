import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandardHuangjiForecast, serialYearToCivil } from '@core/huangji-jingshi';

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
