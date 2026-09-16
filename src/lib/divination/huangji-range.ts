import { SolarTerm } from 'tyme4ts';
import { getDivinationTime, resolveCivilTime, TimeManager } from 'mingyu-core/calendar';
import {
  buildHuangjiJingshiPrompt,
  calculateHuangjiJingshi,
  type HuangjiJingshiResult,
} from 'mingyu-core/huangji-jingshi';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;
const MAX_RANGE_MILLISECONDS = 2 * HOUR_MILLISECONDS;
const HUANGJI_BOUNDARY_HOURS = [0, 4, 8, 12, 16, 20] as const;

export type HuangjiRangeSource = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type HuangjiRangeBranch = {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  data: HuangjiJingshiResult;
};

export type HuangjiRange = {
  source: HuangjiRangeSource;
  status: 'stable' | 'conditional';
  branches: HuangjiRangeBranch[];
};

export type GenerateHuangjiRangeInput = {
  source: BaziReverseSource;
  representativeDate: Date;
  question?: string;
};

type SolarTermPoint = {
  timestamp: number;
  name: string;
  index: number;
};

function assertTimestamp(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value % 1000 !== 0) {
    throw new Error(`皇极${label}必须是秒级北京时间时间戳。`);
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

/** 将 tyme4ts 的整秒公共节气民用时间转换为固定东八区 UTC 时间戳。 */
function getSolarTermTimestamp(year: number, index: number) {
  const solarTime = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
  return resolveCivilTime({
    year: solarTime.getYear(),
    month: solarTime.getMonth(),
    day: solarTime.getDay(),
    hour: solarTime.getHour(),
    minute: solarTime.getMinute(),
    second: solarTime.getSecond(),
    timezone: CHINA_OFFSET_HOURS,
  }).utcTimestamp;
}

/** 只接受四柱反推写入的完整东八区机器区间。 */
export function isHuangjiRangeSource(
  source: BaziReverseSource | null | undefined,
): source is BaziReverseSource & HuangjiRangeSource {
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
): asserts source is BaziReverseSource & HuangjiRangeSource {
  if (!isHuangjiRangeSource(source)) {
    throw new Error('皇极区间起盘需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('皇极区间来源的文本边界与时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('皇极区间来源超过两小时上限。');
  }
}

function addBoundary(
  boundaries: Set<number>,
  startTimestamp: number,
  endTimestamp: number,
  timestamp: number,
) {
  if (timestamp > startTimestamp && timestamp < endTimestamp) {
    assertTimestamp(timestamp, '边界');
    boundaries.add(timestamp);
  }
}

function collectSolarTermPoints(startTimestamp: number, endTimestamp: number) {
  const startParts = TimeManager.getWallClockParts(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
  const endParts = TimeManager.getWallClockParts(
    new Date(endTimestamp - 1_000),
    CHINA_OFFSET_MINUTES,
  );
  const points = new Map<number, SolarTermPoint>();

  // 索引0的冬至落在索引年份的上一公历年末；多取一年覆盖跨年冬至。
  for (let year = startParts.year; year <= endParts.year + 1; year += 1) {
    for (let index = 0; index < 24; index += 1) {
      const timestamp = getSolarTermTimestamp(year, index);
      points.set(timestamp, {
        timestamp,
        name: SolarTerm.fromIndex(year, index).getName(),
        index,
      });
    }
  }

  return [...points.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function collectSolarTermBoundaries(startTimestamp: number, endTimestamp: number) {
  const points = collectSolarTermPoints(startTimestamp, endTimestamp);
  const boundaries = new Set<number>();

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next || next.timestamp <= current.timestamp) continue;
    for (
      let timestamp = current.timestamp;
      timestamp < next.timestamp;
      timestamp += DAY_MILLISECONDS
    ) {
      addBoundary(boundaries, startTimestamp, endTimestamp, timestamp);
    }
  }

  return boundaries;
}

function collectBoundaryTimestamps(startTimestamp: number, endTimestamp: number) {
  const boundaries = new Set<number>([startTimestamp, endTimestamp]);
  const firstDayStart = getBeijingDayStart(startTimestamp);
  const lastDayStart = getBeijingDayStart(endTimestamp - 1_000);

  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += DAY_MILLISECONDS) {
    for (const hour of HUANGJI_BOUNDARY_HOURS) {
      addBoundary(boundaries, startTimestamp, endTimestamp, dayStart + hour * HOUR_MILLISECONDS);
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

function normalizeExactDateTime(value: string, exactDateTime: string) {
  return value.replaceAll(exactDateTime, '区间代表时刻');
}

function semanticFingerprint(data: HuangjiJingshiResult) {
  const { prompt: _prompt, dateTimeForecast, calculationChain, ...facts } = data;
  if (!dateTimeForecast) {
    return JSON.stringify({
      ...facts,
      calculationChain: calculationChain.map((line) => line),
    });
  }

  const exactDateTime = dateTimeForecast.civilTime.dateTime;
  const {
    civilTime: _civilTime,
    calculationChain: dateTimeCalculationChain,
    ...dateTimeFacts
  } = dateTimeForecast;
  return JSON.stringify({
    ...facts,
    calculationChain: calculationChain.map((line) => normalizeExactDateTime(line, exactDateTime)),
    dateTimeForecast: {
      ...dateTimeFacts,
      calculationChain: dateTimeCalculationChain.map((line) =>
        normalizeExactDateTime(line, exactDateTime),
      ),
    },
  });
}

function createRangeView(data: HuangjiJingshiResult, interval: string): HuangjiJingshiResult {
  if (!data.dateTimeForecast) return data;
  const exactDateTime = data.dateTimeForecast.civilTime.dateTime;
  return {
    ...data,
    prompt: data.prompt,
    calculationChain: data.calculationChain.map((line) =>
      normalizeExactDateTime(line, exactDateTime),
    ),
    dateTimeForecast: {
      ...data.dateTimeForecast,
      civilTime: {
        ...data.dateTimeForecast.civilTime,
        dateTime: interval,
      },
      calculationChain: data.dateTimeForecast.calculationChain.map((line) =>
        normalizeExactDateTime(line, exactDateTime),
      ),
    },
  };
}

function getPromptSection(prompt: string, title: string) {
  const marker = `【${title}】\n`;
  const start = prompt.indexOf(marker);
  if (start < 0) throw new Error(`皇极区间提示词缺少${title}段。`);
  const contentStart = start + marker.length;
  const nextHeading = prompt.indexOf('\n\n【', contentStart);
  const content = prompt.slice(contentStart, nextHeading < 0 ? prompt.length : nextHeading).trim();
  return content;
}

function getPromptSections(prompt: string) {
  const sections: Array<{ title: string; content: string }> = [];
  const pattern = /(?:^|\n\n)【([^】]+)】\n([\s\S]*?)(?=\n\n【|$)/gu;
  for (const match of prompt.matchAll(pattern)) {
    sections.push({ title: match[1]!, content: match[2]!.trim() });
  }
  return sections;
}

function getExtraPromptSections(prompt: string) {
  return getPromptSections(prompt)
    .filter(({ title }) => !['传统依据', '排盘资料', '取象资料', '任务', '问题'].includes(title))
    .map(({ title, content }) => `【${title}】\n${content}`);
}

function getBranchFacts(prompt: string, nested = false) {
  const labels = nested ? ['分支盘面资料：', '分支取象资料：'] : ['【排盘资料】', '【取象资料】'];
  return [
    `${labels[0]}\n${getPromptSection(prompt, '排盘资料')}`,
    `${labels[1]}\n${getPromptSection(prompt, '取象资料')}`,
  ].join('\n\n');
}

function buildBranchPrompt(branch: HuangjiRangeBranch) {
  const interval = formatHuangjiRangeInterval(branch.startTimestamp, branch.endTimestamp);
  return buildHuangjiJingshiPrompt(createRangeView(branch.data, interval));
}

/** 面向结果页和分享的北京时间半开区间文字；终点不含。 */
export function formatHuangjiRangeInterval(startTimestamp: number, endTimestamp: number) {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('皇极显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatBeijingWallClock(startTimestamp)} 至 ${formatBeijingWallClock(endTimestamp)}（起点含、终点不含）`;
}

/** 将每个分支的完整排盘资料转换为事实资料，不加入重复任务与问题段。 */
export function formatHuangjiRangeFacts(range: HuangjiRange) {
  if (!range.branches.length) throw new Error('皇极区间没有可格式化的分支。');
  const firstPrompt = buildBranchPrompt(range.branches[0]!);
  const lines = [
    '皇极经世候选时间范围内的分段盘面：',
    `【传统依据】\n${getPromptSection(firstPrompt, '传统依据')}`,
    ...getExtraPromptSections(firstPrompt),
  ];
  range.branches.forEach((branch, index) => {
    const prompt = buildBranchPrompt(branch);
    lines.push(
      `分支${index + 1}：${formatHuangjiRangeInterval(branch.startTimestamp, branch.endTimestamp)}`,
      getBranchFacts(prompt),
    );
  });
  return lines.join('\n\n');
}

/** 用于网页提示词的范围口径说明，明确节气、日序与民用四小时边界。 */
export function formatHuangjiRangeContext(range: HuangjiRange) {
  return [
    '时间口径：北京时间',
    `四柱候选范围：${formatHuangjiRangeInterval(range.source.startTimestamp, range.source.endTimestamp)}`,
    '时间事实：范围内按实际二十四节气整秒、节气后每满二十四小时的皇极日序节点和北京时间每四小时边界核对年月日时盘面；各分支保留对应区间的完整排盘事实。',
  ].join('\n');
}

/** 合并各分支为一份自包含任务书，每个分支只保留一次完整资料。 */
export function buildHuangjiRangePrompt(range: HuangjiRange, question?: string) {
  if (!range.branches.length) throw new Error('皇极区间没有可生成提示词的分支。');
  const normalizedQuestion =
    question?.trim() || '请比较并解读上述各时间区间内的皇极经世盘面及其变化。';
  const prompts = range.branches.map((branch) => buildBranchPrompt(branch));
  const firstPrompt = prompts[0]!;
  const rangeTask = `请先逐段比较各分支时间区间的节气、皇极日序、四小时段及卦象变化，再${getPromptSection(firstPrompt, '任务').replaceAll('当前时点', '各分支时间区间')}`;
  const branchFacts = prompts.map(
    (prompt, index) =>
      `分支${index + 1}：${formatHuangjiRangeInterval(range.branches[index]!.startTimestamp, range.branches[index]!.endTimestamp)}\n${getBranchFacts(prompt, true)}`,
  );
  return [
    `【传统依据】\n${getPromptSection(firstPrompt, '传统依据')}`,
    `【时间范围】\n${formatHuangjiRangeContext(range)}`,
    `【排盘资料】\n${branchFacts.join('\n\n')}`,
    ...getExtraPromptSections(firstPrompt),
    `【任务】\n${rangeTask}`,
    `【问题】\n${normalizedQuestion}`,
  ].join('\n\n');
}

/** 按节气整秒、节气后日序节点和北京时间四小时边界切分年月日时盘。 */
export function generateHuangjiRange(input: GenerateHuangjiRangeInput): HuangjiRange {
  assertRangeSource(input.source);
  if (
    !(input.representativeDate instanceof Date) ||
    Number.isNaN(input.representativeDate.getTime())
  ) {
    throw new Error('皇极区间代表时间不是有效日期。');
  }
  if (input.representativeDate.getTime() !== input.source.startTimestamp) {
    throw new Error('皇极区间代表时间必须等于四柱候选区间起点。');
  }

  const boundaries = collectBoundaryTimestamps(
    input.source.startTimestamp,
    input.source.endTimestamp,
  );
  const branches: HuangjiRangeBranch[] = [];
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

    const startData = calculateHuangjiJingshi({
      date: new Date(startTimestamp),
      question: input.question,
    });
    const endData = calculateHuangjiJingshi({
      date: new Date(endTimestamp - 1_000),
      question: input.question,
    });
    const startGanZhi = getDivinationTime(new Date(startTimestamp), CHINA_OFFSET_MINUTES).ganzhi;
    const endGanZhi = getDivinationTime(
      new Date(endTimestamp - 1_000),
      CHINA_OFFSET_MINUTES,
    ).ganzhi;
    if (!hasSourcePillars(startGanZhi, input.source)) {
      throw new Error('皇极区间起点的干支与四柱候选来源不一致。');
    }
    if (!hasSourcePillars(endGanZhi, input.source)) {
      throw new Error('皇极区间终点前的干支与四柱候选来源不一致。');
    }

    const fingerprint = semanticFingerprint(startData);
    if (semanticFingerprint(endData) !== fingerprint) {
      throw new Error('皇极区间存在未覆盖的盘面变化边界，不能安全合并。');
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
    throw new Error('皇极区间没有可计算的有效片段。');
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
