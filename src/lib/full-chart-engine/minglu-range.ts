import { calculateBirthChartBundle, type BirthChartPointBundle } from 'mingyu-core/birth';
import { normalizeBirthProfile, type BirthProfile } from 'mingyu-core/profile';
import type { BaziChartResult } from 'mingyu-core/bazi';
import type { AstrolabeData } from 'mingyu-core/types';
import type { MingluPersonInput } from 'mingyu-core/minglu';

export interface MingluRangeCalculationRequest {
  inputKey: string;
  pageIndex: number;
  timestamp?: number;
  primary: {
    profile: BirthProfile;
    baziResult: BaziChartResult;
    astrolabeData?: AstrolabeData | null;
  };
  astrolabeRequested: boolean;
}

export interface MingluRangePageFacts {
  inputKey: string;
  pageIndex: number;
  timestamp?: number;
  profile: BirthProfile;
  baziResult: BaziChartResult;
  astrolabeData: AstrolabeData | null;
}

export function createMingluAbortError(): DOMException {
  return new DOMException('已停止当前命录出生样本计算。', 'AbortError');
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createMingluAbortError();
}

function assertRequest(request: MingluRangeCalculationRequest): void {
  if (!request.inputKey.trim()) throw new Error('命录范围请求缺少输入标识。');
  if (!Number.isSafeInteger(request.pageIndex) || request.pageIndex < 0) {
    throw new RangeError('命录范围页索引必须是非负整数。');
  }
  if (!request.primary || !request.primary.profile || !request.primary.baziResult) {
    throw new Error('命录范围请求缺少当前页本人八字事实。');
  }
  if (request.primary.profile.birthTimeRange !== undefined) {
    throw new Error('命录同页补算必须接收当前秒的单点出生档案。');
  }
}

/**
 * 把范围页的单点档案转换为命录元数据输入。
 *
 * 日期继续以当前页八字结果的太阳日期为准；时间、地点和真太阳时开关
 * 来自同一秒的 BirthProfile，避免回退到页面初始输入。
 */
export function buildMingluPersonFromBirthProfile(
  profile: BirthProfile,
  baziResult: BaziChartResult,
): MingluPersonInput {
  const normalized = normalizeBirthProfile(profile);
  const location = normalized.resolvedLocation;
  const precise = normalized.timeInputMode === 'precise-clock-time';
  const clock = normalized.solarClockTime;

  return {
    name: profile.name,
    gender: profile.gender === 'unspecified' ? '' : profile.gender,
    birthYear: baziResult.solarDate.year,
    birthMonth: baziResult.solarDate.month,
    birthDay: baziResult.solarDate.day,
    ...(precise
      ? {
          birthHour: clock.hour,
          birthMinute: clock.minute,
          ...(profile.second === undefined ? {} : { birthSecond: clock.second }),
        }
      : {}),
    birthPlace: location?.name,
    birthLongitude: location?.longitude,
    birthLatitude: location?.latitude,
    timezone: location?.timezone,
    timeZoneId: location?.timeZoneId,
    useTrueSolarTime: profile.useTrueSolarTime,
  };
}

/**
 * 为当前范围页补齐星盘事实。八字直接复用 page side，七政不在命录章节范围内，
 * 因此这里明确只请求 astrolabe，避免无用的第二套出生计算。
 */
export async function calculateMingluRangePageFacts(
  request: MingluRangeCalculationRequest,
  signal?: AbortSignal,
): Promise<MingluRangePageFacts> {
  assertRequest(request);
  assertNotAborted(signal);

  let astrolabeData: AstrolabeData | null = null;
  if (request.astrolabeRequested) {
    astrolabeData = request.primary.astrolabeData ?? null;
    if (!astrolabeData) {
      const bundle = await calculateBirthChartBundle(request.primary.profile, {
        systems: ['astrolabe'],
        signal,
      });
      assertNotAborted(signal);
      if (bundle.range) {
        throw new Error('命录星盘补算意外返回出生范围，当前页必须是单点结果。');
      }
      astrolabeData = bundle.astrolabe ?? null;
    }
    if (!astrolabeData) throw new Error('命录当前页未生成完整星盘事实。');
  }

  return {
    inputKey: request.inputKey,
    pageIndex: request.pageIndex,
    ...(request.timestamp === undefined ? {} : { timestamp: request.timestamp }),
    profile: request.primary.profile,
    baziResult: request.primary.baziResult,
    astrolabeData,
  };
}

export function assertMingluPageBundle(bundle: BirthChartPointBundle): void {
  if (bundle.range) throw new Error('命录只能接收当前秒的单点出生盘。');
  if (!bundle.bazi) throw new Error('命录当前页缺少八字事实。');
}
