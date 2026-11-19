import { SolarTerm } from 'tyme4ts';
import type { z } from 'zod';
import type { qizhengInput } from '../../schema';
import { createTimezoneOffsetReader, createUtcTimestamp, formatCivilDateTime, getCivilDateTimeAtFixedOffset, resolveCivilDayStart, resolveCivilDayWindow, resolveCivilTime } from '../huangji/civil-time';

type Input = z.infer<typeof qizhengInput>;
type Flow = NonNullable<Input['flow']>;
const lichun = (year: number) => {
  const term = SolarTerm.fromIndex(year, 3).getJulianDay().getSolarTime();
  return createUtcTimestamp(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond());
};

/** 流曜使用目标日期的时区偏移；出生时用于夏令时消歧的偏移不沿用到流年。 */
export function resolveFlowTime(flow: Flow, birth: Input['birth']) {
  const zone = birth.timeZoneId, offsetAt = zone ? createTimezoneOffsetReader(zone) : () => birth.timezone!;
  let timestamp: number, flowYear: number, note: string;
  if (flow.kind === 'year') {
    timestamp = lichun(flow.year);
    flowYear = flow.year; note = '年度流曜取立春交节瞬时；不代表整年。';
  } else if (flow.kind === 'instant') {
    timestamp = Date.parse(flow.at);
    const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), offsetAt(timestamp));
    if (local.year < 1900 || local.year > 2200) throw new Error('流曜当地年份须在 1900 至 2200 之间。');
    flowYear = local.year; note = '流曜取指定瞬时；不代表整日或整个周期。';
  } else {
    const clock = flow.kind === 'day' ? flow.clock : undefined;
    const time = resolveCivilTime({ year: flow.year, month: flow.month, day: flow.kind === 'day' ? flow.day : 15,
      hour: clock?.hour ?? 12, minute: clock?.minute ?? 0, second: clock?.second ?? 0,
      ...(zone ? { timeZoneId: zone, ...(flow.kind === 'day' && flow.timezone !== undefined ? { timezone: flow.timezone } : {}) } : { timezone: birth.timezone }) });
    timestamp = time.utcTimestamp; flowYear = flow.year;
    note = flow.kind === 'month' ? '月度流曜取当地 15 日正午；不代表整月。' : clock ? '日度流曜取指定当地时刻；不代表整日。' : '日度流曜取当地正午；不代表整日。';
  }
  const timezone = offsetAt(timestamp);
  if (!Number.isInteger(timezone * 60)) throw new Error('流曜仅支持整分钟 UTC 偏移。');
  const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
  return { kind: flow.kind, flowYear, timestamp, utcDateTime: new Date(timestamp).toISOString(), localDateTime: formatCivilDateTime(local), timezone, note };
}

/** 年度按立春，月度与日度按当地公历边界；均为左闭右开区间。 */
export function resolveFlowWindow(flow: Flow, birth: Input['birth'], target: ReturnType<typeof resolveFlowTime>) {
  if (flow.kind === 'year') return { mode: 'yearly' as const, startUtcMs: lichun(flow.year), endUtcMs: lichun(flow.year + 1) };
  const zone = birth.timeZoneId ? { timeZoneId: birth.timeZoneId } : { timezone: birth.timezone };
  const local = getCivilDateTimeAtFixedOffset(new Date(target.timestamp), target.timezone);
  const startOfExistingDay = (year: number, month: number, day: number) => {
    for (let offset = 0; offset <= 3; offset++) {
      const date = new Date(createUtcTimestamp(year, month - 1, day + offset));
      try { return resolveCivilDayStart({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), ...zone }).utcTimestamp; }
      catch (error) { if (!(error instanceof Error) || !error.message.includes('整日不存在')) throw error; }
    }
    throw new Error('无法确定流曜周期的当地日期边界。');
  };
  if (flow.kind === 'month') return { mode: 'monthly' as const, startUtcMs: startOfExistingDay(flow.year, flow.month, 1), endUtcMs: startOfExistingDay(flow.year, flow.month + 1, 1) };
  const window = resolveCivilDayWindow({ year: local.year, month: local.month, day: local.day, ...zone });
  return { mode: 'daily' as const, startUtcMs: window.startUtcMs, endUtcMs: window.endUtcMs };
}
