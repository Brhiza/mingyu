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
import { calculateZiweiChart, type ZiweiRuntime, type ZiweiRuntimeOptions } from '../ziwei/runtime';
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

/** 一份出生档案按所选系统生成的完整结果集合。 */
export interface BirthChartBundle {
  profile: BirthProfile;
  normalized: NormalizedBirthProfile;
  systems: BirthChartSystem[];
  inputs: BirthChartBundleInputs;
  bazi?: BaziChartResult;
  ziwei?: ZiweiRuntime;
  astrolabe?: AstrolabeData;
  qizheng?: QizhengResult;
}

export interface BirthChartBundleOptions {
  /** 默认只计算八字；紫微需要调用方安装可选 peerDependency iztro。 */
  systems?: BirthChartSystem[];
  ziwei?: ZiweiRuntimeOptions;
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

/**
 * 从同一份出生档案生成多个盘面。
 *
 * 该入口只负责输入统一、算法调用和结果归组，不生成报告，也不把缺失资料
 * 静默替换成候选盘。所选系统所需的资料不足时，沿用各适配器的结构化错误。
 */
export async function calculateBirthChartBundle(
  profile: BirthProfile,
  options: BirthChartBundleOptions = {},
): Promise<BirthChartBundle> {
  const systems = normalizeSystems(options.systems);
  const normalized = normalizeBirthProfile(profile);
  const bundle: BirthChartBundle = {
    profile,
    normalized,
    systems,
    inputs: {},
  };

  for (const system of systems) {
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

  return bundle;
}
