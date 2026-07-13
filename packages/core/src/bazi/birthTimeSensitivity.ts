import { LunarHour } from 'tyme4ts';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { baziCalculator } from './baziCalculator';
import type { BaziChartResult, Person, Pillars } from './baziTypes';

export type BaziPillarKey = keyof Pillars;

export interface BirthTimeSensitivityOptions {
  /** 出生记录可能存在的前后误差，单位为分钟。 */
  uncertaintyMinutes?: number;
}

export interface BirthTimeSensitivitySample {
  offsetMinutes: number;
  clockDateTime: string;
  correctedDateTime: string;
  timeIndex: number;
  pillars: Record<BaziPillarKey, string>;
  changedPillars: BaziPillarKey[];
}

export interface BirthTimeSensitivityChange {
  pillar: BaziPillarKey;
  baseline: string;
  candidates: string[];
  offsets: number[];
}

export interface BirthTimeSensitivityResult {
  uncertaintyMinutes: number;
  baseline: BirthTimeSensitivitySample;
  samples: BirthTimeSensitivitySample[];
  stablePillars: BaziPillarKey[];
  changedPillars: BaziPillarKey[];
  changes: BirthTimeSensitivityChange[];
  isSensitive: boolean;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const PILLAR_KEYS: BaziPillarKey[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<BaziPillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateTime(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

function toSolarClockDate(person: Person): Date {
  const hour = person.birthHour!;
  const minute = person.birthMinute!;
  if (!person.isLunar) {
    return new Date(Date.UTC(person.year, person.month - 1, person.day, hour, minute));
  }
  const solar = LunarHour.fromYmdHms(
    person.year,
    person.isLeapMonth ? -Math.abs(person.month) : person.month,
    person.day,
    hour,
    minute,
    0,
  ).getSolarTime();
  return new Date(
    Date.UTC(
      solar.getYear(),
      solar.getMonth() - 1,
      solar.getDay(),
      solar.getHour(),
      solar.getMinute(),
    ),
  );
}

function getPillarNames(chart: BaziChartResult): Record<BaziPillarKey, string> {
  return {
    year: chart.pillars.year.ganZhi,
    month: chart.pillars.month.ganZhi,
    day: chart.pillars.day.ganZhi,
    hour: chart.pillars.hour.ganZhi,
  };
}

function assertInput(person: Person, uncertaintyMinutes: number) {
  if (person.useTrueSolarTime !== true) {
    throw new Error('出生时间敏感性分析需要启用真太阳时。');
  }
  if (
    !Number.isInteger(person.birthHour) ||
    !Number.isInteger(person.birthMinute) ||
    typeof person.birthLongitude !== 'number'
  ) {
    throw new Error('出生时间敏感性分析需要精准出生时分和经度。');
  }
  if (!Number.isInteger(uncertaintyMinutes) || uncertaintyMinutes < 1 || uncertaintyMinutes > 120) {
    throw new Error('出生时间误差分钟数需为 1-120 的整数。');
  }
}

function calculateSample(
  person: Person,
  baseClock: Date,
  offsetMinutes: number,
  baselinePillars?: Record<BaziPillarKey, string>,
): BirthTimeSensitivitySample {
  const clock = new Date(baseClock.getTime() + offsetMinutes * 60000);
  const chart = baziCalculator.calculateBazi({
    ...person,
    year: clock.getUTCFullYear(),
    month: clock.getUTCMonth() + 1,
    day: clock.getUTCDate(),
    isLunar: false,
    isLeapMonth: false,
    birthHour: clock.getUTCHours(),
    birthMinute: clock.getUTCMinutes(),
  });
  const pillars = getPillarNames(chart);
  return {
    offsetMinutes,
    clockDateTime: formatDateTime(clock),
    correctedDateTime: chart.timing
      ? `${chart.timing.correctedTime.year}-${pad(chart.timing.correctedTime.month)}-${pad(chart.timing.correctedTime.day)}T${pad(chart.timing.correctedTime.hour)}:${pad(chart.timing.correctedTime.minute)}:${pad(chart.timing.correctedTime.second)}`
      : formatDateTime(clock),
    timeIndex: chart.timeInfo.index,
    pillars,
    changedPillars: baselinePillars
      ? PILLAR_KEYS.filter((key) => pillars[key] !== baselinePillars[key])
      : [],
  };
}

/**
 * 对出生钟表时间做前后扰动并重排候选盘，识别真实发生翻转的四柱。
 * 该结果只描述输入误差造成的计算敏感性，不判断任何候选盘吉凶。
 */
export function analyzeBirthTimeSensitivity(
  person: Person,
  options: BirthTimeSensitivityOptions = {},
): BirthTimeSensitivityResult {
  const uncertaintyMinutes = options.uncertaintyMinutes ?? 5;
  assertInput(person, uncertaintyMinutes);
  const baseClock = toSolarClockDate(person);
  const baseline = calculateSample(person, baseClock, 0);
  const samples = [-uncertaintyMinutes, 0, uncertaintyMinutes].map((offset) =>
    offset === 0 ? baseline : calculateSample(person, baseClock, offset, baseline.pillars),
  );
  baseline.changedPillars = [];

  const changedPillars = PILLAR_KEYS.filter((key) =>
    samples.some((sample) => sample.pillars[key] !== baseline.pillars[key]),
  );
  const stablePillars = PILLAR_KEYS.filter((key) => !changedPillars.includes(key));
  const changes = changedPillars.map((pillar) => ({
    pillar,
    baseline: baseline.pillars[pillar],
    candidates: Array.from(new Set(samples.map((sample) => sample.pillars[pillar]))),
    offsets: samples
      .filter((sample) => sample.pillars[pillar] !== baseline.pillars[pillar])
      .map((sample) => sample.offsetMinutes),
  }));

  const items: PromptEvidenceItem[] = [
    {
      level: changedPillars.length ? '主证' : '辅证',
      title: changedPillars.length ? '出生时间误差会改变命盘四柱' : '当前误差范围内四柱保持稳定',
      detail: changedPillars.length
        ? changes
            .map(
              (change) =>
                `${PILLAR_LABELS[change.pillar]}：基准 ${change.baseline}，候选 ${change.candidates.join('/')}`,
            )
            .join('；')
        : `前后各 ${uncertaintyMinutes} 分钟的候选盘四柱均与基准盘一致。`,
      source: `基准钟表时间及 ±${uncertaintyMinutes} 分钟候选盘重排比较`,
      weight: 100,
      tags: ['出生时间', '候选盘', '计算边界'],
    },
    {
      level: '辅证',
      title: '稳定柱位',
      detail: stablePillars.length
        ? stablePillars.map((key) => `${PILLAR_LABELS[key]}${baseline.pillars[key]}`).join('、')
        : '四柱均存在候选变化。',
      source: '候选盘逐柱一致性比较',
      weight: 60,
    },
    {
      level: '限制',
      title: '出生时间敏感性解释边界',
      detail:
        '候选盘差异只说明出生记录误差可能改变排盘结构；不得据此选择更讨喜的命盘，也不得把未变化的四柱等同于全部分析结论稳定。',
      source: '计算事实与命理解读分离原则',
      weight: 90,
    },
  ];
  const evidence: PromptEvidenceBundle = {
    title: '八字出生时间敏感性结构化证据',
    items,
  };
  const promptText = [
    '【八字出生时间敏感性结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    '候选样本：',
    ...samples.map(
      (sample) =>
        `${sample.offsetMinutes >= 0 ? '+' : ''}${sample.offsetMinutes} 分钟｜钟表时间 ${sample.clockDateTime}｜真太阳时 ${sample.correctedDateTime}｜四柱 ${PILLAR_KEYS.map((key) => sample.pillars[key]).join(' ')}`,
    ),
  ].join('\n');

  return {
    uncertaintyMinutes,
    baseline,
    samples,
    stablePillars,
    changedPillars,
    changes,
    isSensitive: changedPillars.length > 0,
    evidence,
    promptText,
    methodology: [
      '以用户记录的当地钟表时间为基准，在误差范围两端分别重排。',
      '每个样本独立执行历史夏令时、经度与均时差校正，再比较年、月、日、时四柱。',
      '仅报告真实发生的柱位变化，不以距离边界的估计代替候选盘计算。',
      '候选结构不直接表示吉凶，也不生成稳定度总分。',
    ],
  };
}
