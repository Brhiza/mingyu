import assert from 'node:assert/strict';
import test from 'node:test';

import { getCivilDateTimeAtFixedOffset } from 'mingyu-core/calendar';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import {
  generateAstrolabeBirthRange,
  getAstrolabeBirthRangeDiscreteFingerprint,
  isAstrolabeBirthRangeSource,
} from 'mingyu-core/divination/astrolabe-birth-range';
import type { AstrolabeBirthInput, AstrolabeData } from 'mingyu-core/types';
import { formatAstrolabeBirthRangeFacts } from '../src/lib/astrolabe-birth-range-prompt';

const OFFSET_HOURS = 8;
const SECOND = 1_000;
const TWO_HOURS = 2 * 60 * 60 * SECOND;

const BASE_INPUT: AstrolabeBirthInput = {
  name: '公开合成星盘样本',
  gender: '女',
  year: '1990',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  second: '0',
  latitude: '31.2304',
  longitude: '121.4737',
  timezone: String(OFFSET_HOURS),
  locationName: '上海',
};

function beijingTimestamp(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

function inputAt(timestamp: number, base: AstrolabeBirthInput = BASE_INPUT): AstrolabeBirthInput {
  const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), OFFSET_HOURS);
  return {
    ...base,
    year: String(local.year),
    month: String(local.month),
    day: String(local.day),
    hour: String(local.hour),
    minute: String(local.minute),
    second: String(local.second),
  };
}

test('未知出生时刻跨日出时按真实昼夜盘分段', () => {
  const chartAt = (timestamp: number) => generateAstrolabe(inputAt(timestamp));
  let nightTimestamp = beijingTimestamp('1990-05-20 03:00:00');
  let dayTimestamp = beijingTimestamp('1990-05-20 08:00:00');
  assert.equal(chartAt(nightTimestamp).dayChart, false);
  assert.equal(chartAt(dayTimestamp).dayChart, true);

  while (dayTimestamp - nightTimestamp > SECOND) {
    const midpoint =
      nightTimestamp + Math.floor((dayTimestamp - nightTimestamp) / (2 * SECOND)) * SECOND;
    if (chartAt(midpoint).dayChart) dayTimestamp = midpoint;
    else nightTimestamp = midpoint;
  }

  const range = generateAstrolabeBirthRange(inputAt(nightTimestamp), {
    startTimestamp: nightTimestamp,
    endTimestamp: dayTimestamp + SECOND,
  });
  assert.equal(range.branches.length, 2);
  assert.equal(range.branches[1]?.startTimestamp, dayTimestamp);
  assert.deepEqual(
    range.branches.map((branch) => branch.representative.dayChart),
    [false, true],
  );
  const facts = formatAstrolabeBirthRangeFacts(range);
  assert.match(facts, /昼夜盘：夜盘/);
  assert.match(facts, /昼夜盘：昼盘/);
});

function withoutGenerationTimestamp(data: AstrolabeData) {
  return { ...data, timestamp: 0 };
}

test('出生区间离散指纹区分昼盘与夜盘', () => {
  const chart = generateAstrolabe(BASE_INPUT);
  assert.equal(chart.dayChart, true);
  assert.notEqual(
    getAstrolabeBirthRangeDiscreteFingerprint(chart),
    getAstrolabeBirthRangeDiscreteFingerprint({ ...chart, dayChart: false }),
  );
});

function sun(result: AstrolabeData) {
  return result.planets.find((point) => point.name === 'Sun');
}

function planetHouseSignature(result: AstrolabeData): string {
  return result.planets.map((point) => `${point.name}:${point.house}`).join('|');
}

function aspectSignature(result: AstrolabeData): string {
  return result.aspects
    .map((aspect) =>
      [
        aspect.body1,
        aspect.body2,
        aspect.type,
        aspect.applying,
        aspect.closeness,
        aspect.isOutOfSign,
      ].join(':'),
    )
    .sort()
    .join('|');
}

function angleDisplaySignature(result: AstrolabeData): string {
  return result.angles.map((point) => `${point.name}:${point.degree}:${point.minute}`).join('|');
}

function angleStateSignature(result: AstrolabeData): string {
  return result.angles
    .map((point) =>
      [
        point.name,
        point.sign,
        point.house,
        point.retrograde,
        point.dignity,
        point.dignityLabel,
      ].join(':'),
    )
    .join('|');
}

type Signature = (result: AstrolabeData) => string;

function findTransitionWindow(signature: Signature) {
  const candidates = [
    '2024-02-19 11:24:48',
    '2024-03-20 11:06:20',
    '2024-06-20 12:00:00',
    '1990-05-20 12:30:00',
    '2000-01-01 00:00:00',
  ];
  for (const text of candidates) {
    const start = beijingTimestamp(text);
    const end = start + TWO_HOURS;
    const first = generateAstrolabe(inputAt(start));
    const last = generateAstrolabe(inputAt(end - SECOND));
    if (signature(first) !== signature(last)) {
      return { start, end, firstSignature: signature(first) };
    }
  }
  return null;
}

function locateFirstTransition(
  start: number,
  end: number,
  signature: Signature,
  firstSignature: string,
): number {
  let low = start;
  let high = end - SECOND;
  while (high - low > SECOND) {
    const midpoint = low + Math.floor((high - low) / (2 * SECOND)) * SECOND;
    if (midpoint <= low) break;
    if (signature(generateAstrolabe(inputAt(midpoint))) === firstSignature) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }
  return high;
}

function locateDisplayBoundary(): number | null {
  const candidates = [
    '2024-02-19 11:24:48',
    '2024-03-20 11:06:20',
    '2024-06-20 12:00:00',
    '1990-05-20 12:30:00',
    '2000-01-01 00:00:00',
  ];
  for (const text of candidates) {
    const start = beijingTimestamp(text);
    const end = start + TWO_HOURS;
    const first = generateAstrolabe(inputAt(start));
    const firstDisplay = angleDisplaySignature(first);
    const last = generateAstrolabe(inputAt(end - SECOND));
    if (firstDisplay === angleDisplaySignature(last)) continue;

    let low = start;
    let high = end - SECOND;
    while (high - low > SECOND) {
      const midpoint = low + Math.floor((high - low) / (2 * SECOND)) * SECOND;
      if (midpoint <= low) break;
      if (angleDisplaySignature(generateAstrolabe(inputAt(midpoint))) === firstDisplay) {
        low = midpoint;
      } else {
        high = midpoint;
      }
    }

    const before = generateAstrolabe(inputAt(high - SECOND));
    const after = generateAstrolabe(inputAt(high));
    if (
      angleDisplaySignature(before) !== angleDisplaySignature(after) &&
      getAstrolabeBirthRangeDiscreteFingerprint(before) ===
        getAstrolabeBirthRangeDiscreteFingerprint(after)
    ) {
      return high;
    }
  }
  return null;
}

test('西占本命区间采用半开整秒边界并逐秒复现完整单点盘', () => {
  const start = beijingTimestamp('1990-05-20 12:30:00');
  const end = start + 3 * SECOND;
  const progress: Array<[number, number]> = [];
  const range = generateAstrolabeBirthRange(
    inputAt(start),
    {
      startTimestamp: start,
      endTimestamp: end,
    },
    {
      onProgress: (completed, total) => progress.push([completed, total]),
    },
  );

  assert.equal(range.coverage, 'natal');
  assert.equal(range.status, 'stable');
  assert.equal(range.sampleCount, 3);
  assert.equal(range.source.endExclusive, true);
  assert.equal(isAstrolabeBirthRangeSource(range.source), true);
  assert.deepEqual(progress, [
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  assert.equal(range.branches.length, 1);
  assert.equal(range.branches[0]?.startTimestamp, start);
  assert.equal(range.branches[0]?.endTimestamp, end);
  assert.equal(range.branches[0]?.sampleCount, 3);

  const branch = range.branches[0]!;
  for (let offset = 0; offset < 3; offset += 1) {
    const timestamp = start + offset * SECOND;
    const direct = generateAstrolabe(inputAt(timestamp));
    assert.equal(
      getAstrolabeBirthRangeDiscreteFingerprint(direct),
      getAstrolabeBirthRangeDiscreteFingerprint(branch.representative),
    );
    if (offset === 0) {
      assert.deepEqual(
        withoutGenerationTimestamp(branch.representative),
        withoutGenerationTimestamp(direct),
      );
    }
    if (offset === 2) {
      assert.deepEqual(withoutGenerationTimestamp(branch.last), withoutGenerationTimestamp(direct));
    }
  }

  const longitude = branch.continuous.find((fact) => fact.path === 'planets[Sun].longitude');
  assert.equal(longitude?.unit, '度');
  assert.equal(longitude?.sampleCount, 3);
  assert.notEqual(longitude?.first, longitude?.last);
  assert.equal(longitude?.circular?.mode, 'shortest-arc-from-first');
});

test('西占本命区间在春分跨零度时按太阳离散星座切分并保留圆周量', () => {
  const start = beijingTimestamp('2024-03-20 11:06:20');
  const end = start + 10 * SECOND;
  const range = generateAstrolabeBirthRange(inputAt(start), {
    startTimestamp: start,
    endTimestamp: end,
  });

  assert.ok(range.branches.length >= 2);
  const firstSun = sun(range.branches[0]!.representative)!;
  const laterSun = sun(range.branches.at(-1)!.representative)!;
  assert.notEqual(firstSun?.sign, laterSun?.sign);
  assert.ok(firstSun.longitude > 359 || laterSun.longitude < 1);
  assert.ok(
    range.branches.every((branch) =>
      branch.continuous.some(
        (fact) => fact.path === 'planets[Sun].longitude' && fact.circular?.period === 360,
      ),
    ),
  );
});

test('西占本命区间通过端点定位真实宫位与相位离散边界', () => {
  const houseWindow = findTransitionWindow(planetHouseSignature);
  assert.ok(houseWindow, '公开合成时间候选中应存在宫位变化窗口');
  const houseBoundary = locateFirstTransition(
    houseWindow.start,
    houseWindow.end,
    planetHouseSignature,
    houseWindow.firstSignature,
  );
  const houseRange = generateAstrolabeBirthRange(inputAt(houseBoundary - SECOND), {
    startTimestamp: houseBoundary - SECOND,
    endTimestamp: houseBoundary + SECOND,
  });
  assert.ok(houseRange.branches.length >= 2);
  assert.ok(
    houseRange.branches.some(
      (branch, index) =>
        index > 0 &&
        planetHouseSignature(branch.representative) !==
          planetHouseSignature(houseRange.branches[index - 1]!.representative),
    ),
  );

  const aspectWindow = findTransitionWindow(aspectSignature);
  assert.ok(aspectWindow, '公开合成时间候选中应存在相位变化窗口');
  const aspectBoundary = locateFirstTransition(
    aspectWindow.start,
    aspectWindow.end,
    aspectSignature,
    aspectWindow.firstSignature,
  );
  const aspectRange = generateAstrolabeBirthRange(inputAt(aspectBoundary - SECOND), {
    startTimestamp: aspectBoundary - SECOND,
    endTimestamp: aspectBoundary + SECOND,
  });
  assert.ok(aspectRange.branches.length >= 2);
  assert.ok(
    aspectRange.branches.some(
      (branch, index) =>
        index > 0 &&
        aspectSignature(branch.representative) !==
          aspectSignature(aspectRange.branches[index - 1]!.representative),
    ),
  );
});

test('西占本命区间跨角度分秒展示边界但离散状态不变时保持同一分支', () => {
  const boundary = locateDisplayBoundary();
  assert.ok(boundary, '公开合成时间候选中应存在角度分秒展示边界');
  const before = generateAstrolabe(inputAt(boundary - SECOND));
  const after = generateAstrolabe(inputAt(boundary));
  assert.notEqual(angleDisplaySignature(before), angleDisplaySignature(after));
  assert.equal(angleStateSignature(before), angleStateSignature(after));
  assert.equal(aspectSignature(before), aspectSignature(after));
  assert.equal(
    getAstrolabeBirthRangeDiscreteFingerprint(before),
    getAstrolabeBirthRangeDiscreteFingerprint(after),
  );

  const range = generateAstrolabeBirthRange(inputAt(boundary - SECOND), {
    startTimestamp: boundary - SECOND,
    endTimestamp: boundary + SECOND,
  });
  assert.equal(range.branches.length, 1);
  assert.equal(range.branches[0]?.sampleCount, 2);
});

test('西占本命区间支持取消并拒绝时区、错位、非整秒和超长来源', () => {
  const start = beijingTimestamp('1990-05-20 12:30:00');
  const controller = new AbortController();
  assert.throws(
    () =>
      generateAstrolabeBirthRange(
        inputAt(start),
        { startTimestamp: start, endTimestamp: start + 2 * SECOND },
        {
          onProgress: (completed) => {
            if (completed === 1) controller.abort();
          },
          signal: controller.signal,
        },
      ),
    /已取消/u,
  );

  assert.throws(
    () =>
      generateAstrolabeBirthRange(
        { ...inputAt(start), timezone: '7' },
        { startTimestamp: start, endTimestamp: start + SECOND },
      ),
    /timezone 必须为 8/u,
  );
  assert.throws(
    () =>
      generateAstrolabeBirthRange(
        { ...inputAt(start), timeZoneId: 'Asia/Shanghai' },
        { startTimestamp: start, endTimestamp: start + SECOND },
      ),
    /不接受 timeZoneId/u,
  );
  assert.throws(
    () =>
      generateAstrolabeBirthRange(inputAt(start + SECOND), {
        startTimestamp: start,
        endTimestamp: start + SECOND,
      }),
    /出生字段必须等于起点/u,
  );
  assert.throws(
    () =>
      generateAstrolabeBirthRange(inputAt(start), {
        startTimestamp: start + 500,
        endTimestamp: start + 2 * SECOND,
      }),
    /整秒 UTC epoch/u,
  );
  assert.throws(
    () =>
      generateAstrolabeBirthRange(inputAt(start), {
        startTimestamp: start,
        endTimestamp: start + TWO_HOURS + SECOND,
      }),
    /不得超过两小时/u,
  );
});
