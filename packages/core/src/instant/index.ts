import { calculateBaziChartFromInput, type BaziChartResult } from '../bazi/index';
import { getTimeIndexFromClock } from '../calendar/dateUtils';
import {
  convertTrueSolarTime,
  type TrueSolarTimeConversionResult,
} from '../calendar/true-solar-time';
import { generateAstrolabe } from '../divination/algorithms/astrolabe';
import type { AstrolabeData } from '../types/divination';
import type {
  ActiveScopeInfo,
  BasicInfo,
  PalaceFact,
  ZiweiCalculationConfig,
} from '../types/analysis';
import { generateQizheng, type QizhengResult } from '../qi_zheng/index';
import { buildZiweiChartInput, calculateZiweiChartForScopes } from '../ziwei/runtime';

export const INSTANT_CHART_TYPES = ['bazi', 'ziwei', 'bazi-ziwei', 'astrolabe', 'qizheng'] as const;

export type InstantChartType = (typeof INSTANT_CHART_TYPES)[number];
export type InstantTimeStandard = 'beijing' | 'true-solar';

export interface InstantObserver {
  longitude: number;
  latitude?: number;
  timezone?: number;
  timeZoneId?: string;
  locationName?: string;
}

export interface InstantChartRequest<T extends InstantChartType = InstantChartType> {
  type: T;
  /** 不传时使用调用当刻；传入时必须是有效 Date。 */
  customDate?: Date;
  /** 默认按北京时间；真太阳时必须同时提供 observer。 */
  timeStandard?: InstantTimeStandard;
  observer?: InstantObserver;
  ziweiAlgorithm?: 'default' | 'zhongzhou';
}

export interface InstantWallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface InstantChartDefinition {
  type: InstantChartType;
  label: string;
  shortLabel: string;
  mark: string;
  description: string;
  requiresObserver: 'never' | 'true-solar' | 'always';
}

export const INSTANT_CHART_DEFINITIONS: readonly InstantChartDefinition[] = [
  {
    type: 'bazi',
    label: '八字即时盘',
    shortLabel: '八字',
    mark: '八',
    description: '以当前时刻排四柱盘',
    requiresObserver: 'true-solar',
  },
  {
    type: 'ziwei',
    label: '紫微即时盘',
    shortLabel: '紫微',
    mark: '紫',
    description: '紫占 · 以当前时刻起盘',
    requiresObserver: 'true-solar',
  },
  {
    type: 'bazi-ziwei',
    label: '八字紫微即时盘',
    shortLabel: '八字紫微',
    mark: '合',
    description: '同一时刻生成两种命盘',
    requiresObserver: 'true-solar',
  },
  {
    type: 'astrolabe',
    label: '星盘即时盘',
    shortLabel: '星盘',
    mark: '星',
    description: '按当前时刻与观测地点排盘',
    requiresObserver: 'always',
  },
  {
    type: 'qizheng',
    label: '七政四余即时盘',
    shortLabel: '七政四余',
    mark: '政',
    description: '按当前时刻与观测地点排盘',
    requiresObserver: 'always',
  },
] as const;

type BaziPersonalField =
  'gender' | 'age' | 'mingGua' | 'luckInfo' | 'liunian' | 'shensha' | 'shenShaAnalysis';

export type InstantBaziChartResult = Omit<BaziChartResult, BaziPersonalField>;

export type InstantZiweiPalace = Pick<
  PalaceFact,
  | 'index'
  | 'name'
  | 'is_body_palace'
  | 'is_original_palace'
  | 'heavenly_stem'
  | 'earthly_branch'
  | 'major_stars'
  | 'minor_stars'
  | 'other_stars'
  | 'base_jiangqian12'
  | 'base_suiqian12'
  | 'empty_state'
  | 'opposite_palace_index'
  | 'surrounded_palace_indexes'
  | 'mutaged_palaces'
  | 'self_mutagens'
>;

export interface InstantZiweiChartResult {
  calculationConfig: ZiweiCalculationConfig;
  basicInfo: Omit<BasicInfo, 'gender'>;
  activeScope: Pick<
    ActiveScopeInfo,
    'scope' | 'label' | 'solar_date' | 'lunar_date' | 'mutagen_map'
  >;
  palaces: InstantZiweiPalace[];
}

export type InstantAstrolabeChartResult = Omit<AstrolabeData, 'birth'> & {
  birth: Omit<AstrolabeData['birth'], 'gender'>;
};

export type InstantChartResultMap = {
  bazi: InstantBaziChartResult;
  ziwei: InstantZiweiChartResult;
  'bazi-ziwei': { bazi: InstantBaziChartResult; ziwei: InstantZiweiChartResult };
  astrolabe: InstantAstrolabeChartResult;
  qizheng: QizhengResult;
};

export interface InstantChartResponse<T extends InstantChartType = InstantChartType> {
  type: T;
  label: string;
  generatedAt: string;
  timeStandard: InstantTimeStandard;
  wallClock: InstantWallClockParts;
  observer?: InstantObserver;
  trueSolarTime?: TrueSolarTimeConversionResult;
  result: InstantChartResultMap[T];
}

const BEIJING_TIMEZONE = 8;

function assertValidDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error('即时排盘时间不是有效日期。');
  }
  return value;
}

function assertObserver(
  value: InstantObserver | undefined,
  options: { requireLatitude: boolean },
): InstantObserver {
  if (!value || typeof value !== 'object') {
    throw new Error('当前时间口径需要提供观测地点。');
  }
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    throw new Error('观测地点经度需在 -180 到 180 之间。');
  }
  if (
    options.requireLatitude &&
    (!Number.isFinite(value.latitude) || value.latitude! < -90 || value.latitude! > 90)
  ) {
    throw new Error('该即时盘需要提供 -90 到 90 之间的观测地点纬度。');
  }
  if (value.timezone === undefined && !value.timeZoneId?.trim()) {
    throw new Error('观测地点需要提供 timezone 或 timeZoneId。');
  }
  if (
    value.timezone !== undefined &&
    (!Number.isFinite(value.timezone) || value.timezone < -12 || value.timezone > 14)
  ) {
    throw new Error('观测地点时区需在 UTC-12 到 UTC+14 之间。');
  }
  return {
    longitude: value.longitude,
    ...(value.latitude !== undefined ? { latitude: value.latitude } : {}),
    ...(value.timezone !== undefined ? { timezone: value.timezone } : {}),
    ...(value.timeZoneId?.trim() ? { timeZoneId: value.timeZoneId.trim() } : {}),
    ...(value.locationName?.trim() ? { locationName: value.locationName.trim() } : {}),
  };
}

function getWallClockPartsInOffset(date: Date, timezone: number): InstantWallClockParts {
  const shifted = new Date(date.getTime() + timezone * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function getWallClockPartsInTimeZone(date: Date, timeZoneId: string): InstantWallClockParts {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZoneId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new Error(`无法识别 IANA 时区 ${timeZoneId}。`);
  }
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function getObserverWallClockParts(date: Date, observer: InstantObserver) {
  if (observer.timeZoneId) {
    return getWallClockPartsInTimeZone(date, observer.timeZoneId);
  }
  return getWallClockPartsInOffset(date, observer.timezone!);
}

function formatLocalDateTime(parts: InstantWallClockParts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:00`;
}

export function buildInstantChartContext(
  request: Pick<InstantChartRequest, 'type' | 'customDate' | 'timeStandard' | 'observer'>,
) {
  const customDate = assertValidDate(request.customDate ?? new Date());
  const timeStandard = request.timeStandard ?? 'beijing';
  if (timeStandard !== 'beijing' && timeStandard !== 'true-solar') {
    throw new Error('即时排盘时间口径必须是 beijing 或 true-solar。');
  }
  const definition = INSTANT_CHART_DEFINITIONS.find((item) => item.type === request.type);
  if (!definition) {
    throw new Error(`不支持的即时排盘类型：${String(request.type)}`);
  }

  const observerRequired =
    definition.requiresObserver === 'always' ||
    (definition.requiresObserver === 'true-solar' && timeStandard === 'true-solar');
  const observer = observerRequired
    ? assertObserver(request.observer, {
        requireLatitude: definition.requiresObserver === 'always',
      })
    : request.observer
      ? assertObserver(request.observer, { requireLatitude: false })
      : undefined;
  const wallClock =
    definition.requiresObserver === 'always' || timeStandard === 'true-solar'
      ? getObserverWallClockParts(customDate, observer!)
      : getWallClockPartsInOffset(customDate, BEIJING_TIMEZONE);
  const trueSolarTime =
    timeStandard === 'true-solar'
      ? convertTrueSolarTime({
          localDateTime: formatLocalDateTime(wallClock),
          longitude: observer!.longitude,
          ...(observer!.timezone !== undefined ? { timezone: observer!.timezone } : {}),
          ...(observer!.timeZoneId ? { timeZoneId: observer!.timeZoneId } : {}),
        })
      : undefined;

  return { customDate, timeStandard, definition, observer, wallClock, trueSolarTime };
}

function buildBaziInput(
  parts: InstantWallClockParts,
  context: ReturnType<typeof buildInstantChartContext>,
) {
  const useTrueSolarTime = context.timeStandard === 'true-solar';
  return {
    // 即时盘不是个人命盘。底层完整八字计算仍需技术性性别参数，返回前会剔除
    // 大运、命卦等全部个人性别相关字段，只保留当前四柱的共通盘面。
    gender: 'male' as const,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    timeIndex: getTimeIndexFromClock(parts.hour, parts.minute),
    dateType: 'solar' as const,
    isLeapMonth: false,
    useTrueSolarTime,
    ...(useTrueSolarTime
      ? {
          birthHour: parts.hour,
          birthMinute: parts.minute,
          birthPlace: context.observer?.locationName,
          birthLongitude: context.observer!.longitude,
          timezone: context.observer?.timezone,
          timeZoneId: context.observer?.timeZoneId,
        }
      : {}),
  };
}

async function calculateZiwei(
  parts: InstantWallClockParts,
  context: ReturnType<typeof buildInstantChartContext>,
  algorithm: 'default' | 'zhongzhou' | undefined,
) {
  const useTrueSolarTime = context.timeStandard === 'true-solar';
  const input = buildZiweiChartInput({
    name: '紫微即时盘',
    // iztro 的基础排盘入口要求性别。即时盘只保留男女共通的宫位、星曜与四化，
    // 长生、博士、岁限等受性别影响的字段不会进入公开结果。
    gender: 'male',
    dateType: 'solar',
    year: parts.year,
    month: parts.month,
    day: parts.day,
    timeIndex: getTimeIndexFromClock(parts.hour, parts.minute),
    isLeapMonth: false,
    useTrueSolarTime,
    algorithm,
    ...(useTrueSolarTime
      ? {
          birthHour: parts.hour,
          birthMinute: parts.minute,
          birthLongitude: context.observer!.longitude,
          timezone: context.observer?.timezone,
          timeZoneId: context.observer?.timeZoneId,
        }
      : {}),
  });
  const runtime = await calculateZiweiChartForScopes(input, ['origin']);
  const payload = runtime.payloadByScope.origin;
  const basicInfo = { ...payload.basic_info } as Partial<BasicInfo>;
  delete basicInfo.gender;
  return {
    calculationConfig: payload.calculation_config,
    basicInfo: basicInfo as Omit<BasicInfo, 'gender'>,
    activeScope: {
      scope: payload.active_scope.scope,
      label: payload.active_scope.label,
      solar_date: payload.active_scope.solar_date,
      lunar_date: payload.active_scope.lunar_date,
      mutagen_map: payload.active_scope.mutagen_map,
    },
    palaces: payload.palaces.map((palace) => ({
      index: palace.index,
      name: palace.name,
      is_body_palace: palace.is_body_palace,
      is_original_palace: palace.is_original_palace,
      heavenly_stem: palace.heavenly_stem,
      earthly_branch: palace.earthly_branch,
      major_stars: palace.major_stars,
      minor_stars: palace.minor_stars,
      other_stars: palace.other_stars,
      base_jiangqian12: palace.base_jiangqian12,
      base_suiqian12: palace.base_suiqian12,
      empty_state: palace.empty_state,
      opposite_palace_index: palace.opposite_palace_index,
      surrounded_palace_indexes: palace.surrounded_palace_indexes,
      mutaged_palaces: palace.mutaged_palaces,
      self_mutagens: palace.self_mutagens,
    })),
  };
}

function calculateNeutralBazi(
  parts: InstantWallClockParts,
  context: ReturnType<typeof buildInstantChartContext>,
): InstantBaziChartResult {
  const result = {
    ...calculateBaziChartFromInput(buildBaziInput(parts, context)),
  } as Partial<BaziChartResult>;
  delete result.gender;
  delete result.age;
  delete result.mingGua;
  delete result.luckInfo;
  delete result.liunian;
  delete result.shensha;
  delete result.shenShaAnalysis;
  return result as InstantBaziChartResult;
}

function calculateNeutralAstrolabe(
  input: Parameters<typeof generateAstrolabe>[0],
): InstantAstrolabeChartResult {
  const result = generateAstrolabe(input);
  const birth = { ...result.birth } as Partial<AstrolabeData['birth']>;
  delete birth.gender;
  return {
    ...result,
    birth: birth as Omit<AstrolabeData['birth'], 'gender'>,
  };
}

function formatInstantQizhengPrompt(result: QizhengResult) {
  return result.prompt
    .replace('【七政四余 · 果老星宗】', '【七政四余即时盘 · 果老星宗】')
    .replace('出生时间：', '起盘时间：')
    .replace(/命主([^；\n]+)；/u, '命宫主星$1；');
}

export async function calculateInstantChart<T extends InstantChartType>(
  request: InstantChartRequest<T>,
): Promise<InstantChartResponse<T>> {
  const context = buildInstantChartContext(request);
  let result: InstantChartResultMap[InstantChartType];

  switch (request.type) {
    case 'bazi':
      result = calculateNeutralBazi(context.wallClock, context);
      break;
    case 'ziwei':
      result = await calculateZiwei(context.wallClock, context, request.ziweiAlgorithm);
      break;
    case 'bazi-ziwei': {
      const bazi = calculateNeutralBazi(context.wallClock, context);
      const ziwei = await calculateZiwei(context.wallClock, context, request.ziweiAlgorithm);
      result = { bazi, ziwei };
      break;
    }
    case 'astrolabe':
      result = calculateNeutralAstrolabe({
        name: '星盘即时盘',
        gender: '',
        year: String(context.wallClock.year),
        month: String(context.wallClock.month),
        day: String(context.wallClock.day),
        hour: String(context.wallClock.hour),
        minute: String(context.wallClock.minute),
        latitude: String(context.observer!.latitude),
        longitude: String(context.observer!.longitude),
        ...(context.observer!.timezone !== undefined
          ? { timezone: String(context.observer!.timezone) }
          : {}),
        ...(context.observer!.timeZoneId ? { timeZoneId: context.observer!.timeZoneId } : {}),
        ...(context.observer!.locationName ? { locationName: context.observer!.locationName } : {}),
        useTrueSolarTime: context.timeStandard === 'true-solar',
      });
      break;
    case 'qizheng':
      result = generateQizheng({
        year: context.wallClock.year,
        month: context.wallClock.month,
        day: context.wallClock.day,
        hour: context.wallClock.hour,
        minute: context.wallClock.minute,
        latitude: context.observer!.latitude,
        longitude: context.observer!.longitude,
        ...(context.observer!.timezone !== undefined
          ? { timezone: context.observer!.timezone }
          : {}),
        ...(context.observer!.timeZoneId ? { timeZoneId: context.observer!.timeZoneId } : {}),
        useTrueSolarTime: context.timeStandard === 'true-solar',
      });
      result = {
        ...result,
        prompt: formatInstantQizhengPrompt(result),
      };
      break;
  }

  return {
    type: request.type,
    label: context.definition.label,
    generatedAt: context.customDate.toISOString(),
    timeStandard: context.timeStandard,
    wallClock: context.wallClock,
    ...(context.observer ? { observer: context.observer } : {}),
    ...(context.trueSolarTime ? { trueSolarTime: context.trueSolarTime } : {}),
    result: result as InstantChartResultMap[T],
  };
}
