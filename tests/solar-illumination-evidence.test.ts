import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSolarIlluminationEvidence } from '../packages/core/src/calendar/solar-illumination-evidence.ts';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';
import { isQizhengDaylightAtBirth } from '../packages/core/src/qi_zheng/en-nan.ts';

function assertEvidenceReferences(evidence: ReturnType<typeof calculateSolarIlluminationEvidence>) {
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  const crossings = [
    evidence.sunriseSunset,
    evidence.civilTwilight,
    evidence.nauticalTwilight,
    evidence.astronomicalTwilight,
  ];
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.assumptionFactCount, evidence.assumptionFacts.length);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.equal(
    evidence.summaryFact.normalCrossingCount,
    crossings.filter((item) => item.status === '正常交点').length,
  );
  assert.equal(
    evidence.summaryFact.allDayStateCount,
    crossings.filter((item) => item.status !== '正常交点').length,
  );
  assert.ok(evidence.crossingSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    crossings.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.calculationStepKeys.join('|'),
    ),
  );
  for (const item of crossings) {
    assert.deepEqual(
      item.crossings.map((event) => event.utcTimestamp),
      [...item.crossings].map((event) => event.utcTimestamp).sort((a, b) => a - b),
    );
    for (const event of item.crossings) {
      assert.equal(Date.parse(event.utcDateTime), event.utcTimestamp);
      assert.ok(event.utcTimestamp >= Date.parse(item.dayStartUtcDateTime));
      assert.ok(event.utcTimestamp < Date.parse(item.dayEndUtcDateTimeExclusive));
    }
  }
  assert.ok(
    [...evidence.assumptionFacts, ...evidence.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
    ),
  );
}

test('北京夏至应给出可复核的日出日落、太阳高度与曙暮光', () => {
  const base = {
    year: 2024,
    month: 6,
    day: 21,
    latitude: 39.9042,
    longitude: 116.4074,
  } as const;
  const evidence = calculateSolarIlluminationEvidence({ ...base, hour: 12, timezone: 8 });
  const midnight = calculateSolarIlluminationEvidence({ ...base, hour: 0, timezone: 8 });
  const differentTimezone = calculateSolarIlluminationEvidence({ ...base, hour: 12, timezone: 9 });

  // JPL Horizons：Sun，coord@399，UT，AIRLESS，量2/4，椭球高0 km。
  // https://ssd-api.jpl.nasa.gov/doc/horizons.html
  for (const [actual, expected, label] of [
    [evidence.solarAltitudeDegrees, 73.180510001, '无折射太阳高度'],
    [evidence.solarAzimuthDegrees, 167.041909454, '真北方位'],
    [evidence.solarDeclinationDegrees, 23.437238264, '视赤纬'],
  ] as const) {
    assert.ok(Math.abs(actual - expected) < 0.01, `${label}与 JPL 固定样本偏差超限`);
  }
  assert.equal(evidence.sunriseSunset.status, '正常交点');
  assert.equal(evidence.sunriseSunset.crossings.length, 2);
  assert.equal(evidence.apparentSolarNoonEvents.length, 1);
  assert.equal(
    evidence.apparentSolarNoonEvents[0].utcDateTime,
    evidence.apparentSolarNoonUtcDateTime,
  );
  assert.doesNotMatch(evidence.sunriseSunset.promptText, /UTC[+-]\d\d:\d\d|\d{4}-\d\d-\d\dT\d\d:/);
  assert.match(evidence.sunriseSunset.morningLocalDateTime ?? '', /2024-06-21 04:4\d:/);
  assert.match(evidence.sunriseSunset.eveningLocalDateTime ?? '', /2024-06-21 19:4\d:/);
  assert.match(evidence.civilTwilight.morningLocalDateTime ?? '', /2024-06-21 04:1\d:/);
  assert.ok(
    [
      evidence.sunriseSunset,
      evidence.civilTwilight,
      evidence.nauticalTwilight,
      evidence.astronomicalTwilight,
    ].every(
      (item) =>
        item.key.startsWith('光照交点:') &&
        item.promptText.includes('阈值') &&
        item.sources.length >= 2 &&
        item.calculation.includes('求该民用日期内的高度交点') &&
        item.limitation.includes('不代表实际可见性'),
    ),
  );
  assert.match(evidence.promptText, /真北起顺时针/);
  assert.match(
    evidence.promptText,
    /日出\/日落：标准太阳上缘与近地平折射阈值（太阳中心名义高度约-0\.833°）/,
  );
  assert.match(evidence.promptText, /不宣称达到观测级或导航级精度/);
  assert.equal(
    evidence.key,
    'solar-illumination:2024-06-21:39.9042:116.4074:2024-06-21 04:00:00Z:UTC+8',
  );
  assert.notEqual(midnight.key, evidence.key);
  assert.notEqual(evidence.key, differentTimezone.key);
  assert.match(differentTimezone.key, /:2024-06-21 03:00:00Z:UTC\+9$/);
  assert.notEqual(midnight.solarAltitudeDegrees, evidence.solarAltitudeDegrees);
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.astronomicalTime.status, '已计算');
  assert.deepEqual(
    evidence.calculationSteps.map((item) => item.stage),
    ['天文时间', '参考太阳位置', '视太阳正午', '阈值交点'],
  );
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.deepEqual(evidence.calculationSteps[3].dependsOnStepKeys, [
    evidence.calculationSteps[1].key,
    evidence.calculationSteps[2].key,
  ]);
  assert.ok(
    [
      evidence.sunriseSunset,
      evidence.civilTwilight,
      evidence.nauticalTwilight,
      evidence.astronomicalTwilight,
    ].every((item) => item.calculationStepKeys.includes(evidence.calculationSteps[3].key)),
  );
  assert.equal(evidence.assumptions.length, evidence.assumptionFacts.length);
  assert.equal(evidence.crossingSummaryFact.status, '均有正常交点');
  assert.equal(evidence.crossingSummaryFact.crossingFactKeys.length, 4);
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assertEvidenceReferences(evidence);
  assert.ok(
    [
      ...evidence.calculationSteps,
      ...evidence.assumptionFacts,
      evidence.crossingSummaryFact,
      ...evidence.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
});

test('高纬冬夏应明确表达极夜无日出和极昼无日落', () => {
  const winter = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 12,
    day: 21,
    hour: 12,
    timezone: 1,
    latitude: 69.6492,
    longitude: 18.9553,
  });
  const summer = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 6,
    day: 21,
    hour: 12,
    timezone: 2,
    latitude: 69.6492,
    longitude: 18.9553,
  });

  assert.equal(winter.sunriseSunset.status, '全天低于阈值');
  assert.equal(winter.apparentSolarNoonEvents.length, 1);
  assert.deepEqual(winter.sunriseSunset.crossings, []);
  assert.equal(winter.sunriseSunset.morningUtcDateTime, null);
  assert.match(winter.sunriseSunset.calculation, /全天低于阈值/);
  assert.equal(summer.sunriseSunset.status, '全天高于阈值');
  assert.equal(summer.apparentSolarNoonEvents.length, 1);
  assert.deepEqual(summer.sunriseSunset.crossings, []);
  assert.equal(summer.civilTwilight.status, '全天高于阈值');
  assert.match(summer.sunriseSunset.calculation, /全天高于阈值/);
  assert.equal(winter.status, '存在全天状态');
  assert.equal(winter.crossingSummaryFact.status, '存在全天状态');
  assert.equal(summer.status, '存在全天状态');
  assert.equal(winter.summaryFact.status, '含全天状态');
  assert.equal(summer.summaryFact.status, '含全天状态');
  assertEvidenceReferences(winter);
  assertEvidenceReferences(summer);

  // Astronomy Engine 2.1.19 的上缘定义：695700 km 太阳半径随距离换角半径，
  // 海平面折射为34角分；不能将同一模型的全天状态改用固定中心-0.833°。
  // https://github.com/cosinekitty/astronomy/blob/v2.1.19/source/js/astronomy.ts
  const grazingSummer = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 12,
    day: 21,
    hour: 12,
    timezone: 0,
    latitude: -65.729,
    longitude: 179.5,
  });
  assert.equal(grazingSummer.sunriseSunset.status, '全天高于阈值');
  assert.deepEqual(grazingSummer.sunriseSunset.crossings, []);
  assert.ok(grazingSummer.solarAltitudeDegrees < -0.833);
  assert.match(
    grazingSummer.sunriseSunset.promptText,
    /太阳上缘.*名义高度约-0\.833°.*全天高于阈值/,
  );
  assert.doesNotMatch(grazingSummer.sunriseSunset.promptText, /全天低于阈值/);
  assertEvidenceReferences(grazingSummer);
  assert.equal(
    isQizhengDaylightAtBirth(Date.UTC(2024, 11, 21, 12), grazingSummer.sunriseSunset),
    true,
  );
});

test('极昼起始前的交点应按民用日期归属，并允许当日只有日出', () => {
  // USNO 逐日结果：https://aa.usno.navy.mil/api/rstt/oneday?date=2024-05-17&coords=69.6492,18.9553&tz=2
  const calculateAt = (day: number) =>
    calculateSolarIlluminationEvidence({
      year: 2024,
      month: 5,
      day,
      hour: 12,
      timezone: 2,
      latitude: 69.6492,
      longitude: 18.9553,
    }).sunriseSunset;

  const may16 = calculateAt(16);
  const may17 = calculateAt(17);
  const may18 = calculateAt(18);
  assert.equal(may16.crossings.length, 1);
  assert.match(may16.morningLocalDateTime ?? '', /^2024-05-16 01:2[4-7]:/);
  assert.equal(may16.eveningLocalDateTime, null);
  assert.equal(may16.status, '正常交点');
  assert.match(may16.promptText, /下行交点当日无/);
  assert.match(may17.morningLocalDateTime ?? '', /^2024-05-17 01:0[6-9]:/);
  assert.equal(may17.crossings.length, 2);
  assert.match(may17.eveningLocalDateTime ?? '', /^2024-05-17 00:1[0-4]:/);
  assert.ok(
    Date.parse(may17.eveningUtcDateTime ?? '') < Date.parse(may17.morningUtcDateTime ?? ''),
  );
  assert.equal(may18.status, '全天高于阈值');
  assert.deepEqual(may18.crossings, []);
  assert.equal(may18.morningLocalDateTime, null);
  assert.equal(may18.eveningLocalDateTime, null);
});

test('太阳光照证据应复用IANA历史时区并拒绝非法坐标', () => {
  const evidence = calculateSolarIlluminationEvidence({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    timeZoneId: 'Asia/Shanghai',
    latitude: 31.2304,
    longitude: 121.4737,
  });

  assert.equal(evidence.timezone, 9);
  assert.throws(
    () =>
      calculateSolarIlluminationEvidence({
        year: 2024,
        month: 1,
        day: 1,
        timezone: 8,
        latitude: 91,
        longitude: 116,
      }),
    /纬度需在 -90 至 90 之间/,
  );
  assert.throws(
    () =>
      calculateSolarIlluminationEvidence({
        year: 2024,
        month: 1,
        day: 1,
        timezone: 8,
        latitude: 39,
        longitude: Number.NaN,
      }),
    /经度需在 -180 至 180 之间/,
  );
});

test('跨国际日期变更线时保留真实民用日光照并拒绝被跳过的日期', () => {
  const location = {
    latitude: -13.8333,
    longitude: -171.75,
    timeZoneId: 'Pacific/Apia',
    year: 2011,
    month: 12,
    hour: 12,
  } as const;
  const before = calculateSolarIlluminationEvidence({ ...location, day: 29 });
  const after = calculateSolarIlluminationEvidence({ ...location, day: 31 });
  assert.equal(before.localDayEndUtcDateTimeExclusive, '2011-12-30T10:00:00.000Z');
  assert.equal(after.localDayStartUtcDateTime, before.localDayEndUtcDateTimeExclusive);
  assert.ok(
    before.sunriseSunset.crossings.every(
      (event) =>
        event.utcTimestamp >= Date.parse(before.localDayStartUtcDateTime) &&
        event.utcTimestamp < Date.parse(before.localDayEndUtcDateTimeExclusive),
    ),
  );
  assert.throws(() => calculateSolarIlluminationEvidence({ ...location, day: 30 }), /不存在/);
});

test('重历民用日保留47小时内四个完整升落交点及各自历史偏移', () => {
  const input = {
    year: 1969,
    month: 9,
    day: 30,
    hour: 12,
    latitude: 8.7167,
    longitude: 167.7333,
    timeZoneId: 'Pacific/Kwajalein',
  } as const;
  const first = calculateSolarIlluminationEvidence({ ...input, timezone: 11 });
  const second = calculateSolarIlluminationEvidence({ ...input, timezone: -12 });
  const sunriseSunset = second.sunriseSunset;
  const events = sunriseSunset.crossings;

  assert.equal(
    (Date.parse(second.localDayEndUtcDateTimeExclusive) -
      Date.parse(second.localDayStartUtcDateTime)) /
      3_600_000,
    47,
  );
  assert.deepEqual(first.sunriseSunset.crossings, events);
  assert.deepEqual(first.apparentSolarNoonEvents, second.apparentSolarNoonEvents);
  assert.equal(first.apparentSolarNoonEvents.length, 2);
  // JPL Horizons：同地点太阳无折射方位穿越180°的插值时刻，UT。
  // https://ssd-api.jpl.nasa.gov/doc/horizons.html
  for (const [index, utc] of ['1969-09-30T00:39:14.229Z', '1969-10-01T00:38:54.637Z'].entries()) {
    assert.ok(
      Math.abs(first.apparentSolarNoonEvents[index].utcTimestamp - Date.parse(utc)) < 1_000,
      '重历日正午与 JPL 独立交点偏差超限',
    );
  }
  assert.deepEqual(
    first.apparentSolarNoonEvents.map((event) => event.utcOffset),
    ['+11:00', '-12:00'],
  );
  assert.ok(
    first.apparentSolarNoonEvents[0].utcTimestamp > events[0].utcTimestamp &&
      first.apparentSolarNoonEvents[0].utcTimestamp < events[1].utcTimestamp &&
      first.apparentSolarNoonEvents[1].utcTimestamp > events[2].utcTimestamp &&
      first.apparentSolarNoonEvents[1].utcTimestamp < events[3].utcTimestamp,
  );
  assert.equal(first.apparentSolarNoonUtcDateTime, first.apparentSolarNoonEvents[0].utcDateTime);
  assert.equal(second.apparentSolarNoonUtcDateTime, second.apparentSolarNoonEvents[1].utcDateTime);
  assert.match(first.promptText, /11:39:14（UTC\+11:00）.*12:38:54（UTC-12:00）/);
  assert.equal(first.promptText.match(/1969-09-30 11:39:14（UTC\+11:00）/g)?.length, 1);
  assert.equal(first.promptText.match(/1969-09-30 12:38:54（UTC-12:00）/g)?.length, 1);
  assert.deepEqual(
    events.map((event) => event.direction),
    ['上行', '下行', '上行', '下行'],
  );
  assert.deepEqual(
    events.map((event) => event.utcOffset),
    ['+11:00', '+11:00', '-12:00', '-12:00'],
  );
  assert.deepEqual(
    events.map((event) => event.utcDateTime),
    [
      '1969-09-29T18:37:31.550Z',
      '1969-09-30T06:40:49.824Z',
      '1969-09-30T18:37:26.125Z',
      '1969-10-01T06:40:16.081Z',
    ],
  );
  assert.equal(sunriseSunset.morningUtcDateTime, events[0].utcDateTime);
  assert.equal(sunriseSunset.eveningUtcDateTime, events[1].utcDateTime);
  assert.ok(events.every((event) => event.localDateTime.startsWith('1969-09-30 ')));
  assert.match(sunriseSunset.promptText, /UTC\+11:00.*UTC-12:00/);
  assert.doesNotMatch(sunriseSunset.promptText, /\d{4}-\d\d-\d\dT\d\d:/);
  assert.match(sunriseSunset.calculation, /解得4个交点/);
});

test('夏令时切换日的日出和视太阳正午应按事件时刻的历史偏移显示', () => {
  const eventLocalTime = (utcDateTime: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcDateTime));
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
  };
  for (const [month, day, hour, minute, referenceOffset] of [
    [3, 10, 1, 30, -5],
    [11, 3, 0, 30, -4],
  ]) {
    const evidence = calculateSolarIlluminationEvidence({
      year: 2024,
      month,
      day,
      hour,
      minute,
      timeZoneId: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.006,
    });
    assert.equal(evidence.timezone, referenceOffset);
    assert.ok(evidence.sunriseSunset.morningUtcDateTime);
    assert.equal(
      evidence.sunriseSunset.morningLocalDateTime,
      eventLocalTime(evidence.sunriseSunset.morningUtcDateTime!),
    );
    assert.equal(
      evidence.apparentSolarNoonLocalDateTime,
      eventLocalTime(evidence.apparentSolarNoonUtcDateTime),
    );
  }
});

test('经度端点在 UTC-12 和 UTC+14 应保持同子午线事件日期与时刻', () => {
  const calculateAt = (longitude: -180 | 180, timezone: -12 | 14) =>
    calculateSolarIlluminationEvidence({
      year: 2024,
      month: 1,
      day: 1,
      hour: 12,
      timezone,
      latitude: 0,
      longitude,
    });

  for (const timezone of [-12, 14] as const) {
    const west = calculateAt(-180, timezone);
    const east = calculateAt(180, timezone);
    assert.equal(west.apparentSolarNoonLocalDateTime, east.apparentSolarNoonLocalDateTime);
    assert.equal(west.apparentSolarNoonUtcDateTime, east.apparentSolarNoonUtcDateTime);
    assert.equal(west.sunriseSunset.morningLocalDateTime, east.sunriseSunset.morningLocalDateTime);
    assert.equal(west.sunriseSunset.eveningLocalDateTime, east.sunriseSunset.eveningLocalDateTime);
    assert.match(west.apparentSolarNoonLocalDateTime, /^2024-01-01 /);
    assert.match(west.sunriseSunset.morningLocalDateTime ?? '', /^2024-01-01 /);
    assert.match(west.sunriseSunset.eveningLocalDateTime ?? '', /^2024-01-01 /);
  }

  const crossingMidnight = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 1,
    day: 1,
    hour: 12,
    timezone: 0,
    latitude: 0,
    longitude: 180,
  });
  assert.match(crossingMidnight.apparentSolarNoonLocalDateTime, /^2024-01-01 00:/);
  assert.match(crossingMidnight.sunriseSunset.morningLocalDateTime ?? '', /^2024-01-01 17:/);
  assert.match(crossingMidnight.sunriseSunset.eveningLocalDateTime ?? '', /^2024-01-01 06:/);
  assert.ok(
    Date.parse(crossingMidnight.sunriseSunset.eveningUtcDateTime ?? '') <
      Date.parse(crossingMidnight.sunriseSunset.morningUtcDateTime ?? ''),
  );
});

test('西占应附带地点相关光照证据而不生成吉凶结论', () => {
  const astrolabe = generateAstrolabe({
    name: '测试',
    gender: 'unspecified',
    year: '2024',
    month: '6',
    day: '21',
    hour: '12',
    minute: '0',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
  });
  assert.equal(astrolabe.solarIllumination.sunriseSunset.status, '正常交点');
  const grazing = generateAstrolabe({
    name: '临界光照',
    gender: 'unspecified',
    year: '2024',
    month: '12',
    day: '21',
    hour: '12',
    minute: '0',
    latitude: '-65.729',
    longitude: '179.5',
    timezone: '0',
    useTrueSolarTime: true,
  });
  assert.equal(grazing.solarIllumination.sunriseSunset.status, '全天高于阈值');
  assert.equal(grazing.solarIllumination.referenceUtcDateTime, '2024-12-21 12:00:00Z');
  assert.equal(grazing.solarIllumination.localDate, '2024-12-21');
  assert.match(grazing.solarIllumination.sunriseSunset.promptText, /太阳上缘.*全天高于阈值/);
  assert.doesNotMatch(
    astrolabe.evidenceAnalysis?.promptText ?? '',
    /光照吉凶|日出成功率|太阳高度评分/,
  );
});
