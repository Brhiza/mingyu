import type { BaziChartResult, PatternAnalysis, UsefulGodAnalysis } from './baziTypes';
import { WUXING, isSheng, isKe } from '../wuxing';

interface FormatBaziOptions {
  includeRules?: boolean;
  includeShensha?: boolean;
  includeShenShaAnalysis?: boolean;
  includeWuxing?: boolean;
  includeNatalDetails?: boolean;
  includeLuckOverview?: boolean;
}

export type PromptChartScene =
  'general' | 'fortune' | 'compatibility' | 'comprehensive' | 'concise' | 'school';

function joinOrFallback(values: string[] | undefined, fallback = '无'): string {
  return values && values.length > 0 ? values.join('、') : fallback;
}

/** 保留具体干的作用范围，供盘面、复制文本及解读资料共同使用。 */
export function formatUsefulGodFunctions(
  usefulGod: UsefulGodAnalysis,
  includeTransformationConditions = true,
): string[] {
  const natalPatternGods = (usefulGod.decisionEvidence?.natalFunctions ?? [])
    .filter((item) => item.role === '格神')
    .map(
      (item) =>
        `${item.stem}${item.tenGod}（${item.pillar === 'year' ? '年柱' : item.pillar === 'month' ? '月柱' : item.pillar === 'day' ? '日柱' : '时柱'}）`,
    );
  const adoptedStems = new Set(usefulGod.conditionalFavorableStems ?? []);
  const effects =
    usefulGod.decisionEvidence?.climateCandidates
      .filter((candidate) => candidate.adopted)
      .flatMap((candidate) => candidate.effects ?? [])
      .filter((effect) => effect.rank === 'primary' && adoptedStems.has(effect.stem)) ?? [];
  const descriptions = [
    ...new Set(
      effects.map(
        (effect) =>
          `${effect.stem}${effect.wuxing}用于${effect.role}${effect.targetStems?.length ? `（作用对象：${effect.targetStems.join('、')}）` : ''}`,
      ),
    ),
  ];
  for (const stem of adoptedStems) {
    if (!effects.some((effect) => effect.stem === stem)) descriptions.push(stem);
  }
  const observedFunctions = (usefulGod.decisionEvidence?.controlFunctions ?? [])
    .filter((path) => path.status === '满足' && path.sourceStems.length && path.targetStems.length)
    .map(
      (path) =>
        `原局制化：${path.label}；${path.sourceStems.join('、')}作用于${path.targetStems.join('、')}${path.baseUnfavorableStems.length ? `；其中${path.baseUnfavorableStems.join('、')}在扶抑基线属忌，原局作用与增补取用分别判断` : ''}${path.evidenceGaps.length ? `；作用条件待核：${path.evidenceGaps.join('、')}` : ''}`,
    );
  const patternBreakerRestrictions = usefulGod.decisionEvidence?.patternBreakerRestrictions ?? [];
  const patternRestrictedStems = new Set(
    patternBreakerRestrictions.flatMap((breaker) => breaker.stems.map((item) => item.stem)),
  );
  const otherConditionalUnfavorableStems = (usefulGod.conditionalUnfavorableStems ?? []).filter(
    (stem) => !patternRestrictedStems.has(stem),
  );
  const isGenericSpecialStrong = usefulGod.matchedRules?.some(
    (rule) => rule.id === 'follow-special-strong',
  );
  const specialStrongOutputCondition = isGenericSpecialStrong
    ? (usefulGod.conditionalFavorableWuxing ?? []).map(
        (wuxing) => `专旺食伤条件：${wuxing}仅在原局印轻且食伤泄秀作用成立时纳入喜用`,
      )
    : [];
  return [
    ...(natalPatternGods.length
      ? [
          `原局格神作用：${[...new Set(natalPatternGods)].join('、')}已参与成格；增补五行与新来同干另按取用条件判断`,
        ]
      : []),
    ...(usefulGod.decisionEvidence?.transformation
      ? [
          `化神取用：${usefulGod.decisionEvidence.transformation.basis}`,
          ...(includeTransformationConditions
            ? usefulGod.decisionEvidence.transformation.conditions.map(
                (condition) => `取用条件：${condition}`,
              )
            : []),
        ]
      : []),
    usefulGod.decisionEvidence?.balanceAdjustment
      ? `取用配合：${usefulGod.decisionEvidence.balanceAdjustment.reason}`
      : '',
    descriptions.length ? `条件取用：${descriptions.join('；')}` : '',
    ...specialStrongOutputCondition,
    ...patternBreakerRestrictions.map(
      (breaker) =>
        `格局破格所忌：${breaker.stems.map((item) => `${item.stem}${item.tenGod}（${item.pillarName}）`).join('、')}；${breaker.label}的救应明确不成立`,
    ),
    otherConditionalUnfavorableStems.length
      ? `干级所忌：${otherConditionalUnfavorableStems.join('、')}`
      : '',
    ...observedFunctions,
  ].filter(Boolean);
}

/** 格局名称与成败条件分开呈现，所有解读入口复用同一份已计算结论。 */
export function formatPatternFulfillmentFacts(pattern: PatternAnalysis): string[] {
  const fulfillment = pattern.fulfillment;
  const special = pattern.specialAdjudication;
  const patternCandidateFacts =
    pattern.patternCandidates && pattern.patternCandidates.length > 1
      ? [
          `取格分层候选：${pattern.patternCandidates
            .map(
              (candidate) =>
                `${candidate.pattern}（${candidate.source}${candidate.selected ? '；当前采用' : ''}；${candidate.basis}）`,
            )
            .join('；')}`,
        ]
      : [];
  const commonSpecialFacts = special
    ? [
        `特殊格裁决：${special.kind}${special.status}；路径：${special.route}；方法：${special.method}`,
        `特殊格条件：${special.satisfied.join('、')}`,
        special.visibleOutputStems.length
          ? `食伤明透：${special.visibleOutputStems.join('、')}`
          : '',
        special.visibleWealthStems.length
          ? `财星明透：${special.visibleWealthStems.join('、')}`
          : '',
        special.blockers.length ? `特殊格反证：${special.blockers.join('；')}` : '',
      ].filter(Boolean)
    : [];
  const specialFacts = !special
    ? []
    : special.kind === '曲直格'
      ? [
          ...commonSpecialFacts,
          special.memberHiddenStems.length
            ? `成员支藏干保留：${special.memberHiddenStems.join('；')}`
            : '',
        ].filter(Boolean)
      : [
          ...commonSpecialFacts,
          `从儿五行流向：食伤${special.outputElement}生财${special.wealthElement}`,
          special.outputRootFacts.length ? `食伤结构根：${special.outputRootFacts.join('；')}` : '',
          special.wealthRootFacts.length ? `财星结构根：${special.wealthRootFacts.join('；')}` : '',
          ...special.functionalResolutions.map((item) => `顺局作用：${item}`),
          special.retainedHiddenFacts.length
            ? `原支藏印官事实：${special.retainedHiddenFacts.join('；')}`
            : '',
        ].filter(Boolean);
  if (!fulfillment) return [...patternCandidateFacts, ...specialFacts];
  const decisionDetail = fulfillment.decisionDetail || fulfillment.summary;
  return [
    ...patternCandidateFacts,
    ...specialFacts,
    `所取格局：${fulfillment.patternName}；当前成败判定：${fulfillment.status}${fulfillment.basis && !decisionDetail?.includes(fulfillment.basis) ? `；${fulfillment.basis}` : ''}${decisionDetail ? `；判定理由：${decisionDetail}` : ''}`,
    fulfillment.contradiction ? `相互制约：${fulfillment.contradiction}` : '',
    ...fulfillment.remedies.map((item) => `候选取用：${item.effect}`),
    ...(fulfillment.conditionFacts ?? [])
      .filter((item) => !item.key.startsWith('path.'))
      .map((item) => `条件核验：${item.status}；${item.detail}`),
    ...(fulfillment.pathEvaluations ?? []).map(
      (item) => `制化路径：${item.label}（${item.position}）：${item.status}；${item.detail}`,
    ),
    ...(fulfillment.conditions ?? []).map((item) => `格局条件：${item}`),
  ].filter(Boolean);
}

/** 提示词只保留本盘判定理由，通用成败规则留在结构化分析中。 */
export function formatPatternDecisionForPrompt(pattern: PatternAnalysis): string {
  const fulfillment = pattern.fulfillment;
  if (!fulfillment) return '';
  const decisionDetail = fulfillment.decisionDetail || fulfillment.summary;
  const factualDecision =
    fulfillment.basis && decisionDetail.includes(fulfillment.basis)
      ? decisionDetail
          .replace(fulfillment.basis, '')
          .replace(/\s+/g, ' ')
          .replace(/([。；]) (?=\S)/g, '$1')
          .trim()
      : decisionDetail;
  return `当前成败判定：${fulfillment.status}${factualDecision ? `；判定理由：${factualDecision}` : ''}`;
}

export function hasConfirmedPatternTarget(pattern: PatternAnalysis): boolean {
  return Boolean(
    pattern.fulfillment?.conditionFacts?.some(
      (item) => item.key === 'pattern.target' && item.status === '满足',
    ),
  );
}

export function formatAlternativePatternCandidates(pattern: PatternAnalysis): string {
  const alternatives = pattern.patternCandidates?.filter((candidate) => !candidate.selected);
  return alternatives?.some((candidate) => candidate.pattern !== pattern.pattern)
    ? `其他取格候选：${alternatives.map((candidate) => `${candidate.pattern}（${candidate.source}；${candidate.basis}）`).join('；')}`
    : '';
}

function formatLunarDate(baziResult: BaziChartResult): string {
  const lunarDate = baziResult.lunarDate;
  return `${lunarDate.year}年${lunarDate.monthName}${lunarDate.dayName}`;
}

function formatBirthSeason(baziResult: BaziChartResult): string {
  const seasonInfo = baziResult.seasonInfo;
  if (!seasonInfo || seasonInfo.currentJieqi === '未知') {
    return '';
  }

  return [
    `${seasonInfo.currentSeason}令`,
    seasonInfo.daysSincePrev == null
      ? seasonInfo.currentJieqi
      : `${seasonInfo.currentJieqi}后${seasonInfo.daysSincePrev}天`,
    seasonInfo.nextJieqi !== '未知' && seasonInfo.daysToNext != null
      ? `距${seasonInfo.nextJieqi}${seasonInfo.daysToNext}天`
      : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

const TEN_GOD_ORDER = [
  '比肩',
  '劫财',
  '食神',
  '伤官',
  '偏财',
  '正财',
  '七杀',
  '正官',
  '偏印',
  '正印',
] as const;

function formatTenGodSummary(baziResult: BaziChartResult): string {
  const counts = new Map<string, number>();
  const values = [
    ...Object.values(baziResult.tenGods ?? {}),
    ...Object.values(baziResult.hiddenTenGods ?? {}).flat(),
  ];

  values.forEach((value) => {
    if (!value || value === '日主') return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return TEN_GOD_ORDER.filter((tenGod) => counts.has(tenGod))
    .map((tenGod) => `${tenGod}${counts.get(tenGod)}`)
    .join('、');
}

function formatWuxingSeasonStatus(baziResult: BaziChartResult): string {
  const status = baziResult.wuxingSeasonStatus;
  if (!status || !Object.keys(status).length) return '';

  return WUXING.map((wuxing) => (status[wuxing] ? `${wuxing}${status[wuxing]}` : ''))
    .filter(Boolean)
    .join(' ');
}

function formatElementRelations(baziResult: BaziChartResult): string {
  const dayElement = baziResult.dayMaster.element;
  const roles = new Map<string, string>(
    WUXING.map((element) => [
      element,
      element === dayElement
        ? '日主、比劫'
        : isSheng(dayElement, element)
          ? '食伤'
          : isKe(dayElement, element)
            ? '财星'
            : isKe(element, dayElement)
              ? '官杀'
              : '印星',
    ]),
  );
  const label = (element: string) => `${roles.get(element)}${element}`;
  const generating: string[] = [];
  const controlling: string[] = [];
  for (const source of WUXING) {
    for (const target of WUXING) {
      if (isSheng(source, target)) {
        generating.push(`${label(source)}生${label(target)}，${label(target)}泄${label(source)}`);
      }
      if (isKe(source, target)) {
        controlling.push(`${label(source)}克${label(target)}`);
      }
    }
  }
  return [
    '【五行作用方向】',
    `日主${baziResult.dayMaster.gan}${dayElement}；相生：${generating.map((line) => line.split('，')[0]).join('；')}；相克：${controlling.join('；')}`,
  ].join('\n');
}

function formatSolarDateTime(value: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  return `${value.year}年${value.month}月${value.day}日 ${value.hour}:${String(value.minute).padStart(2, '0')}`;
}

function formatPromptLuckOverview(baziResult: BaziChartResult): string {
  if (!baziResult.luckInfo?.cycles?.length) {
    return '';
  }

  const cycles = baziResult.luckInfo.cycles;

  const lines = [`起运: ${baziResult.luckInfo.startInfo}`];
  const cycleOverview = cycles.slice(0, 13).map((cycle, index) => {
    const years = cycle.years ?? [];
    const firstYear = years[0]?.year;
    const lastYear = years[years.length - 1]?.year;
    const yearRange = firstYear && lastYear ? `，含${firstYear}-${lastYear}年流年` : '';
    const cycleLabel = cycle.isXiaoyun ? `${cycle.ganZhi}童运` : `${cycle.ganZhi}${cycle.type}`;
    return `${index + 1}. ${cycleLabel}: ${cycle.year}年起，约${cycle.age}岁交运${yearRange}`;
  });

  if (cycleOverview.length) {
    lines.push('大运总览:');
    lines.push(...cycleOverview);
  }

  return lines.join('\n');
}

function buildBaziText(baziResult: BaziChartResult, options: FormatBaziOptions): string {
  if (!baziResult) return '无法获取八字数据。';
  if (baziResult.isThreePillars) {
    const { solarDate, unknownTimeAnalysis } = baziResult;
    return [
      '【命盘】',
      `公历${solarDate.year}年${solarDate.month}月${solarDate.day}日，${baziResult.gender === 'male' ? '男命' : '女命'}，出生时辰未知。`,
      '【已确定的柱】',
      ...(['year', 'month', 'day'] as const).map(
        (key, index) =>
          `${['年柱', '月柱', '日柱'][index]}：${baziResult.pillars[key].ganZhi || '待出生时分确定'}`,
      ),
      '【待补时判断】',
      unknownTimeAnalysis?.summary ?? '旺衰、格局与喜忌待出生时分确定后再判。',
      unknownTimeAnalysis?.batch
        ? `【当前时辰候选：第${unknownTimeAnalysis.batch.startIndex + 1}/${unknownTimeAnalysis.batch.totalCandidates}项】`
        : '【时辰候选比较】',
      ...(unknownTimeAnalysis?.scenarios ?? []).map(
        (scenario) =>
          `${scenario.timeName}：${Object.values(scenario.pillars)
            .map((pillar) => pillar.ganZhi)
            .join(
              ' ',
            )}；${scenario.strength}；${scenario.pattern}；候选喜用${scenario.favorableWuxing.join('、') || '待判'}，候选所忌${scenario.unfavorableWuxing.join('、') || '待判'}`,
      ),
    ].join('\n');
  }

  const {
    solarDate,
    timeInfo,
    dayMaster,
    pillars,
    tenGods,
    hiddenStems,
    hiddenTenGods,
    shensha,
    shenShaAnalysis,
  } = baziResult;
  const {
    includeRules = true,
    includeShensha = true,
    includeShenShaAnalysis = false,
    includeWuxing = true,
    includeNatalDetails = true,
    includeLuckOverview = true,
  } = options;

  let result = '【命盘】\n';
  const isMale = baziResult.gender === 'male';
  result += `基本信息: ${isMale ? '乾造' : '坤造'} | ${solarDate.year}年${solarDate.month}月${solarDate.day}日 ${timeInfo.name}\n`;
  result += `出生历法: 阳历${solarDate.year}年${solarDate.month}月${solarDate.day}日 | 农历${formatLunarDate(baziResult)} | 生肖:${baziResult.zodiac}\n`;
  if (baziResult.timing?.enabled && baziResult.timing.correctedTime) {
    result += `真太阳时: ${formatSolarDateTime(baziResult.timing.correctedTime)}`;
    if (baziResult.timing.birthPlace) {
      result += ` | 出生地:${baziResult.timing.birthPlace}`;
    }
    if (baziResult.timing.birthLongitude != null) {
      result += ` | 经度:${baziResult.timing.birthLongitude}`;
    }
    result += '\n';
  }
  if (baziResult.timing?.dstCorrectionMinutes != null) {
    result += `夏令时校正: ${baziResult.timing.dstCorrectionMinutes} 分钟\n`;
  }
  result += `日元本命: ${dayMaster.gan}${dayMaster.element} (${dayMaster.yinYang})\n`;
  if (hiddenStems.month?.[0]) result += `月支本气: ${hiddenStems.month[0]}\n`;
  if (baziResult.monthCommander) result += `月令司权: ${baziResult.monthCommander}\n`;
  const birthSeason = formatBirthSeason(baziResult);
  if (birthSeason) result += `节令: ${birthSeason}\n`;
  const wuxingSeasonStatus = formatWuxingSeasonStatus(baziResult);
  if (wuxingSeasonStatus) result += `月令旺相: ${wuxingSeasonStatus}\n`;
  result += `\n${formatElementRelations(baziResult)}\n`;

  result += '\n【核心判断】\n';
  const analysis = baziResult.analysis;
  result += `旺衰: ${analysis.dayMasterStrength.status}`;
  if (includeRules) {
    const strength = analysis.dayMasterStrength.details;
    result += `（月令${strength.seasonalEffect}；司令${strength.commanderEffect}；${strength.hasRoot ? '有根' : '无根'}；成局${strength.formationEffect}）`;
  }
  result += '\n';
  const alternativePatterns = formatAlternativePatternCandidates(analysis.mingGe);
  result += `格局: ${analysis.mingGe.pattern}`;
  if ((includeRules || alternativePatterns) && analysis.mingGe.basis) {
    result += `（${analysis.mingGe.basis}）`;
  }
  if (analysis.mingGe.transformation?.status === '成化') {
    result += '；化气判定：成化';
  }
  result += '\n';
  const patternFacts = formatPatternFulfillmentFacts(analysis.mingGe);
  if (alternativePatterns) result += `${alternativePatterns}\n`;
  if (analysis.mingGe.fulfillment) {
    const nonCandidateFacts = patternFacts.filter((fact) => !fact.startsWith('取格分层候选：'));
    if (nonCandidateFacts[0] && !nonCandidateFacts[0].startsWith('所取格局：')) {
      result += `${nonCandidateFacts[0]}\n`;
    }
    result += `${formatPatternDecisionForPrompt(analysis.mingGe)}\n`;
    if (hasConfirmedPatternTarget(analysis.mingGe) && analysis.mingGe.fulfillment.contradiction) {
      result += `相互制约：${analysis.mingGe.fulfillment.contradiction}\n`;
    }
  }
  if (analysis.usefulGod) {
    const primaryFavorableWuxing =
      analysis.usefulGod.primaryFavorableWuxing || analysis.usefulGod.favorableWuxing?.[0] || '无';
    const secondaryFavorableWuxing =
      analysis.usefulGod.secondaryFavorableWuxing ||
      analysis.usefulGod.favorableWuxing?.slice(1) ||
      [];
    const primaryUnfavorableWuxing =
      analysis.usefulGod.primaryUnfavorableWuxing ||
      analysis.usefulGod.unfavorableWuxing?.[0] ||
      '无';
    const secondaryUnfavorableWuxing =
      analysis.usefulGod.secondaryUnfavorableWuxing ||
      analysis.usefulGod.unfavorableWuxing?.slice(1) ||
      [];
    const primaryFavorableTenGods =
      analysis.usefulGod.primaryFavorable || analysis.usefulGod.primaryFavorableWuxing
        ? analysis.usefulGod.primaryFavorable || analysis.usefulGod.favorable?.slice(0, 2) || []
        : [];
    const primaryUnfavorableTenGods =
      analysis.usefulGod.primaryUnfavorable || analysis.usefulGod.primaryUnfavorableWuxing
        ? analysis.usefulGod.primaryUnfavorable || analysis.usefulGod.unfavorable?.slice(0, 2) || []
        : [];
    const favorableText =
      analysis.usefulGod.incrementStatus === '部分判定' &&
      !analysis.usefulGod.favorableWuxing?.length
        ? '增补喜用待判'
        : `主用${primaryFavorableWuxing}${secondaryFavorableWuxing.length ? '，辅' + secondaryFavorableWuxing.join('、') : ''}（${joinOrFallback(primaryFavorableTenGods)}）`;
    const unfavorableText =
      analysis.usefulGod.incrementStatus === '部分判定' &&
      !analysis.usefulGod.unfavorableWuxing?.length
        ? '增补所忌待判'
        : `忌${primaryUnfavorableWuxing}${secondaryUnfavorableWuxing.length ? '，次忌' + secondaryUnfavorableWuxing.join('、') : ''}（${joinOrFallback(primaryUnfavorableTenGods)}）`;

    result +=
      analysis.usefulGod.incrementStatus === '待判'
        ? '增补五行喜忌: 待判\n'
        : `取用: ${favorableText}；${unfavorableText}\n`;
    const functionalUse = formatUsefulGodFunctions(analysis.usefulGod, false);
    if (functionalUse.length) result += `${functionalUse.join('\n')}\n`;
    if (
      includeRules &&
      analysis.usefulGod.primaryReason &&
      !analysis.usefulGod.decisionEvidence?.transformation
    ) {
      result += `取用主线: ${analysis.usefulGod.primaryReason}\n`;
      result +=
        analysis.usefulGod.incrementStatus === '待判'
          ? `取用依据: 日主旺衰${analysis.dayMasterStrength.status}，${analysis.mingGe.pattern}当前${analysis.mingGe.fulfillment?.status || '待核'}；增补五行喜忌结合司令、根气与制化作用待判\n`
          : `取用依据: 以${analysis.usefulGod.primaryReason}为主，结合旺衰${analysis.dayMasterStrength.status}与格局${analysis.mingGe.pattern}综合取用\n`;
    }
    if (includeRules && baziResult.climate && baziResult.climate.nature !== '未见明显偏向') {
      result += `水火分布参考: ${baziResult.climate.summary}\n`;
    }
  }

  if (includeNatalDetails) {
    const tenGodSummary = formatTenGodSummary(baziResult);
    result += '\n【本命辅助】\n';
    result += `命宫:${baziResult.mingGong || '无'} | 身宫:${baziResult.shenGong || '无'} | 胎元:${baziResult.taiYuan || '无'} | 胎息:${baziResult.taiXi || '无'}\n`;
    if (tenGodSummary) result += `十神构成（天干与藏干）: ${tenGodSummary}\n`;
  }

  result += '\n【四柱】\n';
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'] as const;
  const keys: Array<keyof typeof pillars> = ['year', 'month', 'day', 'hour'];
  const dayKongWangBranches = baziResult.kongWang?.day || [];

  keys.forEach((key, index) => {
    const pillar = pillars[key];
    const tenGod = tenGods[key];
    const shenShaValue = shensha?.[key]?.join(',') || '';
    const kongWangFlag = dayKongWangBranches.includes(pillar.zhi) ? '(空亡)' : '';
    const hiddenStemValues = hiddenStems?.[key] || [];
    const hiddenTenGodValues = hiddenTenGods?.[key] || [];
    const dayMasterLifeStage = baziResult.lifeStages?.[key] || '';
    const nayin = baziResult.nayin?.[key] || '';
    const ziZuo = baziResult.ziZuo?.[key] || '';
    const pillarKongWang = baziResult.kongWang?.[key]?.join('、') || '';
    const hiddenStr = hiddenStemValues
      .map((stem, idx) => `${stem}${hiddenTenGodValues[idx] ? `[${hiddenTenGodValues[idx]}]` : ''}`)
      .join('');
    const shenShaExplain = shenShaAnalysis?.[key]?.join(' | ') || '';

    const pillarParts = [
      `${pillarNames[index]}: ${pillar.ganZhi}`,
      tenGod ? `[${tenGod}]` : '',
      kongWangFlag,
    ]
      .filter(Boolean)
      .join(' ');
    result += `${pillarParts}\n`;
    if (hiddenStr) result += `  藏干: ${hiddenStr}\n`;
    if (includeNatalDetails) {
      const referenceParts = [
        nayin ? `纳音: ${nayin}` : '',
        ziZuo ? `自坐: ${ziZuo}` : '',
        dayMasterLifeStage ? `十二运: ${dayMasterLifeStage}` : '',
        pillarKongWang ? `旬空: ${pillarKongWang}` : '',
      ].filter(Boolean);
      if (referenceParts.length) result += `  ${referenceParts.join(' | ')}\n`;
    } else if (dayMasterLifeStage) {
      result += `  十二运: ${dayMasterLifeStage}\n`;
    }
    if (includeShensha && shenShaValue) result += `  神煞: ${shenShaValue}\n`;
    if (includeShenShaAnalysis && shenShaExplain) {
      result += `  传统旁证: ${shenShaExplain}\n`;
    }
  });

  const globalShenShaValue = shensha?.global?.join(',') || '';
  const globalShenShaExplain = shenShaAnalysis?.global?.join(' | ') || '';
  if (includeShensha && globalShenShaValue) {
    result += `全局神煞: ${globalShenShaValue}\n`;
    if (includeShenShaAnalysis && globalShenShaExplain) {
      result += `  传统旁证: ${globalShenShaExplain}\n`;
    }
  }
  if (!includeShensha && includeShenShaAnalysis && globalShenShaExplain) {
    result += `全局传统旁证: ${globalShenShaExplain}\n`;
  }

  if (includeWuxing && baziResult.wuxingStrength) {
    result += '\n【五行】\n';
    result += `出现:${baziResult.wuxingStrength.present.join('、') || '无'} | 结构比较优先:${baziResult.wuxingStrength.dominantByRule.join('、') || '无'}`;
    if (baziResult.wuxingStrength.commanderElement) {
      result += ` | 司令五行:${baziResult.wuxingStrength.commanderElement}`;
    }
    if (baziResult.wuxingStrength.missing?.length) {
      result += ` | 缺失:${baziResult.wuxingStrength.missing.join(',')}`;
    }
    result += '\n';
  }

  if (includeNatalDetails && baziResult.pillarRelations) {
    const relations = Object.values(baziResult.pillarRelations).flat();
    if (relations.length) result += `\n【原局干支关系】\n${[...new Set(relations)].join('；')}\n`;
  }

  if (includeNatalDetails && baziResult.warnings?.length) {
    result += '\n【定盘提醒】\n';
    result += `${baziResult.warnings.join('\n')}\n`;
  }

  if (includeLuckOverview && baziResult.luckInfo?.cycles) {
    result += '\n【大运】\n';
    result += `${formatPromptLuckOverview(baziResult)}\n`;
  }

  return result;
}

function getPromptSceneOptions(scene: PromptChartScene): FormatBaziOptions {
  if (scene === 'school') {
    return {
      includeRules: false,
      includeShensha: true,
      includeShenShaAnalysis: false,
      includeWuxing: true,
      includeNatalDetails: true,
      includeLuckOverview: false,
    };
  }

  if (scene === 'comprehensive') {
    return {
      includeRules: true,
      includeShensha: true,
      includeShenShaAnalysis: false,
      includeWuxing: true,
      includeNatalDetails: true,
      includeLuckOverview: false,
    };
  }

  if (scene === 'fortune') {
    return {
      includeRules: true,
      includeShensha: true,
      includeShenShaAnalysis: false,
      includeWuxing: true,
      includeNatalDetails: true,
      includeLuckOverview: false,
    };
  }

  if (scene === 'compatibility') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: true,
      includeNatalDetails: true,
      includeLuckOverview: false,
    };
  }

  if (scene === 'concise') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeNatalDetails: false,
      includeLuckOverview: false,
    };
  }

  return {
    includeRules: true,
    includeShensha: true,
    includeShenShaAnalysis: false,
    includeWuxing: true,
    includeNatalDetails: true,
    includeLuckOverview: false,
  };
}

export function formatBaziForPrompt(
  baziResult: BaziChartResult,
  /** @deprecated 兼容旧调用签名，具体岁运应通过 FortuneSelectionContext 传入。 */
  _selectedOption: unknown = null,
  scene: PromptChartScene = 'general',
): string {
  if (!baziResult) return '无法获取八字数据。';

  return buildBaziText(baziResult, getPromptSceneOptions(scene));
}
