import { calculateSolarTermsForYear, SHICHEN_PERIODS, TimeManager } from 'mingyu-core/calendar';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import type { LiurenData } from 'mingyu-core/types';
import { formatLiurenJudgmentFacts } from 'mingyu-core/prompt';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { formatDivinationInfo } from './engine/formatters';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_RANGE_MILLISECONDS = 2 * HOUR_MILLISECONDS;

export type LiurenRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type LiurenRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  data: LiurenData;
};

export type LiurenRange = {
  source: LiurenRangeSource;
  status: 'stable' | 'conditional';
  branches: LiurenRangeBranch[];
};

export type GenerateLiurenRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
};

const LIUREN_BOUNDARY_HOURS = Array.from(
  new Set(SHICHEN_PERIODS.map((period) => Number(period.range.slice(0, 2)))),
).sort((left, right) => left - right);

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`大六壬${label}必须是秒级北京时间时间戳。`);
  }
}

function formatBeijingWallClock(timestamp: number) {
  assertTimestamp(timestamp, '范围');
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function getBeijingDayStart(timestamp: number) {
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) -
    CHINA_OFFSET_HOURS * HOUR_MILLISECONDS
  );
}

/** 只接受四柱反推写入的完整东八区机器区间。 */
export function isLiurenRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & LiurenRangeSource {
  return Boolean(
    source &&
    Object.values(source.pillars).every((value) => value.length > 0) &&
    typeof source.startTimestamp === 'number' &&
    typeof source.endTimestamp === 'number' &&
    Number.isSafeInteger(source.startTimestamp) &&
    Number.isSafeInteger(source.endTimestamp) &&
    source.startTimestamp % 1000 === 0 &&
    source.endTimestamp % 1000 === 0 &&
    source.startTimestamp < source.endTimestamp &&
    source.endExclusive === true &&
    source.timezone === 'Asia/Shanghai' &&
    source.offsetHours === 8,
  );
}

function assertRangeSource(
  source: BaziReverseSource,
): asserts source is BaziReverseSource & LiurenRangeSource {
  if (!isLiurenRangeSource(source)) {
    throw new Error('大六壬区间起课需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('大六壬区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('大六壬区间来源超过单一四柱时辰的两小时上限。');
  }
}

function collectSolarTermBoundaries(startTimestamp: number, endTimestamp: number) {
  const startParts = TimeManager.getWallClockParts(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
  const endParts = TimeManager.getWallClockParts(
    new Date(endTimestamp - 1000),
    CHINA_OFFSET_MINUTES,
  );
  const boundaries = new Set<number>();

  const years = new Set([startParts.year, endParts.year]);
  for (const year of years) {
    for (const term of calculateSolarTermsForYear(year)) {
      if (term.utcTimestamp > startTimestamp && term.utcTimestamp < endTimestamp) {
        boundaries.add(term.utcTimestamp);
      }
    }
  }

  return boundaries;
}

function collectBoundaryTimestamps(startTimestamp: number, endTimestamp: number) {
  const boundaries = new Set<number>([startTimestamp, endTimestamp]);
  const firstDayStart = getBeijingDayStart(startTimestamp);
  const lastDayStart = getBeijingDayStart(endTimestamp - 1000);

  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += DAY_MILLISECONDS) {
    for (const hour of LIUREN_BOUNDARY_HOURS) {
      const boundary = dayStart + hour * HOUR_MILLISECONDS;
      if (boundary > startTimestamp && boundary < endTimestamp) {
        boundaries.add(boundary);
      }
    }
  }

  for (const boundary of collectSolarTermBoundaries(startTimestamp, endTimestamp)) {
    boundaries.add(boundary);
  }

  return [...boundaries]
    .filter((boundary) => boundary >= startTimestamp && boundary <= endTimestamp)
    .sort((left, right) => left - right);
}

function factsFingerprint(data: LiurenData) {
  // evidenceAnalysis 的 calculationFact.key 会把 timestamp 重新嵌入审计身份；
  // 原始盘面与判断事实仍完整参与比较，派生审计对象则由各分支分别保留。
  const { timestamp: _timestamp, evidenceAnalysis: _evidenceAnalysis, ...facts } = data;
  return JSON.stringify(facts);
}

function generateAt(timestamp: number) {
  return generateLiuren(new Date(timestamp));
}

function hasSourcePillars(data: LiurenData, source: BaziReverseSource) {
  return (
    data.ganzhi.year === source.pillars.year &&
    data.ganzhi.month === source.pillars.month &&
    data.ganzhi.day === source.pillars.day &&
    data.ganzhi.hour === source.pillars.hour
  );
}

function formatBranchFacts(data: LiurenData) {
  return [
    formatDivinationInfo('liuren', data, ''),
    data.lessonSummary ? `课情：${data.lessonSummary}` : '',
    data.transmissionSummary ? `传情：${data.transmissionSummary}` : '',
    ...formatLiurenJudgmentFacts(data),
  ]
    .filter(Boolean)
    .join('\n');
}

/** 面向结果页的北京时间半开区间文字；终点不含。 */
export function formatLiurenRangeInterval(startTimestamp: number, endTimestamp: number) {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('大六壬显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

/** 将条件课按分支保留完整六壬排盘资料和必要判断事实。 */
export function formatLiurenRangeFacts(range: LiurenRange) {
  const lines = ['大六壬候选时间范围内的分段课盘：'];
  range.branches.forEach((branch, index) => {
    lines.push(
      `分支${index + 1}：${formatLiurenRangeInterval(branch.startTimestamp, branch.endTimestamp)}`,
      formatBranchFacts(branch.data),
    );
  });
  return lines.join('\n');
}

/** 用于网页提示词的范围口径说明，不把区间起点冒充为唯一采用时刻。 */
export function formatLiurenRangeContext(range: LiurenRange) {
  return [
    '时间口径：北京时间',
    `四柱候选范围：${formatLiurenRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    '时间事实：范围内按实际时辰、民用零点和节气交接分别核对大六壬课盘。',
  ].join('\n');
}

/** 按大六壬实际依赖的时辰、日界和 24 节气边界切分四柱候选区间。 */
export function generateLiurenRange(input: GenerateLiurenRangeInput): LiurenRange {
  assertRangeSource(input.source);
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('大六壬区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('大六壬区间代表时间必须等于四柱候选区间起点。');
  }

  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: LiurenRangeBranch[] = [];
  const fingerprints: string[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startTimestamp = boundaries[index];
    const endTimestamp = boundaries[index + 1];
    if (
      startTimestamp === undefined ||
      endTimestamp === undefined ||
      startTimestamp >= endTimestamp
    ) {
      continue;
    }

    const data = generateAt(startTimestamp);
    if (!hasSourcePillars(data, input.source)) {
      throw new Error('大六壬区间起点的干支与四柱候选来源不一致。');
    }
    const fingerprint = factsFingerprint(data);
    const lastTimestamp = endTimestamp - 1000;
    const lastData = generateAt(Math.max(startTimestamp, lastTimestamp));
    if (!hasSourcePillars(lastData, input.source)) {
      throw new Error('大六壬区间终点前的干支与四柱候选来源不一致。');
    }
    if (factsFingerprint(lastData) !== fingerprint) {
      throw new Error('大六壬区间存在未覆盖的历法或时辰边界，不能安全合并。');
    }

    const previous = branches[branches.length - 1];
    const previousFingerprint = fingerprints[fingerprints.length - 1];
    if (
      previous &&
      previous.endTimestamp === startTimestamp &&
      previousFingerprint === fingerprint
    ) {
      previous.endTimestamp = endTimestamp;
      continue;
    }

    branches.push({
      startTimestamp,
      endTimestamp,
      endExclusive: true,
      data,
    });
    fingerprints.push(fingerprint);
  }

  if (!branches.length) {
    throw new Error('大六壬区间没有可计算的有效片段。');
  }

  return {
    source: {
      startTimestamp: input.source.startTimestamp,
      endTimestamp: input.source.endTimestamp,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
    status: branches.length === 1 ? 'stable' : 'conditional',
    branches,
  };
}
