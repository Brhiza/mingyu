/**
 * 排盘金标准边界测试
 * 覆盖:立春换年、节气换月、晚子时换日、真太阳时跨日、
 * 中国夏令时(1986-1991)校正、边界预警、日支帮扶回归。
 * 金标准四柱已与 lunar-javascript 独立实现交叉验证一致。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '../src/utils/bazi/baziCalculator';
import { checkChinaDst, isDateInChinaDstRange } from '../src/utils/bazi/chinaDst';
import {
  checkJieqiBoundary,
  checkShichenBoundary,
} from '../src/utils/bazi/paipanWarnings';

const ganZhi = (p: { gan: string; zhi: string }) => `${p.gan}${p.zhi}`;

test('金标准盘:1994-12-04 03:15 男 佳木斯(真太阳时) → 甲戌 乙亥 甲子 丙寅', () => {
  const r = baziCalculator.calculateBazi({
    year: 1994,
    month: 12,
    day: 4,
    timeIndex: 2,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 3,
    birthMinute: 15,
    birthLongitude: 130.37,
    birthPlace: '黑龙江佳木斯',
  });
  assert.equal(ganZhi(r.pillars.year), '甲戌');
  assert.equal(ganZhi(r.pillars.month), '乙亥');
  assert.equal(ganZhi(r.pillars.day), '甲子');
  assert.equal(ganZhi(r.pillars.hour), '丙寅');
  // 真太阳时校正约 +50 分钟,仍在寅时
  assert.equal(r.timing?.enabled, true);
  assert.equal(r.timing?.correctedTime.hour, 4);
  // 正常盘不应产生边界预警噪音
  assert.deepEqual(r.warnings, []);
  // 甲木亥月调候:火为第一喜用
  assert.equal(r.analysis.usefulGod.primaryFavorableWuxing, '火');
});

test('回归:日支坐印计入帮扶(甲子日,upstream #27)', () => {
  const r = baziCalculator.calculateBazi({
    year: 1994,
    month: 12,
    day: 4,
    timeIndex: 2,
    gender: 'male',
  });
  // 帮扶 = 年甲(比)+月乙(劫)+月支亥(印)+日支子(印) = 4
  assert.equal(r.analysis.dayMasterStrength.details.supportStrength, 4);
});

test('立春边界:2024-02-04 16:27 立春,前后年柱月柱翻转', () => {
  const before = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    timeIndex: 5, // 巳时 09-11
    gender: 'male',
  });
  assert.equal(ganZhi(before.pillars.year), '癸卯');
  assert.equal(ganZhi(before.pillars.month), '乙丑');

  const after = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    timeIndex: 9, // 酉时 17-19
    gender: 'male',
  });
  assert.equal(ganZhi(after.pillars.year), '甲辰');
  assert.equal(ganZhi(after.pillars.month), '丙寅');
});

test('节气换月:2024-03-05 10:23 惊蛰,前后月柱翻转', () => {
  const before = baziCalculator.calculateBazi({
    year: 2024,
    month: 3,
    day: 5,
    timeIndex: 5, // 巳时代表时刻 09:00,在惊蛰前
    gender: 'male',
  });
  assert.equal(ganZhi(before.pillars.month), '丙寅');

  const after = baziCalculator.calculateBazi({
    year: 2024,
    month: 3,
    day: 5,
    timeIndex: 6, // 午时代表时刻 11:00,在惊蛰后
    gender: 'male',
  });
  assert.equal(ganZhi(after.pillars.month), '丁卯');
});

test('晚子时:23:00 后日柱按子初换日(本引擎流派)', () => {
  // 2024-06-15 为庚戌日,次日辛亥
  const r = baziCalculator.calculateBazi({
    year: 2024,
    month: 6,
    day: 15,
    timeIndex: 12, // 晚子时 23:00-24:00
    gender: 'male',
  });
  assert.equal(ganZhi(r.pillars.day), '辛亥');
  assert.equal(ganZhi(r.pillars.hour), '戊子');
});

test('真太阳时跨日:喀什 2020-08-01 00:40 → 日柱退回前一日乙亥', () => {
  const r = baziCalculator.calculateBazi({
    year: 2020,
    month: 8,
    day: 1,
    timeIndex: 0,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 0,
    birthMinute: 40,
    birthLongitude: 75.98,
    birthPlace: '新疆喀什',
  });
  assert.equal(ganZhi(r.pillars.day), '乙亥');
  assert.equal(ganZhi(r.pillars.hour), '丁亥');
  assert.equal(r.timing?.correctedTime.day, 31);
});

test('夏令时:1988-07-15 12:00 北京(钟表) → 自动回拨 60 分钟,时柱巳时', () => {
  const r = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 12,
    birthMinute: 0,
    birthLongitude: 116.4,
    birthPlace: '北京',
  });
  assert.equal(r.timing?.dstCorrectionMinutes, -60);
  // 12:00 钟表 → 11:00 标准 → 经度-14.4min + 均时差≈-6min → 约 10:40,巳时
  assert.equal(r.pillars.hour.zhi, '巳');
  assert.ok(r.warnings.some((w) => w.includes('夏令时')));
});

test('夏令时:applyChinaDst=false 时不校正,时柱午时', () => {
  const r = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 12,
    birthMinute: 0,
    birthLongitude: 116.4,
    applyChinaDst: false,
  });
  assert.equal(r.timing?.dstCorrectionMinutes, undefined);
  // 12:00 → 经度-14.4min + 均时差≈-6min → 约 11:40,午时
  assert.equal(r.pillars.hour.zhi, '午');
  assert.ok(!r.warnings.some((w) => w.includes('夏令时')));
});

test('夏令时:仅时辰精度时只提示不校正', () => {
  const r = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
  });
  assert.ok(r.warnings.some((w) => w.includes('夏令时')));
});

test('夏令时区间函数:边界与非夏令时年份', () => {
  // 区间内
  assert.equal(checkChinaDst(1988, 7, 15, 12).inDst, true);
  // 1988 区间外(4月10日 03:00 起)
  assert.equal(checkChinaDst(1988, 4, 9, 12).inDst, false);
  assert.equal(checkChinaDst(1988, 4, 10, 3).inDst, true);
  // 结束日 02:00 后恢复标准时
  assert.equal(checkChinaDst(1988, 9, 11, 2).inDst, false);
  // 结束日 01:30 为重复时段
  const amb = checkChinaDst(1988, 9, 11, 1, 30);
  assert.equal(amb.inDst, true);
  assert.equal(amb.ambiguous, true);
  // 开始日 02:30 为不存在时段
  const gap = checkChinaDst(1988, 4, 10, 2, 30);
  assert.equal(gap.nonexistent, true);
  // 非夏令时年份
  assert.equal(checkChinaDst(1994, 7, 15, 12).inDst, false);
  assert.equal(isDateInChinaDstRange(1994, 7, 15), false);
  assert.equal(isDateInChinaDstRange(1990, 6, 1), true);
});

test('边界预警:距立春 1 分钟内提示年柱月柱两可', () => {
  // 2024 立春 = 2024-02-04 16:27:07
  const warnings = checkJieqiBoundary({
    year: 2024,
    month: 2,
    day: 4,
    hour: 16,
    minute: 26,
  });
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('立春'));
  assert.ok(warnings[0].includes('年柱'));
});

test('边界预警:距时辰边界 1 分钟内提示时柱两可', () => {
  const warnings = checkShichenBoundary({
    year: 2024,
    month: 6,
    day: 15,
    hour: 14,
    minute: 59,
  });
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('未时'));
  assert.ok(warnings[0].includes('申时'));
});

test('边界预警:23:00 换日线额外提示流派差异', () => {
  const warnings = checkShichenBoundary({
    year: 2024,
    month: 6,
    day: 15,
    hour: 22,
    minute: 59,
  });
  assert.equal(warnings.length, 2);
  assert.ok(warnings[1].includes('晚子时'));
});

test('边界预警:远离边界时不产生预警', () => {
  assert.deepEqual(
    checkJieqiBoundary({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 }),
    [],
  );
  assert.deepEqual(
    checkShichenBoundary({ year: 2024, month: 6, day: 15, hour: 12, minute: 0 }),
    [],
  );
});
