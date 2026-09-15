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
 * 将真太阳时输入的标准当地钟表时间还原为真实瞬时，再投影到 UTC+8 历表。
 * 经度时差与均时差只用于当地日时柱，不参与节气瞬时的移动。
 */
export function getTermSolarTime(
  pillarSolarTime: SolarTimeInstance,
  timing?: TimingInfo,
): SolarTimeInstance {
  if (!timing?.enabled) return pillarSolarTime;

  // TimingInfo.standardTime 对外保留用户输入的当地钟表字段。固定 UTC+8
  // 的中国历史夏令时只在此处按上游记录的 -60 分钟还原一次；IANA 输入不
  // 会设置 dstCorrectionMinutes，交给 resolveCivilTime 按历史偏移解析。
  const standardTime =
    !timing.timeZoneId && timing.dstCorrectionMinutes
      ? shiftCivilTime(timing.standardTime, timing.dstCorrectionMinutes)
      : timing.standardTime;
  const resolved = resolveCivilTime({
    ...standardTime,
    timezone: timing.timezone,
    ...(timing.timeZoneId ? { timeZoneId: timing.timeZoneId } : {}),
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
