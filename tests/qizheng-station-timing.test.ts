import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { scanQizhengPeriodEvents } from '../packages/core/src/qi_zheng/period-events.ts';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

const start = Date.UTC(2026, 0, 1);
const hour = 3_600_000;

test('罗睺低斜率停逆与独立六阶惯性速度的局部收敛及换向一致', () => {
  const astronomy = createRequire(new URL('../packages/core/package.json', import.meta.url))(
    'astronomy-engine',
  );
  const wrap = (value: number) => ((value + 540) % 360) - 180;
  // 六阶惯性速度先构造EQJ角动量，再旋转角动量；生产实现为四阶速度先旋转r、v。
  // 这是同一月球星历内的独立数值收敛参考，具体UTC由该参考求根，不作为观测金标。
  const referenceNode = (utcMs: number, stepSeconds: number) => {
    const time = astronomy.MakeTime(new Date(utcMs));
    const step = stepSeconds / 86_400;
    const center = astronomy.GeoMoon(time);
    const samples = [-3, -2, -1, 1, 2, 3].map((offset) =>
      astronomy.GeoMoon(time.AddDays(offset * step)),
    );
    const velocity = (axis: 'x' | 'y' | 'z') =>
      (45 * (samples[3][axis] - samples[2][axis]) -
        9 * (samples[4][axis] - samples[1][axis]) +
        (samples[5][axis] - samples[0][axis])) /
      (60 * step);
    const vx = velocity('x');
    const vy = velocity('y');
    const vz = velocity('z');
    const momentum = new astronomy.Vector(
      center.y * vz - center.z * vy,
      center.z * vx - center.x * vz,
      center.x * vy - center.y * vx,
      time,
    );
    const rotated = astronomy.RotateVector(astronomy.Rotation_EQJ_ECT(time), momentum);
    return ((Math.atan2(rotated.x, -rotated.y) * 180) / Math.PI + 360) % 360;
  };
  const referenceVelocity = (utcMs: number, stepSeconds: number) =>
    wrap(referenceNode(utcMs + 60_000, stepSeconds) - referenceNode(utcMs - 60_000, stepSeconds));
  const referenceRoot = (startUtc: number, endUtc: number, stepSeconds: number) => {
    let left = startUtc;
    let right = endUtc;
    let leftValue = referenceVelocity(left, stepSeconds);
    assert.notEqual(Math.sign(leftValue), Math.sign(referenceVelocity(right, stepSeconds)));
    for (let index = 0; index < 32; index += 1) {
      const mid = (left + right) / 2;
      const value = referenceVelocity(mid, stepSeconds);
      if (Math.sign(value) === Math.sign(leftValue)) {
        left = mid;
        leftValue = value;
      } else right = mid;
    }
    return (left + right) / 2;
  };
  const result = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    flowYear: 2024,
  });
  for (const [left, right, direction] of [
    [Date.UTC(2024, 3, 5, 12), Date.UTC(2024, 3, 5, 20), '顺行'],
    [Date.UTC(2024, 8, 11, 2), Date.UTC(2024, 8, 11, 9), '逆行'],
    [Date.UTC(2024, 9, 10, 12), Date.UTC(2024, 9, 10, 23), '顺行'],
  ] as const) {
    const matches = result.flowingStars!.periodEvents!.events.filter(
      (event) =>
        event.kind === '停逆' &&
        event.movingStar === '罗睺(火余)' &&
        event.utcMs > left &&
        event.utcMs < right,
    );
    assert.equal(matches.length, 1);
    const event = matches[0];
    assert.equal(event.stationDirection, direction);
    const references = [3600, 7200, 14400].map((step) => referenceRoot(left, right, step));
    assert.ok(Math.max(...references) - Math.min(...references) < 10_000, '六阶参考根应收敛');
    for (const reference of references) {
      assert.ok(Math.abs(event.utcMs - reference) < 10_000, '四阶停逆须接近独立六阶参考');
    }
    const sign = direction === '顺行' ? 1 : -1;
    assert.equal(Math.sign(referenceVelocity(event.utcMs - 60_000, 3600)), -sign);
    assert.equal(Math.sign(referenceVelocity(event.utcMs + 60_000, 3600)), sign);
    assert.ok(result.prompt.includes(event.promptText));
  }
});

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
