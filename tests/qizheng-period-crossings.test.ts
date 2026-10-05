import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQizhengPeriodEventScanner,
  scanQizhengPeriodEvents,
} from '../packages/core/src/qi_zheng/period-events.ts';

const start = Date.UTC(2022, 5, 1);
const hour = 3_600_000;
const normalize = (angle: number) => ((angle % 360) + 360) % 360;

test('月年周期按当前流曜求根，共享同一瞬时采样并兼容单参数采样器', () => {
  const samples = (utcMs: number) => [
    { name: '太阳', longitude: 4 + (utcMs - start) / hour },
    { name: '太白(金)', longitude: 29 + (utcMs - start) / hour },
  ];
  const natal = {
    natalStars: [{ name: '太阳', longitude: 5 }],
    twelvePalaces: [{ palace: '财帛', signIndex: 1, signBranch: '酉' as const }],
  };
  for (const mode of ['monthly', 'yearly'] as const) {
    const input = { startUtcMs: start, endUtcMs: start + 2 * hour, timezone: 0, mode };
    const calls: Array<{ utcMs: number; names: readonly string[] }> = [];
    const scannerInput = {
      ...input,
      sampleLongitudes: (utcMs: number, names?: readonly string[]) => {
        assert.ok(names?.length);
        calls.push({ utcMs, names: [...names] });
        return samples(utcMs).filter((sample) => names!.includes(sample.name));
      },
    };
    const scan = createQizhengPeriodEventScanner(scannerInput);
    const result = scan(natal);
    const legacy = scanQizhengPeriodEvents({ ...input, ...natal, sampleLongitudes: samples });
    assert.deepEqual(result, legacy);
    assert.deepEqual(
      result.events.map((event) => [event.kind, event.movingStar, Math.round(event.utcMs)]),
      [
        ['精确吊照', '太阳', start + hour],
        ['换宫', '太白(金)', start + hour],
      ],
    );
    assert.ok(calls.some((call) => call.names.length === 1));
    const pairs = calls.flatMap((call) => call.names.map((name) => `${call.utcMs}:${name}`));
    assert.equal(new Set(pairs).size, pairs.length);

    // 已交付的事件与主轴只持有事实值，调用方改动不会进入下一本命扫描。
    const expected = structuredClone(result);
    result.events[0].promptText = '调用方修改';
    result.axis.length = 0;
    result.windows.length = 0;
    scannerInput.timezone = 8;
    scannerInput.mode = mode === 'monthly' ? 'yearly' : 'monthly';
    scannerInput.startUtcMs += hour;
    scannerInput.endUtcMs += hour;
    scannerInput.sampleLongitudes = () => {
      throw new Error('不能使用后来替换的周期采样器。');
    };
    const callCount = calls.length;
    assert.deepEqual(scan(natal), expected);
    assert.equal(calls.length, callCount);
  }
});

test('流曜周期缺少目标星曜采样时不把未覆盖对象写成空结果', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [
      { name: '太阳', longitude: 0 },
      { name: '辰星(水)', longitude: 30 },
    ],
    twelvePalaces: [],
    startUtcMs: start,
    endUtcMs: start + hour,
    timezone: 8,
    mode: 'yearly',
    // 年度范围不扫描计都；它跨宫也不能导出“全盘未见事件”的断言。
    sampleLongitudes: (utcMs) => [{ name: '计都(土余)', longitude: 29 + (utcMs - start) / hour }],
  });
  assert.deepEqual(result.events, []);
  assert.match(result.promptText, /周期事件参考：流曜未列；吊照本命太阳/);
  assert.doesNotMatch(result.promptText, /周期事件参考：[^\n]*辰星\(水\)/);
  assert.doesNotMatch(result.promptText, /所列流曜未见换宫、停逆或精确吊照/);
  assert.doesNotMatch(result.promptText, /本窗口未见/);
  assert.match(result.promptText, /角度关系合相、三方、对照/u);
  assert.doesNotMatch(result.promptText, /角度关系同宫/u);
});

test('周期采样缺失一端黄经时不按另一端推断事件或空结果', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [{ name: '太阳', longitude: 0 }],
    twelvePalaces: [],
    startUtcMs: start,
    endUtcMs: start + hour,
    timezone: 8,
    mode: 'daily',
    sampleLongitudes: (utcMs) => (utcMs === start ? [{ name: '太阳', longitude: 29 }] : []),
  });
  assert.deepEqual(result.events, []);
  assert.match(result.promptText, /流曜未列/u);
  assert.doesNotMatch(result.promptText, /未见换宫|未见停逆/u);
});

test('七政周期求根缺少中间黄经样本时直接报错', () => {
  const base = {
    natalStars: [{ name: '本命星', longitude: 5 }],
    twelvePalaces: boundaryPalaces,
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + boundaryHour,
    timezone: 0,
    mode: 'daily' as const,
  };
  const missingMiddle = (utcMs: number, from: number, to: number) =>
    utcMs === boundaryStart || utcMs === boundaryStart + boundaryHour
      ? [{ name: '太阳', longitude: utcMs === boundaryStart ? from : to }]
      : [];
  assert.throws(
    () =>
      scanQizhengPeriodEvents({
        ...base,
        natalStars: [],
        sampleLongitudes: (utcMs) => missingMiddle(utcMs, 29, 31),
      }),
    /换宫求根缺少太阳的黄经采样/u,
  );
  assert.throws(
    () =>
      scanQizhengPeriodEvents({
        ...base,
        sampleLongitudes: (utcMs) => missingMiddle(utcMs, 4, 6),
      }),
    /精确吊照求根缺少太阳的黄经采样/u,
  );
  for (const [from, natalStars, reason] of [
    [29, [], /换宫求根缺少太阳的黄经采样/u],
    [4, base.natalStars, /精确吊照求根缺少太阳的黄经采样/u],
  ] as const) {
    assert.throws(
      () =>
        scanQizhengPeriodEvents({
          ...base,
          natalStars: [...natalStars],
          sampleLongitudes: (utcMs) => [
            {
              name: '太阳',
              longitude:
                utcMs === boundaryStart + boundaryHour / 2
                  ? NaN
                  : from + (2 * (utcMs - boundaryStart)) / boundaryHour,
            },
          ],
        }),
      reason,
    );
  }
});

test('七政周期把零度角关系写为合相且逐事件事实只列一次', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [{ name: '本命星', longitude: 5 }],
    twelvePalaces: [],
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + boundaryHour,
    timezone: 0,
    mode: 'daily',
    sampleLongitudes: (utcMs) => [
      { name: '太阳', longitude: 4 + ((utcMs - boundaryStart) / boundaryHour) * 2 },
    ],
  });
  assert.ok(
    result.events.some((event) => event.kind === '精确吊照' && event.aspectType === '同宫'),
  );
  assert.ok(result.axis.some((line) => line.includes('合相')));
  assert.match(result.promptText, /精确吊照：[^\n]*成合相/u);
  assert.doesNotMatch(result.promptText, /周期主轴：|主轴列|精确吊照：[^\n]*成同宫/u);
  for (const event of result.events) {
    assert.equal(result.promptText.split(event.promptText).length - 1, 1);
  }
});

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

test('周期末前的换宫保持实际民用日期与夏令时前偏移', () => {
  for (const [endUtcMs, timeZoneId, expected] of [
    [Date.UTC(2024, 0, 2), undefined, '2024-01-01 23:59 UTC+00:00'],
    [Date.UTC(2024, 2, 10, 7), 'America/New_York', '2024-03-10 01:59 UTC-05:00'],
  ] as const) {
    const startUtcMs = endUtcMs - hour;
    const result = scanQizhengPeriodEvents({
      natalStars: [],
      twelvePalaces: [],
      startUtcMs,
      endUtcMs,
      timezone: 0,
      ...(timeZoneId ? { timeZoneId } : {}),
      mode: 'daily',
      sampleLongitudes: (utcMs) => [
        { name: '太阳', longitude: 29 + (utcMs - startUtcMs) / (hour - 300) },
      ],
    });
    const ingress = result.events.find((event) => event.kind === '换宫');
    assert.ok(ingress);
    assert.ok(endUtcMs - ingress.utcMs > 250 && endUtcMs - ingress.utcMs < 350);
    assert.equal(ingress.dateTime, expected);
    assert.ok(ingress.promptText.includes(expected));
  }
});

test('周期终点前不足半毫秒的交点仍属于当前半开窗口', () => {
  const endUtcMs = Date.UTC(2024, 0, 2);
  const startUtcMs = endUtcMs - hour;
  const crossingUtcMs = endUtcMs - 0.4;
  const result = scanQizhengPeriodEvents({
    natalStars: [],
    twelvePalaces: [],
    startUtcMs,
    endUtcMs,
    timezone: 0,
    mode: 'daily',
    sampleLongitudes: (utcMs) => [
      { name: '太阳', longitude: 29 + (utcMs - startUtcMs) / (crossingUtcMs - startUtcMs) },
    ],
  });
  const ingress = result.events.find((event) => event.kind === '换宫');
  assert.ok(ingress);
  assert.ok(ingress.utcMs < endUtcMs);
  assert.equal(ingress.dateTime, '2024-01-01 23:59 UTC+00:00');
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
  assert.ok(result.promptText.includes('成对照'));
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

test('流曜在同一采样段停逆并两次越过同一精确角时保留两次吊照', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [{ name: '本命星', longitude: 99.9 }],
    twelvePalaces: [],
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + 12 * boundaryHour,
    timezone: 0,
    mode: 'monthly',
    sampleLongitudes: (utcMs) => {
      const hours = (utcMs - boundaryStart) / boundaryHour;
      return [{ name: '太阳', longitude: 100 - 0.01 * (hours - 6) ** 2 }];
    },
  });
  const conjunctions = result.events.filter(
    (event) => event.kind === '精确吊照' && event.aspectType === '同宫',
  );
  assert.equal(conjunctions.length, 2);
  assert.ok(conjunctions[0]!.utcMs < boundaryStart + 6 * boundaryHour);
  assert.ok(conjunctions[1]!.utcMs > boundaryStart + 6 * boundaryHour);
  assert.equal(result.events.filter((event) => event.kind === '停逆').length, 1);
});

test('流曜在同一采样段停逆并两次越过宫界时记录进宫与退宫', () => {
  const result = scanQizhengPeriodEvents({
    natalStars: [],
    twelvePalaces: boundaryPalaces,
    startUtcMs: boundaryStart,
    endUtcMs: boundaryStart + 12 * boundaryHour,
    timezone: 0,
    mode: 'monthly',
    sampleLongitudes: (utcMs) => {
      const hours = (utcMs - boundaryStart) / boundaryHour;
      return [{ name: '太阳', longitude: 30.1 - 0.01 * (hours - 6) ** 2 }];
    },
  });
  const ingresses = result.events.filter((event) => event.kind === '换宫');
  assert.equal(ingresses.length, 2);
  assert.deepEqual(
    ingresses.map((event) => event.signBranch),
    ['酉', '戌'],
  );
  assert.ok(ingresses[0]!.utcMs < boundaryStart + 6 * boundaryHour);
  assert.ok(ingresses[1]!.utcMs > boundaryStart + 6 * boundaryHour);

  for (const direction of [1, -1]) {
    const tangent = scanQizhengPeriodEvents({
      natalStars: [{ name: '本命星', longitude: 30 }],
      twelvePalaces: boundaryPalaces,
      startUtcMs: boundaryStart,
      endUtcMs: boundaryStart + 2 * boundaryHour,
      timezone: 0,
      mode: 'daily',
      sampleLongitudes: (utcMs) => [
        {
          name: '辰星(水)',
          longitude: 30 + direction * ((utcMs - boundaryStart) / boundaryHour - 1) ** 2,
        },
      ],
    });
    assert.equal(tangent.events.filter((event) => event.kind === '换宫').length, 0);
    const station = tangent.events.filter((event) => event.kind === '停逆');
    assert.equal(station.length, 1);
    assert.equal(station[0].utcMs, boundaryStart + boundaryHour);
    assert.equal(station[0].stationDirection, direction > 0 ? '顺行' : '逆行');
    const touches = tangent.events.filter(
      (event) => event.kind === '精确吊照' && event.aspectType === '同宫',
    );
    assert.equal(touches.length, 1);
    assert.equal(touches[0].utcMs, boundaryStart + boundaryHour);
  }
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
  for (const event of result.events) {
    assert.equal(result.promptText.split(event.promptText).length - 1, 1);
  }
  const detail = result.promptText.split('完整明细：\n')[1];
  assert.ok(detail);
  assert.deepEqual(
    detail.split('\n'),
    result.events.map((event) => event.promptText),
  );
  assert.doesNotMatch(result.promptText, /周期主轴：|主轴列/);
});
