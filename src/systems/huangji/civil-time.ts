// Resolve fixed offsets and IANA wall-clock times without retaining timezone diagnostic scaffolding.
export interface CivilDateTimeParts { year: number; month: number; day: number; hour: number; minute: number; second: number }
export interface CivilTimeZoneInput { timezone?: number; timeZoneId?: string }
type CivilInput = CivilDateTimeParts & CivilTimeZoneInput;
const pad = (value: number) => String(value).padStart(2, '0');

export function createUtcTimestamp(year: number, monthIndex: number, day = 1, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}
export function assertFixedTimezoneHours(value: number, label = 'timezone') {
  if (!Number.isFinite(value) || value < -12 || value > 14) throw new Error(`${label} 需在 UTC-12 到 UTC+14 之间。`);
}
export function formatFixedTimezoneOffset(value: number) {
  assertFixedTimezoneHours(value);
  const total = Math.round(Math.abs(value) * 3600), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return `${value >= 0 ? '+' : '-'}${pad(hours)}:${pad(minutes)}${seconds ? `:${pad(seconds)}` : ''}`;
}
export function formatCivilDateTime(value: CivilDateTimeParts) {
  return `${String(value.year).padStart(4, '0')}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}`;
}
function validate(value: CivilDateTimeParts) {
  if (!Number.isInteger(value.year) || value.year < 1 || value.year > 9999) throw new Error('公历年份需在 1-9999 之间。');
  if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12) throw new Error('月份需在 1-12 之间。');
  const leap = value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0);
  const max = value.month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(value.month) ? 30 : 31;
  if (!Number.isInteger(value.day) || value.day < 1 || value.day > max) throw new Error(`${value.year}年${value.month}月不存在第${value.day}日。`);
  if (![value.hour, value.minute, value.second].every(Number.isInteger) || value.hour < 0 || value.hour > 23 || value.minute < 0 || value.minute > 59 || value.second < 0 || value.second > 59) throw new Error('当地钟表时间需使用有效的 24 小时时分秒。');
}
function formatter(timeZoneId: string) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: timeZoneId, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { throw new RangeError(`无法识别 IANA 时区 ${timeZoneId}。`); }
}
function partsAt(format: Intl.DateTimeFormat, timestamp: number): CivilDateTimeParts {
  const parts = Object.fromEntries(format.formatToParts(new Date(timestamp)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}
function timestamp(value: CivilDateTimeParts) { return createUtcTimestamp(value.year, value.month - 1, value.day, value.hour, value.minute, value.second); }
function offsetAt(format: Intl.DateTimeFormat, value: number) { return (timestamp(partsAt(format, value)) - Math.floor(value / 1000) * 1000) / 3_600_000; }
/** 对同一时区的多个瞬时复用格式器；返回小时为单位的历史偏移。 */
export function createTimezoneOffsetReader(timeZoneId: string) {
  if (!timeZoneId?.trim()) throw new Error('IANA 时区名不能为空。');
  const format = formatter(timeZoneId.trim());
  return (instant: number) => {
    if (!Number.isFinite(instant) || Number.isNaN(new Date(instant).getTime())) throw new Error('历史时区参考时间不是有效日期。');
    return offsetAt(format, instant);
  };
}
function candidates(value: CivilDateTimeParts, format: Intl.DateTimeFormat) {
  const wall = timestamp(value), offsets = new Set<number>();
  for (let hour = -36; hour <= 36; hour++) offsets.add(offsetAt(format, wall + hour * 3_600_000));
  return [...offsets].map((offset) => ({ offset, timestamp: wall - offset * 3_600_000 }))
    .filter((item) => timestamp(partsAt(format, item.timestamp)) === wall)
    .sort((a, b) => a.timestamp - b.timestamp);
}
export function getHistoricalTimezoneOffsetAt(date: Date, timeZoneId: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('历史时区参考时间不是有效日期。');
  if (!timeZoneId?.trim()) throw new Error('IANA 时区名不能为空。');
  return createTimezoneOffsetReader(timeZoneId)(date.getTime());
}
export function getCivilDateTimeAtFixedOffset(date: Date, timezone = 8): CivilDateTimeParts {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('参考时间不是有效日期。');
  assertFixedTimezoneHours(timezone);
  const shifted = new Date(date.getTime() + timezone * 3_600_000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds() };
}
export function resolveCivilTime(input: CivilInput) {
  const localTime = { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute, second: input.second };
  validate(localTime);
  if (input.timezone !== undefined) assertFixedTimezoneHours(input.timezone);
  const timeZoneId = input.timeZoneId?.trim();
  if (input.timeZoneId !== undefined && !timeZoneId) throw new Error('IANA 时区名不能为空。');
  let timezone = input.timezone, utcTimestamp: number;
  if (timeZoneId) {
    const matches = candidates(localTime, formatter(timeZoneId));
    if (!matches.length) throw new Error(`${timeZoneId} 的当地钟表时间 ${formatCivilDateTime(localTime)} 不存在，通常由夏令时跳时造成。`);
    if (matches.length > 1 && timezone === undefined) throw new Error(`${timeZoneId} 的当地钟表时间 ${formatCivilDateTime(localTime)} 存在夏令时回拨歧义，请同时提供与原始记录一致的 timezone 固定偏移。`);
    const selected = timezone === undefined ? matches[0] : matches.find((item) => Math.abs(item.offset - timezone!) <= 1e-6);
    if (!selected) throw new Error(`timezone 固定偏移 UTC${formatFixedTimezoneOffset(timezone!)} 与 ${timeZoneId} 在该当地时刻的历史偏移不一致。`);
    timezone = selected.offset;
    utcTimestamp = selected.timestamp;
  } else {
    if (timezone === undefined) throw new Error('timezone 与 timeZoneId 至少需要提供一项。');
    utcTimestamp = timestamp(localTime) - timezone * 3_600_000;
  }
  return { localTime, localDateTime: formatCivilDateTime(localTime), timezone, ...(timeZoneId ? { timeZoneId } : {}), utcTimestamp, utcDateTime: new Date(utcTimestamp).toISOString() };
}
export function resolveCivilDayStart(input: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'> & CivilTimeZoneInput) {
  const midnight = { year: input.year, month: input.month, day: input.day, hour: 0, minute: 0, second: 0 };
  validate(midnight);
  const timeZoneId = input.timeZoneId?.trim();
  if (!timeZoneId) return resolveCivilTime({ ...midnight, timezone: input.timezone });
  const format = formatter(timeZoneId), matches = candidates(midnight, format);
  if (matches.length) return resolveCivilTime({ ...midnight, timeZoneId, timezone: input.timezone ?? matches[0].offset });
  const key = (value: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'>) => value.year * 10000 + value.month * 100 + value.day;
  const target = key(midnight), wall = timestamp(midnight);
  let before = wall - 36 * 3_600_000, after = wall + 36 * 3_600_000;
  while (after - before > 1000) {
    const middle = before + Math.floor((after - before) / 2000) * 1000;
    if (key(partsAt(format, middle)) < target) before = middle; else after = middle;
  }
  const localTime = partsAt(format, after);
  if (key(localTime) !== target) throw new Error(`${timeZoneId} 的当地公历日 ${input.year}-${pad(input.month)}-${pad(input.day)} 整日不存在。`);
  return resolveCivilTime({ ...localTime, timeZoneId, timezone: input.timezone ?? offsetAt(format, after) });
}

/** 完整当地民用日的半开范围；跳过时区变更造成的整日缺失。 */
export function resolveCivilDayWindow(input: Pick<CivilDateTimeParts, 'year' | 'month' | 'day'> & CivilTimeZoneInput) {
  const zone = input.timeZoneId ? { timeZoneId: input.timeZoneId } : { timezone: input.timezone };
  const startUtcMs = resolveCivilDayStart({ year: input.year, month: input.month, day: input.day, ...zone }).utcTimestamp;
  for (let delta = 1; delta <= 3; delta++) {
    const date = new Date(createUtcTimestamp(input.year, input.month - 1, input.day + delta));
    try {
      const endUtcMs = resolveCivilDayStart({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), ...zone }).utcTimestamp;
      if (endUtcMs <= startUtcMs) throw new Error('当地日期终点必须晚于起点。');
      return { startUtcMs, endUtcMs, endExclusive: true as const };
    } catch (error) { if (!(error instanceof Error) || !error.message.includes('整日不存在')) throw error; }
  }
  throw new Error('无法确定当地民用日的终点。');
}
