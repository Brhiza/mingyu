import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { BaziChartResult } from './baziTypes';

type PillarKey = 'year' | 'month' | 'day' | 'hour';

const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<PillarKey, '年柱' | '月柱' | '日柱' | '时柱'> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const CALCULATION_STEP_LIMITATION =
  '八字本命计算步骤只证明出生时间口径、四柱、藏干十神、节令旺衰、格局与取用如何形成当前结构化结果；不得把步骤完整度解释为命运可信度、吉凶分数、事件概率或固定应期' as const;
const PILLAR_FACT_LIMITATION =
  '四柱事实只记录干支、十神、藏干、纳音、十二运、自坐与旬空等传统盘面资料；不得由单柱直接推出性格、六亲、健康、财富或事件结果' as const;
const ANALYSIS_FACT_LIMITATION =
  '旺衰、格局与取用事实只记录当前规则链的分类结果和依据；不同传统流派可能采用不同权重与次序，不得转写为绝对命格、成功率、疾病判断或现实保证' as const;
const RELATION_FACT_LIMITATION =
  '伏吟、反吟及合冲刑害破只证明原局柱间存在对应干支结构；不直接证明现实事件性质、发生时间、人物意图或吉凶结果' as const;
const COUNTER_FACT_LIMITATION =
  '八字本命反证只记录四柱与核心分析资料是否完整、柱间主要关系是否命中以及排盘边界是否有提示；未命中不代表现实有利或不利，资料完整也不证明结论必然成立' as const;
const SUMMARY_FACT_LIMITATION =
  '八字本命证据汇总只统计计算步骤、四柱、旺衰格局取用、柱间关系、排盘边界与限制覆盖；不得按数量生成命盘总分、可信度、吉凶概率、疾病概率、财富幅度或唯一应期' as const;
const LIMITATION_FACT_LIMITATION =
  '八字本命限制事实用于约束四柱、旺衰、格局、取用、神煞与柱间关系可以支持的解释范围，不得被反向当作现实因果、人物命运、概率或保证有效建议的证据' as const;

export interface BaziNatalCalculationStep {
  key: string;
  stage: '出生时间定盘' | '四柱生成' | '派生资料计算' | '核心判断形成' | '证据汇总';
  status: '已计算' | '存在资料缺口';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: typeof CALCULATION_STEP_LIMITATION;
}

export interface BaziNatalPillarFact {
  key: string;
  status: '已记录' | '资料缺口';
  pillar: '年柱' | '月柱' | '日柱' | '时柱';
  gan: string;
  zhi: string;
  ganZhi: string;
  tenGod: string;
  hiddenStems: string[];
  hiddenTenGods: string[];
  nayin: string;
  pillarLifeStage: string;
  dayMasterLifeStage: string;
  ziZuo: string;
  kongWang: string[];
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: typeof PILLAR_FACT_LIMITATION;
}

export interface BaziNatalAnalysisFact {
  key: string;
  status: '已记录' | '资料缺口';
  type: '日主旺衰' | '格局' | '用神取忌';
  result: string;
  basis: string[];
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: typeof ANALYSIS_FACT_LIMITATION;
}

export interface BaziNatalRelationFact {
  key: string;
  status: '已命中';
  type: '伏吟' | '反吟' | '刑冲合害破';
  relation: string;
  calculationStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: typeof RELATION_FACT_LIMITATION;
}

export interface BaziNatalCounterEvidenceFact {
  key: string;
  type: '四柱资料覆盖' | '核心分析覆盖' | '柱间关系覆盖' | '排盘边界覆盖';
  status: '有可用证据' | '资料不足' | '未命中主要关系' | '无边界提示' | '存在边界提示';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: typeof COUNTER_FACT_LIMITATION;
}

export interface BaziNatalCounterSummaryFact {
  key: 'bazi:natal:counter-summary';
  status: '存在需保留反证' | '未见额外反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '八字本命反证汇总只用于防止把资料缺口、未命中关系或排盘边界静默忽略；不得据反证数量生成吉凶分、可信度、事件概率或调整结论';
}

export interface BaziNatalLimitationFact {
  key: string;
  type:
    | '出生时间边界'
    | '传统模型边界'
    | '旺衰格局取用边界'
    | '神煞与单项关系边界'
    | '本命应期边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: typeof LIMITATION_FACT_LIMITATION;
}

export interface BaziNatalSummaryFact {
  key: 'bazi:natal:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  calculationStepCount: number;
  pillarFactCount: number;
  analysisFactCount: number;
  relationFactCount: number;
  warningFactCount: number;
  missingFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: typeof SUMMARY_FACT_LIMITATION;
}

export interface BaziNatalEvidenceAnalysis {
  key: 'bazi:natal:evidence';
  status: '已计算' | '存在资料缺口';
  calculationSteps: BaziNatalCalculationStep[];
  calculationChain: string[];
  pillarFacts: BaziNatalPillarFact[];
  analysisFacts: BaziNatalAnalysisFact[];
  relationFacts: BaziNatalRelationFact[];
  primaryFacts: string[];
  supportingFacts: string[];
  counterEvidence: string[];
  counterEvidenceFacts: BaziNatalCounterEvidenceFact[];
  counterSummaryFact: BaziNatalCounterSummaryFact;
  limitations: string[];
  limitationFacts: BaziNatalLimitationFact[];
  summaryFact: BaziNatalSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function joinOrNone(values: string[]) {
  return values.filter(hasText).join('、') || '未记录';
}

function conditionPortableBasis(text: string) {
  return text
    .replace(/内部权重/g, '规则权重')
    .replace(/内部评分/g, '规则分类')
    .replace(/本项目统一/g, '统一')
    .replace(/项目统一/g, '统一')
    .replace(/本项目/g, '当前规则')
    .replace(/项目登记/g, '当前登记')
    .trim();
}

function filterPortableStrategyTrace(values: string[] | undefined) {
  return (values ?? [])
    .map(conditionPortableBasis)
    .filter(
      (value) =>
        value &&
        !['成格层次:', '成格转轻:', '病药提示:', '运势警语:'].some((prefix) =>
          value.startsWith(prefix),
        ),
    );
}

function buildPillarFacts(data: BaziChartResult): BaziNatalPillarFact[] {
  return PILLAR_KEYS.map((key) => {
    const pillar = data.pillars[key];
    const hiddenStems = data.hiddenStems[key] ?? [];
    const hiddenTenGods = data.hiddenTenGods[key] ?? [];
    const status =
      hasText(pillar.gan) && hasText(pillar.zhi) && hasText(pillar.ganZhi) ? '已记录' : '资料缺口';
    const promptText = [
      `${PILLAR_LABELS[key]}${pillar.ganZhi || '未记录干支'}`,
      `天干十神${data.tenGods[key] || '未记录'}`,
      `藏干${joinOrNone(hiddenStems)}`,
      hiddenTenGods.length ? `藏干十神${hiddenTenGods.join('、')}` : '',
      data.nayin[key] ? `纳音${data.nayin[key]}` : '',
      data.pillarLifeStages[key] ? `柱干十二运${data.pillarLifeStages[key]}` : '',
      data.lifeStages[key] ? `日主十二运${data.lifeStages[key]}` : '',
      data.ziZuo[key] ? `自坐${data.ziZuo[key]}` : '',
      data.kongWang[key]?.length ? `旬空${data.kongWang[key].join('、')}` : '',
    ]
      .filter(Boolean)
      .join('；');

    return {
      key: `bazi:natal:pillar:${key}`,
      status,
      pillar: PILLAR_LABELS[key],
      gan: pillar.gan,
      zhi: pillar.zhi,
      ganZhi: pillar.ganZhi,
      tenGod: data.tenGods[key] ?? '',
      hiddenStems,
      hiddenTenGods,
      nayin: data.nayin[key] ?? '',
      pillarLifeStage: data.pillarLifeStages[key] ?? '',
      dayMasterLifeStage: data.lifeStages[key] ?? '',
      ziZuo: data.ziZuo[key] ?? '',
      kongWang: data.kongWang[key] ?? [],
      calculationStepKeys: ['bazi:natal:calculation:pillars', 'bazi:natal:calculation:derived'],
      promptText,
      sources: ['四柱干支、十神、藏干、纳音、十二运、自坐与旬空结构化资料'],
      limitation: PILLAR_FACT_LIMITATION,
    };
  });
}

function buildAnalysisFacts(data: BaziChartResult): BaziNatalAnalysisFact[] {
  const strength = data.analysis.dayMasterStrength;
  const strengthDetails = strength.details;
  const strengthBasis = [
    `月令${strengthDetails.seasonalEffect}`,
    `司令${strengthDetails.commanderEffect}`,
    `成局${strengthDetails.formationEffect}`,
    strengthDetails.hasRoot ? '有根' : '无根',
    strengthDetails.hasStrongRoot ? '有强根' : '未见强根',
    strengthDetails.hasSupport ? '有帮扶' : '帮扶不明显',
    strengthDetails.hasConstraint ? '有克泄耗' : '克泄耗不明显',
    ...strengthDetails.ruleBasis.map(conditionPortableBasis),
  ];
  const pattern = data.analysis.mingGe;
  const usefulGod = data.analysis.usefulGod;
  const usefulBasis = [
    conditionPortableBasis(usefulGod.primaryReason ?? ''),
    ...filterPortableStrategyTrace(usefulGod.strategyTrace),
  ].filter(hasText);
  const favorableWuxing = usefulGod.favorableWuxing ?? [];
  const unfavorableWuxing = usefulGod.unfavorableWuxing ?? [];
  const usefulResult = [
    usefulGod.primaryFavorableWuxing
      ? `主用${usefulGod.primaryFavorableWuxing}`
      : favorableWuxing.length
        ? `喜用五行${favorableWuxing.join('、')}`
        : '',
    usefulGod.secondaryFavorableWuxing?.length
      ? `辅助${usefulGod.secondaryFavorableWuxing.join('、')}`
      : '',
    usefulGod.primaryUnfavorableWuxing
      ? `主忌${usefulGod.primaryUnfavorableWuxing}`
      : unfavorableWuxing.length
        ? `忌五行${unfavorableWuxing.join('、')}`
        : '',
    usefulGod.useful ? `喜十神${usefulGod.useful}` : '',
    usefulGod.avoid ? `忌十神${usefulGod.avoid}` : '',
  ]
    .filter(Boolean)
    .join('；');

  return [
    {
      key: 'bazi:natal:analysis:day-master-strength',
      status: hasText(strength.status) && strength.status !== '未知' ? '已记录' : '资料缺口',
      type: '日主旺衰',
      result: strength.status,
      basis: strengthBasis,
      calculationStepKeys: ['bazi:natal:calculation:core-analysis'],
      promptText: `日主旺衰：${strength.status || '未记录'}；依据：${strengthBasis.join('、')}`,
      sources: ['月令、司令、成局、通根、帮扶与克泄耗条件'],
      limitation: ANALYSIS_FACT_LIMITATION,
    },
    {
      key: 'bazi:natal:analysis:pattern',
      status: hasText(pattern.pattern) && pattern.pattern !== '未知' ? '已记录' : '资料缺口',
      type: '格局',
      result: pattern.pattern,
      basis: [
        conditionPortableBasis(pattern.basis ?? ''),
        pattern.isSpecial ? '当前规则标记为特殊格局' : '当前规则未标记为特殊格局',
      ].filter(hasText),
      calculationStepKeys: ['bazi:natal:calculation:core-analysis'],
      promptText: `格局：${pattern.pattern || '未记录'}${pattern.basis ? `；依据：${conditionPortableBasis(pattern.basis)}` : ''}；特殊格局标记：${pattern.isSpecial ? '是' : '否'}`,
      sources: ['月令司权、透干、根气、成局与格局规则条件'],
      limitation: ANALYSIS_FACT_LIMITATION,
    },
    {
      key: 'bazi:natal:analysis:useful-god',
      status: usefulResult ? '已记录' : '资料缺口',
      type: '用神取忌',
      result: usefulResult,
      basis: usefulBasis,
      calculationStepKeys: ['bazi:natal:calculation:core-analysis'],
      promptText: `取用结果：${usefulResult || '未形成明确取用结果'}${usefulBasis.length ? `；依据：${usefulBasis.join('、')}` : ''}`,
      sources: ['旺衰、格局、调候、扶抑、通关与病药取用规则链'],
      limitation: ANALYSIS_FACT_LIMITATION,
    },
  ];
}

function buildRelationFacts(data: BaziChartResult): BaziNatalRelationFact[] {
  const groups: Array<{
    type: BaziNatalRelationFact['type'];
    key: 'fuxin' | 'fanyin' | 'xingChong';
  }> = [
    { type: '伏吟', key: 'fuxin' },
    { type: '反吟', key: 'fanyin' },
    { type: '刑冲合害破', key: 'xingChong' },
  ];

  return groups.flatMap((group) =>
    data.pillarRelations[group.key].map((relation, index) => ({
      key: `bazi:natal:relation:${group.key}:${index + 1}`,
      status: '已命中' as const,
      type: group.type,
      relation,
      calculationStepKeys: ['bazi:natal:calculation:derived'],
      promptText: `${group.type}：${relation}`,
      sources: ['原局四柱干支逐对关系与三合三会完整成员核验'],
      limitation: RELATION_FACT_LIMITATION,
    })),
  );
}

function buildCalculationSteps(args: {
  data: BaziChartResult;
  pillarFacts: BaziNatalPillarFact[];
  analysisFacts: BaziNatalAnalysisFact[];
  relationFacts: BaziNatalRelationFact[];
}): BaziNatalCalculationStep[] {
  const { data, pillarFacts, analysisFacts, relationFacts } = args;
  const correctedTime = data.timing?.enabled
    ? `${data.timing.correctedTime.year}-${String(data.timing.correctedTime.month).padStart(2, '0')}-${String(data.timing.correctedTime.day).padStart(2, '0')} ${String(data.timing.correctedTime.hour).padStart(2, '0')}:${String(data.timing.correctedTime.minute).padStart(2, '0')}`
    : '';
  const missingPillarCount = pillarFacts.filter((item) => item.status === '资料缺口').length;
  const missingAnalysisCount = analysisFacts.filter((item) => item.status === '资料缺口').length;

  return [
    {
      key: 'bazi:natal:calculation:birth-time',
      stage: '出生时间定盘',
      status: '已计算',
      inputs: {
        solarDate: `${data.solarDate.year}-${data.solarDate.month}-${data.solarDate.day}`,
        birthTime: `${data.timeInfo.name}（${data.timeInfo.range}）`,
        trueSolarTimeEnabled: Boolean(data.timing?.enabled),
      },
      result: {
        resolvedBirthTime: correctedTime || `${data.timeInfo.name}（${data.timeInfo.range}）`,
        warningFactCount: data.warningFacts.length,
      },
      dependsOnStepKeys: [],
      promptText: data.timing?.enabled
        ? `出生钟表时间经真太阳时校正后采用${correctedTime}，对应${data.timeInfo.name}`
        : `出生时间按明确选择的${data.timeInfo.name}（${data.timeInfo.range}）直接定盘`,
      sources: data.timing?.enabled
        ? ['出生日期、精准时分、出生地经度、均时差与历史夏令时校正']
        : ['出生日期与明确传统时辰输入'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:natal:calculation:pillars',
      stage: '四柱生成',
      status: missingPillarCount ? '存在资料缺口' : '已计算',
      inputs: {
        resolvedBirthTime: correctedTime || `${data.timeInfo.name}（${data.timeInfo.range}）`,
        currentJieqi: data.seasonInfo.currentJieqi,
      },
      result: {
        pillars: PILLAR_KEYS.map((key) => data.pillars[key].ganZhi),
        dayMaster: `${data.dayMaster.gan}${data.dayMaster.element}${data.dayMaster.yinYang}`,
        missingPillarCount,
      },
      dependsOnStepKeys: ['bazi:natal:calculation:birth-time'],
      promptText: `按节气换年换月与当前换日口径生成四柱：${PILLAR_KEYS.map((key) => `${PILLAR_LABELS[key]}${data.pillars[key].ganZhi}`).join('、')}；日主为${data.dayMaster.gan}${data.dayMaster.element}${data.dayMaster.yinYang}`,
      sources: ['公历农历换算、节气换月、六十甲子与时柱推导'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:natal:calculation:derived',
      stage: '派生资料计算',
      status: missingPillarCount ? '存在资料缺口' : '已计算',
      inputs: {
        pillars: PILLAR_KEYS.map((key) => data.pillars[key].ganZhi),
        dayMaster: data.dayMaster.gan,
      },
      result: {
        monthCommander: data.monthCommander,
        hiddenStemCount: PILLAR_KEYS.reduce(
          (total, key) => total + (data.hiddenStems[key]?.length ?? 0),
          0,
        ),
        relationFactCount: relationFacts.length,
        presentWuxing: data.wuxingStrength.present,
      },
      dependsOnStepKeys: ['bazi:natal:calculation:pillars'],
      promptText: `由四柱和日主推导月令司权${data.monthCommander || '未记录'}、十神、藏干、纳音、十二运、自坐、旬空、五行出现情况及${relationFacts.length}项柱间关系事实`,
      sources: ['藏干表、十神生克、纳音、十二长生、旬空与干支关系公共规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:natal:calculation:core-analysis',
      stage: '核心判断形成',
      status: missingAnalysisCount ? '存在资料缺口' : '已计算',
      inputs: {
        monthCommander: data.monthCommander,
        currentJieqi: data.seasonInfo.currentJieqi,
        dayMaster: data.dayMaster.gan,
      },
      result: {
        strength: data.analysis.dayMasterStrength.status,
        pattern: data.analysis.mingGe.pattern,
        usefulGod: analysisFacts.find((item) => item.type === '用神取忌')?.result ?? '',
        missingAnalysisCount,
      },
      dependsOnStepKeys: ['bazi:natal:calculation:derived'],
      promptText: `按月令、司令、成局、根气、帮扶与克泄耗形成旺衰${data.analysis.dayMasterStrength.status || '未记录'}、格局${data.analysis.mingGe.pattern || '未记录'}与取用结果`,
      sources: ['旺衰、格局与取用规则链及其逐项条件'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'bazi:natal:calculation:summary',
      stage: '证据汇总',
      status: missingPillarCount || missingAnalysisCount ? '存在资料缺口' : '已计算',
      inputs: {
        pillarFactCount: pillarFacts.length,
        analysisFactCount: analysisFacts.length,
        relationFactCount: relationFacts.length,
        warningFactCount: data.warningFacts.length,
      },
      result: {
        missingFactCount: missingPillarCount + missingAnalysisCount,
      },
      dependsOnStepKeys: ['bazi:natal:calculation:core-analysis'],
      promptText: `汇总四柱${pillarFacts.length}项、核心判断${analysisFacts.length}项、柱间关系${relationFacts.length}项、排盘边界${data.warningFacts.length}项，资料缺口${missingPillarCount + missingAnalysisCount}项`,
      sources: ['出生时间、四柱、派生资料、核心判断与排盘边界逐项汇总'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildCounterEvidenceFacts(args: {
  data: BaziChartResult;
  pillarFacts: BaziNatalPillarFact[];
  analysisFacts: BaziNatalAnalysisFact[];
  relationFacts: BaziNatalRelationFact[];
}): BaziNatalCounterEvidenceFact[] {
  const { data, pillarFacts, analysisFacts, relationFacts } = args;
  const missingPillars = pillarFacts.filter((item) => item.status === '资料缺口');
  const missingAnalysis = analysisFacts.filter((item) => item.status === '资料缺口');

  return [
    {
      key: 'bazi:natal:counter:pillar-coverage',
      type: '四柱资料覆盖',
      status: missingPillars.length ? '资料不足' : '有可用证据',
      ownerFactKeys: ['bazi:natal:calculation:pillars', ...pillarFacts.map((item) => item.key)],
      promptText: missingPillars.length
        ? `${missingPillars.map((item) => item.pillar).join('、')}存在资料缺口，不得补造干支、藏干或十神`
        : '年、月、日、时四柱及其主要派生字段均已登记',
      sources: ['四柱事实完整性逐项核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazi:natal:counter:analysis-coverage',
      type: '核心分析覆盖',
      status: missingAnalysis.length ? '资料不足' : '有可用证据',
      ownerFactKeys: [
        'bazi:natal:calculation:core-analysis',
        ...analysisFacts.map((item) => item.key),
      ],
      promptText: missingAnalysis.length
        ? `${missingAnalysis.map((item) => item.type).join('、')}未形成明确结果，必须保留资料缺口`
        : '日主旺衰、格局与用神取忌均已形成结构化事实',
      sources: ['旺衰、格局与取用结果覆盖核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazi:natal:counter:relation-coverage',
      type: '柱间关系覆盖',
      status: relationFacts.length ? '有可用证据' : '未命中主要关系',
      ownerFactKeys: ['bazi:natal:calculation:derived', ...relationFacts.map((item) => item.key)],
      promptText: relationFacts.length
        ? `原局记录${relationFacts.length}项伏吟、反吟或刑冲合害破关系`
        : '原局未命中当前已登记的伏吟、反吟、刑冲合害破及三合三会关系；不代表没有其他较弱互动',
      sources: ['四柱干支逐对关系与三合三会成员核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazi:natal:counter:boundary-coverage',
      type: '排盘边界覆盖',
      status: data.warningFacts.length ? '存在边界提示' : '无边界提示',
      ownerFactKeys: [
        'bazi:natal:calculation:birth-time',
        data.warningSummaryFact.key,
        ...data.warningFacts.map((item) => item.key),
      ],
      promptText: data.warningFacts.length
        ? `${data.warningSummaryFact.promptText}；已按明确输入生成当前唯一命盘`
        : '当前输入未触发已登记的节气、时辰、换日或历史夏令时边界提示',
      sources: ['出生时间定盘口径与排盘边界预警'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function buildCounterSummaryFact(
  counterEvidenceFacts: BaziNatalCounterEvidenceFact[],
): BaziNatalCounterSummaryFact {
  const issueFacts = counterEvidenceFacts.filter(
    (item) => item.status !== '有可用证据' && item.status !== '无边界提示',
  );

  return {
    key: 'bazi:natal:counter-summary',
    status: issueFacts.length ? '存在需保留反证' : '未见额外反证',
    factKeys: issueFacts.map((item) => item.key),
    promptText: issueFacts.length
      ? `需保留${issueFacts.length}项反证或边界：${issueFacts.map((item) => item.promptText).join('；')}`
      : '四柱与核心分析资料完整，且当前未触发额外排盘边界；仍不得把资料完整解释为现实结论必然成立',
    sources: ['四柱、核心分析、柱间关系与排盘边界覆盖汇总'],
    limitation:
      '八字本命反证汇总只用于防止把资料缺口、未命中关系或排盘边界静默忽略；不得据反证数量生成吉凶分、可信度、事件概率或调整结论',
  };
}

function buildLimitationFacts(args: {
  data: BaziChartResult;
  pillarFacts: BaziNatalPillarFact[];
  analysisFacts: BaziNatalAnalysisFact[];
  relationFacts: BaziNatalRelationFact[];
  counterEvidenceFacts: BaziNatalCounterEvidenceFact[];
}): BaziNatalLimitationFact[] {
  const { data, pillarFacts, analysisFacts, relationFacts, counterEvidenceFacts } = args;
  const ownerKeys = [
    ...pillarFacts.map((item) => item.key),
    ...analysisFacts.map((item) => item.key),
    ...relationFacts.map((item) => item.key),
  ];
  const definitions: Array<
    Pick<BaziNatalLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'bazi:natal:limitation:birth-time',
      type: '出生时间边界',
      ownerFactKeys: [
        'bazi:natal:calculation:birth-time',
        data.warningSummaryFact.key,
        ...data.warningFacts.map((item) => item.key),
      ],
      promptText: '当前命盘只采用明确时辰或真太阳时校正后的唯一时刻',
      sources: ['出生时间输入规则、真太阳时与排盘边界事实'],
    },
    {
      key: 'bazi:natal:limitation:traditional-model',
      type: '传统模型边界',
      ownerFactKeys: ['bazi:natal:evidence-summary', ...ownerKeys],
      promptText:
        '四柱、十神、藏干、纳音、十二运、格局、用神与神煞属于传统命理模型，不等同于现代统计因果或可验证的人生定律',
      sources: ['传统子平结构与现实因果分离原则'],
    },
    {
      key: 'bazi:natal:limitation:analysis-hierarchy',
      type: '旺衰格局取用边界',
      ownerFactKeys: [
        'bazi:natal:calculation:core-analysis',
        ...analysisFacts.map((item) => item.key),
      ],
      promptText:
        '旺衰、格局与用神必须分别列出依据并交叉复核；不得用五行数量、单一格局名或单一用神标签替代完整判断链',
      sources: ['旺衰、格局与取用分层原则'],
    },
    {
      key: 'bazi:natal:limitation:single-symbol',
      type: '神煞与单项关系边界',
      ownerFactKeys: [
        'bazi:natal:calculation:derived',
        ...pillarFacts.map((item) => item.key),
        ...relationFacts.map((item) => item.key),
      ],
      promptText:
        '神煞、纳音、空亡、十二运及单项合冲刑害破只能作为传统旁证，不得脱离月令、格局、用神与现实资料单独定案',
      sources: ['主证、辅证与单项传统符号分层原则'],
    },
    {
      key: 'bazi:natal:limitation:natal-timing',
      type: '本命应期边界',
      ownerFactKeys: ['bazi:natal:evidence-summary', ...ownerKeys],
      promptText:
        '本命证据只描述原局长期结构与触发条件，不生成具体年份、月份、日期或唯一应期；时间判断必须另行引用明确选择的大运、流年、流月或流日证据',
      sources: ['本命原局与动态岁运分析层级边界'],
    },
    {
      key: 'bazi:natal:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [
        'bazi:natal:evidence-summary',
        ...ownerKeys,
        ...counterEvidenceFacts.map((item) => item.key),
      ],
      promptText:
        '不得根据旺衰、格局、用神、神煞或关系数量生成命盘总分、成功率、疾病诊断、寿命判断、财富保证、婚恋成败率、人物意图或必然断语',
      sources: ['传统盘面事实与高风险现实结论分离原则'],
    },
  ];

  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function buildEvidenceBundle(args: {
  calculationSteps: BaziNatalCalculationStep[];
  pillarFacts: BaziNatalPillarFact[];
  analysisFacts: BaziNatalAnalysisFact[];
  relationFacts: BaziNatalRelationFact[];
  counterEvidenceFacts: BaziNatalCounterEvidenceFact[];
  counterSummaryFact: BaziNatalCounterSummaryFact;
  summaryFact: BaziNatalSummaryFact;
  limitationFacts: BaziNatalLimitationFact[];
}): PromptEvidenceBundle {
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: '八字本命计算链',
      detail: `${args.calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(args.calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['出生时间', '四柱', '旺衰格局取用'],
    },
    ...args.pillarFacts.map((item): PromptEvidenceItem => ({
      level: item.status === '资料缺口' ? '反证' : '主证',
      title: `${item.pillar}结构化事实`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.pillar, item.status],
    })),
    ...args.analysisFacts.map((item): PromptEvidenceItem => ({
      level: item.status === '资料缺口' ? '反证' : '主证',
      title: `${item.type}事实`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.type, item.status],
    })),
    ...args.relationFacts.map((item): PromptEvidenceItem => ({
      level: '辅证',
      title: `${item.type}关系事实`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.type],
    })),
    ...args.counterEvidenceFacts
      .filter((item) => item.status !== '有可用证据' && item.status !== '无边界提示')
      .map((item): PromptEvidenceItem => ({
        level: '反证',
        title: `${item.type}：${item.status}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: item.sources.join('、'),
        tags: ['反证', item.type],
      })),
    {
      level: args.counterSummaryFact.status === '存在需保留反证' ? '反证' : '辅证',
      title: `八字本命反证汇总：${args.counterSummaryFact.status}`,
      detail: `${args.counterSummaryFact.promptText}；边界：${args.counterSummaryFact.limitation}`,
      source: args.counterSummaryFact.sources.join('、'),
      tags: ['反证汇总'],
    },
    {
      level: args.summaryFact.status === '证据链完整' ? '辅证' : '反证',
      title: `八字本命证据汇总：${args.summaryFact.status}`,
      detail: `${args.summaryFact.promptText}；边界：${args.summaryFact.limitation}`,
      source: args.summaryFact.sources.join('、'),
      tags: ['证据汇总', args.summaryFact.status],
    },
    {
      level: '限制',
      title: '八字本命统一解释限制',
      detail: `${args.limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(args.limitationFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['限制', '非评分', '非概率', '非固定应期'],
    },
  ];

  return { title: '八字本命四柱与核心判断结构化证据', items };
}

export function analyzeBaziNatalEvidence(data: BaziChartResult): BaziNatalEvidenceAnalysis {
  const pillarFacts = buildPillarFacts(data);
  const analysisFacts = buildAnalysisFacts(data);
  const relationFacts = buildRelationFacts(data);
  const calculationSteps = buildCalculationSteps({
    data,
    pillarFacts,
    analysisFacts,
    relationFacts,
  });
  const counterEvidenceFacts = buildCounterEvidenceFacts({
    data,
    pillarFacts,
    analysisFacts,
    relationFacts,
  });
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const limitationFacts = buildLimitationFacts({
    data,
    pillarFacts,
    analysisFacts,
    relationFacts,
    counterEvidenceFacts,
  });
  const missingFactCount =
    pillarFacts.filter((item) => item.status === '资料缺口').length +
    analysisFacts.filter((item) => item.status === '资料缺口').length;
  const summaryFact: BaziNatalSummaryFact = {
    key: 'bazi:natal:evidence-summary',
    status: missingFactCount ? '证据链有缺口' : '证据链完整',
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...pillarFacts.map((item) => item.key),
      ...analysisFacts.map((item) => item.key),
      ...relationFacts.map((item) => item.key),
      data.warningSummaryFact.key,
      ...data.warningFacts.map((item) => item.key),
      ...counterEvidenceFacts.map((item) => item.key),
      counterSummaryFact.key,
    ],
    calculationStepCount: calculationSteps.length,
    pillarFactCount: pillarFacts.length,
    analysisFactCount: analysisFacts.length,
    relationFactCount: relationFacts.length,
    warningFactCount: data.warningFacts.length,
    missingFactCount,
    counterEvidenceCount: counterEvidenceFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `八字本命证据状态为${missingFactCount ? '证据链有缺口' : '证据链完整'}；记录计算步骤${calculationSteps.length}项、四柱事实${pillarFacts.length}项、核心判断${analysisFacts.length}项、柱间关系${relationFacts.length}项、排盘边界${data.warningFacts.length}项、资料缺口${missingFactCount}项、限制${limitationFacts.length}项`,
    sources: ['出生时间、四柱干支、节令、十神藏干、旺衰格局取用、柱间关系与排盘边界逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
  const limitations = limitationFacts.map((item) => item.promptText);
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据' && item.status !== '无边界提示')
    .map((item) => item.promptText);
  const evidence = buildEvidenceBundle({
    calculationSteps,
    pillarFacts,
    analysisFacts,
    relationFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    summaryFact,
    limitationFacts,
  });
  const primaryFacts = [
    ...pillarFacts.map((item) => item.promptText),
    ...analysisFacts.map((item) => item.promptText),
  ];
  const supportingFacts = relationFacts.map((item) => item.promptText);
  const calculationChain = calculationSteps.map((item) => item.promptText);

  return {
    key: 'bazi:natal:evidence',
    status: missingFactCount ? '存在资料缺口' : '已计算',
    calculationSteps,
    calculationChain,
    pillarFacts,
    analysisFacts,
    relationFacts,
    primaryFacts,
    supportingFacts,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText: [
      '【八字本命四柱与核心判断结构化证据】',
      `计算链：${calculationChain.join(' → ')}。`,
      `事实覆盖：四柱事实${pillarFacts.length}项、核心判断${analysisFacts.length}项、柱间关系${relationFacts.length}项；具体事实保留在对应结构化对象中，不按数量生成评分。`,
      `反证汇总：${counterSummaryFact.promptText}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: [
      '先按明确传统时辰，或按精准时分与出生地校正后的真太阳时确定唯一排盘时刻。',
      '按节气换年换月、当前换日口径与六十甲子生成四柱，再派生十神、藏干、纳音、十二运、旬空与柱间关系。',
      '旺衰、格局与用神取忌分别登记结果和依据，不用五行数量或单一标签替代完整判断链。',
      '本命原局只描述长期结构与触发条件，具体时间必须另行引用明确选择的岁运证据。',
    ],
  };
}
