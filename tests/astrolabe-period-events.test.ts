import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AstrolabePeriodCalculationCache,
  buildAstrolabePeriodEventLayers,
  buildAstrolabePeriodBatchResult,
  buildAstrolabePeriodContext,
  buildAstrolabePeriodEvents,
  buildAstrolabePeriodEventsFromContext,
  buildAstrolabeScopeContext,
  mergeAstrolabePeriodEvents,
  rankAstrolabeAspects,
  resolveAstrolabePeriodWindow,
  validateAstrolabePeriodContext,
  type AstrolabePeriodEvent,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { formatAstrolabeForPrompt, formatAstrolabeInfo } from 'mingyu-core/prompt';
import { getApparentPosition, unixToJulianDate } from '../packages/core/src/astrology/engine.ts';

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

const newYorkAstrolabeFixture = generateAstrolabe({
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

let june2028Monthly: ReturnType<typeof buildAstrolabePeriodEvents> | undefined;

const analyticTarget = { year: 2030, month: 1, day: 1 };
const analyticStartJd = unixToJulianDate(Date.UTC(2030, 0, 1));
const analyticContext = validateAstrolabePeriodContext({
  timezone: 0,
  points: [
    { name: 'Sun', longitude: 30 },
    { name: 'Moon', longitude: 75 },
    { name: 'Ascendant', longitude: 200 },
  ],
  houseCusps: Array.from({ length: 12 }, (_, index) => index * 30),
});

class AnalyticPeriodCache extends AstrolabePeriodCalculationCache {
  constructor(private readonly mercuryAt: (jd: number) => { longitude: number; speed: number }) {
    super();
  }

  override position(name: Parameters<AstrolabePeriodCalculationCache['position']>[0], jd: number) {
    return name === 'Mercury' ? this.mercuryAt(jd) : { longitude: 201, speed: 0 };
  }

  override solar() {
    return [];
  }

  override lunar() {
    return [];
  }
}

function scanAnalyticMercury(mercuryAt: (jd: number) => { longitude: number; speed: number }) {
  return buildAstrolabePeriodEventsFromContext(analyticContext, 'monthly', analyticTarget, {
    batch: { start: analyticTarget, endExclusive: { year: 2030, month: 1, day: 2 } },
    calculationCache: new AnalyticPeriodCache(mercuryAt),
  }).events.filter((event) => event.movingPoint === '水星');
}

test('星盘精确角与宫座边界恰好位于半开终点时归入下一窗口', () => {
  for (const direction of [1, -1]) {
    const events = scanAnalyticMercury((jd) => ({
      longitude: 30 + direction * (jd - analyticStartJd - 1),
      speed: direction,
    }));
    assert.deepEqual(events, []);
  }
});

test('星盘停逆恰好位于半开终点时保持终点原时刻并归入下一窗口', () => {
  const events = scanAnalyticMercury((jd) => ({
    longitude: 31 + (jd - analyticStartJd - 1) ** 2 / 2,
    speed: jd - analyticStartJd - 1,
  }));
  assert.equal(events.filter((event) => event.kind === '停逆').length, 0);
});

test('星盘内部精确采样点保留真实交点时刻并只记录一次', () => {
  const events = scanAnalyticMercury((jd) => ({
    longitude: 29 + 2 * (jd - analyticStartJd),
    speed: 2,
  }));
  for (const kind of ['行运相位', '换宫', '换座'] as const) {
    const matches = events.filter((event) => event.kind === kind);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].julianDate, analyticStartJd + 0.5);
    assert.equal(matches[0].dateTime, '2030-01-01 12:00');
  }
});

test('星盘在精确角与宫座边界区分持续静止、相切折返与零速穿越', () => {
  assert.deepEqual(
    scanAnalyticMercury(() => ({ longitude: 30, speed: 0 })),
    [],
  );

  for (const direction of [1, -1]) {
    const events = scanAnalyticMercury((jd) => ({
      longitude: 30 + direction * (jd - analyticStartJd - 0.5) ** 2,
      speed: 2 * direction * (jd - analyticStartJd - 0.5),
    }));
    assert.equal(
      events.filter((event) => event.kind === '换宫' || event.kind === '换座').length,
      0,
    );
    const station = events.filter((event) => event.kind === '停逆');
    assert.equal(station.length, 1);
    assert.equal(station[0].julianDate, analyticStartJd + 0.5);
    assert.equal(station[0].stationDirection, direction > 0 ? '顺行' : '逆行');
    const touches = events.filter(
      (event) => event.kind === '行运相位' && event.targetPoint === '本命太阳',
    );
    assert.equal(touches.length, 1);
    assert.equal(touches[0].aspectName, '合相');
    assert.equal(touches[0].julianDate, analyticStartJd + 0.5);
  }

  const zeroSpeedCrossing = scanAnalyticMercury((jd) => ({
    longitude: 30 + (jd - analyticStartJd - 0.5) ** 3,
    speed: 3 * (jd - analyticStartJd - 0.5) ** 2,
  }));
  assert.equal(zeroSpeedCrossing.filter((event) => event.kind === '停逆').length, 0);
  for (const kind of ['换宫', '换座', '行运相位'] as const) {
    const matches = zeroSpeedCrossing.filter((event) => event.kind === kind);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].julianDate, analyticStartJd + 0.5);
  }
});
function getJune2028Monthly() {
  return (june2028Monthly ??= buildAstrolabePeriodEvents(astrolabeData, 'monthly', {
    year: 2028,
    month: 6,
    day: 15,
  }));
}

test('圣地亚哥春季跳时日的周期从实际 01:00 起算', () => {
  const context = { ...buildAstrolabePeriodContext(astrolabeData), timeZoneId: 'America/Santiago' };
  const target = { year: 2024, month: 9, day: 8 };
  const daily = resolveAstrolabePeriodWindow(context, 'daily', target);
  const monthly = resolveAstrolabePeriodWindow(context, 'monthly', target);
  const batch = resolveAstrolabePeriodWindow(context, 'monthly', target, {
    start: target,
    endExclusive: { year: 2024, month: 9, day: 9 },
  });

  assert.equal(daily.start.utcDateTime, '2024-09-08T04:00:00.000Z');
  assert.equal(daily.startDateTime, '2024-09-08 01:00');
  assert.equal(daily.end.utcDateTime, '2024-09-09T03:00:00.000Z');
  assert.equal(daily.end.utcTimestamp - daily.start.utcTimestamp, 23 * 3600000);
  assert.equal(monthly.start.utcDateTime, '2024-09-01T04:00:00.000Z');
  assert.equal(monthly.end.utcDateTime, '2024-10-01T03:00:00.000Z');
  assert.equal(batch.start.utcTimestamp, daily.start.utcTimestamp);
  assert.equal(batch.end.utcTimestamp, daily.end.utcTimestamp);
  assert.deepEqual(batch.batch?.range, {
    startDate: '2024-09-08',
    endDate: '2024-09-09',
    endExclusive: true,
  });
});

test('哈瓦那回拨重复零点取当地公历日的最早瞬时点', () => {
  const context = { ...buildAstrolabePeriodContext(astrolabeData), timeZoneId: 'America/Havana' };
  const window = resolveAstrolabePeriodWindow(context, 'daily', {
    year: 2024,
    month: 11,
    day: 3,
  });

  assert.equal(window.start.utcDateTime, '2024-11-03T04:00:00.000Z');
  assert.equal(window.startDateTime, '2024-11-03 00:00');
  assert.equal(window.start.timezone, -4);
  assert.equal(window.end.utcDateTime, '2024-11-04T05:00:00.000Z');
  assert.equal(window.end.utcTimestamp - window.start.utcTimestamp, 25 * 3600000);
});

test('换日线回拨重复整日时采用首次当地零点', () => {
  const context = {
    ...buildAstrolabePeriodContext(astrolabeData),
    timeZoneId: 'Pacific/Kwajalein',
  };
  const window = resolveAstrolabePeriodWindow(context, 'daily', {
    year: 1969,
    month: 9,
    day: 30,
  });

  assert.equal(window.start.utcDateTime, '1969-09-29T13:00:00.000Z');
  assert.equal(window.end.utcDateTime, '1969-10-01T12:00:00.000Z');
});

test('周期边界保留普通 IANA 日期与固定偏移，并明确拒绝整日不存在', () => {
  const context = buildAstrolabePeriodContext(astrolabeData);
  const newYork = resolveAstrolabePeriodWindow(
    { ...context, timeZoneId: 'America/New_York' },
    'daily',
    { year: 2024, month: 7, day: 1 },
  );
  const fixed = resolveAstrolabePeriodWindow(context, 'daily', {
    year: 2024,
    month: 7,
    day: 1,
  });
  assert.equal(newYork.start.utcDateTime, '2024-07-01T04:00:00.000Z');
  assert.equal(fixed.start.utcDateTime, '2024-06-30T16:00:00.000Z');
  assert.throws(
    () =>
      resolveAstrolabePeriodWindow({ ...context, timeZoneId: 'Pacific/Apia' }, 'daily', {
        year: 2011,
        month: 12,
        day: 30,
      }),
    /Pacific\/Apia.*2011-12-30.*整日不存在/,
  );
});

test('阿皮亚跳过下一名义日时现存流日与批次延伸至首个真实日首', () => {
  const context = { ...buildAstrolabePeriodContext(astrolabeData), timeZoneId: 'Pacific/Apia' };
  const target = { year: 2011, month: 12, day: 29 };
  const daily = resolveAstrolabePeriodWindow(context, 'daily', target);
  const batch = resolveAstrolabePeriodWindow(context, 'monthly', target, {
    start: target,
    endExclusive: { year: 2011, month: 12, day: 30 },
  });
  const sameEnd = resolveAstrolabePeriodWindow(context, 'monthly', target, {
    start: target,
    endExclusive: { year: 2011, month: 12, day: 31 },
  });

  assert.equal(daily.start.utcDateTime, '2011-12-29T10:00:00.000Z');
  assert.equal(daily.end.utcDateTime, '2011-12-30T10:00:00.000Z');
  assert.equal(daily.endDateTime, '2011-12-31 00:00');
  assert.equal(daily.end.utcTimestamp - daily.start.utcTimestamp, 24 * 3600000);
  assert.equal(batch.end.utcTimestamp, daily.end.utcTimestamp);
  assert.equal(sameEnd.end.utcTimestamp, daily.end.utcTimestamp);
  assert.deepEqual(batch.batch?.range, {
    startDate: '2011-12-29',
    endDate: '2011-12-31',
    endExclusive: true,
  });
  assert.deepEqual(batch.batch?.nextRange, {
    startDate: '2011-12-31',
    endDate: '2012-01-01',
    endExclusive: true,
  });
  const events = buildAstrolabePeriodEventsFromContext(context, 'daily', target, {
    batch: { start: target, endExclusive: { year: 2011, month: 12, day: 30 } },
  });
  assert.equal(events.startDateTime, '2011-12-29 00:00');
  assert.equal(events.endDateTime, '2011-12-31 00:00');
  assert.ok(events.events.length > 0);
  assert.ok(events.events.every((event) => event.dateTime.startsWith('2011-12-29 ')));
  assert.throws(
    () => resolveAstrolabePeriodWindow(context, 'daily', { year: 2011, month: 12, day: 30 }),
    /Pacific\/Apia.*2011-12-30.*整日不存在/u,
  );
});

test('流月应补齐内行星天象，流日应补齐月亮动态点', () => {
  const monthly = getJune2028Monthly();
  const daily = buildAstrolabePeriodEvents(astrolabeData, 'daily', {
    year: 2028,
    month: 6,
    day: 12,
  });

  assert.ok(
    monthly.events.some((item) => ['太阳', '水星', '金星', '火星'].includes(item.movingPoint)),
  );
  assert.ok(
    daily.events.some(
      (item) =>
        item.movingPoint === '月亮' ||
        item.kind === '朔望' ||
        item.kind === '交食' ||
        item.kind === '行运相位',
    ),
  );
  assert.ok(
    daily.events.every(
      (item) => item.dateTime.startsWith('2028-06-12') || item.dateTime.startsWith('2028-06-13'),
    ),
  );
});

test('流月相邻半开批次合并后与完整月份事件一致', () => {
  const complete = getJune2028Monthly();
  const first = buildAstrolabePeriodEvents(
    astrolabeData,
    'monthly',
    { year: 2028, month: 6, day: 15 },
    {
      batch: {
        start: { year: 2028, month: 6, day: 1 },
        endExclusive: { year: 2028, month: 6, day: 16 },
      },
    },
  );
  const second = buildAstrolabePeriodEvents(
    astrolabeData,
    'monthly',
    { year: 2028, month: 6, day: 15 },
    {
      batch: {
        start: { year: 2028, month: 6, day: 16 },
        endExclusive: { year: 2028, month: 7, day: 1 },
      },
    },
  );

  assert.deepEqual(first.batch?.range, {
    startDate: '2028-06-01',
    endDate: '2028-06-16',
    endExclusive: true,
  });
  assert.deepEqual(first.batch?.nextRange, {
    startDate: '2028-06-16',
    endDate: '2028-07-01',
    endExclusive: true,
  });
  assert.equal(second.batch?.nextRange, null);
  assert.deepEqual(mergeAstrolabePeriodEvents([first.events, second.events]), complete.events);
  assert.ok(
    first.events.every(
      (event) => event.dateTime >= '2028-06-01 00:00' && event.dateTime < '2028-06-16 00:00',
    ),
  );
  assert.ok(
    second.events.every(
      (event) => event.dateTime >= '2028-06-16 00:00' && event.dateTime < '2028-07-01 00:00',
    ),
  );
});

test('跨夏令时的流年七日批次按全局采样网格逐事件等价', () => {
  const newYorkData = structuredClone(newYorkAstrolabeFixture);
  const target = { year: 2024, month: 7, day: 1 };
  const complete = buildAstrolabePeriodEvents(newYorkData, 'yearly', target).events;
  const context = buildAstrolabePeriodContext(newYorkData);
  const batches = [];
  const scopeStart = Date.UTC(2024, 0, 1);
  const scopeEnd = Date.UTC(2025, 0, 1);
  const day = 24 * 60 * 60 * 1000;

  for (let cursor = scopeStart; cursor < scopeEnd; cursor += 7 * day) {
    const end = Math.min(cursor + 7 * day, scopeEnd);
    const startDate = new Date(cursor);
    const endDate = new Date(end);
    batches.push(
      buildAstrolabePeriodEventsFromContext(context, 'yearly', target, {
        batch: {
          start: {
            year: startDate.getUTCFullYear(),
            month: startDate.getUTCMonth() + 1,
            day: startDate.getUTCDate(),
          },
          endExclusive: {
            year: endDate.getUTCFullYear(),
            month: endDate.getUTCMonth() + 1,
            day: endDate.getUTCDate(),
          },
        },
      }).events,
    );
  }

  assert.deepEqual(mergeAstrolabePeriodEvents(batches), complete);
});

test('流年周期批次拒绝越界窗口', () => {
  assert.throws(
    () =>
      buildAstrolabePeriodEvents(
        astrolabeData,
        'yearly',
        { year: 2028, month: 7, day: 1 },
        {
          batch: {
            start: { year: 2027, month: 12, day: 15 },
            endExclusive: { year: 2028, month: 1, day: 15 },
          },
        },
      ),
    /完整落在所选分析范围内/,
  );
});

test('紧凑本命周期上下文与完整星盘周期事件保持一致', () => {
  const context = buildAstrolabePeriodContext(astrolabeData);
  assert.ok(context.points.length >= 3);
  assert.equal(context.houseCusps.length, 12);
  const target = { year: 2028, month: 6, day: 15 };
  const batch = {
    start: { year: 2028, month: 6, day: 1 },
    endExclusive: { year: 2028, month: 6, day: 8 },
  };
  const fromData = buildAstrolabePeriodEvents(astrolabeData, 'monthly', target, { batch });
  const fromContext = buildAstrolabePeriodEventsFromContext(context, 'monthly', target, { batch });
  assert.deepEqual(fromContext.events, fromData.events);
  const result = buildAstrolabePeriodBatchResult(context, 'monthly', target, '2028-06', batch);
  assert.equal(result.kind, 'astrolabe-period-batch');
  assert.equal(result.target, '2028-06');
  assert.deepEqual(result.range, fromData.batch?.range);
  assert.deepEqual(result.events, fromData.events);
});

test('完整星盘入口保留缺失宫头兼容，紧凑上下文明确要求十二宫头', () => {
  const incompleteData = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((house) => ({ ...house, longitude: Number.NaN })),
  };

  assert.doesNotThrow(() =>
    buildAstrolabePeriodEvents(incompleteData, 'daily', {
      year: 2028,
      month: 6,
      day: 12,
    }),
  );
  assert.throws(() => buildAstrolabePeriodContext(incompleteData), /完整十二宫宫头/);
});

test('重复或乱序宫头不能生成周期换宫事实', () => {
  const source = buildAstrolabePeriodContext(astrolabeData);
  const target = { year: 2028, month: 3, day: 20 };
  const duplicateData = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((house) => ({ ...house, longitude: 0 })),
  };
  const events = buildAstrolabePeriodEvents(duplicateData, 'monthly', target).events;
  assert.equal(
    events.some((event) => event.kind === '换宫'),
    false,
  );
  assert.throws(() => buildAstrolabePeriodContext(duplicateData), /完整十二宫宫头/);
  assert.throws(
    () => validateAstrolabePeriodContext({ ...source, houseCusps: Array(12).fill(0) }),
    /完整十二宫区间/,
  );

  const reversed = [...source.houseCusps];
  [reversed[1], reversed[2]] = [reversed[2], reversed[1]];
  assert.throws(
    () => validateAstrolabePeriodContext({ ...source, houseCusps: reversed }),
    /完整十二宫区间/,
  );
});

test('逆行越过狭窄宫位的宫头时进入紧邻的前一宫', () => {
  const source = buildAstrolabePeriodContext(astrolabeData);
  const context = validateAstrolabePeriodContext({
    ...source,
    timezone: 0,
    houseCusps: [23.595, 23.6, 53.6, 83.6, 113.6, 143.6, 173.6, 203.6, 233.6, 263.6, 293.6, 323.6],
  });
  const target = { year: 2024, month: 4, day: 10 };
  const events = buildAstrolabePeriodEventsFromContext(context, 'daily', target, {
    batch: { start: target, endExclusive: { year: 2024, month: 4, day: 11 } },
  }).events;
  const crossing = events.find(
    (event) => event.kind === '换宫' && event.movingPoint === '水星' && event.house === 1,
  );

  assert.ok(crossing);
  assert.equal(crossing.promptText, '水星退入本命第1宫');
  const nextCrossing = events.find(
    (event) => event.kind === '换宫' && event.movingPoint === '水星' && event.house === 12,
  );
  assert.ok(nextCrossing);
  assert.ok(crossing.julianDate < nextCrossing.julianDate);
});

test('同一日停逆前后两次越过本命点与同一宫头应完整列出', () => {
  // 木星 2028-01-12 先越过 177.5121° 再停驻折返；每日首尾都落在界线前。
  const cusp = 177.5121;
  const context = validateAstrolabePeriodContext({
    timezone: 0,
    points: [
      { name: 'Sun', longitude: cusp },
      { name: 'Moon', longitude: 20 },
      { name: 'Ascendant', longitude: 40 },
    ],
    houseCusps: Array.from({ length: 12 }, (_, index) => (cusp + index * 30) % 360),
  });
  const target = { year: 2028, month: 1, day: 12 };
  const events = buildAstrolabePeriodEventsFromContext(context, 'yearly', target, {
    batch: { start: target, endExclusive: { year: 2028, month: 1, day: 13 } },
  }).events;
  const conjunctions = events.filter(
    (event) =>
      event.kind === '行运相位' &&
      event.movingPoint === '木星' &&
      event.targetPoint === '本命太阳' &&
      event.aspectName === '合相',
  );
  const houseChanges = events.filter(
    (event) => event.kind === '换宫' && event.movingPoint === '木星',
  );
  const stations = events.filter((event) => event.kind === '停逆' && event.movingPoint === '木星');

  assert.deepEqual(
    conjunctions.map((event) => event.dateTime),
    ['2028-01-12 03:23', '2028-01-12 14:23'],
  );
  assert.deepEqual(
    houseChanges.map((event) => event.house),
    [1, 12],
  );
  assert.deepEqual(
    stations.map((event) => event.stationDirection),
    ['逆行'],
  );
  // Swiss Moshier 在同一 TT 求木星黄经速度零点：2028-01-12T08:53:41Z。
  assert.ok(
    Math.abs(stations[0].julianDate - unixToJulianDate(Date.parse('2028-01-12T08:53:41Z'))) <
      2 / 1440,
  );
  assert.ok(conjunctions[0].julianDate < stations[0].julianDate);
  assert.ok(stations[0].julianDate < conjunctions[1].julianDate);
  for (const event of conjunctions) {
    const position = getApparentPosition('jupiter', event.julianDate);
    assert.ok(Math.abs(position.longitude - cusp) < 0.0001);
  }
});

test('纽约夏令时流年批次的结果时区取父范围起点', () => {
  const newYorkData = structuredClone(newYorkAstrolabeFixture);
  const newYorkContext = buildAstrolabePeriodContext(newYorkData);
  const result = buildAstrolabePeriodBatchResult(
    newYorkContext,
    'yearly',
    { year: 2024, month: 7, day: 1 },
    '2024',
    {
      start: { year: 2024, month: 7, day: 1 },
      endExclusive: { year: 2024, month: 7, day: 8 },
    },
  );

  assert.equal(result.timeZoneId, 'America/New_York');
  assert.equal(result.timezone, -5);
  const winter = resolveAstrolabePeriodWindow(newYorkContext, 'yearly', {
    year: 2024,
    month: 1,
    day: 1,
  });
  const summer = resolveAstrolabePeriodWindow(newYorkContext, 'monthly', {
    year: 2024,
    month: 7,
    day: 1,
  });
  assert.equal(winter.start.timezone, -5);
  assert.equal(summer.start.timezone, -4);
  assert.equal(winter.timezoneLabel, 'America/New_York（各时刻按当地历史时区规则换算）');
  assert.equal(summer.timezoneLabel, winter.timezoneLabel);
  assert.deepEqual(result.parentRange, {
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    endExclusive: true,
  });
});

test('固定时区周期标签保留历史秒级偏移', () => {
  const fixedOffsetData = structuredClone(astrolabeData);
  delete fixedOffsetData.birth.timeZoneId;
  fixedOffsetData.birth.timezone = 4 + (51 * 60 + 16) / 3600;
  const window = resolveAstrolabePeriodWindow(
    buildAstrolabePeriodContext(fixedOffsetData),
    'daily',
    { year: 2028, month: 7, day: 12 },
  );

  assert.equal(window.timezoneLabel, 'UTC+04:51:16');
});

test('合并周期星象应按时刻去重排序', () => {
  const first: AstrolabePeriodEvent = {
    key: '换座:太阳:先',
    kind: '换座',
    julianDate: unixToJulianDate(Date.parse('2028-06-01T00:00:00Z')),
    dateTime: '2028-06-01 08:00',
    promptText: '太阳进入双子座',
    movingPoint: '太阳',
    signName: '双子座',
  };
  const second: AstrolabePeriodEvent = {
    ...first,
    key: '换座:太阳:后',
    julianDate: unixToJulianDate(Date.parse('2028-06-02T00:00:00Z')),
    dateTime: '2028-06-02 08:00',
  };
  assert.deepEqual(
    mergeAstrolabePeriodEvents([
      [second, first],
      [second, first],
    ]),
    [first, second],
  );
});

test('星盘流年分析对象应写入周期关键星象资料', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');
  assert.ok((context.periodEvents?.events.length ?? 0) > 0);
  const collection = context.periodEvents!;

  assert.equal(collection.startDateTime, '2028-01-01 00:00');
  assert.equal(collection.endDateTime, '2029-01-01 00:00');
  assert.ok(collection.events.length >= 20);
  assert.deepEqual(
    collection.events.map((item) => item.julianDate),
    [...collection.events]
      .sort((first, second) => first.julianDate - second.julianDate)
      .map((item) => item.julianDate),
  );

  const kinds = new Set(collection.events.map((item) => item.kind));
  assert.ok(kinds.has('行运相位'));
  assert.ok(kinds.has('停逆') || kinds.has('换座') || kinds.has('换宫'));
  assert.ok(kinds.has('朔望') || kinds.has('交食'));
  assert.ok(
    collection.events.some(
      (item) => item.movingPoint === '北交点' || item.targetPoint?.includes('交点'),
    ),
  );
  assert.match(
    collection.promptText,
    /周期关键星象（2028-01-01 00:00至2029-01-01 00:00，共\d+项）。/,
  );
  assert.match(collection.promptText, /完整明细：/);
  assert.doesNotMatch(
    collection.promptText,
    /不得|时间边界|证据|不代表|周期主轴：|具体星象见|具体时刻见/,
  );
  assert.ok(collection.axis.length > 0);
  for (const event of collection.events) {
    assert.equal(
      collection.promptText.split(`${event.dateTime} ${event.promptText}`).length - 1,
      1,
    );
  }

  const firstTransit = collection.events.find((item) => item.kind === '行运相位');
  assert.ok(firstTransit);
  assert.match(firstTransit.dateTime, /^2028-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.match(context.promptText, /周期关键星象/);
  assert.doesNotMatch(context.promptText, /不得|时间边界|证据/);
  for (const event of context.periodEvents!.events) {
    assert.equal(context.promptText.split(`${event.dateTime} ${event.promptText}`).length - 1, 1);
  }
  assert.doesNotMatch(context.promptText, /周期主轴：|重复过境主线见|具体星象见|具体时刻见/);
});

test('同一慢行星多次过境保留归组统计，逐时刻事实只列一次', () => {
  const events = [12, 180, 300].map((day, index) => ({
    key: `行运相位:Saturn:Sun:${index}`,
    kind: '行运相位' as const,
    julianDate: 2461900 + day,
    dateTime: `2028-0${index + 3}-12 08:1${index}`,
    promptText: '土星刑本命太阳',
    movingPoint: '土星',
    targetPoint: '本命太阳',
    aspectName: '刑相',
  }));
  const eclipse = {
    key: '交食:Sun:1',
    kind: '交食' as const,
    julianDate: 2461912,
    dateTime: '2028-03-12 14:00',
    promptText: '日全食',
    movingPoint: '太阳',
    targetPoint: '月亮',
    eclipseName: '日全食',
  };
  const layers = buildAstrolabePeriodEventLayers(
    [...events, eclipse],
    '2028-01-01 00:00',
    '2029-01-01 00:00',
    'yearly',
  );

  assert.equal(layers.groups.length, 1);
  assert.match(layers.groups[0].promptText, /土星刑本命太阳 3次过境/);
  assert.match(layers.promptText, /过境归组：土星刑本命太阳 3次过境/);
  assert.match(layers.promptText, /完整明细：/);
  for (const event of [...events, eclipse]) {
    assert.equal(layers.promptText.split(`${event.dateTime} ${event.promptText}`).length - 1, 1);
  }
  assert.doesNotMatch(layers.promptText, /周期主轴：|具体时刻见|具体星象见|重复过境主线见/);
  assert.match(layers.axis.map((item) => item.promptText).join('；'), /土星刑本命太阳|日全食/);
});

test('同一民用日的分离关键窗口保留各自真实起止时分', () => {
  const hours = [0, 1, 2, 3, 11, 12, 13, 14];
  const events = hours.map((hour, index) => ({
    key: `停逆:${index}`,
    kind: '停逆' as const,
    julianDate: 2461900 + hour / 24,
    dateTime: `2028-03-12 ${String(hour).padStart(2, '0')}:00`,
    promptText: `土星${index % 2 ? '顺行' : '逆行'}`,
    movingPoint: '土星',
  }));
  const layers = buildAstrolabePeriodEventLayers(
    events,
    '2028-03-12 00:00',
    '2028-03-13 00:00',
    'daily',
  );
  assert.equal(layers.windows.length, 2);
  assert.deepEqual(
    layers.windows.map((window) => window.eventKeys),
    [events.slice(0, 4).map((event) => event.key), events.slice(4).map((event) => event.key)],
  );
  assert.match(layers.promptText, /2028-03-12 00:00至2028-03-12 03:00（共4项）/);
  assert.match(layers.promptText, /2028-03-12 11:00至2028-03-12 14:00（共4项）/);
  for (const event of events) {
    assert.equal(layers.promptText.split(`${event.dateTime} ${event.promptText}`).length - 1, 1);
  }
});

test('核心提示词与占问提示词应使用同一套本命相位主线和完整明细', () => {
  const natal = formatAstrolabeForPrompt(astrolabeData);
  const divination = formatAstrolabeInfo(astrolabeData);

  assert.match(natal, /相位主线：/);
  assert.match(divination, /相位主线：/);
  assert.equal(
    (natal.match(/相位明细：/g) ?? []).length,
    (divination.match(/相位明细：/g) ?? []).length,
  );
  assert.ok(astrolabeData.aspects.length > 6);
  for (const aspect of astrolabeData.aspects) {
    const points = [...astrolabeData.planets, ...astrolabeData.angles];
    const first = points.find((point) => point.label === aspect.body1)!;
    const second = points.find((point) => point.label === aspect.body2)!;
    assert.ok(first);
    assert.ok(second);
    const line = `${aspect.body1}与${aspect.body2}：${aspect.type}`;
    assert.ok(natal.includes(line));
    assert.ok(divination.includes(line));
    assert.ok(natal.includes(`${first.label}${first.formatted}`));
    assert.ok(natal.includes(`${second.label}${second.formatted}`));
  }
});

test('本命相位应按紧密等级与日月轴点排序，不得只取数组前几项', () => {
  const ranked = rankAstrolabeAspects([
    {
      body1: '谷神星',
      body2: '婚神星',
      type: '半六合',
      symbol: '⚺',
      orb: 0.2,
      closeness: '紧密',
      applying: null,
    },
    {
      body1: '太阳',
      body2: '土星',
      type: '刑相',
      symbol: '□',
      orb: 1.2,
      closeness: '紧密',
      applying: true,
    },
    {
      body1: '水星',
      body2: '木星',
      type: '六合',
      symbol: '⚹',
      orb: 5.8,
      closeness: '宽松',
      applying: false,
    },
  ]);

  assert.equal(ranked[0].body1, '太阳');
  assert.equal(ranked[0].body2, '土星');
  assert.equal(ranked.length, 3);
});

test('行运精准相位时刻应落在目标黄经附近', () => {
  const transit = getJune2028Monthly().events.find(
    (item) =>
      item.kind === '行运相位' &&
      item.movingPoint === '太阳' &&
      item.targetPoint === '本命水星' &&
      item.aspectName === '合相',
  );
  assert.ok(transit);
  assert.equal(transit.dateTime, '2028-06-08 06:08');

  const natalName = transit.targetPoint?.replace(/^本命/, '');
  const natal = [...astrolabeData.planets, ...astrolabeData.angles].find(
    (item) =>
      item.label === natalName ||
      (natalName === '太阳' && item.name === 'Sun') ||
      (natalName === '月亮' && item.name === 'Moon') ||
      (natalName === '上升' && item.name === 'Ascendant') ||
      (natalName === '天顶' && item.name === 'Midheaven'),
  );
  assert.ok(natal);
  const jd = unixToJulianDate(Date.parse(`${transit.dateTime.replace(' ', 'T')}+08:00`));
  const sun = getApparentPosition('sun', jd);
  const distance = Math.abs(((sun.longitude - natal.longitude + 540) % 360) - 180);
  assert.ok(distance < 0.2, `合相残差过大：${distance}`);
});
