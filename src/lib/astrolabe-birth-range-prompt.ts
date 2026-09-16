import { TimeManager } from 'mingyu-core/calendar';
import type {
  AstrolabeBirthRange,
  AstrolabeBirthRangeBranch,
  AstrolabeBirthRangeContinuousFact,
} from 'mingyu-core/divination/astrolabe-birth-range';
import type { AstrolabeData } from 'mingyu-core/types';
import {
  formatAstrolabeForPrompt,
  formatPromptSchoolGuidance,
  getPromptSelectionSection,
  requirePromptSelection,
} from 'mingyu-core/prompt';

const CHINA_OFFSET_MINUTES = 8 * 60;

const POINT_LABELS: Record<string, string> = {
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
  Chiron: '凯龙星',
  Ceres: '谷神星',
  Pallas: '智神星',
  Juno: '婚神星',
  Vesta: '灶神星',
  'North Node': '北交点',
  'True North Node': '北交点',
  'Mean North Node': '北交点',
  'South Node': '南交点',
  'True South Node': '南交点',
  'Mean South Node': '南交点',
  'True Lilith': '莉莉丝',
  'Mean Lilith': '莉莉丝',
  'Part of Fortune': '福点',
  'Part of Spirit': '精神点',
  Ascendant: '上升',
  Midheaven: '天顶',
  Descendant: '下降',
  'Imum Coeli': '天底',
};

const ASPECT_LABELS: Record<string, string> = {
  conjunction: '合相',
  sextile: '六合',
  square: '刑相',
  trine: '拱相',
  opposition: '冲相',
  'semi-sextile': '半六合',
  semisextile: '半六合',
  'semi-square': '半刑',
  semisquare: '半刑',
  quintile: '五分相',
  sesquiquadrate: '补八分相',
  biquintile: '倍五分相',
};

function assertTimestamp(value: number, label: string) {
  if (
    !Number.isSafeInteger(value) ||
    value % 1000 !== 0 ||
    Number.isNaN(new Date(value).getTime())
  ) {
    throw new Error(`西占星盘${label}必须是秒级北京时间时间戳。`);
  }
}

export function formatAstrolabeBirthRangeTime(timestamp: number): string {
  assertTimestamp(timestamp, '显示时间');
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function formatAstrolabeBirthRangeInterval(
  startTimestamp: number,
  endTimestamp: number,
): string {
  assertTimestamp(startTimestamp, '显示区间起点');
  assertTimestamp(endTimestamp, '显示区间终点');
  if (startTimestamp >= endTimestamp) {
    throw new Error('西占星盘显示区间不是有效的半开时间范围。');
  }
  return `北京时间 ${formatAstrolabeBirthRangeTime(startTimestamp)} 至 ${formatAstrolabeBirthRangeTime(endTimestamp)}（起点含、终点不含）`;
}

function formatContinuousValue(value: number, unit: string): string {
  if (unit === '毫秒时间戳') {
    return `北京时间${formatAstrolabeBirthRangeTime(value)}`;
  }
  return `${Number(value.toPrecision(10))}${unit}`;
}

function pointsOf(data: AstrolabeData) {
  return [...data.planets, ...data.angles, ...data.houses];
}

function pointDisplayLabel(name: string, data: AstrolabeData): string {
  const point = pointsOf(data).find((item) => item.name === name || item.label === name);
  return POINT_LABELS[name] ?? point?.label ?? POINT_LABELS[point?.name ?? ''] ?? name;
}

function buildPointDisplayLabels(data: AstrolabeData): Map<string, string> {
  const labels = new Map<string, string>(Object.entries(POINT_LABELS));
  for (const point of pointsOf(data)) {
    const display = pointDisplayLabel(point.name, data);
    labels.set(point.name, display);
    labels.set(point.label, display);
  }
  return labels;
}

function localizeChartText(text: string, data: AstrolabeData): string {
  const labels = buildPointDisplayLabels(data);
  return [...labels.entries()]
    .filter(([name, display]) => name !== display)
    .sort(([first], [second]) => second.length - first.length)
    .reduce((current, [name, display]) => current.replaceAll(name, display), text);
}

function localizeContinuousLabel(
  fact: AstrolabeBirthRangeContinuousFact,
  data: AstrolabeData,
): string {
  const aspectMatch = /^aspects\[(.+?)↔(.+?)↔(.+?)\]\.(actualAngle|orb|normalizedOrbRatio)$/u.exec(
    fact.path,
  );
  if (!aspectMatch) return fact.label;
  const [, first, type, second, field] = aspectMatch;
  const suffix = field === 'actualAngle' ? '实际夹角' : field === 'orb' ? '偏差' : '容许度比例';
  return `${pointDisplayLabel(first, data)}↔${ASPECT_LABELS[type] ?? type}↔${pointDisplayLabel(second, data)}${suffix}`;
}

function formatContinuousFact(
  fact: AstrolabeBirthRangeContinuousFact,
  data: AstrolabeData,
): string {
  const range =
    fact.min === fact.max
      ? formatContinuousValue(fact.min, fact.unit)
      : `${formatContinuousValue(fact.min, fact.unit)} 至 ${formatContinuousValue(fact.max, fact.unit)}`;
  const circular = fact.circular
    ? `；${fact.circular.note
        .replace('first/last', '首值与末值')
        .replace('min/max', '最小值与最大值')}`
    : '';
  return `${localizeContinuousLabel(fact, data)}：首值${formatContinuousValue(fact.first, fact.unit)}；末值${formatContinuousValue(fact.last, fact.unit)}；范围${range}；共${fact.sampleCount}个整秒样本${circular}。`;
}

function formatBranchFacts(branch: AstrolabeBirthRangeBranch, index: number): string[] {
  const interval = formatAstrolabeBirthRangeInterval(branch.startTimestamp, branch.endTimestamp);
  const chartFacts = localizeChartText(
    formatAstrolabeForPrompt(branch.representative)
      .replace(/^出生信息：/u, `分段${index + 1}代表盘信息（${interval}；此处为该时段代表样本）：`)
      .replace(/宫位制：Placidus/gu, '宫位制：普拉西德斯'),
    branch.representative,
  );
  return [
    `【时段${index + 1}】`,
    `${interval}，共${branch.sampleCount}个整秒样本。`,
    chartFacts,
    '连续事实范围：',
    ...branch.continuous.map((fact) => formatContinuousFact(fact, branch.representative)),
  ];
}

/** 将每个本命分支的完整盘面和连续事实转换为中文资料。 */
export function formatAstrolabeBirthRangeFacts(range: AstrolabeBirthRange): string {
  if (!range.branches.length) throw new Error('西占星盘出生区间没有可格式化的分支。');
  return range.branches.flatMap((branch, index) => formatBranchFacts(branch, index)).join('\n');
}

/** 生成包含所有本命分支和连续事实的自包含中文任务书。 */
export function formatAstrolabeBirthRangePrompt(
  range: AstrolabeBirthRange,
  options: {
    question?: string;
    topicId?: string;
    subtopicId?: string;
    schools?: readonly string[];
  } = {},
): string {
  if (!range.branches.length) throw new Error('西占星盘出生区间没有可生成提示词的分支。');
  const interval = formatAstrolabeBirthRangeInterval(
    range.source.startTimestamp,
    range.source.endTimestamp,
  );
  const selection =
    options.topicId !== undefined || options.subtopicId !== undefined
      ? requirePromptSelection({
          methodId: 'astrolabe',
          topicId: options.topicId,
          subtopicId: options.subtopicId,
          scope: 'natal',
        })
      : undefined;
  const schoolText = formatPromptSchoolGuidance('astrolabe', options.schools);
  return [
    '【西洋占星本命出生时间区间】',
    `出生范围：${interval}。共${range.sampleCount}个整秒样本，划分为${range.branches.length}个盘面时段。`,
    '【时间与计算口径】',
    '采用北京时间东八区，以整秒逐点计算现代西洋占星本命盘；每个时段列出完整星体位置、四轴、宫头、相位、元素分布、模式分布、逆行状态、格局与尊贵标记，并列出该时段连续事实的首值、末值与范围。',
    '【本命盘资料】',
    formatAstrolabeBirthRangeFacts(range),
    selection ? `【解读选择】\n${getPromptSelectionSection(selection)}` : '',
    schoolText ? `【解读口径】\n${schoolText}` : '',
    options.question?.trim() ? `【问题】\n${options.question.trim()}` : '',
    '【任务】',
    '依据现代西洋占星的星体、宫位、相位和本命盘事实解读本命。先归纳全部出生时段共同成立的判断，再区分仅适用于部分时段的判断，逐项标注对应的北京时间时段；连续事实结合首值、末值和范围说明其变化方向与幅度。',
    '【输出要求】',
    '使用中文输出，明确区分共同事实、分段事实与连续事实；每项结论写出对应盘面依据、适用时段和现实层面的具体表现。',
  ]
    .filter(Boolean)
    .join('\n\n');
}
