import { SixtyCycle, SixtyCycleYear, SolarTerm, SolarTime } from 'tyme4ts';
import { assertValidBaziPillarCombination } from '../ganzhi/validation';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;

const CHINA_OFFSET_HOURS = 8;
const SECONDS_PER_HOUR = 60 * 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 24 * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND;
const SUPPORTED_YEAR_MIN = 1900;
const SUPPORTED_YEAR_MAX = 2100;
export const BAZI_REVERSE_DEFAULT_PAGE_SIZE = 24;
export const BAZI_REVERSE_MAX_PAGE_SIZE = 100;

/** 八字反推使用的四柱名称。每个字段都是六十甲子中的一个干支。 */
export interface BaziReversePillars {
  year: string;
  month: string;
  day: string;
  hour: string;
}

/** 反推查询的年份范围，按公历年闭区间解释。 */
export interface BaziReverseOptions {
  startYear?: number;
  endYear?: number;
  /** 候选起始序号；传入 limit 时启用分批返回。 */
  startIndex?: number;
  /** 本批最多返回的候选数；省略时保留历史的完整返回行为。 */
  limit?: number;
}

export interface BaziReverseRequest extends BaziReverseOptions {
  pillars: BaziReversePillars;
}

export interface BaziReverseDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 北京时间墙上时间，格式为 YYYY-MM-DD HH:mm:ss。 */
  text: string;
}

export type BaziReverseBoundaryReason =
  '查询范围开始' | '查询范围结束' | '节气交接' | '子时换日' | '时辰交接';

export interface BaziReverseBoundary {
  at: BaziReverseDateTime;
  reason: BaziReverseBoundaryReason;
}

/**
 * 一个四柱稳定成立的北京时间区间。
 *
 * 起点包含，终点不包含；区间内任一秒按当前口径正向排盘都得到 targetPillars。
 */
export interface BaziReverseCandidate {
  start: BaziReverseDateTime;
  end: BaziReverseDateTime;
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  pillars: BaziReversePillars;
  startBoundary: BaziReverseBoundary;
  endBoundary: BaziReverseBoundary;
}

export interface BaziReverseBatchMetadata {
  startIndex: number;
  limit: number;
  returned: number;
  total: number;
  next?: {
    startIndex: number;
    limit: number;
  };
}

export interface BaziReverseResult {
  pillars: BaziReversePillars;
  startYear: number;
  endYear: number;
  /** 按开始时间排序的所有候选区间。 */
  candidates: BaziReverseCandidate[];
  candidateCount: number;
  /** 仅在请求传入 limit 时提供；next 可原样作为下一批请求参数。 */
  batch?: BaziReverseBatchMetadata;
  policy: {
    timezone: 'Asia/Shanghai';
    offsetHours: 8;
    month: '节气月';
    dayChange: '子时23点换日';
    range: '[start, end)';
    engine: 'tyme4ts';
  };
}

function getCurrentBeijingYear(): number {
  return new Date(
    Date.now() + CHINA_OFFSET_HOURS * 60 * 60 * MILLISECONDS_PER_SECOND,
  ).getUTCFullYear();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateTime(parts: Omit<BaziReverseDateTime, 'text'>): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function toDateTime(time: SolarTimeInstance): BaziReverseDateTime {
  const parts = {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond(),
  };
  return { ...parts, text: formatDateTime(parts) };
}

/** 将北京时间墙上时间转换为固定东八区瞬时点，避免读取运行环境时区。 */
function toBeijingTimestamp(time: SolarTimeInstance): number {
  const date = new Date(0);
  date.setUTCFullYear(time.getYear(), time.getMonth() - 1, time.getDay());
  date.setUTCHours(time.getHour() - CHINA_OFFSET_HOURS, time.getMinute(), time.getSecond(), 0);
  return date.getTime();
}

function fromBeijingTimestamp(timestamp: number): SolarTimeInstance {
  const date = new Date(timestamp + CHINA_OFFSET_HOURS * 60 * 60 * MILLISECONDS_PER_SECOND);
  return SolarTime.fromYmdHms(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
}

function getPillarsFromSolarTime(time: SolarTimeInstance): BaziReversePillars {
  const eightChar = time.getSixtyCycleHour().getEightChar();
  return {
    year: eightChar.getYear().getName(),
    month: eightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
    hour: eightChar.getHour().getName(),
  };
}

function pillarKey(pillars: BaziReversePillars): string {
  return `${pillars.year}|${pillars.month}|${pillars.day}|${pillars.hour}`;
}

function normalizePillarName(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label}必须是六十甲子名称。`);
  }
  const name = value.trim().replace(/\s+/gu, '');
  if (!name) throw new Error(`${label}不能为空。`);
  try {
    return SixtyCycle.fromName(name).getName();
  } catch {
    throw new Error(`${label}“${name}”不是有效的六十甲子名称。`);
  }
}

function normalizePillars(input: BaziReversePillars): BaziReversePillars {
  if (!input || typeof input !== 'object') throw new Error('四柱资料不能为空。');
  const normalized = {
    year: normalizePillarName(input.year, '年柱'),
    month: normalizePillarName(input.month, '月柱'),
    day: normalizePillarName(input.day, '日柱'),
    hour: normalizePillarName(input.hour, '时柱'),
  };
  assertValidBaziPillarCombination(normalized);
  return normalized;
}

function normalizeYear(value: number | undefined, fallback: number, label: string): number {
  const year = value ?? fallback;
  if (!Number.isInteger(year) || year < SUPPORTED_YEAR_MIN || year > SUPPORTED_YEAR_MAX) {
    throw new Error(`${label}需为 ${SUPPORTED_YEAR_MIN}-${SUPPORTED_YEAR_MAX} 的整数。`);
  }
  return year;
}

function normalizeBatchIndex(value: number | undefined): number {
  const startIndex = value ?? 0;
  if (!Number.isSafeInteger(startIndex) || startIndex < 0) {
    throw new Error('startIndex需为大于等于 0 的整数。');
  }
  return startIndex;
}

function normalizeBatchLimit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 1 || value > BAZI_REVERSE_MAX_PAGE_SIZE) {
    throw new Error(`limit需为 1-${BAZI_REVERSE_MAX_PAGE_SIZE} 的整数。`);
  }
  return value;
}

function normalizeRequest(input: BaziReverseRequest): {
  pillars: BaziReversePillars;
  startYear: number;
  endYear: number;
  startIndex: number;
  limit?: number;
} {
  const pillars = normalizePillars(input.pillars);
  const endYear = normalizeYear(input.endYear, getCurrentBeijingYear(), '结束年份');
  const startYear = normalizeYear(input.startYear, SUPPORTED_YEAR_MIN, '开始年份');
  if (startYear > endYear) throw new Error('开始年份不能晚于结束年份。');
  const startIndex = normalizeBatchIndex(input.startIndex);
  const limit = normalizeBatchLimit(input.limit);
  if (limit === undefined && startIndex !== 0) {
    throw new Error('传入 startIndex 时必须同时传入 limit。');
  }
  return { pillars, startYear, endYear, startIndex, limit };
}

function matches(time: SolarTimeInstance, targetKey: string): boolean {
  return pillarKey(getPillarsFromSolarTime(time)) === targetKey;
}

function detectBoundaryReason(
  previous: SolarTimeInstance,
  current: SolarTimeInstance,
): BaziReverseBoundaryReason {
  const before = getPillarsFromSolarTime(previous);
  const after = getPillarsFromSolarTime(current);
  if (before.year !== after.year || before.month !== after.month) return '节气交接';
  if (before.day !== after.day) return '子时换日';
  return '时辰交接';
}

function makeBoundary(timestamp: number, reason: BaziReverseBoundaryReason): BaziReverseBoundary {
  return { at: toDateTime(fromBeijingTimestamp(timestamp)), reason };
}

function findStartBoundary(
  anchorTimestamp: number,
  rangeStartTimestamp: number,
  targetKey: string,
): number {
  let matching = anchorTimestamp;
  let probe = anchorTimestamp - SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND;
  while (probe >= rangeStartTimestamp && matches(fromBeijingTimestamp(probe), targetKey)) {
    matching = probe;
    probe -= SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND;
  }
  if (probe < rangeStartTimestamp) return rangeStartTimestamp;

  let low = probe;
  let high = matching;
  while (high - low > MILLISECONDS_PER_SECOND) {
    const middle =
      low + Math.floor((high - low) / (2 * MILLISECONDS_PER_SECOND)) * MILLISECONDS_PER_SECOND;
    if (matches(fromBeijingTimestamp(middle), targetKey)) high = middle;
    else low = middle;
  }
  return high;
}

function findEndBoundary(
  anchorTimestamp: number,
  rangeEndTimestamp: number,
  targetKey: string,
): number {
  let matching = anchorTimestamp;
  let probe = anchorTimestamp + SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND;
  while (probe < rangeEndTimestamp && matches(fromBeijingTimestamp(probe), targetKey)) {
    matching = probe;
    probe += SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND;
  }
  if (probe >= rangeEndTimestamp) return rangeEndTimestamp;

  let low = matching;
  let high = probe;
  while (high - low > MILLISECONDS_PER_SECOND) {
    const middle =
      low + Math.floor((high - low) / (2 * MILLISECONDS_PER_SECOND)) * MILLISECONDS_PER_SECOND;
    if (matches(fromBeijingTimestamp(middle), targetKey)) low = middle;
    else high = middle;
  }
  return high;
}

function resolveBoundary(
  timestamp: number,
  isStart: boolean,
  rangeStartTimestamp: number,
  rangeEndTimestamp: number,
): BaziReverseBoundary {
  if (isStart && timestamp === rangeStartTimestamp) {
    return makeBoundary(timestamp, '查询范围开始');
  }
  if (!isStart && timestamp === rangeEndTimestamp) {
    return makeBoundary(timestamp, '查询范围结束');
  }
  const current = fromBeijingTimestamp(timestamp);
  const previous = fromBeijingTimestamp(timestamp - MILLISECONDS_PER_SECOND);
  return makeBoundary(timestamp, detectBoundaryReason(previous, current));
}

function buildCandidate(
  anchorTimestamp: number,
  target: BaziReversePillars,
  targetKey: string,
  rangeStartTimestamp: number,
  rangeEndTimestamp: number,
): BaziReverseCandidate {
  const startTimestamp = findStartBoundary(anchorTimestamp, rangeStartTimestamp, targetKey);
  const endTimestamp = findEndBoundary(anchorTimestamp, rangeEndTimestamp, targetKey);
  return {
    start: toDateTime(fromBeijingTimestamp(startTimestamp)),
    end: toDateTime(fromBeijingTimestamp(endTimestamp)),
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    pillars: target,
    startBoundary: resolveBoundary(startTimestamp, true, rangeStartTimestamp, rangeEndTimestamp),
    endBoundary: resolveBoundary(endTimestamp, false, rangeStartTimestamp, rangeEndTimestamp),
  };
}

function deduplicateCandidates(candidates: BaziReverseCandidate[]): BaziReverseCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.startTimestamp}-${candidate.endTimestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSearchAnchors(
  pillars: BaziReversePillars,
  startYear: number,
  endYear: number,
  rangeStartTimestamp: number,
  rangeEndTimestamp: number,
): number[] {
  const anchors = new Set<number>();
  const hourBranchIndex = SixtyCycle.fromName(pillars.hour).getEarthBranch().getIndex();
  const targetDayIndex = SixtyCycle.fromName(pillars.day).getIndex();
  const addAnchor = (timestamp: number) => {
    if (timestamp >= rangeStartTimestamp && timestamp < rangeEndTimestamp) {
      anchors.add(timestamp);
    }
  };

  // 日柱每 60 个公历日重复。只枚举目标日柱，再按目标时支取代表秒，
  // 避免默认 126 年范围内逐日执行完整天文历法计算。
  const firstNoon = SolarTime.fromYmdHms(startYear, 1, 1, 12, 0, 0);
  const firstNoonDayIndex = firstNoon.getSixtyCycleHour().getEightChar().getDay().getIndex();
  const firstOffset = (targetDayIndex - firstNoonDayIndex + 60) % 60;
  const firstTargetDay =
    toBeijingTimestamp(firstNoon) -
    12 * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND +
    firstOffset * MILLISECONDS_PER_DAY;
  const lastTargetDay = rangeEndTimestamp + MILLISECONDS_PER_DAY;

  for (
    let targetDay = firstTargetDay;
    targetDay <= lastTargetDay;
    targetDay += 60 * MILLISECONDS_PER_DAY
  ) {
    if (hourBranchIndex === 0) {
      // 00:00 属于 targetDay 当天，23:00 属于 targetDay 前一天的子时。
      addAnchor(targetDay);
      addAnchor(targetDay - MILLISECONDS_PER_DAY + 23 * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND);
    } else {
      addAnchor(targetDay + hourBranchIndex * 2 * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND);
    }
  }

  // 交节可能把某一时辰截成很短的前半段或后半段。交节前一秒、
  // 交节秒和后一秒都作为锚点，避免只取时辰中点漏掉短区间。
  for (let year = startYear - 1; year <= endYear + 1; year += 1) {
    const yearPillar = SixtyCycleYear.fromYear(year).getSixtyCycle();
    // 目标干支年内的交节及下一年立春可能截断候选时辰。
    if (yearPillar.getName() !== pillars.year && yearPillar.next(-1).getName() !== pillars.year) {
      continue;
    }
    for (let offset = 0; offset < 12; offset += 1) {
      const termTime = SolarTerm.fromIndex(year, 3)
        .next(offset * 2)
        .getJulianDay()
        .getSolarTime();
      const timestamp = toBeijingTimestamp(termTime);
      addAnchor(timestamp - MILLISECONDS_PER_SECOND);
      addAnchor(timestamp);
      addAnchor(timestamp + MILLISECONDS_PER_SECOND);
    }
  }

  return Array.from(anchors).sort((left, right) => left - right);
}

/**
 * 根据四柱反推指定公历年份范围内的全部北京时间候选区间。
 *
 * 该函数沿用项目当前八字口径：北京时间（UTC+8）、以节气交接确定月柱、
 * 23:00 起按次日干支处理子时。候选区间的起止均由 tyme4ts 正向复核后确定。
 */
export function reverseBaziDates(input: BaziReverseRequest): BaziReverseResult {
  const { pillars, startYear, endYear, startIndex, limit } = normalizeRequest(input);
  const targetKey = pillarKey(pillars);
  const rangeStart = SolarTime.fromYmdHms(startYear, 1, 1, 0, 0, 0);
  const rangeEnd = SolarTime.fromYmdHms(endYear + 1, 1, 1, 0, 0, 0);
  const rangeStartTimestamp = toBeijingTimestamp(rangeStart);
  const rangeEndTimestamp = toBeijingTimestamp(rangeEnd);
  const anchors = buildSearchAnchors(
    pillars,
    startYear,
    endYear,
    rangeStartTimestamp,
    rangeEndTimestamp,
  );

  const allCandidates = deduplicateCandidates(
    anchors
      .filter((timestamp) => matches(fromBeijingTimestamp(timestamp), targetKey))
      .map((timestamp) =>
        buildCandidate(timestamp, pillars, targetKey, rangeStartTimestamp, rangeEndTimestamp),
      ),
  ).sort((left, right) => left.startTimestamp - right.startTimestamp);
  const candidates =
    limit === undefined ? allCandidates : allCandidates.slice(startIndex, startIndex + limit);
  const batch =
    limit === undefined
      ? undefined
      : {
          startIndex,
          limit,
          returned: candidates.length,
          total: allCandidates.length,
          ...(startIndex < allCandidates.length &&
          startIndex + candidates.length < allCandidates.length
            ? { next: { startIndex: startIndex + candidates.length, limit } }
            : {}),
        };

  return {
    pillars,
    startYear,
    endYear,
    candidates,
    candidateCount: allCandidates.length,
    ...(batch ? { batch } : {}),
    policy: {
      timezone: 'Asia/Shanghai',
      offsetHours: CHINA_OFFSET_HOURS,
      month: '节气月',
      dayChange: '子时23点换日',
      range: '[start, end)',
      engine: 'tyme4ts',
    },
  };
}

export const BAZI_REVERSE_DEFAULT_START_YEAR = SUPPORTED_YEAR_MIN;
