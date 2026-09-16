import { SHICHEN_PERIODS, TimeManager } from 'mingyu-core/calendar';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import type { XiaoliurenData, XiaoliurenRule } from 'mingyu-core/types';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;

/** 小六壬范围计算只接受反推候选写入的完整东八区机器区间。 */
export type XiaoliurenRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type XiaoliurenRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  data: XiaoliurenData;
};

export type XiaoliurenRange = {
  source: XiaoliurenRangeSource;
  status: 'stable' | 'conditional';
  branches: XiaoliurenRangeBranch[];
};

export type GenerateXiaoliurenRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
  rule?: XiaoliurenRule;
};

const XIAOLIUREN_BOUNDARY_HOURS = Array.from(
  new Set(SHICHEN_PERIODS.map((period) => Number(period.range.slice(0, 2)))),
).sort((left, right) => left - right);

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`小六壬${label}必须是秒级北京时间时间戳。`);
  }
}

function formatBeijingWallClock(timestamp: number) {
  assertTimestamp(timestamp, '范围');
  const shifted = new Date(timestamp + CHINA_OFFSET_HOURS * HOUR_MILLISECONDS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
}

function getBeijingDayStart(timestamp: number) {
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) -
    CHINA_OFFSET_HOURS * HOUR_MILLISECONDS
  );
}

/**
 * 判断来源是否包含可安全消费的完整机器区间。
 * 文本与时间戳的一致性由 isBaziReverseSource/normalizeBaziReverseSource 负责，
 * 这里再次固定政策，避免范围算法被旧历史文本或其他时区误触发。
 */
export function isXiaoliurenRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & XiaoliurenRangeSource {
  return Boolean(
    source &&
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
): asserts source is BaziReverseSource & XiaoliurenRangeSource {
  if (!isXiaoliurenRangeSource(source)) {
    throw new Error('小六壬区间起课需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('小六壬区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > 2 * HOUR_MILLISECONDS) {
    throw new Error('小六壬区间来源超过单一四柱时辰的两小时上限。');
  }
}

function collectBoundaryTimestamps(startTimestamp: number, endTimestamp: number) {
  const boundaries = new Set<number>([startTimestamp, endTimestamp]);
  const firstDayStart = getBeijingDayStart(startTimestamp);
  const lastDayStart = getBeijingDayStart(endTimestamp - 1_000);

  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += DAY_MILLISECONDS) {
    for (const hour of XIAOLIUREN_BOUNDARY_HOURS) {
      const boundary = dayStart + hour * HOUR_MILLISECONDS;
      if (boundary > startTimestamp && boundary < endTimestamp) {
        boundaries.add(boundary);
      }
    }
  }

  return [...boundaries].sort((left, right) => left - right);
}

function factsFingerprint(data: XiaoliurenData) {
  return JSON.stringify({
    rule: data.rule ?? 'common',
    lunarMonth: data.lunarMonth,
    lunarDay: data.lunarDay,
    isLeapMonth: data.isLeapMonth,
    hourIndex: data.hourIndex,
    hourLabel: data.hourLabel,
    ganzhi: data.ganzhi,
    calculation: {
      hourNumber: data.calculation.hourNumber,
      monthSeed: data.calculation.monthSeed,
      daySeed: data.calculation.daySeed,
      hourSeed: data.calculation.hourSeed,
      monthPalaceIndex: data.calculation.monthPalaceIndex,
      dayPalaceIndex: data.calculation.dayPalaceIndex,
      hourPalaceIndex: data.calculation.hourPalaceIndex,
    },
    sequence: {
      month: data.sequence.month.index,
      day: data.sequence.day.index,
      hour: data.sequence.hour.index,
    },
    primary: data.primary.index,
  });
}

function generateAt(timestamp: number, rule: XiaoliurenRule) {
  return generateXiaoliuren({ rule, customDate: new Date(timestamp) });
}

function hasSourcePillars(data: XiaoliurenData, source: BaziReverseSource) {
  return (
    data.ganzhi.year === source.pillars.year &&
    data.ganzhi.month === source.pillars.month &&
    data.ganzhi.day === source.pillars.day &&
    data.ganzhi.hour === source.pillars.hour
  );
}

/**
 * 按小六壬实际使用的东八区民用日和时辰交接切分四柱候选区间。
 * 农历月序、闰月标志和农历日由同一次核心历法计算得到；当前口径的农历日
 * 在东八区 00:00 换日，因此 00:00 已包含在时辰边界集合中。
 */
export function generateXiaoliurenRange(input: GenerateXiaoliurenRangeInput): XiaoliurenRange {
  assertRangeSource(input.source);
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('小六壬区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('小六壬区间代表时间必须等于四柱候选区间起点。');
  }

  const rule = input.rule ?? 'common';
  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: XiaoliurenRangeBranch[] = [];
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

    const data = generateAt(startTimestamp, rule);
    if (!hasSourcePillars(data, input.source)) {
      throw new Error('小六壬区间起点的干支与四柱候选来源不一致。');
    }
    const fingerprint = factsFingerprint(data);
    // 这是对已声明边界集合的闭区间内校验：只在边界两侧合并，不用一个中点
    // 相同来推断整个片段稳定。若实际依赖出现未覆盖的内部边界，直接失败而不
    // 生成一张看似稳定的单课。
    const lastTimestamp = endTimestamp - 1_000;
    const lastData = generateAt(Math.max(startTimestamp, lastTimestamp), rule);
    if (!hasSourcePillars(lastData, input.source)) {
      throw new Error('小六壬区间终点前的干支与四柱候选来源不一致。');
    }
    if (factsFingerprint(lastData) !== fingerprint) {
      throw new Error('小六壬区间存在未覆盖的历法或时辰边界，不能安全合并。');
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
    throw new Error('小六壬区间没有可计算的有效片段。');
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

/** 面向结果页的北京时间半开区间文字；不暴露内部字段或来源审计信息。 */
export function formatXiaoliurenRangeInterval(startTimestamp: number, endTimestamp: number) {
  if (
    !Number.isSafeInteger(startTimestamp) ||
    !Number.isSafeInteger(endTimestamp) ||
    startTimestamp >= endTimestamp
  ) {
    throw new Error('小六壬显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

/** 将条件课转换为可直接放入提示词的干净中文分支事实。 */
export function formatXiaoliurenRangeFacts(range: XiaoliurenRange) {
  const first = range.branches[0]?.data;
  const lines = [
    `小六壬起课口径：${first?.ruleLabel ?? '通行掌诀'}`,
    '以下各时间段分别按对应农历月日和时辰起课：',
  ];

  range.branches.forEach((branch, index) => {
    const data = branch.data;
    lines.push(
      `分支${index + 1}：${formatXiaoliurenRangeInterval(branch.startTimestamp, branch.endTimestamp)}`,
      `农历：${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日；时辰：${data.hourLabel}`,
      `顺数：月宫${data.sequence.month.name}；日宫${data.sequence.day.name}；时宫${data.sequence.hour.name}`,
      `占得宫：${data.primary.name}；时宫歌诀：${data.primary.verse}`,
      `起数：月${data.calculation.monthSeed}、日${data.calculation.daySeed}、时${data.calculation.hourSeed}；干支：${data.ganzhi.year}年 ${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时`,
      `历法口径：${data.calculation.dayBoundary}；${data.calculation.leapMonthRule}`,
    );
  });

  return lines.join('\n');
}

/** 用于网页提示词的范围口径说明，避免把区间起点写成整段的采用时刻。 */
export function formatXiaoliurenRangeContext(range: XiaoliurenRange) {
  return [
    '时间口径：北京时间',
    `四柱候选范围：${formatXiaoliurenRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    '时间事实：东八区民用日以零点换日，农历日和时辰按范围内实际交接确定。',
  ].join('\n');
}
