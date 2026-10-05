import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWuyunLiuqi,
  evaluateWuyunLiuqiPathomechanism,
  formatWuyunLiuqiFacts,
  buildWuyunLiuqiPrompt,
} from '@core/wuyun-liuqi';
import { TimeManager } from '../packages/core/src/calendar/timeManager';

// 只缓存显式年干支的只读计算结果；公历年与时区覆盖测试保持独立计算。
const wuyunResultCache = new Map<string, ReturnType<typeof calculateWuyunLiuqi>>();

const getCachedWuyunLiuqi = (yearGanZhi: string) => {
  const cached = wuyunResultCache.get(yearGanZhi);
  if (cached) return cached;
  const result = calculateWuyunLiuqi({ yearGanZhi });
  wuyunResultCache.set(yearGanZhi, result);
  return result;
};

// ===== 公历年与节气边界 =====

// 香港天文台2026年历及2027年大寒：五运按《运气要诀》节后序日换算。
// https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2026.pdf
// https://www.hko.gov.hk/en/gts/astron2026/files/2026cal03.pdf （春分 3 月 20 日 22:46）
// https://www.hko.gov.hk/tc/gts/astron2027/files/2027SolarTerms24.pdf
test('五运六气2026年公历边界符合独立年历，六步时界保留现代节气交节口径', () => {
  const result = calculateWuyunLiuqi({ year: 2026 });
  assert.deepEqual(
    result.movementSteps.map((step) => [step.gregorianStart, step.gregorianEnd]),
    [
      ['2026-01-20', '2026-04-01'],
      ['2026-04-02', '2026-06-14'],
      ['2026-06-15', '2026-08-29'],
      ['2026-08-30', '2026-11-10'],
      ['2026-11-11', '2027-01-19'],
    ],
  );
  assert.deepEqual(
    result.qiSteps.map((step) => [step.gregorianStart, step.gregorianEnd]),
    [
      ['2026-01-20', '2026-03-20'],
      ['2026-03-20', '2026-05-21'],
      ['2026-05-21', '2026-07-23'],
      ['2026-07-23', '2026-09-23'],
      ['2026-09-23', '2026-11-22'],
      ['2026-11-22', '2027-01-20'],
    ],
  );
  const original = structuredClone(result);
  const facts = formatWuyunLiuqiFacts(result);
  const native = buildWuyunLiuqiPrompt(result);
  assert.equal(native, result.prompt);
  const restored = JSON.parse(JSON.stringify(result));
  assert.equal(formatWuyunLiuqiFacts(restored), facts);
  assert.equal(buildWuyunLiuqiPrompt(restored), native);
  for (const mutate of [
    (data: typeof result) => {
      data.movementSteps[1].gregorianStart = '2026-01-01';
    },
    (data: typeof result) => {
      data.qiSteps[0].boundaryTime!.endBeijingExclusive = '2099-01-01 00:00:00';
    },
  ]) {
    const changed = structuredClone(result);
    mutate(changed);
    const changedBeforeFormatting = structuredClone(changed);
    assert.equal(formatWuyunLiuqiFacts(changed), facts);
    assert.equal(buildWuyunLiuqiPrompt(changed), native);
    assert.deepEqual(changed, changedBeforeFormatting);
  }
  const omitted = structuredClone(result);
  for (const step of omitted.movementSteps) {
    delete step.gregorianStart;
    delete step.gregorianEnd;
  }
  for (const step of omitted.qiSteps) {
    delete step.gregorianStart;
    delete step.gregorianEnd;
    delete step.boundaryTime;
  }
  const omittedBeforeFormatting = structuredClone(omitted);
  const omittedFacts = facts
    .replace(/^运气年度：.*$/m, '运气年度：大寒节令起，至次年大寒节令前')
    .replace(/；公历\d{4}-\d{2}-\d{2}至\d{4}-\d{2}-\d{2}/g, '')
    .replace(/；现代节气交节参考（北京时间）[^）]+前/g, '');
  const omittedNative = native.replace(facts, omittedFacts);
  assert.equal(formatWuyunLiuqiFacts(omitted), omittedFacts);
  assert.equal(buildWuyunLiuqiPrompt(omitted), omittedNative);
  assert.deepEqual(omitted, omittedBeforeFormatting);
  const stemOnly = structuredClone(omitted);
  stemOnly.input = { yearGanZhi: '丙午', yearGanZhiSource: '明确年干支' };
  stemOnly.calendarDateStatus = '节令边界';
  const stemOnlyBeforeFormatting = structuredClone(stemOnly);
  const stemOnlyFacts = omittedFacts.replace('（公历 2026 年对应的运气年度）', '');
  assert.equal(formatWuyunLiuqiFacts(stemOnly), stemOnlyFacts);
  assert.equal(buildWuyunLiuqiPrompt(stemOnly), omittedNative.replace(omittedFacts, stemOnlyFacts));
  assert.deepEqual(stemOnly, stemOnlyBeforeFormatting);
  assert.deepEqual(result, original);
  try {
    TimeManager.setTimezoneOffsetMinutesOverride(-480);
    const shifted = calculateWuyunLiuqi({ year: 2026 });
    assert.deepEqual(shifted.movementSteps, result.movementSteps);
    assert.deepEqual(shifted.qiSteps, result.qiSteps);
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
  const first = result.qiSteps[0].boundaryTime;
  const second = result.qiSteps[1].boundaryTime;
  assert.ok(first && second);
  assert.equal(first.endTimestampExclusive, second.startTimestamp);
  assert.equal(first.endBeijingExclusive, second.startBeijing);
  assert.equal(result.qiSteps[0].gregorianEnd, '2026-03-20');
  assert.equal(result.qiSteps[1].gregorianStart, '2026-03-20');
  assert.ok(first.endTimestampExclusive > Date.parse('2026-03-20T00:00:00+08:00'));
  assert.ok(
    result.prompt.includes(
      `初之气（大寒、立春、雨水、惊蛰；现代节气交节参考（北京时间）${first.startBeijing}至${first.endBeijingExclusive}前）`,
    ),
  );
  assert.ok(
    result.prompt.includes(
      `二之气（春分、清明、谷雨、立夏；现代节气交节参考（北京时间）${second.startBeijing}至${second.endBeijingExclusive}前）`,
    ),
  );
  assert.match(second.startBeijing, /^2026-03-20 \d{2}:\d{2}:\d{2}$/);
  assert.ok(second.startTimestamp > Date.parse('2026-03-19T16:00:00Z'));
  assert.ok(second.startTimestamp < Date.parse('2026-03-20T16:00:00Z'));
  assert.match(result.prompt, /运气年度：2026-01-20 .*大寒节令起，至2027-01-20 .*次年大寒节令前/u);
  assert.match(result.prompt, /初之气.*现代节气交节参考（北京时间）2026-01-20 .*至2026-03-20 /u);
  assert.match(result.prompt, /二之气.*现代节气交节参考（北京时间）2026-03-20 /u);
  assert.doesNotMatch(result.prompt, /年中落在此步|\d{2}:\d{2}:\d{2}交接/u);
  assert.match(result.limitations.join('；'), /并非传统六气交司时刻/u);
});

test('五运六气支持的300个公历年五运日期连续且六气交节日期覆盖时段', () => {
  const day = (value: string | undefined) => {
    assert.ok(value);
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    assert.ok(Number.isFinite(timestamp), value);
    return timestamp / 86_400_000;
  };
  let previousEnd: number | undefined;
  let previousQiEnd: number | undefined;
  for (let year = 1900; year <= 2199; year += 1) {
    const result = calculateWuyunLiuqi({ year });
    for (let index = 0; index < result.movementSteps.length; index += 1) {
      const step = result.movementSteps[index];
      const start = day(step.gregorianStart);
      const end = day(step.gregorianEnd);
      assert.ok(end >= start, `${year}年第${index + 1}运`);
      if (index > 0) assert.equal(start, day(result.movementSteps[index - 1].gregorianEnd) + 1);
    }
    result.qiSteps.forEach((step, index) => {
      const range = step.boundaryTime;
      assert.ok(range, `${year}年第${index + 1}步缺少交节时界`);
      assert.ok(range.endTimestampExclusive > range.startTimestamp);
      const beijingDate = (timestamp: number) =>
        new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 10);
      assert.equal(step.gregorianStart, beijingDate(range.startTimestamp));
      assert.equal(step.gregorianEnd, beijingDate(range.endTimestampExclusive - 1));
      assert.ok(day(step.gregorianEnd) >= day(step.gregorianStart));
      if (index > 0) {
        assert.equal(
          range.startTimestamp,
          result.qiSteps[index - 1].boundaryTime?.endTimestampExclusive,
        );
      }
    });
    if (previousQiEnd !== undefined) {
      assert.equal(result.qiSteps[0].boundaryTime?.startTimestamp, previousQiEnd);
    }
    previousQiEnd = result.qiSteps[5].boundaryTime?.endTimestampExclusive;
    const start = day(result.movementSteps[0].gregorianStart);
    const end = day(result.movementSteps[4].gregorianEnd);
    assert.equal(start, day(result.qiSteps[0].gregorianStart));
    assert.ok(day(result.qiSteps[5].gregorianEnd) >= end);
    if (previousEnd !== undefined) assert.equal(start, previousEnd + 1);
    assert.ok([365, 366].includes(end - start + 1), String(year));
    previousEnd = end;
  }
});

// ===== 平气条件与六十甲子 =====

test('平气条件覆盖古今医统大全司天制运六年及同气相佐例', () => {
  for (const yearGanZhi of ['戊辰', '戊戌', '庚子', '庚午', '庚寅', '庚申']) {
    const result = getCachedWuyunLiuqi(yearGanZhi).pathomechanism!;
    assert.equal(result.pingQiType, '具平气条件');
    assert.match(result.pingQiConditions.join('；'), /司天制约/);
    assert.match(result.pingQiBasis, yearGanZhi[0] === '戊' ? /升明之纪/ : /审平之纪/);
  }
  for (const yearGanZhi of ['辛亥', '癸巳']) {
    const result = getCachedWuyunLiuqi(yearGanZhi).pathomechanism!;
    assert.match(result.pingQiConditions.join('；'), /同气相佐/);
  }
});

test('六十年逐一保留太过不及之纪并区别年层条件与实际平气', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const regimes = ['敦阜', '从革', '流衍', '委和', '赫曦', '卑监', '坚成', '涸流', '发生', '伏明'];
  const conditions = new Set(
    '戊辰 戊戌 庚子 庚午 庚寅 庚申 丁卯 己丑 己未 乙酉 辛丑 辛未 癸卯 癸酉 癸巳 癸亥 辛亥 乙卯 丁巳 丁亥 乙丑 乙未 辛卯 辛酉'.split(
      ' ',
    ),
  );
  for (let i = 0; i < 60; i++) {
    const yearGanZhi = stems[i % 10] + branches[i % 12];
    const result = getCachedWuyunLiuqi(yearGanZhi).pathomechanism!;
    assert.equal(result.isPingQi, null, yearGanZhi);
    assert.equal(result.movementRegime, `${regimes[i % 10]}之纪`, yearGanZhi);
    assert.equal(result.pingQiConditions.length > 0, conditions.has(yearGanZhi), yearGanZhi);
  }
});

test('运气要诀不及得助包含司天同气及相生，太过同气不混作资助', () => {
  for (const yearGanZhi of ['乙卯', '乙酉', '丁巳', '丁亥', '己丑', '己未']) {
    const result = getCachedWuyunLiuqi(yearGanZhi).pathomechanism!;
    assert.match(result.pingQiConditions.join('；'), /司天与.运同气，资助岁运不及/);
    assert.equal(result.isPingQi, null);
  }
  for (const yearGanZhi of ['乙丑', '乙未', '辛卯', '辛酉', '癸巳', '癸亥']) {
    const result = getCachedWuyunLiuqi(yearGanZhi).pathomechanism!;
    assert.match(result.pingQiConditions.join('；'), /司天生.运，资助岁运不及/);
    assert.equal(result.isPingQi, null);
  }
  for (const yearGanZhi of ['丙辰', '丙戌', '戊子', '戊午', '戊寅', '戊申']) {
    assert.doesNotMatch(
      getCachedWuyunLiuqi(yearGanZhi).pathomechanism!.pingQiConditions.join('；'),
      /资助岁运不及/,
    );
  }
});

// ===== 司天病机资料与输入边界 =====

test('六组司天所胜资料保留病本脏腑与治则条件，不混入在泉内淫段', () => {
  // 识典《素问·至真要大论》司天所胜段第10、11段。
  const rows = [
    ['乙巳', '厥阴司天，风淫所胜', '脾', '平以辛凉，佐以苦甘'],
    ['丙午', '少阴司天，热淫所胜', '肺', '平以咸寒，佐以苦甘'],
    ['丁未', '太阴司天，湿淫所胜', '肾', '平以苦热，佐以酸辛'],
    ['戊申', '少阳司天，火淫所胜', '肺', '平以酸冷，佐以苦甘'],
    ['己酉', '阳明司天，燥淫所胜', '肝', '平以苦湿，佐以酸辛'],
    ['庚戌', '太阳司天，寒淫所胜', '心', '平以辛热，佐以甘苦'],
  ];
  for (const [yearGanZhi, condition, organ, treatment] of rows) {
    const result = getCachedWuyunLiuqi(yearGanZhi).pathomechanism!;
    assert.equal(result.classicalReference.condition, condition);
    assert.equal(result.classicalReference.conditionEstablished, null);
    assert.equal(result.affectedZangFu, `${condition}时，原文称“病本于${organ}”。`);
    assert.ok(result.climaticPathology.startsWith(`${condition}的病候摘录：`));
    assert.ok(result.treatmentGuideline.startsWith(`${condition}的传统治则摘录：`));
    assert.ok(result.treatmentGuideline.includes(treatment));
    assert.doesNotMatch(result.summary, /病本|温补|脏腑|失眠/);
  }
});

test('病机资料入口拒绝未知司天及与年份矛盾的资料', () => {
  const base = getCachedWuyunLiuqi('庚午');
  const input = {
    yearGanZhi: base.input.yearGanZhi,
    annualMovement: base.annualMovement,
    sitian: base.sitian,
    annualConformities: base.annualConformities,
  };
  assert.doesNotThrow(() => evaluateWuyunLiuqiPathomechanism(input));
  for (const field of ['name', 'element', 'phase', 'qi'] as const) {
    const bad = structuredClone(input);
    Object.assign(bad.sitian, { [field]: '未知' });
    assert.throws(() => evaluateWuyunLiuqiPathomechanism(bad), /司天/);
  }
  for (const field of ['stem', 'element', 'strength', 'yinYang'] as const) {
    const bad = structuredClone(input);
    Object.assign(bad.annualMovement, { [field]: '未知' });
    assert.throws(() => evaluateWuyunLiuqiPathomechanism(bad), /岁运/);
  }
  for (const field of ['suihui', 'tongSuihui'] as const) {
    const bad = structuredClone(input);
    bad.annualConformities[field] = !bad.annualConformities[field];
    assert.throws(() => evaluateWuyunLiuqiPathomechanism(bad), /符会/);
  }
  assert.throws(() => evaluateWuyunLiuqiPathomechanism({ ...input, yearGanZhi: 'constructor' }));

  // 年层参考条件不确定实际平气或本年病候；返回资料也须保留这一确定度。
  assert.equal(base.pathomechanism!.isPingQi, null);
  assert.equal(base.pathomechanism!.classicalReference.conditionEstablished, null);
  for (const mutate of [
    (data: typeof base) => {
      assert.equal(Reflect.set(data.pathomechanism!, 'isPingQi', true), true);
      assert.equal(Reflect.get(data.pathomechanism!, 'isPingQi'), true);
    },
    (data: typeof base) => {
      assert.equal(
        Reflect.set(data.pathomechanism!.classicalReference, 'conditionEstablished', true),
        true,
      );
      assert.equal(
        Reflect.get(data.pathomechanism!.classicalReference, 'conditionEstablished'),
        true,
      );
    },
  ]) {
    const bad = structuredClone(base);
    mutate(bad);
    assert.notDeepEqual(bad.pathomechanism, base.pathomechanism);
    assert.throws(() => formatWuyunLiuqiFacts(bad), /平气及岁运纪/);
    assert.throws(() => buildWuyunLiuqiPrompt(bad), /平气及岁运纪/);
  }
});
