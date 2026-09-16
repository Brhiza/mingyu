/**
 * @file 七政四余本命出生时间整秒区间
 * @description 核验固定 UTC+8 的本命候选区间，不接收流曜与行限目标。
 */

import { getCivilDateTimeAtFixedOffset } from '../calendar/civil-time';
import { generateQizheng, type QizhengInput, type QizhengResult } from './index';

const CHINA_OFFSET_HOURS = 8;
const SECOND_MILLISECONDS = 1_000;
const MAX_RANGE_MILLISECONDS = 2 * 60 * 60 * SECOND_MILLISECONDS;

const FLOW_INPUT_KEYS = ['flowYear', 'flowMonth', 'flowDay', 'flowHour', 'flowMinute'] as const;

const SOLAR_CROSSING_KEYS = [
  'sunriseSunset',
  'civilTwilight',
  'nauticalTwilight',
  'astronomicalTwilight',
] as const;

type SolarCrossingKey = (typeof SOLAR_CROSSING_KEYS)[number];

export type QizhengBirthRangeInput = {
  startTimestamp: number;
  endTimestamp: number;
};

export type QizhengBirthRangeOptions = {
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

export type QizhengBirthRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type QizhengBirthRangeContinuousFact = {
  /** 机器读取路径；展示层应使用 label。 */
  path: string;
  /** 面向提示词/UI 的中文事实名称。 */
  label: string;
  unit: string;
  /** 起点样本的原始值；圆周量不在此处改写。 */
  first: number;
  /** 终点前一秒样本的原始值；圆周量不在此处改写。 */
  last: number;
  /**
   * 整秒样本观察值的最小值。圆周量按相对首样本的最短弧解卷绕后统计，
   * 因此 min/max 可能超出 0-360 显示范围。
   */
  min: number;
  max: number;
  sampleCount: number;
  circular?: {
    period: number;
    mode: 'shortest-arc-from-first';
    note: string;
  };
};

export type QizhengBirthRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  sampleCount: number;
  /** 离散分支起点的完整七政本命盘。 */
  representative: QizhengResult;
  /** 离散分支终点前一秒的完整七政本命盘。 */
  last: QizhengResult;
  continuous: QizhengBirthRangeContinuousFact[];
};

export type QizhengBirthRange = {
  /** 仅覆盖出生本命，不包含流曜目标期。 */
  coverage: 'natal';
  status: 'stable' | 'conditional';
  source: QizhengBirthRangeSource;
  resolutionSeconds: 1;
  sampleCount: number;
  branches: QizhengBirthRangeBranch[];
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
  circularReference: number;
};

type ActiveBranch = {
  startTimestamp: number;
  fingerprint: string;
  representative: QizhengResult;
  last: QizhengResult;
  sampleCount: number;
  metrics: Map<string, MetricAccumulator>;
};

function assertTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value % SECOND_MILLISECONDS !== 0) {
    throw new Error('七政本命区间' + label + '必须是整秒 UTC epoch 毫秒时间戳。');
  }
}

function assertRange(range: QizhengBirthRangeInput): number {
  if (!range || typeof range !== 'object') {
    throw new Error('七政本命区间必须提供起止时间戳。');
  }
  assertTimestamp(range.startTimestamp, '起点');
  assertTimestamp(range.endTimestamp, '终点');
  if (range.startTimestamp >= range.endTimestamp) {
    throw new Error('七政本命区间必须是起点含、终点不含的正时长范围。');
  }
  const duration = range.endTimestamp - range.startTimestamp;
  if (duration > MAX_RANGE_MILLISECONDS) {
    throw new Error('七政本命区间不得超过两小时。');
  }
  if (duration % SECOND_MILLISECONDS !== 0) {
    throw new Error('七政本命区间长度必须是整秒。');
  }
  return duration / SECOND_MILLISECONDS;
}

function assertNatalOnlyInput(input: QizhengInput): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('七政本命区间输入必须是对象。');
  }
  if (input.timeZoneId !== undefined) {
    throw new Error('七政本命区间固定使用 UTC+8，不接受 timeZoneId。');
  }
  if (input.timezone !== undefined && input.timezone !== CHINA_OFFSET_HOURS) {
    throw new Error('七政本命区间的 timezone 必须为 8。');
  }
  const flowKey = FLOW_INPUT_KEYS.find((key) => input[key] !== undefined);
  if (flowKey) {
    throw new Error('七政本命区间不接受 ' + flowKey + '；只覆盖本命区间，流曜目标期需另行计算。');
  }
}

function assertInputMatchesStart(input: QizhengInput, startTimestamp: number): void {
  const start = getCivilDateTimeAtFixedOffset(new Date(startTimestamp), CHINA_OFFSET_HOURS);
  if (
    input.year !== start.year ||
    input.month !== start.month ||
    input.day !== start.day ||
    input.hour !== start.hour ||
    (input.minute ?? 0) !== start.minute ||
    (input.second ?? 0) !== start.second
  ) {
    throw new Error('七政本命区间输入的出生字段必须等于起点北京时间墙钟字段。');
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
  if (signal?.aborted) {
    throw new Error('七政本命区间计算已取消。');
  }
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort();
}

function stableAspectIdentity(aspect: QizhengResult['aspects'][number]) {
  const [first, second] = [aspect.star1, aspect.star2].sort();
  return {
    stars: first + '↔' + second,
    star1: first,
    star2: second,
    type: aspect.type,
    closeness: aspect.closeness,
    precisionClass: aspect.precisionClass,
  };
}

function projectSolarCrossings(result: QizhengResult) {
  const illumination = result.calculationContext.solarIllumination;
  return Object.fromEntries(
    SOLAR_CROSSING_KEYS.map((key) => [key, { status: illumination[key].status }]),
  ) as Record<SolarCrossingKey, { status: string }>;
}

function projectDiscreteFacts(result: QizhengResult): unknown {
  const timeLords = result.timeLords
    ? {
        yearStem: result.timeLords.yearStem,
        yearStemYinYang: result.timeLords.yearStemYinYang,
        gender: result.timeLords.gender,
        direction: result.timeLords.direction,
        nominalAge: result.timeLords.nominalAge,
        majorLimits: result.timeLords.majorLimits.map((item) => ({
          palace: item.palace,
          signIndex: item.signIndex,
          signBranch: item.signBranch,
          startNominalAge: item.startNominalAge,
          endNominalAge: item.endNominalAge,
        })),
        currentMajorLimit: result.timeLords.currentMajorLimit,
        currentMinorLimit: result.timeLords.currentMinorLimit,
        annualBranch: result.timeLords.annualBranch,
        annualPalace: result.timeLords.annualPalace,
      }
    : undefined;
  const enNan = result.enNan
    ? {
        sect: result.enNan.sect,
        mingZhu: result.enNan.mingZhu,
        mingElement: result.enNan.mingElement,
        enStars: sortedStrings(result.enNan.enStars),
        nanStars: sortedStrings(result.enNan.nanStars),
        chouStars: sortedStrings(result.enNan.chouStars),
        yongStars: sortedStrings(result.enNan.yongStars),
        aspectInteraction: sortedStrings(result.enNan.aspectInteraction),
      }
    : undefined;
  const moon = result.calculationContext.moonPhase;
  const evidence = result.evidenceAnalysis;
  return {
    stars: result.stars.map((star) => ({
      name: star.name,
      kind: star.kind,
      xiu: star.xiu,
      sevenStar: star.sevenStar,
      signIndex: star.signIndex,
      signBranch: star.signBranch,
      palace: star.palace,
      retrograde: star.retrograde === undefined ? null : star.retrograde,
      dignity: star.dignity ?? null,
      sourceId: star.sourceId,
      sourceLabel: star.sourceLabel,
      precisionClass: star.precisionClass,
    })),
    mingGong: result.mingGong,
    shenGong: result.shenGong,
    mingZhu: result.mingZhu,
    twelvePalaces: result.twelvePalaces,
    aspects: result.aspects.map(stableAspectIdentity).sort((left, right) => {
      const leftKey = left.stars + ':' + left.type;
      const rightKey = right.stars + ':' + right.type;
      return leftKey.localeCompare(rightKey);
    }),
    shensha: [...result.shensha].sort((left, right) => left.name.localeCompare(right.name)),
    enNan,
    moonPhase: {
      eightPhaseName: moon.eightPhaseName,
      waxing: moon.waxing,
      previousPrincipalPhase: moon.previousPrincipalPhase.name,
      nextPrincipalPhase: moon.nextPrincipalPhase.name,
    },
    solarIllumination: {
      localDate: result.calculationContext.solarIllumination.localDate,
      status: result.calculationContext.solarIllumination.status,
      crossings: projectSolarCrossings(result),
    },
    evidence: {
      locationSource: result.calculationContext.locationSource,
      timezoneSource: result.calculationContext.timezoneSource,
      palaceTimeMode: result.calculationContext.palaceTimeMode,
      astronomicalPrecision: result.calculationContext.astronomicalTime.precisionLevel,
      analysisStatus: evidence.status,
      calculationStatus: evidence.calculationFact.status,
      counterSummaryStatus: evidence.counterSummaryFact.status,
      summaryStatus: evidence.summaryFact.status,
      positionSources: evidence.positionSourceFacts
        .map((item) => ({
          sourceId: item.sourceId,
          precisionClass: item.precisionClass,
          status: item.status,
        }))
        .sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
      limitationStatuses: evidence.limitationFacts
        .map((item) => ({ key: item.key, status: item.status }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    },
    timeLords,
  };
}

function fingerprint(result: QizhengResult): string {
  return JSON.stringify(projectDiscreteFacts(result));
}

function addSample(
  samples: ContinuousSample[],
  path: string,
  label: string,
  unit: string,
  value: number | undefined,
  circularPeriod?: number,
): void {
  if (value === undefined || !Number.isFinite(value)) return;
  samples.push({ path, label, unit, value, ...(circularPeriod ? { circularPeriod } : {}) });
}

function addDateSample(
  samples: ContinuousSample[],
  path: string,
  label: string,
  value: string | null | undefined,
): void {
  if (!value) return;
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) addSample(samples, path, label, '毫秒时间戳', timestamp);
}

function collectContinuousSamples(result: QizhengResult): ContinuousSample[] {
  const samples: ContinuousSample[] = [];
  for (const star of result.stars) {
    addSample(
      samples,
      'stars[' + star.name + '].tropicalLongitude',
      star.name + '回归黄经',
      '度',
      star.tropicalLongitude,
      360,
    );
    addSample(
      samples,
      'stars[' + star.name + '].longitude',
      star.name + '目标黄经',
      '度',
      star.longitude,
      360,
    );
    addSample(
      samples,
      'stars[' + star.name + '].xiuDegree',
      star.name + '宿度',
      '度',
      star.xiuDegree,
    );
  }

  for (const aspect of result.aspects) {
    const identity = stableAspectIdentity(aspect);
    addSample(
      samples,
      'aspects[' + identity.stars + '].actualAngle',
      identity.stars + '吊照实际角',
      '度',
      aspect.actualAngle,
    );
    addSample(
      samples,
      'aspects[' + identity.stars + '].orb',
      identity.stars + '吊照偏差',
      '度',
      aspect.orb,
    );
    addSample(
      samples,
      'aspects[' + identity.stars + '].orbRatio',
      identity.stars + '吊照容许度比例',
      '比例',
      aspect.orbRatio,
    );
  }

  addSample(
    samples,
    'ziqi.tropicalLongitude',
    '紫炁回归黄经',
    '度',
    result.ziqi.tropicalLongitude,
    360,
  );
  addSample(
    samples,
    'ziqi.siderealLongitude',
    '紫炁恒星黄经',
    '度',
    result.ziqi.siderealLongitude,
    360,
  );
  addSample(samples, 'ziqi.cycleProgress', '紫炁周期进度', '比例', result.ziqi.cycleProgress);
  addSample(
    samples,
    'ziqi.daysSinceZeroLongitude',
    '紫炁距零点日数',
    '日',
    result.ziqi.daysSinceZeroLongitude,
  );
  addSample(
    samples,
    'ziqi.daysUntilZeroLongitude',
    '紫炁距下次零点日数',
    '日',
    result.ziqi.daysUntilZeroLongitude,
  );

  const astronomicalTime = result.calculationContext.astronomicalTime;
  addSample(
    samples,
    'calculationContext.astronomicalTime.unixMilliseconds',
    '天文时间 UTC 时间戳',
    '毫秒时间戳',
    astronomicalTime.unixMilliseconds,
  );
  addSample(
    samples,
    'calculationContext.astronomicalTime.julianDayUtc',
    '天文时间 JD(UTC)',
    '儒略日',
    astronomicalTime.julianDayUtc,
  );
  addSample(
    samples,
    'calculationContext.astronomicalTime.julianDayTtApprox',
    '天文时间近似 JD(TT)',
    '儒略日',
    astronomicalTime.julianDayTtApprox,
  );
  addSample(
    samples,
    'calculationContext.astronomicalTime.deltaTSeconds',
    '天文时间 ΔT 估计',
    '秒',
    astronomicalTime.deltaTSeconds,
  );

  const moon = result.calculationContext.moonPhase;
  addSample(
    samples,
    'calculationContext.moonPhase.sunLongitudeDegrees',
    '月相太阳黄经',
    '度',
    moon.sunLongitudeDegrees,
    360,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.moonLongitudeDegrees',
    '月相月亮黄经',
    '度',
    moon.moonLongitudeDegrees,
    360,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.phaseAngleDegrees',
    '月相角',
    '度',
    moon.phaseAngleDegrees,
    360,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.elongationDegrees',
    '月相距角',
    '度',
    moon.elongationDegrees,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.illuminationFraction',
    '月相照明比例',
    '比例',
    moon.illuminationFraction,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.illuminationPercent',
    '月相照明百分比',
    '百分比',
    moon.illuminationPercent,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.approximateMoonAgeDays',
    '近似月龄',
    '日',
    moon.approximateMoonAgeDays,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.previousPrincipalPhase.utcTimestamp',
    '前一主相位' + moon.previousPrincipalPhase.name + '时刻',
    '毫秒时间戳',
    moon.previousPrincipalPhase.utcTimestamp,
  );
  addSample(
    samples,
    'calculationContext.moonPhase.nextPrincipalPhase.utcTimestamp',
    '下一主相位' + moon.nextPrincipalPhase.name + '时刻',
    '毫秒时间戳',
    moon.nextPrincipalPhase.utcTimestamp,
  );

  const illumination = result.calculationContext.solarIllumination;
  addSample(
    samples,
    'calculationContext.solarIllumination.solarAltitudeDegrees',
    '太阳高度',
    '度',
    illumination.solarAltitudeDegrees,
  );
  addSample(
    samples,
    'calculationContext.solarIllumination.solarAzimuthDegrees',
    '太阳方位',
    '度',
    illumination.solarAzimuthDegrees,
    360,
  );
  addSample(
    samples,
    'calculationContext.solarIllumination.solarDeclinationDegrees',
    '太阳赤纬',
    '度',
    illumination.solarDeclinationDegrees,
  );
  addSample(
    samples,
    'calculationContext.solarIllumination.equationOfTimeMinutes',
    '时间方程',
    '分钟',
    illumination.equationOfTimeMinutes,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.apparentSolarNoonUtcDateTime',
    '视太阳正午时刻',
    illumination.apparentSolarNoonUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.sunriseSunset.morningUtcDateTime',
    '日出时刻',
    illumination.sunriseSunset.morningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.sunriseSunset.eveningUtcDateTime',
    '日落时刻',
    illumination.sunriseSunset.eveningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.civilTwilight.morningUtcDateTime',
    '民用曙光时刻',
    illumination.civilTwilight.morningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.civilTwilight.eveningUtcDateTime',
    '民用暮光时刻',
    illumination.civilTwilight.eveningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.nauticalTwilight.morningUtcDateTime',
    '航海曙光时刻',
    illumination.nauticalTwilight.morningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.nauticalTwilight.eveningUtcDateTime',
    '航海暮光时刻',
    illumination.nauticalTwilight.eveningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.astronomicalTwilight.morningUtcDateTime',
    '天文曙光时刻',
    illumination.astronomicalTwilight.morningUtcDateTime,
  );
  addDateSample(
    samples,
    'calculationContext.solarIllumination.astronomicalTwilight.eveningUtcDateTime',
    '天文暮光时刻',
    illumination.astronomicalTwilight.eveningUtcDateTime,
  );

  for (const boundary of result.mansionBoundaries) {
    addSample(
      samples,
      'mansionBoundaries[' + boundary.mansion + '].longitude',
      boundary.mansion + '宿距星黄经',
      '度',
      boundary.longitude,
      360,
    );
    addSample(
      samples,
      'mansionBoundaries[' + boundary.mansion + '].widthDegrees',
      boundary.mansion + '宿宽',
      '度',
      boundary.widthDegrees,
    );
  }

  return samples;
}

function unwrap(value: number, reference: number, period: number): number {
  const normalized = ((((value - reference + period / 2) % period) + period) % period) - period / 2;
  return reference + normalized;
}

function updateMetrics(metrics: Map<string, MetricAccumulator>, samples: ContinuousSample[]): void {
  for (const sample of samples) {
    const current = metrics.get(sample.path);
    if (!current) {
      const first = sample.value;
      metrics.set(sample.path, {
        path: sample.path,
        label: sample.label,
        unit: sample.unit,
        first,
        last: first,
        min: first,
        max: first,
        sampleCount: 1,
        ...(sample.circularPeriod ? { circularPeriod: sample.circularPeriod } : {}),
        circularReference: first,
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

function finalizeMetrics(
  metrics: Map<string, MetricAccumulator>,
): QizhengBirthRangeContinuousFact[] {
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

function finalizeBranch(branch: ActiveBranch, endTimestamp: number): QizhengBirthRangeBranch {
  return {
    startTimestamp: branch.startTimestamp,
    endTimestamp,
    endExclusive: true,
    sampleCount: branch.sampleCount,
    representative: branch.representative,
    last: branch.last,
    continuous: finalizeMetrics(branch.metrics),
  };
}

export function generateQizhengBirthRange(
  input: QizhengInput,
  range: QizhengBirthRangeInput,
  options: QizhengBirthRangeOptions = {},
): QizhengBirthRange {
  const total = assertRange(range);
  assertNatalOnlyInput(input);
  assertInputMatchesStart(input, range.startTimestamp);
  assertNotAborted(options.signal);

  let active: ActiveBranch | undefined;
  const branches: QizhengBirthRangeBranch[] = [];
  for (let completed = 0; completed < total; completed += 1) {
    assertNotAborted(options.signal);
    const timestamp = range.startTimestamp + completed * SECOND_MILLISECONDS;
    const result = generateQizheng(inputAtTimestamp(input, timestamp));
    const currentFingerprint = fingerprint(result);
    if (!active) {
      active = {
        startTimestamp: timestamp,
        fingerprint: currentFingerprint,
        representative: result,
        last: result,
        sampleCount: 1,
        metrics: new Map(),
      };
      updateMetrics(active.metrics, collectContinuousSamples(result));
    } else if (currentFingerprint === active.fingerprint) {
      active.last = result;
      active.sampleCount += 1;
      updateMetrics(active.metrics, collectContinuousSamples(result));
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
      updateMetrics(active.metrics, collectContinuousSamples(result));
    }
    options.onProgress?.(completed + 1, total);
  }

  if (!active) throw new Error('七政本命区间没有可计算的整秒样本。');
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
