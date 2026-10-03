import assert from 'node:assert/strict';
import test from 'node:test';

import { getCivilDateTimeAtFixedOffset } from '../packages/core/src/calendar/civil-time.ts';
import { generateQizheng, type QizhengInput } from '../packages/core/src/qi_zheng/index.ts';
import {
  generateQizhengBirthRange,
  type QizhengBirthRangeOptions,
} from '../packages/core/src/qi_zheng/birth-range.ts';

const OFFSET_HOURS = 8;
const SECOND = 1_000;

function beijingTimestamp(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

const BASE_INPUT: QizhengInput = {
  year: 2024,
  month: 2,
  day: 19,
  hour: 11,
  minute: 24,
  second: 48,
  latitude: 39.9,
  longitude: 116.4,
  timezone: OFFSET_HOURS,
};

function inputAt(timestamp: number, base: QizhengInput = BASE_INPUT): QizhengInput {
  const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), OFFSET_HOURS);
  return {
    ...base,
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    second: local.second,
  };
}

function runRange(startText: string, endText: string, base = BASE_INPUT) {
  const startTimestamp = beijingTimestamp(startText);
  return generateQizhengBirthRange(inputAt(startTimestamp, base), {
    startTimestamp,
    endTimestamp: beijingTimestamp(endText),
  });
}

function star(result: QizhengInput | ReturnType<typeof generateQizheng>, name: string) {
  if ('stars' in result) return result.stars.find((item) => item.name === name);
  return undefined;
}

test('七政本命区间保留太阴换宫和身宫变盘，并按稳定离散事实分支', () => {
  const range = runRange('2024-02-19 11:24:48', '2024-02-19 11:24:50');

  assert.equal(range.coverage, 'natal');
  assert.equal(range.status, 'conditional');
  assert.equal(range.sampleCount, 2);
  assert.deepEqual(
    range.branches.map((branch) => [
      branch.startTimestamp,
      branch.endTimestamp,
      branch.sampleCount,
    ]),
    [
      [beijingTimestamp('2024-02-19 11:24:48'), beijingTimestamp('2024-02-19 11:24:49'), 1],
      [beijingTimestamp('2024-02-19 11:24:49'), beijingTimestamp('2024-02-19 11:24:50'), 1],
    ],
  );
  assert.notEqual(
    range.branches[0]?.representative.shenGong,
    range.branches[1]?.representative.shenGong,
  );
  assert.notEqual(
    star(range.branches[0]!.representative, '太阴')?.palace,
    star(range.branches[1]!.representative, '太阴')?.palace,
  );

  const longitudeFact = range.branches[0]!.continuous.find(
    (fact) => fact.path === 'stars[太阴].longitude',
  );
  assert.equal(longitudeFact?.label, '太阴目标黄经');
  assert.equal(longitudeFact?.unit, '度');
  assert.equal(longitudeFact?.circular?.mode, 'shortest-arc-from-first');
});

test('七政本命区间保留太阳换宫和命宫变盘', () => {
  const range = runRange('2024-02-19 12:12:57', '2024-02-19 12:12:59', {
    ...BASE_INPUT,
    hour: 12,
    minute: 12,
    second: 57,
  });

  assert.equal(range.sampleCount, 2);
  assert.equal(range.branches.length, 2);
  assert.notEqual(
    range.branches[0]?.representative.mingGong,
    range.branches[1]?.representative.mingGong,
  );
  assert.notEqual(
    star(range.branches[0]!.representative, '太阳')?.signIndex,
    star(range.branches[1]!.representative, '太阳')?.signIndex,
  );
  assert.equal(star(range.branches[0]!.representative, '太阳')?.palace, '官禄');
  assert.equal(star(range.branches[1]!.representative, '太阳')?.palace, '官禄');
});

test('七政本命区间按当地日出星历交点更新恩难昼夜分金', () => {
  const start = beijingTimestamp('2024-02-19 07:03:08');
  const range = generateQizhengBirthRange(
    inputAt(start, {
      ...BASE_INPUT,
      hour: 7,
      minute: 3,
      second: 8,
    }),
    {
      startTimestamp: start,
      endTimestamp: start + 2 * SECOND,
    },
  );

  assert.equal(range.branches.length, 2);
  assert.equal(range.branches[0]?.sampleCount, 1);
  assert.equal(range.branches[1]?.sampleCount, 1);
  const sunrise = Date.parse(
    range.branches[0]!.representative.calculationContext.solarIllumination.sunriseSunset
      .morningUtcDateTime!,
  );
  assert.ok(start < sunrise && sunrise < start + SECOND);
  assert.equal(range.branches[0]?.representative.enNan?.sect, '夜生');
  assert.equal(range.branches[1]?.representative.enNan?.sect, '昼生');
});

test('七政本命区间按当地日落星历交点从昼生转入夜生', () => {
  const start = beijingTimestamp('2024-02-19 17:53:57');
  const range = generateQizhengBirthRange(inputAt(start), {
    startTimestamp: start,
    endTimestamp: start + 2 * SECOND,
  });

  assert.equal(range.branches.length, 2);
  const sunset = Date.parse(
    range.branches[0]!.representative.calculationContext.solarIllumination.sunriseSunset
      .eveningUtcDateTime!,
  );
  assert.ok(start < sunset && sunset < start + SECOND);
  assert.equal(range.branches[0]?.representative.enNan?.sect, '昼生');
  assert.equal(range.branches[1]?.representative.enNan?.sect, '夜生');
});

test('七政本命区间跨二十三点时辰边界重新计算命身宫', () => {
  const start = beijingTimestamp('2024-02-19 22:59:59');
  const range = generateQizhengBirthRange(
    inputAt(start, {
      ...BASE_INPUT,
      hour: 22,
      minute: 59,
      second: 59,
    }),
    {
      startTimestamp: start,
      endTimestamp: start + 2 * SECOND,
    },
  );

  assert.equal(range.branches.length, 2);
  assert.notEqual(
    range.branches[0]?.representative.mingGong,
    range.branches[1]?.representative.mingGong,
  );
  assert.notEqual(
    range.branches[0]?.representative.shenGong,
    range.branches[1]?.representative.shenGong,
  );
});

test('七政本命区间每个分支的完整盘与独立单点计算一致', () => {
  const start = beijingTimestamp('2024-02-19 11:24:48');
  const end = beijingTimestamp('2024-02-19 11:24:50');
  const range = generateQizhengBirthRange(inputAt(start), {
    startTimestamp: start,
    endTimestamp: end,
  });

  for (const branch of range.branches) {
    const representative = generateQizheng(inputAt(branch.startTimestamp));
    const last = generateQizheng(inputAt(branch.endTimestamp - SECOND));
    assert.deepEqual(branch.representative, representative);
    assert.deepEqual(branch.last, last);
  }

  const requiredPaths = [
    'calculationContext.moonPhase.phaseAngleDegrees',
    'calculationContext.solarIllumination.solarAltitudeDegrees',
    'mansionBoundaries[角].longitude',
    'ziqi.tropicalLongitude',
  ];
  for (const path of requiredPaths) {
    assert.ok(
      range.branches[0]!.continuous.some((fact) => fact.path === path),
      path,
    );
  }
  assert.equal(
    range.branches[0]!.continuous.some((fact) => fact.path === 'ziqi.siderealLongitude'),
    false,
  );
});

test('七政本命区间支持单秒范围与进度回调', () => {
  const start = beijingTimestamp('2024-02-19 11:24:48');
  const progress: Array<[number, number]> = [];
  const range = generateQizhengBirthRange(
    inputAt(start),
    {
      startTimestamp: start,
      endTimestamp: start + SECOND,
    },
    {
      onProgress: (completed, total) => progress.push([completed, total]),
    },
  );

  assert.equal(range.sampleCount, 1);
  assert.equal(range.branches.length, 1);
  assert.equal(range.branches[0]?.sampleCount, 1);
  assert.equal(range.branches[0]?.startTimestamp, start);
  assert.equal(range.branches[0]?.endTimestamp, start + SECOND);
  assert.deepEqual(progress, [[1, 1]]);

  const mutableInput = inputAt(start);
  const mutableRange = { startTimestamp: start, endTimestamp: start + 2 * SECOND };
  const lockedProgress: Array<[number, number]> = [];
  const replacementController = new AbortController();
  replacementController.abort();
  const mutableOptions: QizhengBirthRangeOptions = {
    onProgress: (completed, total) => {
      lockedProgress.push([completed, total]);
      if (completed === 1) {
        mutableInput.longitude = 0;
        mutableRange.startTimestamp += SECOND;
        mutableRange.endTimestamp += SECOND;
        mutableOptions.signal = replacementController.signal;
        mutableOptions.onProgress = () => assert.fail('进度回调应沿用本次调用开始时的选项');
      }
    },
  };
  const lockedRange = generateQizhengBirthRange(mutableInput, mutableRange, mutableOptions);
  assert.deepEqual(lockedProgress, [
    [1, 2],
    [2, 2],
  ]);
  assert.equal(lockedRange.source.startTimestamp, start);
  assert.equal(lockedRange.source.endTimestamp, start + 2 * SECOND);
  assert.equal(lockedRange.branches.at(-1)?.endTimestamp, start + 2 * SECOND);
  assert.equal(lockedRange.branches.at(-1)?.representative.calculationContext.longitude, 116.4);
});

test('七政本命区间支持取消且不吞掉取消状态', () => {
  const start = beijingTimestamp('2024-02-19 11:24:48');
  const controller = new AbortController();
  assert.throws(
    () =>
      generateQizhengBirthRange(
        inputAt(start),
        {
          startTimestamp: start,
          endTimestamp: beijingTimestamp('2024-02-19 11:24:51'),
        },
        {
          onProgress: (completed) => {
            if (completed === 1) controller.abort();
          },
          signal: controller.signal,
        },
      ),
    /已取消/u,
  );

  const lastSampleController = new AbortController();
  const lastSampleOptions: QizhengBirthRangeOptions = {
    onProgress: (completed, total) => {
      assert.deepEqual([completed, total], [1, 1]);
      lastSampleOptions.signal = undefined;
      lastSampleController.abort();
    },
    signal: lastSampleController.signal,
  };
  assert.throws(
    () =>
      generateQizhengBirthRange(
        inputAt(start),
        { startTimestamp: start, endTimestamp: start + SECOND },
        lastSampleOptions,
      ),
    /已取消/u,
  );
});

test('七政本命区间拒绝非 UTC+8、流曜字段、错位出生字段和超长范围', () => {
  const start = beijingTimestamp('2024-02-19 11:24:48');
  const end = start + SECOND;
  const validRange = { startTimestamp: start, endTimestamp: end };

  assert.throws(
    () => generateQizhengBirthRange({ ...inputAt(start), timeZoneId: 'Asia/Shanghai' }, validRange),
    /不接受 timeZoneId/u,
  );
  assert.throws(
    () => generateQizhengBirthRange({ ...inputAt(start), timezone: 7 }, validRange),
    /timezone 必须为 8/u,
  );
  assert.throws(
    () => generateQizhengBirthRange({ ...inputAt(start), flowYear: 2025 }, validRange),
    /只覆盖本命区间/u,
  );
  assert.throws(
    () => generateQizhengBirthRange({ ...inputAt(start), second: 49 }, validRange),
    /出生字段必须等于起点/u,
  );
  assert.throws(
    () =>
      generateQizhengBirthRange(inputAt(start), {
        startTimestamp: start,
        endTimestamp: start + 2 * 60 * 60 * SECOND + SECOND,
      }),
    /不得超过两小时/u,
  );
});
