import {
  calculateSolarTermEvidence,
  calculateSolarTermsForYear,
  getDivinationTime,
  SHICHEN_PERIODS,
  TimeManager,
} from 'mingyu-core/calendar';
import { generateTaiyi } from 'mingyu-core/taiyi';
import type { TaiyiResult, TaiyiScope } from 'mingyu-core/types';
import { formatTaiyiInfo } from 'mingyu-core/prompt';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_RANGE_MILLISECONDS = 2 * HOUR_MILLISECONDS;

export type TaiyiRangeScope = Exclude<TaiyiScope, 'year'>;

export type TaiyiRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type TaiyiRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  data: TaiyiResult;
};

export type TaiyiRange = {
  source: TaiyiRangeSource;
  status: 'stable' | 'conditional';
  branches: TaiyiRangeBranch[];
};

export type GenerateTaiyiRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
  scope: TaiyiRangeScope;
};

const TAIYI_BOUNDARY_HOURS = Array.from(
  new Set([0, ...SHICHEN_PERIODS.map((period) => Number(period.range.slice(0, 2)))]),
).sort((left, right) => left - right);

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`太乙${label}必须是秒级北京时间时间戳。`);
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
export function isTaiyiRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & TaiyiRangeSource {
  return Boolean(
    source &&
    typeof source === 'object' &&
    source.pillars &&
    typeof source.pillars === 'object' &&
    ['year', 'month', 'day', 'hour'].every((key) => {
      const value = source.pillars[key as keyof typeof source.pillars];
      return typeof value === 'string' && value.length > 0;
    }) &&
    typeof source.intervalStart === 'string' &&
    typeof source.intervalEnd === 'string' &&
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
): asserts source is BaziReverseSource & TaiyiRangeSource {
  if (!isTaiyiRangeSource(source)) {
    throw new Error('太乙区间起局需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('太乙区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('太乙区间来源超过两小时上限。');
  }
}

function addSolarTermBoundary(
  boundaries: Set<number>,
  startTimestamp: number,
  endTimestamp: number,
  termTimestamp: number,
) {
  if (termTimestamp > startTimestamp && termTimestamp < endTimestamp) {
    assertTimestamp(termTimestamp, '节气边界');
    boundaries.add(termTimestamp);
  }
}

function collectSolarTermBoundaries(startTimestamp: number, endTimestamp: number) {
  const startParts = TimeManager.getWallClockParts(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
  const endParts = TimeManager.getWallClockParts(
    new Date(endTimestamp - 1_000),
    CHINA_OFFSET_MINUTES,
  );
  const boundaries = new Set<number>();
  const firstYear = Math.max(1900, startParts.year - 1);
  const lastYear = Math.min(2199, endParts.year);

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const term of calculateSolarTermsForYear(year)) {
      addSolarTermBoundary(boundaries, startTimestamp, endTimestamp, term.utcTimestamp);
    }
  }

  // 冬至索引为 0；一月区间显式核对起点年份，覆盖历表跨年排列和 1900 年边界。
  if (startParts.year >= 1900 && startParts.year <= 2200) {
    const winterSolstice = calculateSolarTermEvidence(startParts.year, 0);
    addSolarTermBoundary(boundaries, startTimestamp, endTimestamp, winterSolstice.utcTimestamp);
  }

  return boundaries;
}

function collectBoundaryTimestamps(startTimestamp: number, endTimestamp: number) {
  const boundaries = new Set<number>([startTimestamp, endTimestamp]);
  const firstDayStart = getBeijingDayStart(startTimestamp);
  const lastDayStart = getBeijingDayStart(endTimestamp - 1_000);

  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += DAY_MILLISECONDS) {
    for (const hour of TAIYI_BOUNDARY_HOURS) {
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

function hasSourcePillars(
  ganzhi: { year: string; month: string; day: string; hour: string },
  source: BaziReverseSource,
) {
  return (
    ganzhi.year === source.pillars.year &&
    ganzhi.month === source.pillars.month &&
    ganzhi.day === source.pillars.day &&
    ganzhi.hour === source.pillars.hour
  );
}

function semanticFingerprint(data: TaiyiResult) {
  const { dateTime: _dateTime, prompt: _prompt, ...facts } = data;
  // 证据链首项只记录 dateTime；其余证据字段由局数、宫位、算将与条件事实构成，继续参与比较。
  const [, ...stableCalculationChain] = data.evidenceAnalysis.calculationChain;
  const { promptText: _evidencePromptText, ...stableEvidence } = data.evidenceAnalysis;
  return JSON.stringify({
    ...facts,
    evidenceAnalysis: {
      ...stableEvidence,
      calculationChain: stableCalculationChain,
    },
  });
}

function scopeGanZhi(scope: TaiyiRangeScope, source: BaziReverseSource) {
  return source.pillars[scope === 'month' ? 'month' : scope === 'day' ? 'day' : 'hour'];
}

function scopeLabel(scope: TaiyiScope) {
  return { year: '年计', month: '月计', day: '日计', hour: '时计' }[scope];
}

/** 面向结果页和分享的北京时间半开区间文字；终点不含。 */
export function formatTaiyiRangeInterval(startTimestamp: number, endTimestamp: number) {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('太乙显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

/** 用候选范围覆盖各段起局时间，避免把首段时刻写成整段事实。 */
export function formatTaiyiRangeFacts(range: TaiyiRange) {
  const firstBranch = range.branches[0];
  const scope = firstBranch?.data.scope;
  const lines = [`太乙神数${scope ? scopeLabel(scope) : ''}候选时间范围内的分段盘面：`];
  range.branches.forEach((branch, index) => {
    const interval = formatTaiyiRangeInterval(branch.startTimestamp, branch.endTimestamp);
    lines.push(
      `分支${index + 1}：${interval}`,
      formatTaiyiInfo({ ...branch.data, dateTime: interval }),
    );
  });
  return lines.join('\n');
}

/** 用于网页提示词的范围口径说明，列明节气、零点与时辰边界。 */
export function formatTaiyiRangeContext(range: TaiyiRange) {
  const scope = range.branches[0]?.data.scope;
  return [
    '时间口径：北京时间',
    `${scope ? `太乙${scopeLabel(scope)}` : '太乙'}四柱候选范围：${formatTaiyiRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    '时间事实：范围内按实际二十四节气交接、民用零点和时辰边界核对四柱与太乙盘面；各分支保留对应区间的完整计式事实。',
  ].join('\n');
}

/** 按节气、民用零点和时辰边界生成太乙月、日或时计的稳定分支。 */
export function generateTaiyiRange(input: GenerateTaiyiRangeInput): TaiyiRange {
  assertRangeSource(input.source);
  if (!['month', 'day', 'hour'].includes(input.scope)) {
    throw new Error(`太乙区间只支持月计、日计和时计：${String(input.scope)}`);
  }
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('太乙区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('太乙区间代表时间必须等于四柱候选区间起点。');
  }

  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: TaiyiRangeBranch[] = [];
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

    const startContext = getDivinationTime(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
    const endContext = getDivinationTime(new Date(endTimestamp - 1_000), CHINA_OFFSET_MINUTES);
    if (!hasSourcePillars(startContext.ganzhi, input.source)) {
      throw new Error('太乙区间起点的干支与四柱候选来源不一致。');
    }
    if (!hasSourcePillars(endContext.ganzhi, input.source)) {
      throw new Error('太乙区间终点前的干支与四柱候选来源不一致。');
    }

    const startData = generateTaiyi({
      scope: input.scope,
      date: new Date(startTimestamp),
    });
    const endData = generateTaiyi({
      scope: input.scope,
      date: new Date(endTimestamp - 1_000),
    });
    const expectedGanZhi = scopeGanZhi(input.scope, input.source);
    if (startData.ganZhi !== expectedGanZhi) {
      throw new Error('太乙区间起点的计式干支与四柱候选来源不一致。');
    }
    if (endData.ganZhi !== expectedGanZhi) {
      throw new Error('太乙区间终点前的计式干支与四柱候选来源不一致。');
    }

    const fingerprint = semanticFingerprint(startData);
    if (semanticFingerprint(endData) !== fingerprint) {
      throw new Error('太乙区间存在未覆盖的盘面变化边界，不能安全合并。');
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
      data: startData,
    });
    fingerprints.push(fingerprint);
  }

  if (!branches.length) {
    throw new Error('太乙区间没有可计算的有效片段。');
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
