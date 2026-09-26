/**
 * @file 西洋占星本命出生时间整秒区间
 * @description 在固定 UTC+8 的机器时间范围内逐秒计算本命盘，按完整离散盘面事实切分分支。
 */

import { getCivilDateTimeAtFixedOffset } from '../calendar/civil-time';
import type { AstrolabeAspect, AstrolabeBirthInput, AstrolabeData } from '../types/divination';

import { generateAstrolabe } from './algorithms/astrolabe';

const CHINA_OFFSET_HOURS = 8;
const SECOND_MILLISECONDS = 1_000;
const MAX_RANGE_MILLISECONDS = 2 * 60 * 60 * SECOND_MILLISECONDS;

export type AstrolabeBirthRangeInput = {
  startTimestamp: number;
  endTimestamp: number;
};

export type AstrolabeBirthRangeOptions = {
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

export type AstrolabeBirthRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type AstrolabeBirthRangeContinuousFact = {
  /** 机器读取路径；展示层应使用 label。 */
  path: string;
  /** 面向提示词/UI 的中文事实名称。 */
  label: string;
  unit: string;
  /** 起点样本的原始值；圆周量不在此处改写。 */
  first: number;
  /** 终点前一秒样本的原始值；圆周量不在此处改写。 */
  last: number;
  /** 整秒样本观察值的最小值；圆周量按相对首样本解卷绕后统计。 */
  min: number;
  max: number;
  sampleCount: number;
  circular?: {
    period: number;
    mode: 'shortest-arc-from-first';
    note: string;
  };
};

export type AstrolabeBirthRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  sampleCount: number;
  /** 离散分支起点的完整本命盘。 */
  representative: AstrolabeData;
  /** 离散分支终点前一秒的完整本命盘。 */
  last: AstrolabeData;
  continuous: AstrolabeBirthRangeContinuousFact[];
};

export type AstrolabeBirthRange = {
  /** 仅覆盖出生本命，不包含行运、次限或其他目标时段。 */
  coverage: 'natal';
  status: 'stable' | 'conditional';
  source: AstrolabeBirthRangeSource;
  resolutionSeconds: 1;
  sampleCount: number;
  branches: AstrolabeBirthRangeBranch[];
};

export type AstrolabeBirthRangeContinuousSample = {
  path: string;
  label: string;
  unit: string;
  value: number;
  circularPeriod?: number;
};

export type AstrolabeRangeMetricAccumulator = {
  path: string;
  label: string;
  unit: string;
  first: number;
  last: number;
  min: number;
  max: number;
  sampleCount: number;
  circularPeriod?: number;
  circularReference: number;
};

type ActiveBranch = {
  startTimestamp: number;
  fingerprint: string;
  representative: AstrolabeData;
  last: AstrolabeData;
  sampleCount: number;
  metrics: Map<string, AstrolabeRangeMetricAccumulator>;
};

function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value % SECOND_MILLISECONDS === 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function assertTimestamp(value: number, label: string): void {
  if (!isValidTimestamp(value)) {
    throw new Error(`西占星盘本命区间${label}必须是整秒 UTC epoch 毫秒时间戳。`);
  }
}

function assertRange(range: AstrolabeBirthRangeInput): number {
  if (!range || typeof range !== 'object') {
    throw new Error('西占星盘本命区间必须提供起止时间戳。');
  }
  assertTimestamp(range.startTimestamp, '起点');
  assertTimestamp(range.endTimestamp, '终点');
  if (range.startTimestamp >= range.endTimestamp) {
    throw new Error('西占星盘本命区间必须是起点含、终点不含的正时长范围。');
  }
  const duration = range.endTimestamp - range.startTimestamp;
  if (duration > MAX_RANGE_MILLISECONDS) {
    throw new Error('西占星盘本命区间不得超过两小时。');
  }
  if (duration % SECOND_MILLISECONDS !== 0) {
    throw new Error('西占星盘本命区间长度必须是整秒。');
  }
  return duration / SECOND_MILLISECONDS;
}

function assertFixedTimezoneInput(input: AstrolabeBirthInput): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('西占星盘本命区间输入必须是对象。');
  }
  if (input.timeZoneId !== undefined) {
    throw new Error('西占星盘本命区间固定使用 UTC+8，不接受 timeZoneId。');
  }
  if (input.timezone === undefined || Number(input.timezone) !== CHINA_OFFSET_HOURS) {
    throw new Error('西占星盘本命区间的 timezone 必须为 8。');
  }
}

function assertInputMatchesStart(input: AstrolabeBirthInput, startTimestamp: number): void {
  const start = getCivilDateTimeAtFixedOffset(new Date(startTimestamp), CHINA_OFFSET_HOURS);
  if (
    Number(input.year) !== start.year ||
    Number(input.month) !== start.month ||
    Number(input.day) !== start.day ||
    Number(input.hour) !== start.hour ||
    Number(input.minute) !== start.minute ||
    Number(input.second ?? '0') !== start.second
  ) {
    throw new Error('西占星盘本命区间输入的出生字段必须等于起点北京时间墙钟字段。');
  }
}

export function getAstrolabeRangeInputAtTimestamp(
  input: AstrolabeBirthInput,
  timestamp: number,
): AstrolabeBirthInput {
  const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), CHINA_OFFSET_HOURS);
  return {
    ...input,
    year: String(local.year),
    month: String(local.month),
    day: String(local.day),
    hour: String(local.hour),
    minute: String(local.minute),
    second: String(local.second),
    timezone: String(CHINA_OFFSET_HOURS),
    timeZoneId: undefined,
  };
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error('西占星盘本命区间计算已取消。');
  }
}

function projectPoint(point: AstrolabeData['planets'][number]) {
  return {
    name: point.name,
    label: point.label,
    sign: point.sign,
    house: point.house,
    retrograde: point.retrograde ?? null,
    dignity: point.dignity ?? null,
    dignityLabel: point.dignityLabel ?? null,
  };
}

function sortAstrolabeAspects(aspects: readonly AstrolabeAspect[]): AstrolabeAspect[] {
  return [...aspects].sort((first, second) => {
    const firstKey = [first.body1, first.body2, first.type, first.symbol].join('\u0000');
    const secondKey = [second.body1, second.body2, second.type, second.symbol].join('\u0000');
    return firstKey.localeCompare(secondKey);
  });
}

function projectAspect(aspect: AstrolabeAspect) {
  return {
    body1: aspect.body1,
    body2: aspect.body2,
    type: aspect.type,
    symbol: aspect.symbol,
    exactAngle: aspect.exactAngle ?? null,
    allowedOrb: aspect.allowedOrb ?? null,
    closeness: aspect.closeness ?? null,
    applying: aspect.applying,
    isOutOfSign: aspect.isOutOfSign ?? null,
    source: aspect.source ?? null,
  };
}

function projectRecord(record: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, values]) => [key, [...values]]),
  );
}

function projectEphemerisWarnings(values: readonly string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => {
      const outsideRangeMarker = '位置超出已验证年代';
      const outsideRangeIndex = value.indexOf(outsideRangeMarker);
      if (outsideRangeIndex >= 0) {
        return value.slice(0, outsideRangeIndex) + outsideRangeMarker;
      }
      if (value.includes('时标差估计不确定度')) return '时标差估计不确定度';
      return '其他星历警告';
    })
    .sort();
}

function projectTimezoneDiagnostics(values: readonly string[] | undefined): string[] {
  return (values ?? []).map((value) => {
    if (value.includes('冲突')) return '存在时区冲突';
    if (value.includes('歧义')) return '存在时区歧义';
    return '存在时区诊断';
  });
}

function projectTimezoneEvidence(value: AstrolabeData['birth']['timezoneEvidence']) {
  if (!value) return null;
  return {
    key: value.key,
    timeZoneId: value.timeZoneId,
    database: value.database,
    status: value.status,
    resolvedOffsetHours: value.resolvedOffsetHours,
    possibleOffsetsHours: [...value.possibleOffsetsHours],
    fixedOffsetHours: value.fixedOffsetHours ?? null,
    ambiguityResolvedByFixedOffset: value.ambiguityResolvedByFixedOffset,
    offsetConflict: value.offsetConflict,
    diagnosticFacts: [...value.diagnosticFacts]
      .sort((first, second) => first.key.localeCompare(second.key))
      .map((item) => ({
        key: item.key,
        type: item.type,
        status: item.status,
      })),
    diagnosticSummaryStatus: value.diagnosticSummaryFact.status,
    summaryStatus: value.summaryFact.status,
    limitationStatuses: [...value.limitationFacts]
      .sort((first, second) => first.key.localeCompare(second.key))
      .map((item) => ({
        key: item.key,
        type: item.type,
        status: item.status,
      })),
  };
}

function projectTrueSolarEvidence(value: NonNullable<AstrolabeData['birth']['trueSolarEvidence']>) {
  return {
    key: value.key,
    status: value.status,
    correctionFacts: [...value.correctionFacts]
      .sort((first, second) => first.key.localeCompare(second.key))
      .map((item) => ({
        key: item.key,
        type: item.type,
        status: item.status,
      })),
    summaryStatus: value.summaryFact.status,
    limitationStatuses: [...value.limitationFacts]
      .sort((first, second) => first.key.localeCompare(second.key))
      .map((item) => ({
        key: item.key,
        type: item.type,
        status: item.status,
      })),
  };
}

function projectEvidence(analysis: AstrolabeData['evidenceAnalysis']) {
  if (!analysis) return null;
  const sortedAspectFacts = [...analysis.aspectFacts].sort((first, second) =>
    first.key.localeCompare(second.key),
  );
  const sortedCounterEvidenceFacts = [...analysis.counterEvidenceFacts].sort((first, second) =>
    [first.type, first.status, ...first.ownerFactKeys]
      .join('\u0000')
      .localeCompare([second.type, second.status, ...second.ownerFactKeys].join('\u0000')),
  );
  const sortedLimitationFacts = [...analysis.limitationFacts].sort((first, second) =>
    first.key.localeCompare(second.key),
  );
  return {
    key: analysis.key,
    status: analysis.status,
    calculationFact: {
      status: analysis.calculationFact.status,
      models: analysis.calculationFact.models,
      missing: [...analysis.calculationFact.missing].sort(),
    },
    calculationSteps: analysis.calculationSteps.map((item) => ({
      key: item.key,
      stage: item.stage,
      status: item.status,
    })),
    timezoneFact: projectTimezoneEvidence(analysis.timezoneFact),
    trueSolarTimeFact: analysis.trueSolarTimeFact
      ? projectTrueSolarEvidence(analysis.trueSolarTimeFact)
      : null,
    primaryCoverageFact: {
      status: analysis.primaryCoverageFact.status,
      actualRoles: [...analysis.primaryCoverageFact.actualRoles],
      missingRoles: [...analysis.primaryCoverageFact.missingRoles],
    },
    primaryPointFacts: analysis.primaryPointFacts.map((item) => ({
      key: item.key,
      role: item.role,
      status: item.status,
      positionFactKey: item.positionFactKey,
    })),
    positionFacts: analysis.positionFacts.map((item) => ({
      key: item.key,
      status: item.status,
      kind: item.kind,
      name: item.name,
      house: item.house ?? null,
      retrograde: item.retrograde,
    })),
    aspectFacts: sortedAspectFacts.map((item) => ({
      key: item.key,
      status: item.status,
      body1: item.body1,
      body2: item.body2,
      type: item.type,
      phase: item.phase,
      closeness: item.closeness,
      isOutOfSign: item.isOutOfSign ?? null,
      positionFactKeys: [...item.positionFactKeys],
    })),
    distributionEvidenceFacts: analysis.distributionEvidenceFacts.map((item) => ({
      key: item.key,
      kind: item.kind,
      label: item.label,
      members: [...item.members],
      memberPositionFactKeys: [...item.memberPositionFactKeys],
      count: item.count,
      status: item.status,
    })),
    illuminationFact: {
      key: analysis.illuminationFact.key,
      status: analysis.illuminationFact.status,
      crossingFactKeys: [...analysis.illuminationFact.crossingFactKeys],
    },
    counterEvidenceFacts: sortedCounterEvidenceFacts.map((item) => ({
      type: item.type,
      status: item.status,
      ownerFactKeys: [...item.ownerFactKeys].sort(),
    })),
    counterSummaryFact: {
      status: analysis.counterSummaryFact.status,
      factKeys: [...analysis.counterSummaryFact.factKeys].sort(),
    },
    limitationFacts: sortedLimitationFacts.map((item) => ({
      key: item.key,
      type: item.type,
      status: item.status,
      ownerFactKeys: [...item.ownerFactKeys].sort(),
    })),
    summaryFact: {
      status: analysis.summaryFact.status,
      factKeys: [...analysis.summaryFact.factKeys].sort(),
      positionFactCount: analysis.summaryFact.positionFactCount,
      aspectFactCount: analysis.summaryFact.aspectFactCount,
      distributionFactCount: analysis.summaryFact.distributionFactCount,
      counterEvidenceCount: analysis.summaryFact.counterEvidenceCount,
      limitationFactCount: analysis.summaryFact.limitationFactCount,
    },
  };
}

function projectSolarIllumination(value: AstrolabeData['solarIllumination']) {
  if (!value) return null;
  const crossing = (item: typeof value.sunriseSunset) => ({
    key: item.key,
    status: item.status,
  });
  const astronomicalTime = value.astronomicalTime;
  return {
    status: value.status,
    localDate: value.localDate,
    timezone: value.timezone,
    method: value.method,
    source: value.source,
    astronomicalTime: {
      status: astronomicalTime.status,
      timezone: astronomicalTime.timezone,
      timeZoneId: astronomicalTime.timeZoneId ?? null,
      deltaTModel: astronomicalTime.deltaTModel,
      precisionLevel: astronomicalTime.precisionLevel,
      counterSummaryStatus: astronomicalTime.counterSummaryFact.status,
      summaryStatus: astronomicalTime.summaryFact.status,
    },
    crossings: [
      crossing(value.sunriseSunset),
      crossing(value.civilTwilight),
      crossing(value.nauticalTwilight),
      crossing(value.astronomicalTwilight),
    ],
    crossingSummaryStatus: value.crossingSummaryFact.status,
    summaryStatus: value.summaryFact.status,
  };
}

function projectDiscreteFacts(result: AstrolabeData): unknown {
  const birth = result.birth;
  return {
    houseSystem: result.houseSystem ?? null,
    dayChart: result.dayChart ?? null,
    ephemerisWarnings: projectEphemerisWarnings(result.ephemerisWarnings),
    birth: {
      name: birth.name,
      gender: birth.gender,
      location: birth.location,
      latitude: birth.latitude ?? null,
      longitude: birth.longitude ?? null,
      timezone: birth.timezone,
      timeZoneId: birth.timeZoneId ?? null,
      timezoneStatus: birth.timezoneStatus ?? null,
      timezoneDiagnostics: projectTimezoneDiagnostics(birth.timezoneDiagnostics),
      timezoneEvidence: projectTimezoneEvidence(birth.timezoneEvidence),
      isTrueSolarTime: Boolean(birth.isTrueSolarTime),
      coordinateAccuracy: birth.coordinateAccuracy ?? null,
      trueSolarEvidence: birth.trueSolarEvidence
        ? projectTrueSolarEvidence(birth.trueSolarEvidence)
        : null,
    },
    planets: result.planets.map(projectPoint),
    angles: result.angles.map(projectPoint),
    houses: result.houses.map(projectPoint),
    aspects: sortAstrolabeAspects(result.aspects).map(projectAspect),
    solarIllumination: projectSolarIllumination(result.solarIllumination),
    summary: {
      elements: projectRecord(result.summary.elements),
      modalities: projectRecord(result.summary.modalities),
      retrograde: [...result.summary.retrograde].sort(),
      patterns: [...result.summary.patterns].sort(),
    },
    evidence: projectEvidence(result.evidenceAnalysis),
  };
}

/** 返回不含生成时刻、长文本和连续几何量的本命离散指纹。 */
export function getAstrolabeBirthRangeDiscreteFingerprint(result: AstrolabeData): string {
  return JSON.stringify(projectDiscreteFacts(result));
}

function addSample(
  samples: AstrolabeBirthRangeContinuousSample[],
  path: string,
  label: string,
  unit: string,
  value: number | undefined,
  circularPeriod?: number,
): void {
  if (value === undefined || !Number.isFinite(value)) return;
  samples.push({ path, label, unit, value, ...(circularPeriod ? { circularPeriod } : {}) });
}

function collectPointSamples(
  samples: AstrolabeBirthRangeContinuousSample[],
  collection: string,
  points: AstrolabeData['planets'],
): void {
  for (const point of points) {
    const base = `${collection}[${point.name}]`;
    addSample(samples, `${base}.longitude`, `${point.label}黄经`, '度', point.longitude, 360);
    addSample(samples, `${base}.latitude`, `${point.label}黄纬`, '度', point.latitude);
    addSample(samples, `${base}.distance`, `${point.label}地心距离`, 'AU', point.distance);
    addSample(
      samples,
      `${base}.longitudeSpeed`,
      `${point.label}黄经日运动`,
      '度/日',
      point.longitudeSpeed,
    );
    addSample(samples, `${base}.second`, `${point.label}位置角秒`, '角秒', point.second);
  }
}

function collectAspectSamples(
  samples: AstrolabeBirthRangeContinuousSample[],
  aspects: AstrolabeAspect[],
): void {
  for (const aspect of sortAstrolabeAspects(aspects)) {
    const key = `${aspect.body1}↔${aspect.type}↔${aspect.body2}`;
    addSample(samples, `aspects[${key}].actualAngle`, `${key}实际夹角`, '度', aspect.actualAngle);
    addSample(samples, `aspects[${key}].orb`, `${key}偏差`, '度', aspect.orb);
    addSample(
      samples,
      `aspects[${key}].normalizedOrbRatio`,
      `${key}容许度比例`,
      '比例',
      aspect.normalizedOrbRatio,
    );
  }
}

function collectContinuousSamples(result: AstrolabeData): AstrolabeBirthRangeContinuousSample[] {
  const samples: AstrolabeBirthRangeContinuousSample[] = [];
  collectPointSamples(samples, 'planets', result.planets);
  collectPointSamples(samples, 'angles', result.angles);
  collectPointSamples(samples, 'houses', result.houses);
  collectAspectSamples(samples, result.aspects);

  const illumination = result.solarIllumination;
  if (illumination) {
    addSample(
      samples,
      'solarIllumination.solarAltitudeDegrees',
      '太阳高度',
      '度',
      illumination.solarAltitudeDegrees,
    );
    addSample(
      samples,
      'solarIllumination.solarAzimuthDegrees',
      '太阳方位',
      '度',
      illumination.solarAzimuthDegrees,
      360,
    );
    addSample(
      samples,
      'solarIllumination.solarDeclinationDegrees',
      '太阳赤纬',
      '度',
      illumination.solarDeclinationDegrees,
    );
    addSample(
      samples,
      'solarIllumination.equationOfTimeMinutes',
      '时间方程',
      '分钟',
      illumination.equationOfTimeMinutes,
    );
    const astronomicalTime = illumination.astronomicalTime;
    addSample(
      samples,
      'solarIllumination.astronomicalTime.unixMilliseconds',
      '天文时间 UTC 时间戳',
      '毫秒时间戳',
      astronomicalTime.unixMilliseconds,
    );
    addSample(
      samples,
      'solarIllumination.astronomicalTime.julianDayUtc',
      '天文时间 JD(UTC)',
      '儒略日',
      astronomicalTime.julianDayUtc,
    );
    addSample(
      samples,
      'solarIllumination.astronomicalTime.julianDayUtApprox',
      '天文时间近似 JD(UT)',
      '儒略日',
      astronomicalTime.julianDayUtApprox,
    );
    addSample(
      samples,
      'solarIllumination.astronomicalTime.julianDayTtApprox',
      '天文时间近似 JD(TT)',
      '儒略日',
      astronomicalTime.julianDayTtApprox,
    );
    addSample(
      samples,
      'solarIllumination.astronomicalTime.deltaTSeconds',
      '天文时间 ΔT',
      '秒',
      astronomicalTime.deltaTSeconds,
    );
    addSample(
      samples,
      'solarIllumination.astronomicalTime.decimalYear',
      '天文时间十进制年份',
      '年',
      astronomicalTime.decimalYear,
    );
  }

  const trueSolarEvidence = result.birth.trueSolarEvidence;
  if (trueSolarEvidence) {
    for (const fact of trueSolarEvidence.correctionFacts) {
      addSample(
        samples,
        `birth.trueSolarEvidence.correctionFacts[${fact.key}].correctionMinutes`,
        `真太阳时${fact.type}校正`,
        '分钟',
        fact.correctionMinutes,
      );
    }
  }

  return samples;
}

/** 收集本命盘可复用的连续事实样本，不包含生成时间或证据长文本。 */
export function collectAstrolabeBirthRangeContinuousSamples(
  result: AstrolabeData,
): AstrolabeBirthRangeContinuousSample[] {
  return collectContinuousSamples(result);
}

function unwrap(value: number, reference: number, period: number): number {
  const normalized = ((((value - reference + period / 2) % period) + period) % period) - period / 2;
  return reference + normalized;
}

export function updateAstrolabeRangeMetrics(
  metrics: Map<string, AstrolabeRangeMetricAccumulator>,
  samples: AstrolabeBirthRangeContinuousSample[],
): void {
  for (const sample of samples) {
    const current = metrics.get(sample.path);
    if (!current) {
      metrics.set(sample.path, {
        path: sample.path,
        label: sample.label,
        unit: sample.unit,
        first: sample.value,
        last: sample.value,
        min: sample.value,
        max: sample.value,
        sampleCount: 1,
        ...(sample.circularPeriod ? { circularPeriod: sample.circularPeriod } : {}),
        circularReference: sample.value,
      });
      continue;
    }
    const observed = current.circularPeriod
      ? unwrap(sample.value, current.circularReference, current.circularPeriod)
      : sample.value;
    current.last = sample.value;
    current.min = Math.min(current.min, observed);
    current.max = Math.max(current.max, observed);
    current.sampleCount += 1;
  }
}

export function finalizeAstrolabeRangeMetrics(
  metrics: Map<string, AstrolabeRangeMetricAccumulator>,
): AstrolabeBirthRangeContinuousFact[] {
  return [...metrics.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((metric) => ({
      path: metric.path,
      label: metric.label,
      unit: metric.unit,
      first: metric.first,
      last: metric.last,
      min: metric.min,
      max: metric.max,
      sampleCount: metric.sampleCount,
      ...(metric.circularPeriod
        ? {
            circular: {
              period: metric.circularPeriod,
              mode: 'shortest-arc-from-first' as const,
              note: 'first/last 保留原始值；min/max 按相对首样本的最短弧解卷绕后统计。',
            },
          }
        : {}),
    }));
}

function finalizeBranch(branch: ActiveBranch, endTimestamp: number): AstrolabeBirthRangeBranch {
  return {
    startTimestamp: branch.startTimestamp,
    endTimestamp,
    endExclusive: true,
    sampleCount: branch.sampleCount,
    representative: branch.representative,
    last: branch.last,
    continuous: finalizeAstrolabeRangeMetrics(branch.metrics),
  };
}

/** 判断值是否为完整固定 UTC+8 本命机器来源。 */
export function isAstrolabeBirthRangeSource(value: unknown): value is AstrolabeBirthRangeSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<AstrolabeBirthRangeSource>;
  return (
    isValidTimestamp(source.startTimestamp) &&
    isValidTimestamp(source.endTimestamp) &&
    source.startTimestamp < source.endTimestamp &&
    source.endTimestamp - source.startTimestamp <= MAX_RANGE_MILLISECONDS &&
    source.endExclusive === true &&
    source.timezone === 'Asia/Shanghai' &&
    source.offsetHours === CHINA_OFFSET_HOURS
  );
}

/** 本命与动态扫描共用同一整秒范围和出生输入约束。 */
export function validateAstrolabeRangeInput(
  input: AstrolabeBirthInput,
  range: AstrolabeBirthRangeInput,
): number {
  const total = assertRange(range);
  assertFixedTimezoneInput(input);
  assertInputMatchesStart(input, range.startTimestamp);
  return total;
}

export function generateAstrolabeBirthRange(
  input: AstrolabeBirthInput,
  range: AstrolabeBirthRangeInput,
  options: AstrolabeBirthRangeOptions = {},
): AstrolabeBirthRange {
  const total = validateAstrolabeRangeInput(input, range);
  assertNotAborted(options.signal);

  let active: ActiveBranch | undefined;
  const branches: AstrolabeBirthRangeBranch[] = [];
  for (let completed = 0; completed < total; completed += 1) {
    assertNotAborted(options.signal);
    const timestamp = range.startTimestamp + completed * SECOND_MILLISECONDS;
    const result = generateAstrolabe(getAstrolabeRangeInputAtTimestamp(input, timestamp));
    const currentFingerprint = getAstrolabeBirthRangeDiscreteFingerprint(result);
    if (!active) {
      active = {
        startTimestamp: timestamp,
        fingerprint: currentFingerprint,
        representative: result,
        last: result,
        sampleCount: 1,
        metrics: new Map(),
      };
      updateAstrolabeRangeMetrics(active.metrics, collectContinuousSamples(result));
    } else if (currentFingerprint === active.fingerprint) {
      active.last = result;
      active.sampleCount += 1;
      updateAstrolabeRangeMetrics(active.metrics, collectContinuousSamples(result));
    } else {
      branches.push(finalizeBranch(active, timestamp));
      active = {
        startTimestamp: timestamp,
        fingerprint: currentFingerprint,
        representative: result,
        last: result,
        sampleCount: 1,
        metrics: new Map(),
      };
      updateAstrolabeRangeMetrics(active.metrics, collectContinuousSamples(result));
    }
    options.onProgress?.(completed + 1, total);
  }

  if (!active) throw new Error('西占星盘本命区间没有可计算的整秒样本。');
  branches.push(finalizeBranch(active, range.endTimestamp));

  return {
    coverage: 'natal',
    status: branches.length === 1 ? 'stable' : 'conditional',
    source: {
      startTimestamp: range.startTimestamp,
      endTimestamp: range.endTimestamp,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: CHINA_OFFSET_HOURS,
    },
    resolutionSeconds: 1,
    sampleCount: total,
    branches,
  };
}
