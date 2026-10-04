import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateInstantChart } from '../packages/core/src/instant/index.ts';

const newYorkObserver = {
  longitude: -74.006,
  latitude: 40.7128,
  timeZoneId: 'America/New_York',
};

test('纽约回拨重复的 01:30 即时盘保留给定 UTC 时刻身份', async () => {
  for (const utcDateTime of ['2025-11-02T05:30:00.000Z', '2025-11-02T06:30:00.000Z']) {
    const customDate = new Date(utcDateTime);
    const expectedOffset = utcDateTime.includes('05:30') ? -4 : -5;

    const baziZiwei = await calculateInstantChart({
      type: 'bazi-ziwei',
      customDate,
      timeStandard: 'true-solar',
      observer: newYorkObserver,
    });
    assert.equal(baziZiwei.wallClock.hour, 1);
    assert.equal(baziZiwei.wallClock.minute, 30);
    assert.equal(baziZiwei.wallClock.offsetHours, expectedOffset);
    assert.equal(baziZiwei.trueSolarTime?.timezoneEvidence?.selectedUtcDateTime, utcDateTime);
    assert.ok(baziZiwei.result.bazi.pillars.hour.ganZhi);
    assert.equal(baziZiwei.result.ziwei.palaces.length, 12);

    const astrolabe = await calculateInstantChart({
      type: 'astrolabe',
      customDate,
      observer: newYorkObserver,
    });
    assert.equal(astrolabe.result.birth.timezoneEvidence?.selectedUtcDateTime, utcDateTime);

    const qizheng = await calculateInstantChart({
      type: 'qizheng',
      customDate,
      observer: newYorkObserver,
    });
    assert.equal(qizheng.result.calculationContext.utcDateTime, utcDateTime);
  }
});

test('即时盘拒绝与确定 UTC 时刻相冲突的观测地点固定偏移', async () => {
  await assert.rejects(
    calculateInstantChart({
      type: 'astrolabe',
      customDate: new Date('2025-11-02T05:30:00.000Z'),
      observer: { ...newYorkObserver, timezone: -5 },
    }),
    /固定偏移与排盘时刻的 IANA 实际偏移不一致/,
  );
});

test('异步即时盘固定传入时间，时间标签与盘面保持同一瞬时', async () => {
  const customDate = new Date('2024-06-01T16:20:00.000Z');
  const pending = calculateInstantChart({
    type: 'ziwei',
    customDate,
  });
  customDate.setUTCFullYear(2025);
  const response = await pending;
  assert.equal(response.generatedAt, '2024-06-01T16:20:00.000Z');
  assert.deepEqual(
    [response.wallClock.year, response.wallClock.month, response.wallClock.day],
    [2024, 6, 2],
  );
});

test('即时星盘和七政盘保留 UTC 分钟内秒数', async () => {
  const customDate = new Date('2025-05-05T05:57:37.000Z');
  const observer = { longitude: 116.4, latitude: 39.9, timezone: 8 };

  const astrolabe = await calculateInstantChart({ type: 'astrolabe', customDate, observer });
  assert.equal(astrolabe.wallClock.second, 37);
  assert.equal(astrolabe.result.birth.second, 37);

  const qizheng = await calculateInstantChart({ type: 'qizheng', customDate, observer });
  assert.equal(qizheng.result.calculationContext.utcDateTime, customDate.toISOString());
  assert.equal(qizheng.result.calculationContext.localDateTime, '2025-05-05T13:57:37');
});

test('真太阳时跨日前后八字与紫微沿用同一校正日期', async () => {
  const response = await calculateInstantChart({
    type: 'bazi-ziwei',
    customDate: new Date('2024-06-01T16:20:00.000Z'),
    timeStandard: 'true-solar',
    observer: { longitude: 87.6, timezone: 8 },
  });

  assert.deepEqual(
    [response.wallClock.year, response.wallClock.month, response.wallClock.day],
    [2024, 6, 2],
  );
  assert.match(response.trueSolarTime?.correctedDateTime ?? '', /^2024-06-01/u);
  assert.deepEqual(response.result.bazi.solarDate, { year: 2024, month: 6, day: 1 });
  assert.deepEqual(
    [
      response.result.bazi.timing?.correctedTime.year,
      response.result.bazi.timing?.correctedTime.month,
      response.result.bazi.timing?.correctedTime.day,
    ],
    [2024, 6, 1],
  );
  assert.match(response.result.ziwei.basicInfo.solar_date, /2024.*6.*1/u);
});
