/**
 * @file 七政四余流曜、行限出生时间整秒区间
 * @description 在固定 UTC+8 的本命候选区间内逐秒核验流曜、行限与周期事件，
 *              只保留离散分支首尾完整盘和连续事实，避免保存全部出生样本。
 */

import { getCivilDateTimeAtFixedOffset } from '../calendar/civil-time';
import {
  collectQizhengBirthRangeContinuousSamples,
  getQizhengBirthRangeDiscreteFingerprint,
  type QizhengBirthRangeContinuousFact,
  type QizhengBirthRangeContinuousSample,
} from './birth-range';
import type { QizhengFlowingStarsResult, QizhengInput, QizhengResult } from './index';
import { createQizhengFlowRangeCalculator, type QizhengFlowRangeCalculator } from './index';
import type { QizhengPeriodEvent, QizhengPeriodMode } from './period-events';

const CHINA_OFFSET_HOURS = 8;
const SECOND_MILLISECONDS = 1_000;
const MAX_RANGE_MILLISECONDS = 2 * 60 * 60 * SECOND_MILLISECONDS;

export type QizhengFlowBirthRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type QizhengFlowBirthRangeOptions = {
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

export type QizhengFlowBirthRangeContinuousFact = QizhengBirthRangeContinuousFact;

export type QizhengFlowBirthRangeEventFact = {
  /** 不含四舍五入时间的稳定事件身份；序号区分同一身份的多次出现。 */
  identity: string;
  kind: QizhengPeriodEvent['kind'];
  movingStar: string;
  targetStar?: string;
  aspectType?: string;
  aspectDirection?: '正向' | '逆向';
  stationDirection?: '逆行' | '顺行';
  palace?: string;
  signBranch?: string;
  firstUtcMs: number;
  lastUtcMs: number;
  minUtcMs: number;
  maxUtcMs: number;
  sampleCount: number;
  firstDateTime: string;
  lastDateTime: string;
};

export type QizhengFlowBirthRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  sampleCount: number;
  representative: QizhengResult;
  last: QizhengResult;
  /** 流曜吊照、目标连续量和周期事件出现时刻的逐段事实。 */
  continuous: QizhengFlowBirthRangeContinuousFact[];
  periodEvents: {
    mode: QizhengPeriodMode;
    startDateTime: string;
    endDateTime: string;
    events: QizhengFlowBirthRangeEventFact[];
  };
};

export type QizhengFlowBirthRange = {
  coverage: 'flow';
  status: 'stable' | 'conditional';
  source: QizhengFlowBirthRangeSource;
  resolutionSeconds: 1;
  sampleCount: number;
  target: {
    mode: QizhengPeriodMode;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    timestampNote: string;
    startUtcTimestamp: number;
    endUtcTimestamp: number;
  };
  branches: QizhengFlowBirthRangeBranch[];
};

type ContinuousSample = {
  path: string;
  label: string;
  unit: string;
  value: number;
  circularPeriod?: number;
};

type MetricAccumulator = {
  path: string;
  label: string;
  unit: string;
  first: number;
  last: number;
  min: number;
  max: number;
  sampleCount: number;
  circularPeriod?: number;
  reference: number;
};

type EventAccumulator = QizhengFlowBirthRangeEventFact;

type ActiveBranch = {
  startTimestamp: number;
  fingerprint: string;
  representative: QizhengResult;
  last: QizhengResult;
  sampleCount: number;
  metrics: Map<string, MetricAccumulator>;
  events: Map<string, EventAccumulator>;
};

function assertTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value % SECOND_MILLISECONDS !== 0) {
    throw new Error(`七政流曜出生区间${label}必须是整秒 UTC epoch 毫秒时间戳。`);
  }
}

function assertSource(source: QizhengFlowBirthRangeSource): number {
  if (!source || typeof source !== 'object') {
    throw new Error('七政流曜出生区间必须提供机器起止时间。');
  }
  assertTimestamp(source.startTimestamp, '起点');
  assertTimestamp(source.endTimestamp, '终点');
  if (source.startTimestamp >= source.endTimestamp) {
    throw new Error('七政流曜出生区间必须是起点含、终点不含的正时长范围。');
  }
  if (source.endExclusive !== true) throw new Error('七政流曜出生区间必须使用半开终点。');
  if (source.timezone !== 'Asia/Shanghai' || source.offsetHours !== CHINA_OFFSET_HOURS) {
    throw new Error('七政流曜出生区间只接受固定北京时间 UTC+8。');
  }
  const duration = source.endTimestamp - source.startTimestamp;
  if (duration > MAX_RANGE_MILLISECONDS) {
    throw new Error('七政流曜出生区间不得超过两小时。');
  }
  return duration / SECOND_MILLISECONDS;
}

function assertFlowBirthInput(input: QizhengInput, source: QizhengFlowBirthRangeSource): void {
  if (input.timeZoneId !== undefined) {
    throw new Error('七政流曜出生区间固定使用 UTC+8，不接受 timeZoneId。');
  }
  if (input.timezone !== undefined && input.timezone !== CHINA_OFFSET_HOURS) {
    throw new Error('七政流曜出生区间的 timezone 必须为 8。');
  }
  if (input.flowYear === undefined) {
    throw new Error('七政流曜出生区间必须明确 flowYear。');
  }
  const local = getCivilDateTimeAtFixedOffset(new Date(source.startTimestamp), CHINA_OFFSET_HOURS);
  if (
    input.year !== local.year ||
    input.month !== local.month ||
    input.day !== local.day ||
    input.hour !== local.hour ||
    (input.minute ?? 0) !== local.minute ||
    (input.second ?? 0) !== local.second
  ) {
    throw new Error('七政流曜出生区间输入的出生字段必须等于起点北京时间墙钟字段。');
  }
}

function inputAtTimestamp(input: QizhengInput, timestamp: number): QizhengInput {
  const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), CHINA_OFFSET_HOURS);
  return {
    ...input,
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    second: local.second,
    timezone: CHINA_OFFSET_HOURS,
  };
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error('七政流曜出生区间计算已取消。');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return `${typeof value}:${String(value)}`;
}

function projectFlowDiscrete(result: QizhengResult): unknown {
  const flowing = result.flowingStars;
  const timeLords = result.timeLords;
  const periodEvents = flowing?.periodEvents;
  const transits = flowing?.transits
    ? [...flowing.transits].sort((left, right) => {
        const leftKey = `${left.star1}\u0000${left.star2}\u0000${left.type}\u0000${left.exactAngle}\u0000${left.allowedOrb}`;
        const rightKey = `${right.star1}\u0000${right.star2}\u0000${right.type}\u0000${right.exactAngle}\u0000${right.allowedOrb}`;
        return leftKey.localeCompare(rightKey);
      })
    : undefined;
  return {
    stars: flowing?.stars.map((star) => ({
      name: star.name,
      xiu: star.xiu,
      signIndex: star.signIndex,
      signBranch: star.signBranch,
      palace: star.palace,
      retrograde: star.retrograde ?? null,
      dignity: star.dignity ?? null,
      sourceId: star.sourceId,
      precisionClass: star.precisionClass,
    })),
    transits: transits?.map((transit) => ({
      star1: transit.star1,
      star2: transit.star2,
      type: transit.type,
      exactAngle: transit.exactAngle,
      allowedOrb: transit.allowedOrb,
      closeness: transit.closeness,
      precisionClass: transit.precisionClass,
    })),
    timeLords: timeLords
      ? {
          yearStem: timeLords.yearStem,
          yearStemYinYang: timeLords.yearStemYinYang,
          gender: timeLords.gender,
          direction: timeLords.direction,
          nominalAge: timeLords.nominalAge,
          majorLimitStatus: timeLords.majorLimitStatus,
          majorPalaceYears: timeLords.majorPalaceYears,
          currentMajorLimit: timeLords.currentMajorLimit,
          currentMinorLimit: timeLords.currentMinorLimit,
          annualBranch: timeLords.annualBranch,
          annualPalace: timeLords.annualPalace,
        }
      : null,
    events: periodEvents
      ? eventOccurrences(periodEvents.events)
          .map(([identity]) => identity)
          .sort()
      : [],
  };
}

function eventBaseIdentity(event: QizhengPeriodEvent): string {
  return stableJson({
    kind: event.kind,
    movingStar: event.movingStar,
    targetStar: event.targetStar ?? null,
    aspectType: event.aspectType ?? null,
    aspectDirection: event.aspectDirection ?? null,
    stationDirection: event.stationDirection ?? null,
    palace: event.palace ?? null,
    signBranch: event.signBranch ?? null,
  });
}

function eventIdentity(event: QizhengPeriodEvent, sequence = 0): string {
  return `${eventBaseIdentity(event)}#${sequence}`;
}

function eventOccurrences(
  events: readonly QizhengPeriodEvent[],
): Array<[string, QizhengPeriodEvent]> {
  const counts = new Map<string, number>();
  return [...events]
    .sort(
      (left, right) =>
        left.utcMs - right.utcMs || eventBaseIdentity(left).localeCompare(eventBaseIdentity(right)),
    )
    .map((event) => {
      const base = eventBaseIdentity(event);
      const sequence = counts.get(base) ?? 0;
      counts.set(base, sequence + 1);
      return [eventIdentity(event, sequence), event] as [string, QizhengPeriodEvent];
    });
}

function unwrap(value: number, reference: number, period: number): number {
  let result = value;
  while (result - reference > period / 2) result -= period;
  while (result - reference < -period / 2) result += period;
  return result;
}

function addMetric(metrics: Map<string, MetricAccumulator>, sample: ContinuousSample): void {
  const existing = metrics.get(sample.path);
  if (!existing) {
    metrics.set(sample.path, {
      path: sample.path,
      label: sample.label,
      unit: sample.unit,
      first: sample.value,
      last: sample.value,
      min: sample.value,
      max: sample.value,
      sampleCount: 1,
      circularPeriod: sample.circularPeriod,
      reference: sample.value,
    });
    return;
  }
  const comparable = existing.circularPeriod
    ? unwrap(sample.value, existing.reference, existing.circularPeriod)
    : sample.value;
  existing.last = sample.value;
  existing.min = Math.min(existing.min, comparable);
  existing.max = Math.max(existing.max, comparable);
  existing.sampleCount += 1;
}

function collectContinuousSamples(result: QizhengResult): ContinuousSample[] {
  const flowing = result.flowingStars;
  const samples: ContinuousSample[] = collectQizhengBirthRangeContinuousSamples(result).map(
    (sample: QizhengBirthRangeContinuousSample) => ({
      path: sample.path,
      label: sample.label,
      unit: sample.unit,
      value: sample.value,
      ...(sample.circularPeriod ? { circularPeriod: sample.circularPeriod } : {}),
    }),
  );
  if (!flowing) return samples;
  for (const star of flowing.stars) {
    samples.push(
      {
        path: `flowingStars.stars[${star.name}].tropicalLongitude`,
        label: `流曜${star.name}回归黄经`,
        unit: '度',
        value: star.tropicalLongitude,
        circularPeriod: 360,
      },
      {
        path: `flowingStars.stars[${star.name}].longitude`,
        label: `流曜${star.name}目标黄经`,
        unit: '度',
        value: star.longitude,
        circularPeriod: 360,
      },
      {
        path: `flowingStars.stars[${star.name}].xiuDegree`,
        label: `流曜${star.name}宿度`,
        unit: '度',
        value: star.xiuDegree,
      },
    );
  }
  for (const transit of flowing.transits) {
    const identity = `${transit.star1}↔${transit.star2}:${transit.type}`;
    samples.push(
      {
        path: `flowingStars.transits[${identity}].actualAngle`,
        label: `${identity}实际角距`,
        unit: '度',
        value: transit.actualAngle,
      },
      {
        path: `flowingStars.transits[${identity}].orb`,
        label: `${identity}偏差`,
        unit: '度',
        value: transit.orb,
      },
      {
        path: `flowingStars.transits[${identity}].orbRatio`,
        label: `${identity}容许度比例`,
        unit: '比例',
        value: transit.orbRatio,
      },
    );
  }
  return samples.filter((sample) => Number.isFinite(sample.value));
}

function updateEvents(
  events: Map<string, EventAccumulator>,
  periodEvents: NonNullable<QizhengFlowingStarsResult['periodEvents']> | undefined,
): void {
  if (!periodEvents) return;
  for (const [identity, event] of eventOccurrences(periodEvents.events)) {
    const existing = events.get(identity);
    if (!existing) {
      events.set(identity, {
        identity,
        kind: event.kind,
        movingStar: event.movingStar,
        ...(event.targetStar ? { targetStar: event.targetStar } : {}),
        ...(event.aspectType ? { aspectType: event.aspectType } : {}),
        ...(event.aspectDirection ? { aspectDirection: event.aspectDirection } : {}),
        ...(event.stationDirection ? { stationDirection: event.stationDirection } : {}),
        ...(event.palace ? { palace: event.palace } : {}),
        ...(event.signBranch ? { signBranch: event.signBranch } : {}),
        firstUtcMs: event.utcMs,
        lastUtcMs: event.utcMs,
        minUtcMs: event.utcMs,
        maxUtcMs: event.utcMs,
        sampleCount: 1,
        firstDateTime: event.dateTime,
        lastDateTime: event.dateTime,
      });
      continue;
    }
    existing.lastUtcMs = event.utcMs;
    existing.lastDateTime = event.dateTime;
    existing.minUtcMs = Math.min(existing.minUtcMs, event.utcMs);
    existing.maxUtcMs = Math.max(existing.maxUtcMs, event.utcMs);
    existing.sampleCount += 1;
  }
}

function createFingerprint(result: QizhengResult): string {
  return stableJson({
    natal: getQizhengBirthRangeDiscreteFingerprint(result),
    flow: projectFlowDiscrete(result),
  });
}

function createBranch(timestamp: number, result: QizhengResult, fingerprint: string): ActiveBranch {
  const metrics = new Map<string, MetricAccumulator>();
  for (const sample of collectContinuousSamples(result)) addMetric(metrics, sample);
  const events = new Map<string, EventAccumulator>();
  updateEvents(events, result.flowingStars?.periodEvents);
  return {
    startTimestamp: timestamp,
    fingerprint,
    representative: result,
    last: result,
    sampleCount: 1,
    metrics,
    events,
  };
}

function updateBranch(branch: ActiveBranch, result: QizhengResult): void {
  branch.last = result;
  branch.sampleCount += 1;
  for (const sample of collectContinuousSamples(result)) addMetric(branch.metrics, sample);
  updateEvents(branch.events, result.flowingStars?.periodEvents);
}

function finalizeBranch(branch: ActiveBranch, endTimestamp: number): QizhengFlowBirthRangeBranch {
  const periodEvents = branch.representative.flowingStars?.periodEvents;
  return {
    startTimestamp: branch.startTimestamp,
    endTimestamp,
    endExclusive: true,
    sampleCount: branch.sampleCount,
    representative: branch.representative,
    last: branch.last,
    continuous: [...branch.metrics.values()]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((item) => ({
        path: item.path,
        label: item.label,
        unit: item.unit,
        first: item.first,
        last: item.last,
        min: item.min,
        max: item.max,
        sampleCount: item.sampleCount,
        ...(item.circularPeriod
          ? {
              circular: {
                period: item.circularPeriod,
                mode: 'shortest-arc-from-first' as const,
                note: 'first/last 保留原始值；min/max 按相对首样本的最短弧解卷绕后统计。',
              },
            }
          : {}),
      })),
    periodEvents: {
      mode: periodEvents?.mode ?? 'daily',
      startDateTime: periodEvents?.startDateTime ?? '',
      endDateTime: periodEvents?.endDateTime ?? '',
      events: [...branch.events.values()].sort(
        (left, right) =>
          left.firstUtcMs - right.firstUtcMs || left.identity.localeCompare(right.identity),
      ),
    },
  };
}

function buildTarget(calculator: QizhengFlowRangeCalculator): QizhengFlowBirthRange['target'] {
  const input = calculator.flow.flowInput;
  return {
    mode: calculator.window.mode,
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute ?? 0,
    timestampNote: calculator.flow.timestampNote,
    startUtcTimestamp: calculator.window.startUtcMs,
    endUtcTimestamp: calculator.window.endUtcMs,
  };
}

/** 逐出生整秒计算流曜、行限和周期事件的完整范围。 */
export function generateQizhengFlowBirthRange(
  input: QizhengInput,
  source: QizhengFlowBirthRangeSource,
  options?: QizhengFlowBirthRangeOptions,
): QizhengFlowBirthRange {
  const sampleCount = assertSource(source);
  assertFlowBirthInput(input, source);
  const calculator = createQizhengFlowRangeCalculator(input);
  let active: ActiveBranch | undefined;
  const branches: QizhengFlowBirthRangeBranch[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    assertNotAborted(options?.signal);
    const timestamp = source.startTimestamp + index * SECOND_MILLISECONDS;
    const sampleInput = inputAtTimestamp(input, timestamp);
    const result = calculator.generate(sampleInput);
    const fingerprint = createFingerprint(result);
    if (!active) {
      active = createBranch(timestamp, result, fingerprint);
    } else if (active.fingerprint === fingerprint) {
      updateBranch(active, result);
    } else {
      branches.push(finalizeBranch(active, timestamp));
      active = createBranch(timestamp, result, fingerprint);
    }
    options?.onProgress?.(index + 1, sampleCount);
  }
  assertNotAborted(options?.signal);
  if (!active) throw new Error('七政流曜出生区间没有可计算的整秒样本。');
  branches.push(finalizeBranch(active, source.endTimestamp));
  return {
    coverage: 'flow',
    status: branches.length === 1 ? 'stable' : 'conditional',
    source,
    resolutionSeconds: 1,
    sampleCount,
    target: buildTarget(calculator),
    branches,
  };
}
