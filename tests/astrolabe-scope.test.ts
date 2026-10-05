import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstrolabeFullScopeContexts,
  buildAstrolabeScopeContext,
  calculateSecondaryProgressionEvidence,
  calculateSolarArcEvidence,
  calculateSolarReturnEvidence,
  getDefaultAstrolabeScopeDate,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { projectAstrolabeDynamicSample } from 'mingyu-core/divination/astrolabe-dynamic-range';
import { calculateChart, calculatePlanets } from '../packages/core/src/astrology/engine';
import type { AstrolabeData } from 'mingyu-core/types';

const astrolabeData = generateAstrolabe({
  name: '本人',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
});

const secondPrecisionAstrolabeData = generateAstrolabe({
  name: '本人',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  second: '37',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
});

// 同参证据及上下文只计算一次；各测试取得独立副本。
const sharedSolarReturn2028 = calculateSolarReturnEvidence(astrolabeData, 2028);
const sharedYearly2028WithoutEvents = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028', {
  includePeriodEvents: false,
});
const sharedFullContextsJune2028 = buildAstrolabeFullScopeContexts(astrolabeData, '2028-06-01');

type AdvancedEvidence =
  | ReturnType<typeof calculateSolarReturnEvidence>
  | ReturnType<typeof calculateSecondaryProgressionEvidence>
  | ReturnType<typeof calculateSolarArcEvidence>;

const SCOPE_PLANET_OPTIONS = {
  includeAsteroids: false,
  includeChiron: false,
  includeLilith: false,
  includeNodes: true,
  includeLots: false,
};

function normalizeLongitude(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function longitudeDistance(first: number, second: number) {
  const raw = Math.abs(normalizeLongitude(first) - normalizeLongitude(second));
  return raw > 180 ? 360 - raw : raw;
}

function calculateIndependentPlanets(data: AstrolabeData, pseudoUtcDate: Date, timezone: number) {
  return calculatePlanets(
    {
      year: pseudoUtcDate.getUTCFullYear(),
      month: pseudoUtcDate.getUTCMonth() + 1,
      day: pseudoUtcDate.getUTCDate(),
      hour: pseudoUtcDate.getUTCHours(),
      minute: pseudoUtcDate.getUTCMinutes(),
      second: pseudoUtcDate.getUTCSeconds(),
      timezone,
      latitude: data.birth.latitude!,
      longitude: data.birth.longitude!,
    },
    SCOPE_PLANET_OPTIONS,
  );
}

function calculateIndependentPlanetsAtIso(data: AstrolabeData, dateTime: string) {
  const date = new Date(dateTime);
  assert.equal(Number.isNaN(date.getTime()), false, `无效的推进时间：${dateTime}`);
  return calculateIndependentPlanets(data, date, 0);
}

function parseWallClockDateTime(dateTime: string) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(dateTime);
  if (!matched) throw new Error(`无效的返照当地时间：${dateTime}`);
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
    hour: Number(matched[4]),
    minute: Number(matched[5]),
    second: Number(matched[6]),
  };
}

function calculateIndependentPlanetsAtWallClock(
  data: AstrolabeData,
  dateTime: string,
  timezone: number,
  offsetSeconds = 0,
) {
  const parts = parseWallClockDateTime(dateTime);
  const pseudoUtcDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) +
      offsetSeconds * 1000,
  );
  return calculateIndependentPlanets(data, pseudoUtcDate, timezone);
}

function assertAdvancedEvidenceReferences(evidence: AdvancedEvidence) {
  const stepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(evidence.limitationFacts.length > 0);
  assert.ok(evidence.aspectSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    evidence.aspectFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.length > 0 &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.length > 0 &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
}

test('星盘当前参考日按统一时区生成各层日期', () => {
  const now = new Date('2026-09-11T23:30:00-07:00');

  assert.equal(getDefaultAstrolabeScopeDate('natal', now), '');
  assert.equal(getDefaultAstrolabeScopeDate('yearly', now), '2026');
  assert.equal(getDefaultAstrolabeScopeDate('monthly', now), '2026-09');
  assert.equal(getDefaultAstrolabeScopeDate('daily', now), '2026-09-12');
  assert.equal(getDefaultAstrolabeScopeDate('full', now), '2026-09-12');
});

test('星盘本命分析对象只写入本命资料', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'natal', '2028-06-01');

  assert.equal(context.displayText, '仅使用本命信息');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘。/);
  assert.doesNotMatch(context.promptText, /宫主星落宫/);
  assert.doesNotMatch(context.promptText, /不得|资料范围|时间边界|证据/);
  assert.doesNotMatch(context.promptText, /行运落宫：/);
});

test('本命宫头重复或宫序缺口时不投影行运落宫', () => {
  const valid = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-01', {
    includePeriodEvents: false,
  });
  assert.equal(valid.transitHouseFacts?.status, '有效');
  assert.ok(valid.transitHouseFacts?.facts.some((fact) => fact.natalHouse !== null));

  const duplicateCusp = structuredClone(astrolabeData) as AstrolabeData;
  duplicateCusp.houses[1].longitude = duplicateCusp.houses[0].longitude;
  const duplicateResult = buildAstrolabeScopeContext(duplicateCusp, 'daily', '2028-06-01', {
    includePeriodEvents: false,
  });
  assert.equal(duplicateResult.transitHouseFacts?.status, '资料不足');
  assert.ok(
    duplicateResult.transitFacts?.facts.every((fact) => fact.transiting.natalHouse === null),
  );
  assert.match(duplicateResult.promptText, /行运落宫：本命宫头资料不足/);

  const missingHouse = structuredClone(astrolabeData) as AstrolabeData;
  missingHouse.houses[0].house = 2;
  const missingResult = buildAstrolabeScopeContext(missingHouse, 'daily', '2028-06-01', {
    includePeriodEvents: false,
  });
  assert.equal(missingResult.transitHouseFacts?.status, '资料不足');
});

test('星盘范围可显式跳过周期事件计算而保留基础与高级事实', () => {
  const context = structuredClone(sharedYearly2028WithoutEvents);

  assert.equal(context.periodEvents, undefined);
  assert.equal(context.periodBatch, undefined);
  assert.match(context.promptText, /太阳返照有效期/);
  assert.match(context.promptText, /次限相位：/);
  assert.match(context.promptText, /太阳弧相位：/);
  assert.doesNotMatch(context.promptText, /周期关键星象/);
});

test('星盘完整输出版显示完整行运资料摘要', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'full', '2028-06-01');

  assert.equal(context.scope, 'full');
  assert.equal(context.displayText, '本命盘与完整行运资料 · 2028-06-01');
  assert.equal(context.dateStr, '2028-06-01');
  assert.match(context.promptText, /以2028-06-01为基准的完整行运资料/);
  assert.doesNotMatch(context.promptText, /宫主星落宫/);

  const contexts = structuredClone(sharedFullContextsJune2028);
  assert.equal(contexts.yearly.dateStr, '2028');
  assert.equal(contexts.monthly.dateStr, '2028-06');
  assert.equal(contexts.daily.dateStr, '2028-06-01');
  assert.match(contexts.yearly.promptText, /太阳返照有效期/);
  assert.match(contexts.yearly.promptText, /次限相位：/);
  assert.match(contexts.yearly.promptText, /太阳弧相位：/);
});

test('星盘流年分析对象会生成行运证据和展示文本', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');

  assert.equal(context.displayText, '流年 · 2028');
  assert.equal(context.dateStr, '2028');
  assert.match(context.promptText, /分析对象：流年2028。/);
  assert.doesNotMatch(context.promptText, /宫主星落宫/);
  assert.match(context.promptText, /行运取样：2028-07-01 12:00（UTC\+08:00）/);
  assert.match(context.promptText, /主要行运相位：/);
  const sampledAspects = context.promptText
    .split('\n')
    .filter((line) => /^(主要行运相位|其余取样相位|取样相位明细)：/.test(line))
    .flatMap((line) =>
      line
        .slice(line.indexOf('：') + 1)
        .replace(/。$/, '')
        .split('；'),
    );
  assert.ok(sampledAspects.length > 6, '固定流年样本应保留重点以外的取样相位');
  assert.equal(new Set(sampledAspects).size, sampledAspects.length, '每条取样相位只列示一次');
  assert.match(context.promptText, /行运落宫：/);
  assert.match(context.promptText, /周期关键星象（2028-01-01 00:00至2029-01-01 00:00，共\d+项）。/);
  assert.ok(context.periodEvents!.axis.length > 0);
  for (const event of context.periodEvents!.events) {
    assert.equal(context.promptText.split(`${event.dateTime} ${event.promptText}`).length - 1, 1);
  }
  assert.doesNotMatch(context.promptText, /周期主轴：|具体时刻见|具体星象见/);
  assert.match(context.promptText, /完整明细：/);
  assert.match(context.promptText, /太阳返照有效期.+：/);
  assert.match(context.promptText, /次限相位：/);
  assert.match(context.promptText, /太阳弧相位：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.doesNotMatch(context.promptText, /次限推进：|太阳弧：\d|行运基准：/);
  assert.doesNotMatch(context.promptText, /计算链|证据汇总|解释限制|时间边界|不得|不代表/);
  assert.equal(context.solarReturnEvidence?.status, 'exact');
  assert.equal(context.secondaryProgressionEvidence?.status, 'calculated');
  assert.equal(context.solarArcEvidence?.status, 'calculated');
});

test('星盘周期批次只在首批生成固定范围事实并保留续批身份', () => {
  const first = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028', {
    periodBatch: {
      start: { year: 2028, month: 1, day: 1 },
      endExclusive: { year: 2028, month: 2, day: 1 },
    },
  });
  const continuation = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028', {
    periodBatch: {
      start: { year: 2028, month: 2, day: 1 },
      endExclusive: { year: 2028, month: 3, day: 1 },
    },
    includeScopeFacts: false,
  });

  assert.equal(first.periodBatch?.includesScopeFacts, true);
  assert.equal(first.periodBatch?.range.startDate, '2028-01-01');
  assert.equal(first.periodBatch?.range.endDate, '2028-02-01');
  assert.equal(first.periodBatch?.nextRange?.startDate, '2028-02-01');
  assert.equal(continuation.periodBatch?.includesScopeFacts, false);
  assert.equal(continuation.periodBatch?.range.startDate, '2028-02-01');
  assert.equal(continuation.solarReturnEvidence, undefined);
  assert.equal(continuation.secondaryProgressionEvidence, undefined);
  assert.equal(continuation.solarArcEvidence, undefined);
  assert.doesNotMatch(continuation.promptText, /太阳返照有效期|次限相位：|太阳弧相位：/);
  assert.match(continuation.promptText, /本批周期范围：2028-02-01至2028-03-01/);
  assert.ok(continuation.periodEvents);
  assert.throws(
    () =>
      buildAstrolabeScopeContext(astrolabeData, 'full', '2028-06-01', {
        periodBatch: {
          start: { year: 2028, month: 6, day: 1 },
          endExclusive: { year: 2028, month: 7, day: 1 },
        },
      }),
    /仅支持流年、流月或流日/,
  );
});

test('太阳返照应返回可复核的求根过程和精度边界', () => {
  const evidence = structuredClone(sharedSolarReturn2028);

  assert.equal(evidence.status, 'exact');
  assert.match(evidence.dateTime ?? '', /^2028-05-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.ok((evidence.residualDegrees ?? 1) < 0.001);
  assert.equal(evidence.coarseStepHours, 2);
  assert.equal(evidence.refinementToleranceMinutes, 1 / 60);
  assert.ok(evidence.refinementIterations > 0);
  assert.match(evidence.source, /二分法/);
  assert.equal(evidence.timeScale?.utcDateTime.endsWith('Z'), true);
  assert.ok((evidence.timeScale?.julianDayTtApprox ?? 0) > 2400000);
  assert.ok(evidence.limitations.some((item) => item.includes('观测级精度')));
  assert.ok(evidence.summaryFact.factKeys.includes(evidence.timeScale?.summaryFact.key ?? ''));
  assertAdvancedEvidenceReferences(evidence);

  const secondOffsetData = structuredClone(astrolabeData) as AstrolabeData;
  delete secondOffsetData.birth.timeZoneId;
  secondOffsetData.birth.timezone = 4 + (51 * 60 + 16) / 3600;
  const secondOffsetEvidence = calculateSolarReturnEvidence(secondOffsetData, 2028);
  assert.match(secondOffsetEvidence.promptText, /UTC\+04:51:16/);
});

test('太阳返照应返回出生地完整返照盘及两层主要相位', () => {
  const evidence = structuredClone(sharedSolarReturn2028);
  const returnChart = evidence.returnChart;
  assert.ok(returnChart);
  assert.deepEqual(
    returnChart.planets.map((point) => point.name),
    ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
  );
  assert.deepEqual(
    returnChart.angles.map((point) => point.name),
    ['Ascendant', 'Descendant', 'Midheaven', 'Imum Coeli'],
  );
  assert.deepEqual(
    returnChart.houses.map((cusp) => cusp.house),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.equal(returnChart.location.source, '出生地');
  assert.equal(returnChart.location.latitude, astrolabeData.birth.latitude);
  assert.equal(returnChart.location.longitude, astrolabeData.birth.longitude);
  assert.equal(returnChart.houseSystem, 'placidus');
  assert.ok(returnChart.planets.every((point) => point.house >= 1 && point.house <= 12));
  assert.ok(returnChart.internalAspectFacts.length > 0);
  assert.deepEqual(returnChart.natalAspectFacts, evidence.candidateAspectFacts);

  const utc = new Date(evidence.timeScale!.unixMilliseconds);
  const independentChart = calculateChart({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    hour: utc.getUTCHours(),
    minute: utc.getUTCMinutes(),
    second: utc.getUTCSeconds(),
    timezone: 0,
    latitude: astrolabeData.birth.latitude,
    longitude: astrolabeData.birth.longitude,
  });
  for (const point of returnChart.planets) {
    const independent = independentChart.planets.find((item) => item.name === point.name);
    assert.ok(independent);
    assert.ok(longitudeDistance(point.longitude, independent.longitude) < 0.000001);
  }
  for (const fact of returnChart.internalAspectFacts) {
    const first = [...returnChart.planets, ...returnChart.angles].find(
      (point) => point.key === fact.firstPointKey,
    );
    const second = [...returnChart.planets, ...returnChart.angles].find(
      (point) => point.key === fact.secondPointKey,
    );
    assert.ok(first && second);
    assert.ok(
      Math.abs(longitudeDistance(first.longitude, second.longitude) - fact.actualAngle) < 0.000001,
    );
    assert.ok(fact.deviation <= fact.allowedOrb);
  }
  const prompt = structuredClone(sharedYearly2028WithoutEvents).promptText;
  assert.ok(prompt.includes(returnChart.promptText));
  assert.match(prompt, /返照盘（出生地/);
  const firstAspect = evidence.aspectFacts[0];
  assert.ok(firstAspect);
  const firstAspectText = `${firstAspect.movingPoint}${firstAspect.aspectName}${firstAspect.natalPoint}（偏差${firstAspect.deviation.toFixed(2)}°，${firstAspect.closeness}）`;
  assert.ok(returnChart.promptText.includes(firstAspectText));
  const periodLine = prompt
    .split('\n')
    .find((line) => line.includes(`返照时刻${evidence.dateTime}`));
  assert.ok(periodLine);
  assert.ok(!periodLine.includes(firstAspectText));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(returnChart)));
});

test('流年覆盖返照前后两期，完整输出按参考日推进次限与太阳弧', () => {
  const january = buildAstrolabeFullScopeContexts(astrolabeData, '2028-01-15', {
    includePeriodEvents: false,
  }).yearly;
  const september = buildAstrolabeFullScopeContexts(astrolabeData, '2028-09-15', {
    includePeriodEvents: false,
  }).yearly;
  const periods = january.solarReturnPeriods!;
  assert.equal(periods.length, 2);
  assert.deepEqual(
    periods.map((period) => period.evidence.targetYear),
    [2027, 2028],
  );
  assert.equal(periods[0].endUtcDateTime, periods[1].startUtcDateTime);
  assert.equal(periods.find((period) => period.isReferencePeriod)?.evidence.targetYear, 2027);
  assert.equal(
    september.solarReturnPeriods?.find((period) => period.isReferencePeriod)?.evidence.targetYear,
    2028,
  );
  assert.ok(january.promptText.includes('太阳返照有效期'));
  assert.ok(january.promptText.includes('次限与太阳弧取样：2028-01-15'));
  assert.ok(september.promptText.includes('次限与太阳弧取样：2028-09-15'));
  assert.ok(
    january.secondaryProgressionEvidence!.age! < september.secondaryProgressionEvidence!.age!,
  );
  assert.ok(january.solarArcEvidence!.arcDegrees! < september.solarArcEvidence!.arcDegrees!);
});

test('元旦附近生日的返照有效期完整覆盖目标日历年', () => {
  const januaryBirth = generateAstrolabe({
    name: '元旦生日',
    gender: '女',
    year: '2000',
    month: '1',
    day: '1',
    hour: '12',
    minute: '0',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });
  const periods = buildAstrolabeScopeContext(januaryBirth, 'yearly', '2028', {
    includePeriodEvents: false,
  }).solarReturnPeriods!;
  assert.ok(periods.length >= 1);
  assert.equal(periods[0].startsAt, '2028-01-01 00:00:00');
  assert.equal(periods.at(-1)?.endsAt, '2029-01-01 00:00:00');
  for (let index = 1; index < periods.length; index += 1) {
    assert.equal(periods[index - 1].endUtcDateTime, periods[index].startUtcDateTime);
  }
});

test('2200 年末已发生的次年返照应截断本年返照有效期', () => {
  const januaryBirth = generateAstrolabe({
    name: '返照年度上界',
    gender: '女',
    year: '2000',
    month: '1',
    day: '1',
    hour: '0',
    minute: '0',
    latitude: '0',
    longitude: '0',
    timezone: '0',
  });
  const context = buildAstrolabeScopeContext(januaryBirth, 'yearly', '2200', {
    includePeriodEvents: false,
  });
  const periods = context.solarReturnPeriods!;
  assert.deepEqual(
    periods.map((period) => period.evidence.targetYear),
    [2200, 2201],
  );
  assert.equal(periods[0].startUtcDateTime, '2200-01-01T00:00:00.000Z');
  assert.equal(periods[0].endUtcDateTime, periods[1].startUtcDateTime);
  assert.equal(periods[1].endUtcDateTime, '2201-01-01T00:00:00.000Z');
  assert.ok(
    Math.abs(Date.parse(periods[1].startUtcDateTime) - Date.parse('2200-12-31T18:54:27Z')) <= 1000,
  );
  const natalSun = januaryBirth.planets.find((planet) => planet.name === 'Sun')!;
  const returnSun = calculateIndependentPlanetsAtIso(
    januaryBirth,
    periods[1].startUtcDateTime,
  ).find((planet) => planet.name === 'Sun')!;
  assert.ok(longitudeDistance(returnSun.longitude, natalSun.longitude) < 0.00001);
  assert.ok(context.promptText.includes('返照时刻2200-12-31 18:54:27'));
  const projected = projectAstrolabeDynamicSample({ natal: januaryBirth, scopes: [context] });
  assert.equal(
    projected.samples.find((fact) => fact.path === 'dynamic.yearly.returnPeriods.2201.startUtc')
      ?.value,
    Date.parse(periods[1].startUtcDateTime),
  );
  assert.throws(() => calculateSolarReturnEvidence(januaryBirth, 2201), /1900-2200/u);
});

test('返照年度起点采用 IANA 当地公历日真实首瞬时点', () => {
  const data = generateAstrolabe({
    name: '几内亚比绍命例',
    gender: '女',
    year: '1960',
    month: '5',
    day: '20',
    hour: '12',
    minute: '0',
    latitude: '11.8636',
    longitude: '-15.5977',
    timeZoneId: 'Africa/Bissau',
  });
  const periods = buildAstrolabeScopeContext(data, 'yearly', '1975', {
    includePeriodEvents: false,
  }).solarReturnPeriods!;
  assert.ok(periods.length > 0);
  assert.equal(periods[0].startUtcDateTime, '1975-01-01T01:00:00.000Z');
  assert.equal(periods[0].startsAt, '1975-01-01 01:00:00');
});

test('太阳返照跨目标生日夏令时空洞仍按连续 UTC 求根', () => {
  const newYork = generateAstrolabe({
    name: '夏令时命例',
    gender: '女',
    year: '2000',
    month: '3',
    day: '10',
    hour: '2',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  // 2024-03-10 02:30 在纽约不存在，搜索中心仍是有效 UTC 时刻。
  const evidence = calculateSolarReturnEvidence(newYork, 2024);
  assert.equal(evidence.status, 'exact');
  assert.ok((evidence.residualDegrees ?? 1) < 0.001);
  assert.equal(evidence.timeScale?.localDateTime, evidence.dateTime);
  assert.equal(
    evidence.timeScale?.unixMilliseconds,
    Date.parse(evidence.timeScale!.utcDateTime.replace(' ', 'T')),
  );
  assert.equal(evidence.returnChart?.location.source, '出生地');
});

test('次限与太阳弧从出生 UTC 瞬间推进且采用各自小容许度', () => {
  const newYork = generateAstrolabe({
    name: '推进夏令时命例',
    gender: '男',
    year: '2000',
    month: '3',
    day: '10',
    hour: '2',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const expectedDateTime = '2000-03-20T07:30:00.000Z';
  const secondary = calculateSecondaryProgressionEvidence(newYork, 2010);
  const solarArc = calculateSolarArcEvidence(newYork, 2010);
  assertAdvancedEvidenceReferences(secondary);
  assertAdvancedEvidenceReferences(solarArc);
  assert.equal(secondary.progressedDateTime, expectedDateTime);
  assert.equal(solarArc.progressedDateTime, expectedDateTime);
  const independent = calculateIndependentPlanetsAtIso(newYork, expectedDateTime);
  for (const point of secondary.movingPointFacts) {
    const planet = independent.find((item) => item.name === point.name);
    assert.ok(planet);
    assert.ok(longitudeDistance(point.longitude, planet.longitude) < 0.000001);
  }
  assert.ok(
    secondary.candidateAspectFacts.every(
      (fact) => fact.allowedOrb === (fact.movingPointKey.endsWith(':Moon') ? 1 : 0.5),
    ),
  );
  assert.ok(secondary.candidateAspectFacts.every((fact) => fact.deviation <= fact.allowedOrb));
  assert.ok(
    solarArc.candidateAspectFacts.every((fact) => fact.allowedOrb === 1 && fact.deviation <= 1),
  );
  const expectedArc = normalizeLongitude(
    independent.find((planet) => planet.name === 'Sun')!.longitude -
      newYork.planets.find((planet) => planet.name === 'Sun')!.longitude,
  );
  assert.equal(solarArc.arcDegrees, Number(expectedArc.toFixed(6)));
  const directedNames = [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
    'Ascendant',
    'Midheaven',
    'Descendant',
    'Imum Coeli',
  ];
  assert.deepEqual(
    solarArc.movingPointFacts.map((point) => point.name),
    directedNames,
  );
  for (const point of solarArc.movingPointFacts) {
    const natal = [...newYork.planets, ...newYork.angles].find((item) => item.name === point.name);
    assert.ok(natal);
    assert.ok(
      longitudeDistance(point.longitude, normalizeLongitude(natal.longitude + expectedArc)) <
        0.000001,
    );
  }
});

test('秒级出生时间应由独立星历位置验证次限、太阳弧和太阳返照', () => {
  const targetYear = 1995;
  const minuteSecondary = calculateSecondaryProgressionEvidence(astrolabeData, targetYear);
  const secondSecondary = calculateSecondaryProgressionEvidence(
    secondPrecisionAstrolabeData,
    targetYear,
  );
  const minuteSecondaryPlanets = calculateIndependentPlanetsAtIso(
    astrolabeData,
    minuteSecondary.progressedDateTime!,
  );
  const secondSecondaryPlanets = calculateIndependentPlanetsAtIso(
    secondPrecisionAstrolabeData,
    secondSecondary.progressedDateTime!,
  );
  assert.match(secondSecondary.progressedDateTime ?? '', /T04:30:37\.000Z$/);
  const minuteSecondarySun = minuteSecondaryPlanets.find((planet) => planet.name === 'Sun');
  const secondSecondarySun = secondSecondaryPlanets.find((planet) => planet.name === 'Sun');
  const minuteSecondaryMoon = minuteSecondaryPlanets.find((planet) => planet.name === 'Moon');
  const secondSecondaryMoon = secondSecondaryPlanets.find((planet) => planet.name === 'Moon');
  if (!minuteSecondarySun || !secondSecondarySun || !minuteSecondaryMoon || !secondSecondaryMoon) {
    throw new Error('独立次限星体位置缺少太阳或月亮。');
  }
  assert.ok(longitudeDistance(secondSecondarySun.longitude, minuteSecondarySun.longitude) > 0.0001);
  assert.ok(
    longitudeDistance(secondSecondaryMoon.longitude, minuteSecondaryMoon.longitude) > 0.0001,
  );

  const secondNatalSun = secondPrecisionAstrolabeData.planets.find(
    (planet) => planet.name === 'Sun',
  );
  const secondSunFact = secondSecondary.aspectFacts.find(
    (fact) =>
      fact.movingPoint === '太阳' && fact.natalPoint === '太阳' && fact.aspectName === '合相',
  );
  if (!secondNatalSun || !secondSunFact) {
    throw new Error('年龄为零的次限应保留太阳与本命太阳的合相事实。');
  }
  assert.ok(
    Math.abs(
      secondSunFact.actualAngle -
        longitudeDistance(secondSecondarySun.longitude, secondNatalSun.longitude),
    ) <= 0.000001,
  );

  const minuteSolarArc = calculateSolarArcEvidence(astrolabeData, targetYear);
  const secondSolarArc = calculateSolarArcEvidence(secondPrecisionAstrolabeData, targetYear);
  const minuteSolarArcPlanets = calculateIndependentPlanetsAtIso(
    astrolabeData,
    minuteSolarArc.progressedDateTime!,
  );
  const secondSolarArcPlanets = calculateIndependentPlanetsAtIso(
    secondPrecisionAstrolabeData,
    secondSolarArc.progressedDateTime!,
  );
  assert.match(secondSolarArc.progressedDateTime ?? '', /T04:30:37\.000Z$/);
  const minuteSolarArcSun = minuteSolarArcPlanets.find((planet) => planet.name === 'Sun');
  const secondSolarArcSun = secondSolarArcPlanets.find((planet) => planet.name === 'Sun');
  if (!minuteSolarArcSun || !secondSolarArcSun || !secondNatalSun) {
    throw new Error('独立太阳弧星体位置缺少太阳。');
  }
  const expectedSolarArc = normalizeLongitude(
    secondSolarArcSun.longitude - secondNatalSun.longitude,
  );
  assert.equal(secondSolarArc.arcDegrees, Number(expectedSolarArc.toFixed(6)));
  assert.ok(longitudeDistance(secondSolarArcSun.longitude, minuteSolarArcSun.longitude) > 0.0001);

  const solarReturn = calculateSolarReturnEvidence(secondPrecisionAstrolabeData, 2028);
  if (!solarReturn.dateTime || solarReturn.residualDegrees === undefined || !secondNatalSun) {
    throw new Error('秒级太阳返照缺少时间或太阳残差。');
  }
  const returnSun = calculateIndependentPlanetsAtWallClock(
    secondPrecisionAstrolabeData,
    solarReturn.dateTime,
    solarReturn.timezone,
  ).find((planet) => planet.name === 'Sun');
  const previousReturnSun = calculateIndependentPlanetsAtWallClock(
    secondPrecisionAstrolabeData,
    solarReturn.dateTime,
    solarReturn.timezone,
    -1,
  ).find((planet) => planet.name === 'Sun');
  const nextReturnSun = calculateIndependentPlanetsAtWallClock(
    secondPrecisionAstrolabeData,
    solarReturn.dateTime,
    solarReturn.timezone,
    1,
  ).find((planet) => planet.name === 'Sun');
  if (!returnSun || !previousReturnSun || !nextReturnSun) {
    throw new Error('独立太阳返照回算缺少太阳位置。');
  }
  const returnResidual = longitudeDistance(returnSun.longitude, secondNatalSun.longitude);
  const previousResidual = longitudeDistance(previousReturnSun.longitude, secondNatalSun.longitude);
  const nextResidual = longitudeDistance(nextReturnSun.longitude, secondNatalSun.longitude);
  const returnLocal = parseWallClockDateTime(solarReturn.dateTime);
  const expectedReturnUtc = new Date(
    Date.UTC(
      returnLocal.year,
      returnLocal.month - 1,
      returnLocal.day,
      returnLocal.hour,
      returnLocal.minute,
      returnLocal.second,
    ) -
      solarReturn.timezone * 3600000,
  ).toISOString();
  assert.equal(solarReturn.timeScale?.localDateTime, solarReturn.dateTime);
  assert.equal(
    solarReturn.timeScale?.utcDateTime,
    expectedReturnUtc.replace('T', ' ').replace('.000Z', 'Z'),
  );
  assert.equal(solarReturn.residualDegrees, Number(returnResidual.toFixed(6)));
  assert.ok(returnResidual <= previousResidual + 0.000000001);
  assert.ok(returnResidual <= nextResidual + 0.000000001);
});

test('高级时限目标年份应保持公开边界', () => {
  assert.throws(
    () => calculateSecondaryProgressionEvidence(astrolabeData, 2201),
    /目标年份需在 1900-2200/,
  );
  assert.throws(() => calculateSolarArcEvidence(astrolabeData, 1899), /目标年份需在 1900-2200/);
  assert.throws(
    () => calculateSolarReturnEvidence(astrolabeData, 2028.5),
    /目标年份需在 1900-2200/,
  );
});

test('高级时限不可用与出生前目标年应返回可追溯的缺口或不适用证据', () => {
  const incomplete = structuredClone(astrolabeData) as AstrolabeData;
  incomplete.birth.standardDateTime = '';
  incomplete.birth.dateTime = '';

  const unavailableEvidence = [
    calculateSolarReturnEvidence(incomplete, 2028),
    calculateSecondaryProgressionEvidence(incomplete, 2028),
    calculateSolarArcEvidence(incomplete, 2028),
  ];
  unavailableEvidence.forEach((evidence) => {
    assert.equal(evidence.status, 'unavailable');
    assert.equal(evidence.summaryFact.status, '证据链有缺口');
    assertAdvancedEvidenceReferences(evidence);
  });

  const beforeBirthEvidence = [
    calculateSolarReturnEvidence(astrolabeData, 1990),
    calculateSecondaryProgressionEvidence(astrolabeData, 1990),
    calculateSolarArcEvidence(astrolabeData, 1990),
  ];
  beforeBirthEvidence.forEach((evidence) => {
    assert.equal(evidence.status, 'not-applicable');
    assert.equal(evidence.summaryFact.status, '不适用');
    assertAdvancedEvidenceReferences(evidence);
  });
});

test('星盘流月与流日沿用同一选择器语义并写入对应行运资料', () => {
  const monthContext = structuredClone(sharedFullContextsJune2028.monthly);
  const dayContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-12');

  assert.equal(monthContext.displayText, '流月 · 2028-06');
  assert.equal(dayContext.displayText, '流日 · 2028-06-12');
  assert.match(monthContext.promptText, /分析对象：流月2028-06。/);
  assert.match(dayContext.promptText, /分析对象：流日2028-06-12。/);
  assert.match(monthContext.promptText, /主要行运相位：/);
  assert.match(dayContext.promptText, /主要行运相位：/);
  assert.match(monthContext.promptText, /行运落宫：/);
  assert.match(dayContext.promptText, /行运落宫：/);
  assert.match(
    monthContext.promptText,
    /周期关键星象（2028-06-01 00:00至2028-07-01 00:00，共\d+项）。/,
  );
  assert.match(
    dayContext.promptText,
    /周期关键星象（2028-06-12 00:00至2028-06-13 00:00，共\d+项）。/,
  );
  assert.doesNotMatch(`${monthContext.promptText}\n${dayContext.promptText}`, /不得|时间边界|证据/);
});

test('星盘行运范围应拒绝缺失、错格式和不存在的日期', () => {
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-02-31'),
    /流日日期无效/,
  );
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-13'),
    /流月日期无效/,
  );
  assert.throws(() => buildAstrolabeScopeContext(astrolabeData, 'yearly', ''), /流年必须提供 YYYY/);
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-6'),
    /流月必须提供 YYYY-MM/,
  );
  assert.throws(
    () => buildAstrolabeScopeContext(astrolabeData, 'full', ''),
    /完整输出必须提供 YYYY-MM-DD/,
  );
});

test('星盘行运范围应支持 2100 年以后的有效年份', () => {
  const yearlyContext = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2101');
  const monthlyContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2101-02');
  const dailyContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2101-02-28');

  assert.equal(yearlyContext.dateStr, '2101');
  assert.equal(monthlyContext.dateStr, '2101-02');
  assert.equal(dailyContext.dateStr, '2101-02-28');
});

test('星盘资料缺少经度时应退回保守提示而不是报错', () => {
  const incompleteData = {
    ...astrolabeData,
    planets: astrolabeData.planets.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
    angles: astrolabeData.angles.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
  } satisfies AstrolabeData;
  const context = buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12');

  assert.equal(context.displayText, '流日 · 2028-06-12');
  assert.match(context.promptText, /本命点经度资料不足/);
  assert.match(context.promptText, /行运落宫：/);
  assert.match(context.promptText, /落本命第\d+宫/);
});

test('星盘资料缺少宫头经度时应禁止行运落宫证据', () => {
  const incompleteData = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
  } satisfies AstrolabeData;
  const context = buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12');

  assert.match(context.promptText, /行运落宫：本命宫头资料不足/);
});

test('星盘行运应使用目标日期的出生地时区而不是固定北京时间', () => {
  const newYorkData = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timeZoneId: 'America/New_York',
    locationName: '纽约',
  });
  const summer = buildAstrolabeScopeContext(newYorkData, 'daily', '2028-07-12');
  const winter = buildAstrolabeScopeContext(newYorkData, 'daily', '2028-01-12');

  assert.match(summer.promptText, /America\/New_York（UTC-04:00）/);
  assert.match(summer.promptText, /行运落宫：取样时区UTC-04:00/);
  assert.match(winter.promptText, /America\/New_York（UTC-05:00）/);
  assert.match(winter.promptText, /行运落宫：取样时区UTC-05:00/);
  assert.doesNotMatch(`${summer.promptText}\n${winter.promptText}`, /按北京时间|取样时区UTC\+8/);

  const historicalFixedOffset = structuredClone(newYorkData) as AstrolabeData;
  delete historicalFixedOffset.birth.timeZoneId;
  historicalFixedOffset.birth.timezone = 4 + (51 * 60 + 16) / 3600;
  const historical = buildAstrolabeScopeContext(historicalFixedOffset, 'daily', '2028-07-12');
  assert.match(historical.promptText, /行运取样：.*UTC\+04:51:16/);
  assert.match(historical.promptText, /行运落宫：取样时区UTC\+04:51:16/);
});

test('星盘行运缺少真实经纬度时不得静默使用零度坐标', () => {
  const incompleteData = structuredClone(astrolabeData) as AstrolabeData;
  delete incompleteData.birth.latitude;
  delete incompleteData.birth.longitude;
  incompleteData.birth.location = '未知地点';

  assert.throws(
    () => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'),
    /缺少有效出生地经纬度/,
  );
});
