import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { scanQizhengPeriodEvents } from '../packages/core/src/qi_zheng/period-events.ts';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

const start = Date.UTC(2026, 0, 1);
const hour = 3_600_000;

test('真实水星与土星停逆时刻前后速度换向，并接近局部黄经极值', () => {
  const astronomy = createRequire(new URL('../packages/core/package.json', import.meta.url))(
    'astronomy-engine',
  );
  const result = generateQizheng({
    year: 1993,
    month: 4,
    day: 8,
    hour: 23,
    minute: 34,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    flowYear: 2022,
    flowMonth: 6,
  });
  const events = result.flowingStars!.periodEvents!.events;
  for (const [name, body, direction] of [
    ['辰星(水)', astronomy.Body.Mercury, 1],
    ['镇星(土)', astronomy.Body.Saturn, -1],
  ] as const) {
    const matches = events.filter((event) => event.kind === '停逆' && event.movingStar === name);
    assert.equal(matches.length, 1);
    const utc = matches[0].utcMs;
    const longitude = (time: number) =>
      astronomy.Ecliptic(astronomy.GeoVector(body, astronomy.MakeTime(new Date(time)), true)).elon;
    const delta = (first: number, second: number) => ((second - first + 540) % 360) - 180;
    const left = delta(longitude(utc - hour), longitude(utc - 30 * 60_000));
    const right = delta(longitude(utc + 30 * 60_000), longitude(utc + hour));
    assert.equal(Math.sign(left), -direction);
    assert.equal(Math.sign(right), direction);
    const center = longitude(utc);
    assert.ok(delta(center, longitude(utc - 60_000)) * direction > 0);
    assert.ok(delta(center, longitude(utc + 60_000)) * direction > 0);
  }
});
for (const mode of ['daily', 'monthly', 'yearly'] as const) {
  for (const direction of [1, -1]) {
    test(`七政${mode}停逆由瞬时速度定时并区分${direction === 1 ? '逆转顺' : '顺转逆'}`, () => {
      for (const at of [0, 0.5, 8, 11, 12, 17, 24, 47.5, 48, 72, 96]) {
        const result = scanQizhengPeriodEvents({
          natalStars: [],
          twelvePalaces: [],
          startUtcMs: start,
          endUtcMs: start + 96 * hour,
          timezone: 0,
          mode,
          sampleLongitudes: (utc) => [
            {
              name: '太阳',
              longitude: (360 + direction * 0.001 * ((utc - start) / hour - at) ** 2) % 360,
            },
          ],
        });
        const events = result.events.filter((event) => event.kind === '停逆');
        assert.equal(events.length, at === 96 ? 0 : 1, `${mode}转向小时${at}`);
        if (at === 96) continue;
        assert.ok(
          Math.abs(events[0].utcMs - (start + at * hour)) < 2000,
          `真实${at}小时，计算${(events[0].utcMs - start) / hour}小时`,
        );
        assert.equal(events[0].stationDirection, direction === 1 ? '顺行' : '逆行');
      }
    });
  }
}

test('静止与单向跨黄经零度均不产生停逆', () => {
  for (const speed of [0, 0.1, -0.1]) {
    const result = scanQizhengPeriodEvents({
      natalStars: [],
      twelvePalaces: [],
      startUtcMs: start,
      endUtcMs: start + 48 * hour,
      timezone: 0,
      mode: 'monthly',
      sampleLongitudes: (utc) => [
        { name: '太阳', longitude: (360 + speed * ((utc - start) / hour - 12)) % 360 },
      ],
    });
    assert.equal(result.events.filter((event) => event.kind === '停逆').length, 0);
  }
});
