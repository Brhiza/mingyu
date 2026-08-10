import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HUANGJI_CYCLE_COUNTS,
  HUANGJI_CYCLE_YEARS,
  HUANGJI_CIRCLE_HEXAGRAMS,
  HUANGJI_STANDARD_EPOCH,
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

test('皇极经世应支持普通公元年，并严格区分通行排法与自定义纪元', () => {
  const standard = calculateHuangjiJingshi({ year: 2026 });
  assert.equal(standard.input.mode, '通行公元年');
  assert.equal(standard.input.epochYear, HUANGJI_STANDARD_EPOCH.yuanStartYear);
  assert.equal(standard.input.elapsedYears, 69042);

  assert.throws(
    () => calculateHuangjiJingshi({ epochYear: 0 }),
    /year 与 elapsedYears 必须且只能提供一个/,
  );
  assert.throws(
    () => calculateHuangjiJingshi({ epochYear: 0, year: 1, elapsedYears: 1 }),
    /year 与 elapsedYears 必须且只能提供一个/,
  );
  assert.throws(() => calculateHuangjiJingshi({ epochYear: 100, year: 99 }), /不能早于/);
  assert.throws(() => calculateHuangjiJingshi({ year: 0 }), /非零安全整数/);
  assert.throws(
    () => calculateHuangjiJingshi({ elapsedYears: 1 }),
    /通行公元值年卦模式必须只提供 year/,
  );
  assert.throws(
    () => calculateHuangjiJingshi({ epochYear: Number.NaN, year: 1 }),
    /epochYear必须是安全范围内的整数/,
  );
});

test('通行值年卦应完整返回会、统卦、运卦、六十年卦、十年卦和值年卦', () => {
  const result = calculateHuangjiJingshi({ year: 2026 });
  const forecast = result.forecast;
  assert.ok(forecast);
  assert.equal(forecast.hui.indexInYuan, 7);
  assert.equal(forecast.hui.branch, '午');
  assert.equal(forecast.hexagrams.governing.hexagram.name, '泽风大过');
  assert.deepEqual(
    [forecast.hexagrams.governing.startYear, forecast.hexagrams.governing.endYear],
    [-57, 2103],
  );
  assert.equal(forecast.hexagrams.yun.hexagram.name, '天风姤');
  assert.equal(forecast.hexagrams.yun.changedLine, 6);
  assert.deepEqual(
    [forecast.hexagrams.yun.startYear, forecast.hexagrams.yun.endYear],
    [1744, 2103],
  );
  assert.equal(forecast.hexagrams.sixtyYear.hexagram.name, '火风鼎');
  assert.equal(forecast.hexagrams.sixtyYear.changedLine, 5);
  assert.deepEqual(
    [forecast.hexagrams.sixtyYear.startYear, forecast.hexagrams.sixtyYear.endYear],
    [1984, 2043],
  );
  assert.equal(forecast.hexagrams.decade.hexagram.name, '天风姤');
  assert.equal(forecast.hexagrams.decade.changedLine, 5);
  assert.deepEqual(
    [forecast.hexagrams.decade.startYear, forecast.hexagrams.decade.endYear],
    [2024, 2033],
  );
  assert.equal(forecast.hexagrams.annual.name, '天火同人');
  assert.equal(forecast.hexagrams.annual.ganzhi, '丙午');
  assert.equal(forecast.relatedHexagrams.mutual.name, '天风姤');
  assert.equal(forecast.relatedHexagrams.opposite.name, '地水师');
  assert.equal(forecast.relatedHexagrams.reversed.name, '火天大有');
  assert.match(forecast.reading.headline, /2026.*丙午.*天火同人/);
});

test('值年卦六十卦序应完整唯一并复现1984至2043通行表', () => {
  assert.equal(HUANGJI_CIRCLE_HEXAGRAMS.length, 60);
  assert.equal(new Set(HUANGJI_CIRCLE_HEXAGRAMS).size, 60);
  const expected = [
    '鼎',
    '恒',
    '巽',
    '井',
    '蛊',
    '升',
    '讼',
    '困',
    '未济',
    '解',
    '涣',
    '蒙',
    '师',
    '遁',
    '咸',
    '旅',
    '小过',
    '渐',
    '蹇',
    '艮',
    '谦',
    '否',
    '萃',
    '晋',
    '豫',
    '观',
    '比',
    '剥',
    '复',
    '颐',
    '屯',
    '益',
    '震',
    '噬嗑',
    '随',
    '无妄',
    '明夷',
    '贲',
    '既济',
    '家人',
    '丰',
    '革',
    '同人',
    '临',
    '损',
    '节',
    '中孚',
    '归妹',
    '睽',
    '兑',
    '履',
    '泰',
    '大畜',
    '需',
    '小畜',
    '大壮',
    '大有',
    '夬',
    '姤',
    '大过',
  ];
  const actual = Array.from(
    { length: 60 },
    (_, index) =>
      calculateHuangjiJingshi({ year: 1984 + index }).forecast?.hexagrams.annual.shortName,
  );
  assert.deepEqual(actual, expected);
});

test('通行公元纪年跨公元前后时应跳过公元0年', () => {
  const before = calculateHuangjiJingshi({ year: -1 });
  const after = calculateHuangjiJingshi({ year: 1 });
  assert.equal(after.input.elapsedYears - before.input.elapsedYears, 1);
  assert.equal(after.position.year.indexInYuan - before.position.year.indexInYuan, 1);
});

test('皇极经世普通提示词应包含完整占断资料且保持精简自包含', () => {
  const prompt = calculateHuangjiJingshi({
    year: 2026,
    question: '这一年的事业环境有什么主要变化？',
  }).prompt;
  assert.match(prompt, /【排盘资料】/);
  assert.match(prompt, /午会/);
  assert.match(prompt, /会内统卦：泽风大过/);
  assert.match(prompt, /运卦：天风姤/);
  assert.match(prompt, /六十年统卦：火风鼎/);
  assert.match(prompt, /十年卦：天风姤/);
  assert.match(prompt, /值年卦：天火同人/);
  assert.match(prompt, /互卦：天风姤/);
  assert.match(prompt, /错卦：地水师/);
  assert.match(prompt, /综卦：火天大有/);
  assert.match(prompt, /这一年的事业环境有什么主要变化/);
  assert.doesNotMatch(prompt, /计算链|证据链|MCP|API|mingyu|仓库/i);
  assertPromptIsPortableTaskText(prompt);
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
  assert.doesNotMatch(prompt, /换算规则|1 世 = 30 年|1 运 = 12 世/);
  assert.match(prompt, /周期边界：本世当前为第 7 年/);
  assert.match(prompt, /下一世始于 2050/);
  assert.match(prompt, /一元十二会、一会三十运、一运十二世、一世三十年/);
  assert.doesNotMatch(prompt, /参考《|《皇极经世》/);
  assert.doesNotMatch(prompt, /mingyu|API|MCP|仓库|内部字段/i);
  assertPromptIsPortableTaskText(prompt);
});
