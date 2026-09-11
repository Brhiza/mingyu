/**
 * @file 奇门终身局时间标准化与校正模块
 * @description 统一处理出生时刻、历法换算、时区/历史夏令时解析以及真太阳时计算。
 */

import { SolarTime } from 'tyme4ts';
import type { QimenLifetimeInput, QimenStagePolicy } from '../../../../types/divination';
import {
  resolveCivilTime,
  DEFAULT_CHINA_TIMEZONE_HOURS,
  getCivilDateTimeAtFixedOffset,
  type CivilDateTimeParts,
} from '../../../../calendar/civil-time';
import {
  convertTrueSolarTime,
  resolveBirthCalendarClockTime,
  formatSolarDateTimeParts,
  type SolarDateTimeParts,
} from '../../../../calendar/true-solar-time';

export interface QimenNormalizedTimeResult {
  /** 日时计算坐标；真太阳时模式下表示校正后的当地钟表时间。 */
  normalizedDate: Date;
  /** 出生真实瞬时点，用于节气与天文事件定位。 */
  referenceDate: Date;
  /** 四柱计算基准日期（真太阳时模式下为经度修正后的时刻） */
  calculationParts: CivilDateTimeParts;
  /** 本次计算应使用的当地 UTC 偏移（分钟），与 normalizedDate 表示同一 civil 时刻 */
  timezoneOffsetMinutes: number;
  /** 依据元数据快照 */
  basis: {
    calendar: string;
    solarTerm: string;
    timeStandard: string;
    timeZoneUsed: string;
    trueSolarOffsetSeconds?: number;
    isDstApplied?: boolean;
    crossesDate?: boolean;
    method: 'zhuanpan' | 'feipan';
    juMethod: 'chaibu' | 'zhirun';
    stagePolicy: QimenStagePolicy;
  };
}

const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:([+-]\d{2}:?\d{2})|Z)?$/;

/**
 * 解析出生日期时间字符串
 */
function parseDateTimeString(dateTimeStr: string): {
  parts: CivilDateTimeParts;
  offsetHours?: number;
} {
  const match = dateTimeStr.trim().match(ISO_DATE_PATTERN);
  if (!match) {
    throw new Error(
      `无效的出生日期时间格式: ${dateTimeStr}，请使用 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss 格式`,
    );
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = match[4] ? parseInt(match[4], 10) : 12; // 未填默认正午
  const minute = match[5] ? parseInt(match[5], 10) : 0;
  const second = match[6] ? parseInt(match[6], 10) : 0;

  let offsetHours: number | undefined;
  if (match[7]) {
    const raw = match[7];
    const sign = raw.startsWith('-') ? -1 : 1;
    const clean = raw.replace(/[+\-:]/g, '');
    const offH = parseInt(clean.slice(0, 2), 10);
    const offM = clean.length >= 4 ? parseInt(clean.slice(2, 4), 10) : 0;
    offsetHours = sign * (offH + offM / 60);
  } else if (match[0].endsWith('Z')) {
    offsetHours = 0;
  }

  return {
    parts: { year, month, day, hour, minute, second },
    offsetHours,
  };
}

/**
 * 标准化奇门终身局时间输入
 */
export function normalizeQimenLifetimeTime(input: QimenLifetimeInput): QimenNormalizedTimeResult {
  if (!input.birthDateTime) {
    throw new Error('奇门终身局排盘必须提供出生时间 birthDateTime');
  }

  const { parts: parsedParts, offsetHours: stringOffset } = parseDateTimeString(
    input.birthDateTime,
  );

  // 1. 处理历法类型（农历需先转换为公历）
  let solarParts: SolarDateTimeParts;
  const calendarType = input.calendarType ?? 'solar';
  if (calendarType === 'lunar') {
    solarParts = resolveBirthCalendarClockTime({
      dateType: 'lunar',
      year: parsedParts.year,
      month: parsedParts.month,
      day: parsedParts.day,
      hour: parsedParts.hour,
      minute: parsedParts.minute,
      second: parsedParts.second,
      isLeapMonth: input.isLeapMonth ?? false,
    });
  } else {
    solarParts = { ...parsedParts };
  }

  // 2. 确定时区
  const timeZoneId = input.timeZoneId;
  const timezone =
    input.timezone ?? stringOffset ?? (timeZoneId ? undefined : DEFAULT_CHINA_TIMEZONE_HOURS);

  // 3. 处理时间标准（真太阳时 vs 民用时间）
  const timeStandard = input.timeStandard ?? 'civil';
  let calculationParts: CivilDateTimeParts;
  let trueSolarOffsetSeconds: number | undefined;
  let isDstApplied: boolean | undefined;
  let crossesDate: boolean | undefined;

  let normalizedDate: Date;
  let referenceDate: Date | undefined;
  let effectiveTimezone: number;

  if (timeStandard === 'trueSolar') {
    if (!input.location || typeof input.location.longitude !== 'number') {
      throw new Error('启用真太阳时必须提供出生地经度 location.longitude');
    }

    const clockDateTimeStr = formatSolarDateTimeParts(solarParts);
    const tstResult = convertTrueSolarTime({
      localDateTime: clockDateTimeStr,
      longitude: input.location.longitude,
      timezone,
      timeZoneId,
      applyChinaDst: input.applyChinaDst,
    });

    calculationParts = { ...tstResult.correctedTime };
    trueSolarOffsetSeconds = Math.round(tstResult.totalCorrectionMinutes * 60);
    isDstApplied = tstResult.chinaDst.applied;
    crossesDate = tstResult.crossesDate;
    effectiveTimezone = tstResult.timezone;
    referenceDate = new Date(
      resolveCivilTime(
        { ...tstResult.standardTime, timezone: tstResult.timezone },
        { defaultTimezone: DEFAULT_CHINA_TIMEZONE_HOURS },
      ).utcTimestamp,
    );

    // 太阳时钟表不再应用民用时区的跳时/回拨规则，沿用出生时已解析的偏移。
    const resolvedCivil = resolveCivilTime(
      {
        ...calculationParts,
        timezone: tstResult.timezone,
      },
      { defaultTimezone: DEFAULT_CHINA_TIMEZONE_HOURS },
    );
    normalizedDate = new Date(resolvedCivil.utcTimestamp);
  } else {
    // 民用时间模式
    calculationParts = { ...solarParts };
    const resolvedCivil = resolveCivilTime(
      {
        ...calculationParts,
        timezone,
        timeZoneId,
      },
      { defaultTimezone: DEFAULT_CHINA_TIMEZONE_HOURS },
    );
    effectiveTimezone = resolvedCivil.timezone;
    normalizedDate = new Date(resolvedCivil.utcTimestamp);
  }

  // 4. 提取当令节气
  const termParts = getCivilDateTimeAtFixedOffset(
    referenceDate ?? normalizedDate,
    DEFAULT_CHINA_TIMEZONE_HOURS,
  );
  const solarTermName = SolarTime.fromYmdHms(
    termParts.year,
    termParts.month,
    termParts.day,
    termParts.hour,
    termParts.minute,
    termParts.second,
  )
    .getTerm()
    .getName();

  // 5. 默认阶段策略
  const stagePolicy: QimenStagePolicy = {
    model: input.stagePolicy?.model ?? 'pillarFourLimits',
    anchorRule: input.stagePolicy?.anchorRule ?? 'birthInstant',
    ageSystem: input.stagePolicy?.ageSystem ?? 'fullYears',
    yearsPerStage: input.stagePolicy?.yearsPerStage ?? 15,
  };

  const basis = {
    calendar:
      calendarType === 'lunar'
        ? `农历 (${input.isLeapMonth ? '闰' : ''}${parsedParts.month}月)`
        : '公历',
    solarTerm: solarTermName,
    timeStandard: timeStandard === 'trueSolar' ? '真太阳时' : '法定民用时',
    timeZoneUsed: timeZoneId
      ? `${timeZoneId} (UTC${effectiveTimezone >= 0 ? '+' : ''}${effectiveTimezone})`
      : `UTC${effectiveTimezone >= 0 ? '+' : ''}${effectiveTimezone}`,
    trueSolarOffsetSeconds,
    isDstApplied,
    crossesDate,
    method: input.method ?? 'zhuanpan',
    juMethod: input.juMethod ?? 'chaibu',
    stagePolicy,
  };

  return {
    normalizedDate,
    referenceDate: referenceDate ?? normalizedDate,
    calculationParts,
    timezoneOffsetMinutes: effectiveTimezone * 60,
    basis,
  };
}
