/**
 * @file 紫微斗数格局来源审查与证据边界
 * @description 旧规则缺少逐条版本、卷页、原文与独立例盘，当前不执行任何自定义格局判定。
 */

import type {
  PalaceFact,
  PatternFact,
  ZiweiPatternAnalysis,
  ZiweiPatternCalculationStep,
  ZiweiPatternCounterEvidenceFact,
  ZiweiPatternLimitationFact,
  ZiweiPatternSummaryFact,
} from '../../types/analysis';

const ZIWEI_PALACE_COUNT = 12;
const RETIRED_UNVERIFIED_PATTERN_COUNT = 84;

const PATTERN_CALCULATION_LIMITATION =
  '紫微格局计算步骤只证明登记规则如何核对当前十二宫、星曜、亮度、四化与宫位关系；不得把命中数量解释为命盘分数、现实概率或必然事件' as const;
const PATTERN_COUNTER_LIMITATION =
  '紫微格局反证只记录十二宫资料、登记规则与未命中数量的覆盖状态；未命中不等于没有其他传统格局，也不证明现实有利或不利' as const;
const PATTERN_SUMMARY_LIMITATION =
  '紫微格局汇总只统计当前登记规则的评估覆盖和命中分类；不得按吉格、凶格、中性格或命中数量生成综合吉凶、权重、概率与固定应期' as const;
const PATTERN_FACT_LIMITATION =
  '紫微格局限制事实用于约束规则命中可以支持的解释范围，不得被反向当作现实因果、人物命运、吉凶概率或保证有效建议的证据' as const;

function normalizePalaceName(name: string) {
  return name.endsWith('宫') ? name.slice(0, -1) : name;
}

function assertValidPatternPalaces(
  palaces: PalaceFact[] | undefined,
): asserts palaces is PalaceFact[] {
  if (!Array.isArray(palaces) || palaces.length !== ZIWEI_PALACE_COUNT) {
    throw new Error('紫微格局检测需要完整 12 宫数据。');
  }

  const seenIndexes = new Set<number>();
  let soulPalaceCount = 0;

  palaces.forEach((palace, position) => {
    if (
      !Number.isInteger(palace?.index) ||
      palace.index < 0 ||
      palace.index >= ZIWEI_PALACE_COUNT
    ) {
      throw new Error(`紫微格局检测第 ${position + 1} 个宫位索引无效。`);
    }
    if (seenIndexes.has(palace.index)) {
      throw new Error(`紫微格局检测宫位索引 ${palace.index} 重复。`);
    }
    seenIndexes.add(palace.index);

    if (typeof palace.name !== 'string' || !palace.name.trim()) {
      throw new Error(`紫微格局检测第 ${position + 1} 个宫位名称缺失。`);
    }
    if (normalizePalaceName(palace.name) === '命') soulPalaceCount += 1;
    if (typeof palace.earthly_branch !== 'string' || !palace.earthly_branch.trim()) {
      throw new Error(`紫微格局检测${palace.name}地支缺失。`);
    }
    if (!Array.isArray(palace.major_stars)) {
      throw new Error(`紫微格局检测${palace.name}主星数据无效。`);
    }
    if (!Array.isArray(palace.minor_stars)) {
      throw new Error(`紫微格局检测${palace.name}辅星数据无效。`);
    }
    if (!Array.isArray(palace.other_stars)) {
      throw new Error(`紫微格局检测${palace.name}杂曜数据无效。`);
    }
    if (!Array.isArray(palace.scope_stars)) {
      throw new Error(`紫微格局检测${palace.name}运限星曜数据无效。`);
    }
  });

  if (soulPalaceCount !== 1) {
    throw new Error('紫微格局检测必须且只能包含一个命宫。');
  }

  palaces.forEach((palace) => {
    if (
      !Number.isInteger(palace.opposite_palace_index) ||
      !seenIndexes.has(palace.opposite_palace_index)
    ) {
      throw new Error(`紫微格局检测${palace.name}对宫索引无效。`);
    }
    if (
      !Array.isArray(palace.surrounded_palace_indexes) ||
      palace.surrounded_palace_indexes.length === 0
    ) {
      throw new Error(`紫微格局检测${palace.name}三方四正数据无效。`);
    }
    palace.surrounded_palace_indexes.forEach((index) => {
      if (!Number.isInteger(index) || !seenIndexes.has(index)) {
        throw new Error(`紫微格局检测${palace.name}三方四正宫位索引无效。`);
      }
    });
  });
}

export const ZIWEI_PATTERN_AUDIT_NOTICE =
  `原有${RETIRED_UNVERIFIED_PATTERN_COUNT}条项目格局规则缺少逐条版本、卷页、原文与独立例盘校勘，现阶段不参与排盘、证据或提示词输出` as const;

export function detectPatterns(params: {
  palaces: PalaceFact[];
  birthTimeLabel?: string;
  birthTimeRange?: string;
}): PatternFact[] {
  assertValidPatternPalaces(params.palaces);
  return [];
}

export function buildPatternAnalysis(params: {
  patterns: PatternFact[];
  palaces: PalaceFact[];
  skipped?: boolean;
  sourceUnverified?: boolean;
}): ZiweiPatternAnalysis {
  const { patterns, palaces, skipped = false, sourceUnverified = false } = params;
  const registeredRuleCount = 0;
  const uniquePalaceIndexCount = new Set(palaces.map((item) => item.index)).size;
  const palaceDataComplete =
    palaces.length === ZIWEI_PALACE_COUNT && uniquePalaceIndexCount === ZIWEI_PALACE_COUNT;
  const evaluatedRuleCount = 0;
  const unevaluatedRuleCount = 0;
  const matchedPatternCount = patterns.length;
  const unmatchedRuleCount = 0;
  const patternFactKeys = patterns.map(
    (item) => item.key ?? `ziwei:pattern:${item.stable_key ?? item.id}`,
  );
  const summaryStatus: ZiweiPatternSummaryFact['status'] = skipped
    ? '未生成'
    : !palaceDataComplete
      ? '资料不足'
      : matchedPatternCount === 0
        ? '未命中'
        : '已完成';
  const analysisStatus: ZiweiPatternAnalysis['status'] = skipped
    ? '未生成'
    : !palaceDataComplete
      ? '资料不足'
      : matchedPatternCount === 0
        ? '未命中'
        : '已计算';

  const calculationSteps: ZiweiPatternCalculationStep[] = [
    {
      key: 'ziwei:pattern:calculation:input',
      stage: '十二宫输入校验',
      status: palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: [],
      inputs: { palaceCount: palaces.length },
      result: { palaceDataComplete, uniquePalaceIndexCount },
      promptText: palaceDataComplete
        ? '已校验完整十二宫及唯一宫位索引'
        : `当前仅有${palaces.length}项宫位资料或宫位索引不唯一，不执行格局规则评估`,
      sources: ['紫微十二宫结构化盘面资料'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: 'ziwei:pattern:calculation:rule-evaluation',
      stage: '格局规则评估',
      status: skipped ? '未生成' : palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: ['ziwei:pattern:calculation:input'],
      inputs: { registeredRuleCount, palaceDataComplete },
      result: { evaluatedRuleCount, unevaluatedRuleCount },
      promptText: sourceUnverified
        ? `${ZIWEI_PATTERN_AUDIT_NOTICE}，不补造格局命中或未命中结果`
        : '当前没有已登记且完成来源校勘的格局规则',
      sources: ['紫微自定义格局逐条来源审查结果'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: 'ziwei:pattern:calculation:matched-facts',
      stage: '命中事实登记',
      status: skipped ? '未生成' : palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: ['ziwei:pattern:calculation:rule-evaluation'],
      inputs: { evaluatedRuleCount },
      result: { matchedPatternCount, unmatchedRuleCount, matchedPatternKeys: patternFactKeys },
      promptText: sourceUnverified
        ? '自定义格局来源尚未逐条校勘，当前不生成任何格局命中事实'
        : `登记${matchedPatternCount}项已校勘格局事实`,
      sources: ['逐条规则评估结果与实际命中宫位、星曜'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
    {
      key: 'ziwei:pattern:calculation:summary',
      stage: '格局覆盖汇总',
      status: skipped ? '未生成' : palaceDataComplete ? '已计算' : '资料不足',
      dependsOnStepKeys: ['ziwei:pattern:calculation:matched-facts'],
      inputs: { registeredRuleCount, evaluatedRuleCount, matchedPatternCount },
      result: { summaryStatus, unmatchedRuleCount, unevaluatedRuleCount },
      promptText: `格局规则覆盖状态为${summaryStatus}；已校勘登记规则${registeredRuleCount}条，命中${matchedPatternCount}项`,
      sources: ['格局规则来源审查与命中事实汇总'],
      limitation: PATTERN_CALCULATION_LIMITATION,
    },
  ];

  const counterEvidenceFacts: ZiweiPatternCounterEvidenceFact[] = [
    {
      key: 'ziwei:pattern:counter:palace-coverage',
      type: '十二宫资料覆盖',
      status: skipped ? '未生成' : palaceDataComplete ? '有可用证据' : '资料不足',
      ownerFactKeys: ['ziwei:pattern:calculation:input'],
      promptText: skipped
        ? '自定义格局来源尚未逐条校勘，空列表只表示停止输出，不表示命盘没有传统格局'
        : palaceDataComplete
          ? '十二宫资料与宫位索引完整'
          : '十二宫资料不完整，格局分析必须降级且不得补造命中结果',
      sources: ['十二宫输入校验结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
    {
      key: 'ziwei:pattern:counter:rule-coverage',
      type: '登记规则覆盖',
      status: skipped ? '未生成' : '有可用证据',
      ownerFactKeys: ['ziwei:pattern:calculation:rule-evaluation', ...patternFactKeys],
      promptText: sourceUnverified
        ? `${ZIWEI_PATTERN_AUDIT_NOTICE}；不得把空结果解释为没有传统格局`
        : '当前没有已登记且完成来源校勘的格局规则',
      sources: ['登记规则来源审查结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
    {
      key: 'ziwei:pattern:counter:unmatched-boundary',
      type: '未命中规则边界',
      status: skipped ? '未生成' : palaceDataComplete ? '未命中' : '资料不足',
      ownerFactKeys: ['ziwei:pattern:calculation:matched-facts', ...patternFactKeys],
      promptText: sourceUnverified
        ? '当前没有完成逐条来源校勘的格局规则，不得声称任何传统格局命中或未命中'
        : '没有已校勘规则可供评估，不形成传统格局未命中结论',
      sources: ['格局规则来源审查结果'],
      limitation: PATTERN_COUNTER_LIMITATION,
    },
  ];

  const summaryFact: ZiweiPatternSummaryFact = {
    key: 'ziwei:pattern-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...patternFactKeys,
      ...counterEvidenceFacts.map((item) => item.key),
    ],
    registeredRuleCount,
    evaluatedRuleCount,
    unevaluatedRuleCount,
    matchedPatternCount,
    unmatchedRuleCount,
    auspiciousPatternCount: patterns.filter((item) => item.kind === 'auspicious').length,
    inauspiciousPatternCount: patterns.filter((item) => item.kind === 'inauspicious').length,
    neutralPatternCount: patterns.filter((item) => item.kind === 'neutral').length,
    counterEvidenceCount: counterEvidenceFacts.length,
    limitationFactCount: 4,
    promptText: `格局证据状态为${summaryStatus}；已校勘登记规则${registeredRuleCount}条，命中${matchedPatternCount}项；空列表不代表命盘没有其他传统格局`,
    sources: ['格局规则来源审查、十二宫盘面与命中事实汇总'],
    limitation: PATTERN_SUMMARY_LIMITATION,
  };

  const limitationDefinitions: Array<
    Pick<ZiweiPatternLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'ziwei:pattern:limitation:traditional-classification',
      type: '传统分类边界',
      ownerFactKeys: [summaryFact.key, ...patternFactKeys],
      promptText: '吉格、凶格和中性格只属于传统分类标签，不是命盘总分，也不能相互加减抵消',
      sources: ['传统格局分类与量化评分分离原则'],
    },
    {
      key: 'ziwei:pattern:limitation:rule-coverage',
      type: '规则覆盖边界',
      ownerFactKeys: [summaryFact.key, 'ziwei:pattern:calculation:rule-evaluation'],
      promptText: '当前没有完成逐条来源校勘的自定义格局规则；空列表不代表命盘没有其他传统格局',
      sources: ['紫微自定义格局逐条来源审查结果'],
    },
    {
      key: 'ziwei:pattern:limitation:reality-causality',
      type: '现实因果边界',
      ownerFactKeys: [summaryFact.key, ...patternFactKeys],
      promptText: '规则命中只证明盘面满足登记条件，传统释义不得直接写成现实结果',
      sources: ['盘面结构事实与现实因果分离原则'],
    },
    {
      key: 'ziwei:pattern:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: [summaryFact.key, ...summaryFact.factKeys],
      promptText: '不得根据格局名称、传统分类或命中数量生成概率、保证、必然断语或固定应期',
      sources: ['传统规则事实与高风险现实结论分离原则'],
    },
  ];
  const limitationFacts: ZiweiPatternLimitationFact[] = limitationDefinitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: PATTERN_FACT_LIMITATION,
  }));
  const counterEvidence = counterEvidenceFacts
    .filter((item) => item.status !== '有可用证据')
    .map((item) => item.promptText);
  const limitations = limitationFacts.map((item) => item.promptText);

  return {
    key: 'ziwei:patterns',
    status: analysisStatus,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    counterEvidence,
    counterEvidenceFacts,
    summaryFact,
    limitations,
    limitationFacts,
    promptText: [
      '【紫微格局结构化证据】',
      `计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
      `反证核验：${counterEvidence.join('；')}。`,
      `证据汇总：${summaryFact.promptText}。`,
      `解释限制：${limitations.join('；')}。`,
    ].join('\n'),
    methodology: {
      notes: [
        '自定义格局必须先完成逐条版本、卷页、原文与独立例盘校勘，当前不参与排盘与提示词。',
        '空格局列表只代表当前停止输出，不代表命盘不存在传统格局。',
        '未来只有完成来源校勘与独立例盘验证的规则才可重新登记。',
      ],
    },
  };
}
