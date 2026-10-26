import {
  generateResidentialFengshui,
  type ResidentialFengshuiInput,
  type ResidentialFengshuiResult,
} from 'mingyu-core/residential-fengshui';
import {
  getBaZhaiSitFacingFromDoorDegree,
  type BaZhaiDoorMeasurement,
  type BaZhaiResult,
} from 'mingyu-core/bazhai';
import type { SitFacingPosition } from 'mingyu-core/direction';
import type { XuanKongGuaType, XuanKongResult } from 'mingyu-core/xuankong';
import { LunarDay } from 'tyme4ts';
import { daysInGregorianMonth } from 'mingyu-core/calendar';

export type ResidentialMeasurement = BaZhaiDoorMeasurement;
export type ResidentialChartResult = ResidentialFengshuiResult;

export type ResidentialChartInput = {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  timezone?: number;
  timeZoneId?: string;
  gender?: 'male' | 'female';
  houseYear?: number;
  doorToInteriorDegree?: number;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  mingGua?: string;
  northReference?: ResidentialFengshuiInput['northReference'];
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
  guaType?: XuanKongGuaType;
  flowYear?: number;
  flowMonth?: number;
  flowDay?: number;
};

export type ResidentialBirthData = Pick<
  ResidentialChartInput,
  'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'timezone' | 'timeZoneId' | 'gender'
>;

export type ResidentialChartDraft = {
  facingDegree: string;
  houseYear: string;
  guaType: XuanKongGuaType;
  flowYear: string;
  flowMonth: string;
  flowDay: string;
};

export type ResidentialChartState = {
  input: ResidentialChartInput | null;
  result: ResidentialChartResult | null;
  measurement: ResidentialMeasurement | null;
  direction: SitFacingPosition | null;
  error: string;
};

/** 编辑草稿保留静态、年、年月和完整日期；无效草稿不降级为另一种时间范围。 */
export function resolveResidentialChartDraft(
  draft: ResidentialChartDraft,
  birthData?: ResidentialBirthData | null,
): Pick<ResidentialChartState, 'input' | 'direction' | 'error'> {
  let direction: SitFacingPosition | null = null;
  try {
    if (draft.facingDegree.trim()) {
      direction = resolveResidentialDoorDirection(Number(draft.facingDegree));
      const facing = direction.facing;
      if (facing.isBoundary && facing.boundaryMountains) {
        throw new Error(
          `当前度数位于${facing.boundaryMountains[0]}向与${facing.boundaryMountains[1]}向的分界线，请重新测量并填写稍偏离分界线的度数。`,
        );
      }
    }
    if (!birthData && !direction) {
      throw new Error('请补充出生年月日与性别，或填写大门向屋内度数，至少一项。');
    }
    const houseYear = draft.houseYear.trim() ? Number(draft.houseYear) : undefined;
    if (
      houseYear !== undefined &&
      (!Number.isInteger(houseYear) || houseYear < 1 || houseYear > 9999)
    ) {
      throw new Error('建造或起运年需为 1-9999 之间的整数。');
    }
    const flowYear = draft.flowYear.trim() ? Number(draft.flowYear) : undefined;
    const flowMonth = draft.flowMonth.trim() ? Number(draft.flowMonth) : undefined;
    const flowDay = draft.flowDay.trim() ? Number(draft.flowDay) : undefined;
    if (
      (flowYear !== undefined &&
        (!Number.isInteger(flowYear) || flowYear < 1 || flowYear > 9999)) ||
      (flowMonth !== undefined &&
        (flowYear === undefined ||
          !Number.isInteger(flowMonth) ||
          flowMonth < 1 ||
          flowMonth > 12)) ||
      (flowDay !== undefined &&
        (flowYear === undefined ||
          flowMonth === undefined ||
          !Number.isInteger(flowDay) ||
          flowDay < 1 ||
          flowDay > daysInGregorianMonth(flowYear, flowMonth)))
    ) {
      throw new Error('目标日期无效，请按年份、月份、日期的顺序填写并检查年月日。');
    }
    return {
      input: buildResidentialChartInput({
        birthData,
        houseYear,
        guaType: draft.guaType,
        ...(direction ? { doorToInteriorDegree: Number(draft.facingDegree) } : {}),
        flowYear,
        flowMonth,
        flowDay,
      }),
      direction,
      error: '',
    };
  } catch (error) {
    return {
      input: null,
      direction,
      error: error instanceof Error ? error.message : '住宅风水资料无效。',
    };
  }
}

type CompleteResidentialBirthDate = Required<
  Pick<ResidentialBirthData, 'year' | 'month' | 'day' | 'gender'>
> &
  Pick<ResidentialBirthData, 'hour' | 'minute' | 'second' | 'timezone' | 'timeZoneId'>;

export function resolveResidentialBirthDate(
  birth: CompleteResidentialBirthDate,
  dateType: 'solar' | 'lunar',
  isLeapMonth: boolean,
): CompleteResidentialBirthDate {
  if (dateType === 'solar') return birth;
  const solar = LunarDay.fromYmd(
    birth.year,
    isLeapMonth ? -birth.month : birth.month,
    birth.day,
  ).getSolarDay();
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    gender: birth.gender,
    ...(birth.hour != null ? { hour: birth.hour } : {}),
    ...(birth.minute != null ? { minute: birth.minute } : {}),
    ...(birth.second != null ? { second: birth.second } : {}),
    ...(birth.timezone != null ? { timezone: birth.timezone } : {}),
    ...(birth.timeZoneId ? { timeZoneId: birth.timeZoneId } : {}),
  };
}

/** 将网页或主体快照中的住宅资料统一整理为核心住宅输入。 */
export function buildResidentialChartInput(params: {
  birthData?: ResidentialBirthData | null;
  houseYear?: number;
  doorToInteriorDegree?: number;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  mingGua?: string;
  northReference?: ResidentialFengshuiInput['northReference'];
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
  guaType?: XuanKongGuaType;
  flowYear?: number;
  flowMonth?: number;
  flowDay?: number;
}): ResidentialChartInput {
  return {
    ...(params.birthData ?? {}),
    ...(params.houseYear != null ? { houseYear: params.houseYear } : {}),
    ...(params.doorToInteriorDegree != null
      ? { doorToInteriorDegree: params.doorToInteriorDegree }
      : {}),
    ...(params.sitMountain ? { sitMountain: params.sitMountain } : {}),
    ...(params.facingMountain ? { facingMountain: params.facingMountain } : {}),
    ...(params.facingDegree != null ? { facingDegree: params.facingDegree } : {}),
    ...(params.sitDegree != null ? { sitDegree: params.sitDegree } : {}),
    ...(params.mingGua ? { mingGua: params.mingGua } : {}),
    ...(params.northReference ? { northReference: params.northReference } : {}),
    ...(params.magneticDeclinationDegrees != null
      ? { magneticDeclinationDegrees: params.magneticDeclinationDegrees }
      : {}),
    ...(params.measurementUncertaintyDegrees != null
      ? { measurementUncertaintyDegrees: params.measurementUncertaintyDegrees }
      : {}),
    ...(params.guaType ? { guaType: params.guaType } : {}),
    ...(params.flowYear != null ? { flowYear: params.flowYear } : {}),
    ...(params.flowMonth != null ? { flowMonth: params.flowMonth } : {}),
    ...(params.flowDay != null ? { flowDay: params.flowDay } : {}),
  };
}

export function buildResidentialCoreInput(
  params: Parameters<typeof buildResidentialChartInput>[0],
) {
  return toCoreInput(buildResidentialChartInput(params));
}

export function resolveResidentialDoorDirection(measuredDegree: number): SitFacingPosition {
  return getBaZhaiSitFacingFromDoorDegree(measuredDegree);
}

function toCoreInput(input: ResidentialChartInput): ResidentialFengshuiInput {
  return {
    ...(input.year != null ? { birthYear: input.year } : {}),
    ...(input.month != null ? { birthMonth: input.month } : {}),
    ...(input.day != null ? { birthDay: input.day } : {}),
    ...(input.hour != null ? { birthHour: input.hour } : {}),
    ...(input.minute != null ? { birthMinute: input.minute } : {}),
    ...(input.second != null ? { birthSecond: input.second } : {}),
    ...(input.timezone != null ? { birthTimezone: input.timezone } : {}),
    ...(input.timeZoneId ? { birthTimeZoneId: input.timeZoneId } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.houseYear != null ? { year: input.houseYear } : {}),
    ...(input.doorToInteriorDegree != null
      ? { doorToInteriorDegree: input.doorToInteriorDegree }
      : {}),
    ...(input.sitMountain ? { sitMountain: input.sitMountain } : {}),
    ...(input.facingMountain ? { facingMountain: input.facingMountain } : {}),
    ...(input.facingDegree != null ? { facingDegree: input.facingDegree } : {}),
    ...(input.sitDegree != null ? { sitDegree: input.sitDegree } : {}),
    ...(input.mingGua ? { mingGua: input.mingGua } : {}),
    ...(input.northReference ? { northReference: input.northReference } : {}),
    ...(input.magneticDeclinationDegrees != null
      ? { magneticDeclinationDegrees: input.magneticDeclinationDegrees }
      : {}),
    ...(input.measurementUncertaintyDegrees != null
      ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
      : {}),
    ...(input.guaType ? { guaType: input.guaType } : {}),
    ...(input.flowYear != null ? { flowYear: input.flowYear } : {}),
    ...(input.flowMonth != null ? { flowMonth: input.flowMonth } : {}),
    ...(input.flowDay != null ? { flowDay: input.flowDay } : {}),
  };
}

export function calculateResidentialChart(input: ResidentialChartInput = {}): {
  result: ResidentialFengshuiResult;
  measurement: ResidentialMeasurement | null;
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
} {
  const result = generateResidentialFengshui(toCoreInput(input));
  const measurement =
    result.bazhai && 'directionMeasurement' in result.bazhai
      ? result.bazhai.directionMeasurement
      : null;
  return {
    result,
    measurement,
    bazhai: result.bazhai,
    xuankong: result.xuankong,
  };
}

/** @deprecated 使用 calculateResidentialChart；保留兼容旧调用 */
export function calculateResidentialBaseChart(birthData: {
  year: number;
  month: number;
  day: number;
  gender: 'male' | 'female';
  houseYear?: number;
}): ResidentialFengshuiResult {
  return calculateResidentialChart(birthData).result;
}
