import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { TarotData } from '../types/divination';
import { tarotSpreads } from './tarot-data';

export interface TarotCardEvidence {
  key: string;
  status: '已映射';
  index: number;
  cardId: number;
  position: string;
  name: string;
  orientation: '正位' | '逆位';
  keywords: string[];
  element: string;
  archetype: string;
  activeMeaning: string;
  promptMeaning: string;
  constraints: string[];
  traditionalFactKey: string;
  promptText: string;
  sources: string[];
  limitation: '逐牌事实只记录牌位、牌名、正逆位、关键词、元素与牌阶主题；不得由单牌或牌面数量直接推断现实事件、他人意图、疾病、法律事实、财务结果、成功率或唯一未来';
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
  status: '有逆位约束' | '未见逆位约束';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明本次牌面是否存在逆位解释约束；未见逆位不代表结果必然有利，也不得按逆位数量换算吉凶或成功率';
}

export interface TarotLimitationFact {
  key: string;
  type: '随机边界' | '象征材料边界' | '聚合边界' | '正逆位边界' | '高风险结论边界' | '时间边界';
  status: '适用';
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束牌面材料可以支持的解释范围，不得被反向当作现实事件、人物意图或未来结果的证据';
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
  sources: Array<{ title: string; evidence: string; role: '牌组结构' | '传统解释来源' }>;
  cards: TarotCardEvidence[];
  spreadCoverageFact: TarotSpreadCoverageFact;
  drawFact: TarotDrawFact;
  drawOrderFacts: TarotDrawOrderFact[];
  drawFacts: string[];
  sequenceFacts: TarotSequenceFact[];
  sequence: string[];
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
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function normalizeElement(element?: string) {
  return element?.split('（')[0] || '元素未列';
}

const TRADITIONAL_FACT_LIMITATION =
  '牌义、关键词、元素与牌阶只作为当前牌位的象征解释材料，不证明现实事件、他人意图、心理状态、疾病、法律事实、财务结果或唯一未来' as const;
const DRAW_FACT_LIMITATION =
  '抽牌来源只记录洗牌、牌位顺序与正逆位生成过程；来源链完整不表示牌义可信度、预测有效性或现实结果' as const;
const CARD_FACT_LIMITATION =
  '逐牌事实只记录牌位、牌名、正逆位、关键词、元素与牌阶主题；不得由单牌或牌面数量直接推断现实事件、他人意图、疾病、法律事实、财务结果、成功率或唯一未来' as const;
const SPREAD_COVERAGE_LIMITATION =
  '牌阵覆盖状态只说明牌数、牌位顺序与牌面唯一性是否符合已声明牌阵；缺失、重复、越位或未知牌阵时不得补造牌面、牌位或跨牌关系' as const;
const DRAW_ORDER_FACT_LIMITATION =
  '逐张抽取事实只核对洗牌顺序记录与已确定牌面的牌号、牌名、牌位和正逆位；记录一致不表示牌义可信度、预测有效性或现实结果' as const;
const SEQUENCE_FACT_LIMITATION =
  '牌序事实只描述已声明牌位的相邻顺序与牌面变化；不得把牌阵顺序直接写成现实事件必然按同样阶段发生' as const;
const THEME_FACT_LIMITATION =
  '主题聚合只统计元素或大阿卡纳标签在本次牌面中的出现次数；不得按次数生成权重、能量分数、吉凶总分、成功率或主导结论' as const;
const COUNTER_FACT_LIMITATION =
  '逆位反证只表示该牌主题可能受阻、过度、内化或方向偏离；不得把单张逆位直接写成现实失败、不利结果、疾病、欺骗、损失或灾祸' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明本次牌面是否存在逆位解释约束；未见逆位不代表结果必然有利，也不得按逆位数量换算吉凶或成功率' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束牌面材料可以支持的解释范围，不得被反向当作现实事件、人物意图或未来结果的证据' as const;

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
      ? `牌组规模：${data.draw.deckSize}张；洗牌方法：${data.draw.method}；正逆位规则：${data.draw.orientationRule}；${drawOrderFacts.map((item) => item.promptText).join('；')}${status === '来源链缺失' ? `；当前仅记录${order.length}/${data.cards.length}张抽取顺序，不能完整核验` : status === '来源链不一致' ? `；第${mismatchIndexes.join('、')}张来源记录与牌面不一致` : ''}`
      : `现有资料未附洗牌与抽取顺序，仅保留${data.cards.length}张已确定牌面，不能反推完整抽牌来源链`,
    sources: ['78张塔罗牌组与 Fisher-Yates 洗牌记录', '牌位顺序取牌与逐牌正逆位判定记录'],
    limitation: DRAW_FACT_LIMITATION,
  };
}

export function conditionTarotTraditionalText(text: string, orientation?: '正位' | '逆位'): string {
  const conditioned = text
    .replace(/信息被隐藏/g, '信息可能尚未充分公开')
    .replace(/还没找到真正答案/g, '尚未取得足以核实的答案')
    .replace(/公平结果尚未落定/g, '与公平相关的现实结果仍待核实')
    .replace(/成功比预期更晚到来/g, '与成功期待相关的进展可能晚于预期')
    .replace(/隐藏信息正在慢慢显现/g, '尚未核实的信息可能逐步出现线索')
    .replace(/内部结构已不稳/g, '可留意既有安排是否存在不稳定迹象')
    .replace(/必然/g, '可能')
    .replace(/一定/g, '可能');
  const upright = conditioned.match(/^正位强调(.+?)[，,]表示这些能量正在直接发挥作用[。.]?$/);
  if (upright) {
    return `正位传统牌义侧重${upright[1]}；可作为这些主题可能较直接呈现的象征线索，须结合牌位与现实资料核实`;
  }
  if (orientation === '正位') {
    const meaning = conditioned.replace(/[。.]$/, '');
    return `正位传统牌义提示可留意${meaning || '相关主题可能较直接呈现'}；须结合牌位、整组牌序与现实资料核实`;
  }
  const reversed = conditioned.replace(/^逆位重点[：:]?/, '').replace(/[。.]$/, '');
  if (orientation === '逆位' || /^逆位重点[：:]?/.test(conditioned)) {
    return `逆位传统牌义提示可留意${reversed || '相关主题可能受阻、过度、内化或方向偏离'}；须结合牌位、整组牌序与现实资料核实`;
  }
  return `传统牌义提示可留意${reversed || '当前牌面主题'}；须结合正逆位、牌位、整组牌序与现实资料核实`;
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

function buildThemeFacts(cards: TarotCardEvidence[]): TarotThemeFact[] {
  const grouped = new Map<string, TarotCardEvidence[]>();
  cards.forEach((card) => {
    const theme = normalizeElement(card.element);
    if (theme === '元素未列') return;
    grouped.set(theme, [...(grouped.get(theme) ?? []), card]);
  });
  return Array.from(grouped.entries()).map(([theme, ownerCards]) => ({
    key: `tarot:theme:${theme}`,
    status: ownerCards.length >= 2 ? '重复主题' : '单次出现',
    theme,
    count: ownerCards.length,
    cardFactKeys: ownerCards.map((card) => card.key),
    promptText: `${theme}主题出现${ownerCards.length}张，关联${ownerCards.map((card) => `${card.position}${card.name}${card.orientation}`).join('、')}；只表示牌面构成，不等于权重分数`,
    sources: ['逐牌元素标签与大阿卡纳标签', '同类标签逐张计数'],
    limitation: THEME_FACT_LIMITATION,
  }));
}

function buildCounterEvidenceFacts(cards: TarotCardEvidence[]): TarotCounterEvidenceFact[] {
  return cards.flatMap((card) =>
    card.constraints.map((constraint, index) => ({
      key: `tarot:counter:${card.index}:${index + 1}`,
      ownerCardKey: card.key,
      position: card.position,
      card: card.name,
      orientation: card.orientation,
      type: '逆位解释约束',
      status: '已触发',
      detail: constraint,
      promptText: `${card.position}${card.name}${card.orientation}：${constraint}`,
      sources: ['逐牌正逆位记录', '逆位解释约束与整组牌序互证原则'],
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
}

function buildCounterSummaryFact(
  counterEvidenceFacts: TarotCounterEvidenceFact[],
): TarotCounterSummaryFact {
  const hasCounterEvidence = counterEvidenceFacts.length > 0;
  return {
    key: 'tarot:counter-summary',
    status: hasCounterEvidence ? '有逆位约束' : '未见逆位约束',
    factKeys: counterEvidenceFacts.map((fact) => fact.key),
    promptText: hasCounterEvidence
      ? `共记录${counterEvidenceFacts.length}条逆位解释约束，须与对应牌位、相邻牌序和现实资料共同核验`
      : '牌面未见逆位解释约束；这不代表结果必然有利，也不提高任何结论的可信度',
    sources: ['逐牌正逆位记录', '逆位解释约束逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(): TarotLimitationFact[] {
  const definitions: Array<Pick<TarotLimitationFact, 'key' | 'type' | 'promptText' | 'sources'>> = [
    {
      key: 'tarot:limitation:random',
      type: '随机边界',
      promptText: '塔罗抽牌包含随机过程；seed或replay只能复现抽牌轨迹，不证明预测有效性',
      sources: ['洗牌、抽牌和正逆位随机轨迹', '随机轨迹可重放边界'],
    },
    {
      key: 'tarot:limitation:symbolic-material',
      type: '象征材料边界',
      promptText: '牌位、牌名、正逆位、关键词、元素和牌阶属于象征解释材料，不是现代统计证据',
      sources: ['韦特系牌组结构', '牌位与传统牌义解释范围'],
    },
    {
      key: 'tarot:limitation:aggregation',
      type: '聚合边界',
      promptText: '重复元素或大阿卡纳数量只用于描述牌面构成，不生成能量分数、吉凶总分或成功率',
      sources: ['逐牌元素与牌阶标签计数', '构成描述与结论分离原则'],
    },
    {
      key: 'tarot:limitation:orientation',
      type: '正逆位边界',
      promptText: '正位不等于必然有利，逆位不等于必然不利，必须结合牌位、问题和整组牌序',
      sources: ['逐牌正逆位记录', '牌位与整组牌序互证原则'],
    },
    {
      key: 'tarot:limitation:high-risk',
      type: '高风险结论边界',
      promptText: '牌面不能证明他人隐私、医疗诊断、法律事实、投资回报或唯一未来结果',
      sources: ['象征解释与现实事实分离原则'],
    },
    {
      key: 'tarot:limitation:timing',
      type: '时间边界',
      promptText: '未给现实期限时不得把牌号、张数或牌义换算为绝对日期',
      sources: ['牌号、张数与现实时间无确定换算关系'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeTarotEvidence(data: TarotData): TarotEvidenceAnalysis {
  if (!data.cards.length) throw new Error('塔罗结构化证据至少需要一张牌。');
  const sources: TarotEvidenceAnalysis['sources'] = [
    {
      title: '78张韦特系塔罗牌组结构',
      evidence: '22张大阿卡纳与四组小阿卡纳的牌名、牌组和牌阶结构',
      role: '牌组结构',
    },
    {
      title: '韦特系牌义与牌阵资料',
      evidence: '牌位、关键词、正逆位、元素主题和牌阶主题的统一解释范围',
      role: '传统解释来源',
    },
  ];
  const cards = data.cards.map((card, index): TarotCardEvidence => {
    const orientation = card.reversed ? '逆位' : '正位';
    const activeMeaning = card.reversed
      ? card.reversedMeaning || `${card.keywords.join('、')}相关主题可能受阻、过度或内化`
      : card.uprightMeaning || `${card.keywords.join('、')}相关主题直接呈现`;
    const promptMeaning = conditionTarotTraditionalText(activeMeaning, orientation);
    const key = `tarot:card:${index + 1}:${card.id}:${orientation}`;
    const traditionalFactKey = `card:${index + 1}:${card.name}:${orientation}`;
    return {
      key,
      status: '已映射',
      index: index + 1,
      cardId: card.id,
      position: card.position,
      name: card.name,
      orientation,
      keywords: [...card.keywords],
      element: card.element || '元素未列',
      archetype: card.archetype || '牌阶主题未列',
      activeMeaning,
      promptMeaning,
      constraints: card.reversed
        ? ['逆位只表示该牌主题可能受阻、过度、内化或方向偏离，须结合牌位与整组牌序']
        : [],
      traditionalFactKey,
      promptText: `${card.position}为${card.name}${orientation}；关键词${card.keywords.join('、') || '未列'}；元素主题${card.element || '元素未列'}；牌阶主题${card.archetype || '牌阶主题未列'}；${promptMeaning}`,
      sources: ['已声明牌阵牌位', '已确定牌号、牌名与正逆位', '韦特系逐牌关键词、元素与牌阶资料'],
      limitation: CARD_FACT_LIMITATION,
    };
  });
  const traditionalFacts = cards.map((card): TarotTraditionalFact => ({
    key: card.traditionalFactKey,
    status: '已映射',
    index: card.index,
    position: card.position,
    card: card.name,
    orientation: card.orientation,
    kind: '牌义解释',
    originalText: card.activeMeaning,
    promptText: card.promptMeaning,
    sources: ['韦特系78张牌组结构', '当前逐牌关键词与正逆位解释资料'],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
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
  const themeFacts = buildThemeFacts(cards);
  const recurringThemeFacts = themeFacts.filter((fact) => fact.status === '重复主题');
  const recurringThemes = recurringThemeFacts.map(
    (fact) => `${fact.theme}主题出现${fact.count}张，只表示牌面重复，不等于权重分数`,
  );
  const trace = data.meta?.random;
  const randomFact = buildRandomTraceFact({
    key: `random:tarot:${data.spreadType}`,
    applicable: true,
    trace,
    processLabel: `${data.spreadName}的洗牌、抽牌与正逆位生成过程`,
    sources: ['塔罗牌阵与抽牌顺序记录', '洗牌、抽牌、正逆位随机样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const counterEvidenceFacts = buildCounterEvidenceFacts(cards);
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts.map(
    (fact) => `${fact.position}${fact.card}：${fact.detail}`,
  );
  const limitationFacts = buildLimitationFacts();
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const drawTitle =
    drawFact.status === '可核验'
      ? '洗牌、抽取顺序与正逆位事实'
      : drawFact.status === '来源链不一致'
        ? '抽牌来源链不一致'
        : '抽牌来源链缺失';
  const items: PromptEvidenceItem[] = [
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
    ...cards.map((card, index): PromptEvidenceItem => ({
      level: index === cards.length - 1 || cards.length === 1 ? '主证' : '辅证',
      title: `${card.position}：${card.name}${card.orientation}`,
      detail: `${card.promptText}；边界：${card.limitation}`,
      source: card.sources.join('、'),
      tags: [card.position, card.name, card.orientation, normalizeElement(card.element)],
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
    ...(recurringThemeFacts.length
      ? [
          {
            level: '辅证' as const,
            title: '重复元素构成',
            detail: `${recurringThemeFacts.map((fact) => fact.promptText).join('；')}；边界：${THEME_FACT_LIMITATION}`,
            source: Array.from(new Set(recurringThemeFacts.flatMap((fact) => fact.sources))).join(
              '、',
            ),
            tags: ['构成描述', '不计权重'],
          },
        ]
      : []),
    {
      level: randomFact.status === '可重放' ? '辅证' : '反证',
      title: randomFact.status === '可重放' ? '随机过程重放记录' : '随机轨迹缺失',
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
      title: `逆位约束汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['逆位约束', counterSummaryFact.status],
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
    `重复主题：${recurringThemes.join('；') || '未见达到两张的同类元素主题，不强行归纳主导元素'}。`,
    `反证限制：${counterSummaryFact.promptText}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    sources,
    cards,
    spreadCoverageFact,
    drawFact,
    drawOrderFacts,
    drawFacts,
    sequenceFacts,
    sequence,
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
    evidence,
    promptText,
    methodology: [
      '先固定牌阵与牌位，再逐张读取牌名、正逆位、关键词、元素和牌阶主题。',
      '按牌位顺序保留跨牌推进关系，不脱离牌位孤立套用牌义。',
      '重复元素只作为构成描述，逆位作为解释约束，不转换为分数。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
