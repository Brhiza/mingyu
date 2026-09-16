import {
  calculateSolarTermEvidence,
  calculateSolarTermsForYear,
  SHICHEN_PERIODS,
  TimeManager,
} from 'mingyu-core/calendar';
import { generateLiuyao, type LiuyaoGenerationOptions } from 'mingyu-core/divination/liuyao';
import type { LiuyaoData, LiuyaoTemplateType } from 'mingyu-core/types';
import type { SupplementaryInfo } from '../../types/divination';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { formatDivinationInfo } from './engine/formatters';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_RANGE_MILLISECONDS = 2 * HOUR_MILLISECONDS;

export type LiuyaoRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

/** 六爻分支采用起点的离散公历、农历和节气背景，省略不断变化的时分秒。 */
export type LiuyaoRangeBackground = {
  solar: {
    year: number;
    month: number;
    day: number;
  };
  lunar: {
    year: string;
    month: string;
    day: string;
    yearInChinese: string;
    monthInChinese: string;
    dayInChinese: string;
    monthNumber: number;
    dayNumber: number;
    isLeapMonth: boolean;
  };
  solarTerm: string;
};

export type LiuyaoRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  /** 所有分支复用同一次原始起卦结果，保留其 timestamp、generation、meta 和随机轨迹。 */
  data: LiuyaoData;
  background: LiuyaoRangeBackground;
};

export type LiuyaoRange = {
  source: LiuyaoRangeSource;
  status: 'stable' | 'conditional';
  branches: LiuyaoRangeBranch[];
};

export type GenerateLiuyaoRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
  options?: LiuyaoGenerationOptions;
};

export type FormatLiuyaoRangeOptions = {
  liuyaoTemplate?: LiuyaoTemplateType;
};

const LIUYAO_BOUNDARY_HOURS = Array.from(
  new Set([0, ...SHICHEN_PERIODS.map((period) => Number(period.range.slice(0, 2)))]),
).sort((left, right) => left - right);

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`六爻${label}必须是秒级北京时间时间戳。`);
  }
}

function formatBeijingWallClock(timestamp: number) {
  assertTimestamp(timestamp, '范围');
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function formatSolarDate(solar: LiuyaoRangeBackground['solar']) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${solar.year}-${pad(solar.month)}-${pad(solar.day)}`;
}

function getBeijingDayStart(timestamp: number) {
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) -
    CHINA_OFFSET_HOURS * HOUR_MILLISECONDS
  );
}

/** 只接受四柱反推写入的完整东八区机器区间。 */
export function isLiuyaoRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & LiuyaoRangeSource {
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
): asserts source is BaziReverseSource & LiuyaoRangeSource {
  if (!isLiuyaoRangeSource(source)) {
    throw new Error('六爻区间起卦需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('六爻区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('六爻区间来源超过两小时上限。');
  }
}

function addSolarTermBoundaries(
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
      addSolarTermBoundaries(boundaries, startTimestamp, endTimestamp, term.utcTimestamp);
    }
  }

  // 冬至的索引为 0；显式核对起点年份的该历表项也覆盖 1900 年一月区间。
  if (startParts.year >= 1900 && startParts.year <= 2200) {
    const winterSolstice = calculateSolarTermEvidence(startParts.year, 0);
    addSolarTermBoundaries(boundaries, startTimestamp, endTimestamp, winterSolstice.utcTimestamp);
  }

  return boundaries;
}

function collectBoundaryTimestamps(startTimestamp: number, endTimestamp: number) {
  const boundaries = new Set<number>([startTimestamp, endTimestamp]);
  const firstDayStart = getBeijingDayStart(startTimestamp);
  const lastDayStart = getBeijingDayStart(endTimestamp - 1_000);

  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += DAY_MILLISECONDS) {
    for (const hour of LIUYAO_BOUNDARY_HOURS) {
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

function buildBackground(timeInfo: ReturnType<typeof TimeManager.getDivinationTime>['timeInfo']) {
  const lunar = timeInfo.lunar;
  return {
    solar: {
      year: timeInfo.solar.year,
      month: timeInfo.solar.month,
      day: timeInfo.solar.day,
    },
    lunar: {
      year: lunar.year,
      month: lunar.month,
      day: lunar.day,
      yearInChinese: lunar.yearInChinese,
      monthInChinese: lunar.monthInChinese,
      dayInChinese: lunar.dayInChinese,
      monthNumber: lunar.monthNumber,
      dayNumber: lunar.dayNumber,
      isLeapMonth: lunar.monthInChinese.includes('闰'),
    },
    solarTerm: timeInfo.jieQi,
  } satisfies LiuyaoRangeBackground;
}

function getBackgroundAt(timestamp: number) {
  const context = TimeManager.getDivinationTime(new Date(timestamp), CHINA_OFFSET_MINUTES);
  return {
    ganzhi: context.ganzhi,
    background: buildBackground(context.timeInfo),
  };
}

function backgroundFingerprint(background: LiuyaoRangeBackground) {
  return JSON.stringify(background);
}

/** 面向结果页和分享的北京时间半开区间文字；终点不含。 */
export function formatLiuyaoRangeInterval(startTimestamp: number, endTimestamp: number) {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('六爻显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

/** 将一个分支的离散公历、农历和节气背景转换为用户可读事实。 */
export function formatLiuyaoRangeBackground(branch: LiuyaoRangeBranch) {
  const { solar, lunar, solarTerm } = branch.background;
  const leapText = lunar.isLeapMonth && !lunar.monthInChinese.includes('闰') ? '（闰月）' : '';
  return `历法背景：公历${formatSolarDate(solar)}；农历${lunar.yearInChinese}${lunar.monthInChinese}${leapText}${lunar.dayInChinese}；节气${solarTerm}。`;
}

/** 说明原始卦象如何生成及各分支如何使用，避免把范围误写成多次起卦。 */
export function formatLiuyaoRangeOrigin(range: LiuyaoRange) {
  const data = range.branches[0]?.data;
  const method = data?.generation?.method ?? 'time';
  const timestamp = data?.timestamp ?? range.source.startTimestamp;
  const methodText =
    method === 'time'
      ? `本次时间起卦采用候选起点（北京时间${formatBeijingWallClock(timestamp)}）起一次卦`
      : method === 'manual'
        ? '本次采用原始手工爻值记录生成卦象，并将盘面时间锚定候选起点'
        : method === 'coins'
          ? '本次采用原始三钱记录生成卦象，并将盘面时间锚定候选起点'
          : '本次采用原始蓍草分堆记录生成卦象，并将盘面时间锚定候选起点';
  return `起卦来源：${methodText}；各段沿用本次卦象，并分别列出该段历法背景。`;
}

/** 将各时间分支转换为完整六爻事实并保留所选解读模板。 */
export function formatLiuyaoRangeFacts(
  range: LiuyaoRange,
  supplementaryInfo?: SupplementaryInfo,
  options?: FormatLiuyaoRangeOptions,
) {
  const lines = ['六爻候选时间范围内的分段卦盘：', formatLiuyaoRangeOrigin(range)];
  range.branches.forEach((branch, index) => {
    lines.push(
      `分支${index + 1}：${formatLiuyaoRangeInterval(branch.startTimestamp, branch.endTimestamp)}`,
      formatLiuyaoRangeBackground(branch),
      formatDivinationInfo('liuyao', branch.data, '', supplementaryInfo, {
        liuyaoTemplate: options?.liuyaoTemplate,
      }),
    );
  });
  return lines.join('\n');
}

/** 用于网页提示词的范围口径说明，明确一次起卦与分支历法背景。 */
export function formatLiuyaoRangeContext(range: LiuyaoRange) {
  return [
    '时间口径：北京时间',
    `四柱候选范围：${formatLiuyaoRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    formatLiuyaoRangeOrigin(range),
    '时间事实：范围内按实际民用零点、时辰和节气边界分别核对公历、农历与节气背景；各段复用本次原始卦盘，并分别使用该段历法背景。',
  ].join('\n');
}

/**
 * 在四柱候选范围起点只生成一次六爻原始卦盘，各分支复用该盘并更新离散历法背景。
 */
export function generateLiuyaoRange(input: GenerateLiuyaoRangeInput): LiuyaoRange {
  assertRangeSource(input.source);
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('六爻区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('六爻区间代表时间必须等于四柱候选区间起点。');
  }

  const data = generateLiuyao(new Date(input.source.startTimestamp), input.options);
  if (data.timestamp !== input.source.startTimestamp) {
    throw new Error('六爻原始起卦时间与四柱候选区间起点不一致。');
  }
  if (!hasSourcePillars(data.ganzhi, input.source)) {
    throw new Error('六爻区间原始卦盘的干支与四柱候选来源不一致。');
  }

  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: LiuyaoRangeBranch[] = [];
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

    const startContext = getBackgroundAt(startTimestamp);
    const endContext = getBackgroundAt(endTimestamp - 1_000);
    if (!hasSourcePillars(startContext.ganzhi, input.source)) {
      throw new Error('六爻区间起点的干支与四柱候选来源不一致。');
    }
    if (!hasSourcePillars(endContext.ganzhi, input.source)) {
      throw new Error('六爻区间终点前的干支与四柱候选来源不一致。');
    }

    const fingerprint = backgroundFingerprint(startContext.background);
    if (backgroundFingerprint(endContext.background) !== fingerprint) {
      throw new Error('六爻区间存在未覆盖的历法背景边界，不能安全合并。');
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
      background: startContext.background,
    });
    fingerprints.push(fingerprint);
  }

  if (!branches.length) {
    throw new Error('六爻区间没有可计算的有效片段。');
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
