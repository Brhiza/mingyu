import { SolarTime } from 'tyme4ts';
import {
  DEFAULT_CHINA_TIMEZONE_HOURS,
  getCivilDateTimeAtFixedOffset,
  resolveCivilTime,
} from '../calendar/civil-time';
import type { TimingInfo } from './baziTypes';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;

function shiftCivilTime(
  value: TimingInfo['standardTime'],
  offsetMinutes: number,
): TimingInfo['standardTime'] {
  const shifted = new Date(
    Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second),
  );
  shifted.setUTCMinutes(shifted.getUTCMinutes() + offsetMinutes);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/**
 * 将当地钟表时间还原为真实瞬时，再投影到 UTC+8 历表计算节令。
 * 真太阳时的经度与均时差校正只用于当地日时柱，不移动节气瞬时。
 */
export function getTermSolarTime(
  pillarSolarTime: SolarTimeInstance,
  timing?: TimingInfo,
  civilLocation?: { timezone?: number; timeZoneId?: string },
): SolarTimeInstance {
  if (!timing?.enabled && civilLocation?.timezone === undefined && !civilLocation?.timeZoneId) {
    return pillarSolarTime;
  }

  // TimingInfo.standardTime 对外保留用户输入的当地钟表字段。固定 UTC+8
  // 的中国历史夏令时只在此处按上游记录的 -60 分钟还原一次；IANA 输入不
  // 会设置 dstCorrectionMinutes，交给 resolveCivilTime 按历史偏移解析。
  const localClock = {
    year: pillarSolarTime.getYear(),
    month: pillarSolarTime.getMonth(),
    day: pillarSolarTime.getDay(),
    hour: pillarSolarTime.getHour(),
    minute: pillarSolarTime.getMinute(),
    second: pillarSolarTime.getSecond(),
  };
  const standardTime = timing?.enabled
    ? !timing.timeZoneId && timing.dstCorrectionMinutes
      ? shiftCivilTime(timing.standardTime, timing.dstCorrectionMinutes)
      : timing.standardTime
    : localClock;
  const resolved = resolveCivilTime({
    ...standardTime,
    timezone: timing?.enabled ? timing.timezone : civilLocation?.timezone,
    ...(timing?.enabled && timing.timeZoneId
      ? { timeZoneId: timing.timeZoneId }
      : civilLocation?.timeZoneId
        ? { timeZoneId: civilLocation.timeZoneId }
        : {}),
  });
  const chinaTime = getCivilDateTimeAtFixedOffset(
    new Date(resolved.utcTimestamp),
    DEFAULT_CHINA_TIMEZONE_HOURS,
  );

  return SolarTime.fromYmdHms(
    chinaTime.year,
    chinaTime.month,
    chinaTime.day,
    chinaTime.hour,
    chinaTime.minute,
    chinaTime.second,
  );
}
