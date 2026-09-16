import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateSolarTermEvidence } from 'mingyu-core/calendar';
import {
  createQizhengFlowRangeCalculator,
  generateQizheng,
  generateQizhengFlowBirthRange,
  type QizhengFlowBirthRangeSource,
  type QizhengInput,
} from 'mingyu-core/qizheng';

const OFFSET_HOURS = 8;
const SECOND = 1_000;

function beijingTimestamp(value: string) {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

function beijingDateTime(timestamp: number): string {
  const local = new Date(timestamp + OFFSET_HOURS * 60 * 60 * SECOND);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}T${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}:${String(local.getUTCSeconds()).padStart(2, '0')}`;
}

function inputAt(timestamp: number, input: QizhengInput): QizhengInput {
  const local = new Date(timestamp + OFFSET_HOURS * 60 * 60 * SECOND);
  return {
    ...input,
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
    timezone: OFFSET_HOURS,
  };
}

function source(startText: string, endText: string): QizhengFlowBirthRangeSource {
  return {
    startTimestamp: beijingTimestamp(startText),
    endTimestamp: beijingTimestamp(endText),
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: OFFSET_HOURS,
  };
}

const DAILY_SOURCE = source('2024-02-19 11:24:48', '2024-02-19 11:24:50');
const DAILY_INPUT: QizhengInput = {
  year: 2024,
  month: 2,
  day: 19,
  hour: 11,
  minute: 24,
  second: 48,
  latitude: 39.9,
  longitude: 116.4,
  timezone: OFFSET_HOURS,
  gender: 'male',
  flowYear: 2024,
  flowMonth: 3,
  flowDay: 15,
  flowHour: 6,
  flowMinute: 30,
};

const FLOW_CLOSENESS_INPUT: QizhengInput = {
  year: 2024,
  month: 2,
  day: 19,
  hour: 11,
  minute: 28,
  second: 20,
  latitude: 39.9,
  longitude: 116.4,
  timezone: OFFSET_HOURS,
  gender: 'male',
  useTrueSolarTime: false,
  flowYear: 2024,
  flowMonth: 3,
  flowDay: 15,
  flowHour: 12,
  flowMinute: 0,
};

const FLOW_CLOSENESS_SOURCE = source('2024-02-19 11:28:20', '2024-02-19 11:28:24');
const FLOW_CLOSENESS_TRANSIT = {
  star1: '流曜太白(金)',
  star2: '本命太阴',
  type: '三方',
  exactAngle: 120,
  allowedOrb: 6,
};

function flowTransitKey(transit: {
  star1: string;
  star2: string;
  type: string;
  exactAngle: number;
  allowedOrb: number;
}) {
  return [transit.star1, transit.star2, transit.type, transit.exactAngle, transit.allowedOrb].join(
    '|',
  );
}

function findFlowTransit(result: ReturnType<typeof generateQizheng>) {
  return result.flowingStars?.transits.find(
    (transit) => flowTransitKey(transit) === flowTransitKey(FLOW_CLOSENESS_TRANSIT),
  );
}

function natalDiscreteFingerprint(result: ReturnType<typeof generateQizheng>) {
  return JSON.stringify({
    stars: result.stars.map((star) => ({
      name: star.name,
      xiu: star.xiu,
      signIndex: star.signIndex,
      signBranch: star.signBranch,
      palace: star.palace,
      retrograde: star.retrograde,
      dignity: star.dignity,
      sourceId: star.sourceId,
      precisionClass: star.precisionClass,
    })),
    twelvePalaces: result.twelvePalaces.map((palace) => ({
      palace: palace.palace,
      signIndex: palace.signIndex,
      signBranch: palace.signBranch,
    })),
  });
}

test('七政流日出生区间逐秒核验流曜入宫、吊照、行限与周期事件', () => {
  const range = generateQizhengFlowBirthRange(DAILY_INPUT, DAILY_SOURCE);
  assert.equal(range.coverage, 'flow');
  assert.equal(range.target.mode, 'daily');
  assert.equal(range.target.year, 2024);
  assert.equal(range.target.month, 3);
  assert.equal(range.target.day, 15);
  assert.equal(range.target.hour, 6);
  assert.equal(range.target.minute, 30);
  assert.equal(range.sampleCount, 2);
  assert.ok(range.branches.length > 0);
  assert.equal(
    range.branches[0]!.representative.flowingStars?.localDateTime,
    '2024-03-15T06:30:00',
  );

  let sampleOffset = 0;
  for (const branch of range.branches) {
    assert.equal(branch.startTimestamp, DAILY_SOURCE.startTimestamp + sampleOffset * SECOND);
    assert.equal(branch.endTimestamp, branch.startTimestamp + branch.sampleCount * SECOND);
    const firstExpected = generateQizheng(inputAt(branch.startTimestamp, DAILY_INPUT));
    const lastExpected = generateQizheng(inputAt(branch.endTimestamp - SECOND, DAILY_INPUT));
    assert.deepEqual(branch.representative.flowingStars?.stars, firstExpected.flowingStars?.stars);
    assert.deepEqual(
      branch.representative.flowingStars?.transits,
      firstExpected.flowingStars?.transits,
    );
    assert.deepEqual(branch.representative.timeLords, firstExpected.timeLords);
    assert.deepEqual(
      branch.representative.flowingStars?.periodEvents?.events,
      firstExpected.flowingStars?.periodEvents?.events,
    );
    assert.deepEqual(branch.last.flowingStars?.stars, lastExpected.flowingStars?.stars);
    assert.deepEqual(branch.last.flowingStars?.transits, lastExpected.flowingStars?.transits);
    assert.deepEqual(branch.last.timeLords, lastExpected.timeLords);
    assert.deepEqual(
      branch.last.flowingStars?.periodEvents?.events,
      lastExpected.flowingStars?.periodEvents?.events,
    );
    for (const event of branch.periodEvents.events) {
      assert.ok(event.firstUtcMs <= event.lastUtcMs);
      assert.ok(event.minUtcMs <= event.maxUtcMs);
      assert.ok(event.sampleCount >= 1);
    }
    assert.ok(branch.continuous.some((fact) => fact.path.startsWith('flowingStars.stars[')));
    if (firstExpected.flowingStars?.transits.length) {
      assert.ok(branch.continuous.some((fact) => fact.path.startsWith('flowingStars.transits[')));
    }
    sampleOffset += branch.sampleCount;
  }
  assert.equal(sampleOffset, range.sampleCount);
  const targetStars = range.branches[0]!.representative.flowingStars!.stars;
  const lastTargetStars = range.branches.at(-1)!.last.flowingStars!.stars;
  assert.deepEqual(
    targetStars.map((star) => [star.name, star.longitude]),
    lastTargetStars.map((star) => [star.name, star.longitude]),
  );
});

test('七政流曜出生区间应在真实相位紧密度临界处分段并匹配独立单点', () => {
  const range = generateQizhengFlowBirthRange(FLOW_CLOSENESS_INPUT, FLOW_CLOSENESS_SOURCE);
  assert.equal(range.sampleCount, 4);
  assert.deepEqual(
    range.branches.map((branch) => [
      branch.startTimestamp,
      branch.endTimestamp,
      branch.sampleCount,
    ]),
    [
      [FLOW_CLOSENESS_SOURCE.startTimestamp, FLOW_CLOSENESS_SOURCE.startTimestamp + 2 * SECOND, 2],
      [FLOW_CLOSENESS_SOURCE.startTimestamp + 2 * SECOND, FLOW_CLOSENESS_SOURCE.endTimestamp, 2],
    ],
  );

  const samples = Array.from({ length: range.sampleCount }, (_, index) =>
    generateQizheng(
      inputAt(FLOW_CLOSENESS_SOURCE.startTimestamp + index * SECOND, FLOW_CLOSENESS_INPUT),
    ),
  );
  assert.equal(new Set(samples.map(natalDiscreteFingerprint)).size, 1);

  const transits = samples.map((result) => findFlowTransit(result));
  assert.deepEqual(
    transits.map((transit) => transit?.closeness),
    ['宽松', '宽松', '中等', '中等'],
  );
  assert.ok(transits[1]!.orbRatio > 2 / 3);
  assert.ok(transits[2]!.orbRatio <= 2 / 3);
  assert.deepEqual(
    samples.map((result) => findFlowTransit(result) && flowTransitKey(findFlowTransit(result)!)),
    Array(4).fill(flowTransitKey(FLOW_CLOSENESS_TRANSIT)),
  );

  for (let index = 0; index < samples.length; index += 1) {
    const timestamp = FLOW_CLOSENESS_SOURCE.startTimestamp + index * SECOND;
    const branch = range.branches.find(
      (item) => item.startTimestamp <= timestamp && timestamp < item.endTimestamp,
    );
    assert.ok(branch);
    const expected = findFlowTransit(samples[index]!);
    const actual = findFlowTransit(
      timestamp === branch!.startTimestamp ? branch!.representative : branch!.last,
    );
    assert.ok(expected);
    assert.ok(actual);
    assert.deepEqual(
      {
        closeness: actual.closeness,
        actualAngle: actual.actualAngle,
        orb: actual.orb,
        orbRatio: actual.orbRatio,
      },
      {
        closeness: expected.closeness,
        actualAngle: expected.actualAngle,
        orb: expected.orb,
        orbRatio: expected.orbRatio,
      },
    );
  }
});

test('七政流曜出生区间跨公历年保持行限出生年身份', () => {
  const start = beijingTimestamp('2023-12-31 23:59:59');
  const range = generateQizhengFlowBirthRange(
    {
      ...DAILY_INPUT,
      year: 2023,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
    },
    {
      ...source('2023-12-31 23:59:59', '2024-01-01 00:00:01'),
      startTimestamp: start,
      endTimestamp: start + 2 * SECOND,
    },
  );
  const first = range.branches[0]!.representative.timeLords;
  const last = range.branches.at(-1)!.last.timeLords;
  assert.equal(range.sampleCount, 2);
  assert.equal(first?.nominalAge, 2);
  assert.equal(last?.nominalAge, 1);
  assert.equal(first?.currentMinorLimit.nominalAge, 2);
  assert.equal(last?.currentMinorLimit.nominalAge, 1);
});

test('七政流曜出生区间保留无性别本命流曜而不虚构行限', () => {
  const range = generateQizhengFlowBirthRange({ ...DAILY_INPUT, gender: undefined }, DAILY_SOURCE);
  assert.ok(range.branches[0]!.representative.flowingStars);
  assert.equal(range.branches[0]!.representative.timeLords, undefined);
});

test('七政流曜出生区间支持日、月、年三种既有目标模式', () => {
  const cases: Array<[string, QizhengInput]> = [
    ['daily', DAILY_INPUT],
    ['monthly', { ...DAILY_INPUT, flowDay: undefined, flowHour: undefined, flowMinute: undefined }],
    [
      'yearly',
      {
        ...DAILY_INPUT,
        flowMonth: undefined,
        flowDay: undefined,
        flowHour: undefined,
        flowMinute: undefined,
      },
    ],
  ];
  for (const [mode, input] of cases) {
    const range = generateQizhengFlowBirthRange(input, {
      ...DAILY_SOURCE,
      endTimestamp: DAILY_SOURCE.startTimestamp + 2 * SECOND,
    });
    assert.equal(range.target.mode, mode);
    assert.equal(range.sampleCount, 2);
    assert.ok(range.branches[0]!.representative.flowingStars);
    if (mode === 'yearly') {
      const lichun = calculateSolarTermEvidence(2024, 3);
      assert.equal(range.target.startUtcTimestamp, lichun.utcTimestamp);
      assert.equal(
        range.branches[0]!.representative.flowingStars?.localDateTime,
        beijingDateTime(lichun.utcTimestamp),
      );
    }
  }
});

test('七政流曜范围计算器锁定流曜目标上下文', () => {
  const calculator = createQizhengFlowRangeCalculator(DAILY_INPUT);
  assert.throws(
    () => calculator.generate({ ...DAILY_INPUT, flowDay: DAILY_INPUT.flowDay! + 1 }),
    /只允许改变出生年月日时分秒/u,
  );
  assert.throws(
    () => calculator.generate({ ...DAILY_INPUT, longitude: DAILY_INPUT.longitude! + 1 }),
    /只允许改变出生年月日时分秒/u,
  );
});

test('七政流曜出生区间报告进度并拒绝越界、非北京时间及缺少流年', () => {
  const progress: Array<[number, number]> = [];
  generateQizhengFlowBirthRange(
    DAILY_INPUT,
    { ...DAILY_SOURCE, endTimestamp: DAILY_SOURCE.startTimestamp + SECOND },
    { onProgress: (completed, total) => progress.push([completed, total]) },
  );
  assert.deepEqual(progress, [[1, 1]]);
  assert.throws(
    () =>
      generateQizhengFlowBirthRange(DAILY_INPUT, {
        ...DAILY_SOURCE,
        endTimestamp: DAILY_SOURCE.startTimestamp + 2 * 60 * 60 * SECOND + SECOND,
      }),
    /不得超过两小时/u,
  );
  assert.throws(
    () =>
      generateQizhengFlowBirthRange(
        { ...DAILY_INPUT, timeZoneId: 'Asia/Shanghai' },
        { ...DAILY_SOURCE, endTimestamp: DAILY_SOURCE.startTimestamp + SECOND },
      ),
    /不接受 timeZoneId/u,
  );
  assert.throws(
    () =>
      generateQizhengFlowBirthRange(
        { ...DAILY_INPUT, flowYear: undefined },
        { ...DAILY_SOURCE, endTimestamp: DAILY_SOURCE.startTimestamp + SECOND },
      ),
    /必须明确 flowYear/u,
  );
});

test('七政流曜出生区间支持取消并停止继续采样', () => {
  const controller = new AbortController();
  assert.throws(
    () =>
      generateQizhengFlowBirthRange(DAILY_INPUT, DAILY_SOURCE, {
        onProgress: (completed) => {
          if (completed === 1) controller.abort();
        },
        signal: controller.signal,
      }),
    /计算已取消/u,
  );
});
