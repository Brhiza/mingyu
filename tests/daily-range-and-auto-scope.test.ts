import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, reprompt } from '../src/core';
import { inferFortuneScope } from '../src/router-model/fortune-scope';
import { getExactDayGanZhi, resolveDailyRange } from '../src/systems/daily-range';

// 固定参考时间：2026-11-22 12:00:00 +08:00（周日）
const REF_TS = Date.parse('2026-11-22T12:00:00+08:00');
const REF_YEAR = 2026;

const SAMPLE_BIRTH = {
  calendar: 'solar' as const,
  year: 1992,
  month: 5,
  day: 16,
  timezone: 8,
  timeStandard: 'civil' as const,
  clock: { kind: 'exact' as const, hour: 10, minute: 30, second: 0 },
};

test('自动时间识别：整月流日、整周流日、星期、周末、相对日、季度与年龄全覆盖', () => {
  // 1. 整月流日
  const decFull = inferFortuneScope('帮我看看12月整月流日怎么安排', REF_YEAR, REF_TS);
  assert.equal(decFull.dates.length, 31);
  assert.deepEqual(decFull.dates[0], { year: 2026, month: 12, day: 1 });
  assert.deepEqual(decFull.dates[30], { year: 2026, month: 12, day: 31 });

  const nextMonthFull = inferFortuneScope('下个月每天的流日都要看', REF_YEAR, REF_TS);
  assert.equal(nextMonthFull.dates.length, 31);
  assert.equal(nextMonthFull.dates[0].month, 12);

  // 2. 整周流日
  const nextWeekDaily = inferFortuneScope('下周每天运势怎么样', REF_YEAR, REF_TS);
  assert.equal(nextWeekDaily.dates.length, 7);
  // 2026-11-22 是周日，下周一为 2026-11-23
  assert.deepEqual(nextWeekDaily.dates[0], { year: 2026, month: 11, day: 23 });
  assert.deepEqual(nextWeekDaily.dates[6], { year: 2026, month: 11, day: 29 });

  const next7Days = inferFortuneScope('接下来7天适合谈合作吗', REF_YEAR, REF_TS);
  assert.equal(next7Days.dates.length, 7);
  assert.deepEqual(next7Days.dates[0], { year: 2026, month: 11, day: 22 });

  // 3. 具体星期与周末
  const nextWed = inferFortuneScope('下周三去面试怎么样', REF_YEAR, REF_TS);
  assert.ok(nextWed.dates.some((d) => d.year === 2026 && d.month === 11 && d.day === 25));

  const thisWeekend = inferFortuneScope('本周末适合出门签约吗', REF_YEAR, REF_TS);
  assert.ok(thisWeekend.dates.some((d) => d.year === 2026 && d.month === 11 && d.day === 22));

  // 4. 相对日期（明天自带连续 5 天走势窗口，首日为 11/23；昨天命中 11/21）
  const tomorrow = inferFortuneScope('明天适合表白吗', REF_YEAR, REF_TS);
  assert.deepEqual(tomorrow.dates[0], { year: 2026, month: 11, day: 23 });
  assert.ok(tomorrow.dates.length >= 1);

  const yesterday = inferFortuneScope('昨天吵了一架，后面会和好吗', REF_YEAR, REF_TS);
  assert.ok(yesterday.dates.some((d) => d.year === 2026 && d.month === 11 && d.day === 21));

  // 5. 季度 / 半年 / 年底前 / 金九银十
  const q2 = inferFortuneScope('明年Q2适合跳槽吗', REF_YEAR, REF_TS);
  assert.ok(q2.months.some((m) => m.year === 2027 && m.month === 4));
  assert.ok(q2.months.some((m) => m.year === 2027 && m.month === 6));

  const firstHalf = inferFortuneScope('明年上半年财运怎么样', REF_YEAR, REF_TS);
  assert.equal(firstHalf.months.length, 6);
  assert.equal(firstHalf.months[0].year, 2027);
  assert.equal(firstHalf.months[0].month, 1);

  const beforeYearEnd = inferFortuneScope('年底前能拿到offer吗', REF_YEAR, REF_TS);
  assert.ok(beforeYearEnd.months.some((m) => m.year === 2026 && m.month === 12));

  const sepOct = inferFortuneScope('今年金九银十适合换工作吗', REF_YEAR, REF_TS);
  assert.ok(sepOct.months.some((m) => m.month === 9));
  assert.ok(sepOct.months.some((m) => m.month === 10));

  // 6. 年龄自动换算年份（传入 birthYear = 1992）
  const age35 = inferFortuneScope('我35岁那年事业会有大变动吗', REF_YEAR, REF_TS, 1992);
  // 1992 + 35 = 2027（周岁）/ 2026（虚岁），应命中 2026/2027
  assert.ok(age35.years.includes(2026) || age35.years.includes(2027));

  const ageRange = inferFortuneScope('35到38岁这几年财运如何', REF_YEAR, REF_TS, 1992);
  assert.ok(ageRange.years.includes(2027) && ageRange.years.includes(2029));

  // 7. 中文年份 & 两位年份 & 出生年份防误判
  const cnYear = inferFortuneScope('二零二八年适合买房吗', REF_YEAR, REF_TS);
  assert.ok(cnYear.years.includes(2028));

  const twoDigitYear = inferFortuneScope('28年适合创业吗', REF_YEAR, REF_TS);
  assert.ok(twoDigitYear.years.includes(2028));

  const birthMention = inferFortuneScope('我是1992年出生的，今年感情怎么样', REF_YEAR, REF_TS, 1992);
  assert.ok(!birthMention.years.includes(1992));
  assert.ok(birthMention.years.includes(2026));
});

test('手动区间流日解析与边界校验', () => {
  assert.equal(getExactDayGanZhi(2000, 1, 1), '戊午');

  const week = resolveDailyRange({ preset: 'week', anchorDate: '2026-12-01' }, REF_TS);
  assert.equal(week.daysCount, 7);
  assert.equal(week.startDate, '2026-12-01');
  assert.equal(week.endDate, '2026-12-07');

  const feb2026 = resolveDailyRange({ preset: 'month', year: 2026, month: 2 }, REF_TS);
  assert.equal(feb2026.daysCount, 28);

  const feb2024 = resolveDailyRange({ preset: 'month', year: 2024, month: 2 }, REF_TS);
  assert.equal(feb2024.daysCount, 29);

  assert.throws(
    () => resolveDailyRange({ startDate: '2026-12-01', endDate: '2027-01-05' }, REF_TS),
    /最多支持 31 天/,
  );
  assert.throws(
    () => resolveDailyRange({ startDate: '2026-12-10', endDate: '2026-12-01' }, REF_TS),
    /不能早于开始日期/,
  );
  assert.throws(
    () => resolveDailyRange({ startDate: '2026-02-30', endDate: '2026-03-01' }, REF_TS),
    /不存在的公历日期/,
  );
});

test('八字手动 dailyRange（整月31天/整周7天/自定义区间）且不输出逐日喜忌，并支持 reprompt', async () => {
  const resMonth = await calculate('bazi', {
    birth: SAMPLE_BIRTH,
    gender: 'male',
    referenceTime: '2026-11-22T12:00:00+08:00',
    dailyRange: { preset: 'month', year: 2026, month: 12 },
    question: '看看12月每天的节奏',
  });
  const textMonth = resMonth.prompt.text;
  assert.match(textMonth, /【手动区间流日一览】/);
  assert.match(textMonth, /整月流日（2026年12月，共31天）/);
  assert.match(textMonth, /12\/1[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/);
  assert.match(textMonth, /12\/31[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/);
  // 确认手动区间流日块内不含逐日喜忌标注
  const rangeBlock = textMonth.split('【手动区间流日一览】')[1].split('\n\n')[0];
  assert.ok(!/\(喜|\(忌/.test(rangeBlock), `不应出现逐日喜忌标签，实际为：\n${rangeBlock}`);

  // reprompt 应原样通过一致性校验并保留手动流日块
  const re = await reprompt({
    method: 'bazi',
    result: resMonth,
    question: '换个问题：12月哪几天适合签约？',
  });
  assert.match(re.prompt.text, /【手动区间流日一览】/);
  assert.match(re.prompt.text, /整月流日（2026年12月，共31天）/);

  // 自定义 10 天区间
  const resCustom = await calculate('bazi', {
    birth: SAMPLE_BIRTH,
    gender: 'male',
    referenceTime: '2026-11-22T12:00:00+08:00',
    dailyRange: { startDate: '2026-12-01', endDate: '2026-12-10' },
    question: '看看12月上旬',
  });
  assert.match(resCustom.prompt.text, /指定区间流日（2026-12-01 至 2026-12-10，共10天）/);
});

test('紫微斗数手动 dailyRange（整周7天/整月31天）与自动整月流日并支持 reprompt', async () => {
  const resWeek = await calculate('ziwei', {
    birth: SAMPLE_BIRTH,
    gender: 'male',
    referenceTime: '2026-11-22T12:00:00+08:00',
    dailyRange: { preset: 'week', anchorDate: '2026-12-01' },
    question: '看看12月第一周',
  });
  assert.match(resWeek.prompt.text, /【手动区间流日一览】/);
  assert.match(resWeek.prompt.text, /整周流日（2026-12-01 至 2026-12-07，共7天）/);
  assert.match(resWeek.prompt.text, /12\/1[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\([^)]+·忌/);

  const re = await reprompt({
    method: 'ziwei',
    result: resWeek,
    question: '再看下这周哪天注意沟通',
  });
  assert.match(re.prompt.text, /【手动区间流日一览】/);

  // 自动识别整月流日（不传 dailyRange，仅通过问题触发）
  const resAuto = await calculate('ziwei', {
    birth: SAMPLE_BIRTH,
    gender: 'male',
    referenceTime: '2026-11-22T12:00:00+08:00',
    question: '帮我列出12月整月流日',
  });
  assert.match(resAuto.prompt.text, /参考流日（共31天）：/);
});
