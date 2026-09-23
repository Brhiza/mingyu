/** 西占出生时间逐秒动态范围；每个样本计算完整目标范围，不以本命代表秒代算。 */
import type { AstrolabeBirthInput, AstrolabeData } from '../types/divination';
import { generateAstrolabe } from './algorithms/astrolabe';
import {
  collectAstrolabeBirthRangeContinuousSamples,
  finalizeAstrolabeRangeMetrics,
  getAstrolabeBirthRangeDiscreteFingerprint,
  getAstrolabeRangeInputAtTimestamp,
  updateAstrolabeRangeMetrics,
  validateAstrolabeRangeInput,
  type AstrolabeBirthRangeContinuousFact,
  type AstrolabeBirthRangeContinuousSample,
  type AstrolabeBirthRangeInput,
  type AstrolabeBirthRangeOptions,
  type AstrolabeBirthRangeSource,
  type AstrolabeRangeMetricAccumulator,
} from './astrolabe-birth-range';
import {
  buildAstrolabeFullScopeContexts,
  buildAstrolabeScopeContext,
  type AstrolabeScopeContext,
  type SecondaryProgressionEvidence,
  type SolarArcEvidence,
  type SolarReturnEvidence,
} from './astrolabe-scope';
import {
  AstrolabePeriodCalculationCache,
  type AstrolabePeriodEventCollection,
} from './astrolabe-period-events';

export type AstrolabeDynamicScope = 'yearly' | 'monthly' | 'daily' | 'full';
export type AstrolabeDynamicRangeRequest = { scope: AstrolabeDynamicScope; referenceDate: string };
export type AstrolabeDynamicSample = { natal: AstrolabeData; scopes: AstrolabeScopeContext[] };
export type AstrolabeDynamicRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  sampleCount: number;
  representative: AstrolabeDynamicSample;
  last: AstrolabeDynamicSample;
  continuous: AstrolabeBirthRangeContinuousFact[];
};
export type AstrolabeDynamicRange = {
  coverage: 'natal+dynamic';
  scope: AstrolabeDynamicScope;
  referenceDate: string;
  status: 'stable' | 'conditional';
  source: AstrolabeBirthRangeSource;
  resolutionSeconds: 1;
  sampleCount: number;
  branchCount: number;
  branches: AstrolabeDynamicRangeBranch[];
};

export type AstrolabeDynamicRangeSummary = Omit<AstrolabeDynamicRange, 'branches'>;

type AdvancedEvidence = SecondaryProgressionEvidence | SolarArcEvidence | SolarReturnEvidence;
type ContinuousSample = AstrolabeBirthRangeContinuousSample;

function pushNumber(
  samples: ContinuousSample[],
  path: string,
  label: string,
  unit: string,
  value: number | undefined,
  circularPeriod?: number,
) {
  if (value === undefined) return;
  if (!Number.isFinite(value)) throw new Error(`动态区间事实不是有效数值：${label}。`);
  samples.push({ path, label, unit, value, ...(circularPeriod ? { circularPeriod } : {}) });
}

/** 带 Z 的推进时刻是 UTC；无时区的返照字段仍按本入口固定 UTC+8 墙钟解析。 */
function civilMilliseconds(value: string) {
  if (/Z$/u.test(value)) return Date.parse(value);
  return Date.parse(`${value.replace(' ', 'T').replace(/Z$/, '')}+08:00`);
}

function pushDate(samples: ContinuousSample[], path: string, label: string, value?: string) {
  if (value !== undefined) pushNumber(samples, path, label, 'UTC毫秒', civilMilliseconds(value));
}

function pointNumbers(
  samples: ContinuousSample[],
  path: string,
  label: string,
  point: {
    longitude: number;
    latitude?: number;
    distance?: number;
    longitudeSpeed?: number;
  },
) {
  pushNumber(samples, `${path}.longitude`, `${label}黄经`, '度', point.longitude, 360);
  pushNumber(samples, `${path}.latitude`, `${label}黄纬`, '度', point.latitude);
  pushNumber(samples, `${path}.distance`, `${label}地心距离`, '天文单位', point.distance);
  pushNumber(
    samples,
    `${path}.longitudeSpeed`,
    `${label}黄经日运动`,
    '度/日',
    point.longitudeSpeed,
  );
}

const STEP_NUMBERS: Record<string, { label: string; unit: string; period?: number }> = {
  natalSunLongitude: { label: '本命太阳黄经', unit: '度', period: 360 },
  arcDegrees: { label: '推进弧', unit: '度', period: 360 },
  bestSampleDifferenceDegrees: { label: '粗搜最佳样本经度差', unit: '度' },
  residualDegrees: { label: '太阳残差', unit: '度' },
  refinementIterations: { label: '细化迭代次数', unit: '次' },
};

function stepRecord(
  samples: ContinuousSample[],
  path: string,
  label: string,
  record: Record<string, string | number | boolean>,
) {
  return Object.entries(record).map(([key, value]) => {
    if (key.endsWith('DateTime') && typeof value === 'string') {
      pushDate(samples, `${path}.${key}`, `${label}时刻`, value);
      return [key, '连续时刻'];
    }
    const descriptor = STEP_NUMBERS[key];
    if (descriptor && typeof value === 'number') {
      pushNumber(
        samples,
        `${path}.${key}`,
        `${label}${descriptor.label}`,
        descriptor.unit,
        value,
        descriptor.period,
      );
      return [key, '连续数值'];
    }
    return [key, value];
  });
}

function advancedProjection(
  evidence: AdvancedEvidence | undefined,
  prefix: string,
  samples: ContinuousSample[],
) {
  if (!evidence) return null;
  const name = evidence.movingPointFacts[0]?.technique ?? evidence.key;
  const movingLabel = (label: string) => (label.startsWith(name) ? label : `${name}${label}`);
  for (const point of evidence.movingPointFacts) {
    pointNumbers(samples, `${prefix}.points.${point.key}`, movingLabel(point.label), point);
  }
  for (const aspect of evidence.candidateAspectFacts) {
    const path = `${prefix}.aspects.${aspect.key}`;
    const label = `${movingLabel(aspect.movingPoint)}${aspect.aspectName}${aspect.natalPoint}`;
    pushNumber(samples, `${path}.actualAngle`, `${label}实际角距`, '度', aspect.actualAngle);
    pushNumber(samples, `${path}.deviation`, `${label}偏差`, '度', aspect.deviation);
    pushNumber(
      samples,
      `${path}.normalizedOrbRatio`,
      `${label}容许度比例`,
      '比例',
      aspect.normalizedOrbRatio,
    );
  }
  if ('progressedDateTime' in evidence)
    pushDate(samples, `${prefix}.progressedTime`, `${name}推进时刻`, evidence.progressedDateTime);
  if ('arcDegrees' in evidence)
    pushNumber(samples, `${prefix}.arcDegrees`, '太阳推进弧', '度', evidence.arcDegrees, 360);
  if ('dateTime' in evidence)
    pushDate(samples, `${prefix}.returnTime`, '太阳返照时刻', evidence.dateTime);
  if ('residualDegrees' in evidence)
    pushNumber(
      samples,
      `${prefix}.residualDegrees`,
      '返照太阳残差',
      '度',
      evidence.residualDegrees,
    );
  const time = 'timeScale' in evidence ? evidence.timeScale : undefined;
  if (time) {
    for (const [key, label, unit] of [
      ['unixMilliseconds', '返照UTC时刻', 'UTC毫秒'],
      ['julianDayUtc', '返照UTC儒略日', '日'],
      ['julianDayUtApprox', '返照近似UT1儒略日', '日'],
      ['julianDayTtApprox', '返照近似TT儒略日', '日'],
      ['deltaTSeconds', '返照ΔT', '秒'],
      ['decimalYear', '返照小数年', '年'],
    ] as const)
      pushNumber(samples, `${prefix}.timeScale.${key}`, label, unit, time[key]);
  }
  return {
    key: evidence.key,
    status: evidence.status,
    year: evidence.targetYear,
    age: 'age' in evidence ? evidence.age : null,
    points: evidence.movingPointFacts.map((point) => [
      point.key,
      point.name,
      point.signName,
      point.retrograde ?? null,
      point.house ?? null,
      point.sourceName ?? null,
      point.aspectFactKeys,
      point.candidateAspectFactKeys,
    ]),
    selected: evidence.aspectFacts.map((fact) => fact.key),
    aspects: evidence.candidateAspectFacts.map((fact) => [
      fact.key,
      fact.movingPointKey,
      fact.natalPointKey,
      fact.aspectName,
      fact.exactAngle,
      fact.allowedOrb,
      fact.closeness,
    ]),
    steps: evidence.calculationSteps.map((step) => ({
      key: step.key,
      stage: step.stage,
      status: step.status,
      dependencies: step.dependsOnStepKeys,
      inputs: stepRecord(
        samples,
        `${prefix}.steps.${step.key}.inputs`,
        `${name}${step.stage}`,
        step.inputs,
      ),
      result: stepRecord(
        samples,
        `${prefix}.steps.${step.key}.result`,
        `${name}${step.stage}`,
        step.result,
      ),
    })),
    summary: evidence.summaryFact.status,
    aspectSummary: evidence.aspectSummaryFact.status,
    limitations: evidence.limitationFacts.map((fact) => [
      fact.key,
      fact.status,
      fact.type,
      fact.ownerStepKeys,
    ]),
    timeScale: time
      ? [
          time.status,
          time.timezone,
          time.timeZoneId ?? null,
          time.deltaTModel,
          time.precisionLevel,
          time.counterSummaryFact.status,
          time.summaryFact.status,
        ]
      : null,
  };
}

function periodProjection(
  period: AstrolabePeriodEventCollection | undefined,
  prefix: string,
  samples: ContinuousSample[],
) {
  if (!period) return null;
  const occurrences = new Map<string, number>();
  const eventKeys = new Map<string, string>();
  const events = period.events.map((event) => {
    const identity = JSON.stringify([
      event.kind,
      event.movingPoint,
      event.targetPoint ?? null,
      event.aspectName ?? null,
      event.signName ?? null,
      event.house ?? null,
      event.stationDirection ?? null,
      event.lunationName ?? null,
      event.eclipseName ?? null,
    ]);
    const ordinal = (occurrences.get(identity) ?? 0) + 1;
    occurrences.set(identity, ordinal);
    const key = `${identity}#${ordinal}`;
    eventKeys.set(event.key, key);
    const path = `${prefix}.events.${key}`;
    const label = `${event.movingPoint}${event.aspectName ?? event.kind}${event.targetPoint ?? ''}第${ordinal}次`;
    pushNumber(samples, `${path}.julianDate`, `${label}时刻`, '儒略日', event.julianDate);
    for (const touch of event.lunationTouchCandidates ?? []) {
      const touchPath = `${path}.touches.${touch.key}`;
      const touchLabel = `${label}${touch.aspectName}本命${touch.pointLabel}`;
      pushNumber(
        samples,
        `${touchPath}.actualAngle`,
        `${touchLabel}实际角距`,
        '度',
        touch.actualAngle,
      );
      pushNumber(samples, `${touchPath}.deviation`, `${touchLabel}偏差`, '度', touch.deviation);
    }
    return {
      key,
      selectedTouches: event.lunationTouches?.map((touch) => touch.key) ?? [],
      touches:
        event.lunationTouchCandidates?.map((touch) => [
          touch.key,
          touch.exactAngle,
          touch.allowedOrb,
        ]) ?? [],
    };
  });
  const members = (keys: string[]) =>
    keys.map((key) => {
      const identity = eventKeys.get(key);
      if (!identity) throw new Error('动态周期成员缺少对应事件。');
      return identity;
    });
  return {
    start: period.startDateTime,
    end: period.endDateTime,
    timezone: period.timezoneLabel,
    events,
    groups: period.groups.map((group) => [
      group.key,
      members(group.events.map((event) => event.key)),
    ]),
    windows: period.windows.map((window, index) => {
      pushDate(
        samples,
        `${prefix}.windows.${index}.start`,
        `第${index + 1}个周期窗口起点`,
        window.startDateTime,
      );
      pushDate(
        samples,
        `${prefix}.windows.${index}.end`,
        `第${index + 1}个周期窗口终点`,
        window.endDateTime,
      );
      return members(window.eventKeys);
    }),
    axis: period.axis.map((axis) => members(axis.eventKeys!)),
  };
}

function scopeProjection(context: AstrolabeScopeContext, samples: ContinuousSample[]) {
  const prefix = `dynamic.${context.scope}`;
  for (const fact of context.transitFacts?.facts ?? []) {
    const path = `${prefix}.transits.${fact.key}`;
    const label = `行运${fact.transiting.label}${fact.aspectName}本命${fact.natal.label}`;
    pointNumbers(samples, `${path}.moving`, `行运${fact.transiting.label}`, fact.transiting);
    pushNumber(samples, `${path}.actualAngle`, `${label}实际角距`, '度', fact.actualAngle);
    pushNumber(samples, `${path}.deviation`, `${label}偏差`, '度', fact.deviation);
    pushNumber(samples, `${path}.strength`, `${label}几何紧密度`, '数值', fact.strength);
  }
  for (const fact of context.transitHouseFacts?.facts ?? []) {
    pointNumbers(samples, `${prefix}.houses.${fact.key}`, `行运${fact.label}`, fact);
  }
  return {
    scope: context.scope,
    date: context.dateStr,
    transitStatus: context.transitFacts?.status ?? null,
    transits:
      context.transitFacts?.facts.map((fact) => [
        fact.key,
        fact.line,
        fact.phase,
        fact.isOutOfSign,
        fact.exactAngle,
        fact.allowedOrb,
        fact.transiting.sign,
        fact.transiting.retrograde,
        fact.transiting.natalHouse,
        fact.natal.sign,
        fact.natal.natalHouse,
      ]) ?? [],
    headline: context.transitFacts?.headlineFactKeys ?? [],
    houseStatus: context.transitHouseFacts?.status ?? null,
    houses:
      context.transitHouseFacts?.facts.map((fact) => [
        fact.key,
        fact.sign,
        fact.retrograde,
        fact.natalHouse,
      ]) ?? [],
    progression: advancedProjection(
      context.secondaryProgressionEvidence,
      `${prefix}.progression`,
      samples,
    ),
    arc: advancedProjection(context.solarArcEvidence, `${prefix}.arc`, samples),
    solarReturn: advancedProjection(context.solarReturnEvidence, `${prefix}.return`, samples),
    period: periodProjection(context.periodEvents, `${prefix}.period`, samples),
  };
}

/** 一次投影同时取得离散指纹和连续事实，供扫描与独立逐秒核对使用。 */
export function projectAstrolabeDynamicSample(sample: AstrolabeDynamicSample) {
  const samples = collectAstrolabeBirthRangeContinuousSamples(sample.natal);
  const scopes = sample.scopes.map((scope) => scopeProjection(scope, samples));
  const fingerprint = JSON.stringify({
    natal: getAstrolabeBirthRangeDiscreteFingerprint(sample.natal),
    scopes,
    continuousPaths: samples.map((fact) => fact.path),
  });
  return { fingerprint, samples };
}

function calculateSample(
  input: AstrolabeBirthInput,
  request: AstrolabeDynamicRangeRequest,
  periodCalculationCache: AstrolabePeriodCalculationCache,
): AstrolabeDynamicSample {
  const natal = generateAstrolabe(input);
  const scopes =
    request.scope === 'full'
      ? Object.values(
          buildAstrolabeFullScopeContexts(natal, request.referenceDate, { periodCalculationCache }),
        )
      : [
          buildAstrolabeScopeContext(natal, request.scope, request.referenceDate, {
            periodCalculationCache,
          }),
        ];
  return { natal, scopes };
}

/** 按完整分段交付，消费方可逐段保存或渲染，扫描器不保留已交付分段。 */
export function* scanAstrolabeDynamicRange(
  input: AstrolabeBirthInput,
  range: AstrolabeBirthRangeInput,
  request: AstrolabeDynamicRangeRequest,
  options: AstrolabeBirthRangeOptions = {},
): Generator<AstrolabeDynamicRangeBranch, AstrolabeDynamicRangeSummary, void> {
  const total = validateAstrolabeRangeInput(input, range);
  if (!request || !['yearly', 'monthly', 'daily', 'full'].includes(request.scope)) {
    throw new Error('动态出生区间必须指定流年、流月、流日或完整范围。');
  }
  let branchCount = 0;
  const periodCalculationCache = new AstrolabePeriodCalculationCache();
  let active:
    | {
        fingerprint: string;
        branch: AstrolabeDynamicRangeBranch;
        metrics: Map<string, AstrolabeRangeMetricAccumulator>;
      }
    | undefined;
  for (let completed = 0; completed < total; completed++) {
    if (options.signal?.aborted) throw new Error('西占动态区间计算已取消。');
    const timestamp = range.startTimestamp + completed * 1000;
    const sample = calculateSample(
      getAstrolabeRangeInputAtTimestamp(input, timestamp),
      request,
      periodCalculationCache,
    );
    const projection = projectAstrolabeDynamicSample(sample);
    if (!active || active.fingerprint !== projection.fingerprint) {
      if (active) {
        active.branch.continuous = finalizeAstrolabeRangeMetrics(active.metrics);
        branchCount++;
        yield active.branch;
        if (options.signal?.aborted) throw new Error('西占动态区间计算已取消。');
      }
      active = {
        fingerprint: projection.fingerprint,
        metrics: new Map(),
        branch: {
          startTimestamp: timestamp,
          endTimestamp: timestamp,
          endExclusive: true,
          sampleCount: 0,
          representative: sample,
          last: sample,
          continuous: [],
        },
      };
    }
    active.branch.last = sample;
    active.branch.endTimestamp = timestamp + 1000;
    active.branch.sampleCount++;
    updateAstrolabeRangeMetrics(active.metrics, projection.samples);
    options.onProgress?.(completed + 1, total);
  }
  if (options.signal?.aborted) throw new Error('西占动态区间计算已取消。');
  if (active) {
    active.branch.continuous = finalizeAstrolabeRangeMetrics(active.metrics);
    branchCount++;
    yield active.branch;
  }
  if (options.signal?.aborted) throw new Error('西占动态区间计算已取消。');
  return {
    coverage: 'natal+dynamic',
    scope: request.scope,
    referenceDate: request.referenceDate,
    status: branchCount === 1 ? 'stable' : 'conditional',
    source: {
      startTimestamp: range.startTimestamp,
      endTimestamp: range.endTimestamp,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
    resolutionSeconds: 1,
    sampleCount: total,
    branchCount,
  };
}

/** 需要整体结果的调用方沿用同一扫描器收集分段。 */
export function generateAstrolabeDynamicRange(
  input: AstrolabeBirthInput,
  range: AstrolabeBirthRangeInput,
  request: AstrolabeDynamicRangeRequest,
  options: AstrolabeBirthRangeOptions = {},
): AstrolabeDynamicRange {
  const scanner = scanAstrolabeDynamicRange(input, range, request, options);
  const branches: AstrolabeDynamicRangeBranch[] = [];
  for (;;) {
    const next = scanner.next();
    if (next.done) return { ...next.value, branches };
    branches.push(next.value);
  }
}
