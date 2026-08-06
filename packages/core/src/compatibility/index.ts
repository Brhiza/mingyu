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
  type ZiweiCompatibilityEvidenceResult,
  type ZiweiCompatibilityOptions,
} from '../ziwei/iztro';
import {
  calculateBirthChartBundle,
  type BirthChartBundle,
  type BirthChartBundleOptions,
  type BirthChartSystem,
} from '../birth';
import type { BirthProfile } from '../profile';

export type CompatibilitySystem = Exclude<BirthChartSystem, 'qizheng'>;

export interface CompatibilityBundleOptions {
  /** 默认只计算八字；需要紫微或星盘时显式加入对应系统。 */
  systems?: CompatibilitySystem[];
  bazi?: BaziCompatibilityOptions;
  ziwei?: ZiweiCompatibilityOptions;
  astrolabe?: AstrolabeSynastryOptions;
  /** 同时传给双方出生盘生成器，例如紫微运限范围与固定计算时刻。 */
  chart?: BirthChartBundleOptions;
}

export interface CompatibilityBundle {
  systems: CompatibilitySystem[];
  primary: BirthChartBundle;
  partner: BirthChartBundle;
  bazi?: BaziCompatibilityEvidenceResult;
  ziwei?: ZiweiCompatibilityEvidenceResult;
  astrolabe?: AstrolabeSynastryData;
}

const DEFAULT_SYSTEMS: CompatibilitySystem[] = ['bazi'];
const SYSTEMS = new Set<CompatibilitySystem>(['bazi', 'ziwei', 'astrolabe']);

function normalizeSystems(systems?: CompatibilitySystem[]): CompatibilitySystem[] {
  const requested = systems?.length ? systems : DEFAULT_SYSTEMS;
  const unique = Array.from(new Set(requested));
  for (const system of unique) {
    if (!SYSTEMS.has(system)) throw new Error(`不支持的合盘系统：${String(system)}。`);
  }
  return unique;
}

/** 从两份 BirthProfile 直接生成八字、紫微和西占合盘证据。 */
export async function calculateCompatibilityBundle(
  primary: BirthProfile,
  partner: BirthProfile,
  options: CompatibilityBundleOptions = {},
): Promise<CompatibilityBundle> {
  const systems = normalizeSystems(options.systems);
  const chartOptions: BirthChartBundleOptions = {
    ...options.chart,
    systems,
  };
  const [primaryChart, partnerChart] = await Promise.all([
    calculateBirthChartBundle(primary, chartOptions),
    calculateBirthChartBundle(partner, chartOptions),
  ]);
  const bundle: CompatibilityBundle = {
    systems,
    primary: primaryChart,
    partner: partnerChart,
  };

  if (systems.includes('bazi')) {
    if (!primaryChart.bazi || !partnerChart.bazi) throw new Error('八字合盘资料生成失败。');
    bundle.bazi = analyzeBaziCompatibility(primaryChart.bazi, partnerChart.bazi, {
      person1Name: primary.name,
      person2Name: partner.name,
      ...options.bazi,
    });
  }

  if (systems.includes('astrolabe')) {
    if (!primaryChart.astrolabe || !partnerChart.astrolabe)
      throw new Error('西占合盘资料生成失败。');
    bundle.astrolabe = analyzeAstrolabeSynastry(
      primaryChart.astrolabe,
      partnerChart.astrolabe,
      options.astrolabe,
    );
  }

  if (systems.includes('ziwei')) {
    if (!primaryChart.ziwei || !partnerChart.ziwei) throw new Error('紫微合盘资料生成失败。');
    bundle.ziwei = analyzeZiweiCompatibility(
      primaryChart.ziwei.payloadByScope.origin,
      partnerChart.ziwei.payloadByScope.origin,
      {
        person1Name: primary.name,
        person2Name: partner.name,
        astrolabe1: primaryChart.ziwei.astrolabe,
        astrolabe2: partnerChart.ziwei.astrolabe,
        ...options.ziwei,
      },
    );
  }

  return bundle;
}
