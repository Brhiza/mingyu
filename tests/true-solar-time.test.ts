import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTrueSolarTime,
  checkChinaDst,
  convertTrueSolarTime,
  getShichenByIndex,
  parseLocalDateTime,
  resolveTrueSolarBirthTime,
} from 'mingyu-core/calendar';
import { calculateTrueSolarTime as legacyCalculateTrueSolarTime } from '../packages/core/src/bazi/trueSolarTime.ts';
import { checkChinaDst as legacyCheckChinaDst } from '../packages/core/src/bazi/chinaDst.ts';

type TrueSolarEvidenceResult =
  ReturnType<typeof convertTrueSolarTime> | ReturnType<typeof resolveTrueSolarBirthTime>;

function assertTrueSolarEvidence(result: TrueSolarEvidenceResult) {
  const stepKeys = new Set(result.calculationSteps.map((item) => item.key));
  const factKeys = new Set([result.summaryFact.key, ...result.summaryFact.factKeys]);
  assert.deepEqual(
    result.calculationChain,
    result.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(result.summaryFact.calculationStepCount, result.calculationSteps.length);
  assert.equal(result.summaryFact.correctionFactCount, result.correctionFacts.length);
  assert.equal(result.summaryFact.limitationFactCount, result.limitationFacts.length);
  assert.ok(
    result.correctionFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(
    result.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerStepKeys.length > 0 &&
        item.ownerStepKeys.every((key) => stepKeys.has(key)),
    ),
  );
  assert.ok(
    [
      ...result.calculationSteps,
      ...result.correctionFacts,
      result.summaryFact,
      ...result.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
  assert.match(result.promptText, /计算链：/);
  assert.match(result.promptText, /证据汇总：/);
  assert.doesNotMatch(result.promptText, /候选时辰为|出生时间敏感性|缺少时柱/);
}

test('真太阳时公共入口应按瞬时星历计算并保持新旧入口一致', () => {
  const result = convertTrueSolarTime({
    localDateTime: '1990-05-15T10:30:20',
    longitude: 116.4074,
  });
  const raw = calculateTrueSolarTime(
    { year: 1990, month: 5, day: 15, hour: 10, minute: 30, second: 20 },
    116.4074,
    120,
  );
  const legacy = legacyCalculateTrueSolarTime(
    { year: 1990, month: 5, day: 15, hour: 10, minute: 30, second: 20 },
    116.4074,
    120,
  );

  assert.deepEqual(legacy, raw);
  assert.deepEqual(result.correctedTime, raw.correctedTime);
  assert.equal(result.standardDateTime, '1990-05-15T10:30:20');
  assert.equal(result.timezone, 8);
  assert.equal(result.standardMeridian, 120);
  assert.equal(result.crossesDate, false);
  assert.equal(result.shichen.name, '巳时');
  assert.equal(result.status, '已计算');
  assert.equal(result.summaryFact.status, '证据链完整');
  assertTrueSolarEvidence(result);
  assert.deepEqual(legacyCheckChinaDst(1988, 7, 15, 12), checkChinaDst(1988, 7, 15, 12));

  // JPL Horizons 地心视赤经与格林尼治视恒星时，扣除 DUT1 后计算的固定均时差。
  // https://ssd.jpl.nasa.gov/horizons/manual.html
  for (const reference of [
    { localDateTime: '2024-02-01T12:00:00', minutes: -13.427761494 },
    { localDateTime: '2024-06-21T12:00:00', minutes: -1.849686703333 },
    { localDateTime: '2024-11-03T23:55:00', minutes: 16.448566695333 },
  ]) {
    const evidence = convertTrueSolarTime({
      localDateTime: reference.localDateTime,
      longitude: 120,
      timezone: 8,
    });
    assert.ok(
      Math.abs(evidence.equationOfTimeMinutes - reference.minutes) * 60 < 1,
      reference.localDateTime,
    );
    const step = evidence.calculationSteps.find((item) => item.stage === '均时差计算');
    assert.equal(
      step?.inputs.utcDateTime,
      new Date(Date.parse(`${reference.localDateTime}Z`) - 8 * 3600000).toISOString(),
    );
    assert.match(step?.promptText ?? '', /太阳地心视赤经与格林尼治视恒星时/);
  }

  const original = structuredClone(result);
  Object.assign(getShichenByIndex(5)!, {
    name: '本次备注',
    branch: '子',
    index: 0,
    hour: 0,
    minute: 30,
  });
  const repeated = convertTrueSolarTime({
    localDateTime: '1990-05-15T10:30:20',
    longitude: 116.4074,
  });
  assert.equal(repeated.shichen.name, '巳时');
  assert.equal(repeated.shichen.index, 5);
  assert.equal(repeated.shichen.branch, '巳');
  assert.deepEqual(repeated, original);
});

test('真太阳时便捷入口应可选自动还原中国历史夏令时', () => {
  const withoutDst = convertTrueSolarTime({
    localDateTime: '1988-07-15T12:00',
    longitude: 116.4074,
  });
  const withDst = convertTrueSolarTime({
    localDateTime: '1988-07-15T12:00',
    longitude: 116.4074,
    applyChinaDst: true,
  });

  assert.equal(withoutDst.standardDateTime, '1988-07-15T12:00:00');
  assert.equal(withoutDst.chinaDst.requested, false);
  assert.equal(withDst.clockDateTime, '1988-07-15T12:00:00');
  assert.equal(withDst.standardDateTime, '1988-07-15T11:00:00');
  assert.equal(withDst.chinaDst.applied, true);
  assert.equal(withDst.chinaDst.offsetMinutes, -60);
  assert.equal(
    withDst.correctionFacts.find((item) => item.type === '历史夏令时')?.correctionMinutes,
    -60,
  );
  assertTrueSolarEvidence(withoutDst);
  assertTrueSolarEvidence(withDst);
});

test('真太阳时便捷入口应识别跨日并支持全球时区', () => {
  const kashgar = convertTrueSolarTime({
    localDateTime: '2020-08-01T00:40',
    longitude: 75.99,
    timezone: 8,
  });
  assert.equal(kashgar.crossesDate, true);
  assert.equal(kashgar.correctedTime.day, 31);
  assert.equal(kashgar.correctionFacts.find((item) => item.type === '跨日结果')?.status, '已确定');
  assertTrueSolarEvidence(kashgar);

  const utcPlus14 = convertTrueSolarTime({
    localDateTime: '2026-07-10T12:00',
    longitude: 170,
    timezone: 14,
  });
  assert.equal(utcPlus14.standardMeridian, 210);

  // JPL 固定样本对应 23:00:05.427 和翌日 00:00:05.087，均位于日界与时辰界的确定一侧。
  for (const reference of [
    {
      localDateTime: '2024-02-01T23:13:35',
      corrected: '2024-02-01T23:00:05',
      index: 12,
      name: '晚子时',
    },
    {
      localDateTime: '2024-02-02T00:13:35',
      corrected: '2024-02-02T00:00:05',
      index: 0,
      name: '早子时',
    },
  ]) {
    const evidence = convertTrueSolarTime({
      localDateTime: reference.localDateTime,
      longitude: 120,
      timezone: 8,
    });
    assert.ok(
      Math.abs(
        Date.parse(`${evidence.correctedDateTime}Z`) - Date.parse(`${reference.corrected}Z`),
      ) < 1000,
      reference.localDateTime,
    );
    assert.equal(evidence.shichen.index, reference.index);
    assert.equal(evidence.shichen.name, reference.name);
    assert.equal(evidence.crossesDate, false);
  }
});

test('日期线两侧的真太阳时保留完整日期，并与同一瞬时的相邻时区结果一致', () => {
  const kiritimati = convertTrueSolarTime({
    localDateTime: '2026-07-10T12:00:00',
    longitude: -157.4,
    timeZoneId: 'Pacific/Kiritimati',
  });
  assert.equal(kiritimati.timezone, 14);
  assert.ok(Math.abs(kiritimati.longitudeCorrectionMinutes + 1469.6) < 1e-9);
  assert.equal(kiritimati.correctedTime.day, 9);
  assert.equal(kiritimati.crossesDate, true);
  const sameKiritimatiInstant = convertTrueSolarTime({
    localDateTime: '2026-07-09T12:00:00',
    longitude: -157.4,
    timezone: -10,
  });
  assert.deepEqual(kiritimati.correctedTime, sameKiritimatiInstant.correctedTime);

  const westernDateLine = convertTrueSolarTime({
    localDateTime: '2026-07-10T12:00:00',
    longitude: 179,
    timezone: -12,
  });
  assert.equal(westernDateLine.longitudeCorrectionMinutes, 1436);
  assert.equal(westernDateLine.correctedTime.day, 11);
  assert.equal(westernDateLine.crossesDate, true);
  const sameWesternInstant = convertTrueSolarTime({
    localDateTime: '2026-07-11T12:00:00',
    longitude: 179,
    timezone: 12,
  });
  assert.deepEqual(westernDateLine.correctedTime, sameWesternInstant.correctedTime);
});

test('真太阳时输入年份边界跨年后仍计算均时差并传递唯一校正日期', () => {
  const first = convertTrueSolarTime({
    localDateTime: '1900-01-01T00:00:00',
    longitude: -180,
    timezone: 8,
  });
  assert.equal(first.correctedTime.year, 1899);
  assert.equal(first.correctedTime.month, 12);
  assert.equal(first.correctedTime.day, 31);
  assert.equal(first.crossesDate, true);
  assert.ok(Number.isFinite(first.equationOfTimeMinutes));
  assert.match(first.promptText, /1899-12-31/);

  const last = convertTrueSolarTime({
    localDateTime: '2100-12-31T23:00:00',
    longitude: 180,
    timezone: -12,
  });
  assert.equal(last.correctedTime.year, 2101);
  assert.equal(last.correctedTime.month, 1);
  assert.equal(last.correctedTime.day, 1);
  assert.equal(last.crossesDate, true);
  assert.ok(Number.isFinite(last.equationOfTimeMinutes));
  assert.match(last.promptText, /2101-01-01/);
});

test('真太阳时应按 IANA 历史时区解析偏移并保留证据', () => {
  const result = convertTrueSolarTime({
    localDateTime: '2024-07-01T12:00:00',
    longitude: -74.006,
    timeZoneId: 'America/New_York',
  });

  assert.equal(result.timezone, -4);
  assert.equal(result.timeZoneId, 'America/New_York');
  assert.equal(result.timezoneEvidence?.resolvedOffsetHours, -4);
  assert.equal(result.timezoneEvidence?.status, 'unique');
  assert.equal(
    result.correctionFacts.some((item) => item.type === '历史时区'),
    true,
  );
  assert.equal(
    result.calculationSteps.some((item) => item.stage === '历史时区解析'),
    true,
  );
  assert.match(result.promptText, /America\/New_York.*UTC-04:00/);
  assertTrueSolarEvidence(result);
});

test('夏令时跨午夜时 IANA 与标准时加历史夏令时两种口径应得到相同真太阳时', () => {
  const localDateTime = '1990-07-01T00:30:00';
  const longitude = 121.47;
  const historicalZone = convertTrueSolarTime({
    localDateTime,
    longitude,
    timeZoneId: 'Asia/Shanghai',
  });
  const standardOffset = convertTrueSolarTime({
    localDateTime,
    longitude,
    timezone: 8,
    applyChinaDst: true,
  });

  assert.equal(historicalZone.timezoneEvidence?.selectedUtcDateTime, '1990-06-30T15:30:00.000Z');
  assert.equal(standardOffset.standardDateTime, '1990-06-30T23:30:00');
  assert.equal(historicalZone.equationOfTimeMinutes, standardOffset.equationOfTimeMinutes);
  assert.equal(historicalZone.correctedDateTime, standardOffset.correctedDateTime);
  assert.equal(historicalZone.shichen.name, standardOffset.shichen.name);

  const beforeMidnight = convertTrueSolarTime({
    localDateTime: '2024-02-01T23:59:59',
    longitude: 120,
    timezone: 8,
  });
  const afterMidnight = convertTrueSolarTime({
    localDateTime: '2024-02-02T00:00:00',
    longitude: 120,
    timezone: 8,
  });
  assert.equal(
    Date.parse(`${afterMidnight.correctedDateTime}Z`) -
      Date.parse(`${beforeMidnight.correctedDateTime}Z`),
    1000,
  );
  assert.ok(
    Math.abs(afterMidnight.equationOfTimeMinutes - beforeMidnight.equationOfTimeMinutes) * 60 <
      0.001,
  );
});

test('真太阳时应严格处理 IANA 跳时、回拨消歧和冲突组合', () => {
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '2024-03-10T02:30:00',
        longitude: -74.006,
        timeZoneId: 'America/New_York',
      }),
    /不存在.*夏令时跳时/,
  );
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '2024-11-03T01:30:00',
        longitude: -74.006,
        timeZoneId: 'America/New_York',
      }),
    /回拨歧义.*timezone/,
  );

  const resolved = convertTrueSolarTime({
    localDateTime: '2024-11-03T01:30:00',
    longitude: -74.006,
    timezone: -5,
    timeZoneId: 'America/New_York',
  });
  assert.equal(resolved.timezone, -5);
  assert.equal(resolved.timezoneEvidence?.selectedUtcDateTime, '2024-11-03T06:30:00.000Z');
  assert.equal(resolved.summaryFact.status, '历史时区歧义已消解');

  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '2024-07-01T12:00:00',
        longitude: -74.006,
        timezone: -5,
        timeZoneId: 'America/New_York',
      }),
    /固定偏移.*历史偏移不一致/,
  );
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '1990-07-01T12:00:00',
        longitude: 121.47,
        timeZoneId: 'Asia/Shanghai',
        applyChinaDst: true,
      }),
    /不能同时启用 applyChinaDst/,
  );
});

test('真太阳时便捷入口应拒绝含时区后缀、非法日期和越界参数', () => {
  assert.throws(() => parseLocalDateTime('2026-07-10T12:00:00+08:00'), /不要附带时区偏移/);
  assert.throws(
    () => convertTrueSolarTime({ localDateTime: '2026-02-30T12:00', longitude: 116.4 }),
    /日期需在/,
  );
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '2026-07-10T12:00',
        longitude: 116.4,
        timezone: 15,
      }),
    /timezone\s*需在/,
  );
});

test('公历出生日期不得返回农历闰月标记', () => {
  assert.throws(
    () =>
      resolveTrueSolarBirthTime({
        dateType: 'solar',
        year: 2024,
        month: 2,
        day: 10,
        hour: 12,
        minute: 0,
        isLeapMonth: true,
        longitude: 116.4,
      }),
    /公历日期不能设置农历闰月/,
  );
});

test('旧中国夏令时兼容模式应拒绝跳时缺口和未消歧重复时段', () => {
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '1988-04-17T02:30:00',
        longitude: 116.4074,
        applyChinaDst: true,
      }),
    /夏令时跳时缺口.*不存在/,
  );
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '1988-09-11T01:30:00',
        longitude: 116.4074,
        applyChinaDst: true,
      }),
    /夏令时回拨重复时段.*timeZoneId=Asia\/Shanghai/,
  );
});

test('中国历史夏令时校正不应套用到其他固定时区', () => {
  assert.throws(
    () =>
      convertTrueSolarTime({
        localDateTime: '1988-07-15T12:00:00',
        longitude: -74.006,
        timezone: -5,
        applyChinaDst: true,
      }),
    /中国历史夏令时校正仅适用于东八区/,
  );
});

test('统一出生真太阳时入口应处理公历、农历、跨日和时辰索引', () => {
  const solar = resolveTrueSolarBirthTime({
    dateType: 'solar',
    year: 2020,
    month: 8,
    day: 1,
    hour: 0,
    minute: 40,
    longitude: 75.99,
    timezone: 8,
  });
  assert.equal(solar.inputDateType, 'solar');
  assert.equal(solar.crossesDate, true);
  assert.equal(solar.correctedTime.day, 31);
  assert.equal(solar.timeIndex, solar.shichen.index);

  const lunar = resolveTrueSolarBirthTime({
    dateType: 'lunar',
    year: 1990,
    month: 5,
    day: 23,
    hour: 12,
    minute: 0,
    longitude: 116.4074,
    timezone: 8,
  });
  assert.equal(lunar.inputDateType, 'lunar');
  assert.notEqual(lunar.solarClockTime.month, 5);
  assert.match(lunar.solarClockDateTime, /^1990-\d{2}-\d{2}T12:00:00$/);
  assert.ok(lunar.timeIndex >= 0 && lunar.timeIndex <= 12);
  assert.equal(solar.calculationSteps[0].stage, '历法输入换算');
  assert.equal(lunar.calculationSteps[0].status, '已换算');
  assert.equal(lunar.correctionFacts[0].type, '历法输入');
  assertTrueSolarEvidence(solar);
  assertTrueSolarEvidence(lunar);
});

test('统一出生真太阳时入口应集中处理中国历史夏令时', () => {
  const result = resolveTrueSolarBirthTime({
    dateType: 'solar',
    year: 1988,
    month: 7,
    day: 15,
    hour: 12,
    minute: 0,
    longitude: 116.4074,
    timezone: 8,
    applyChinaDst: true,
  });
  assert.equal(result.chinaDst.applied, true);
  assert.equal(result.standardDateTime, '1988-07-15T11:00:00');
});
