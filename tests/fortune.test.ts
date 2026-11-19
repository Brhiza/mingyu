import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

test('运势模块支持通用日运、月运、年运（不选案例）并输出本地算法概览与提示词', async () => {
  const daily = await calculate('fortune', {
    scope: 'daily',
    target: { year: 2026, month: 11, day: 19 },
    question: '今天适合签约或见客户吗？',
  }) as any;

  assert.equal(daily.data.scope, 'daily');
  assert.equal(daily.data.mode, 'general');
  assert.equal(daily.data.targetLabel, '2026年11月19日');
  assert.equal(daily.data.overview.dimensions.length, 5);
  assert.ok(daily.data.overview.overallScore >= 32 && daily.data.overview.overallScore <= 96);
  assert.equal(daily.data.timeline.hours.length, 13);
  assert.match(daily.prompt.text, /2026年11月19日日运/);
  assert.match(daily.prompt.text, /今天适合签约或见客户吗/);

  const monthly = await calculate('fortune', {
    scope: 'monthly',
    target: { year: 2026, month: 11 },
    question: '这个月工作和财运节奏如何？',
    prompt: { topic: 'career' },
  }) as any;

  assert.equal(monthly.data.scope, 'monthly');
  assert.equal(monthly.data.timeline.days.length, 30);
  assert.ok(monthly.data.timeline.solarTerms.length >= 1);
  assert.match(monthly.prompt.text, /2026年11月月运/);
  assert.match(monthly.prompt.text, /事业工作/);

  const yearly = await calculate('fortune', {
    scope: 'yearly',
    target: { year: 2026 },
    question: '2026 年整体运势与五运六气特征？',
    prompt: { detailMode: 'full' },
  }) as any;

  assert.equal(yearly.data.scope, 'yearly');
  assert.equal(yearly.data.timeline.months.length, 12);
  assert.ok(yearly.data.wuyunSummary);
  assert.match(yearly.prompt.text, /2026年年运/);
  assert.match(yearly.prompt.text, /五运六气/);
});

test('运势模块支持选择个人案例，融合八字喜忌、紫微四化与星盘行运输出定制内容', async () => {
  const birth = {
    year: 1990,
    month: 5,
    day: 15,
    clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
    timezone: 8,
  } as const;

  const personalizedDaily = await calculate('fortune', {
    scope: 'daily',
    target: { year: 2026, month: 11, day: 19 },
    birth,
    gender: 'female',
    caseName: '测试档案甲',
    location: { latitude: 39.9, longitude: 116.4, locationName: '北京' },
    question: '今天工作与财运要注意什么？',
    prompt: { topic: 'wealth', includeClassics: true },
  }) as any;

  assert.equal(personalizedDaily.data.mode, 'personalized');
  assert.equal(personalizedDaily.data.caseName, '测试档案甲');
  assert.ok(personalizedDaily.data.baziSummary);
  assert.ok(personalizedDaily.data.ziweiSummary);
  assert.ok(personalizedDaily.data.astrolabeSummary);
  assert.ok(personalizedDaily.data.overview.scoreFactors.some((f: any) => f.category === 'bazi'));
  assert.match(personalizedDaily.prompt.text, /定制案例「测试档案甲」/);
  assert.match(personalizedDaily.prompt.text, /个人定制盘面事实/);
  assert.match(personalizedDaily.prompt.text, /典籍依据参考/);

  const personalizedYearly = await calculate('fortune', {
    scope: 'yearly',
    target: { year: 2026 },
    birth,
    gender: 'female',
    caseName: '测试档案甲',
    location: { latitude: 39.9, longitude: 116.4 },
    question: '2026 年全年走势如何？',
  }) as any;

  assert.equal(personalizedYearly.data.timeline.months.length, 12);
  assert.ok(personalizedYearly.data.timeline.months.some((m: any) => Boolean(m.ziweiPalace)));
});

test('运势模块对未知时辰案例与早于出生日期的情况做优雅降级，并严格校验日期与追问篡改', async () => {
  const unknownTime = await calculate('fortune', {
    scope: 'monthly',
    target: { year: 2026, month: 11 },
    birth: {
      year: 1992,
      month: 8,
      day: 12,
      clock: { kind: 'unknown' },
      timezone: 8,
    },
    gender: 'male',
    caseName: '未知时辰示例',
    question: '本月整体需要注意什么？',
  }) as any;

  assert.equal(unknownTime.data.mode, 'personalized');
  assert.ok(unknownTime.data.baziSummary.precisionNote);
  assert.equal(unknownTime.data.ziweiSummary, null);
  assert.equal(unknownTime.data.timeline.days.length, 30);

  const beforeBirth = await calculate('fortune', {
    scope: 'yearly',
    target: { year: 1985 },
    birth: {
      year: 1990,
      month: 5,
      day: 15,
      clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
      timezone: 8,
    },
    gender: 'female',
    question: '早于出生年份的处理',
  }) as any;

  assert.ok(beforeBirth.data.omitted.some((o: any) => o.system === '流运大运对比'));

  await assert.rejects(
    () =>
      calculate('fortune', {
        scope: 'daily',
        target: { year: 2026, month: 2, day: 30 },
        question: '非法日期',
      }),
    /2026年2月没有第 30 日/,
  );

  const follow = await reprompt({
    method: 'fortune',
    result: unknownTime,
    question: '如果重点看感情人际方面呢？',
    prompt: { topic: 'relationship', detailMode: 'full' },
  });
  assert.match(follow.prompt.text, /感情人际/);
  assert.match(follow.prompt.text, /如果重点看感情人际方面呢/);

  const unknownTimeCareer = await calculate('fortune', {
    scope: 'monthly',
    target: { year: 2026, month: 11 },
    birth: {
      year: 1992,
      month: 8,
      day: 12,
      clock: { kind: 'unknown' },
      timezone: 8,
    },
    gender: 'male',
    caseName: '未知时辰示例',
    question: '切换关注主题不应该改变本地评分概览',
    prompt: { topic: 'career', detailMode: 'full' },
  }) as any;
  assert.deepEqual(unknownTimeCareer.data.overview, unknownTime.data.overview);

  const tampered = structuredClone(unknownTime);
  tampered.data.overview.overallScore = 10;
  await assert.rejects(
    () => reprompt({ method: 'fortune', result: tampered, question: '追问' }),
    /运势结果与保存的输入资料不一致/,
  );
});

test('月运与年运独立按月度/年度节律评分，不混用单日建除值神，且月历逐日评分与日运一致', async () => {
  const monthly = await calculate('fortune', {
    scope: 'monthly',
    target: { year: 2026, month: 11 },
    question: '查看月运独立评分',
  }) as any;

  assert.equal(typeof monthly.data.timeline.days[0].weekdayIndex, 'number');
  assert.ok(monthly.data.timeline.days[0].weekdayIndex >= 0 && monthly.data.timeline.days[0].weekdayIndex <= 6);
  assert.ok(monthly.data.overview.scoreFactors.some((f: any) => f.label.startsWith('本月')));
  assert.ok(!monthly.data.overview.scoreFactors.some((f: any) => f.label.startsWith('建除十二神')));

  const yearly = await calculate('fortune', {
    scope: 'yearly',
    target: { year: 2026 },
    question: '查看年运独立评分',
  }) as any;

  assert.ok(yearly.data.overview.scoreFactors.some((f: any) => f.label.startsWith('全年')));
  assert.ok(!yearly.data.overview.scoreFactors.some((f: any) => f.label.startsWith('建除十二神')));
  assert.doesNotMatch(yearly.prompt.text, /建除与值神/);
  assert.match(yearly.prompt.text, /全年流月分布/);
});
