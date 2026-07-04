import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultHoroscopeContext, shiftLocalDate } from '@core/ziwei/iztro';

test('紫微运行期日期位移应保持合法日期并处理月底', () => {
  assert.equal(shiftLocalDate('2024-02-29', 1, 'year'), '2025-02-28');
  assert.equal(shiftLocalDate('2024-01-31', 1, 'month'), '2024-02-29');
  assert.equal(shiftLocalDate('2024-02-29', 1, 'day'), '2024-03-01');
});

test('紫微运行期日期位移不应因目标年份超过出生日期范围而失败', () => {
  assert.equal(shiftLocalDate('2096-02-29', 5, 'year'), '2101-02-28');
  assert.equal(shiftLocalDate('2098-01-31', 37, 'month'), '2101-02-28');
});

test('紫微运行期日期位移应拒绝非法日期字符串', () => {
  assert.throws(() => shiftLocalDate('2024/02/29', 1, 'year'), /日期格式需为 YYYY-MM-DD/);
  assert.throws(() => shiftLocalDate('2024-02-31', 1, 'year'), /日期需在 1-29 之间/);
  assert.throws(() => shiftLocalDate('1899-01-01', 1, 'year'), /年份需在 1900-2100 之间/);
  assert.throws(() => shiftLocalDate('2024-13-01', 1, 'year'), /月份需在 1-12 之间/);
});

test('紫微默认行运上下文应拒绝无效当前时间', () => {
  assert.throws(() => getDefaultHoroscopeContext(new Date(Number.NaN)), /当前时间不是有效日期/);
});
