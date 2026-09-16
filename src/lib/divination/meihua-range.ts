import { calculateSolarTermsForYear, SHICHEN_PERIODS, TimeManager } from 'mingyu-core/calendar';
import { analyzeMeihuaEvidence, generateMeihua } from 'mingyu-core/divination/meihua';
import type { MeihuaData, MeihuaSettings } from 'mingyu-core/types';
import type { RandomTrace } from 'mingyu-core/random';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { formatDivinationInfo } from './engine/formatters';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_RANGE_MILLISECONDS = 2 * HOUR_MILLISECONDS;

export type MeihuaRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type MeihuaRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  data: MeihuaData;
};

export type MeihuaRange = {
  source: MeihuaRangeSource;
  status: 'stable' | 'conditional';
  branches: MeihuaRangeBranch[];
};

export type GenerateMeihuaRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
  settings?: MeihuaSettings;
};

const MEIHUA_BOUNDARY_HOURS = Array.from(
  new Set(SHICHEN_PERIODS.map((period) => Number(period.range.slice(0, 2)))),
).sort((left, right) => left - right);

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`梅花${label}必须是秒级北京时间时间戳。`);
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
export function isMeihuaRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & MeihuaRangeSource {
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
): asserts source is BaziReverseSource & MeihuaRangeSource {
  if (!isMeihuaRangeSource(source)) {
    throw new Error('梅花区间起卦需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('梅花区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('梅花区间来源超过单一四柱时辰的两小时上限。');
  }
}

function collectSolarTermBoundaries(startTimestamp: number, endTimestamp: number) {
  const startParts = TimeManager.getWallClockParts(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
  const endParts = TimeManager.getWallClockParts(
    new Date(endTimestamp - 1_000),
    CHINA_OFFSET_MINUTES,
  );
  const years = new Set([startParts.year, endParts.year]);
  const boundaries = new Set<number>();

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
  const lastDayStart = getBeijingDayStart(endTimestamp - 1_000);

  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += DAY_MILLISECONDS) {
    for (const hour of MEIHUA_BOUNDARY_HOURS) {
      const boundary = dayStart + hour * HOUR_MILLISECONDS;
      if (boundary > startTimestamp && boundary < endTimestamp) {
        boundaries.add(boundary);
      }
    }
  }

  for (const boundary of collectSolarTermBoundaries(startTimestamp, endTimestamp)) {
    boundaries.add(boundary);
  }

  return [...boundaries].sort((left, right) => left - right);
}

function factsFingerprint(data: MeihuaData) {
  const {
    timestamp: _timestamp,
    meta: _meta,
    evidenceAnalysis: _evidenceAnalysis,
    ...facts
  } = data;
  return JSON.stringify(facts);
}

function hasSourcePillars(data: MeihuaData, source: BaziReverseSource) {
  return (
    data.ganzhi.year === source.pillars.year &&
    data.ganzhi.month === source.pillars.month &&
    data.ganzhi.day === source.pillars.day &&
    data.ganzhi.hour === source.pillars.hour
  );
}

function cloneRandomTrace(trace: RandomTrace): RandomTrace {
  return {
    ...trace,
    samples: [...trace.samples],
  };
}

function restoreSharedRandomTrace(data: MeihuaData, trace: RandomTrace | undefined) {
  if (!trace || !data.meta) return data;
  const withTrace: MeihuaData = {
    ...data,
    meta: { ...data.meta, random: cloneRandomTrace(trace) },
  };
  return {
    ...withTrace,
    evidenceAnalysis: analyzeMeihuaEvidence(withTrace),
  };
}

function buildReplaySettings(settings: MeihuaSettings, trace: RandomTrace): MeihuaSettings {
  const { seed: _seed, random: _random, rng: _rng, replay: _replay, ...rest } = settings;
  return {
    ...rest,
    method: 'random',
    replay: [...trace.samples],
  };
}

function generateAt(input: GenerateMeihuaRangeInput, timestamp: number, replayTrace?: RandomTrace) {
  const settings = input.settings;
  const effectiveSettings =
    replayTrace && settings?.method === 'random'
      ? buildReplaySettings(settings, replayTrace)
      : settings;
  const data = generateMeihua(new Date(timestamp), effectiveSettings);
  return restoreSharedRandomTrace(
    data,
    replayTrace ?? (settings?.method === 'random' ? data.meta?.random : undefined),
  );
}

/** 面向结果页和分享的北京时间半开区间文字；终点不含。 */
export function formatMeihuaRangeInterval(startTimestamp: number, endTimestamp: number) {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('梅花显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

/** 将每个条件卦段转换为完整的梅花排盘事实。 */
export function formatMeihuaRangeFacts(range: MeihuaRange) {
  const lines = ['梅花易数候选时间范围内的分段卦盘：'];
  range.branches.forEach((branch, index) => {
    lines.push(
      `分支${index + 1}：${formatMeihuaRangeInterval(branch.startTimestamp, branch.endTimestamp)}`,
      formatDivinationInfo('meihua', branch.data, ''),
    );
  });
  return lines.join('\n');
}

/** 用于网页提示词的范围口径说明，不把区间起点冒充整段采用时刻。 */
export function formatMeihuaRangeContext(range: MeihuaRange) {
  return [
    '时间口径：北京时间',
    `四柱候选范围：${formatMeihuaRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    '时间事实：范围内按实际民用日、时辰和节气交接分别核对梅花起卦事实。',
  ].join('\n');
}

/** 按民用日、时辰和节气整秒边界切分四柱候选区间。 */
export function generateMeihuaRange(input: GenerateMeihuaRangeInput): MeihuaRange {
  assertRangeSource(input.source);
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('梅花区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('梅花区间代表时间必须等于四柱候选区间起点。');
  }

  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: MeihuaRangeBranch[] = [];
  const fingerprints: string[] = [];
  const firstData = generateAt(input, input.source.startTimestamp);
  const sharedRandomTrace =
    input.settings?.method === 'random' ? firstData.meta?.random : undefined;
  if (
    input.settings?.method === 'random' &&
    (!sharedRandomTrace || !sharedRandomTrace.samples.length)
  ) {
    throw new Error('梅花随机区间缺少可重放的随机轨迹。');
  }

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

    const data = index === 0 ? firstData : generateAt(input, startTimestamp, sharedRandomTrace);
    if (!hasSourcePillars(data, input.source)) {
      throw new Error('梅花区间起点的干支与四柱候选来源不一致。');
    }
    const fingerprint = factsFingerprint(data);
    const lastData = generateAt(
      input,
      Math.max(startTimestamp, endTimestamp - 1_000),
      sharedRandomTrace,
    );
    if (!hasSourcePillars(lastData, input.source)) {
      throw new Error('梅花区间终点前的干支与四柱候选来源不一致。');
    }
    if (factsFingerprint(lastData) !== fingerprint) {
      throw new Error('梅花区间存在未覆盖的历法或时辰边界，不能安全合并。');
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
    throw new Error('梅花区间没有可计算的有效片段。');
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
