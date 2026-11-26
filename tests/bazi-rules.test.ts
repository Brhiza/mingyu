import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { calculateBaziFortune } from '../src/systems/bazi/fortune';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';

test('yearBoundary 口径：lichun、lunar-new-year 与 dongzhi 分别按立春、正月初一和冬至换年', async () => {
  // 2025-01-30：正月初一（2025-01-29）之后，立春（2025-02-03 22:10）之前
  const afterLnyBeforeLichun = { year: 2025, month: 1, day: 30, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  const lichun = await calculateBaziPillars(afterLnyBeforeLichun);
  const lny = await calculateBaziPillars(afterLnyBeforeLichun, undefined, { yearBoundary: 'lunar-new-year' });
  assert.equal(lichun.pillars.year.ganZhi, '甲辰');
  assert.equal(lny.pillars.year.ganZhi, '乙巳');

  // 2025-01-28：除夕，正月初一之前
  const beforeLny = { year: 2025, month: 1, day: 28, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  assert.equal((await calculateBaziPillars(beforeLny, undefined, { yearBoundary: 'lunar-new-year' })).pillars.year.ganZhi, '甲辰');

  // 2024-12-20（冬至前） vs 2024-12-22（冬至后、立春前）
  const beforeDongzhi = { year: 2024, month: 12, day: 20, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  const afterDongzhi = { year: 2024, month: 12, day: 22, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  assert.equal((await calculateBaziPillars(beforeDongzhi, undefined, { yearBoundary: 'dongzhi' })).pillars.year.ganZhi, '甲辰');
  assert.equal((await calculateBaziPillars(afterDongzhi, undefined, { yearBoundary: 'dongzhi' })).pillars.year.ganZhi, '乙巳');
});

test('ziHourMode 与 nightZiStemMode 口径：23:00 换次日 vs split-zi 晚子时保留当日日柱并支持次日/当日日干五鼠遁', async () => {
  const lateZi = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 23, minute: 30, second: 0 }, timezone: 8 };
  const defaultMode = await calculateBaziPillars(lateZi);
  const splitZiNextDay = await calculateBaziPillars(lateZi, undefined, { ziHourMode: 'split-zi' });
  const splitZiNextDayExplicit = await calculateBaziPillars(lateZi, undefined, { ziHourMode: 'split-zi', nightZiStemMode: 'next-day' });
  const splitZiCurrentDay = await calculateBaziPillars(lateZi, undefined, { ziHourMode: 'split-zi', nightZiStemMode: 'current-day' });
  assert.equal(defaultMode.pillars.day.ganZhi, '辛巳');
  assert.equal(defaultMode.pillars.hour.ganZhi, '戊子');
  assert.equal(splitZiNextDay.pillars.day.ganZhi, '庚辰');
  assert.equal(splitZiNextDay.pillars.hour.ganZhi, '戊子');
  assert.equal(splitZiNextDayExplicit.pillars.day.ganZhi, '庚辰');
  assert.equal(splitZiNextDayExplicit.pillars.hour.ganZhi, '戊子');
  assert.equal(splitZiCurrentDay.pillars.day.ganZhi, '庚辰');
  assert.equal(splitZiCurrentDay.pillars.hour.ganZhi, '丙子');
});

test('solarTermMode 口径：exact-instant 按交节瞬时，civil-day 按交节当日整日换月', async () => {
  // 2025-02-03 22:10 交立春；10:00 处于交节前但同一公历日
  const lichunDayMorning = { year: 2025, month: 2, day: 3, clock: { kind: 'exact' as const, hour: 10, minute: 0, second: 0 }, timezone: 8 };
  const exactInstant = await calculateBaziPillars(lichunDayMorning);
  const civilDay = await calculateBaziPillars(lichunDayMorning, undefined, { solarTermMode: 'civil-day' });
  assert.equal(exactInstant.pillars.year.ganZhi, '甲辰');
  assert.equal(exactInstant.pillars.month.ganZhi, '丁丑');
  assert.equal(civilDay.pillars.year.ganZhi, '乙巳');
  assert.equal(civilDay.pillars.month.ganZhi, '戊寅');
});

test('patternMode 口径：standard、main-qi-first 与 special-first 正确切换格局排序', async () => {
  const quzhiBirth = { year: 1980, month: 1, day: 3, clock: { kind: 'exact' as const, hour: 6, minute: 0, second: 0 }, timezone: 8 };
  const standard = await calculateBaziPillars(quzhiBirth, undefined, { patternMode: 'standard' });
  const mainQiFirst = await calculateBaziPillars(quzhiBirth, undefined, { patternMode: 'main-qi-first' });
  const specialFirst = await calculateBaziPillars(quzhiBirth, undefined, { patternMode: 'special-first' });
  assert.equal(standard.patternOverview.pattern, '曲直格');
  assert.equal(mainQiFirst.patternOverview.pattern, mainQiFirst.ordinaryPattern.monthPrincipal.pattern);
  assert.equal(mainQiFirst.patternOverview.source, '普通月令取格候选');
  assert.equal((mainQiFirst.patternOverview as { mode?: string }).mode, 'main-qi-first');
  assert.equal(specialFirst.patternOverview.pattern, '曲直格');
  assert.equal((specialFirst.patternOverview as { mode?: string }).mode, 'special-first');
});

test('extraPalaces 与 mingGongMethod：默认计算命宫身宫胎元胎息，支持关闭及太阳过宫校正', async () => {
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const withPalaces = await calculateBaziPillars(birth);
  assert.equal(withPalaces.extraPalaces?.mingGong.ganZhi, '辛巳');
  assert.equal(withPalaces.extraPalaces?.shenGong.ganZhi, '己丑');
  assert.equal(withPalaces.extraPalaces?.taiYuan.ganZhi, '壬申');
  assert.equal(withPalaces.extraPalaces?.taiXi.ganZhi, '乙酉');

  const withoutPalaces = await calculateBaziPillars(birth, undefined, { includeExtraPalaces: false });
  assert.equal(withoutPalaces.extraPalaces, undefined);

  // 立春后、雨水前（太阳未过双鱼宫，traditional 与 solar-position 命宫地支差一位）
  const beforeYushui = { year: 2025, month: 2, day: 10, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  const trad = await calculateBaziPillars(beforeYushui, undefined, { mingGongMethod: 'traditional' });
  const solarPos = await calculateBaziPillars(beforeYushui, undefined, { mingGongMethod: 'solar-position' });
  assert.notEqual(trad.extraPalaces?.mingGong.zhi, solarPos.extraPalaces?.mingGong.zhi);

  // 雨水后、惊蛰前（太阳已过宫，两种口径一致）
  const afterYushui = { year: 2025, month: 2, day: 25, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  const tradAfter = await calculateBaziPillars(afterYushui, undefined, { mingGongMethod: 'traditional' });
  const solarAfter = await calculateBaziPillars(afterYushui, undefined, { mingGongMethod: 'solar-position' });
  assert.equal(tradAfter.extraPalaces?.mingGong.ganZhi, solarAfter.extraPalaces?.mingGong.ganZhi);
});

test('独立八字 API 渲染辅助宫位与排盘口径，追问保留 rules 并拒绝篡改', async () => {
  const input = {
    question: '事业如何？',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 23, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male' as const,
    rules: {
      yearBoundary: 'lichun' as const,
      ziHourMode: 'split-zi' as const,
      nightZiStemMode: 'current-day' as const,
      solarTermMode: 'exact-instant' as const,
      patternMode: 'standard' as const,
      includeExtraPalaces: true,
      mingGongMethod: 'traditional' as const,
      kongWangMode: 'day-and-year' as const,
      fortuneRule: 'round-day' as const,
    },
  };
  const result = JSON.parse(JSON.stringify(await calculate('bazi', input)));
  assert.equal(result.data.chart.pillars.day.ganZhi, '庚辰');
  assert.equal(result.data.chart.pillars.hour.ganZhi, '丙子');
  assert.ok(result.data.chart.extraPalaces);
  assert.match(result.prompt.text, /【辅助宫位（命宫\/身宫\/胎元\/胎息）】/);
  assert.match(result.prompt.text, /排盘口径：.*子时=早晚子分日，晚子时干=当日干.*旬空=年日互换，起运=三天折一年（取整）/);
  assert.match(result.prompt.text, /日柱旬空 .*；年柱旬空 /);
  assert.equal(result.data.fortune.startAge.hours, 0);
  assert.equal(result.data.fortune.startAge.minutes, 0);

  const next = await reprompt({ method: 'bazi', result, question: '命宫怎么看？' });
  assert.match(next.prompt.text, /【辅助宫位（命宫\/身宫\/胎元\/胎息）】/);
  assert.match(next.prompt.text, /子时=早晚子分日，晚子时干=当日干.*旬空=年日互换，起运=三天折一年（取整）/);
  assert.match(next.prompt.text, /日柱旬空 .*；年柱旬空 /);

  const tamperedPalace = structuredClone(result);
  tamperedPalace.data.chart.extraPalaces.mingGong.ganZhi = '甲子';
  await assert.rejects(() => reprompt({ method: 'bazi', result: tamperedPalace, question: '继续问' }), /不一致/);

  const tamperedRule = structuredClone(result);
  tamperedRule.data.input.rules.ziHourMode = '23:00';
  await assert.rejects(() => reprompt({ method: 'bazi', result: tamperedRule, question: '继续问' }), /不一致/);

  const tamperedFortuneRule = structuredClone(result);
  tamperedFortuneRule.data.input.rules.fortuneRule = 'exact-3days';
  await assert.rejects(() => reprompt({ method: 'bazi', result: tamperedFortuneRule, question: '继续问' }), /不一致/);
});

test('kongWangMode 口径：day 仅按日柱查旬空，day-and-year 兼示年柱旬空', async () => {
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const dayOnly = await calculate('bazi', { question: '旬空怎么看？', birth, gender: 'male' });
  const dayAndYear = await calculate('bazi', { question: '旬空怎么看？', birth, gender: 'male', rules: { kongWangMode: 'day-and-year' } });
  assert.doesNotMatch(dayOnly.prompt.text, /旬空查法（年日互换）/);
  assert.match(dayAndYear.prompt.text, /旬空查法（年日互换）：日柱旬空 申、酉；年柱旬空 戌、亥。/);
});

test('fortuneRule 口径：exact-3days 精确到分秒 vs round-day 按整日取整折算', async () => {
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const chart = await calculateBaziPillars(birth, 'male');
  const exact = calculateBaziFortune(chart, 'male');
  const exactExplicit = calculateBaziFortune(chart, 'male', 'exact-3days');
  const roundDay = calculateBaziFortune(chart, 'male', 'round-day');

  assert.deepEqual(exact, exactExplicit);
  assert.ok(exact.startAge.hours > 0 || exact.startAge.minutes > 0);

  // 1990-05-15 14:30:00 至 1990-06-06 06:46:18 约 21.68 天 -> 四舍五入 22 天 -> 7 年 4 月 0 日 0 时 0 分
  assert.deepEqual(roundDay.startAge, { years: 7, months: 4, days: 0, hours: 0, minutes: 0 });
  assert.equal(roundDay.firstTimestamp, Date.UTC(1997, 8, 15, 14 - 8, 30, 0));
  assert.equal(roundDay.cycles[0].startTimestamp, roundDay.firstTimestamp);
  assert.match(roundDay.rule, /四舍五入取整日/);
});

test('solarTermMode civil-day 与 yearBoundary 配合大运计算：按实际排盘年月柱推算顺逆与十二步大运', async () => {
  // 2025-02-03 10:00 处于立春交节瞬时前：civil-day 下按乙巳年、戊寅月排盘并推算大运
  const lichunDayMorning = { year: 2025, month: 2, day: 3, clock: { kind: 'exact' as const, hour: 10, minute: 0, second: 0 }, timezone: 8 };
  const result = await calculate('bazi', {
    question: '大运如何？',
    birth: lichunDayMorning,
    gender: 'male',
    rules: { solarTermMode: 'civil-day' },
  });
  assert.equal(result.data.chart!.pillars.year.ganZhi, '乙巳');
  assert.equal(result.data.chart!.pillars.month.ganZhi, '戊寅');
  // 乙年男命（阴男）逆行，戊寅月逆推第一步大运为丁丑
  assert.equal(result.data.fortune!.direction, 'backward');
  assert.equal(result.data.fortune!.cycles[0].ganZhi, '丁丑');
});

test('yangRenMode 与 commanderMode 口径：支持子平阳干羊刃、五阴干冠带刃及渊海子平月令分日表', async () => {
  // 1990-05-15 14:30 日柱为庚辰（阳干），测试阴干日主：1990-05-16 14:30 日柱为辛巳（阴干）
  const yinDayBirth = { year: 1990, month: 5, day: 16, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const allStems = await calculateBaziPillars(yinDayBirth, 'female', { yangRenMode: 'all-stems' });
  const yangOnly = await calculateBaziPillars(yinDayBirth, 'female', { yangRenMode: 'yang-only' });
  const guandai = await calculateBaziPillars(yinDayBirth, 'female', { yangRenMode: 'all-stems-guandai' });
  assert.equal(allStems.pillars.day.gan, '辛');
  // 辛日时柱乙未，带申为逆帝旺刃，带戌为顺冠带刃；测试辛日遇申/戌
  const xinWithShenAndXu = { year: 1994, month: 8, day: 15, clock: { kind: 'exact' as const, hour: 16, minute: 0, second: 0 }, timezone: 8 };
  const cAll = await calculateBaziPillars(xinWithShenAndXu, 'male', { yangRenMode: 'all-stems' });
  const cYangOnly = await calculateBaziPillars(xinWithShenAndXu, 'male', { yangRenMode: 'yang-only' });
  const cGuandai = await calculateBaziPillars(xinWithShenAndXu, 'male', { yangRenMode: 'all-stems-guandai' });
  if (['乙', '丁', '己', '辛', '癸'].includes(cAll.pillars.day.gan)) {
    assert.equal(cYangOnly.shensha.entries.some((e) => e.name === '羊刃'), false);
  }
  assert.match(yangOnly.shensha.rule, /羊刃仅取五阳干/);
  assert.match(guandai.shensha.rule, /羊刃阳干取帝旺、阴干顺取冠带位/);
  assert.ok(cGuandai.shensha.rule.includes('冠带'));

  // 巳月立夏后第 6 天：standard 为庚金（戊5庚9丙16），yuanhai 为戊土（戊7庚5丙18）
  const lixiaDay6 = { year: 2024, month: 5, day: 11, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  const stdCmd = await calculateBaziPillars(lixiaDay6, 'male', { commanderMode: 'standard' });
  const yhCmd = await calculateBaziPillars(lixiaDay6, 'male', { commanderMode: 'yuanhai' });
  assert.equal(stdCmd.monthCommander.stem, '庚');
  assert.equal(yhCmd.monthCommander.stem, '戊');
});
