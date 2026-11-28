import type { z } from 'zod';
import type { baziSynastryIndependentInput } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import { sameJsonValue } from '../json-value';
import { calculateBaziPillars, type PillarName } from './bazi/pillars';
import { calculateBaziFortune, locateBaziFortune } from './bazi/fortune';
import { comparePillars, stemElementOf } from './bazi/natal-facts';
import { buildBaziCompatibility } from './bazi/compatibility';
import { baziSchools } from './bazi/prompt-options';
import { calculateUnknownBaziTime } from './bazi/unknown-time';
import { formatCivilDateTime } from './huangji/civil-time';
import { aggregateBaziCompatibility } from './bazi/compatibility-aggregate';
import { summarizeClimate } from './bazi/climate';
import { summarizeClimateDecision } from './bazi/climate-decision';
import { summarizeUsefulStrategy } from './bazi/useful-strategy';
import { determineUsefulGod } from './bazi/useful-god';
import { formatPatternEvidence } from './bazi/pattern-evidence';
import { formatBaziShenshaHits } from './bazi/shensha';
import { buildDirectionCoverage, buildUsefulGodCoverage, evaluateSpousePalaceDeep, evaluateUsefulGodComplementarity, formatDirectionCoverage, formatUsefulGodCoverage } from './bazi/direction-coverage';
import { dedupeExcerpts, formatClassicExcerpts, selectBaziClassics } from './classics';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof baziSynastryIndependentInput>;
type Source = Pick<Input, 'person1' | 'person2' | 'relationship' | 'referenceTime' | 'syncYears' | 'compareCandidates' | 'comparisonPage'>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const relationTasks = {
  marriage: {
    label: '婚恋',
    focus: '《三命通会》《渊海子平》合婚首重双方日主中和、用神能否相互补益（寒暖燥湿相济），次看日柱夫妻宫是否暗合、德合或天克地冲，再参看年命纳音与配偶星旺衰。',
    task: '结合双方互动、沟通、需求和边界讨论婚恋与合婚议题，客观指出契合基础与磨合卡点，不预设双方意愿或必然结果。',
  },
  career: {
    label: '合伙',
    focus: '合伙共事重看双方十神互补（如一造食伤生财配一造印比掌舵稳盘）、彼此喜用神能否互助，以及跨柱比劫刑冲是否带来利益分配或决策分歧。',
    task: '结合双方资源、职责分工、决策风格与利益退出边界讨论合伙或职场共事，不保证商业收益。',
  },
  friendship: {
    label: '友情',
    focus: '友邻社交重看日干情谊合化、比劫与食伤互动氛围及大运流年共频节奏，区分长久同频与阶段性聚散。',
    task: '结合双方日常相处方式、情绪支持与心理边界讨论友情搭档。',
  },
  children: {
    label: '子女',
    focus: '亲子互动可参看家长食伤星与对方印枭/比劫配合、双方日主寒暖喜忌反差，以此理解孩子天性与管教沟通方式，避免僵化压制。',
    task: '结合亲子角色、成长阶段与实际相处事实分析沟通引导建议，不以盘面给孩子前途或性格下绝对定论。',
  },
  parents: {
    label: '父母',
    focus: '长幼沟通重看印枭星位与年月柱根基互动，辨析观念代差来源、照护压力点及柔和化解之道。',
    task: '结合亲子角色、家庭照护分工与现实沟通互动给出稳妥建议。',
  },
  siblings: {
    label: '兄弟姐妹',
    focus: '手足互动重看月柱与比肩劫财配置及跨盘冲合，区分同甘共苦与利益边界不清。',
    task: '结合双方责任分工、家庭事务沟通与现实处境分析。',
  },
} as const;

async function buildData(input: Source, context?: RuntimeContext) {
  const unselected = [input.person1, input.person2].some((person) => person.clock.kind !== 'exact' && person.candidateIndex === undefined);
  const source = { person1: input.person1, person2: input.person2, relationship: input.relationship ?? 'marriage' as const,
    ...(input.referenceTime ? { referenceTime: input.referenceTime } : {}),
    ...(input.syncYears ? { syncYears: input.syncYears } : {}),
    ...(input.compareCandidates || unselected || input.comparisonPage ? { compareCandidates: true } : {}), ...(input.comparisonPage ? { comparisonPage: input.comparisonPage } : {}) };
  const calculatePerson = async (person: Input['person1']) => {
    const { name: _name, candidateIndex, gender, ...birth } = person;
    if (birth.clock.kind === 'exact') {
      const baseChart = await calculateBaziPillars({ ...birth, clock: birth.clock }, gender, undefined, context?.staticDataset);
      const chart = { ...baseChart, usefulGod: determineUsefulGod(baseChart), candidate: null };
      const fortune = gender ? calculateBaziFortune(chart, gender) : null;
      const located = source.referenceTime && fortune
        ? locateBaziFortune(chart, fortune, Date.parse(source.referenceTime))
        : null;
      return { chart, exactChart: chart, fortune, located, gender, variants: [{ index: null, pillars: chart.pillars }], candidates: [] };
    }
    const { clock, ...day } = birth;
    const range = await calculateUnknownBaziTime({ ...day, ...(clock.kind === 'shichen' ? { shichenIndex: clock.index } : {}) }, gender, context?.staticDataset);
    const candidates = range.segments.map((item, index) => ({ index, startTimestamp: item.startTimestamp, endTimestamp: item.endTimestamp, endExclusive: true as const, timezone: item.timezone,
      pillars: Object.fromEntries(positions.map((position) => [position, item.pillars[position].ganZhi])), monthCommander: item.monthCommander.stem }));
    const variants = range.segments.map((item, index) => ({ index, pillars: item.pillars }));
    if (candidateIndex === undefined) return { chart: null, exactChart: null, fortune: null, located: null, gender, variants, candidates };
    if (!range.segments[candidateIndex]) throw new Error(`出生时段候选索引超出范围：共有 ${range.segments.length} 个候选。`);
    const segment = range.segments[candidateIndex], total = range.segments.length;
    const chart = { input: birth, basis: { precision: 'candidate' as const, localDateTime: formatCivilDateTime(segment.localStart), timezone: segment.timezone,
      ...(day.timeZoneId ? { timeZoneId: day.timeZoneId } : {}), timeStandard: day.timeStandard ?? 'civil' },
      pillars: segment.pillars, natalFacts: segment.natalFacts, shensha: segment.shensha, strength: segment.strength, ordinaryPattern: segment.ordinaryPattern, transformation: segment.transformation, quzhi: segment.quzhi, conger: segment.conger, extreme: segment.extreme, patternOverview: segment.patternOverview, patternEvidence: segment.patternEvidence, usefulBaseline: segment.usefulBaseline, climate: segment.climate, climateDecision: segment.climateDecision, usefulStrategy: segment.usefulStrategy, usefulGod: segment.usefulGod, monthCommander: segment.monthCommander,
      candidate: { index: candidateIndex, total, nextIndex: candidateIndex + 1 < total ? candidateIndex + 1 : null,
        startTimestamp: segment.startTimestamp, endTimestamp: segment.endTimestamp, endExclusive: true as const, source: range.source,
        candidates } };
    return { chart, exactChart: null, fortune: null, located: null, gender, variants, candidates };
  };
  const [first, second] = await Promise.all([calculatePerson(source.person1), calculatePerson(source.person2)]);
  const person1 = first.chart, person2 = second.chart;
  if (!person1 || !person2) return { input: source, charts: { person1, person2 }, candidates: { person1: first.candidates, person2: second.candidates }, compatibility: null,
    candidateComparison: aggregateBaziCompatibility(first.variants, second.variants, source.comparisonPage) };
  const fortuneComparison = source.referenceTime && first.exactChart && second.exactChart && first.fortune && second.fortune && first.located && second.located ? (() => {
    const loc1 = first.located;
    const loc2 = second.located;
    const classifyGanZhi = (ganZhi: string, ug: typeof person1.usefulGod) => {
      const stemEl = stemElementOf(ganZhi[0]);
      const stemFav = ug.favorableWuxing.includes(stemEl) ? '喜用' : ug.unfavorableWuxing.includes(stemEl) ? '忌神' : '中性';
      return { ganZhi, stemElement: stemEl, stemTendency: stemFav };
    };
    const crossDayunRelations = loc1.cycle && loc2.cycle
      ? comparePillars(loc1.cycle.pillar, loc2.cycle.pillar)
      : [];
    return {
      referenceTime: source.referenceTime,
      sharedYear: loc1.year.ganZhi,
      sharedMonth: loc1.month.ganZhi,
      person1: {
        stage: loc1.cycle ? '大运' as const : '童限' as const,
        dayun: loc1.cycle ? { startTimestamp: loc1.cycle.startTimestamp, endTimestamp: loc1.cycle.endTimestamp, ...classifyGanZhi(loc1.cycle.ganZhi, person1.usefulGod) } : null,
        yearTendency: classifyGanZhi(loc1.year.ganZhi, person1.usefulGod),
      },
      person2: {
        stage: loc2.cycle ? '大运' as const : '童限' as const,
        dayun: loc2.cycle ? { startTimestamp: loc2.cycle.startTimestamp, endTimestamp: loc2.cycle.endTimestamp, ...classifyGanZhi(loc2.cycle.ganZhi, person2.usefulGod) } : null,
        yearTendency: classifyGanZhi(loc2.year.ganZhi, person2.usefulGod),
      },
      crossDayunRelations,
    };
  })() : undefined;
  const annualSync = source.syncYears && first.exactChart && second.exactChart && first.fortune && second.fortune ? (() => {
    const f1 = first.fortune;
    const f2 = second.fortune;
    const evaluateTendency = (ganZhi: string, ug: typeof person1.usefulGod) => {
      const stemEl = stemElementOf(ganZhi[0]);
      if (ug.favorableWuxing.includes(stemEl)) return '喜用' as const;
      if (ug.unfavorableWuxing.includes(stemEl)) return '忌神' as const;
      return '中性' as const;
    };
    const years = Array.from({ length: source.syncYears!.endYear - source.syncYears!.startYear + 1 }, (_, i) => {
      const year = source.syncYears!.startYear + i;
      const sampleTs = Date.UTC(year, 5, 15, 4, 0, 0);
      const loc1 = locateBaziFortune(first.exactChart, f1, sampleTs);
      const loc2 = locateBaziFortune(second.exactChart, f2, sampleTs);
      const yearPillar = loc1.year;
      const p1SpouseRel = comparePillars(yearPillar, first.exactChart.pillars.day).map((r) => r.name);
      const p2SpouseRel = comparePillars(yearPillar, second.exactChart.pillars.day).map((r) => r.name);
      const p1Tendency = evaluateTendency(loc1.year.ganZhi, person1.usefulGod);
      const p2Tendency = evaluateTendency(loc2.year.ganZhi, person2.usefulGod);
      const p1Clash = p1SpouseRel.some((r) => r.includes('冲') || r.includes('刑'));
      const p2Clash = p2SpouseRel.some((r) => r.includes('冲') || r.includes('刑'));
      const syncAssessment = p1Tendency === '喜用' && p2Tendency === '喜用' && !p1Clash && !p2Clash
        ? '同向顺遂' as const
        : (p1Tendency === '忌神' || p1Clash) && (p2Tendency === '忌神' || p2Clash)
          ? '同步承压' as const
          : (p1Tendency === '忌神' || p1Clash || p2Tendency === '忌神' || p2Clash)
            ? '一方承压' as const
            : '中性并行' as const;
      return {
        year,
        yearGanZhi: loc1.year.ganZhi,
        person1: { dayun: loc1.cycle?.ganZhi ?? '童限', yearTendency: p1Tendency, spousePalaceRelations: p1SpouseRel },
        person2: { dayun: loc2.cycle?.ganZhi ?? '童限', yearTendency: p2Tendency, spousePalaceRelations: p2SpouseRel },
        crossDayunRelations: loc1.cycle && loc2.cycle ? comparePillars(loc1.cycle.pillar, loc2.cycle.pillar).map((r) => r.name) : [],
        syncAssessment,
      };
    });
    return {
      startYear: source.syncYears!.startYear,
      endYear: source.syncYears!.endYear,
      years,
      limitation: '流年同步按公历年中立春后干支与双方原局日支、天干喜忌比对，不含流月逐日细节，不代表必然现实事件。',
    };
  })() : undefined;
  const baseCompatibility = buildBaziCompatibility(person1.pillars, person2.pillars);
  const directionCoverage = {
    person1FromPerson2: buildDirectionCoverage(person1.usefulStrategy, person2.pillars),
    person2FromPerson1: buildDirectionCoverage(person2.usefulStrategy, person1.pillars),
  };
  const finalUsefulGodCoverage = {
    person1FromPerson2: buildUsefulGodCoverage(person1.usefulGod, person2.pillars),
    person2FromPerson1: buildUsefulGodCoverage(person2.usefulGod, person1.pillars),
  };
  const spousePalaceDeep = evaluateSpousePalaceDeep(person1.pillars, person2.pillars);
  const usefulGodComplementarity = evaluateUsefulGodComplementarity(person1.usefulGod, person1.pillars, person2.usefulGod, person2.pillars);
  const synastryBalance = buildBaziSynastryBalance({
    person1,
    person2,
    comparisons: baseCompatibility.comparisons,
    combinations: baseCompatibility.combinations,
    spousePalaceDeep,
    usefulGodComplementarity,
  });
  const p1Chart = first.fortune ? { ...person1, fortune: first.fortune, ...(first.located ? { located: first.located } : {}) } : person1;
  const p2Chart = second.fortune ? { ...person2, fortune: second.fortune, ...(second.located ? { located: second.located } : {}) } : person2;
  return { input: source, charts: { person1: p1Chart, person2: p2Chart }, compatibility: { ...baseCompatibility, directionCoverage, finalUsefulGodCoverage, spousePalaceDeep, usefulGodComplementarity, synastryBalance,
    ...(fortuneComparison ? { fortuneComparison } : {}),
    ...(annualSync ? { annualSync } : {}) },
    ...(source.compareCandidates ? { candidateComparison: aggregateBaziCompatibility(first.variants, second.variants, source.comparisonPage) } : {}) };
}
type BaseCompatibility = ReturnType<typeof buildBaziCompatibility>;
type SpousePalaceDeep = ReturnType<typeof evaluateSpousePalaceDeep>;
type UsefulGodComp = ReturnType<typeof evaluateUsefulGodComplementarity>;
type ChartLike = {
  pillars: Record<PillarName, { gan: string; zhi: string; ganZhi: string; stemElement: string; branchElement: string }>;
  usefulGod: ReturnType<typeof determineUsefulGod>;
};

export interface BaziSynastryBalanceResult {
  usefulDirection: '双向互补' | '单向补益（第一人补第二人）' | '单向补益（第二人补第一人）' | '未见有效互补' | '用神未完整裁定';
  usefulSummary: string;
  usefulTensions: string[];
  dayPillarPattern: '天地德合' | '天克地冲' | '合中有冲（外合内冲）' | '克中有合（外克内合）' | '日柱合和' | '日柱冲刑害' | '日柱平和';
  dayPillarRelations: string[];
  monthPillarRelations: string[];
  crossPillarModulations: string[];
  harmonyCount: number;
  clashHarmCount: number;
  overallBalanceTag: '合多于冲' | '冲刑多于合' | '合冲并见' | '干支平和';
}

function collectElementCounts(pillars: ChartLike['pillars'], targets: readonly string[]): Array<{ element: string; count: number }> {
  const counts = new Map<string, number>();
  for (const el of targets) counts.set(el, 0);
  for (const pos of positions) {
    const p = pillars[pos];
    if (counts.has(p.stemElement)) counts.set(p.stemElement, (counts.get(p.stemElement) ?? 0) + 1);
    if (counts.has(p.branchElement)) counts.set(p.branchElement, (counts.get(p.branchElement) ?? 0) + 1);
  }
  return [...counts.entries()].map(([element, count]) => ({ element, count }));
}

export function buildBaziSynastryBalance(input: {
  person1: ChartLike;
  person2: ChartLike;
  comparisons: BaseCompatibility['comparisons'];
  combinations: BaseCompatibility['combinations'];
  spousePalaceDeep: SpousePalaceDeep;
  usefulGodComplementarity: UsefulGodComp;
}): BaziSynastryBalanceResult {
  const { person1, person2, comparisons, combinations, spousePalaceDeep, usefulGodComplementarity } = input;
  const p1Fav = person1.usefulGod.favorableWuxing ?? [];
  const p2Fav = person2.usefulGod.favorableWuxing ?? [];
  const p1Avoid = person1.usefulGod.unfavorableWuxing ?? [];
  const p2Avoid = person2.usefulGod.unfavorableWuxing ?? [];

  const p1FavInP2 = collectElementCounts(person2.pillars, p1Fav);
  const p2FavInP1 = collectElementCounts(person1.pillars, p2Fav);
  const p1Got = usefulGodComplementarity.person1CoveredByPerson2Count;
  const p2Got = usefulGodComplementarity.person2CoveredByPerson1Count;
  const p1AvoidGot = usefulGodComplementarity.person1AvoidCountInPerson2;
  const p2AvoidGot = usefulGodComplementarity.person2AvoidCountInPerson1;

  let usefulDirection: BaziSynastryBalanceResult['usefulDirection'];
  if (usefulGodComplementarity.dataStatus !== '完整') {
    usefulDirection = '用神未完整裁定';
  } else if (p1Got > 0 && p2Got > 0) {
    usefulDirection = '双向互补';
  } else if (p2Got > 0 && p1Got === 0) {
    usefulDirection = '单向补益（第一人补第二人）';
  } else if (p1Got > 0 && p2Got === 0) {
    usefulDirection = '单向补益（第二人补第一人）';
  } else {
    usefulDirection = '未见有效互补';
  }

  const fmtHits = (items: Array<{ element: string; count: number }>) =>
    items.filter((x) => x.count > 0).map((x) => `${x.element}${x.count}处`).join('、') || '无主气命中';

  const usefulSummary =
    usefulDirection === '用神未完整裁定'
      ? `用神数据状态「${usefulGodComplementarity.dataStatus}」，待补齐后核定单向/双向互补`
      : `${usefulDirection}：第一人喜用（${p1Fav.join('、')}）得第二人主气补益［${fmtHits(p1FavInP2)}］（兼带第一人忌神${p1AvoidGot}处）；第二人喜用（${p2Fav.join('、')}）得第一人主气补益［${fmtHits(p2FavInP1)}］（兼带第二人忌神${p2AvoidGot}处）`;

  const usefulTensions: string[] = [];
  const p1FavVsP2Avoid = p1Fav.filter((el) => p2Avoid.includes(el));
  const p2FavVsP1Avoid = p2Fav.filter((el) => p1Avoid.includes(el));
  if (p1FavVsP2Avoid.length) {
    usefulTensions.push(`喜忌对冲：第一人喜用「${p1FavVsP2Avoid.join('、')}」为第二人忌神（同环境/流年旺${p1FavVsP2Avoid.join('、')}时一顺一压）`);
  }
  if (p2FavVsP1Avoid.length) {
    usefulTensions.push(`喜忌对冲：第二人喜用「${p2FavVsP1Avoid.join('、')}」为第一人忌神（同环境/流年旺${p2FavVsP1Avoid.join('、')}时一顺一压）`);
  }
  if (usefulGodComplementarity.dataStatus === '完整' && p1AvoidGot > p1Got) {
    usefulTensions.push(`补喜兼带忌：第二人盘中第一人忌神（${p1AvoidGot}处）多于喜用（${p1Got}处），助力与压力并存`);
  }
  if (usefulGodComplementarity.dataStatus === '完整' && p2AvoidGot > p2Got) {
    usefulTensions.push(`补喜兼带忌：第一人盘中第二人忌神（${p2AvoidGot}处）多于喜用（${p2Got}处），助力与压力并存`);
  }

  const dayPair = comparisons.find((pair) => pair.person1Pillar === 'day' && pair.person2Pillar === 'day');
  const monthPair = comparisons.find((pair) => pair.person1Pillar === 'month' && pair.person2Pillar === 'month');
  const dayRels = (dayPair?.relations ?? []).map((r) => (r.subtype ? `${r.name}（${r.subtype}）` : r.name));
  const monthRels = (monthPair?.relations ?? []).map((r) => (r.subtype ? `${r.name}（${r.subtype}）` : r.name));

  const dayHasStemHe = dayRels.some((r) => r.includes('天干五合'));
  const dayHasStemChongOrKe = spousePalaceDeep.stemRelation === '天干冲' || spousePalaceDeep.stemRelation === '相克';
  const dayHasBranchHe = dayRels.some((r) => r.includes('地支六合'));
  const dayHasBranchClash = dayRels.some((r) => r.includes('地支六冲') || r.includes('地支相刑') || r.includes('地支六害'));

  let dayPillarPattern: BaziSynastryBalanceResult['dayPillarPattern'];
  if (spousePalaceDeep.isTianDeHe) dayPillarPattern = '天地德合';
  else if (spousePalaceDeep.isTianKeDiChong) dayPillarPattern = '天克地冲';
  else if (dayHasStemHe && dayHasBranchClash) dayPillarPattern = '合中有冲（外合内冲）';
  else if (dayHasStemChongOrKe && dayHasBranchHe) dayPillarPattern = '克中有合（外克内合）';
  else if (dayHasStemHe || dayHasBranchHe) dayPillarPattern = '日柱合和';
  else if (dayHasBranchClash) dayPillarPattern = '日柱冲刑害';
  else dayPillarPattern = '日柱平和';

  const crossPillarModulations: string[] = [];
  const d1Zhi = person1.pillars.day.zhi;
  const d2Zhi = person2.pillars.day.zhi;

  // 检查“冲中有合”：双方日支相冲/刑/害时，是否有别柱六合或跨盘三合三会涉及日支以缓冲
  if (dayHasBranchClash) {
    const relievingPairs = comparisons.filter(
      (pair) =>
        !(pair.person1Pillar === 'day' && pair.person2Pillar === 'day') &&
        (pair.person1Pillar === 'day' || pair.person2Pillar === 'day') &&
        pair.relations.some((r) => r.name === '地支六合'),
    );
    const relievingGroups = combinations.filter((group) =>
      group.members.some((m) => m.sources.some((s) => s.pillar === 'day')),
    );
    const buffers: string[] = [
      ...relievingPairs.map((pair) => `第一人${labels[pair.person1Pillar]}${pair.person1GanZhi}与第二人${labels[pair.person2Pillar]}${pair.person2GanZhi}地支六合`),
      ...relievingGroups.map((g) => `跨盘${g.members.map((m) => m.branch).join('')}${g.name}${g.element}`),
    ];
    if (buffers.length) {
      crossPillarModulations.push(`冲中有合（贪合减冲）：日支${d1Zhi}/${d2Zhi}虽见冲刑害，但别柱见${buffers.slice(0, 2).join('、')}，形成合解缓冲条件`);
    } else {
      crossPillarModulations.push(`日支${d1Zhi}/${d2Zhi}冲刑害无别柱六合或跨盘合局直接化解，须待岁运合支调和`);
    }
  }

  // 检查“合中有冲”：双方日支六合或天地德合时，别柱是否冲刑日支
  if (dayHasBranchHe || dayHasStemHe) {
    const disruptingPairs = comparisons.filter(
      (pair) =>
        !(pair.person1Pillar === 'day' && pair.person2Pillar === 'day') &&
        (pair.person1Pillar === 'day' || pair.person2Pillar === 'day') &&
        pair.relations.some((r) => r.name === '地支六冲' || r.name === '地支相刑' || r.name === '地支六害'),
    );
    if (disruptingPairs.length) {
      const items = disruptingPairs
        .slice(0, 2)
        .map((pair) => `第一人${labels[pair.person1Pillar]}${pair.person1GanZhi}与第二人${labels[pair.person2Pillar]}${pair.person2GanZhi}（${pair.relations.filter((r) => /冲|刑|害/.test(r.name)).map((r) => r.name).join('、')}）`);
      crossPillarModulations.push(`合中有冲（别柱牵制）：日柱虽见合和，但别柱${items.join('；')}对日支构成冲刑害牵制`);
    }
  }

  // 检查月柱（提纲）制衡
  const monthHasHe = monthRels.some((r) => r.includes('合'));
  const monthHasClash = monthRels.some((r) => /冲|刑|害/.test(r));
  if (monthHasHe && dayHasBranchClash) {
    crossPillarModulations.push(`月柱相合（${monthRels.join('、')}）缓冲日柱冲刑：现实大方向与原生节奏具相容基础`);
  } else if (monthHasClash && (dayHasBranchHe || dayHasStemHe)) {
    crossPillarModulations.push(`日柱相合而月柱冲刑（${monthRels.join('、')}）：近距离相吸但原生节奏/背景存在磨合张力`);
  } else if (monthHasClash) {
    crossPillarModulations.push(`双方月柱（提纲）见${monthRels.join('、')}：原生节奏与处事惯性易有摩擦`);
  } else if (monthHasHe) {
    crossPillarModulations.push(`双方月柱（提纲）见${monthRels.join('、')}：原生环境与节奏基调相合`);
  }

  let harmonyCount = combinations.length;
  let clashHarmCount = 0;
  for (const pair of comparisons) {
    for (const rel of pair.relations) {
      if (rel.name === '天干五合' || rel.name === '地支六合') harmonyCount++;
      else if (rel.name === '天干相冲' || rel.name === '地支六冲' || rel.name === '地支相刑' || rel.name === '地支六害') clashHarmCount++;
    }
  }

  const overallBalanceTag: BaziSynastryBalanceResult['overallBalanceTag'] =
    harmonyCount === 0 && clashHarmCount === 0
      ? '干支平和'
      : harmonyCount > clashHarmCount && clashHarmCount > 0
        ? '合多于冲'
        : clashHarmCount > harmonyCount && harmonyCount > 0
          ? '冲刑多于合'
          : harmonyCount > 0 && clashHarmCount === 0
            ? '合多于冲'
            : clashHarmCount > 0 && harmonyCount === 0
              ? '冲刑多于合'
              : '合冲并见';

  return {
    usefulDirection,
    usefulSummary,
    usefulTensions,
    dayPillarPattern,
    dayPillarRelations: dayRels,
    monthPillarRelations: monthRels,
    crossPillarModulations,
    harmonyCount,
    clashHarmCount,
    overallBalanceTag,
  };
}

function formatBaziSynastryBalance(balance: BaziSynastryBalanceResult, persons: { person1: string; person2: string }): string {
  const replaceNames = (text: string) =>
    text.replace(/第一人/g, persons.person1).replace(/第二人/g, persons.person2);
  const lines = [
    `- 喜用互补方向：${replaceNames(balance.usefulSummary)}。`,
    ...(balance.usefulTensions.length
      ? [`- 喜忌张力条件：${balance.usefulTensions.map(replaceNames).join('；')}。`]
      : ['- 喜忌张力条件：未见显著喜忌对冲或忌重于喜失衡。']),
    `- 日柱与月柱互动：日柱呈「${balance.dayPillarPattern}」（${balance.dayPillarRelations.join('、') || '无直接刑冲合害'}）；月柱（提纲）为「${balance.monthPillarRelations.join('、') || '无直接刑冲合害'}」。`,
    `- 干支合冲制衡：全盘跨柱合类（五合/六合/跨盘三合三会）${balance.harmonyCount} 处 vs 冲刑害类 ${balance.clashHarmCount} 处（${balance.overallBalanceTag}）${balance.crossPillarModulations.length ? `；${balance.crossPillarModulations.map(replaceNames).join('；')}` : ''}。`,
  ];
  return lines.join('\n');
}

type Data = Awaited<ReturnType<typeof buildData>>;
function formatComparison(comparison: NonNullable<Data['candidateComparison']>, persons: { person1: string; person2: string }, full: boolean) {
  const factText = (item: typeof comparison.common[number]) => {
    const fact = item.fact;
    let detail: string;
    if (fact.kind === '跨柱关系') detail = `${persons.person1}${labels[fact.person1Pillar]}与${persons.person2}${labels[fact.person2Pillar]}：${fact.values.join('、')}${fact.name}${fact.subtype ? `（${fact.subtype}）` : ''}`;
    else if (fact.kind === '日主关系') detail = `日主${fact.value.person1Stem}与${fact.value.person2Stem}：${fact.value.person1ToPerson2}/${fact.value.person2ToPerson1}`;
    else if (fact.kind === '双向十神') detail = `${persons[fact.value.observer]}观察${persons[fact.value.source]}${labels[fact.value.pillar]}：${fact.value.stem}${fact.value.stemTenGod}、${fact.value.branch}本气${fact.value.mainStem}${fact.value.branchMainTenGod}`;
    else detail = `${fact.value.members.map((member) => member.branch).join('')}${fact.value.name}${fact.value.element}；${fact.value.members.map((member) => `${member.branch}来自${member.sources.map((source) => `${persons[source.person]}${labels[source.pillar]}`).join('、')}`).join('；')}`;
    return `${fact.kind}｜${detail}｜${item.count}/${comparison.total}组；示例索引${item.example.person1Index ?? '精确'}/${item.example.person2Index ?? '精确'}`;
  };
  const variable = full ? comparison.variable : comparison.variable.slice(0, 20);
  return `【全部候选组合比较】\n双方候选分别 ${comparison.person1Candidates} 与 ${comparison.person2Candidates} 段，共 ${comparison.total} 组。\n共同事实（每组均出现）：\n${comparison.common.map(factText).join('\n') || '无'}\n变化事实（当前页 ${comparison.variable.length} / 全部 ${comparison.variableTotal} 条，偏移 ${comparison.page.offset}）：\n${variable.map(factText).join('\n') || '无'}${comparison.variable.length > variable.length ? `\n本页另有 ${comparison.variable.length - variable.length} 条变化事实保存在结构化结果；可用 detailMode=full 列出本页。` : ''}${comparison.page.nextOffset === null ? '' : `\n下一页 comparisonPage.offset=${comparison.page.nextOffset}。`}\n${comparison.limitation}`;
}
function render(data: Data, question: string, options: Input['prompt']) {
  const { charts, compatibility } = data, persons = { person1: data.input.person1.name ?? '第一人', person2: data.input.person2.name ?? '第二人' };
  const personClassics = (id: 'person1' | 'person2') => {
    const chart = charts[id];
    if (chart) return selectBaziClassics(chart.pillars.day.gan, chart.ordinaryPattern.candidate, chart.pillars.month.zhi);
    return (data.candidates?.[id] ?? []).flatMap((item) => selectBaziClassics(item.pillars.day.slice(0, 1), undefined, item.pillars.month.slice(1, 2)));
  };
  const classics = options?.includeClassics
    ? formatClassicExcerpts(dedupeExcerpts([...personClassics('person1'), ...personClassics('person2')]), '典籍片段')
    : '';
  if (!compatibility || !charts.person1 || !charts.person2) {
    const comparison = data.candidateComparison!;
    const schools = [...new Set(options?.schools ?? [])].map((id) => `${baziSchools[id].label}：${baziSchools[id].task}`);
    const candidateText = (id: 'person1' | 'person2') => {
      const candidates = data.candidates?.[id] ?? [];
      if (!candidates.length) return `${persons[id]}：精确出生，不需要候选索引。`;
      const selected = data.input[id].candidateIndex;
      return `${persons[id]}：${selected === undefined ? '未选定' : `当前索引 ${selected}`}；候选如下（UTC，终点不含）：\n${candidates.map((item) =>
        `索引 ${item.index}｜${new Date(item.startTimestamp).toISOString()} 至 ${new Date(item.endTimestamp).toISOString()}｜${positions.map((position) => item.pillars[position]).join(' ')}｜司权${item.monthCommander}`).join('\n')}`;
    };
    const text = [`【八字双盘候选比较】\n出生时段尚未全部选定，不将任一候选视为确定出生时间。指定双方候选后可查看逐项双盘。`,
      `【出生候选】\n${candidateText('person1')}\n${candidateText('person2')}`,
      formatComparison(comparison, persons, options?.detailMode === 'full'),
      `【资料缺口】\n比较仅覆盖日主、跨柱、三合三会和双向十神等结构事实，不包含最终喜忌、神煞汇总或双方岁运；次数不是出生概率。`,
      schools.length ? `【解读口径】\n${schools.join('\n')}` : '',
      classics,
      `【${relationTasks[data.input.relationship].label}任务】\n${relationTasks[data.input.relationship].task} 区分盘面事实、传统取象和现实信息，不虚构已选候选。`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
    return { text };
  }
  const isFull = options?.detailMode === 'full';
  const chartText = (id: 'person1' | 'person2') => {
    const chart = charts[id];
    const pillars = positions.map((p) => { const item = chart.pillars[p]; return `${labels[p]}${item.ganZhi}（${item.tenGod}，藏${item.hiddenStems.map((hidden) => `${hidden.stem}${hidden.tenGod}`).join('、')}）`; });
    const birth = chart.candidate ? `候选时段 ${chart.candidate.index + 1}/${chart.candidate.total}：${new Date(chart.candidate.startTimestamp).toISOString()} 至 ${new Date(chart.candidate.endTimestamp).toISOString()}（终点不含），当地起点${chart.basis.localDateTime}；${chart.candidate.nextIndex === null ? '已是最后一个候选' : `下一候选索引${chart.candidate.nextIndex}`}；不能当作确定出生时刻或代表全部候选` : `出生钟表${chart.basis.localDateTime}`;
    const specialParts = [
      chart.transformation ? `化气${chart.transformation.pattern}（${chart.transformation.status}）` : isFull ? '化气未见日干配合' : '',
      chart.quzhi ? `曲直${chart.quzhi.route}（${chart.quzhi.status}）` : isFull ? '曲直未命中' : '',
      chart.conger?.route ? `从儿${chart.conger.route}（${chart.conger.status}）` : isFull ? '从儿未命中' : '',
      chart.conger?.competingWealth ? `从财优先${chart.conger.competingWealth}` : isFull ? '从财优先未命中' : '',
    ].filter(Boolean);
    const genderLabel = data.input[id].gender === 'male' ? '乾造（男）' : data.input[id].gender === 'female' ? '坤造（女）' : '';
    return `${persons[id]}：${genderLabel ? `性别${genderLabel}；` : ''}${birth}；时区${chart.basis.timeZoneId ?? `UTC${chart.basis.timezone >= 0 ? '+' : ''}${chart.basis.timezone}`}；日时依据${chart.basis.timeStandard === 'true-solar' ? '真太阳时' : '民用时间'}。\n${pillars.join('；')}；月令司权${chart.monthCommander.stem}；日主${chart.pillars.day.gan}${chart.pillars.day.stemElement}；旺衰模型${chart.strength.status}（月令${chart.strength.tendencies.month}、根气${chart.strength.tendencies.root}、结构${chart.strength.tendencies.structure}）；普通取格候选${chart.ordinaryPattern.candidate}（${chart.ordinaryPattern.source}）；${specialParts.length ? `${specialParts.join('；')}；` : ''}已核算路线优先${chart.patternOverview.pattern}；取用基础取向：有利${chart.usefulBaseline.favorable.join('、') || '待判'}，不利${chart.usefulBaseline.unfavorable.join('、') || '待判'}；${summarizeClimate(chart.climate)}。\n通根：${chart.natalFacts.roots.map((root) => `${labels[root.position]}${root.stem}${root.status}`).join('、')}。`;
  };
  const dm = compatibility.dayMasterRelation;
  const nayinAndSpousePalaceSummary = (() => {
    const y1 = charts.person1.pillars.year;
    const y2 = charts.person2.pillars.year;
    const d1 = charts.person1.pillars.day;
    const d2 = charts.person2.pillars.day;
    const nyEl1 = y1.naYin.slice(-1);
    const nyEl2 = y2.naYin.slice(-1);
    const dayPair = compatibility.comparisons.find(
      (pair) => pair.person1Pillar === 'day' && pair.person2Pillar === 'day',
    );
    const dayRelText = dayPair?.relations.length
      ? dayPair.relations.map((r) => r.name).join('、')
      : '无直接刑冲合害';
    const sp = compatibility.spousePalaceDeep;
    const spBadge = sp.isTianDeHe ? '（天地德合）' : sp.isTianKeDiChong ? '（天克地冲）' : '';
    return [
      `年命纳音合参：${persons.person1}年柱${y1.ganZhi}（${y1.naYin}）与${persons.person2}年柱${y2.ganZhi}（${y2.naYin}），纳音五行（${nyEl1}与${nyEl2}）供传统年命参考。`,
      `夫妻宫（日支）专论${spBadge}：${persons.person1}日支${d1.zhi}（本气${d1.hiddenStems[0]?.tenGod ?? ''}，自坐${d1.selfLifeStage}）与${persons.person2}日支${d2.zhi}（本气${d2.hiddenStems[0]?.tenGod ?? ''}，自坐${d2.selfLifeStage}），两盘日柱关系为：${dayRelText}；${sp.judgment}`,
    ].join('\n');
  })();
  const relations = compatibility.comparisons.filter((pair) => pair.relations.length).map((pair) => `${persons.person1}${labels[pair.person1Pillar]}${pair.person1GanZhi}与${persons.person2}${labels[pair.person2Pillar]}${pair.person2GanZhi}：${pair.relations.map((r) => r.name).join('、')}`);
  const groups = compatibility.combinations.map((item) => `${item.members.map((m) => m.branch).join('')}${item.name}${item.element}；${item.members.map((m) => `${m.branch}来自${m.sources.map((s) => `${persons[s.person]}${labels[s.pillar]}`).join('、')}`).join('；')}`);
  const mappings = (['person1', 'person2'] as const).map((obs) => {
    const tgt = obs === 'person1' ? 'person2' : 'person1';
    const items = compatibility.tenGodMappings
      .filter((item) => item.observer === obs)
      .map((item) => `${labels[item.pillar]}（干${item.stem}${item.stemTenGod}/支${item.branch}${item.branchMainTenGod}）`);
    return `${persons[obs]}观察${persons[tgt]}：${items.join('、')}`;
  });
  const schools = [...new Set(options?.schools ?? [])].map((id) => `${baziSchools[id].label}：${baziSchools[id].task}`);
  const task = relationTasks[data.input.relationship];
  const situationLines = buildMethodSituationDigest('bazi-synastry', data, question);
  const comparison = data.candidateComparison;
  const fc = compatibility.fortuneComparison;
  const fortuneText = fc ? [
    `【双方岁运合参】`,
    `参考时刻：${fc.referenceTime}；流年：${fc.sharedYear}，流月：${fc.sharedMonth}。`,
    `${persons.person1}：当前${fc.person1.dayun ? `大运${fc.person1.dayun.ganZhi}（天干${fc.person1.dayun.stemElement}属${fc.person1.dayun.stemTendency}）` : '童限'}；流年天干${fc.person1.yearTendency.stemElement}属${fc.person1.yearTendency.stemTendency}。`,
    `${persons.person2}：当前${fc.person2.dayun ? `大运${fc.person2.dayun.ganZhi}（天干${fc.person2.dayun.stemElement}属${fc.person2.dayun.stemTendency}）` : '童限'}；流年天干${fc.person2.yearTendency.stemElement}属${fc.person2.yearTendency.stemTendency}。`,
    `双方大运跨柱关系：${fc.crossDayunRelations.map((r) => r.name).join('、') || '无直接合冲刑害'}。`,
  ].join('\n') : '';
  const sync = compatibility.annualSync;
  const syncText = sync ? [
    `【双方多年流年同步（${sync.startYear}–${sync.endYear}）】`,
    ...sync.years.map((item) =>
      `${item.year} ${item.yearGanZhi}年（${item.syncAssessment}）：${persons.person1}[大运${item.person1.dayun}，流年${item.person1.yearTendency}${item.person1.spousePalaceRelations.length ? `，日支${item.person1.spousePalaceRelations.join('、')}` : ''}]；${persons.person2}[大运${item.person2.dayun}，流年${item.person2.yearTendency}${item.person2.spousePalaceRelations.length ? `，日支${item.person2.spousePalaceRelations.join('、')}` : ''}]${item.crossDayunRelations.length ? `；大运关系：${item.crossDayunRelations.join('、')}` : ''}。`,
    ),
    sync.limitation,
  ].join('\n') : '';
  const text = [
    `【八字双盘合盘】\n${chartText('person1')}\n${chartText('person2')}`,
    situationLines.length ? `【局势要点】\n${situationLines.join('\n')}` : '',
    `【双方取用条件候选】\n${persons.person1}：${summarizeUsefulStrategy(charts.person1.usefulStrategy)}\n${persons.person2}：${summarizeUsefulStrategy(charts.person2.usefulStrategy)}`,
    `【双方条件候选与对方盘面】\n${persons.person1}的条件候选在${persons.person2}盘中：${formatDirectionCoverage(compatibility.directionCoverage.person1FromPerson2)}\n${persons.person2}的条件候选在${persons.person1}盘中：${formatDirectionCoverage(compatibility.directionCoverage.person2FromPerson1)}`,
    `【双方用神裁定与跨盘覆盖】\n互补等级：${compatibility.usefulGodComplementarity.level}（${compatibility.usefulGodComplementarity.judgment.replace(/第一人/g, persons.person1).replace(/第二人/g, persons.person2)}）\n${persons.person1}用神在${persons.person2}盘中：${formatUsefulGodCoverage(compatibility.finalUsefulGodCoverage.person1FromPerson2)}\n${persons.person2}用神在${persons.person1}盘中：${formatUsefulGodCoverage(compatibility.finalUsefulGodCoverage.person2FromPerson1)}`,
    `【双盘喜忌互补与干支制衡关系】\n${formatBaziSynastryBalance(compatibility.synastryBalance, persons)}`,
    `【双方格局透干条件】\n${persons.person1}：${formatPatternEvidence(charts.person1.patternEvidence)}\n${persons.person2}：${formatPatternEvidence(charts.person2.patternEvidence)}`,
    `【双方日主】\n${persons.person1}日主${dm.person1Stem}${dm.person1Element}对${persons.person2}日主${dm.person2Stem}${dm.person2Element}：${dm.person1ToPerson2}；反向：${dm.person2ToPerson1}。对方日干相对各自日主分别为${dm.person2AsPerson1TenGod}、${dm.person1AsPerson2TenGod}。\n${nayinAndSpousePalaceSummary}`,
    `【跨柱关系】\n${relations.join('；') || '未命中所列跨柱关系。'}`,
    `【跨盘三合三会】\n${groups.join('\n') || '未见所列跨盘三合三会成员齐备。'}`,
    `【双向十神】\n${mappings.join('\n')}`,
    fortuneText,
    syncText,
    comparison ? formatComparison(comparison, persons, options?.detailMode === 'full') : '',
    `【双方本命神煞】\n${persons.person1}：${formatBaziShenshaHits(charts.person1.shensha, options?.detailMode === 'full')}\n${persons.person2}：${formatBaziShenshaHits(charts.person2.shensha, options?.detailMode === 'full')}\n${options?.detailMode === 'full' ? `${charts.person1.shensha.rule}\n` : ''}${persons.person1}：${charts.person1.shensha.limitation}\n${persons.person2}：${charts.person2.shensha.limitation}`,
    `【资料缺口】\n旺衰、化气、曲直、从儿、普通格局成败及用神裁定采用所列条件模型；${fc ? '双方大运与流年已按参考时刻比较。' : '未提供参考时刻时未展开双方动态岁运对比。'}${charts.person1.candidate || charts.person2.candidate ? comparison ? '所选盘面的逐项关系仅适用于当前组合；全部候选比较见上。' : '当前仅分析所选候选组合，不代表其他时段组合。' : ''}${compatibility.limitation}`,
    schools.length ? `【解读口径】\n${schools.join('\n')}` : '',
    classics,
    `【${task.label}任务】\n${task.focus}\n${task.task} 区分双方盘面事实、传统取象和现实信息；对缺失资料标注待核。`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text };
}
export async function baziSynastryIndependent(input: Input, context?: RuntimeContext) {
  const data = await buildData(input, context);
  return { data, summary: { title: '八字双人合盘', lines: data.compatibility && data.charts.person1 && data.charts.person2
    ? [`第一人日柱：${data.charts.person1.pillars.day.ganZhi}`, `第二人日柱：${data.charts.person2.pillars.day.ganZhi}`]
    : [`双方出生候选共 ${data.candidateComparison!.total} 组`, '尚未选定完整双盘。'] }, prompt: render(data, input.question, input.prompt) };
}
export async function promptForSavedBaziSynastryIndependent(data: unknown, input: Source, question: string, options: Input['prompt'], context?: RuntimeContext) {
  const expected = await buildData(input, context);
  if (!sameJsonValue(data, expected)) throw new Error('八字双盘结果与双方出生资料不一致。');
  return render(expected, question, options);
}
