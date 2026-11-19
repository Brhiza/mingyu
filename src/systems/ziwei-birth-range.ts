import type { z } from 'zod';
import { lunarToCivilDate } from './birth-time';
import type { ziweiIndependentInput } from '../schema';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset, resolveCivilDayWindow } from './huangji/civil-time';

type Birth = z.infer<typeof ziweiIndependentInput>['birth'];
type Clock = ReturnType<typeof getCivilDateTimeAtFixedOffset>;
const dateKey = (value: Pick<Clock, 'year' | 'month' | 'day'>) => `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
const timeIndex = (hour: number) => hour === 23 ? 12 : Math.floor((hour + 1) / 2);

/** 将指定当地日或民用时辰按时区、排盘日期及时辰分成半开整秒区间。 */
export async function ziweiBirthSegments(birth: Birth) {
  if (birth.clock.kind === 'exact') throw new Error('精确出生不需要时段候选。');
  if ((birth.calendar ?? 'solar') !== 'lunar' && birth.leapMonth !== undefined) throw new Error('只有农历可指定闰月。');
  let day = { year: birth.year, month: birth.month, day: birth.day };
  if (birth.calendar === 'lunar') {
    day = lunarToCivilDate(birth.year, birth.month, birth.day, birth.leapMonth);
  }
  const zone = birth.timeZoneId?.trim();
  if (birth.timeZoneId !== undefined && !zone) throw new Error('IANA 时区名不能为空。');
  const fixed = birth.timezone ?? 8;
  if (!Number.isInteger(fixed * 60)) throw new Error('当前排盘仅支持整分钟 UTC 偏移。');
  const window = resolveCivilDayWindow({ ...day, ...(zone ? { timeZoneId: zone } : { timezone: fixed }) });
  if (window.endUtcMs - window.startUtcMs > 49 * 3_600_000) throw new Error('无法确定当地出生日期的完整时间范围。');
  const readOffset = zone ? createTimezoneOffsetReader(zone) : () => fixed;
  const solarTime = birth.timeStandard === 'true-solar' ? (await import('./astronomy/true-solar')).trueSolarTime : undefined;
  const startHour = birth.clock.kind === 'shichen' && birth.clock.index !== 0 ? 2 * birth.clock.index - 1 : 0;
  const endHour = birth.clock.kind !== 'shichen' || birth.clock.index === 12 ? 24 : birth.clock.index === 0 ? 1 : startHour + 2;
  const expectedDay = dateKey(day);
  const at = (timestamp: number) => {
    const offset = readOffset(timestamp);
    if (!Number.isInteger(offset * 60) || offset < -12 || offset > 14) throw new Error('当前排盘仅支持 UTC-12 至 UTC+14 的整分钟偏移。');
    const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), offset);
    if (dateKey(local) !== expectedDay || local.hour < startHour || local.hour >= endHour || (zone && birth.timezone !== undefined && offset !== birth.timezone)) return { key: 'excluded', offset, local };
    const adjusted = solarTime ? solarTime(new Date(timestamp), birth.longitude!).effectiveTimestamp + (480 - offset * 60) * 60_000 : timestamp;
    const corrected = getCivilDateTimeAtFixedOffset(new Date(adjusted), offset);
    return { key: `${offset}:${dateKey(corrected)}:${timeIndex(corrected.hour)}`, offset, local, corrected };
  };
  type Segment = { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: number; localStart: Clock; correctedStart: Clock };
  const segments: Segment[] = [];
  let excludedSeconds = 0, segmentStart = window.startUtcMs, state = at(window.startUtcMs);
  const close = (boundary: number) => {
    if (state.corrected) segments.push({ startTimestamp: segmentStart, endTimestamp: boundary, endExclusive: true, timezone: state.offset, localStart: state.local, correctedStart: state.corrected });
    else excludedSeconds += (boundary - segmentStart) / 1000;
  };
  for (let probe = Math.min(window.startUtcMs + 60_000, window.endUtcMs - 1000); ; probe = Math.min(probe + 60_000, window.endUtcMs - 1000)) {
    let next = at(probe);
    while (next.key !== state.key) {
      let left = segmentStart / 1000, right = probe / 1000;
      while (right - left > 1) {
        const middle = Math.floor((left + right) / 2);
        if (at(middle * 1000).key === state.key) left = middle; else right = middle;
      }
      const boundary = right * 1000;
      close(boundary); segmentStart = boundary; state = at(boundary); next = at(probe);
    }
    if (probe === window.endUtcMs - 1000) break;
  }
  close(window.endUtcMs);
  if (!segments.length) throw new Error('指定当地日、时辰或时区偏移没有有效候选时刻。');
  return { source: { solarDate: expectedDay, startTimestamp: window.startUtcMs, endTimestamp: window.endUtcMs, endExclusive: true as const,
    ...(birth.clock.kind === 'shichen' ? { shichen: { index: birth.clock.index, startHour, endHour, clock: 'civil' as const } } : {}),
    ...(zone ? { timeZoneId: zone } : { timezone: fixed }), ...(zone && birth.timezone !== undefined ? { requiredTimezone: birth.timezone } : {}), excludedSeconds }, segments };
}
