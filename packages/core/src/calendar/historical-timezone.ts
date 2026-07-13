/**
 * @file IANA 历史时区解析
 * @description 通过运行环境 Intl/IANA 数据库解析当地钟表时刻的历史 UTC 偏移，并识别 DST 歧义与缺失时刻。
 */

export interface HistoricalTimezoneInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZoneId: string;
  fixedOffsetHours?: number;
}

export interface HistoricalTimezoneEvidence {
  timeZoneId: string;
  database: string;
  status: 'unique' | 'ambiguous';
  selectedUtcTimestamp: number;
  selectedUtcDateTime: string;
  resolvedOffsetHours: number;
  possibleUtcDateTimes: string[];
  possibleOffsetsHours: number[];
  fixedOffsetHours?: number;
  offsetConflict: boolean;
  diagnostics: string[];
  source: string;
}

type WallClockParts = Omit<HistoricalTimezoneInput, 'timeZoneId' | 'fixedOffsetHours'>;

function getFormatter(timeZoneId: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZoneId,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    throw new Error(`无法识别 IANA 时区 ${timeZoneId}。`);
  }
}

function partsAt(formatter: Intl.DateTimeFormat, timestamp: number): WallClockParts {
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((item) => item.type !== 'literal')
      .map((item) => [item.type, Number(item.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function sameParts(first: WallClockParts, second: WallClockParts) {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day &&
    first.hour === second.hour &&
    first.minute === second.minute &&
    first.second === second.second
  );
}

function offsetHoursAt(formatter: Intl.DateTimeFormat, timestamp: number) {
  const parts = partsAt(formatter, timestamp);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Number(((representedAsUtc - Math.floor(timestamp / 1000) * 1000) / 3600000).toFixed(6));
}

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function resolveHistoricalTimezone(
  input: HistoricalTimezoneInput,
): HistoricalTimezoneEvidence {
  if (!input.timeZoneId?.trim()) throw new Error('IANA 时区名不能为空。');
  const timeZoneId = input.timeZoneId.trim();
  const formatter = getFormatter(timeZoneId);
  const target: WallClockParts = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second,
  };
  const wallTimestamp = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );

  // 在目标时刻前后取样所有可能偏移，再反推 UTC；可同时找到秋季回拨时的两个合法时刻。
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 1) {
    offsets.add(offsetHoursAt(formatter, wallTimestamp + hours * 3600000));
  }
  const matches = [...offsets]
    .map((offset) => ({ timestamp: wallTimestamp - offset * 3600000, offset }))
    .filter((candidate) => sameParts(partsAt(formatter, candidate.timestamp), target))
    .sort((first, second) => first.timestamp - second.timestamp);

  if (!matches.length) {
    throw new Error(
      `${timeZoneId} 的当地钟表时间 ${input.year}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')} ${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}:${String(input.second).padStart(2, '0')} 不存在，通常由夏令时跳时造成。`,
    );
  }

  const selected = matches[0];
  const fixedOffsetHours = input.fixedOffsetHours;
  const offsetConflict =
    fixedOffsetHours !== undefined && Math.abs(fixedOffsetHours - selected.offset) > 1e-6;
  const diagnostics = [
    matches.length > 1
      ? `该当地时刻因夏令时回拨对应 ${matches.length} 个 UTC 时刻；默认选择较早的 ${toIso(selected.timestamp)}，调用方应结合出生记录确认。`
      : '该当地时刻在当前 IANA 时区数据库中只有一个 UTC 对应时刻。',
  ];
  if (offsetConflict) {
    diagnostics.push(
      `输入固定偏移 UTC${fixedOffsetHours! >= 0 ? '+' : ''}${fixedOffsetHours} 与 IANA 历史偏移 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset} 不一致。`,
    );
  }

  return {
    timeZoneId,
    database: '运行环境 Intl.DateTimeFormat 所带 IANA Time Zone Database',
    status: matches.length > 1 ? 'ambiguous' : 'unique',
    selectedUtcTimestamp: selected.timestamp,
    selectedUtcDateTime: toIso(selected.timestamp),
    resolvedOffsetHours: selected.offset,
    possibleUtcDateTimes: matches.map((item) => toIso(item.timestamp)),
    possibleOffsetsHours: matches.map((item) => item.offset),
    fixedOffsetHours,
    offsetConflict,
    diagnostics,
    source:
      'IANA 时区规则由运行环境 Intl.DateTimeFormat 解析；不使用按当前时区反推历史的固定偏移假设',
  };
}
