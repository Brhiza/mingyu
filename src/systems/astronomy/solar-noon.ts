import { Astronomy } from './engine';
import { createTimezoneOffsetReader, formatCivilDateTime, getCivilDateTimeAtFixedOffset } from '../huangji/civil-time';

/** 太阳上中天时角为零；民用重历日可有多个正午。 */
export function solarNoons(start: number, end: number, latitude: number, longitude: number, timezone: number, timeZoneId?: string) {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const offsetAt = timeZoneId ? createTimezoneOffsetReader(timeZoneId) : () => timezone;
  const events: Array<{ utcTimestamp: number; utcDateTime: string; localDateTime: string; timezone: number }> = [];
  for (let cursor = start; cursor < end;) {
    const instant = Astronomy.SearchHourAngle(Astronomy.Body.Sun, observer, 0, new Date(cursor), 1).time.date.getTime();
    if (instant >= end) break;
    if (instant < cursor) throw new Error('太阳正午搜索未按真实瞬时递增。');
    const offset = offsetAt(instant);
    events.push({ utcTimestamp: instant, utcDateTime: new Date(instant).toISOString(), timezone: offset,
      localDateTime: formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(instant), offset)) });
    cursor = instant + 1000;
    if (events.length > 16) throw new Error('太阳正午数量异常。');
  }
  return events;
}
