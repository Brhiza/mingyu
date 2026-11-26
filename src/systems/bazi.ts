import type { z } from 'zod';
import type { baziIndependentInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { resolveBaziRules } from './defaults';
import { calculateBaziPillars, type PillarName } from './bazi/pillars';
import { calculateBaziFortune, locateBaziFortune } from './bazi/fortune';
import { calculateBaziTimeRange, calculateUnknownBaziTime } from './bazi/unknown-time';
import { baziPromptTask } from './bazi/prompt-options';
import { buildSchoolConsensusSummary, evaluateBaziSchoolAlgorithms } from './bazi/school-algorithms';
import { formatSchoolAlgorithmSection } from './school-algorithms';
import { buildFortuneEvidence } from './bazi/fortune-evidence';
import { stemElementOf } from './bazi/natal-facts';
import { formatTransformation } from './bazi/transformation';
import { formatQuzhi } from './bazi/quzhi';
import { formatCongEr } from './bazi/conger';
import { formatExtremePattern } from './bazi/extreme';
import { formatUsefulBaseline } from './bazi/useful-baseline';
import { summarizeClimate } from './bazi/climate';
import { formatClimateDecision, summarizeClimateDecision } from './bazi/climate-decision';
import { formatUsefulStrategy, summarizeUsefulStrategy } from './bazi/useful-strategy';
import { determineUsefulGod, formatUsefulGod } from './bazi/useful-god';
import { formatPatternEvidence } from './bazi/pattern-evidence';
import { buildPatternRelations, formatPatternRelations } from './bazi/pattern-relations';
import { buildCompactFortuneDynamics, formatCompactFortuneDynamics } from './bazi/fortune-compact';
import { formatBaziDailyRangeBlock, resolveDailyRange } from './daily-range';
import { formatFortuneShensha } from './bazi/fortune-shensha';
import { formatBaziShensha, formatBaziShenshaHits, partitionBaziShensha } from './bazi/shensha';
import { dedupeExcerpts, formatClassicExcerpts, selectBaziClassics } from './classics';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof baziIndependentInput>;
type Source = Pick<Input, 'birth' | 'birthRange' | 'gender' | 'referenceTime' | 'timelineYear' | 'dailyRange' | 'rules'>;
type Options = Input['prompt'];
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<string, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const layerLabels: Record<string, string> = { year: '流年', month: '流月', day: '流日', hour: '流时', dayun: '大运', 'natal-year': '原局年柱', 'natal-month': '原局月柱', 'natal-day': '原局日柱', 'natal-hour': '原局时柱' };
const iso = (timestamp: number) => new Date(timestamp).toISOString();

function formatRuleSummary(rules: Input['rules']) {
  const resolved = resolveBaziRules(rules);
  const tr = (map: Record<string, string>, val: string) => map[val] ?? val;
  const yearLabels = { lichun: '立春', 'lunar-new-year': '正月初一', dongzhi: '冬至' };
  const ziHourLabels = { '23:00': '23点换日', 'split-zi': '早晚子分日', '00:00': '0点换日' };
  const nightZiLabels = { 'next-day': '次日干', 'current-day': '当日干' };
  const termLabels = { 'exact-instant': '交节瞬时', 'civil-day': '交节当日整日' };
  const patternLabels = { standard: '常规取格', 'main-qi-first': '本气优先', 'special-first': '外格优先' };
  const mingGongLabels = { traditional: '古法命宫', 'solar-position': '过宫按节气真太阳', 'ziwei-sync': '紫微同步' };
  const kongWangLabels = { day: '日柱旬空', 'day-and-year': '年日互换' };
  const fortuneLabels = { 'exact-3days': '三天折一年（精确）', 'round-day': '三天折一年（取整）', 'whole-day': '三天折一年（取整）', 'year-only': '按年折算' };
  const earthLabels = { 'follow-fire': '土随火行', 'follow-water': '土随水行', 'follow-wood': '土随木行', independent: '土分阴阳独立' };
  const optMap: Record<string, string> = {
    standard: '通行',
    classic: '古法',
    'all-stems': '十干均论',
    'yang-only': '仅论阳干',
    'yang-stems': '仅论阳干',
    'all-stems-guandai': '十干带冠带',
    'year-and-day': '年日并查',
    'day-only': '仅查日支',
    'year-only': '仅查年支',
    nayin: '纳音',
    'stem-changsheng': '天干长生',
    'zheng-xuetang': '正学堂',
    'nayin-and-stem': '纳音兼天干',
    'classical-geng-yinwu': '古诀甲戊丑未庚辛寅午',
    'jingji-variant': '京氏变例',
    'yi-shen': '依神',
    'hour-only': '仅查时支',
    'strict-both': '季月纳音同中',
    yuanhai: '渊海',
    'day-stem': '日干',
    ziping: '子平',
    traditional: '古法',
    expanded: '扩展',
    branch: '地支',
    season: '季月',
  };
  return [
    `换年=${tr(yearLabels, resolved.yearBoundary)}`,
    `子时=${tr(ziHourLabels, resolved.ziHourMode)}`,
    `晚子时干=${tr(nightZiLabels, resolved.nightZiStemMode)}`,
    `节气=${tr(termLabels, resolved.solarTermMode)}`,
    `格局=${tr(patternLabels, resolved.patternMode)}`,
    `命宫=${tr(mingGongLabels, resolved.mingGongMethod)}`,
    `辅助宫位=${resolved.includeExtraPalaces ? '开启' : '关闭'}`,
    `旬空=${tr(kongWangLabels, resolved.kongWangMode)}`,
    `起运=${tr(fortuneLabels, resolved.fortuneRule)}`,
    ...(rules?.yangRenMode ? [`羊刃=${tr(optMap, rules.yangRenMode)}`] : []),
    ...(rules?.shenshaBaseMode ? [`神煞基准=${tr(optMap, rules.shenshaBaseMode)}`] : []),
    ...(rules?.xueTangMode ? [`学堂=${tr(optMap, rules.xueTangMode)}`] : []),
    ...(rules?.tianYiMode ? [`天乙=${tr(optMap, rules.tianYiMode)}`] : []),
    ...(rules?.tianGuanMode ? [`天官=${tr(optMap, rules.tianGuanMode)}`] : []),
    ...(rules?.hongYanMode ? [`红艳=${tr(optMap, rules.hongYanMode)}`] : []),
    ...(rules?.tongZiMode ? [`童子=${tr(optMap, rules.tongZiMode)}`] : []),
    ...(rules?.commanderMode ? [`司令=${tr(optMap, rules.commanderMode)}`] : []),
    ...(rules?.earthRule ? [`土行长生=${tr(earthLabels, rules.earthRule)}`] : []),
  ].join('，');
}

export async function calculateBaziIndependentData(input: Source) {
  const source = {
    ...(input.birth ? { birth: input.birth } : {}),
    ...(input.birthRange ? { birthRange: input.birthRange } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.referenceTime ? { referenceTime: input.referenceTime } : {}),
    ...(input.timelineYear !== undefined ? { timelineYear: input.timelineYear } : {}),
    ...(input.dailyRange ? { dailyRange: input.dailyRange } : {}),
    ...(input.rules ? { rules: input.rules } : {}),
  };
  if (source.birthRange) {
    const { start, end, pillars, ...settings } = source.birthRange;
    const unknown = await calculateBaziTimeRange({ ...settings, startTimestamp: Date.parse(start), endTimestamp: Date.parse(end) }, source.gender);
    if (pillars && unknown.segments.some((segment) => positions.some((position) => segment.pillars[position].ganZhi !== pillars[position]))) throw new Error('出生范围内的干支与所给四柱来源不一致。');
    return { input: source, chart: null, unknown, fortune: null, located: null };
  }
  if (!source.birth) throw new Error('缺少出生资料或出生范围。');
  if (source.birth.clock.kind !== 'exact') {
    const { clock, ...birth } = source.birth;
    return { input: source, chart: null, unknown: await calculateUnknownBaziTime({ ...birth, ...(clock.kind === 'shichen' ? { shichenIndex: clock.index } : {}) }, source.gender), fortune: null, located: null };
  }
  const baseChart = await calculateBaziPillars({ ...source.birth, clock: source.birth.clock }, source.gender, source.rules);
  const chart = { ...baseChart, usefulGod: determineUsefulGod(baseChart) };
  const fortune = source.gender && source.birth.clock.kind === 'exact' ? calculateBaziFortune(chart, source.gender, source.rules?.fortuneRule) : null;
  const resolvedRules = resolveBaziRules(source.rules);
  const located = source.referenceTime && fortune
    ? locateBaziFortune(chart, fortune, Date.parse(source.referenceTime), {
        yangRenMode: resolvedRules.yangRenMode,
        kongWangMode: resolvedRules.kongWangMode,
        shenshaBaseMode: resolvedRules.shenshaBaseMode,
        xueTangMode: resolvedRules.xueTangMode,
        tianYiMode: resolvedRules.tianYiMode,
        tianGuanMode: resolvedRules.tianGuanMode,
        hongYanMode: resolvedRules.hongYanMode,
        tongZiMode: resolvedRules.tongZiMode,
      })
    : null;
  const timeline = source.timelineYear !== undefined && fortune ? (await import('./bazi/fortune-timeline')).calculateFortuneYear(chart, fortune, source.timelineYear) : undefined;
  const dailyRange = source.dailyRange ? resolveDailyRange(source.dailyRange, source.referenceTime ? Date.parse(source.referenceTime) : undefined) : undefined;
  return { input: source, chart, unknown: null, fortune, located, ...(timeline ? { timeline } : {}), ...(dailyRange ? { dailyRange } : {}) };
}
type Data = Awaited<ReturnType<typeof calculateBaziIndependentData>>;

async function render(data: Data, question: string, options: Options) {
  const scope = options?.scope ?? 'full';
  const details: Record<string, { description: string; traceHints?: string[] }> | null = options?.detailMode === 'full' ? (await import('./bazi/climate-details.json')).default : null;
  const climateDetail = (id: string) => {
    const item = details?.[id];
    return item ? `；说明：${item.description}${item.traceHints?.length ? `；提示：${item.traceHints.join('、')}` : ''}` : '';
  };
  if (scope !== 'full' && scope !== 'natal' && !data.located) throw new Error('选择具体岁运层级需要精确出生时间、性别和已保存的参考时刻。');
  if (!data.chart) {
    const unknown = data.unknown!;
    const shensha = partitionBaziShensha(unknown.segments.map((segment) => segment.shensha));
    const segments = unknown.segments.map((segment, index) => {
      const pillarText = positions.map((position) => `${labels[position]}${segment.pillars[position].ganZhi}`).join('、');
      const relations = options?.detailMode === 'full' ? `；原局关系：${segment.natalFacts.relations.map((item) => `${item.positions.map((position) => labels[position]).join('、')}${item.name}${item.element ?? ''}`).join('、') || '未命中所列关系'}；调候说明：${segment.climate.candidates.map((item) => `${item.label}${climateDetail(item.id)}`).join('；') || '无'}` : '';
      const stemConditions = `格神月令${segment.patternEvidence.monthGate?.status ?? segment.patternEvidence.decision?.monthGate ?? '不适用'}；普通格局条件模型${segment.patternEvidence.decision?.status ?? '不适用'}；可参与透干${segment.patternEvidence.visible.filter((item) => item.effective).map((item) => `${labels[item.position]}${item.stem}${item.tenGod}`).join('、') || '无'}`;
      return `${index + 1}｜${iso(segment.startTimestamp)} 至 ${iso(segment.endTimestamp)}（终点不含）；当地 UTC${segment.timezone >= 0 ? '+' : ''}${segment.timezone}；${pillarText}；神煞${formatBaziShenshaHits(shensha.differences[index], options?.detailMode === 'full', '无额外命中')}；司权${segment.monthCommander.stem}；旺衰模型${segment.strength.status}；普通取格候选${segment.ordinaryPattern.candidate}；化气${segment.transformation ? `${segment.transformation.pattern}（${segment.transformation.status}）` : '未见日干配合'}；曲直${segment.quzhi ? `${segment.quzhi.route}（${segment.quzhi.status}）` : '未命中'}；从儿${segment.conger?.route ? `${segment.conger.route}（${segment.conger.status}）` : '未命中'}；从财优先${segment.conger?.competingWealth ?? '未命中'}；已核算路线优先${segment.patternOverview.pattern}；${stemConditions}；基础有利方向${segment.usefulBaseline.favorable.join('、') || '随运平衡'}、不利方向${segment.usefulBaseline.unfavorable.join('、') || '随运避偏'}；${summarizeClimate(segment.climate)}；${summarizeClimateDecision(segment.climateDecision)}；${summarizeUsefulStrategy(segment.usefulStrategy)}；用神裁定${segment.usefulGod.incrementStatus}（主用${segment.usefulGod.useful}、喜${segment.usefulGod.favorableWuxing.join('、') || '随运平衡'}、忌${segment.usefulGod.unfavorableWuxing.join('、') || '随运避偏'}）${relations}`;
    });
    const common = positions.map((position) => `${labels[position]}：${unknown.common[position] ?? `不确定（${unknown.possible[position].join('、')}）`}`).join('；');
    const shichen = unknown.source.shichen, range = data.input.birthRange;
    const classics = options?.includeClassics
      ? formatClassicExcerpts(
          dedupeExcerpts(unknown.segments.flatMap((segment) => selectBaziClassics(segment.pillars.day.gan, segment.ordinaryPattern.candidate))),
          '典籍片段',
        )
      : '';
    const genderLabel = data.input.gender === 'male' ? '乾造（男）' : data.input.gender === 'female' ? '坤造（女）' : '';
    const text = [`【八字出生时段】\n${genderLabel ? `性别：${genderLabel}；` : ''}${range ? '指定出生范围；' : `当地公历日 ${unknown.source.solarDate}；${shichen ? `选择当地民用钟表 ${String(shichen.startHour).padStart(2, '0')}:00 至 ${String(shichen.endHour).padStart(2, '0')}:00（终点不含）；` : '时辰未知；'}`}日时依据：${unknown.input.timeStandard === 'true-solar' ? `真太阳时，经度 ${unknown.input.longitude}°` : '当地民用时间'}；${range ? '所选范围覆盖的' : '当地日覆盖的'}真实瞬时范围 ${iso(unknown.source.startTimestamp)} 至 ${iso(unknown.source.endTimestamp)}（终点不含）；所选范围或偏移以外排除 ${unknown.source.excludedSeconds} 秒。${range?.pillars ? '四柱来源已核对所有分段。' : ''}`,
      `【稳定与候选】\n${common}；月令司权：${unknown.commonMonthCommander ?? `不确定（${unknown.possibleMonthCommanders.join('、')}）`}；旺衰模型：${unknown.commonStrength ?? `不确定（${unknown.possibleStrengths.join('、')}）`}；普通取格候选：${unknown.commonOrdinaryPattern ?? `不确定（${unknown.possibleOrdinaryPatterns.join('、')}）`}。`,
      `【各候选共同的神煞】\n${formatBaziShenshaHits(shensha.common, options?.detailMode === 'full', '没有共同命中项')}\n【候选时段：神煞仅列与共同项的差异】\n${segments.join('\n')}\n${options?.detailMode === 'full' ? `${unknown.segments[0].shensha.rule}\n` : ''}${unknown.segments[0].shensha.limitation}`,
      classics,
      baziPromptTask(options),
      `【限制与任务】\n${unknown.limitation} 不得将某个候选时段当作已确定出生时间。逐项比较稳定事实与候选差异，明确资料缺口；不虚构大运或具体应期。旺衰、普通格局成败、化气、曲直和从儿仅按各时段所列条件模型计算，不能据此确定出生时辰；其他特殊格、完整成败和最终用神尚未完成。双人合盘需另用 bazi-synastry，仍有专业分析缺口。`,
      `【问题】\n${question}`].filter(Boolean).join('\n\n');
    return { text };
  }
  const { chart, fortune, located } = data, facts = chart.natalFacts;
  const pillars = positions.map((position) => {
    const p = chart.pillars[position];
    return `${labels[position]}：${p.ganZhi}（${p.tenGod}）；藏干 ${p.hiddenStems.map((x) => `${x.stem}${x.tenGod}`).join('、')}；纳音 ${p.naYin}；旬空 ${p.voidBranches.join('、')}；日主十二长生 ${p.lifeStage}；自坐 ${p.selfLifeStage}`;
  });
  const relations = facts.relations.map((item) => `${item.positions.map((position) => labels[position]).join('、')} ${item.values.join('、')}：${item.name}${item.subtype ? `（${item.subtype}）` : ''}${item.element ? `（${item.element}）` : ''}`);
  const rootAndExposure = facts.roots.map((root, index) => {
    const exp = facts.exposedStems[index];
    const expText = exp ? `月令${exp.seasonStatus}，${exp.matchesCommander ? '司权透出' : exp.monthHiddenIndex >= 0 ? `月支藏干第${exp.monthHiddenIndex + 1}位透出` : exp.sameElementAsMonthBranch ? '与月支同气' : '未见月支同气'}；` : '';
    const srcText = root.sources.map((source) => `${labels[source.position]}${source.branch}藏${source.stem}（${source.hiddenRole}、${source.kind}${source.clashSources.length ? `；与${source.clashSources.map((x) => `${labels[x.position]}${x.branch}`).join('、')}六冲` : ''}）`).join('、') || '未见同气藏干';
    return `${labels[root.position]}${root.stem}：${expText}${root.status}；${srcText}`;
  });
  const distribution = facts.tenGodDistribution
    .filter((item) => item.visible.length || item.hidden.length)
    .map((item) => {
      const vis = item.visible.length ? `透${item.visible.map((x) => labels[x]).join('、')}` : '';
      const hid = item.hidden.length ? `藏${item.hidden.map((x) => `${labels[x.position]}${x.stem}`).join('、')}` : '';
      return `${item.tenGod}（${[vis, hid].filter(Boolean).join('，')}）`;
    });
  const wuxingSummary = (() => {
    const elements = ['木', '火', '土', '金', '水'] as const;
    const stats = Object.fromEntries(elements.map((el) => [el, { stem: 0, branch: 0, hidden: 0 }])) as Record<(typeof elements)[number], { stem: number; branch: number; hidden: number }>;
    for (const pos of positions) {
      const p = chart.pillars[pos];
      if (p.stemElement in stats) stats[p.stemElement as (typeof elements)[number]].stem += 1;
      if (p.branchElement in stats) stats[p.branchElement as (typeof elements)[number]].branch += 1;
      for (const h of p.hiddenStems) {
        const hEl = stemElementOf(h.stem);
        if (hEl in stats) stats[hEl as (typeof elements)[number]].hidden += 1;
      }
    }
    const totallyMissing = elements.filter((el) => stats[el].stem === 0 && stats[el].hidden === 0);
    const surfaceMissing = elements.filter((el) => stats[el].stem === 0 && stats[el].branch === 0 && stats[el].hidden > 0);
    const countsText = elements.map((el) => `${el}（干${stats[el].stem}/支${stats[el].branch}/藏${stats[el].hidden}）`).join('、');
    const missingText = totallyMissing.length
      ? `原局明暗缺${totallyMissing.join('、')}`
      : surfaceMissing.length
        ? `五行俱全（干支明字不见${surfaceMissing.join('、')}，仅存于藏干）`
        : '四柱明字五行俱全';
    return `五行分布：${countsText}；${missingText}。`;
  })();
  const cycles = fortune?.cycles.map((cycle) => {
    const branchGod = cycle.pillar.hiddenStems[0]?.tenGod ?? '';
    const startYear = new Date(cycle.startTimestamp + 8 * 3_600_000).getUTCFullYear();
    const endYear = new Date(cycle.endTimestamp + 8 * 3_600_000).getUTCFullYear();
    const meta = `${cycle.pillar.tenGod}/${branchGod}，${cycle.pillar.naYin}，${cycle.pillar.lifeStage}`;
    return options?.detailMode === 'full'
      ? `${cycle.index + 1}：${cycle.ganZhi}（${meta}），${iso(cycle.startTimestamp)} 至 ${iso(cycle.endTimestamp)}（终点不含）`
      : `${cycle.index + 1}：${cycle.ganZhi}（${meta}），${startYear}–${endYear}年`;
  });
  const layerOrder = ['dayun', 'year', 'month', 'day', 'hour'] as const;
  const scopeIndex = scope === 'full' ? 4 : scope === 'natal' ? -1 : layerOrder.indexOf(scope);
  const activeLayers = located && scopeIndex >= 0 ? [
    ...(located.cycle ? [{ id: 'dayun' as const, pillar: located.cycle.pillar }] : []),
    { id: 'year' as const, pillar: located.year }, { id: 'month' as const, pillar: located.month },
    { id: 'day' as const, pillar: located.day }, { id: 'hour' as const, pillar: located.hour },
  ].filter((layer) => layerOrder.indexOf(layer.id) <= scopeIndex).map((layer) => ({ ...layer, ganZhi: layer.pillar.ganZhi })) : [];
  const evidence = located && scopeIndex >= 0 ? buildFortuneEvidence(chart.pillars, activeLayers) : undefined;
  const comparisons = (() => {
    if (!evidence) return undefined;
    if (options?.detailMode === 'full') {
      return evidence.comparisons.map(
        (pair) =>
          `${layerLabels[pair.source]}${pair.sourceGanZhi}与${layerLabels[pair.target]}${pair.targetGanZhi}：${pair.relations.map((relation) => relation.name).join('、') || '未命中所列关系'}`,
      );
    }
    const grouped = new Map<string, string[]>();
    for (const pair of evidence.comparisons) {
      if (!pair.relations.length) continue;
      const srcKey = `${layerLabels[pair.source]}${pair.sourceGanZhi}`;
      const list = grouped.get(srcKey) ?? [];
      list.push(`${layerLabels[pair.target]}${pair.targetGanZhi}（${pair.relations.map((r) => r.name).join('、')}）`);
      grouped.set(srcKey, list);
    }
    return [...grouped.entries()].map(([src, targets]) => `${src}与${targets.join('、')}`);
  })();
  const formations = evidence?.formations.map((item) => `${item.branches.join('')} ${item.name}${item.element}；参与：${item.participants.map((p) => `${layerLabels[p.layer]}${p.branch}`).join('、')}；补全来源：${item.triggers.map((p) => `${layerLabels[p.layer]}${p.branch}`).join('、')}`);
  const isFull = options?.detailMode === 'full';
  const stripTrailing = (text: string, suffix?: string) => {
    if (!suffix) return text;
    return text.endsWith(suffix) ? text.slice(0, -suffix.length).trimEnd() : text.replace(suffix, '').trimEnd();
  };
  const fortuneShenshaText = located && scopeIndex >= 0
    ? (() => {
        const raw = formatFortuneShensha(located.shensha, activeLayers.map((layer) => layer.id), isFull);
        if (isFull) return raw;
        return stripTrailing(stripTrailing(raw, located.shensha.limitation), located.shensha.rule);
      })()
    : '';
  const patternRelations = buildPatternRelations({ pillars: chart.pillars, strength: chart.strength, patternOverview: chart.patternOverview, ordinaryPattern: chart.ordinaryPattern, usefulGod: chart.usefulGod });
  const compactFortuneSection = scope === 'full' && fortune
    ? `【岁运动态与格局引动（压平精要）】\n${formatCompactFortuneDynamics(buildCompactFortuneDynamics({
        chart,
        fortune,
        patternRelations,
        question,
        ...(located ? { referenceTime: located.timestamp, referenceYear: located.flowYear } : data.input.referenceTime ? { referenceTime: data.input.referenceTime } : {}),
      }))}`
    : '';
  const fortuneSection = scope !== 'full'
    ? ''
    : fortune
      ? isFull
        ? `【大运】\n${fortune.rule}\n${fortune.direction === 'forward' ? '顺行' : '逆行'}；起运 ${iso(fortune.firstTimestamp)}；年龄 ${fortune.startAge.years}年${fortune.startAge.months}月${fortune.startAge.days}日${fortune.startAge.hours}小时${fortune.startAge.minutes}分。\n${cycles!.join('\n')}`
        : compactFortuneSection
          ? `【大运】\n${fortune.direction === 'forward' ? '顺行' : '逆行'}；起运 ${new Date(fortune.firstTimestamp + 8 * 3_600_000).getUTCFullYear()}年（${fortune.startAge.years}年${fortune.startAge.months}月${fortune.startAge.days}日）。`
          : `【大运】\n${fortune.direction === 'forward' ? '顺行' : '逆行'}；起运 ${new Date(fortune.firstTimestamp + 8 * 3_600_000).getUTCFullYear()}年（${fortune.startAge.years}年${fortune.startAge.months}月${fortune.startAge.days}日）。\n${[cycles!.slice(0, 4).join('；'), cycles!.slice(4, 8).join('；'), cycles!.slice(8, 12).join('；')].filter(Boolean).join('\n')}`
      : '【大运】\n未计算：需要明确出生时分秒及性别。';
  const timelineSection = scope === 'full' && 'timeline' in data && data.timeline ? `【${data.timeline.year}立春年流月时间线】\n${data.timeline.segments.map((item) => {
    const relations = item.evidence.comparisons.filter((pair) => pair.relations.length).map((pair) => `${layerLabels[pair.source]}${pair.sourceGanZhi}与${layerLabels[pair.target]}${pair.targetGanZhi}：${pair.relations.map((relation) => relation.name).join('、')}`);
    const formations = item.evidence.formations.map((item) => `${item.branches.join('')}${item.name}${item.element}（${item.participants.map((p) => `${layerLabels[p.layer]}${p.branch}`).join('、')}）`);
    return `${iso(item.startTimestamp)} 至 ${iso(item.endTimestamp)}（终点不含）：${item.jie.name}节令，${item.cycle ? `大运${item.cycle.ganZhi}` : '童限'}，流年${item.year.ganZhi}、流月${item.month.ganZhi}；${relations.join('；') || '未命中所列干支关系'}${formations.length ? `；${formations.join('；')}` : ''}`;
  }).join('\n')}\n${data.timeline.limitation}` : '';
  const selectedSection = scopeIndex < 0 ? '' : located && evidence ? `【指定时刻岁运】\n参考时刻 ${iso(located.timestamp)}；${located.inChildhood ? '童限，尚无大运；' : ''}${activeLayers.map((layer) => `${layerLabels[layer.id]}${layer.ganZhi}`).join('、') || '当前没有所选岁运层级'}${located.cycle ? (isFull ? `；大运区间 ${iso(located.cycle.startTimestamp)} 至 ${iso(located.cycle.endTimestamp)}（终点不含）` : `；大运${new Date(located.cycle.startTimestamp + 8 * 3_600_000).getUTCFullYear()}–${new Date(located.cycle.endTimestamp + 8 * 3_600_000).getUTCFullYear()}年`) : ''}${scopeIndex >= 1 ? `；小运${located.smallFortune.pillar.ganZhi}（虚岁${located.smallFortune.nominalAge}）` : ''}。${isFull ? '岁运按北京时间和真实参考时刻定位，所列关系只针对该时点。' : ''}\n${comparisons!.join('\n') || '未命中所列层级关系。'}\n${formations!.join('\n') || '未由所列岁运补全三合三会。'}${isFull ? `\n${evidence.limitation}` : ''}` : '【指定时刻岁运】\n未提供可计算的参考时刻，不得虚构流年、流月、流日或流时。';
  const extraPalacesSection = chart.extraPalaces
    ? `【辅助宫位（命宫/身宫/胎元/胎息）】\n${([
        ['命宫', chart.extraPalaces.mingGong],
        ['身宫', chart.extraPalaces.shenGong],
        ['胎元', chart.extraPalaces.taiYuan],
        ['胎息', chart.extraPalaces.taiXi],
      ] as const).map(([label, p]) => `${label}：${p.ganZhi}（${p.tenGod}，${p.naYin}，旬空${p.voidBranches.join('、')}，长生${p.lifeStage}）`).join('；')}`
    : '';
  const kongWangLine = data.input.rules?.kongWangMode === 'day-and-year'
    ? `\n旬空查法（年日互换）：日柱旬空 ${chart.pillars.day.voidBranches.join('、')}；年柱旬空 ${chart.pillars.year.voidBranches.join('、')}。`
    : '';
  const digestLines = buildMethodSituationDigest('bazi', data, question);
  const patternEvidenceText = isFull
    ? formatPatternEvidence(chart.patternEvidence)
    : stripTrailing(formatPatternEvidence(chart.patternEvidence), chart.patternEvidence.limitation);
  const usefulBaselineText = isFull
    ? formatUsefulBaseline(chart.usefulBaseline)
    : `${stripTrailing(formatUsefulBaseline(chart.usefulBaseline), chart.usefulBaseline.limitation)}。`;
  const usefulStrategyText = isFull
    ? formatUsefulStrategy(chart.usefulStrategy)
    : stripTrailing(formatUsefulStrategy(chart.usefulStrategy), chart.usefulStrategy.limitation);
  const genderLabel = data.input.gender === 'male' ? '乾造（男）' : data.input.gender === 'female' ? '坤造（女）' : '';
  const sections = [
    `【八字命盘】\n${genderLabel ? `性别：${genderLabel}；` : ''}出生当地钟表：${chart.basis.localDateTime}；真实出生瞬时：${iso(chart.basis.utcTimestamp)}；时区：${chart.basis.timeZoneId ?? `UTC${chart.basis.timezone >= 0 ? '+' : ''}${chart.basis.timezone}`}${chart.basis.usedChinaDstCorrection ? '（已减 1 小时校正中国历史夏令时）' : ''}；日时依据：${chart.basis.timeStandard === 'true-solar' ? '真太阳时' : '当地民用时间'}；排盘口径：${formatRuleSummary(data.input.rules)}。${'limitation' in chart.basis ? chart.basis.limitation : ''}${chart.basis.chinaDstWarning ? `\n⚠️ ${chart.basis.chinaDstWarning}` : ''}`,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【四柱】\n${pillars.join('\n')}${kongWangLine}\n月支${chart.monthCommander.branch}，分日司权${chart.monthCommander.stem}${isFull ? `；范围 ${iso(chart.monthCommander.startTimestamp)} 至 ${iso(chart.monthCommander.endTimestamp)}（终点不含）。${chart.monthCommander.rule}` : '。'}`,
    extraPalacesSection,
    `【本命神煞（${chart.shensha.included.length}项）】\n${isFull ? formatBaziShensha(chart.shensha) : `${formatBaziShenshaHits(chart.shensha, false)}${chart.shensha.unavailable.length ? `\n${chart.shensha.unavailable.map((item) => item.name).join('、')}因未提供性别未计算。` : ''}`}`,
    `【本命结构】\n${relations.length ? relations.join('；') : '未命中所列干支关系。'}${isFull ? `\n${facts.limitation}` : ''}`,
    isFull ? `【通根与月令透干】\n${rootAndExposure.join('\n')}` : '',
    `【日主旺衰条件模型】\n${chart.strength.status}；月令${chart.strength.month.season}、司权${chart.strength.month.commanderStem}${chart.strength.month.commanderEffect}；月令与司权${chart.strength.tendencies.month}、根气${chart.strength.tendencies.root}、结构${chart.strength.tendencies.structure}。\n日主根气：${chart.strength.roots.map((root) => `${labels[root.position]}${root.branch}藏${root.stem}（${root.hiddenRole}，${root.clashStatus}；${root.actionable ? '参与结构' : '受冲减力'}）`).join('、') || '未见同气根'}。\n扶身来源：${chart.strength.support.map((item) => `${labels[item.position]}${item.value}${item.effect}${item.actionable ? '' : '（受冲减力）'}`).join('、') || '无'}；克泄耗来源：${chart.strength.constraint.map((item) => `${labels[item.position]}${item.value}${item.effect}${item.actionable ? '' : '（受冲减力）'}`).join('、') || '无'}。\n${chart.strength.formations.map((item) => `${item.members}${item.name}${item.element}：月令${item.monthState}，${item.established ? '满足模型成势条件' : '不满足模型成势条件'}`).join('；') || '未见完整三合三会。'}${isFull ? `\n${chart.strength.limitation}` : ''}`,
    `【普通月令取格候选】\n${chart.ordinaryPattern.candidate}；依据${chart.ordinaryPattern.source}（${chart.ordinaryPattern.selectedStem}）。月支本气${chart.ordinaryPattern.monthPrincipal.stem}${chart.ordinaryPattern.monthPrincipal.tenGod}，本气候选${chart.ordinaryPattern.monthPrincipal.pattern}；分日司权${chart.ordinaryPattern.commander.stem}${chart.ordinaryPattern.commander.tenGod}，${chart.ordinaryPattern.commander.positions.length ? `透于${chart.ordinaryPattern.commander.positions.map((position) => labels[position]).join('、')}` : '未透年、月、时干'}。\n月支藏干：${chart.ordinaryPattern.monthHiddenStems.map((item) => `${item.stem}${item.tenGod}（${item.positions.length ? `透于${item.positions.map((position) => labels[position]).join('、')}` : '未透年、月、时干'}）`).join('、')}。${isFull ? `\n${chart.ordinaryPattern.limitation}` : ''}`,
    chart.transformation || isFull ? `【日干五合化气】\n${formatTransformation(chart.transformation)}` : '',
    chart.quzhi || isFull ? `【曲直格条件】\n${formatQuzhi(chart.quzhi)}` : '',
    chart.conger?.route || chart.conger?.competingWealth || isFull ? `【从儿与从财条件】\n${formatCongEr(chart.conger)}` : '',
    chart.extreme?.candidate || isFull ? `【专旺与通用从格条件】\n${formatExtremePattern(chart.extreme)}` : '',
    isFull ? `【已迁移路线的格局排序】\n${chart.patternOverview.pattern}（${chart.patternOverview.source}）。${chart.patternOverview.limitation}` : '',
    `【格局组合与互制关系】\n${formatPatternRelations(patternRelations, { compact: !isFull })}`,
    `【格局透干与根气条件】\n${patternEvidenceText}`,
    isFull ? `【取用基础取向】\n${usefulBaselineText}` : '',
    `【调候条件候选】\n节气${chart.climate.currentJieqi ?? '按月令当季论'}；${chart.climate.applicability}。\n${chart.climate.candidates.map((item) => `${item.label}（${item.status}，${item.mode}）：${item.hint}${item.missingInputs.length ? `；缺少${item.missingInputs.join('、')}` : ''}${climateDetail(item.id)}`).join('\n') || '未命中可列候选。'}${isFull ? `\n${chart.climate.limitation}` : ''}`,
    isFull ? `【调候条件协调】\n${formatClimateDecision(chart.climateDecision, chart.climate.candidates)}` : '',
    `【司权、病药与通关候选】\n${usefulStrategyText}`,
    `【用神裁定与落位】\n${formatUsefulGod(chart.usefulGod)}`,
    `【十神分布】\n${distribution.join('；') || '无可用透藏记录。'}\n${wuxingSummary}${isFull ? '\n日干作为参照，不计作透出的比肩；数量不等于力量。' : ''}`,
    fortuneSection,
    compactFortuneSection,
    'dailyRange' in data && data.dailyRange ? formatBaziDailyRangeBlock(data.dailyRange, chart.pillars) : '',
    timelineSection,
    selectedSection,
    fortuneShenshaText ? `【岁运神煞】\n${fortuneShenshaText}` : '',
    options?.includeClassics ? formatClassicExcerpts(selectBaziClassics(chart.pillars.day.gan, chart.ordinaryPattern.candidate, chart.pillars.month.zhi), '典籍片段') : '',
    (() => {
      const schoolEvals = evaluateBaziSchoolAlgorithms(chart, options?.schools);
      const consensus = buildSchoolConsensusSummary(schoolEvals);
      return formatSchoolAlgorithmSection(schoolEvals, consensus.formattedText);
    })(),
    baziPromptTask(options),
    '【任务】\n结合用户问题与上述旺衰、格局成败、兼带外象、调候用神及岁运引动综合推演，区分盘面事实、传统取象与条件性推论，指出必要的反证与资料缺口；未在盘面直接给出的具体应期日期与现实结果，不得将其当成已经算出的结论。双人合盘需另用 bazi-synastry。',
    `【问题】\n${question}`,
  ];
  const text = sections.filter(Boolean).join('\n\n');
  return { text };
}

export async function baziIndependent(input: Input) {
  const data = await calculateBaziIndependentData(input);
  if (!data.chart) return { data, summary: { title: '八字出生时段', tags: [data.input.birthRange ? '指定出生范围' : data.unknown!.source.shichen ? '指定时辰' : '未知时辰', `${data.unknown!.segments.length} 个候选时段`],
    lines: ['候选时段不能当作已确定的出生时间。', '未计算精确起运。'] }, prompt: await render(data, input.question, input.prompt) };
  return { data, summary: { title: '八字命盘', tags: positions.map((position) => data.chart.pillars[position].ganZhi),
    lines: [data.chart.basis.precision === 'shichen' ? '时辰使用中点，不能代表整个时段。' : '已按明确出生时分秒排盘。', data.fortune ? '已计算十二步大运。' : '未计算大运。', data.located ? '已定位指定时刻岁运。' : '未指定岁运时刻。'] },
    prompt: await render(data, input.question, input.prompt) };
}

export async function promptForBaziIndependent(data: unknown, input: Source, question: string, options: Options) {
  const expected = await calculateBaziIndependentData(input);
  if (!sameJsonValue(data, expected)) throw new Error('八字预览结果与出生资料或岁运时刻不一致。');
  return render(expected, question, options);
}
