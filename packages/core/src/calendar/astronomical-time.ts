/**
 * @file 天文时间尺度证据
 * @description 将当地钟表时间统一换算为 UTC、儒略日和近似 TT，明确记录 ΔT 模型与限制。
 */

import { daysInGregorianMonth } from './date-validation';
import { resolveHistoricalTimezone, type HistoricalTimezoneEvidence } from './historical-timezone';

export interface AstronomicalTimeInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  timezone?: number;
  timeZoneId?: string;
}

export interface AstronomicalTimeEvidence {
  localDateTime: string;
  timezone: number;
  timeZoneId?: string;
  timezoneEvidence?: HistoricalTimezoneEvidence;
  utcDateTime: string;
  unixMilliseconds: number;
  julianDayUtc: number;
  julianDayUtApprox: number;
  deltaTSeconds: number;
  julianDayTtApprox: number;
  decimalYear: number;
  deltaTModel: string;
  precisionLevel: '历史拟合' | '近现代估算' | '长期外推';
  assumptions: string[];
  limitations: string[];
  source: string;
  promptText: string;
}

function assertIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需为 ${min}-${max} 之间的整数。`);
  }
}

function formatDateTime(
  value: Required<
    Pick<AstronomicalTimeInput, 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'>
  >,
) {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')} ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}:${String(value.second).padStart(2, '0')}`;
}

function decimalYearFromUtc(date: Date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

/**
 * NASA/Espenak-Meeus 公布的分段多项式，限定项目当前支持的 1900-2200 年。
 * 返回 TT-UT1 的估计秒数，不应解释为观测 DUT1。
 */
export function estimateDeltaTSeconds(decimalYear: number) {
  if (!Number.isFinite(decimalYear) || decimalYear < 1900 || decimalYear > 2200) {
    throw new Error('ΔT 估算年份需在 1900-2200 之间。');
  }
  let value: number;
  if (decimalYear < 1920) {
    const t = decimalYear - 1900;
    value = -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  } else if (decimalYear < 1941) {
    const t = decimalYear - 1920;
    value = 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  } else if (decimalYear < 1961) {
    const t = decimalYear - 1950;
    value = 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  } else if (decimalYear < 1986) {
    const t = decimalYear - 1975;
    value = 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  } else if (decimalYear < 2005) {
    const t = decimalYear - 2000;
    value =
      63.86 +
      0.3345 * t -
      0.060374 * t ** 2 +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5;
  } else if (decimalYear < 2050) {
    const t = decimalYear - 2000;
    value = 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  } else if (decimalYear < 2150) {
    value = -20 + 32 * ((decimalYear - 1820) / 100) ** 2 - 0.5628 * (2150 - decimalYear);
  } else {
    const u = (decimalYear - 1820) / 100;
    value = -20 + 32 * u ** 2;
  }
  return Number(value.toFixed(3));
}

export function buildAstronomicalTimeEvidence(
  input: AstronomicalTimeInput,
): AstronomicalTimeEvidence {
  const maxDay = daysInGregorianMonth(input.year, input.month);
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > maxDay) {
    throw new Error(`${input.year}年${input.month}月不存在第${input.day}日。`);
  }
  if (input.year < 1900 || input.year > 2200) {
    throw new Error('天文时间尺度证据当前支持 1900-2200 年。');
  }
  const hour = input.hour ?? 0;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  assertIntegerInRange(hour, 0, 23, '小时');
  assertIntegerInRange(minute, 0, 59, '分钟');
  assertIntegerInRange(second, 0, 59, '秒');
  if (
    input.timezone !== undefined &&
    (!Number.isFinite(input.timezone) || input.timezone < -14 || input.timezone > 14)
  ) {
    throw new Error('时区需在 UTC-14 到 UTC+14 之间。');
  }
  if (input.timezone === undefined && !input.timeZoneId) {
    throw new Error('timezone 与 timeZoneId 至少需要提供一项。');
  }

  const localTimestamp = Date.UTC(input.year, input.month - 1, input.day, hour, minute, second);
  const timezoneEvidence = input.timeZoneId
    ? resolveHistoricalTimezone({
        year: input.year,
        month: input.month,
        day: input.day,
        hour,
        minute,
        second,
        timeZoneId: input.timeZoneId,
        fixedOffsetHours: input.timezone,
      })
    : undefined;
  const timezone = timezoneEvidence?.resolvedOffsetHours ?? input.timezone!;
  const utcTimestamp =
    timezoneEvidence?.selectedUtcTimestamp ?? localTimestamp - timezone * 3600000;
  const utcDate = new Date(utcTimestamp);
  const decimalYear = decimalYearFromUtc(utcDate);
  const deltaTSeconds = estimateDeltaTSeconds(decimalYear);
  const julianDayUtc = utcTimestamp / 86400000 + 2440587.5;
  // 未提供实时 DUT1 时只能以 UTC 近似 UT1；两者通常相差不超过 0.9 秒。
  const julianDayUtApprox = julianDayUtc;
  const julianDayTtApprox = julianDayUtApprox + deltaTSeconds / 86400;
  const precisionLevel =
    decimalYear < 2005 ? '历史拟合' : decimalYear < 2050 ? '近现代估算' : '长期外推';
  const utcParts = {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    hour: utcDate.getUTCHours(),
    minute: utcDate.getUTCMinutes(),
    second: utcDate.getUTCSeconds(),
  };
  const localDateTime = formatDateTime({
    year: input.year,
    month: input.month,
    day: input.day,
    hour,
    minute,
    second,
  });
  const utcDateTime = `${formatDateTime(utcParts)}Z`;
  const assumptions = [
    timezoneEvidence
      ? `IANA 时区 ${timezoneEvidence.timeZoneId} 解析出历史偏移 UTC${timezone >= 0 ? '+' : ''}${timezone}。`
      : '输入 timezone 视为该时刻已经确认的法定 UTC 偏移，不自动推断地点历史时区。',
    '缺少实时 DUT1 数据时使用 UT1≈UTC，误差上限通常小于 0.9 秒。',
  ];
  const limitations = [
    'ΔT 是分段多项式估计值，不是逐日观测值；未来年份的不确定性会逐渐增大。',
    'TT 儒略日用于说明天文计算时间尺度，不代表底层依赖库一定采用同一星历或同一时间模型。',
  ];
  const source = 'UTC 儒略日采用 Unix 纪元换算；ΔT 采用 NASA/Espenak-Meeus 1900-2200 分段多项式';

  return {
    localDateTime,
    timezone,
    timeZoneId: input.timeZoneId,
    timezoneEvidence,
    utcDateTime,
    unixMilliseconds: utcTimestamp,
    julianDayUtc: Number(julianDayUtc.toFixed(9)),
    julianDayUtApprox: Number(julianDayUtApprox.toFixed(9)),
    deltaTSeconds,
    julianDayTtApprox: Number(julianDayTtApprox.toFixed(9)),
    decimalYear: Number(decimalYear.toFixed(6)),
    deltaTModel: 'Espenak-Meeus 分段多项式（1900-2200）',
    precisionLevel,
    assumptions,
    limitations,
    source,
    promptText: `天文时间尺度：当地钟表时间${localDateTime}（${input.timeZoneId ? `${input.timeZoneId}，` : ''}UTC${timezone >= 0 ? '+' : ''}${timezone}）→ UTC ${utcDateTime}；JD(UTC)=${julianDayUtc.toFixed(6)}，在 UT1≈UTC 假设下 JD(UT)≈${julianDayUtApprox.toFixed(6)}；ΔT≈${deltaTSeconds.toFixed(3)}秒，JD(TT)≈${julianDayTtApprox.toFixed(6)}。模型等级：${precisionLevel}。${timezoneEvidence ? `历史时区诊断：${timezoneEvidence.diagnostics.join('；')}。` : ''}来源：${source}。限制：${[...assumptions, ...limitations].join('；')}`,
  };
}
