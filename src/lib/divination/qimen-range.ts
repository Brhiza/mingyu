import {
  calculateSolarTermEvidence,
  calculateSolarTermsForYear,
  type MoonPhaseEvidence,
  SHICHEN_PERIODS,
  TimeManager,
} from 'mingyu-core/calendar';
import { generateQimen } from 'mingyu-core/divination/qimen';
import type { QimenData, QimenScope } from 'mingyu-core/types';
import type { SupplementaryInfo } from '../../types/divination';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { formatDivinationInfo } from './engine/formatters';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_RANGE_MILLISECONDS = 2 * HOUR_MILLISECONDS;

type QimenMethod = 'zhuanpan' | 'feipan';
type QimenJuMethod = 'chaibu' | 'zhirun';

export type QimenRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

/**
 * 月相是连续天文事实，不作为区间逐秒切分条件。
 * `end` 固定表示分支终点前一秒的采样。
 */
export type QimenRangeMoonPhaseEvidence = {
  start: MoonPhaseEvidence;
  end: MoonPhaseEvidence;
};

export type QimenRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  data: QimenData;
  moonPhaseEvidence: QimenRangeMoonPhaseEvidence;
};

export type QimenRange = {
  source: QimenRangeSource;
  status: 'stable' | 'conditional';
  branches: QimenRangeBranch[];
};

export type GenerateQimenRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
  method?: QimenMethod;
  scope?: QimenScope;
  juMethod?: QimenJuMethod;
};

const QIMEN_BOUNDARY_HOURS = Array.from(
  new Set(SHICHEN_PERIODS.map((period) => Number(period.range.slice(0, 2)))),
).sort((left, right) => left - right);

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`奇门${label}必须是秒级北京时间时间戳。`);
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
export function isQimenRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & QimenRangeSource {
  return Boolean(
    source &&
    typeof source === 'object' &&
    source.pillars &&
    typeof source.pillars === 'object' &&
    Object.values(source.pillars).every((value) => typeof value === 'string' && value.length > 0) &&
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
): asserts source is BaziReverseSource & QimenRangeSource {
  if (!isQimenRangeSource(source)) {
    throw new Error('奇门区间起局需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('奇门区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('奇门区间来源超过两小时上限。');
  }
}

function collectSolarTermBoundaries(startTimestamp: number, endTimestamp: number) {
  const startParts = TimeManager.getWallClockParts(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
  const endParts = TimeManager.getWallClockParts(
    new Date(endTimestamp - 1_000),
    CHINA_OFFSET_MINUTES,
  );
  const boundaries = new Set<number>();
  // calculateSolarTermsForYear 将当年一月的节气放在上一年序列中，
  // 因此跨年或一月区间必须回看上一年，才能覆盖全部二十四节气。
  const firstYear = Math.max(1900, startParts.year - 1);
  const lastYear = Math.min(2199, endParts.year);

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const term of calculateSolarTermsForYear(year)) {
      for (const dayOffset of [0, 5, 10]) {
        const boundary = term.utcTimestamp + dayOffset * DAY_MILLISECONDS;
        if (boundary > startTimestamp && boundary < endTimestamp) {
          assertTimestamp(boundary, '节气边界');
          boundaries.add(boundary);
        }
      }
    }
  }

  // 冬至在节气索引中为 0；一月区间还需显式核对该编号对应的历表点，
  // 尤其是起点年份为 1900 时不能回看不存在的 1899 年全年序列。
  if (startParts.year >= 1900 && startParts.year <= 2200) {
    const term = calculateSolarTermEvidence(startParts.year, 0);
    for (const dayOffset of [0, 5, 10]) {
      const boundary = term.utcTimestamp + dayOffset * DAY_MILLISECONDS;
      if (boundary > startTimestamp && boundary < endTimestamp) {
        assertTimestamp(boundary, '节气边界');
        boundaries.add(boundary);
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
    for (const hour of QIMEN_BOUNDARY_HOURS) {
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

function factsFingerprint(data: QimenData) {
  const {
    timestamp: _timestamp,
    evidenceAnalysis: _evidenceAnalysis,
    seasonality,
    ...facts
  } = data;
  const discreteSeasonality = seasonality
    ? (({
        moonPhaseEvidence: _moonPhaseEvidence,
        lunarPhaseConsistency: _lunarPhaseConsistency,
        ...discreteFacts
      }) => discreteFacts)(seasonality)
    : undefined;
  return JSON.stringify({
    ...facts,
    ...(discreteSeasonality ? { seasonality: discreteSeasonality } : {}),
  });
}

function hasSourcePillars(data: QimenData, source: BaziReverseSource) {
  return (
    data.ganzhi.year === source.pillars.year &&
    data.ganzhi.month === source.pillars.month &&
    data.ganzhi.day === source.pillars.day &&
    data.ganzhi.hour === source.pillars.hour
  );
}

function generateAt(input: GenerateQimenRangeInput, timestamp: number): QimenData {
  return generateQimen(
    new Date(timestamp),
    input.method ?? 'zhuanpan',
    input.scope ?? 'hour',
    input.juMethod ?? 'chaibu',
    CHINA_OFFSET_MINUTES,
  );
}

function getMoonPhaseEvidence(data: QimenData, label: string) {
  const evidence = data.seasonality?.moonPhaseEvidence;
  if (!evidence) {
    throw new Error(`奇门区间${label}缺少月相证据。`);
  }
  return evidence;
}

/** 面向结果页和分享的北京时间半开区间文字；终点不含。 */
export function formatQimenRangeInterval(startTimestamp: number, endTimestamp: number) {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('奇门显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

function formatMoonPhaseSample(label: string, evidence: MoonPhaseEvidence) {
  return `${label}：北京时间${formatBeijingWallClock(evidence.utcTimestamp)}，月相${evidence.eightPhaseName}（${evidence.waxing ? '盈' : '亏'}），照明${evidence.illuminationPercent.toFixed(3)}%，日月黄经差${evidence.phaseAngleDegrees.toFixed(3)}°`;
}

/** 显示分支起点与终点前一秒的月相参照，不把连续月相当作整段定值。 */
export function formatQimenRangeMoonPhase(branch: QimenRangeBranch) {
  return [
    `月相参照（起止采样）：${formatMoonPhaseSample('起点参照', branch.moonPhaseEvidence.start)}；${formatMoonPhaseSample('终点前一秒参照', branch.moonPhaseEvidence.end)}。`,
    '月相随时间连续变化，各值对应标注时刻。',
  ].join('');
}

/** 将每个条件盘段转换为完整奇门排盘资料和月相采样。 */
export function formatQimenRangeFacts(range: QimenRange, supplementaryInfo?: SupplementaryInfo) {
  const lines = ['奇门遁甲候选时间范围内的分段盘面：'];
  range.branches.forEach((branch, index) => {
    const phase = branch.data.seasonality?.jieQiPhase;
    const phaseText = phase
      ? `交节后自然日阶段：${phase.jieQi}${phase.phase}；正式定局三元：${branch.data.timeInfo.epoch}`
      : '';
    lines.push(
      `分支${index + 1}：${formatQimenRangeInterval(branch.startTimestamp, branch.endTimestamp)}`,
      formatDivinationInfo('qimen', branch.data, '', supplementaryInfo),
      phaseText,
      formatQimenRangeMoonPhase(branch),
    );
  });
  return lines.join('\n');
}

/** 用于网页提示词的范围口径说明，明确离散分段与连续月相参照。 */
export function formatQimenRangeContext(range: QimenRange) {
  return [
    '时间口径：北京时间',
    `四柱候选范围：${formatQimenRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    '时间事实：范围内按实际节气交接、节令阶段、民用零点、晚子时和时辰边界分别核对奇门盘面；月相列出各段起点与终点前一秒参照。',
  ].join('\n');
}

/** 按奇门实际使用的时辰、日界、24 节气和节令阶段边界切分四柱候选区间。 */
export function generateQimenRange(input: GenerateQimenRangeInput): QimenRange {
  assertRangeSource(input.source);
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('奇门区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('奇门区间代表时间必须等于四柱候选区间起点。');
  }

  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: QimenRangeBranch[] = [];
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

    const data = generateAt(input, startTimestamp);
    if (!hasSourcePillars(data, input.source)) {
      throw new Error('奇门区间起点的干支与四柱候选来源不一致。');
    }
    const fingerprint = factsFingerprint(data);
    const lastTimestamp = endTimestamp - 1_000;
    const lastData = generateAt(input, lastTimestamp);
    if (!hasSourcePillars(lastData, input.source)) {
      throw new Error('奇门区间终点前的干支与四柱候选来源不一致。');
    }
    if (factsFingerprint(lastData) !== fingerprint) {
      throw new Error('奇门区间存在未覆盖的历法或节令边界，不能安全合并。');
    }

    const moonPhaseEvidence = {
      start: getMoonPhaseEvidence(data, '起点'),
      end: getMoonPhaseEvidence(lastData, '终点前一秒'),
    };
    const previous = branches[branches.length - 1];
    const previousFingerprint = fingerprints[fingerprints.length - 1];
    if (
      previous &&
      previous.endTimestamp === startTimestamp &&
      previousFingerprint === fingerprint
    ) {
      previous.endTimestamp = endTimestamp;
      previous.moonPhaseEvidence.end = moonPhaseEvidence.end;
      continue;
    }

    branches.push({
      startTimestamp,
      endTimestamp,
      endExclusive: true,
      data,
      moonPhaseEvidence,
    });
    fingerprints.push(fingerprint);
  }

  if (!branches.length) {
    throw new Error('奇门区间没有可计算的有效片段。');
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
