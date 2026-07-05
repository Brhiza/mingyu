import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultHoroscopeContext, shiftLocalDate, shiftLunarYear } from '@core/ziwei/iztro';

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

test('紫微大限时间轴应按农历年位移，春节前出生者不落入相邻流年', () => {
  // 1995-01-20 出生 = 农历甲戌(1994)年十二月二十；+1 农历年 = 乙亥(1995)年十二月二十
  assert.equal(shiftLunarYear('1995-01-20', 1), '1996-02-08');
  // 1995-02-10 出生 = 农历乙亥(1995)年正月十一；+1 = 丙子(1996)年正月十一
  assert.equal(shiftLunarYear('1995-02-10', 1), '1996-02-29');
  // 位移量为 0 应返回出生日对应公历日期本身
  assert.equal(shiftLunarYear('1995-02-10', 0), '1995-02-10');
});

test('紫微农历年位移应处理闰月与月底回退', () => {
  // 2023-03-25 = 闰二月初四；+1 农历年 2024 无闰二月，回退到普通二月初四
  assert.equal(shiftLunarYear('2023-03-25', 1), '2024-03-13');
  // 2024-03-10 = 甲辰年二月初一；+1 乙巳年二月初一
  assert.equal(shiftLunarYear('2024-03-10', 1), '2025-02-28');
});

test('紫微农历年位移应拒绝非法输入', () => {
  assert.throws(() => shiftLunarYear('2024/03/10', 1), /日期格式需为 YYYY-MM-DD/);
  assert.throws(() => shiftLunarYear('2024-03-10', 1.5), /日期位移量必须是整数/);
});
