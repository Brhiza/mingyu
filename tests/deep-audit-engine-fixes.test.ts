import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/core';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildExtremePattern } from '../src/systems/bazi/extreme';
import { buildZiweiAstrolabe, buildZiweiHoroscope } from '../src/systems/ziwei/index';
import { stemTombs } from '../src/systems/qimen/palace';

test('八字修复：经典炎上格/曲直格/润下格/从杀格不再被地支中余气误判为普通格', () => {
  // 经典炎上格：甲寅 丙午 丙午 甲午
  const yanShangPillars = buildPillarFacts({ year: '甲寅', month: '丙午', day: '丙午', hour: '甲午' });
  const ysStrength = buildDayMasterStrength(yanShangPillars, '丁');
  assert.equal(ysStrength.status, '极强');
  const ysExt = buildExtremePattern(yanShangPillars, ysStrength, '丁', null, null);
  assert.equal(ysExt?.candidate, '专旺格');

  // 经典润下格：壬子 辛亥 壬子 庚子
  const runXiaPillars = buildPillarFacts({ year: '壬子', month: '辛亥', day: '壬子', hour: '庚子' });
  const rxStrength = buildDayMasterStrength(runXiaPillars, '壬');
  assert.equal(rxStrength.status, '极强');

  // 经典从杀格：庚申 庚申 甲戌 庚午
  const congShaPillars = buildPillarFacts({ year: '庚申', month: '庚申', day: '甲戌', hour: '庚午' });
  const csStrength = buildDayMasterStrength(congShaPillars, '庚');
  assert.equal(csStrength.status, '极弱');
});

test('八字修复：立春前出生者小运虚岁按立春干支年换岁，不再少算1岁', async () => {
  const res: any = await calculate('bazi', {
    birth: {
      calendar: 'solar', year: 2000, month: 1, day: 15, timezone: 8, timeStandard: 'civil',
      clock: { kind: 'exact', hour: 12, minute: 0, second: 0 },
    },
    gender: 'male',
    referenceTime: '2000-02-10T12:00:00+08:00',
    question: '看小运虚岁',
  });
  // 2000-01-15 在立春前属 1999 己卯年；2000-02-10 在立春后属 2000 庚辰年 -> 虚岁应为 2
  assert.equal(res.data.located.smallFortune.nominalAge, 2);
});

test('紫微修复：闰月十六晚子时不倒退回本月、流月忠实遵循 leapMonthMode=same、春节前压平流年与运限一致', async () => {
  // 1. 闰二月十六早子 vs 晚子（split-15 + forward）
  const earlyZi = buildZiweiAstrolabe({
    solarDate: { year: 2023, month: 4, day: 6 },
    timeIndex: 0,
    gender: 'male',
    rules: { leapMonthMode: 'split-15', dayDivide: 'forward' },
  });
  const lateZi = buildZiweiAstrolabe({
    solarDate: { year: 2023, month: 4, day: 6 },
    timeIndex: 12,
    gender: 'male',
    rules: { leapMonthMode: 'split-15', dayDivide: 'forward' },
  });
  assert.equal(lateZi.earthlyBranchOfSoulPalace, earlyZi.earthlyBranchOfSoulPalace);

  // 2. leapMonthMode=same 与 split-15 的流月斗君保持各自口径一致、不强行覆盖
  const chartSame = buildZiweiAstrolabe({
    solarDate: { year: 2023, month: 4, day: 6 },
    timeIndex: 5,
    gender: 'male',
    rules: { leapMonthMode: 'same' },
  });
  const chartSplit = buildZiweiAstrolabe({
    solarDate: { year: 2023, month: 4, day: 6 },
    timeIndex: 5,
    gender: 'male',
    rules: { leapMonthMode: 'split-15' },
  });
  const hSame = buildZiweiHoroscope(chartSame, { year: 2024, month: 6, day: 15 }, 5);
  const hSplit = buildZiweiHoroscope(chartSplit, { year: 2024, month: 6, day: 15 }, 5);
  assert.notEqual(hSame.monthly.index, hSplit.monthly.index);

  // 3. 春节前（2025-01-20 属甲辰年）压平流年块首年应为 2024甲辰，与【运限】一致
  const preSpring = await calculate('ziwei', {
    birth: {
      calendar: 'solar', year: 1995, month: 6, day: 15, timezone: 8, timeStandard: 'civil',
      clock: { kind: 'exact', hour: 10, minute: 0, second: 0 },
    },
    gender: 'male',
    referenceTime: '2025-01-20T12:00:00+08:00',
    question: '今年运势怎么样',
  });
  assert.match(preSpring.prompt.text, /流年：2024甲辰/);
});

test('奇门修复：stemTombs 天干入墓表 庚/己/癸 与 layout.ts 口径 100% 统一', () => {
  assert.deepEqual(stemTombs['庚'], { branch: '丑', palace: 8 });
  assert.deepEqual(stemTombs['己'], { branch: '丑', palace: 8 });
  assert.deepEqual(stemTombs['癸'], { branch: '未', palace: 2 });
});
