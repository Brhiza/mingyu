/**
 * 压平高密度八字岁运与格局引动引擎
 *
 * 将前 8 步大运与智能推断的目标流年压平为 220–400 字的高密度事实块：
 * - 零说教、零防御性废话、零冗余 ISO 时间戳
 * - 逐运/逐年计算干支喜忌匹配、破格救应链（补药救格 / 引动病灶）与月日支六冲引动
 */
import { getSixtyCycleName, getYearMonthGanZhi, getYearSixtyCycle } from '../ganzhi-foundation';
import { buildPillarFact, type BaziPillar, type PillarName } from './pillars';
import { branchesClash } from './natal-facts';
import type { calculateBaziFortune } from './fortune';
import type { PatternConflictChain, PatternRelationsResult } from './pattern-relations';
import type { UsefulGodResult } from './useful-god';
import { inferFortuneScope, type FortuneScope } from '../../router-model/fortune-scope';

type Pillars = Record<PillarName, BaziPillar>;
type Fortune = ReturnType<typeof calculateBaziFortune>;

export interface CompactFortuneDynamicsInput {
  chart: {
    pillars: Pillars;
    basis: { utcTimestamp: number };
    usefulGod: UsefulGodResult;
  };
  fortune: Fortune;
  patternRelations: PatternRelationsResult;
  question?: string;
  referenceTime?: string | number;
  referenceYear?: number;
}

export interface CompactFortuneStep {
  index: number;
  ganZhi: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
  wuxingTag: string;
  favorableScore: number;
  triggersRemedy: boolean;
  triggersPathogen: boolean;
  remedyTag: string;
  pathogenTag: string;
  clashTags: string[];
}

export interface CompactFortuneYear {
  year: number;
  ganZhi: string;
  wuxingTag: string;
  favorableScore: number;
  triggersRemedy: boolean;
  triggersPathogen: boolean;
  remedyTag: string;
  pathogenTag: string;
  clashTags: string[];
}

export interface CompactFortuneMonth {
  year: number;
  month: number;
  ganZhi: string;
  wuxingTag: string;
  favorableScore: number;
  triggersRemedy: boolean;
  triggersPathogen: boolean;
  remedyTag: string;
  pathogenTag: string;
  clashTags: string[];
}

export interface CompactFortuneDay {
  year: number;
  month: number;
  day: number;
  ganZhi: string;
  wuxingTag: string;
  favorableScore: number;
  triggersRemedy: boolean;
  triggersPathogen: boolean;
  remedyTag: string;
  pathogenTag: string;
  clashTags: string[];
}

export interface CompactFortuneDynamics {
  scope: FortuneScope;
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  dayun: CompactFortuneStep[];
  years: CompactFortuneYear[];
  months: CompactFortuneMonth[];
  days: CompactFortuneDay[];
  bestDayun: CompactFortuneStep[];
}

const BEIJING_OFFSET_MS = 8 * 3_600_000;
const BASE_DAY_UTC = Date.UTC(2000, 0, 1); // 2000-01-01 = 戊午 (index 54)

function getGregorianDayGanZhi(year: number, month: number, day: number): string {
  const diffDays = Math.round((Date.UTC(year, month - 1, day) - BASE_DAY_UTC) / 86_400_000);
  return getSixtyCycleName(54 + diffDays);
}

/** 公历月中下旬对应的节气月建干支（2月→寅月0，…，12月→子月10，次年1月→上节气年丑月11） */
function getGregorianMidMonthGanZhi(year: number, month: number): string {
  if (month === 1) {
    return getYearMonthGanZhi(year - 1, 11); // 丑月，属上个立春年
  }
  return getYearMonthGanZhi(year, month - 2);
}

function beijingYear(ts: number): number {
  return new Date(ts + BEIJING_OFFSET_MS).getUTCFullYear();
}

function evaluateWuxingAlignment(
  pillar: BaziPillar,
  fav: Set<string>,
  unfav: Set<string>,
): { tag: string; score: number } {
  const sEl = pillar.stemElement;
  const bEl = pillar.branchElement;
  const sFav = fav.has(sEl);
  const bFav = fav.has(bEl);
  const sUnfav = unfav.has(sEl);
  const bUnfav = unfav.has(bEl);

  const pairEl = sEl === bEl ? sEl : `${sEl}${bEl}`;

  if (sFav && bFav) return { tag: `喜${pairEl}`, score: 2 };
  if (sUnfav && bUnfav) return { tag: `忌${pairEl}`, score: -2 };
  if (sFav && bUnfav) return { tag: `喜${sEl}忌${bEl}`, score: 0 };
  if (sUnfav && bFav) return { tag: `忌${sEl}喜${bEl}`, score: 0 };
  if (sFav) return { tag: `喜${sEl}`, score: 1 };
  if (bFav) return { tag: `喜${bEl}`, score: 1 };
  if (sUnfav) return { tag: `忌${sEl}`, score: -1 };
  if (bUnfav) return { tag: `忌${bEl}`, score: -1 };
  return { tag: `平${pairEl}`, score: 0 };
}

function evaluateConflictChainTriggers(
  pillar: BaziPillar,
  conflictChains: PatternConflictChain[],
): {
  triggersRemedy: boolean;
  triggersPathogen: boolean;
  remedyTag: string;
  pathogenTag: string;
} {
  if (!conflictChains.length) {
    return { triggersRemedy: false, triggersPathogen: false, remedyTag: '', pathogenTag: '' };
  }
  const gods = new Set<string>([pillar.tenGod, pillar.hiddenStems[0]?.tenGod].filter(Boolean) as string[]);
  const hasAny = (list: string[]) => list.some((g) => gods.has(g));

  let remedyTag = '';
  let pathogenTag = '';

  for (const chain of conflictChains) {
    const c = chain.conflict;
    if (c.includes('枭神夺食')) {
      if (hasAny(['正财', '偏财'])) {
        remedyTag ||= '补药制枭';
      } else if (hasAny(['偏印'])) {
        pathogenTag ||= '引动枭夺';
      }
    } else if (c.includes('伤官见官')) {
      if (hasAny(['正财', '偏财'])) {
        remedyTag ||= '补药通官';
      } else if (hasAny(['正印', '偏印'])) {
        remedyTag ||= '补药制伤';
      } else if (hasAny(['伤官', '正官'])) {
        pathogenTag ||= '引动伤官';
      }
    } else if (c.includes('印重成病')) {
      if (hasAny(['正财', '偏财'])) {
        remedyTag ||= '补药破印';
      } else if (hasAny(['食神', '伤官'])) {
        remedyTag ||= '补药泄秀';
      } else if (hasAny(['正印', '偏印', '正官', '七杀'])) {
        pathogenTag ||= '引动印病';
      }
    } else if (c.includes('贪财坏印')) {
      if (hasAny(['比肩', '劫财'])) {
        remedyTag ||= '补药护印';
      } else if (hasAny(['正官', '七杀'])) {
        remedyTag ||= '补药通印';
      } else if (hasAny(['正财', '偏财'])) {
        pathogenTag ||= '引动坏印';
      }
    } else if (c.includes('官杀混杂')) {
      if (hasAny(['正印', '偏印'])) {
        remedyTag ||= '补药化杀';
      } else if (hasAny(['食神'])) {
        remedyTag ||= '补药制杀';
      } else if (hasAny(['正官', '七杀'])) {
        pathogenTag ||= '引动混杀';
      }
    }
  }

  const triggersRemedy = Boolean(remedyTag);
  const triggersPathogen = !triggersRemedy && Boolean(pathogenTag);
  return { triggersRemedy, triggersPathogen, remedyTag, pathogenTag };
}

function evaluateBranchClashes(pillar: BaziPillar, natal: Pillars): string[] {
  const tags: string[] = [];
  const clashDay = branchesClash(pillar.zhi, natal.day.zhi);
  const clashMonth = branchesClash(pillar.zhi, natal.month.zhi);
  if (clashDay && clashMonth) {
    tags.push('冲月日支');
  } else {
    if (clashDay) tags.push('冲日支');
    if (clashMonth) tags.push('冲月支');
  }
  return tags;
}

/**
 * 基于本地已算好的 chart、fortune、patternRelations 与智能时间窗推断，
 * 构建高密度大运与目标流年动态引动数据。
 */
export function buildCompactFortuneDynamics(
  input: CompactFortuneDynamicsInput,
): CompactFortuneDynamics {
  const { chart, fortune, patternRelations, question = '' } = input;
  const fav = new Set(chart.usefulGod.favorableWuxing);
  const unfav = new Set(chart.usefulGod.unfavorableWuxing);

  const refTimestamp =
    typeof input.referenceTime === 'number'
      ? input.referenceTime
      : typeof input.referenceTime === 'string' && Number.isFinite(Date.parse(input.referenceTime))
        ? Date.parse(input.referenceTime)
        : Date.now();

  const refYear = input.referenceYear ?? beijingYear(refTimestamp);
  const birthYear = beijingYear(fortune.birthTimestamp);
  const scope = inferFortuneScope(question, refYear, refTimestamp, birthYear);

  const dayun: CompactFortuneStep[] = fortune.cycles.slice(0, 8).map((cycle) => {
    const startYear = beijingYear(cycle.startTimestamp);
    const endYear = beijingYear(cycle.endTimestamp);
    const startAge = Math.max(0, startYear - birthYear);
    const endAge = Math.max(startAge, endYear - birthYear - 1);
    const isCurrent = cycle.startTimestamp <= refTimestamp && refTimestamp < cycle.endTimestamp;

    const align = evaluateWuxingAlignment(cycle.pillar, fav, unfav);
    const chain = evaluateConflictChainTriggers(cycle.pillar, patternRelations.conflictChains);
    const clashTags = evaluateBranchClashes(cycle.pillar, chart.pillars);
    const score =
      align.score +
      (chain.triggersRemedy ? 1.5 : 0) -
      (chain.triggersPathogen ? 1.5 : 0);

    return {
      index: cycle.index,
      ganZhi: cycle.ganZhi,
      startAge,
      endAge,
      startYear,
      endYear,
      isCurrent,
      wuxingTag: align.tag,
      favorableScore: score,
      triggersRemedy: chain.triggersRemedy,
      triggersPathogen: chain.triggersPathogen,
      remedyTag: chain.remedyTag,
      pathogenTag: chain.pathogenTag,
      clashTags,
    };
  });

  const dayMaster = chart.pillars.day.gan;
  const years: CompactFortuneYear[] = scope.years.map((year) => {
    const ganZhi = getYearSixtyCycle(year);
    const pillar = buildPillarFact(ganZhi, dayMaster);
    const align = evaluateWuxingAlignment(pillar, fav, unfav);
    const chain = evaluateConflictChainTriggers(pillar, patternRelations.conflictChains);
    const clashTags = evaluateBranchClashes(pillar, chart.pillars);
    const score =
      align.score +
      (chain.triggersRemedy ? 1.5 : 0) -
      (chain.triggersPathogen ? 1.5 : 0);

    return {
      year,
      ganZhi,
      wuxingTag: align.tag,
      favorableScore: score,
      triggersRemedy: chain.triggersRemedy,
      triggersPathogen: chain.triggersPathogen,
      remedyTag: chain.remedyTag,
      pathogenTag: chain.pathogenTag,
      clashTags,
    };
  });

  const months: CompactFortuneMonth[] = scope.months.map(({ year, month }) => {
    const ganZhi = getGregorianMidMonthGanZhi(year, month);
    const pillar = buildPillarFact(ganZhi, dayMaster);
    const align = evaluateWuxingAlignment(pillar, fav, unfav);
    const chain = evaluateConflictChainTriggers(pillar, patternRelations.conflictChains);
    const clashTags = evaluateBranchClashes(pillar, chart.pillars);
    const score =
      align.score +
      (chain.triggersRemedy ? 1.5 : 0) -
      (chain.triggersPathogen ? 1.5 : 0);
    return {
      year,
      month,
      ganZhi,
      wuxingTag: align.tag,
      favorableScore: score,
      triggersRemedy: chain.triggersRemedy,
      triggersPathogen: chain.triggersPathogen,
      remedyTag: chain.remedyTag,
      pathogenTag: chain.pathogenTag,
      clashTags,
    };
  });

  const days: CompactFortuneDay[] = scope.dates.map(({ year, month, day }) => {
    const ganZhi = getGregorianDayGanZhi(year, month, day);
    const pillar = buildPillarFact(ganZhi, dayMaster);
    const align = evaluateWuxingAlignment(pillar, fav, unfav);
    const chain = evaluateConflictChainTriggers(pillar, patternRelations.conflictChains);
    const clashTags = evaluateBranchClashes(pillar, chart.pillars);
    const score =
      align.score +
      (chain.triggersRemedy ? 1.5 : 0) -
      (chain.triggersPathogen ? 1.5 : 0);
    return {
      year,
      month,
      day,
      ganZhi,
      wuxingTag: align.tag,
      favorableScore: score,
      triggersRemedy: chain.triggersRemedy,
      triggersPathogen: chain.triggersPathogen,
      remedyTag: chain.remedyTag,
      pathogenTag: chain.pathogenTag,
      clashTags,
    };
  });

  const bestDayun = [...dayun]
    .filter((step) => step.favorableScore > 0)
    .sort((a, b) => b.favorableScore - a.favorableScore || a.index - b.index)
    .slice(0, 2);

  return {
    scope,
    favorableWuxing: [...chart.usefulGod.favorableWuxing],
    unfavorableWuxing: [...chart.usefulGod.unfavorableWuxing],
    dayun,
    years,
    months,
    days,
    bestDayun,
  };
}

/**
 * 将岁运动态数据格式化为超紧凑压平块（不含外层标题）。
 */
export function formatCompactFortuneDynamics(dynamics: CompactFortuneDynamics): string {
  const { scope, favorableWuxing, unfavorableWuxing, dayun, years, months, days, bestDayun } = dynamics;

  const favText = favorableWuxing.join('') || '平衡';
  const unfavText = unfavorableWuxing.join('') || '无定';
  const rangeText =
    years.length > 1
      ? `${years[0].year}-${years[years.length - 1].year}`
      : years.length === 1
        ? `${years[0].year}`
        : `${scope.referenceYear}`;

  const bestText =
    scope.focus === 'lifetime' && bestDayun.length > 0
      ? `｜佳运:${bestDayun.map((s) => `${s.ganZhi}(${s.startAge}-${s.endAge})`).join('、')}`
      : '';

  const headerLine = `喜忌：喜${favText}/忌${unfavText}｜窗：${scope.reason}(${rangeText})${bestText}`;

  const dayunLine =
    '大运：' +
    dayun
      .map((step) => {
        const agePart = `${step.startAge}-${step.endAge}${step.isCurrent ? '·当前' : ''}`;
        const notes = [
          step.wuxingTag,
          ...(step.triggersRemedy ? ['补药救格'] : []),
          ...(step.triggersPathogen ? ['引动病灶'] : []),
          ...(step.isCurrent && step.clashTags.length ? step.clashTags : []),
        ].join('·');
        return `${step.ganZhi}(${agePart}):${notes}`;
      })
      .join('｜');

  const yearLine =
    '流年：' +
    years
      .map((item) => {
        const notes = [
          item.wuxingTag,
          ...(item.triggersRemedy ? [item.remedyTag || '补药救格'] : []),
          ...(item.triggersPathogen ? [item.pathogenTag || '引动病灶'] : []),
          ...item.clashTags,
        ].join('·');
        return `${item.year}${item.ganZhi}(${notes})`;
      })
      .join('｜');

  const lines = [headerLine, dayunLine, yearLine];

  if (months.length > 0) {
    const monthLine =
      '流月(按节气月建)：' +
      months
        .map((m) => {
          const notes = [
            m.wuxingTag,
            ...(m.triggersRemedy ? [m.remedyTag || '补药'] : []),
            ...(m.triggersPathogen ? [m.pathogenTag || '引病'] : []),
            ...m.clashTags,
          ].join('·');
          return `${m.year}/${m.month}月${m.ganZhi}(${notes})`;
        })
        .join('｜');
    lines.push(monthLine);
  }

  if (days.length > 0) {
    const tokens = days.map((d) => {
      const special = [...d.clashTags];
      return special.length > 0
        ? `${d.month}/${d.day}${d.ganZhi}(${special.join('·')})`
        : `${d.month}/${d.day}${d.ganZhi}`;
    });
    if (tokens.length <= 8) {
      lines.push(`流日：${tokens.join('｜')}`);
    } else {
      lines.push(`流日（共${tokens.length}天）：`);
      for (let i = 0; i < tokens.length; i += 8) {
        lines.push(tokens.slice(i, i + 8).join('｜'));
      }
    }
  }

  return lines.join('\n');
}
