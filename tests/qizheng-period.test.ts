import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCivilTime } from '../packages/core/src/calendar/civil-time.ts';
import { calculateSolarTermEvidence } from '../packages/core/src/calendar/solar-term-evidence.ts';
import {
  generateQizheng,
  palaceIndexByLimitStep,
  resolveQizhengLimitDirection,
  resolveQizhengNominalAge,
  TWELVE_PALACES,
} from '../packages/core/src/qi_zheng/index.ts';
import { scanQizhengPeriodEvents } from '../packages/core/src/qi_zheng/period-events.ts';

const NATAL = {
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  latitude: 39.9042,
  longitude: 116.4074,
  timezone: 8,
} as const;

const NEW_YORK_SUMMER_BIRTH = {
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  latitude: 40.7128,
  longitude: -74.006,
  timezone: -4,
  timeZoneId: 'America/New_York',
} as const;

test('洞微大限按地支顺行，经相貌入福德，虚岁按流年减出生年加一', () => {
  assert.equal(resolveQizhengLimitDirection('male', '阳'), '顺行');
  assert.equal(resolveQizhengLimitDirection('female', '阴'), '顺行');
  assert.equal(resolveQizhengLimitDirection('male', '阴'), '顺行');
  assert.equal(resolveQizhengLimitDirection('female', '阳'), '顺行');
  assert.equal(resolveQizhengNominalAge(1990, 2024), 35);
  assert.equal(palaceIndexByLimitStep(0, '顺行'), 0);
  assert.equal(palaceIndexByLimitStep(1, '顺行'), 11);
  assert.equal(palaceIndexByLimitStep(1, '逆行'), 1);
  assert.equal(TWELVE_PALACES[palaceIndexByLimitStep(1, '顺行')], '相貌');
});

test('未给流年时七政只排本命静态盘，不冒充阶段资料', () => {
  const natal = generateQizheng(NATAL);
  assert.equal(natal.timeLords, undefined);
  assert.equal(natal.flowingStars, undefined);
  assert.match(natal.prompt, /出生时点静态结构/);
  assert.doesNotMatch(natal.prompt, /【行限】/);
  assert.doesNotMatch(natal.prompt, /【流曜】/);
});

test('给出性别与流年后应同时生成行限和流曜，并叠到本命十二宫', () => {
  const result = generateQizheng({
    ...NATAL,
    gender: 'male',
    flowYear: 2024,
    flowMonth: 3,
    flowDay: 15,
    flowHour: 12,
  });
  assert.ok(result.timeLords);
  assert.equal(result.timeLords?.nominalAge, 35);
  assert.equal(result.timeLords?.majorLimitStatus, '命度与交限待核定');
  assert.equal(result.timeLords?.currentMajorLimit, null);
  assert.deepEqual(result.timeLords?.majorLimits, []);
  assert.equal(
    result.timeLords?.majorPalaceYears.find((item) => item.palace === '福德')?.years,
    11,
  );
  assert.ok(result.flowingStars);
  assert.equal(result.flowingStars?.stars.length, 11);
  for (const star of result.flowingStars?.stars ?? []) {
    const natalPalace = result.twelvePalaces.find((item) => item.signIndex === star.signIndex);
    assert.equal(star.palace, natalPalace?.palace);
  }
  assert.match(result.prompt, /【行限】/);
  assert.match(result.prompt, /大限：命宫宿度、出童限岁数和当前大限宫位未定/);
  assert.match(result.prompt, /【流曜】/);
  assert.match(result.prompt, /【流曜周期】/);
  assert.equal(result.flowingStars?.periodEvents?.mode, 'daily');
  assert.equal(result.prompt.match(/当前大限宫位未定/g)?.length, 1);
  assert.doesNotMatch(result.prompt, /只解读根基、落宿、落宫和吊照/);
});

test('只有流年没有性别时只排流曜，不编造行限', () => {
  const result = generateQizheng({
    ...NATAL,
    flowYear: 2024,
  });
  assert.equal(result.timeLords, undefined);
  assert.ok(result.flowingStars);
  assert.match(result.flowingStars?.timestampNote ?? '', /立春/);
  assert.match(result.prompt, /【流曜】/);
  assert.match(result.prompt, /【流曜周期】/);
  assert.equal(result.flowingStars?.periodEvents?.mode, 'yearly');
  assert.ok((result.flowingStars?.periodEvents?.events.length ?? 0) > 0);
  assert.doesNotMatch(result.prompt, /【行限】/);
});

test('流年落宫取立春交节秒数时，行限太岁也应进入新年', () => {
  const result = generateQizheng({
    ...NATAL,
    gender: 'male',
    flowYear: 2024,
  });

  assert.equal(result.flowingStars?.localDateTime, '2024-02-04T16:27:07');
  assert.equal(result.timeLords?.annualBranch, '辰');
  assert.equal(result.timeLords?.annualPalace.signBranch, '辰');
  assert.match(result.prompt, /落宫时刻 2024-02-04T16:27:07/);
  assert.match(result.prompt, /流年太岁辰入辰宫/);

  const termUtc = calculateSolarTermEvidence(2024, 3).utcTimestamp;
  const termChart = generateQizheng({
    year: 2024,
    month: 2,
    day: 4,
    hour: 16,
    minute: 27,
    second: 7,
    timezone: 8,
  });
  assert.equal(
    result.flowingStars?.periodEvents?.events.every((item) => item.utcMs >= termUtc),
    true,
  );
  assert.equal(
    result.flowingStars?.stars.find((star) => star.name === '太阳')?.tropicalLongitude,
    termChart.stars.find((star) => star.name === '太阳')?.tropicalLongitude,
  );

  const newYork = generateQizheng({
    ...NEW_YORK_SUMMER_BIRTH,
    gender: 'male',
    flowYear: 2024,
  });
  assert.equal(newYork.flowingStars?.localDateTime, '2024-02-04T03:27:07');
  assert.equal(newYork.timeLords?.annualBranch, '辰');
});

test('流年上限 2200 的年度周期应闭合到次年立春', () => {
  const result = generateQizheng({
    ...NATAL,
    flowYear: 2200,
  });
  const flow = result.flowingStars;
  const period = flow?.periodEvents;
  assert.ok(flow);
  assert.ok(period);
  assert.equal(flow.year, 2200);
  assert.equal(period.mode, 'yearly');
  assert.match(period.startDateTime, /^2200-02-04 /);
  assert.match(period.endDateTime, /^2201-02-04 /);
  assert.equal(flow.stars.length, 11);
});

test('流年立春按目标 IANA 时区反解且不沿用出生时刻偏移', () => {
  const result = generateQizheng({
    ...NEW_YORK_SUMMER_BIRTH,
    flowYear: 2024,
  });
  const flow = result.flowingStars;
  assert.ok(flow);
  const lichunUtc = calculateSolarTermEvidence(2024, 3).utcTimestamp;
  const [localDate, localTime] = flow.localDateTime.split('T');
  const [localYear, localMonth, localDay] = localDate!.split('-').map(Number);
  const [localHour, localMinute, localSecond] = localTime!.split(':').map(Number);
  const flowUtc = resolveCivilTime({
    year: localYear!,
    month: localMonth!,
    day: localDay!,
    hour: localHour!,
    minute: localMinute!,
    second: localSecond!,
    timeZoneId: NEW_YORK_SUMMER_BIRTH.timeZoneId,
  }).utcTimestamp;
  assert.equal(flowUtc, lichunUtc);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK_SUMMER_BIRTH.timeZoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(lichunUtc));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  assert.equal(
    flow.localDateTime,
    `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`,
  );
});

test('巴黎 1900 年流年立春按秒级历史偏移保持同一 UTC 瞬时', () => {
  const result = generateQizheng({
    year: 1900,
    month: 1,
    day: 20,
    hour: 12,
    minute: 0,
    latitude: 48.8566,
    longitude: 2.3522,
    timeZoneId: 'Europe/Paris',
    flowYear: 1900,
  });
  const flow = result.flowingStars;
  assert.ok(flow);
  const lichunUtc = calculateSolarTermEvidence(1900, 3).utcTimestamp;
  const expectedParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(lichunUtc));
  const part = (type: string) => expectedParts.find((item) => item.type === type)?.value;
  assert.equal(
    flow.localDateTime,
    `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`,
  );
  const flowUtc = resolveCivilTime({
    year: flow.year,
    month: flow.month,
    day: flow.day,
    hour: flow.hour,
    minute: flow.minute,
    second: Number(part('second')),
    timeZoneId: 'Europe/Paris',
  }).utcTimestamp;
  assert.equal(flowUtc, lichunUtc);
  assert.match(result.prompt, /落宫时刻 1900-02-04T06:00:52/);
});

test('出生时刻的 IANA 与固定偏移冲突仍然拒绝排盘', () => {
  assert.throws(
    () =>
      generateQizheng({
        ...NEW_YORK_SUMMER_BIRTH,
        timezone: -5,
      }),
    /历史偏移不一致/,
  );
});

test('显式流日按纽约目标日期的冬夏偏移解析', () => {
  for (const target of [
    { month: 1, day: 15, expectedUtcOffset: -5 },
    { month: 7, day: 15, expectedUtcOffset: -4 },
  ]) {
    const input = {
      ...NEW_YORK_SUMMER_BIRTH,
      flowYear: 2024,
      flowMonth: target.month,
      flowDay: target.day,
      flowHour: 12,
    } as const;
    const result = generateQizheng(input);
    // 独立固定偏移盘只用于核验目标 UTC 瞬时，避免测试只比较同一份 wall time 标签。
    const fixedOffsetResult = generateQizheng({
      ...input,
      timezone: target.expectedUtcOffset,
      timeZoneId: undefined,
    });
    const flow = result.flowingStars;
    const fixedFlow = fixedOffsetResult.flowingStars;
    assert.ok(flow);
    assert.ok(fixedFlow);
    const expectedUtc =
      Date.UTC(2024, target.month - 1, target.day, 12) - target.expectedUtcOffset * 3_600_000;
    const flowUtc = resolveCivilTime({
      year: flow.year,
      month: flow.month,
      day: flow.day,
      hour: flow.hour,
      minute: flow.minute,
      second: 0,
      timeZoneId: NEW_YORK_SUMMER_BIRTH.timeZoneId,
    }).utcTimestamp;
    assert.equal(flowUtc, expectedUtc);
    assert.equal(
      flow.stars.find((star) => star.name === '太阳')?.tropicalLongitude,
      fixedFlow.stars.find((star) => star.name === '太阳')?.tropicalLongitude,
    );
    assert.equal(
      flow.localDateTime,
      `2024-${String(target.month).padStart(2, '0')}-${String(target.day).padStart(2, '0')}T12:00:00`,
    );
  }
});

test('纽约夏令时跳时日的周期事件按每个 UTC 瞬时实际偏移格式化', () => {
  const hour = 3_600_000;
  // 2024-03-10 06:00Z 是纽约 01:00 EST，07:00Z 已跳到 03:00 EDT。
  const startUtcMs = Date.UTC(2024, 2, 10, 6);
  const result = scanQizhengPeriodEvents({
    natalStars: [],
    twelvePalaces: [],
    startUtcMs,
    endUtcMs: startUtcMs + 2 * hour,
    // 故意保留出生夏季偏移；IANA 格式化必须在每个事件时刻读取实际偏移。
    timezone: -4,
    timeZoneId: 'America/New_York',
    mode: 'daily',
    sampleLongitudes: (utcMs) => [{ name: '太阳', longitude: 28.5 + (utcMs - startUtcMs) / hour }],
  });
  assert.equal(result.startDateTime, '2024-03-10 01:00');
  assert.equal(result.endDateTime, '2024-03-10 04:00');
  const ingress = result.events.find((event) => event.kind === '换宫');
  assert.ok(ingress);
  assert.ok(Math.abs(ingress.utcMs - Date.UTC(2024, 2, 10, 7, 30)) < 1000);
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ingress.utcMs));
  const part = (type: string) => localParts.find((item) => item.type === type)?.value;
  assert.equal(
    ingress.dateTime,
    `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`,
  );
  assert.match(ingress.promptText, /^2024-03-10 03:/);
});

test('纽约三月流月周期按两个 IANA 午夜解析并跨越夏令时少一小时', () => {
  const result = generateQizheng({
    ...NEW_YORK_SUMMER_BIRTH,
    flowYear: 2024,
    flowMonth: 3,
  });
  const period = result.flowingStars?.periodEvents;
  assert.ok(period);
  const expectedStartUtc = resolveCivilTime({
    year: 2024,
    month: 3,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timeZoneId: NEW_YORK_SUMMER_BIRTH.timeZoneId,
  }).utcTimestamp;
  const expectedEndUtc = resolveCivilTime({
    year: 2024,
    month: 4,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timeZoneId: NEW_YORK_SUMMER_BIRTH.timeZoneId,
  }).utcTimestamp;
  assert.equal(expectedEndUtc - expectedStartUtc, 31 * 86_400_000 - 3_600_000);
  assert.ok(period.events.length > 0);
  assert.ok(
    period.events.every(
      (event) => event.utcMs >= expectedStartUtc && event.utcMs <= expectedEndUtc,
    ),
  );
  assert.equal(period.startDateTime, '2024-03-01 00:00');
  assert.equal(period.endDateTime, '2024-04-01 00:00');
});

test('纽约跳时和回拨日的扫描周期均止于次日当地午夜', () => {
  for (const target of [
    { month: 3, day: 10, hours: 23, startUtc: Date.UTC(2024, 2, 10, 5) },
    { month: 11, day: 3, hours: 25, startUtc: Date.UTC(2024, 10, 3, 4) },
  ]) {
    const period = generateQizheng({
      ...NEW_YORK_SUMMER_BIRTH,
      flowYear: 2024,
      flowMonth: target.month,
      flowDay: target.day,
    }).flowingStars?.periodEvents;
    assert.ok(period);
    const month = String(target.month).padStart(2, '0');
    assert.equal(
      period.startDateTime,
      `2024-${month}-${String(target.day).padStart(2, '0')} 00:00`,
    );
    assert.equal(
      period.endDateTime,
      `2024-${month}-${String(target.day + 1).padStart(2, '0')} 00:00`,
    );
    assert.ok(period.events.length > 0);
    assert.ok(
      period.events.every(
        (event) =>
          event.utcMs >= target.startUtc &&
          event.utcMs <= target.startUtc + target.hours * 3_600_000,
      ),
    );
  }
});

test('圣地亚哥午夜跳时日从首个真实时刻扫描至次日零时', () => {
  const result = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: -33.4489,
    longitude: -70.6693,
    timeZoneId: 'America/Santiago',
    flowYear: 2024,
    flowMonth: 9,
    flowDay: 8,
  });
  const period = result.flowingStars?.periodEvents;
  assert.ok(period);
  assert.equal(period.mode, 'daily');
  assert.equal(period.startDateTime, '2024-09-08 01:00');
  assert.equal(period.endDateTime, '2024-09-09 00:00');
  const startUtc = Date.UTC(2024, 8, 8, 4);
  const endUtc = Date.UTC(2024, 8, 9, 3);
  assert.ok(period.events.every((event) => event.utcMs >= startUtc && event.utcMs < endUtc));
});
