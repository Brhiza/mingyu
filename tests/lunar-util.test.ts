import test from 'node:test';
import assert from 'node:assert/strict';

import { LunarUtil } from 'mingyu-core/calendar';

test('农历工具应拒绝无效时间对象', () => {
  const invalidDate = new Date(Number.NaN);

  assert.throws(() => LunarUtil.getTimeInfo(invalidDate), /时间不是有效日期/);
  assert.throws(() => LunarUtil.getGanZhi(invalidDate), /时间不是有效日期/);
  assert.throws(() => LunarUtil.getLunar(invalidDate), /时间不是有效日期/);
});

test('农历工具应拒绝越界年月参数', () => {
  assert.throws(() => LunarUtil.getGanZhiForMonth(1899, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => LunarUtil.getGanZhiForMonth(2101, 1), /年份需在 1900-2100 之间/);
  assert.throws(() => LunarUtil.getGanZhiForMonth(2026, 0), /月份需在 1-12 之间/);
  assert.throws(() => LunarUtil.getGanZhiForMonth(2026, 13), /月份需在 1-12 之间/);
  assert.throws(() => LunarUtil.getGanZhiForYear(1899), /年份需在 1900-2100 之间/);
  assert.throws(() => LunarUtil.getGanZhiForYear(2101), /年份需在 1900-2100 之间/);
});
