import test from 'node:test';
import assert from 'node:assert/strict';
import { scanQizhengPeriodEvents } from '../packages/core/src/qi_zheng/period-events.ts';

const start = Date.UTC(2022, 5, 1);
const hour = 3_600_000;
const normalize = (angle: number) => ((angle % 360) + 360) % 360;

for (const direction of [1, -1]) {
  test(`七政精确吊照${direction === 1 ? '顺行' : '逆行'}跨越角度边界时不产生对侧假事件`, () => {
    for (const [target, expected] of [
      [0, '同宫'],
      [60, '六合'],
      [90, '四正'],
      [120, '三方'],
      [180, '对照'],
      [240, '三方'],
      [270, '四正'],
      [300, '六合'],
    ] as const) {
      const result = scanQizhengPeriodEvents({
        natalStars: [{ name: '本命星', longitude: 17 }],
        twelvePalaces: [],
        startUtcMs: start,
        endUtcMs: start + hour,
        timezone: 8,
        mode: 'daily',
        sampleLongitudes: (utcMs) => [
          {
            name: '太阳',
            longitude: normalize(17 + target + direction * ((utcMs - start) / hour - 0.37)),
          },
        ],
      });
      const aspects = result.events.filter((event) => event.kind === '精确吊照');
      assert.deepEqual(
        aspects.map((event) => event.aspectType),
        [expected],
        `实际夹角经过${target}度时应只有${expected}`,
      );
      assert.ok(Math.abs(aspects[0].utcMs - (start + 0.37 * hour)) < 1000);
      const angle = Math.min(target, 360 - target);
      assert.ok(
        aspects[0].promptText.includes(
          `精确吊照：流曜太阳与本命本命星成${expected === '同宫' ? '合相' : expected}（${aspects[0].aspectDirection}），目标角${angle}°`,
        ),
      );
      assert.ok(result.promptText.split('\n').includes(aspects[0].promptText));
    }
  });
}

const boundaryStart = Date.UTC(2030, 0, 1);
const boundaryHour = 3_600_000;
const boundaryPalaces = [
  { palace: '命宫', signIndex: 0, signBranch: '戌' as const },
  { palace: '财帛', signIndex: 1, signBranch: '酉' as const },
];

function scanBoundaryTrack(
  endOffsetHours: number,
  longitudeAt: (hours: number) => number,
  natalLongitude = 330,
) {
  return scanQizhengPeriodEvents({
    natalStars: [{ name: '本命星', longitude: natalLongitude }],
    twelvePalaces: boundaryPalaces,
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + endOffsetHours * boundaryHour,
    timezone: 0,
    mode: 'daily',
    sampleLongitudes: (utcMs) => [
      { name: '太阳', longitude: longitudeAt((utcMs - boundaryStart) / boundaryHour) },
    ],
  });
}

test('七政周期扫描遵守半开端点且保留内部采样点事件', () => {
  const atExclusiveEnd = scanBoundaryTrack(1, (hours) => 29 + hours);
  assert.equal(atExclusiveEnd.events.filter((event) => event.kind === '换宫').length, 0);
  assert.equal(atExclusiveEnd.events.filter((event) => event.kind === '精确吊照').length, 0);

  const reverseAtExclusiveEnd = scanBoundaryTrack(1, (hours) => 31 - hours);
  assert.equal(reverseAtExclusiveEnd.events.filter((event) => event.kind === '换宫').length, 0);
  assert.equal(reverseAtExclusiveEnd.events.filter((event) => event.kind === '精确吊照').length, 0);

  // 终点换宫被排除时，同一颗星在窗口内部的另一相位仍须保留。
  const endpointWithOtherAspect = scanBoundaryTrack(1, (hours) => 29 + hours, 329.5);
  assert.equal(endpointWithOtherAspect.events.filter((event) => event.kind === '换宫').length, 0);
  const otherAspect = endpointWithOtherAspect.events.find((event) => event.kind === '精确吊照');
  assert.ok(otherAspect);
  assert.ok(otherAspect.utcMs > boundaryStart && otherAspect.utcMs < boundaryStart + boundaryHour);

  const atInternalGrid = scanBoundaryTrack(2, (hours) => 29 + hours);
  const ingress = atInternalGrid.events.filter((event) => event.kind === '换宫');
  const aspects = atInternalGrid.events.filter((event) => event.kind === '精确吊照');
  assert.equal(ingress.length, 1);
  assert.equal(aspects.length, 1);
  assert.equal(ingress[0]!.utcMs, boundaryStart + boundaryHour);
  assert.equal(aspects[0]!.utcMs, boundaryStart + boundaryHour);
  assert.equal(aspects[0]!.aspectDirection, '正向');

  const reverseAtInternalGrid = scanBoundaryTrack(2, (hours) => 31 - hours);
  const reverseIngress = reverseAtInternalGrid.events.filter((event) => event.kind === '换宫');
  const reverseAspect = reverseAtInternalGrid.events.filter((event) => event.kind === '精确吊照');
  assert.equal(reverseIngress.length, 1);
  assert.equal(reverseAspect.length, 1);
  assert.equal(reverseIngress[0]!.utcMs, boundaryStart + boundaryHour);
  assert.equal(reverseAspect[0]!.utcMs, boundaryStart + boundaryHour);
});

test('七政周期扫描包含起点换宫与正向夹角，不把方向写成顺逆行', () => {
  const result = scanBoundaryTrack(1, (hours) => 30 - hours, 210);
  const ingress = result.events.find((event) => event.kind === '换宫');
  const aspect = result.events.find((event) => event.kind === '精确吊照');
  assert.ok(ingress);
  assert.ok(aspect);
  assert.equal(ingress.utcMs, boundaryStart);
  assert.equal(aspect.utcMs, boundaryStart);
  assert.equal(aspect.aspectDirection, '正向');
  assert.match(aspect.promptText, /（正向）/u);
  assert.ok(result.axis.some((item) => item.includes('（正向）')));
  assert.doesNotMatch(aspect.promptText, /顺行|逆行/u);

  const forward = scanBoundaryTrack(1, (hours) => 30 + hours, 210);
  const forwardIngress = forward.events.find((event) => event.kind === '换宫');
  const forwardAspect = forward.events.find((event) => event.kind === '精确吊照');
  assert.ok(forwardIngress);
  assert.ok(forwardAspect);
  assert.equal(forwardIngress.utcMs, boundaryStart);
  assert.equal(forwardAspect.utcMs, boundaryStart);
});

test('七政周期扫描保留同类夹角的正逆向多次出现', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [{ name: '本命星', longitude: 0 }],
    twelvePalaces: [],
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + 8 * boundaryHour,
    timezone: 0,
    mode: 'daily',
    sampleLongitudes: (utcMs) => {
      const hours = (utcMs - boundaryStart) / boundaryHour;
      return [{ name: '太阳', longitude: 120 * Math.sin((Math.PI * hours) / 4) }];
    },
  });
  const sextiles = result.events.filter(
    (event) => event.kind === '精确吊照' && event.aspectType === '六合',
  );
  assert.ok(sextiles.filter((event) => event.aspectDirection === '正向').length >= 2);
  assert.ok(sextiles.filter((event) => event.aspectDirection === '逆向').length >= 2);
  assert.ok(sextiles.every((event) => !/顺行|逆行/u.test(event.promptText)));
});

test('周期主轴筛出重点事件后仍按实际发生时序列示', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [{ name: '本命星', longitude: 28.5 }],
    twelvePalaces: boundaryPalaces,
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + 6 * boundaryHour,
    timezone: 0,
    mode: 'daily',
    sampleLongitudes: (utcMs) => {
      const hours = (utcMs - boundaryStart) / boundaryHour;
      return [{ name: '太阳', longitude: 28 + 2 * hours - (hours * hours) / 3 }];
    },
  });
  const axisEvents = result.axis.map((line) =>
    result.events.find((event) => event.promptText === line),
  );
  assert.ok(axisEvents.length >= 4);
  assert.ok(axisEvents.every((event) => event));
  assert.equal(axisEvents[0]!.kind, '精确吊照');
  assert.ok(axisEvents.some((event) => event!.kind === '换宫'));
  assert.ok(axisEvents.some((event) => event!.kind === '停逆'));
  assert.deepEqual(
    axisEvents.map((event) => event!.utcMs),
    [...axisEvents].sort((left, right) => left!.utcMs - right!.utcMs).map((event) => event!.utcMs),
  );
  const summary = result.promptText.split('\n').find((line) => line.startsWith('周期主轴：'))!;
  assert.ok(summary.indexOf('吊照太阳') < summary.indexOf('换宫太阳'));
  assert.ok(summary.indexOf('换宫太阳') < summary.indexOf('停逆太阳'));
});
