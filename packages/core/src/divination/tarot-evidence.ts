import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  createSeededRandom,
  formatLegacyRandomFacts,
  type RandomTrace,
  type RandomTraceFact,
} from '../shared/random';
import { createResultMeta } from '../shared/result';
import type { TarotData } from '../types/divination';
import type { TarotSpreadType } from '../types/divination';
import { tarotCards, tarotSpreads } from './tarot-data';

export interface TarotCardEvidence {
  key: string;
  status: '已映射';
  index: number;
  cardId: number;
  position: string;
  name: string;
  orientation: '正位' | '逆位';
  promptText: string;
  sources: string[];
  limitation: '逐牌事实只记录项目内部牌号、牌名、牌位与正逆位；关键词、牌义、元素、牌阶与组合规则在版本校勘完成前不得输出';
}

export interface TarotSpreadCoverageFact {
  key: 'tarot:spread-coverage';
  status: '完整' | '牌数不符' | '牌位异常' | '未知牌阵';
  spreadType: string;
  spreadName: string;
  expectedCardCount: number | null;
  actualCardCount: number;
  expectedPositions: string[];
  actualPositions: string[];
  missingPositions: string[];
  duplicatePositions: string[];
  unexpectedPositions: string[];
  positionOrderMismatches: number[];
  duplicateCardIds: number[];
  cardFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '牌阵覆盖状态只说明牌数、牌位顺序与牌面唯一性是否符合已声明牌阵；缺失、重复、越位或未知牌阵时不得补造牌面、牌位或跨牌关系';
}

export interface TarotDrawOrderFact {
  key: string;
  status: '一致' | '不一致' | '缺少牌面';
  index: number;
  recordedIndex: number;
  cardFactKey: string | null;
  position: string;
  cardId: number;
  cardName: string;
  orientation: '正位' | '逆位';
  mismatches: string[];
  promptText: string;
  sources: string[];
  limitation: '逐张抽取事实只核对洗牌顺序记录与已确定牌面的牌号、牌名、牌位和正逆位；记录一致不表示牌义可信度、预测有效性或现实结果';
}

export interface TarotSequenceFact {
  key: string;
  status: '已连接';
  fromCardKey: string;
  toCardKey: string;
  fromPosition: string;
  toPosition: string;
  fromCard: string;
  toCard: string;
  promptText: string;
  sources: string[];
  limitation: '牌序事实只描述已声明牌位的相邻顺序与牌面变化；不得把牌阵顺序直接写成现实事件必然按同样阶段发生';
}

export type TarotElementInteractionRelation =
  '同类强化' | '相互助长' | '相互制约' | '中性并置' | '核心课题介入' | '资料不足';

export interface TarotElementInteractionFact {
  key: string;
  status: '已计算' | '资料不足';
  fromCardKey: string;
  toCardKey: string;
  fromPosition: string;
  toPosition: string;
  fromCard: string;
  toCard: string;
  fromElement: string;
  toElement: string;
  relation: TarotElementInteractionRelation;
  orientationConstraint: string;
  promptText: string;
  sources: string[];
  limitation: '相邻牌元素互参只描述四元素传统关系或大阿卡纳介入方式；正逆位只约束表达方向，不改变元素关系，不得据此生成吉凶分数、事件结论、成功率或唯一未来';
}

export interface TarotThemeFact {
  key: string;
  status: '重复主题' | '单次出现';
  theme: string;
  count: number;
  cardFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '主题聚合只统计元素或大阿卡纳标签在本次牌面中的出现次数；不得按次数生成权重、能量分数、吉凶总分、成功率或主导结论';
}

export interface TarotCounterEvidenceFact {
  key: string;
  ownerCardKey: string;
  position: string;
  card: string;
  orientation: '正位' | '逆位';
  type: '逆位解释约束';
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '逆位反证只表示该牌主题可能受阻、过度、内化或方向偏离；不得把单张逆位直接写成现实失败、不利结果、疾病、欺骗、损失或灾祸';
}

export interface TarotCounterSummaryFact {
  key: 'tarot:counter-summary';
  status: '有逆位约束' | '未见逆位约束' | '解释规则待校';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明本次牌面是否存在逆位解释约束；未见逆位不代表结果必然有利，也不得按逆位数量换算吉凶或成功率';
}

export interface TarotLimitationFact {
  key: string;
  type: '随机边界' | '象征材料边界' | '聚合边界' | '正逆位边界' | '高风险结论边界' | '时间边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束牌面材料可以支持的解释范围，不得被反向当作现实事件、人物意图或未来结果的证据';
}

export interface TarotEvidenceCalculationStep {
  key: string;
  stage:
    | '随机来源核验'
    | '抽牌记录核验'
    | '牌阵覆盖核验'
    | '逐牌映射核验'
    | '牌序关系核验'
    | '主题与反证核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明随机轨迹、抽牌记录、牌阵覆盖、逐牌映射、牌序、相邻元素互参、主题与逆位约束如何形成当前证据；不证明预测有效性、现实吉凶、人物意图或唯一未来';
}

export interface TarotSummaryFact {
  key: 'tarot:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  cardFactCount: number;
  drawOrderFactCount: number;
  sequenceFactCount: number;
  elementInteractionFactCount: number;
  themeFactCount: number;
  recurringThemeFactCount: number;
  counterEvidenceCount: number;
  traditionalFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '塔罗证据汇总只统计随机、抽牌、牌阵、逐牌、牌序、相邻元素互参、主题、逆位约束与传统牌义的覆盖情况；不得按数量生成能量分数、吉凶总分、成功率、人物判断或唯一未来';
}

export interface TarotTraditionalFact {
  key: string;
  status: '已映射';
  index: number;
  position: string;
  card: string;
  orientation: '正位' | '逆位';
  kind: '牌义解释';
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '牌义、关键词、元素与牌阶只作为当前牌位的象征解释材料，不证明现实事件、他人意图、心理状态、疾病、法律事实、财务结果或唯一未来';
}

export interface TarotDrawFact {
  key: string;
  status: '可核验' | '来源链缺失' | '来源链不一致';
  deckSize?: number;
  method?: string;
  orientationRule?: string;
  order: NonNullable<TarotData['draw']>['order'];
  expectedCardCount: number;
  recordedCardCount: number;
  orderFactKeys: string[];
  mismatchIndexes: number[];
  missingIndexes: number[];
  extraIndexes: number[];
  promptText: string;
  sources: string[];
  limitation: '抽牌来源只记录洗牌、牌位顺序与正逆位生成过程；来源链完整不表示牌义可信度、预测有效性或现实结果';
}

export interface TarotEvidenceAnalysis {
  key: 'tarot:evidence';
  status: '已计算';
  calculationSteps: TarotEvidenceCalculationStep[];
  calculationChain: string[];
  sources: Array<{ title: string; evidence: string; role: '抽牌索引' | '来源限制' }>;
  cards: TarotCardEvidence[];
  spreadCoverageFact: TarotSpreadCoverageFact;
  drawFact: TarotDrawFact;
  drawOrderFacts: TarotDrawOrderFact[];
  drawFacts: string[];
  sequenceFacts: TarotSequenceFact[];
  sequence: string[];
  elementInteractionFacts: TarotElementInteractionFact[];
  elementInteractions: string[];
  themeFacts: TarotThemeFact[];
  recurringThemeFacts: TarotThemeFact[];
  recurringThemes: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidenceFacts: TarotCounterEvidenceFact[];
  counterSummaryFact: TarotCounterSummaryFact;
  counterEvidence: string[];
  limitationFacts: TarotLimitationFact[];
  limitations: string[];
  traditionalFacts: TarotTraditionalFact[];
  summaryFact: TarotSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const DRAW_FACT_LIMITATION =
  '抽牌来源只记录洗牌、牌位顺序与正逆位生成过程；来源链完整不表示牌义可信度、预测有效性或现实结果' as const;
const CARD_FACT_LIMITATION =
  '逐牌事实只记录项目内部牌号、牌名、牌位与正逆位；关键词、牌义、元素、牌阶与组合规则在版本校勘完成前不得输出' as const;
const SPREAD_COVERAGE_LIMITATION =
  '牌阵覆盖状态只说明牌数、牌位顺序与牌面唯一性是否符合已声明牌阵；缺失、重复、越位或未知牌阵时不得补造牌面、牌位或跨牌关系' as const;
const DRAW_ORDER_FACT_LIMITATION =
  '逐张抽取事实只核对洗牌顺序记录与已确定牌面的牌号、牌名、牌位和正逆位；记录一致不表示牌义可信度、预测有效性或现实结果' as const;
const SEQUENCE_FACT_LIMITATION =
  '牌序事实只描述已声明牌位的相邻顺序与牌面变化；不得把牌阵顺序直接写成现实事件必然按同样阶段发生' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明本次牌面是否存在逆位解释约束；未见逆位不代表结果必然有利，也不得按逆位数量换算吉凶或成功率' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束牌面材料可以支持的解释范围，不得被反向当作现实事件、人物意图或未来结果的证据' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明随机轨迹、抽牌记录、牌阵覆盖、逐牌映射、牌序、相邻元素互参、主题与逆位约束如何形成当前证据；不证明预测有效性、现实吉凶、人物意图或唯一未来' as const;
const SUMMARY_FACT_LIMITATION =
  '塔罗证据汇总只统计随机、抽牌、牌阵、逐牌、牌序、相邻元素互参、主题、逆位约束与传统牌义的覆盖情况；不得按数量生成能量分数、吉凶总分、成功率、人物判断或唯一未来' as const;

function buildSpreadCoverageFact(
  data: TarotData,
  cards: TarotCardEvidence[],
): TarotSpreadCoverageFact {
  const spread = tarotSpreads[data.spreadType as keyof typeof tarotSpreads];
  const expectedPositions = spread ? [...spread.positions] : [];
  const actualPositions = cards.map((item) => item.position);
  const missingPositions = expectedPositions.filter(
    (position) => !actualPositions.includes(position),
  );
  const duplicatePositions = [...new Set(actualPositions)].filter(
    (position) => actualPositions.filter((item) => item === position).length > 1,
  );
  const unexpectedPositions = spread
    ? actualPositions.filter((position) => !expectedPositions.includes(position))
    : [];
  const positionOrderMismatches = spread
    ? actualPositions.flatMap((position, index) =>
        expectedPositions[index] === position ? [] : [index + 1],
      )
    : [];
  const cardIds = cards.map((item) => item.cardId);
  const duplicateCardIds = [...new Set(cardIds)].filter(
    (cardId) => cardIds.filter((item) => item === cardId).length > 1,
  );
  const status: TarotSpreadCoverageFact['status'] = !spread
    ? '未知牌阵'
    : cards.length !== spread.cardCount
      ? '牌数不符'
      : missingPositions.length ||
          duplicatePositions.length ||
          unexpectedPositions.length ||
          positionOrderMismatches.length ||
          duplicateCardIds.length
        ? '牌位异常'
        : '完整';
  return {
    key: 'tarot:spread-coverage',
    status,
    spreadType: data.spreadType,
    spreadName: data.spreadName,
    expectedCardCount: spread?.cardCount ?? null,
    actualCardCount: cards.length,
    expectedPositions,
    actualPositions,
    missingPositions,
    duplicatePositions,
    unexpectedPositions,
    positionOrderMismatches,
    duplicateCardIds,
    cardFactKeys: cards.map((item) => item.key),
    promptText:
      status === '完整'
        ? `${data.spreadName}共${cards.length}张，牌位顺序与牌面唯一性完整`
        : status === '未知牌阵'
          ? `牌阵类型${data.spreadType}未找到已声明配置，不得补造预期牌位与牌数`
          : status === '牌数不符'
            ? `${data.spreadName}应有${spread?.cardCount ?? '未知'}张，当前记录${cards.length}张，不得补造缺失牌面`
            : `牌阵资料异常：缺少牌位${missingPositions.join('、') || '无'}；重复牌位${duplicatePositions.join('、') || '无'}；越位牌位${unexpectedPositions.join('、') || '无'}；顺序不符位置${positionOrderMismatches.join('、') || '无'}；重复牌号${duplicateCardIds.join('、') || '无'}`,
    sources: ['已声明牌阵牌数与牌位顺序', '当前逐牌位置与牌号唯一性核验'],
    limitation: SPREAD_COVERAGE_LIMITATION,
  };
}

function buildDrawOrderFacts(data: TarotData, cards: TarotCardEvidence[]): TarotDrawOrderFact[] {
  return (data.draw?.order ?? []).map((item, orderIndex) => {
    const expectedIndex = orderIndex + 1;
    const card = cards[orderIndex];
    const mismatches = card
      ? [
          item.index === expectedIndex ? '' : `记录序号应为${expectedIndex}`,
          card.position === item.position ? '' : `牌位应为${card.position}`,
          card.cardId === item.cardId ? '' : `牌号应为${card.cardId}`,
          card.name === item.cardName ? '' : `牌名应为${card.name}`,
          card.orientation === item.orientation ? '' : `正逆位应为${card.orientation}`,
        ].filter(Boolean)
      : ['缺少对应牌面'];
    const status: TarotDrawOrderFact['status'] = !card
      ? '缺少牌面'
      : mismatches.length
        ? '不一致'
        : '一致';
    return {
      key: `tarot:draw-order:${expectedIndex}`,
      status,
      index: expectedIndex,
      recordedIndex: item.index,
      cardFactKey: card?.key ?? null,
      position: item.position,
      cardId: item.cardId,
      cardName: item.cardName,
      orientation: item.orientation,
      mismatches,
      promptText: `第${expectedIndex}张记录对应${item.position}：牌号${item.cardId} ${item.cardName}${item.orientation}${mismatches.length ? `；不一致项：${mismatches.join('、')}` : '；与牌面记录一致'}`,
      sources: ['洗牌后依牌位顺序取牌记录', '已确定逐牌牌号、牌名、牌位与正逆位'],
      limitation: DRAW_ORDER_FACT_LIMITATION,
    };
  });
}

function buildDrawFact(data: TarotData, drawOrderFacts: TarotDrawOrderFact[]): TarotDrawFact {
  const isManual = data.draw?.method === '用户按牌位手工录入';
  const isInteractive = data.draw?.method === '用户逐张触发前端随机抽取';
  const order = (data.draw?.order ?? []).map((item) => ({ ...item }));
  const missingIndexes = Array.from(
    { length: Math.max(0, data.cards.length - order.length) },
    (_, index) => order.length + index + 1,
  );
  const extraIndexes = Array.from(
    { length: Math.max(0, order.length - data.cards.length) },
    (_, index) => data.cards.length + index + 1,
  );
  const mismatchIndexes = [
    ...drawOrderFacts.filter((item) => item.status !== '一致').map((item) => item.index),
    ...missingIndexes,
    ...extraIndexes,
  ].filter((item, index, values) => values.indexOf(item) === index);
  const status: TarotDrawFact['status'] =
    !data.draw || order.length !== data.cards.length
      ? '来源链缺失'
      : mismatchIndexes.length
        ? '来源链不一致'
        : '可核验';
  return {
    key: `draw:tarot:${data.spreadType}`,
    status,
    deckSize: data.draw?.deckSize,
    method: data.draw?.method,
    orientationRule: data.draw?.orientationRule,
    order,
    expectedCardCount: data.cards.length,
    recordedCardCount: order.length,
    orderFactKeys: drawOrderFacts.map((item) => item.key),
    mismatchIndexes,
    missingIndexes,
    extraIndexes,
    promptText: data.draw
      ? `牌组规模：${data.draw.deckSize}张；${isManual ? '录入方式' : isInteractive ? '抽取方式' : '洗牌方法'}：${data.draw.method}；正逆位规则：${data.draw.orientationRule}；${drawOrderFacts.map((item) => item.promptText).join('；')}${status === '来源链缺失' ? `；当前仅记录${order.length}/${data.cards.length}张来源顺序，不能完整核验` : status === '来源链不一致' ? `；第${mismatchIndexes.join('、')}张来源记录与牌面不一致` : ''}`
      : `现有资料未附洗牌与抽取顺序，仅保留${data.cards.length}张已确定牌面，不能反推完整抽牌来源链`,
    sources: isManual
      ? ['78张塔罗牌组', '用户按牌位逐张录入的牌号与正逆位记录']
      : isInteractive
        ? ['78张塔罗牌组', '用户逐张触发的抽牌与正逆位随机样本记录']
        : ['78张塔罗牌组与 Fisher-Yates 洗牌记录', '牌位顺序取牌与逐牌正逆位判定记录'],
    limitation: DRAW_FACT_LIMITATION,
  };
}

export function conditionTarotTraditionalText(text: string, orientation?: '正位' | '逆位'): string {
  void text;
  void orientation;
  return '逐牌牌义来源尚未完成版本校勘，不得补造或解释';
}

function buildSequenceFacts(cards: TarotCardEvidence[]): TarotSequenceFact[] {
  return cards.slice(1).map((card, index) => {
    const previous = cards[index];
    return {
      key: `tarot:sequence:${previous.index}-${card.index}`,
      status: '已连接',
      fromCardKey: previous.key,
      toCardKey: card.key,
      fromPosition: previous.position,
      toPosition: card.position,
      fromCard: `${previous.name}${previous.orientation}`,
      toCard: `${card.name}${card.orientation}`,
      promptText: `${previous.position}${previous.name}${previous.orientation} → ${card.position}${card.name}${card.orientation}`,
      sources: ['已声明牌阵的牌位顺序', '相邻牌位的已确定牌面与正逆位'],
      limitation: SEQUENCE_FACT_LIMITATION,
    };
  });
}

function buildCounterSummaryFact(
  counterEvidenceFacts: TarotCounterEvidenceFact[],
): TarotCounterSummaryFact {
  const hasCounterEvidence = counterEvidenceFacts.length > 0;
  return {
    key: 'tarot:counter-summary',
    status: hasCounterEvidence ? '有逆位约束' : '解释规则待校',
    factKeys: counterEvidenceFacts.map((fact) => fact.key),
    promptText: hasCounterEvidence
      ? `共记录${counterEvidenceFacts.length}条逆位解释约束，须与对应牌位、相邻牌序和现实资料共同核验`
      : '只记录正逆位原始事实；逆位应如何解释须在明确具体牌义版本后另行确定',
    sources: ['逐牌正逆位记录', '牌义版本来源闭合检查'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildSummaryFact(params: {
  cards: TarotCardEvidence[];
  spreadCoverageFact: TarotSpreadCoverageFact;
  drawFact: TarotDrawFact;
  drawOrderFacts: TarotDrawOrderFact[];
  sequenceFacts: TarotSequenceFact[];
  elementInteractionFacts: TarotElementInteractionFact[];
  themeFacts: TarotThemeFact[];
  recurringThemeFacts: TarotThemeFact[];
  randomFact: RandomTraceFact;
  counterSummaryFact: TarotCounterSummaryFact;
  counterEvidenceFacts: TarotCounterEvidenceFact[];
  traditionalFacts: TarotTraditionalFact[];
}): TarotSummaryFact {
  const status =
    params.spreadCoverageFact.status === '完整' &&
    params.drawFact.status === '可核验' &&
    ['可重放', '不适用'].includes(params.randomFact.status) &&
    params.drawOrderFacts.length === params.cards.length &&
    params.traditionalFacts.length === params.cards.length
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'tarot:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        params.randomFact.key,
        params.drawFact.key,
        ...params.drawOrderFacts.map((item) => item.key),
        params.spreadCoverageFact.key,
        ...params.cards.map((item) => item.key),
        ...params.sequenceFacts.map((item) => item.key),
        ...params.elementInteractionFacts.map((item) => item.key),
        ...params.themeFacts.map((item) => item.key),
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
        ...params.traditionalFacts.map((item) => item.key),
      ]),
    ),
    cardFactCount: params.cards.length,
    drawOrderFactCount: params.drawOrderFacts.length,
    sequenceFactCount: params.sequenceFacts.length,
    elementInteractionFactCount: params.elementInteractionFacts.length,
    themeFactCount: params.themeFacts.length,
    recurringThemeFactCount: params.recurringThemeFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    promptText: `证据链状态：${status}；逐牌${params.cards.length}项、抽取顺序${params.drawOrderFacts.length}项、牌序关系${params.sequenceFacts.length}项、相邻元素互参${params.elementInteractionFacts.length}项、主题标签${params.themeFacts.length}项、重复主题${params.recurringThemeFacts.length}项、逆位约束${params.counterEvidenceFacts.length}项、传统牌义${params.traditionalFacts.length}项`,
    sources: ['随机、抽牌、牌阵、逐牌原始记录与牌义版本来源状态逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  cards: TarotCardEvidence[];
  spreadCoverageFact: TarotSpreadCoverageFact;
  drawFact: TarotDrawFact;
  drawOrderFacts: TarotDrawOrderFact[];
  sequenceFacts: TarotSequenceFact[];
  elementInteractionFacts: TarotElementInteractionFact[];
  themeFacts: TarotThemeFact[];
  recurringThemeFacts: TarotThemeFact[];
  randomFact: RandomTraceFact;
  counterSummaryFact: TarotCounterSummaryFact;
  counterEvidenceFacts: TarotCounterEvidenceFact[];
  summaryFact: TarotSummaryFact;
}): TarotEvidenceCalculationStep[] {
  return [
    {
      key: 'tarot:calculation:random',
      stage: '随机来源核验',
      status: params.randomFact.status === '缺少轨迹' ? '资料不足' : '已计算',
      inputs: { randomMode: params.randomFact.mode },
      result: {
        randomStatus: params.randomFact.status,
        sampleCount: params.randomFact.sampleCount,
      },
      dependsOnStepKeys: [],
      promptText: params.randomFact.promptText,
      sources: params.randomFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'tarot:calculation:draw',
      stage: '抽牌记录核验',
      status: params.drawFact.status === '可核验' ? '已计算' : '资料不足',
      inputs: {
        expectedCardCount: params.drawFact.expectedCardCount,
        recordedCardCount: params.drawFact.recordedCardCount,
      },
      result: {
        drawStatus: params.drawFact.status,
        drawOrderFactCount: params.drawOrderFacts.length,
        mismatchIndexes: params.drawFact.mismatchIndexes.map(String),
        missingIndexes: params.drawFact.missingIndexes.map(String),
      },
      dependsOnStepKeys: ['tarot:calculation:random'],
      promptText: params.drawFact.promptText,
      sources: params.drawFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'tarot:calculation:spread',
      stage: '牌阵覆盖核验',
      status: params.spreadCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        spreadType: params.spreadCoverageFact.spreadType,
        expectedCardCount: params.spreadCoverageFact.expectedCardCount ?? '未知',
      },
      result: {
        coverageStatus: params.spreadCoverageFact.status,
        actualCardCount: params.spreadCoverageFact.actualCardCount,
        missingPositions: params.spreadCoverageFact.missingPositions,
        duplicatePositions: params.spreadCoverageFact.duplicatePositions,
      },
      dependsOnStepKeys: ['tarot:calculation:draw'],
      promptText: params.spreadCoverageFact.promptText,
      sources: params.spreadCoverageFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'tarot:calculation:cards',
      stage: '逐牌映射核验',
      status: params.cards.length ? '已计算' : '资料不足',
      inputs: { cardCount: params.cards.length },
      result: {
        mappedCardCount: params.cards.length,
        positions: params.cards.map((item) => item.position),
        orientations: params.cards.map((item) => item.orientation),
      },
      dependsOnStepKeys: ['tarot:calculation:spread'],
      promptText: `已逐牌核对${params.cards.length}个牌位的项目内部牌号、牌名与正逆位；牌义解释待版本校勘`,
      sources: Array.from(new Set(params.cards.flatMap((item) => item.sources))),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'tarot:calculation:sequence',
      stage: '牌序关系核验',
      status: params.cards.length ? '已计算' : '资料不足',
      inputs: { cardCount: params.cards.length },
      result: {
        sequenceFactCount: params.sequenceFacts.length,
        elementInteractionFactCount: params.elementInteractionFacts.length,
        elementInteractionRelations: params.elementInteractionFacts.map((item) => item.relation),
      },
      dependsOnStepKeys: ['tarot:calculation:cards'],
      promptText: params.sequenceFacts.length
        ? `按牌位顺序记录${params.sequenceFacts.length}项相邻抽牌事实；元素互参规则未校定，不计算组合关系`
        : '单牌牌阵无跨牌顺序；不补造组合关系',
      sources: Array.from(
        new Set([
          '已声明牌阵的牌位顺序完整性检查',
          ...params.sequenceFacts.flatMap((item) => item.sources),
          ...params.elementInteractionFacts.flatMap((item) => item.sources),
        ]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'tarot:calculation:themes-counter',
      stage: '主题与反证核验',
      status: '资料不足',
      inputs: { cardCount: params.cards.length },
      result: {
        themeFactCount: params.themeFacts.length,
        recurringThemeFactCount: params.recurringThemeFacts.length,
        counterStatus: params.counterSummaryFact.status,
        counterEvidenceCount: params.counterEvidenceFacts.length,
      },
      dependsOnStepKeys: ['tarot:calculation:sequence'],
      promptText: `关键词、元素、牌阶、重复主题与逆位解释规则均待具体牌义版本校勘；${params.counterSummaryFact.promptText}`,
      sources: Array.from(
        new Set([
          ...params.themeFacts.flatMap((item) => item.sources),
          ...params.counterSummaryFact.sources,
        ]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'tarot:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        cardFactCount: params.summaryFact.cardFactCount,
        sequenceFactCount: params.summaryFact.sequenceFactCount,
        elementInteractionFactCount: params.summaryFact.elementInteractionFactCount,
        themeFactCount: params.summaryFact.themeFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
      },
      dependsOnStepKeys: [
        'tarot:calculation:random',
        'tarot:calculation:draw',
        'tarot:calculation:spread',
        'tarot:calculation:cards',
        'tarot:calculation:sequence',
        'tarot:calculation:themes-counter',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  randomFact: RandomTraceFact;
  spreadCoverageFact: TarotSpreadCoverageFact;
  cards: TarotCardEvidence[];
  sequenceFacts: TarotSequenceFact[];
  elementInteractionFacts: TarotElementInteractionFact[];
  themeFacts: TarotThemeFact[];
  counterSummaryFact: TarotCounterSummaryFact;
  counterEvidenceFacts: TarotCounterEvidenceFact[];
  traditionalFacts: TarotTraditionalFact[];
  summaryFact: TarotSummaryFact;
}): TarotLimitationFact[] {
  const definitions: Array<
    Pick<TarotLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'tarot:limitation:random',
      type: '随机边界',
      ownerFactKeys: [params.randomFact.key],
      promptText:
        params.randomFact.status === '不适用'
          ? '手工录入只核对用户提交的牌号、牌位与正逆位，不依赖随机抽样'
          : '塔罗抽牌包含随机过程；seed或replay只能复现抽牌轨迹，不证明预测有效性',
      sources:
        params.randomFact.status === '不适用'
          ? ['用户手工录入来源边界']
          : ['洗牌、抽牌和正逆位随机轨迹', '随机轨迹可重放边界'],
    },
    {
      key: 'tarot:limitation:symbolic-material',
      type: '象征材料边界',
      ownerFactKeys: [
        params.spreadCoverageFact.key,
        ...params.cards.map((item) => item.key),
        ...params.traditionalFacts.map((item) => item.key),
      ],
      promptText: '当前只可使用项目内部牌号、牌名、牌位和正逆位原始记录；牌义来源未闭合',
      sources: ['项目内部牌号与牌名目录', '牌义版本来源闭合检查'],
    },
    {
      key: 'tarot:limitation:aggregation',
      type: '聚合边界',
      ownerFactKeys: [
        ...params.sequenceFacts.map((item) => item.key),
        ...params.elementInteractionFacts.map((item) => item.key),
        ...params.themeFacts.map((item) => item.key),
      ],
      promptText: '元素互参、牌阶、重复主题与组合规则没有完成版本校勘，不计算、不输出',
      sources: ['牌义版本来源闭合检查'],
    },
    {
      key: 'tarot:limitation:orientation',
      type: '正逆位边界',
      ownerFactKeys: [
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
        ...params.cards.map((item) => item.key),
      ],
      promptText: '正逆位只作为原始抽牌状态记录；未明确具体牌义版本和正逆位规则时不解释',
      sources: ['逐牌正逆位记录', '牌义版本来源闭合检查'],
    },
    {
      key: 'tarot:limitation:high-risk',
      type: '高风险结论边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText: '牌面不能证明他人隐私、医疗诊断、法律事实、投资回报或唯一未来结果',
      sources: ['象征解释与现实事实分离原则'],
    },
    {
      key: 'tarot:limitation:timing',
      type: '时间边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText: '未给现实期限时不得把牌号、张数或牌义换算为绝对日期',
      sources: ['牌号、张数与现实时间无确定换算关系'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    ownerFactKeys: definition.ownerFactKeys.length
      ? Array.from(new Set(definition.ownerFactKeys))
      : [params.summaryFact.key],
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

type AuditedTarotSource = 'manual' | 'interactive' | 'random';

function assertTarotTimestamp(timestamp: number): number {
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    Number.isNaN(new Date(timestamp).getTime())
  ) {
    throw new Error('塔罗结果时间戳无效，无法重建可信证据。');
  }
  return timestamp;
}

function normalizeTarotRandomTrace(input: TarotData, timestamp: number): RandomTrace | undefined {
  const rawTrace = input.meta?.random;
  if (rawTrace === undefined) return undefined;
  const trace = createResultMeta({
    algorithm: 'tarot.audit.trace',
    input: { spreadType: input.spreadType },
    calculatedAt: timestamp,
    random: rawTrace,
  }).random!;
  if (trace.mode === 'seeded' && trace.seed === undefined) {
    throw new Error('塔罗 seeded 随机轨迹缺少种子，无法核验。');
  }
  if (trace.mode !== 'seeded' && trace.seed !== undefined) {
    throw new Error('塔罗非 seeded 随机轨迹不应携带种子。');
  }
  if (trace.mode === 'seeded') {
    const seeded = createSeededRandom(trace.seed!);
    trace.samples.forEach((sample, index) => {
      if (seeded() !== sample) {
        throw new Error(`塔罗随机轨迹第${index + 1}个样本与种子不一致。`);
      }
    });
    return trace;
  }
  return { mode: 'replay', samples: [...trace.samples] };
}

function replayTarotCards(
  spreadType: TarotSpreadType,
  trace: RandomTrace,
): {
  source: Exclude<AuditedTarotSource, 'manual'>;
  cards: Array<{ id: number; reversed: boolean }>;
} {
  const spread = tarotSpreads[spreadType];
  const randomSampleCount = tarotCards.length - 1 + spread.cardCount;
  const interactiveSampleCount = spread.cardCount * 2;
  if (trace.samples.length === randomSampleCount) {
    const deck = [...tarotCards];
    for (let index = deck.length - 1, sampleIndex = 0; index > 0; index--, sampleIndex++) {
      const targetIndex = Math.floor(trace.samples[sampleIndex] * (index + 1));
      [deck[index], deck[targetIndex]] = [deck[targetIndex], deck[index]];
    }
    return {
      source: 'random',
      cards: deck.slice(0, spread.cardCount).map((card, index) => ({
        id: card.number,
        reversed: trace.samples[tarotCards.length - 1 + index] < 0.5,
      })),
    };
  }
  if (trace.samples.length === interactiveSampleCount) {
    const remaining = [...tarotCards];
    const cards = Array.from({ length: spread.cardCount }, (_, index) => {
      const drawSample = trace.samples[index * 2];
      const orientationSample = trace.samples[index * 2 + 1];
      const cardIndex = Math.floor(drawSample * remaining.length);
      const [card] = remaining.splice(cardIndex, 1);
      if (!card) throw new Error(`塔罗互动抽牌第${index + 1}张无法映射到剩余牌组。`);
      return { id: card.number, reversed: orientationSample < 0.5 };
    });
    return { source: 'interactive', cards };
  }
  throw new Error(
    `${spread.name}随机轨迹应为${randomSampleCount}个完整洗牌样本或${interactiveSampleCount}个逐张抽牌样本，当前为${trace.samples.length}个。`,
  );
}

function buildAuditedTarotDraw(
  cards: TarotData['cards'],
  source: AuditedTarotSource,
): NonNullable<TarotData['draw']> {
  return {
    deckSize: tarotCards.length,
    method:
      source === 'manual'
        ? '用户按牌位手工录入'
        : source === 'interactive'
          ? '用户逐张触发前端随机抽取'
          : 'Fisher-Yates洗牌后依牌位顺序取顶牌',
    orientationRule:
      source === 'manual'
        ? '正逆位由用户逐张录入'
        : '每张牌独立取随机数，小于0.5为逆位，否则为正位',
    order: cards.map((card, index) => ({
      index: index + 1,
      position: card.position,
      cardId: card.id,
      cardName: card.name,
      orientation: card.reversed ? '逆位' : '正位',
    })),
  };
}

/** 只保留牌阵、牌号、正逆位与可核验来源，其余牌面事实一律按标准资料重建。 */
export function rebuildAuditedTarotData(input: TarotData): TarotData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('塔罗结果必须是对象。');
  }
  const spread = tarotSpreads[input.spreadType as TarotSpreadType];
  if (!spread) throw new Error(`未知的牌阵类型: ${String(input.spreadType)}`);
  if (!Array.isArray(input.cards) || input.cards.length !== spread.cardCount) {
    throw new Error(`${spread.name}必须完整记录${spread.cardCount}张牌。`);
  }
  const timestamp = assertTarotTimestamp(input.timestamp);
  const rawCards = input.cards.map((card, index) => {
    if (!card || typeof card !== 'object' || !Number.isSafeInteger(card.id)) {
      throw new Error(`第${index + 1}张塔罗牌号无效。`);
    }
    if (!tarotCards.some((reference) => reference.number === card.id)) {
      throw new Error(`第${index + 1}张塔罗牌号不在标准78张牌组中。`);
    }
    if (typeof card.reversed !== 'boolean') {
      throw new Error(`第${index + 1}张塔罗牌正逆位必须是布尔值。`);
    }
    return { id: card.id, reversed: card.reversed };
  });
  if (new Set(rawCards.map((card) => card.id)).size !== rawCards.length) {
    throw new Error('同一次塔罗牌阵不能出现重复牌号。');
  }

  const trace = normalizeTarotRandomTrace(input, timestamp);
  let source: AuditedTarotSource;
  if (trace) {
    const replayed = replayTarotCards(input.spreadType as TarotSpreadType, trace);
    source = replayed.source;
    replayed.cards.forEach((card, index) => {
      const actual = rawCards[index];
      if (actual.id !== card.id || actual.reversed !== card.reversed) {
        throw new Error(`第${index + 1}张塔罗牌与随机轨迹重放结果不一致。`);
      }
    });
  } else if (input.draw?.method === '用户按牌位手工录入') {
    source = 'manual';
  } else {
    throw new Error('塔罗随机抽牌缺少完整随机轨迹，且未声明为手工录入，无法建立可信来源。');
  }

  const cards: TarotData['cards'] = rawCards.map((rawCard, index) => {
    const reference = tarotCards.find((card) => card.number === rawCard.id)!;
    return {
      id: reference.number,
      name: reference.name,
      position: spread.positions[index],
      reversed: rawCard.reversed,
    };
  });
  const algorithm =
    source === 'manual'
      ? 'tarot.spread.manual'
      : source === 'interactive'
        ? 'tarot.spread.interactive'
        : input.spreadType === 'single'
          ? 'tarot.single'
          : 'tarot.spread';
  const rebuilt: TarotData = {
    spreadType: input.spreadType,
    spreadName: spread.name,
    cards,
    draw: buildAuditedTarotDraw(cards, source),
    timestamp,
    meta: createResultMeta({
      algorithm,
      input:
        source === 'manual'
          ? { spreadType: input.spreadType, manualCards: rawCards }
          : { spreadType: input.spreadType },
      calculatedAt: timestamp,
      ...(trace ? { random: trace } : {}),
    }),
  };
  rebuilt.evidenceAnalysis = analyzeRebuiltTarotEvidence(rebuilt);
  return rebuilt;
}

function analyzeRebuiltTarotEvidence(data: TarotData): TarotEvidenceAnalysis {
  if (!data.cards.length) throw new Error('塔罗结构化证据至少需要一张牌。');
  const sources: TarotEvidenceAnalysis['sources'] = [
    {
      title: '项目内部78张牌号与牌名目录',
      evidence: '只用于牌号、牌名、抽取顺序与随机轨迹复算，不声明为某一牌组版本的权威编号',
      role: '抽牌索引',
    },
    {
      title: '逐牌牌义版本待校',
      evidence: '旧关键词、正逆位牌义、元素、牌阶和组合规则没有逐条定位到具体牌组版本、原文与页码',
      role: '来源限制',
    },
  ];
  const cards = data.cards.map((card, index): TarotCardEvidence => {
    const orientation = card.reversed ? '逆位' : '正位';
    const key = `tarot:card:${index + 1}:${card.id}:${orientation}`;
    return {
      key,
      status: '已映射',
      index: index + 1,
      cardId: card.id,
      position: card.position,
      name: card.name,
      orientation,
      promptText: `${card.position}为项目内部牌号${card.id}、牌名${card.name}、${orientation}；逐牌牌义来源尚未完成版本校勘，不作解释`,
      sources: ['已声明牌阵牌位', '项目内部牌号与牌名目录', '已记录正逆位'],
      limitation: CARD_FACT_LIMITATION,
    };
  });
  const traditionalFacts: TarotTraditionalFact[] = [];
  const spreadCoverageFact = buildSpreadCoverageFact(data, cards);
  const drawOrderFacts = buildDrawOrderFacts(data, cards);
  const drawFact = buildDrawFact(data, drawOrderFacts);
  const drawFacts = data.draw
    ? [
        `牌组规模：${data.draw.deckSize}张；洗牌方法：${data.draw.method}`,
        `正逆位规则：${data.draw.orientationRule}`,
        ...drawOrderFacts.map(
          (fact) =>
            `第${fact.recordedIndex}张对应${fact.position}：牌号${fact.cardId} ${fact.cardName}${fact.orientation}`,
        ),
      ]
    : [drawFact.promptText];
  const sequenceFacts = buildSequenceFacts(cards);
  const sequence = sequenceFacts.map((fact) => fact.promptText);
  const elementInteractionFacts: TarotElementInteractionFact[] = [];
  const elementInteractions = elementInteractionFacts.map((fact) => fact.promptText);
  const themeFacts: TarotThemeFact[] = [];
  const recurringThemeFacts = themeFacts.filter((fact) => fact.status === '重复主题');
  const recurringThemes = recurringThemeFacts.map(
    (fact) => `${fact.theme}主题出现${fact.count}张，只表示牌面重复，不等于权重分数`,
  );
  const trace = data.meta?.random;
  const isManual = data.draw?.method === '用户按牌位手工录入';
  const isInteractive = data.draw?.method === '用户逐张触发前端随机抽取';
  const randomFact = buildRandomTraceFact({
    key: `random:tarot:${data.spreadType}`,
    applicable: !isManual,
    trace,
    processLabel: isManual
      ? `${data.spreadName}的手工牌面与正逆位录入过程`
      : isInteractive
        ? `${data.spreadName}的逐张抽牌与正逆位生成过程`
        : `${data.spreadName}的洗牌、抽牌与正逆位生成过程`,
    sources: isManual
      ? ['用户按牌位逐张录入的牌面与正逆位记录']
      : isInteractive
        ? ['塔罗牌阵与逐张抽牌顺序记录', '抽牌、正逆位随机样本与重放元数据']
        : ['塔罗牌阵与抽牌顺序记录', '洗牌、抽牌、正逆位随机样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const counterEvidenceFacts: TarotCounterEvidenceFact[] = [];
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts.map(
    (fact) => `${fact.position}${fact.card}：${fact.detail}`,
  );
  const summaryFact = buildSummaryFact({
    cards,
    spreadCoverageFact,
    drawFact,
    drawOrderFacts,
    sequenceFacts,
    elementInteractionFacts,
    themeFacts,
    recurringThemeFacts,
    randomFact,
    counterSummaryFact,
    counterEvidenceFacts,
    traditionalFacts,
  });
  const calculationSteps = buildCalculationSteps({
    cards,
    spreadCoverageFact,
    drawFact,
    drawOrderFacts,
    sequenceFacts,
    elementInteractionFacts,
    themeFacts,
    recurringThemeFacts,
    randomFact,
    counterSummaryFact,
    counterEvidenceFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts({
    randomFact,
    spreadCoverageFact,
    cards,
    sequenceFacts,
    elementInteractionFacts,
    themeFacts,
    counterSummaryFact,
    counterEvidenceFacts,
    traditionalFacts,
    summaryFact,
  });
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const drawTitle =
    drawFact.status === '可核验'
      ? isManual
        ? '手工录入牌序与正逆位事实'
        : '洗牌、抽取顺序与正逆位事实'
      : drawFact.status === '来源链不一致'
        ? '抽牌来源链不一致'
        : '抽牌来源链缺失';
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '塔罗抽牌与牌阵计算链',
      detail: `${calculationChain.join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status, data.spreadType],
    },
    {
      level: drawFact.status === '可核验' ? '辅证' : '反证',
      title: drawTitle,
      detail: `${drawFact.promptText}；边界：${drawFact.limitation}`,
      source: drawFact.sources.join('、'),
      tags: ['抽牌来源', '洗牌', '正逆位', drawFact.status],
    },
    {
      level: spreadCoverageFact.status === '完整' ? '辅证' : '反证',
      title: `牌阵结构：${data.spreadName}`,
      detail: `${spreadCoverageFact.promptText}；边界：${spreadCoverageFact.limitation}`,
      source: spreadCoverageFact.sources.join('、'),
      tags: ['牌阵结构', data.spreadType, spreadCoverageFact.status],
    },
    ...cards.map((card): PromptEvidenceItem => ({
      level: '辅证',
      title: `${card.position}：${card.name}${card.orientation}`,
      detail: `${card.promptText}；边界：${card.limitation}`,
      source: card.sources.join('、'),
      tags: [card.position, card.name, card.orientation, '牌义待校'],
    })),
    ...(sequenceFacts.length
      ? [
          {
            level: '辅证' as const,
            title: '牌位顺序推进',
            detail: `${sequenceFacts.map((fact) => fact.promptText).join('；')}；边界：${SEQUENCE_FACT_LIMITATION}`,
            source: Array.from(new Set(sequenceFacts.flatMap((fact) => fact.sources))).join('、'),
            tags: ['牌序', '相邻关系'],
          },
        ]
      : []),
    {
      level: randomFact.status === '缺少轨迹' ? '反证' : '辅证',
      title:
        randomFact.status === '不适用'
          ? '手工录入来源'
          : randomFact.status === '可重放'
            ? '随机过程重放记录'
            : '随机轨迹缺失',
      detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
      source: randomFact.sources.join('、'),
      tags: ['随机轨迹', randomFact.status, '不代表预测有效性'],
    },
  ];
  items.push(
    ...counterEvidenceFacts.map((fact): PromptEvidenceItem => ({
      level: '反证',
      title: `${fact.position}${fact.card}解释约束`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['逆位约束', fact.position],
    })),
    {
      level: '反证',
      title: `正逆位解释状态：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['逆位约束', counterSummaryFact.status],
    },
    {
      level: '辅证',
      title: `塔罗证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '塔罗牌面解释边界',
      detail: `${limitationFacts.map((fact) => fact.promptText).join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((fact) => fact.sources))).join('、'),
      tags: ['象征解释', '现实复核'],
    },
  );
  const evidence: PromptEvidenceBundle = { title: '塔罗牌位与牌面结构化证据', items };
  const promptText = [
    '【塔罗牌位与牌面结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `牌序关系：${sequence.join('；') || '单牌牌阵，无跨牌推进关系'}。`,
    '元素互参：版本规则待校，本次不计算。',
    '重复主题：关键词、元素与牌阶标签待校，本次不归纳。',
    `正逆位解释：${counterSummaryFact.promptText}。`,
    `计算链：${calculationChain.join(' → ')}`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    key: 'tarot:evidence',
    status: '已计算',
    calculationSteps,
    calculationChain,
    sources,
    cards,
    spreadCoverageFact,
    drawFact,
    drawOrderFacts,
    drawFacts,
    sequenceFacts,
    sequence,
    elementInteractionFacts,
    elementInteractions,
    themeFacts,
    recurringThemeFacts,
    recurringThemes,
    randomFact,
    randomFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    limitationFacts,
    limitations,
    traditionalFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先固定牌阵与牌位，再逐张核对项目内部牌号、牌名和正逆位。',
      '按牌位顺序保留抽牌记录，不把顺序直接解释为现实事件推进。',
      '关键词、牌义、元素、牌阶、组合与正逆位解释在具体版本和原文映射闭合前失败关闭。',
      '如需继续解读，先明确牌组版本、牌义文献、牌阵定义与正逆位规则。',
    ],
  };
}

/** 所有公开证据分析均先经过可信重建，禁止旧派生字段直接进入提示词。 */
export function analyzeTarotEvidence(input: TarotData): TarotEvidenceAnalysis {
  return rebuildAuditedTarotData(input).evidenceAnalysis!;
}
