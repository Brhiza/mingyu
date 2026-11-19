import { SolarTerm } from 'tyme4ts';
import { createTimezoneOffsetReader, createUtcTimestamp } from './huangji/civil-time';

const HOUR = 3_600_000, DAY = 24 * HOUR, OFFSET = 8 * HOUR;

export async function divinationBoundaries(start: number, end: number, settings: { timeStandard?: 'beijing' | 'civil' | 'true-solar'; longitude?: number; timezone?: number; timeZoneId?: string }, termOffsetsDays: number[] = [0], clockHours: number[] = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]) {
  const result = new Set([start, end]);
  const add = (value: number) => { if (value > start && value < end) result.add(value); };
  const firstDay = Math.floor((start + OFFSET) / DAY) * DAY - OFFSET;
  const lastDay = Math.floor((end - 1000 + OFFSET) / DAY) * DAY - OFFSET;
  for (let day = firstDay; day <= lastDay; day += DAY) for (const hour of clockHours) add(day + hour * HOUR);
  if (settings.timeStandard === 'civil') {
    const read = settings.timeZoneId ? createTimezoneOffsetReader(settings.timeZoneId) : () => settings.timezone!;
    const offsetAt = (timestamp: number) => {
      const offset = read(timestamp);
      if (!Number.isFinite(offset) || offset < -12 || offset > 14 || Math.abs(offset * 60 - Math.round(offset * 60)) >= 1e-8) throw new Error('地方时区须为 UTC-12 至 UTC+14 的整分钟偏移。');
      return Math.round(offset * 60) * 60_000;
    };
    const transitions = [start];
    let previous = start, offset = offsetAt(start);
    for (let probe = Math.min(start + 60_000, end - 1000); ; probe = Math.min(probe + 60_000, end - 1000)) {
      const nextOffset = offsetAt(probe);
      if (nextOffset !== offset) {
        let low = previous / 1000, high = probe / 1000;
        while (high - low > 1) {
          const mid = Math.floor((low + high) / 2);
          if (offsetAt(mid * 1000) === offset) low = mid; else high = mid;
        }
        const transition = high * 1000;
        transitions.push(transition); add(transition); offset = nextOffset;
      }
      previous = probe;
      if (probe === end - 1000) break;
    }
    transitions.push(end);
    for (let index = 0; index < transitions.length - 1; index++) {
      const from = transitions[index], to = transitions[index + 1], offset = offsetAt(from);
      const first = Math.floor((from + offset) / DAY) * DAY - offset, last = Math.floor((to - 1000 + offset) / DAY) * DAY - offset;
      for (let day = first; day <= last; day += DAY) for (const hour of clockHours) {
        const boundary = day + hour * HOUR;
        if (boundary > from && boundary < to) add(boundary);
      }
    }
  }
  if (settings.timeStandard === 'true-solar') {
    if (settings.longitude === undefined) throw new Error('真太阳时必须提供经度。');
    const { trueSolarTime } = await import('./astronomy/true-solar');
    const effective = (seconds: number) => trueSolarTime(new Date(seconds * 1000), settings.longitude!).effectiveTimestamp;
    const firstSecond = start / 1000, lastSecond = end / 1000 - 1;
    const firstSolar = effective(firstSecond), lastSolar = effective(lastSecond);
    const firstSolarDay = Math.floor((firstSolar + OFFSET) / DAY) * DAY - OFFSET;
    const lastSolarDay = Math.floor((lastSolar + OFFSET) / DAY) * DAY - OFFSET;
    for (let day = firstSolarDay; day <= lastSolarDay; day += DAY) for (const hour of clockHours) {
      const threshold = day + hour * HOUR;
      if (threshold <= firstSolar || threshold > lastSolar) continue;
      // Find the first actual second whose corrected clock reaches the boundary.
      let low = firstSecond, high = lastSecond;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (effective(mid) >= threshold) high = mid; else low = mid;
      }
      add(high * 1000);
    }
  }
  const year = new Date(start + OFFSET).getUTCFullYear();
  for (const termYear of [year, year + 1]) for (let index = termYear === 1 ? 1 : 0; index < (termYear === 10000 ? 1 : 24); index++) {
    const time = SolarTerm.fromIndex(termYear, index).getJulianDay().getSolarTime();
    const instant = createUtcTimestamp(time.getYear(), time.getMonth() - 1, time.getDay(), time.getHour() - 8, time.getMinute(), time.getSecond());
    for (const days of termOffsetsDays) add(instant + days * DAY);
  }
  return [...result].sort((a, b) => a - b);
}

