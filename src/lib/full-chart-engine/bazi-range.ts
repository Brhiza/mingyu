import {
  calculateBirthChartBundle,
  type BirthChartBundle,
  type BirthChartPointBundle,
  type BirthChartRangeBundle,
} from 'mingyu-core/birth';
import {
  calculateCompatibilityBundle,
  type CompatibilityBundle,
  type CompatibilityRangeBundle,
} from 'mingyu-core/compatibility';
import type { BaziChartResult, BaziCompatibilityEvidenceResult } from 'mingyu-core/bazi';
import type { BirthProfile, BirthProfileTimeRange } from 'mingyu-core/profile';

export interface BaziRangeSideRequest {
  profile: BirthProfile;
}

export interface BaziRangeCalculationRequest {
  inputKey: string;
  index: number;
  primary: BaziRangeSideRequest;
  partner?: BaziRangeSideRequest;
}

export interface BaziRangePageSide {
  index: number;
  profile: BirthProfile;
  result: BaziChartResult;
  bundle: BirthChartPointBundle;
  timestamp?: number;
}

export interface BaziRangePage {
  inputKey: string;
  index: number;
  total: number;
  nextIndex: number | null;
  primary: BaziRangePageSide;
  partner?: BaziRangePageSide;
  compatibility?: BaziCompatibilityEvidenceResult;
  primarySource?: BirthProfileTimeRange;
  partnerSource?: BirthProfileTimeRange;
}

export type BaziRangeWorkerRequest = BaziRangeCalculationRequest & { id: string };

export type BaziRangeWorkerResponse =
  | { id: string; type: 'result'; result: BaziRangePage }
  | { id: string; type: 'error'; error: string };

function assertPointBundle(bundle: BirthChartBundle): BirthChartPointBundle {
  if (bundle.range) {
    throw new Error('八字范围样本必须由单点出生盘组成。');
  }
  return bundle;
}

function getBaziResult(bundle: BirthChartPointBundle): BaziChartResult {
  if (!bundle.bazi) throw new Error('八字出生范围样本缺少完整八字结果。');
  return bundle.bazi;
}

function buildPageSide(sample: {
  index: number;
  timestamp?: number;
  bundle: BirthChartPointBundle;
}): BaziRangePageSide {
  return {
    index: sample.index,
    profile: sample.bundle.profile,
    result: getBaziResult(sample.bundle),
    bundle: sample.bundle,
    ...(sample.timestamp === undefined ? {} : { timestamp: sample.timestamp }),
  };
}

function buildSinglePage(bundle: BirthChartRangeBundle, inputKey: string): BaziRangePage {
  const sample = bundle.range.samples[0];
  if (!sample) throw new Error('八字出生范围当前页没有可用样本。');
  return {
    inputKey,
    index: bundle.range.startIndex,
    total: bundle.range.totalSamples,
    nextIndex: bundle.range.nextIndex,
    primary: buildPageSide(sample),
    primarySource: bundle.range.source,
  };
}

function buildPointPage(bundle: BirthChartPointBundle, inputKey: string): BaziRangePage {
  return {
    inputKey,
    index: 0,
    total: 1,
    nextIndex: null,
    primary: {
      index: 0,
      profile: bundle.profile,
      result: getBaziResult(bundle),
      bundle,
    },
  };
}

function buildCompatibilityPage(bundle: CompatibilityBundle, inputKey: string): BaziRangePage {
  if (!bundle.range) {
    if (!bundle.bazi) throw new Error('八字合盘样本缺少完整关系证据。');
    return {
      ...buildPointPage(bundle.primary, inputKey),
      partner: {
        index: 0,
        profile: bundle.partner.profile,
        result: getBaziResult(bundle.partner),
        bundle: bundle.partner,
      },
      compatibility: bundle.bazi,
    };
  }
  const range = bundle as CompatibilityRangeBundle;
  const pair = range.pairs[0];
  if (!pair) throw new Error('八字合盘范围当前页没有可用 pair。');
  const primarySample = range.primarySamples.find((sample) => sample.index === pair.primaryIndex);
  const partnerSample = range.partnerSamples.find((sample) => sample.index === pair.partnerIndex);
  if (!primarySample || !partnerSample) {
    throw new Error('八字合盘范围当前页缺少 pair 对应的单点样本。');
  }
  if (!pair.bazi) throw new Error('八字合盘范围样本缺少完整关系证据。');
  return {
    inputKey,
    index: range.range.startIndex,
    total: range.range.totalPairs,
    nextIndex: range.range.nextIndex,
    primary: buildPageSide(primarySample),
    partner: buildPageSide(partnerSample),
    compatibility: pair.bazi,
    ...(range.range.primarySource ? { primarySource: range.range.primarySource } : {}),
    ...(range.range.partnerSource ? { partnerSource: range.range.partnerSource } : {}),
  };
}

/**
 * 计算一条单人逐秒样本或一条双人笛卡尔积 pair。
 *
 * 该函数不聚合区间，也不选择代表秒；index 始终由调用方明确传入，
 * 并交给 core 的范围入口按半开区间和真实笛卡尔积校验。
 */
export async function calculateBaziRangePage(
  request: BaziRangeCalculationRequest,
): Promise<BaziRangePage> {
  if (!Number.isSafeInteger(request.index) || request.index < 0) {
    throw new RangeError('八字出生范围索引必须是非负整数。');
  }
  const primaryProfile = request.primary.profile;
  const partnerProfile = request.partner?.profile;
  if (!partnerProfile) {
    const bundle = await calculateBirthChartBundle(primaryProfile, {
      systems: ['bazi'],
      rangeBatch: { startIndex: request.index, limit: 1 },
    });
    if (bundle.range) {
      return buildSinglePage(bundle, request.inputKey);
    }
    if (request.index !== 0) throw new RangeError('单人固定出生盘只能请求索引 0。');
    return buildPointPage(assertPointBundle(bundle), request.inputKey);
  }

  const bundle = await calculateCompatibilityBundle(primaryProfile, partnerProfile, {
    systems: ['bazi'],
    rangeBatch: { startIndex: request.index, limit: 1 },
  });
  if (!bundle.range && request.index !== 0) {
    throw new RangeError('双方固定出生盘只能请求索引 0。');
  }
  return buildCompatibilityPage(bundle, request.inputKey);
}
