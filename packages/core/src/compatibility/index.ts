import {
  analyzeBaziCompatibility,
  type BaziCompatibilityEvidenceResult,
  type BaziCompatibilityOptions,
} from '../bazi';
import {
  analyzeAstrolabeSynastry,
  type AstrolabeSynastryData,
  type AstrolabeSynastryOptions,
} from '../divination';
import {
  analyzeZiweiCompatibility,
  getDefaultHoroscopeContext,
  type ZiweiCompatibilityEvidenceResult,
  type ZiweiCompatibilityOptions,
} from '../ziwei/iztro';
import {
  calculateBirthChartBundle,
  type BirthChartBundle,
  type BirthChartBundleOptions,
  type BirthChartPointBundle,
  type BirthChartSystem,
} from '../birth';
import {
  birthProfileAtRangeTimestamp,
  resolveBirthRangeBatch,
  validateBirthProfileTimeRange,
  type BirthProfileTimeRange,
} from '../profile/time-range';
import type { BirthProfile } from '../profile';

export type CompatibilitySystem = Exclude<BirthChartSystem, 'qizheng'>;

export interface CompatibilityRangeBatchOptions {
  /** 当前笛卡尔积中的起始 pair 索引；省略时从 0 开始。 */
  startIndex?: number;
  /** 当前批次最多返回的 pair 数；省略时返回 1 个，最大 60 个。 */
  limit?: number;
}

export interface CompatibilityBundleOptions {
  /** 默认只计算八字；需要紫微或星盘时显式加入对应系统。 */
  systems?: CompatibilitySystem[];
  bazi?: BaziCompatibilityOptions;
  ziwei?: ZiweiCompatibilityOptions;
  astrolabe?: AstrolabeSynastryOptions;
  /** 同时传给双方出生盘生成器，例如紫微运限范围与固定计算时刻。 */
  chart?: BirthChartBundleOptions;
  /** 出生区间合盘的笛卡尔积续读游标；单点输入时忽略。 */
  rangeBatch?: CompatibilityRangeBatchOptions;
  /** 取消当前批次以及其后的盘面或合盘计算。 */
  signal?: AbortSignal;
}

export interface CompatibilityPointBundle {
  systems: CompatibilitySystem[];
  primary: BirthChartPointBundle;
  partner: BirthChartPointBundle;
  bazi?: BaziCompatibilityEvidenceResult;
  ziwei?: ZiweiCompatibilityEvidenceResult;
  astrolabe?: AstrolabeSynastryData;
  range?: never;
}

export interface CompatibilityRangeSample {
  /** 该侧区间中的逐秒索引；固定侧唯一使用 0。 */
  index: number;
  /** 固定侧没有机器时间戳，因此省略该字段。 */
  timestamp?: number;
  /** 该样本实际送入出生盘入口的单点资料。 */
  profile: BirthProfile;
  /** 该样本的完整单点盘面。 */
  bundle: BirthChartPointBundle;
}

export interface CompatibilityPairResult {
  /** 当前批次在完整笛卡尔积中的索引。 */
  pairIndex: number;
  primaryIndex: number;
  partnerIndex: number;
  bazi?: BaziCompatibilityEvidenceResult;
  ziwei?: ZiweiCompatibilityEvidenceResult;
  astrolabe?: AstrolabeSynastryData;
}

export interface CompatibilityRangeDescriptor {
  /** 有范围的一侧提供已校验 source；固定侧省略。 */
  primarySource?: BirthProfileTimeRange;
  partnerSource?: BirthProfileTimeRange;
  resolutionSeconds: 1;
  totalPairs: number;
  startIndex: number;
  endIndexExclusive: number;
  /** null 表示本批已覆盖笛卡尔积末尾。 */
  nextIndex: number | null;
}

export interface CompatibilityRangeBundle {
  systems: CompatibilitySystem[];
  /** 原始资料保留区间字段，供恢复、审计和后续批次继续使用。 */
  primaryProfile: BirthProfile;
  partnerProfile: BirthProfile;
  range: CompatibilityRangeDescriptor;
  /** 当前批次每侧唯一的完整单点盘面，按各自索引去重。 */
  primarySamples: CompatibilityRangeSample[];
  partnerSamples: CompatibilityRangeSample[];
  /** 每个 pair 仅引用两侧 sample 索引，不重复嵌入完整原盘。 */
  pairs: CompatibilityPairResult[];
  primary?: never;
  partner?: never;
  bazi?: never;
  ziwei?: never;
  astrolabe?: never;
}

export type CompatibilityBundle = CompatibilityPointBundle | CompatibilityRangeBundle;

const DEFAULT_SYSTEMS: CompatibilitySystem[] = ['bazi'];
const SYSTEMS = new Set<CompatibilitySystem>(['bazi', 'ziwei', 'astrolabe']);

function normalizeSystems(systems?: CompatibilitySystem[]): CompatibilitySystem[] {
  const requested = systems?.length ? systems : DEFAULT_SYSTEMS;
  const unique = Array.from(new Set(requested));
  for (const system of unique) {
    if (!SYSTEMS.has(system)) throw new Error('不支持的合盘系统：' + String(system) + '。');
  }
  return unique;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('已停止合盘范围计算。', 'AbortError');
}

function asPointBundle(bundle: BirthChartBundle): BirthChartPointBundle {
  if ('range' in bundle) {
    throw new Error('合盘内部只接受已锁定的单点出生盘，不能把区间结果作为代表盘。');
  }
  return bundle;
}

function createChartOptions(
  systems: CompatibilitySystem[],
  options: CompatibilityBundleOptions,
): BirthChartBundleOptions {
  return {
    ...options.chart,
    systems,
    signal: options.signal ?? options.chart?.signal,
  };
}

function createRangeChartOptions(
  systems: CompatibilitySystem[],
  options: CompatibilityBundleOptions,
): BirthChartBundleOptions {
  const chartOptions = createChartOptions(systems, options);
  if (!systems.includes('ziwei')) return chartOptions;
  const ziwei = chartOptions.ziwei;
  if (!ziwei?.horoscopeContext && !ziwei?.now) {
    throw new Error('紫微出生区间合盘需提供固定的运限日期或计算时间，以便各批次按同一时刻重算。');
  }
  if (ziwei.horoscopeContext) {
    return {
      ...chartOptions,
      ziwei: {
        ...ziwei,
        horoscopeContext: { ...ziwei.horoscopeContext },
        now: undefined,
      },
    };
  }
  const horoscopeContext = getDefaultHoroscopeContext(ziwei.now);
  const ziweiWithoutNow = { ...ziwei };
  delete ziweiWithoutNow.now;
  return {
    ...chartOptions,
    ziwei: {
      ...ziweiWithoutNow,
      horoscopeContext,
    },
  };
}

function lockRangeInputs(
  primary: BirthProfile,
  partner: BirthProfile,
  options: CompatibilityBundleOptions,
): {
  primary: BirthProfile;
  partner: BirthProfile;
  options: CompatibilityBundleOptions;
} {
  const effectiveSignal = options.signal ?? options.chart?.signal;
  const optionsWithoutSignal = { ...options };
  delete optionsWithoutSignal.signal;
  if (options.chart) {
    const chartWithoutSignal = { ...options.chart };
    delete chartWithoutSignal.signal;
    optionsWithoutSignal.chart = chartWithoutSignal;
  }
  const lockedOptions = structuredClone(optionsWithoutSignal);
  lockedOptions.signal = effectiveSignal;
  return {
    primary: structuredClone(primary),
    partner: structuredClone(partner),
    options: lockedOptions,
  };
}

async function calculatePointCompatibilityBundle(
  primary: BirthProfile,
  partner: BirthProfile,
  systems: CompatibilitySystem[],
  options: CompatibilityBundleOptions,
): Promise<CompatibilityPointBundle> {
  checkAborted(options.signal);
  const chartOptions = createChartOptions(systems, options);
  const [primaryChartValue, partnerChartValue] = await Promise.all([
    calculateBirthChartBundle(primary, chartOptions),
    calculateBirthChartBundle(partner, chartOptions),
  ]);
  checkAborted(options.signal);
  const primaryChart = asPointBundle(primaryChartValue);
  const partnerChart = asPointBundle(partnerChartValue);
  const bundle: CompatibilityPointBundle = {
    systems,
    primary: primaryChart,
    partner: partnerChart,
  };

  addPairRelations(bundle, primaryChart, partnerChart, systems, options);
  checkAborted(options.signal);
  return bundle;
}

function addPairRelations(
  bundle: {
    bazi?: BaziCompatibilityEvidenceResult;
    ziwei?: ZiweiCompatibilityEvidenceResult;
    astrolabe?: AstrolabeSynastryData;
  },
  primaryChart: BirthChartPointBundle,
  partnerChart: BirthChartPointBundle,
  systems: CompatibilitySystem[],
  options: CompatibilityBundleOptions,
): void {
  checkAborted(options.signal);
  if (systems.includes('bazi')) {
    if (!primaryChart.bazi || !partnerChart.bazi) throw new Error('八字合盘资料生成失败。');
    bundle.bazi = analyzeBaziCompatibility(primaryChart.bazi, partnerChart.bazi, {
      person1Name: primaryChart.profile.name,
      person2Name: partnerChart.profile.name,
      ...options.bazi,
    });
  }

  checkAborted(options.signal);
  if (systems.includes('astrolabe')) {
    if (!primaryChart.astrolabe || !partnerChart.astrolabe) {
      throw new Error('西占合盘资料生成失败。');
    }
    bundle.astrolabe = analyzeAstrolabeSynastry(
      primaryChart.astrolabe,
      partnerChart.astrolabe,
      options.astrolabe,
    );
  }

  checkAborted(options.signal);
  if (systems.includes('ziwei')) {
    if (!primaryChart.ziwei || !partnerChart.ziwei) {
      throw new Error('紫微合盘资料生成失败。');
    }
    bundle.ziwei = analyzeZiweiCompatibility(
      primaryChart.ziwei.payloadByScope.origin,
      partnerChart.ziwei.payloadByScope.origin,
      {
        person1Name: primaryChart.profile.name,
        person2Name: partnerChart.profile.name,
        astrolabe1: primaryChart.ziwei.astrolabe,
        astrolabe2: partnerChart.ziwei.astrolabe,
        ...options.ziwei,
      },
    );
  }
  checkAborted(options.signal);
}

interface RangeSide {
  profile: BirthProfile;
  source?: BirthProfileTimeRange;
  totalSamples: number;
}

function prepareRangeSide(profile: BirthProfile): RangeSide {
  if (!profile.birthTimeRange) {
    return { profile, totalSamples: 1 };
  }
  const source = validateBirthProfileTimeRange(profile, profile.birthTimeRange);
  const totalSamples = (source.endTimestamp - source.startTimestamp) / 1_000;
  if (!Number.isSafeInteger(totalSamples) || totalSamples < 1) {
    throw new RangeError('出生区间必须包含至少一个整秒样本。');
  }
  return { profile, source, totalSamples };
}

function getSampleTimestamp(
  source: BirthProfileTimeRange | undefined,
  index: number,
): number | undefined {
  return source ? source.startTimestamp + index * 1_000 : undefined;
}

async function calculateRangeCompatibilityBundle(
  primary: BirthProfile,
  partner: BirthProfile,
  systems: CompatibilitySystem[],
  options: CompatibilityBundleOptions,
): Promise<CompatibilityRangeBundle> {
  checkAborted(options.signal);
  const primarySide = prepareRangeSide(primary);
  const partnerSide = prepareRangeSide(partner);
  const totalPairs = primarySide.totalSamples * partnerSide.totalSamples;
  const bounds = resolveBirthRangeBatch(totalPairs, options.rangeBatch);
  const chartOptions = createRangeChartOptions(systems, options);
  const primaryCache = new Map<number, Promise<CompatibilityRangeSample>>();
  const partnerCache = new Map<number, Promise<CompatibilityRangeSample>>();

  const loadSample = (
    side: RangeSide,
    index: number,
    cache: Map<number, Promise<CompatibilityRangeSample>>,
  ): Promise<CompatibilityRangeSample> => {
    const cached = cache.get(index);
    if (cached) return cached;
    const task = (async (): Promise<CompatibilityRangeSample> => {
      checkAborted(options.signal);
      const timestamp = getSampleTimestamp(side.source, index);
      const pointProfile = side.source
        ? birthProfileAtRangeTimestamp(side.profile, side.source, timestamp!)
        : side.profile;
      const chartValue = await calculateBirthChartBundle(pointProfile, chartOptions);
      checkAborted(options.signal);
      const bundle = asPointBundle(chartValue);
      return {
        index,
        ...(timestamp === undefined ? {} : { timestamp }),
        profile: pointProfile,
        bundle,
      };
    })();
    cache.set(index, task);
    return task;
  };

  const pairs: CompatibilityPairResult[] = [];
  for (let pairIndex = bounds.startIndex; pairIndex < bounds.endIndexExclusive; pairIndex += 1) {
    checkAborted(options.signal);
    const primaryIndex = Math.floor(pairIndex / partnerSide.totalSamples);
    const partnerIndex = pairIndex % partnerSide.totalSamples;
    const [primarySample, partnerSample] = await Promise.all([
      loadSample(primarySide, primaryIndex, primaryCache),
      loadSample(partnerSide, partnerIndex, partnerCache),
    ]);
    checkAborted(options.signal);
    const pair: CompatibilityPairResult = {
      pairIndex,
      primaryIndex,
      partnerIndex,
    };
    addPairRelations(pair, primarySample.bundle, partnerSample.bundle, systems, options);
    pairs.push(pair);
  }

  checkAborted(options.signal);
  const primarySamples = primaryCache.size ? await Promise.all(primaryCache.values()) : [];
  const partnerSamples = partnerCache.size ? await Promise.all(partnerCache.values()) : [];
  primarySamples.sort((left, right) => left.index - right.index);
  partnerSamples.sort((left, right) => left.index - right.index);

  return {
    systems,
    primaryProfile: primary,
    partnerProfile: partner,
    range: {
      ...(primarySide.source ? { primarySource: primarySide.source } : {}),
      ...(partnerSide.source ? { partnerSource: partnerSide.source } : {}),
      resolutionSeconds: 1,
      totalPairs,
      startIndex: bounds.startIndex,
      endIndexExclusive: bounds.endIndexExclusive,
      nextIndex: bounds.nextIndex,
    },
    primarySamples,
    partnerSamples,
    pairs,
  };
}

/** 从两份 BirthProfile 直接生成单点或逐秒笛卡尔积的合盘证据。 */
export async function calculateCompatibilityBundle(
  primary: BirthProfile,
  partner: BirthProfile,
  options: CompatibilityBundleOptions = {},
): Promise<CompatibilityBundle> {
  const systems = normalizeSystems(options.systems);
  if (primary.birthTimeRange === undefined && partner.birthTimeRange === undefined) {
    return calculatePointCompatibilityBundle(primary, partner, systems, options);
  }
  const locked = lockRangeInputs(primary, partner, options);
  return calculateRangeCompatibilityBundle(locked.primary, locked.partner, systems, locked.options);
}
