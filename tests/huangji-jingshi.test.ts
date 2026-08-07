import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HUANGJI_CYCLE_COUNTS,
  HUANGJI_CYCLE_YEARS,
  calculateHuangjiJingshi,
} from '@core/huangji-jingshi';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

test('皇极经世换算常量应满足元会运世层级恒等式', () => {
  assert.equal(HUANGJI_CYCLE_YEARS.shi, 30);
  assert.equal(HUANGJI_CYCLE_YEARS.yun, 30 * HUANGJI_CYCLE_COUNTS.shiPerYun);
  assert.equal(HUANGJI_CYCLE_YEARS.hui, 360 * HUANGJI_CYCLE_COUNTS.yunPerHui);
  assert.equal(HUANGJI_CYCLE_YEARS.yuan, 10800 * HUANGJI_CYCLE_COUNTS.huiPerYuan);
  assert.equal(HUANGJI_CYCLE_COUNTS.shiPerYuan, 4320);
});

test('纪元第一年应位于第一元第一会第一运第一世第一年', () => {
  const result = calculateHuangjiJingshi({ epochYear: 1000, year: 1000 });
  assert.equal(result.position.yuan.indexFromEpoch, 1);
  assert.equal(result.position.hui.indexInYuan, 1);
  assert.equal(result.position.yun.indexInYuan, 1);
  assert.equal(result.position.yun.indexInHui, 1);
  assert.equal(result.position.shi.indexInYuan, 1);
  assert.equal(result.position.shi.indexInYun, 1);
  assert.equal(result.position.year.indexInShi, 1);
  assert.deepEqual([result.position.yuan.startYear, result.position.yuan.endYear], [1000, 130599]);
  assert.deepEqual(result.progress.shi, {
    currentYearIndex: 1,
    completedYears: 0,
    remainingYearsAfterCurrent: 29,
    nextCycleStartYear: 1030,
  });
  assert.equal(result.progress.yun.remainingYearsAfterCurrent, 359);
  assert.equal(result.progress.hui.remainingYearsAfterCurrent, 10799);
  assert.equal(result.progress.yuan.remainingYearsAfterCurrent, 129599);
});

test('各层最后一年与下一层第一年不应出现差一错误', () => {
  const lastYear = calculateHuangjiJingshi({ epochYear: 0, elapsedYears: 129599 });
  assert.equal(lastYear.position.yuan.indexFromEpoch, 1);
  assert.equal(lastYear.position.hui.indexInYuan, 12);
  assert.equal(lastYear.position.yun.indexInYuan, 360);
  assert.equal(lastYear.position.yun.indexInHui, 30);
  assert.equal(lastYear.position.shi.indexInYuan, 4320);
  assert.equal(lastYear.position.shi.indexInYun, 12);
  assert.equal(lastYear.position.year.indexInShi, 30);
  assert.equal(lastYear.progress.shi.remainingYearsAfterCurrent, 0);
  assert.equal(lastYear.progress.yun.remainingYearsAfterCurrent, 0);
  assert.equal(lastYear.progress.hui.remainingYearsAfterCurrent, 0);
  assert.equal(lastYear.progress.yuan.remainingYearsAfterCurrent, 0);
  assert.equal(lastYear.progress.yuan.nextCycleStartYear, 129600);

  const nextYear = calculateHuangjiJingshi({ epochYear: 0, elapsedYears: 129600 });
  assert.equal(nextYear.position.yuan.indexFromEpoch, 2);
  assert.equal(nextYear.position.hui.indexInYuan, 1);
  assert.equal(nextYear.position.yun.indexInYuan, 1);
  assert.equal(nextYear.position.shi.indexInYuan, 1);
  assert.equal(nextYear.position.year.indexInShi, 1);
  assert.equal(nextYear.progress.shi.currentYearIndex, 1);
  assert.equal(nextYear.progress.yuan.nextCycleStartYear, 259200);
  assert.deepEqual(
    [nextYear.position.yuan.startYear, nextYear.position.yuan.endYear],
    [129600, 259199],
  );
});

test('绝对年坐标与已过年数入口应得到同一位置', () => {
  const byYear = calculateHuangjiJingshi({ epochYear: 500, year: 12345 });
  const byElapsed = calculateHuangjiJingshi({ epochYear: 500, elapsedYears: 11845 });
  assert.deepEqual(byYear.position, byElapsed.position);
  assert.deepEqual(byYear.progress, byElapsed.progress);
});

test('皇极经世必须显式提供纪元且严格校验输入模式', () => {
  assert.throws(
    () => calculateHuangjiJingshi({ epochYear: 0 }),
    /year 与 elapsedYears 必须且只能提供一个/,
  );
  assert.throws(
    () => calculateHuangjiJingshi({ epochYear: 0, year: 1, elapsedYears: 1 }),
    /year 与 elapsedYears 必须且只能提供一个/,
  );
  assert.throws(() => calculateHuangjiJingshi({ epochYear: 100, year: 99 }), /不能早于/);
  assert.throws(
    () => calculateHuangjiJingshi({ epochYear: Number.NaN, year: 1 }),
    /epochYear必须是安全范围内的整数/,
  );
});

test('皇极经世提示词应标明纪元依赖并保持自包含', () => {
  const prompt = calculateHuangjiJingshi({
    epochYear: 1000,
    year: 2026,
    question: '请解释当前周期位置。',
  }).prompt;
  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【周期资料】/);
  assert.match(prompt, /纪元年坐标：1000/);
  assert.match(prompt, /1 世 = 30 年/);
  assert.match(prompt, /周期边界：本世当前为第 7 年/);
  assert.match(prompt, /下一世始于 2050/);
  assert.match(prompt, /《皇极经世》/);
  assert.doesNotMatch(prompt, /mingyu|API|MCP|仓库|内部字段/i);
  assertPromptIsPortableTaskText(prompt);
});
