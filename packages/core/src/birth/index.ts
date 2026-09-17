import { baziCalculator } from '../bazi/baziCalculator';
import { generateAstrolabe } from '../divination/algorithms/astrolabe';
import { generateQizheng, type QizhengInput, type QizhengResult } from '../qi_zheng';
import {
  birthProfileToAstrolabeInput,
  birthProfileToBaziPerson,
  birthProfileToQizhengInput,
  birthProfileToZiweiChartInput,
  normalizeBirthProfile,
  type BirthProfile,
  type NormalizedBirthProfile,
} from '../profile';
import {
  validateBirthProfileTimeRange,
  birthProfileAtRangeTimestamp,
  resolveBirthRangeBatch,
  type BirthProfileTimeRange,
} from '../profile/time-range';
import { calculateZiweiChart, type ZiweiRuntime, type ZiweiRuntimeOptions } from '../ziwei/runtime';
import { getDefaultHoroscopeContext } from '../ziwei/iztro/runtime-helpers';
import type { AstrolabeBirthInput, AstrolabeData } from '../types/divination';
import type { BaziChartResult, Person } from '../bazi/baziTypes';
import type { ChartInput } from '../types/chart';

export type { BirthProfile } from '../profile';
export type BirthChartSystem = 'bazi' | 'ziwei' | 'astrolabe' | 'qizheng';

export interface BirthChartBundleInputs {
  bazi?: Person;
  ziwei?: ChartInput;
  astrolabe?: AstrolabeBirthInput;
  qizheng?: QizhengInput;
}

/** 一个明确出生时刻按所选系统生成的完整结果集合。 */
export interface BirthChartPointBundle {
  profile: BirthProfile;
  normalized: NormalizedBirthProfile;
  systems: BirthChartSystem[];
  inputs: BirthChartBundleInputs;
  bazi?: BaziChartResult;
  ziwei?: ZiweiRuntime;
  astrolabe?: AstrolabeData;
  qizheng?: QizhengResult;
  range?: never;
}

/** 区间内本批实际计算的整秒点；各秒保留完整输入、盘面和时间证据。 */
export interface BirthChartRangeSample {
  index: number;
  timestamp: number;
  bundle: BirthChartPointBundle;
}

export interface BirthChartRangeBundle {
  profile: BirthProfile;
  systems: BirthChartSystem[];
  range: {
    source: BirthProfileTimeRange;
    resolutionSeconds: 1;
    totalSamples: number;
    startIndex: number;
    endIndexExclusive: number;
    /** 后续批次起点；null 只表示本批到达区间末尾，不表示调用方已读取此前各批。 */
    nextIndex: number | null;
    samples: BirthChartRangeSample[];
  };
  normalized?: never;
  inputs?: never;
  bazi?: never;
  ziwei?: never;
  astrolabe?: never;
  qizheng?: never;
}

export type BirthChartBundle = BirthChartPointBundle | BirthChartRangeBundle;

export interface BirthChartBundleOptions {
  /** 默认只计算八字；紫微需要调用方安装可选 peerDependency iztro。 */
  systems?: BirthChartSystem[];
  ziwei?: ZiweiRuntimeOptions;
  /** 区间输入每次默认计算一个整秒点，按返回的 nextIndex 继续。 */
  rangeBatch?: { startIndex?: number; limit?: number };
  signal?: AbortSignal;
}

const DEFAULT_SYSTEMS: BirthChartSystem[] = ['bazi'];
const SYSTEMS = new Set<BirthChartSystem>(['bazi', 'ziwei', 'astrolabe', 'qizheng']);

function normalizeSystems(systems?: BirthChartSystem[]): BirthChartSystem[] {
  const requested = systems?.length ? systems : DEFAULT_SYSTEMS;
  const unique = Array.from(new Set(requested));
  for (const system of unique) {
    if (!SYSTEMS.has(system)) throw new Error(`不支持的出生排盘系统：${String(system)}。`);
  }
  return unique;
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('已停止出生区间计算。', 'AbortError');
}

async function calculatePointBundle(
  profile: BirthProfile,
  systems: BirthChartSystem[],
  options: BirthChartBundleOptions,
): Promise<BirthChartPointBundle> {
  checkAborted(options.signal);
  const bundle: BirthChartPointBundle = {
    profile,
    normalized: normalizeBirthProfile(profile),
    systems,
    inputs: {},
  };
  for (const system of systems) {
    checkAborted(options.signal);
    switch (system) {
      case 'bazi': {
        const input = birthProfileToBaziPerson(profile);
        bundle.inputs.bazi = input;
        bundle.bazi = baziCalculator.calculateBazi(input);
        break;
      }
      case 'ziwei': {
        const input = birthProfileToZiweiChartInput(profile);
        bundle.inputs.ziwei = input;
        bundle.ziwei = await calculateZiweiChart(input, options.ziwei);
        break;
      }
      case 'astrolabe': {
        const input = birthProfileToAstrolabeInput(profile);
        bundle.inputs.astrolabe = input;
        bundle.astrolabe = generateAstrolabe(input);
        break;
      }
      case 'qizheng': {
        const input = birthProfileToQizhengInput(profile);
        bundle.inputs.qizheng = input;
        bundle.qizheng = generateQizheng(input);
        break;
      }
    }
  }
  checkAborted(options.signal);
  return bundle;
}

/** 同一入口按出生日期输入模式生成单点结果或有界的完整整秒资料。 */
export async function calculateBirthChartBundle(
  profile: BirthProfile,
  options: BirthChartBundleOptions = {},
): Promise<BirthChartBundle> {
  const systems = normalizeSystems(options.systems);
  if (profile.birthTimeRange === undefined) return calculatePointBundle(profile, systems, options);
  checkAborted(options.signal);
  const source = validateBirthProfileTimeRange(profile, profile.birthTimeRange);
  if (systems.includes('ziwei') && !options.ziwei?.horoscopeContext && !options.ziwei?.now) {
    throw new Error('紫微出生区间需提供固定的运限日期或计算时间，以便各批次按同一时刻重算。');
  }
  const lockedProfile = structuredClone(profile);
  const lockedOptions = {
    ...options,
    ziwei: options.ziwei ? structuredClone(options.ziwei) : undefined,
  };
  if (systems.includes('ziwei') && lockedOptions.ziwei && !lockedOptions.ziwei.horoscopeContext) {
    lockedOptions.ziwei.horoscopeContext = getDefaultHoroscopeContext(lockedOptions.ziwei.now);
  }
  const bounds = resolveBirthRangeBatch(
    (source.endTimestamp - source.startTimestamp) / 1000,
    options.rangeBatch,
  );
  const samples: BirthChartRangeSample[] = [];
  for (let index = bounds.startIndex; index < bounds.endIndexExclusive; index += 1) {
    checkAborted(options.signal);
    const timestamp = source.startTimestamp + index * 1000;
    const point = birthProfileAtRangeTimestamp(lockedProfile, source, timestamp);
    samples.push({
      index,
      timestamp,
      bundle: await calculatePointBundle(point, systems, lockedOptions),
    });
  }
  checkAborted(options.signal);
  return {
    profile: lockedProfile,
    systems,
    range: {
      source,
      resolutionSeconds: 1,
      totalSamples: bounds.totalSamples,
      startIndex: bounds.startIndex,
      endIndexExclusive: bounds.endIndexExclusive,
      nextIndex: bounds.nextIndex,
      samples,
    },
  };
}
