import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { LenormandCombinationRelation, LenormandData } from '../types/divination';

export interface LenormandCardEvidence {
  key: string;
  status: '已映射';
  index: number;
  cardId: number;
  name: string;
  position: string;
  keywords: string[];
  meaning: string;
  house?: string;
  row?: number;
  column?: number;
  traditionalFactKey: string;
  promptText: string;
  sources: string[];
  limitation: '逐牌事实只记录牌位、牌号、牌名、关键词、基础牌义、宫位与行列落点；不得由单牌直接推断现实事件、他人意图、隐私、疾病、法律事实、财务结果、概率数值或唯一未来';
}

export interface LenormandSpreadCoverageFact {
  key: 'lenormand:spread-coverage';
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
  limitation: '牌阵覆盖状态只核对牌数、牌位顺序与牌面唯一性；缺失、重复、越位或未知牌阵时不得补造牌面、牌位、组合或布局关系';
}

export interface LenormandDrawOrderFact {
  key: string;
  status: '一致' | '不一致' | '缺少牌面';
  index: number;
  recordedIndex: number;
  cardFactKey: string | null;
  position: string;
  cardId: number;
  cardName: string;
  house?: string;
  row?: number;
  column?: number;
  mismatches: string[];
  promptText: string;
  sources: string[];
  limitation: '逐张抽取事实只核对洗牌顺序记录与已确定牌面的序号、牌位、牌号、牌名、宫位和行列落点；记录一致不表示牌义可信度、预测有效性或现实结果';
}

export interface LenormandSequenceFact {
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
  limitation: '牌序事实只描述抽取或登记顺序与牌面衔接，不代表两张牌在网格中空间相邻；不得把牌阵顺序直接写成现实事件必然按同样阶段发生';
}

export interface LenormandLayoutCoverageFact {
  key: 'lenormand:layout-coverage';
  status: '结构化覆盖' | '旧版字符串兼容' | '结构缺失' | '不适用';
  spreadType: string;
  expectedRequiredFactCount: number;
  structuredFactCount: number;
  legacyFactCount: number;
  layoutFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '布局覆盖只说明九宫或大桌所需的中心、路径、宫位和人物牌近身关系是否有可核验结构；旧版字符串不得反推行列、宫位、距离或缺失布局事实';
}

export interface LenormandCounterEvidenceFact {
  key: string;
  type: '固定组合覆盖' | '布局覆盖';
  status: '有可用证据' | '存在缺口';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录固定组合或布局证据是否存在；没有命中不代表现实不利，存在证据也不证明现实事件、吉凶或预测有效性';
}

export interface LenormandCounterSummaryFact {
  key: 'lenormand:counter-summary';
  status: '有证据缺口' | '未见证据缺口';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明固定组合与适用布局的资料覆盖情况；不得据此生成吉凶等级、概率数值或现实结果';
}

export interface LenormandLimitationFact {
  key: string;
  type: '随机边界' | '组合分层边界' | '布局边界' | '象征材料边界' | '高风险结论边界' | '时间边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束雷诺曼牌面、组合和布局可以支持的解释范围，不得被反向当作现实事件或未来结果的证据';
}

export interface LenormandEvidenceCalculationStep {
  key: string;
  stage:
    | '随机来源核验'
    | '抽牌记录核验'
    | '牌阵覆盖核验'
    | '逐牌映射核验'
    | '牌序与组合核验'
    | '布局覆盖核验'
    | '反证核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明随机轨迹、抽牌记录、牌阵覆盖、逐牌、牌序组合、九宫或大桌布局与反证如何形成当前证据；不证明预测有效性、现实吉凶、人物意图、概率或唯一未来';
}

export interface LenormandSummaryFact {
  key: 'lenormand:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  cardFactCount: number;
  drawOrderFactCount: number;
  sequenceFactCount: number;
  fixedCombinationCount: number;
  adjacentReadingCount: number;
  structuredLayoutFactCount: number;
  counterEvidenceCount: number;
  traditionalFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '雷诺曼证据汇总只统计随机、抽牌、牌阵、逐牌、牌序、固定组合、相邻合读、布局与反证覆盖；不得按数量生成吉凶等级、概率数值、人物判断、时间保证或唯一未来';
}

export interface LenormandTraditionalFact {
  key: string;
  status: '已映射';
  kind: '单牌牌义' | '固定组合' | '相邻合读';
  cardFactKeys: string[];
  cardNames: string[];
  positions: string[];
  originalText: string;
  promptText: string;
  verificationTargets: string[];
  sources: string[];
  limitation: '牌名、关键词、单牌牌义与组合牌义只作为当前牌阵的象征解释材料，不证明现实事件、他人意图、隐私、感情承诺、怀孕生育、疾病、法律事实、财务结果或唯一未来';
}

export interface LenormandLayoutFact {
  key: string;
  status: '已计算';
  kind: '九宫中心' | '九宫路径' | '大桌宫位' | '人物牌近身' | '归宫';
  cardFactKeys: string[];
  cardNames: string[];
  positions: string[];
  houses: string[];
  factText: string;
  promptText: string;
  source: string;
  sources: string[];
  limitation: '布局位置是由牌阵顺序计算的事实；中心、路径、近身与归宫只定义传统读取范围，不自动证明吉凶、现实事件或时间';
}

export interface LenormandDrawFact {
  key: string;
  status: '可核验' | '来源链缺失' | '来源链不一致';
  deckSize?: number;
  method?: string;
  order: NonNullable<LenormandData['draw']>['order'];
  expectedCardCount: number;
  recordedCardCount: number;
  orderFactKeys: string[];
  mismatchIndexes: number[];
  missingIndexes: number[];
  extraIndexes: number[];
  promptText: string;
  sources: string[];
  limitation: '抽牌来源只记录洗牌、牌位顺序、宫位和行列落点；来源链完整不表示牌义可信度、预测有效性或现实结果';
}

export interface LenormandEvidenceAnalysis {
  key: 'lenormand:evidence';
  status: '已计算';
  calculationSteps: LenormandEvidenceCalculationStep[];
  calculationChain: string[];
  cards: LenormandCardEvidence[];
  spreadCoverageFact: LenormandSpreadCoverageFact;
  sequenceFacts: LenormandSequenceFact[];
  sequence: string[];
  fixedCombinations: NonNullable<LenormandData['combinations']>;
  adjacentReadings: NonNullable<LenormandData['combinations']>;
  drawFact: LenormandDrawFact;
  drawOrderFacts: LenormandDrawOrderFact[];
  drawFacts: string[];
  layoutFacts: string[];
  layoutCoverageFact: LenormandLayoutCoverageFact;
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidence: string[];
  counterEvidenceFacts: LenormandCounterEvidenceFact[];
  counterSummaryFact: LenormandCounterSummaryFact;
  limitations: string[];
  limitationFacts: LenormandLimitationFact[];
  traditionalFacts: LenormandTraditionalFact[];
  structuredLayoutFacts: LenormandLayoutFact[];
  summaryFact: LenormandSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const TRADITIONAL_FACT_LIMITATION =
  '牌名、关键词、单牌牌义与组合牌义只作为当前牌阵的象征解释材料，不证明现实事件、他人意图、隐私、感情承诺、怀孕生育、疾病、法律事实、财务结果或唯一未来' as const;
const LAYOUT_FACT_LIMITATION =
  '布局位置是由牌阵顺序计算的事实；中心、路径、近身与归宫只定义传统读取范围，不自动证明吉凶、现实事件或时间' as const;
const DRAW_FACT_LIMITATION =
  '抽牌来源只记录洗牌、牌位顺序、宫位和行列落点；来源链完整不表示牌义可信度、预测有效性或现实结果' as const;
const CARD_FACT_LIMITATION =
  '逐牌事实只记录牌位、牌号、牌名、关键词、基础牌义、宫位与行列落点；不得由单牌直接推断现实事件、他人意图、隐私、疾病、法律事实、财务结果、概率数值或唯一未来' as const;
const SPREAD_COVERAGE_LIMITATION =
  '牌阵覆盖状态只核对牌数、牌位顺序与牌面唯一性；缺失、重复、越位或未知牌阵时不得补造牌面、牌位、组合或布局关系' as const;
const DRAW_ORDER_FACT_LIMITATION =
  '逐张抽取事实只核对洗牌顺序记录与已确定牌面的序号、牌位、牌号、牌名、宫位和行列落点；记录一致不表示牌义可信度、预测有效性或现实结果' as const;
const SEQUENCE_FACT_LIMITATION =
  '牌序事实只描述抽取或登记顺序与牌面衔接，不代表两张牌在网格中空间相邻；不得把牌阵顺序直接写成现实事件必然按同样阶段发生' as const;
const LAYOUT_COVERAGE_LIMITATION =
  '布局覆盖只说明九宫或大桌所需的中心、路径、宫位和人物牌近身关系是否有可核验结构；旧版字符串不得反推行列、宫位、距离或缺失布局事实' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录固定组合或布局证据是否存在；没有命中不代表现实不利，存在证据也不证明现实事件、吉凶或预测有效性' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明固定组合与适用布局的资料覆盖情况；不得据此生成吉凶等级、概率数值或现实结果' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束雷诺曼牌面、组合和布局可以支持的解释范围，不得被反向当作现实事件或未来结果的证据' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明随机轨迹、抽牌记录、牌阵覆盖、逐牌、牌序组合、九宫或大桌布局与反证如何形成当前证据；不证明预测有效性、现实吉凶、人物意图、概率或唯一未来' as const;
const SUMMARY_FACT_LIMITATION =
  '雷诺曼证据汇总只统计随机、抽牌、牌阵、逐牌、牌序、固定组合、相邻合读、布局与反证覆盖；不得按数量生成吉凶等级、概率数值、人物判断、时间保证或唯一未来' as const;

const LENORMAND_SPREAD_POSITIONS: Record<string, string[]> = {
  single: ['核心线索'],
  three: ['起因', '现状', '走向'],
  five: ['过去背景', '当前处境', '隐藏因素', '外在助力', '最终走向'],
  relationship: ['你的状态', '对方状态', '关系纽带', '隐藏因素', '后续走向'],
  decision: ['当前处境', '选择A', '选择A走向', '选择B', '选择B走向', '关键建议'],
  nine: ['左上', '上方', '右上', '左侧', '核心', '右侧', '左下', '下方', '右下'],
  element: ['火（行动/能量）', '水（情感/直觉）', '风（思维/沟通）', '土（物质/根基）'],
  grandTableau: Array.from({ length: 36 }, (_, index) => `第${index + 1}宫`),
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeCoveragePosition(spreadType: string, position: string) {
  if (spreadType !== 'grandTableau') return position;
  return position.match(/^第\d+宫/)?.[0] ?? position;
}

function buildSpreadCoverageFact(
  data: LenormandData,
  cards: LenormandCardEvidence[],
): LenormandSpreadCoverageFact {
  const expectedPositions = LENORMAND_SPREAD_POSITIONS[data.spreadType];
  const actualPositions = cards.map((card) => card.position);
  const normalizedActualPositions = actualPositions.map((position) =>
    normalizeCoveragePosition(data.spreadType, position),
  );
  const missingPositions = expectedPositions
    ? expectedPositions.filter((position) => !normalizedActualPositions.includes(position))
    : [];
  const duplicatePositions = [...new Set(normalizedActualPositions)].filter(
    (position) => normalizedActualPositions.filter((item) => item === position).length > 1,
  );
  const unexpectedPositions = expectedPositions
    ? normalizedActualPositions.filter((position) => !expectedPositions.includes(position))
    : [];
  const positionOrderMismatches = expectedPositions
    ? normalizedActualPositions.flatMap((position, index) =>
        expectedPositions[index] === position ? [] : [index + 1],
      )
    : [];
  const cardIds = cards.map((card) => card.cardId);
  const duplicateCardIds = [...new Set(cardIds)].filter(
    (cardId) => cardIds.filter((item) => item === cardId).length > 1,
  );
  const status: LenormandSpreadCoverageFact['status'] = !expectedPositions
    ? '未知牌阵'
    : cards.length !== expectedPositions.length
      ? '牌数不符'
      : missingPositions.length ||
          duplicatePositions.length ||
          unexpectedPositions.length ||
          positionOrderMismatches.length ||
          duplicateCardIds.length
        ? '牌位异常'
        : '完整';
  return {
    key: 'lenormand:spread-coverage',
    status,
    spreadType: data.spreadType,
    spreadName: data.spreadName,
    expectedCardCount: expectedPositions?.length ?? null,
    actualCardCount: cards.length,
    expectedPositions: expectedPositions ? [...expectedPositions] : [],
    actualPositions,
    missingPositions,
    duplicatePositions,
    unexpectedPositions,
    positionOrderMismatches,
    duplicateCardIds,
    cardFactKeys: cards.map((card) => card.key),
    promptText:
      status === '完整'
        ? `${data.spreadName}共${cards.length}张，牌位顺序与牌面唯一性完整`
        : status === '未知牌阵'
          ? `牌阵类型${data.spreadType}未找到已声明配置，不得补造预期牌位与牌数`
          : status === '牌数不符'
            ? `${data.spreadName}应有${expectedPositions?.length ?? '未知'}张，现有资料记录${cards.length}张，不得补造缺失牌面`
            : `牌阵资料异常：缺少牌位${missingPositions.join('、') || '无'}；重复牌位${duplicatePositions.join('、') || '无'}；越位牌位${unexpectedPositions.join('、') || '无'}；顺序不符位置${positionOrderMismatches.join('、') || '无'}；重复牌号${duplicateCardIds.join('、') || '无'}`,
    sources: ['已声明牌阵牌数与牌位顺序', '逐牌位置与牌号唯一性核验'],
    limitation: SPREAD_COVERAGE_LIMITATION,
  };
}

function buildDrawOrderFacts(
  data: LenormandData,
  cards: LenormandCardEvidence[],
): LenormandDrawOrderFact[] {
  return (data.draw?.order ?? []).map((item, orderIndex) => {
    const expectedIndex = orderIndex + 1;
    const card = cards[orderIndex];
    const mismatches = card
      ? [
          item.index === expectedIndex ? '' : `记录序号应为${expectedIndex}`,
          card.position === item.position ? '' : `牌位应为${card.position}`,
          card.cardId === item.cardId ? '' : `牌号应为${card.cardId}`,
          card.name === item.cardName ? '' : `牌名应为${card.name}`,
          card.house === item.house ? '' : `宫位应为${card.house ?? '未列'}`,
          card.row === item.row ? '' : `行号应为${card.row ?? '未列'}`,
          card.column === item.column ? '' : `列号应为${card.column ?? '未列'}`,
        ].filter(Boolean)
      : ['缺少对应牌面'];
    const status: LenormandDrawOrderFact['status'] = !card
      ? '缺少牌面'
      : mismatches.length
        ? '不一致'
        : '一致';
    return {
      key: `lenormand:draw-order:${expectedIndex}`,
      status,
      index: expectedIndex,
      recordedIndex: item.index,
      cardFactKey: card?.key ?? null,
      position: item.position,
      cardId: item.cardId,
      cardName: item.cardName,
      house: item.house,
      row: item.row,
      column: item.column,
      mismatches,
      promptText: `第${expectedIndex}张记录对应${item.position}：牌号${item.cardId} ${item.cardName}${item.house ? `，落${item.house}宫` : ''}${item.row && item.column ? `，第${item.row}排第${item.column}列` : ''}${mismatches.length ? `；不一致项：${mismatches.join('、')}` : '；与牌面记录一致'}`,
      sources: ['洗牌后依牌位顺序取牌记录', '已确定逐牌牌号、牌名、牌位、宫位与行列落点'],
      limitation: DRAW_ORDER_FACT_LIMITATION,
    };
  });
}

function buildDrawFact(
  data: LenormandData,
  drawOrderFacts: LenormandDrawOrderFact[],
): LenormandDrawFact {
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
    ...drawOrderFacts.filter((fact) => fact.status !== '一致').map((fact) => fact.index),
    ...missingIndexes,
    ...extraIndexes,
  ].filter((item, index, values) => values.indexOf(item) === index);
  const status: LenormandDrawFact['status'] =
    !data.draw || order.length !== data.cards.length
      ? '来源链缺失'
      : mismatchIndexes.length
        ? '来源链不一致'
        : '可核验';
  return {
    key: `draw:lenormand:${data.spreadType}`,
    status,
    deckSize: data.draw?.deckSize,
    method: data.draw?.method,
    order,
    expectedCardCount: data.cards.length,
    recordedCardCount: order.length,
    orderFactKeys: drawOrderFacts.map((fact) => fact.key),
    mismatchIndexes,
    missingIndexes,
    extraIndexes,
    promptText: data.draw
      ? `牌组规模：${data.draw.deckSize}张；${isManual ? '录入方式' : isInteractive ? '抽取方式' : '洗牌与取牌方法'}：${data.draw.method}；${drawOrderFacts.map((fact) => fact.promptText).join('；')}${status === '来源链缺失' ? `；现有资料仅记录${order.length}/${data.cards.length}张来源顺序，不能完整核验` : status === '来源链不一致' ? `；第${mismatchIndexes.join('、')}张来源记录与牌面不一致` : ''}`
      : `现有资料未附洗牌方法与抽取顺序，仅保留${data.cards.length}张已确定牌面，不能反推完整抽牌来源链`,
    sources: isManual
      ? ['36张雷诺曼牌组', '用户按牌位逐张录入的牌号记录']
      : isInteractive
        ? ['36张雷诺曼牌组', '用户逐张触发的抽牌随机样本记录']
        : ['36张雷诺曼牌组与 Fisher-Yates 洗牌记录', '牌位顺序、宫位与行列落点记录'],
    limitation: DRAW_FACT_LIMITATION,
  };
}

export function conditionLenormandTraditionalText(
  text: string,
  options?: {
    kind?: LenormandTraditionalFact['kind'];
    cardNames?: string[];
    keywords?: string[];
    relation?: LenormandCombinationRelation;
    positions?: string[];
  },
): string {
  const kind = options?.kind ?? '单牌牌义';
  const cardNames = unique(options?.cardNames ?? []);
  const keywords = unique(options?.keywords ?? []);
  const targetText = keywords.length ? keywords.join('、') : '相关象征主题';
  const cardsText = cardNames.length ? cardNames.join('+') : '当前牌面';
  const positions = unique(options?.positions ?? []);
  const relationText = options?.relation
    ? `${positions.length ? `${positions.join('与')}的` : ''}${options.relation}`
    : positions.length
      ? `${positions.join('与')}的已登记组合关系`
      : '已登记组合关系';
  const conditionedText = text
    .replace(/感情的承诺或婚约/g, '关系承诺、契约或婚约议题')
    .replace(/订婚或喜讯/g, '订婚或喜讯线索')
    .replace(/消息带来感情进展/g, '消息与情感互动可能同时出现进展线索')
    .replace(/被人喜欢或表白/g, '好感、邀请或表白线索')
    .replace(/成熟的感情关系/g, '关系成熟度与长期条件')
    .replace(/家庭契约\/购房/g, '家庭契约、居住或购房条件')
    .replace(/社交上受到欢迎/g, '社交反馈与公开认可线索')
    .replace(/稳定安家/g, '居住稳定与安家条件')
    .replace(/目标明确并趋于稳定/g, '目标清晰度与稳定进展线索')
    .replace(/家庭添丁/g, '家庭成员变化或生育议题')
    .replace(/通过网络\/远程获利/g, '网络或远程渠道中的收益机会')
    .replace(/跨国或远距离财运/g, '跨国或远距离场景中的财务与资源流动议题')
    .replace(/欺骗与策略/g, '信息可信度与策略风险')
    .replace(/隐藏在迷雾中的欺骗/g, '信息不透明情况下的可信度风险')
    .replace(/直觉准确的时期/g, '直觉判断与现实信息可能较一致的阶段')
    .replace(/从迷茫走向清晰/g, '信息由模糊转向清晰的线索')
    .replace(/沉重的结束与考验/g, '收尾压力与责任考验')
    .replace(/突然的结束\/切割/g, '突然收尾或切割风险')
    .replace(/消耗性的压力/g, '持续消耗与压力风险')
    .replace(/改善环境的搬迁/g, '搬迁与环境改善条件')
    .replace(/秘密文件或消息/g, '未公开文件、消息与信息核验议题')
    .replace(/朋友的善意/g, '朋友支持或善意线索')
    .replace(/关键的情感答案/g, '需要核实的关键情感线索')
    .replace(/制度性阻碍/g, '制度、规则或机构层面的限制')
    .replace(/两难选择/g, '取舍冲突与决策压力')
    .replace(/流言蜚语/g, '未经核实的传播与沟通风险')
    .replace(/争吵与焦虑/g, '冲突沟通与焦虑风险')
    .replace(/资源或资金充裕/g, '资源与资金可用性线索')
    .replace(/深厚的感情基础/g, '关系基础与长期稳定线索')
    .replace(/局势转明/g, '局势可能转明')
    .replace(/问题有解/g, '可能出现可验证的解决条件')
    .replace(/会提供支持/g, '可能提供支持')
    .replace(/会进入公开场域/g, '可能进入公开场域')
    .replace(/能带来结果/g, '可能形成可验证的结果')
    .replace(/不能强行续命/g, '不宜在缺少现实条件时强行延续')
    .replace(/避免被套路/g, '核实是否存在利益误导或策略风险')
    .replace(/不能两头都要/g, '需要明确优先级与取舍')
    .replace(/需要承担代价或接受现实/g, '需要核实现实责任、成本与可承受范围')
    .replace(/[。.]$/, '');
  if (kind === '固定组合') {
    return `传统固定组合${cardsText}通过${relationText}命中，提示关注${conditionedText || targetText}；只可检查这些主题是否同时出现现实证据，不得直接认定婚约、生育、收益、欺骗或其他现实结果`;
  }
  if (kind === '相邻合读') {
    return `相邻牌${cardsText}通过${relationText}形成${targetText}的合读范围；这不是传统固定组合，须逐项核实两张牌主题是否与现实进展相符`;
  }
  return `传统单牌${cardsText}以${targetText}为解释范围；可在当前牌位检查这些主题的现实线索，但不把原始牌义直接当作已发生事实`;
}

function buildTraditionalFacts(
  cards: LenormandEvidenceAnalysis['cards'],
  combinations: NonNullable<LenormandData['combinations']>,
): LenormandTraditionalFact[] {
  const cardByName = new Map(cards.map((card) => [card.name, card]));
  const cardFacts = cards.map((card): LenormandTraditionalFact => ({
    key: `card:${card.index}:${card.name}`,
    status: '已映射',
    kind: '单牌牌义',
    cardFactKeys: [card.key],
    cardNames: [card.name],
    positions: [card.position],
    originalText: card.meaning,
    promptText: conditionLenormandTraditionalText(card.meaning, {
      kind: '单牌牌义',
      cardNames: [card.name],
      keywords: card.keywords,
    }),
    verificationTargets: card.keywords,
    sources: ['36张雷诺曼牌组', '当前单牌关键词与基础牌义资料'],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const combinationFacts = combinations.map((combo, index): LenormandTraditionalFact => {
    const first = cardByName.get(combo.card1);
    const second = cardByName.get(combo.card2);
    const kind = combo.source === '固定组合' ? '固定组合' : '相邻合读';
    const relation = combo.relation;
    const positions = unique([
      combo.position1 ?? first?.position ?? '',
      combo.position2 ?? second?.position ?? '',
    ]);
    const verificationTargets = unique([...(first?.keywords ?? []), ...(second?.keywords ?? [])]);
    return {
      key: `combination:${index + 1}:${combo.card1}:${combo.card2}:${kind}`,
      status: '已映射',
      kind,
      cardFactKeys: unique([first?.key ?? '', second?.key ?? '']),
      cardNames: [combo.card1, combo.card2],
      positions,
      originalText: combo.meaning,
      promptText: conditionLenormandTraditionalText(combo.meaning, {
        kind,
        cardNames: [combo.card1, combo.card2],
        keywords: verificationTargets,
        relation,
        positions,
      }),
      verificationTargets,
      sources:
        kind === '固定组合'
          ? [
              '当前雷诺曼固定牌对解释资料',
              relation
                ? `当前牌阵两张牌的${relation}与具体牌位`
                : '原始组合记录未注明空间方向，仅保留已登记牌位',
            ]
          : [
              relation === '牌序相邻'
                ? '当前牌阵的抽取或登记顺序'
                : relation
                  ? `当前牌阵两张牌的${relation}与具体牌位`
                  : '原始组合记录未注明相邻关系类型',
              '两张牌的关键词与基础牌义',
            ],
      limitation: TRADITIONAL_FACT_LIMITATION,
    };
  });
  return [...cardFacts, ...combinationFacts];
}

function createLayoutFact(
  fact: Omit<LenormandLayoutFact, 'status' | 'cardFactKeys' | 'source' | 'sources' | 'limitation'>,
  cards: LenormandCardEvidence[],
): LenormandLayoutFact {
  const source = '当前牌阵的牌位顺序、行列坐标、宫位与牌间距离计算';
  return {
    ...fact,
    status: '已计算',
    cardFactKeys: unique(
      fact.cardNames.map((name) => cards.find((card) => card.name === name)?.key ?? ''),
    ),
    source,
    sources: [source],
    limitation: LAYOUT_FACT_LIMITATION,
  };
}

function buildStructuredLayoutFacts(
  data: LenormandData,
  cards: LenormandEvidenceAnalysis['cards'],
): LenormandLayoutFact[] {
  if (data.spreadType === 'nine' && cards.length === 9) {
    const center = cards[4];
    const paths = [
      ['上排', cards.slice(0, 3)],
      ['中排', cards.slice(3, 6)],
      ['下排', cards.slice(6, 9)],
      ['左列', [cards[0], cards[3], cards[6]]],
      ['中列', [cards[1], cards[4], cards[7]]],
      ['右列', [cards[2], cards[5], cards[8]]],
      ['左上至右下对角线', [cards[0], cards[4], cards[8]]],
      ['右上至左下对角线', [cards[2], cards[4], cards[6]]],
    ] as const;
    return [
      createLayoutFact(
        {
          key: 'nine:center',
          kind: '九宫中心',
          cardNames: [center.name],
          positions: [center.position],
          houses: [],
          factText: `九宫第2排第2列的中心位置为${center.name}`,
          promptText: `九宫中心计算事实为${center.name}；传统上可先作为全阵主轴读取，但仍须与各行列、对角线和现实资料互证`,
        },
        cards,
      ),
      ...paths.map(([label, path]) =>
        createLayoutFact(
          {
            key: `nine:path:${label}`,
            kind: '九宫路径',
            cardNames: path.map((card) => card.name),
            positions: path.map((card) => card.position),
            houses: [],
            factText: `${label}依次为${path.map((card) => card.name).join('→')}`,
            promptText: `${label}计算路径为${path.map((card) => card.name).join('→')}；只用于比较该路径内的牌序与主题衔接，不单独生成现实结论`,
          },
          cards,
        ),
      ),
    ];
  }
  if (data.spreadType !== 'grandTableau' || cards.length !== 36) return [];
  const placementFacts = cards.map((card) =>
    createLayoutFact(
      {
        key: `grand-tableau:position:${card.index}`,
        kind: '大桌宫位',
        cardNames: [card.name],
        positions: [card.position],
        houses: card.house ? [card.house] : [],
        factText: `${card.name}落第${card.index}宫${card.house ? `（${card.house}宫）` : ''}${card.row && card.column ? `，第${card.row}排第${card.column}列` : ''}`,
        promptText: `${card.name}的计算落点为第${card.index}宫${card.house ? `（${card.house}宫）` : ''}；宫位只限定传统合读范围，不直接证明事件或吉凶`,
      },
      cards,
    ),
  );
  const personFacts = ['男士', '女士'].flatMap((name) => {
    const card = cards.find((item) => item.name === name);
    if (!card?.row || !card.column) return [];
    const personRow = card.row;
    const personColumn = card.column;
    const neighbors = cards.filter((candidate) => {
      if (!candidate.row || !candidate.column || candidate.index === card.index) return false;
      return (
        Math.abs(candidate.row - personRow) <= 1 && Math.abs(candidate.column - personColumn) <= 1
      );
    });
    return [
      createLayoutFact(
        {
          key: `grand-tableau:person:${name}`,
          kind: '人物牌近身',
          cardNames: [name, ...neighbors.map((item) => item.name)],
          positions: [card.position, ...neighbors.map((item) => item.position)],
          houses: unique([card.house ?? '', ...neighbors.map((item) => item.house ?? '')]),
          factText: `${name}位于第${card.row}排第${card.column}列，八邻域近身牌为${neighbors.map((item) => item.name).join('、') || '无'}`,
          promptText: `${name}的八邻域近身牌计算结果为${neighbors.map((item) => item.name).join('、') || '无'}；只可用于限定人物牌周边合读范围，不证明人物意图、关系或事件`,
        },
        cards,
      ),
    ];
  });
  const houseMatches = cards.filter((card) => card.house === card.name);
  const homeFacts = houseMatches.length
    ? [
        createLayoutFact(
          {
            key: 'grand-tableau:home-cards',
            kind: '归宫',
            cardNames: houseMatches.map((card) => card.name),
            positions: houseMatches.map((card) => card.position),
            houses: houseMatches.map((card) => card.house ?? ''),
            factText: `归宫牌为${houseMatches.map((card) => card.name).join('、')}`,
            promptText: `计算得到${houseMatches.map((card) => card.name).join('、')}回到同名宫位；归宫只表示牌与宫名重合，须结合整桌牌序与现实资料复核`,
          },
          cards,
        ),
      ]
    : [];
  return [...placementFacts, ...personFacts, ...homeFacts];
}

function buildSequenceFacts(cards: LenormandCardEvidence[]): LenormandSequenceFact[] {
  return cards.slice(1).map((card, index) => {
    const previous = cards[index];
    return {
      key: `lenormand:sequence:${previous.index}-${card.index}`,
      status: '已连接',
      fromCardKey: previous.key,
      toCardKey: card.key,
      fromPosition: previous.position,
      toPosition: card.position,
      fromCard: previous.name,
      toCard: card.name,
      promptText: `${previous.position}${previous.name} → ${card.position}${card.name}（仅表示抽取或登记顺序，不表示空间相邻）`,
      sources: ['已声明牌阵的抽取或登记顺序', '顺序相接的已确定牌面'],
      limitation: SEQUENCE_FACT_LIMITATION,
    };
  });
}

function buildLayoutCoverageFact(
  data: LenormandData,
  structuredLayoutFacts: LenormandLayoutFact[],
  layoutFacts: string[],
): LenormandLayoutCoverageFact {
  const expectedRequiredFactCount =
    data.spreadType === 'nine' ? 9 : data.spreadType === 'grandTableau' ? 38 : 0;
  const status: LenormandLayoutCoverageFact['status'] = !expectedRequiredFactCount
    ? '不适用'
    : structuredLayoutFacts.length >= expectedRequiredFactCount
      ? '结构化覆盖'
      : layoutFacts.length
        ? '旧版字符串兼容'
        : '结构缺失';
  return {
    key: 'lenormand:layout-coverage',
    status,
    spreadType: data.spreadType,
    expectedRequiredFactCount,
    structuredFactCount: structuredLayoutFacts.length,
    legacyFactCount: layoutFacts.length,
    layoutFactKeys: structuredLayoutFacts.map((fact) => fact.key),
    promptText:
      status === '结构化覆盖'
        ? `${data.spreadName}已保存${structuredLayoutFacts.length}条结构化布局事实，覆盖所需中心、路径、宫位与人物牌近身关系`
        : status === '旧版字符串兼容'
          ? `${data.spreadName}仅有${layoutFacts.length}条旧版布局文字，不得反推缺失的行列、宫位或距离事实`
          : status === '结构缺失'
            ? `${data.spreadName}缺少适用的结构化布局事实，也没有可兼容的旧版布局文字`
            : `${data.spreadName}不要求九宫或大桌布局事实，只按牌位与相邻顺序读取`,
    sources: ['牌阵类型与布局适用范围', '结构化布局事实和旧版布局文字逐项计数'],
    limitation: LAYOUT_COVERAGE_LIMITATION,
  };
}

function buildCounterEvidenceFacts(
  fixedCombinationFacts: LenormandTraditionalFact[],
  layoutCoverageFact: LenormandLayoutCoverageFact,
): LenormandCounterEvidenceFact[] {
  const fixedCombinationAvailable = fixedCombinationFacts.length > 0;
  const layoutAvailable =
    layoutCoverageFact.status === '结构化覆盖' ||
    layoutCoverageFact.status === '旧版字符串兼容' ||
    layoutCoverageFact.status === '不适用';
  return [
    {
      key: 'lenormand:counter:fixed-combination',
      type: '固定组合覆盖',
      status: fixedCombinationAvailable ? '有可用证据' : '存在缺口',
      ownerFactKeys: fixedCombinationFacts.map((fact) => fact.key),
      promptText: fixedCombinationAvailable
        ? `命中${fixedCombinationFacts.length}组已登记固定组合，并与普通相邻合读分层保存`
        : '本次未命中当前资料已登记的固定组合，不得把普通相邻合读冒充传统定式',
      sources: ['固定组合资料与本次相邻牌对逐项匹配'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'lenormand:counter:layout',
      type: '布局覆盖',
      status: layoutAvailable ? '有可用证据' : '存在缺口',
      ownerFactKeys: layoutCoverageFact.layoutFactKeys,
      promptText: layoutAvailable
        ? layoutCoverageFact.promptText
        : '当前牌阵没有九宫或大桌布局证据，只按牌位与相邻顺序读取',
      sources: layoutCoverageFact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function buildCounterSummaryFact(
  counterEvidenceFacts: LenormandCounterEvidenceFact[],
): LenormandCounterSummaryFact {
  const gaps = counterEvidenceFacts.filter((fact) => fact.status === '存在缺口');
  return {
    key: 'lenormand:counter-summary',
    status: gaps.length ? '有证据缺口' : '未见证据缺口',
    factKeys: gaps.map((fact) => fact.key),
    promptText: gaps.length
      ? `共记录${gaps.length}类证据缺口：${gaps.map((fact) => fact.type).join('、')}；只按已有牌位、组合和布局资料解释`
      : '固定组合与适用布局均有可用资料；这不提高预测可信度，也不证明现实结果',
    sources: ['固定组合覆盖与布局覆盖逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildSummaryFact(params: {
  cards: LenormandCardEvidence[];
  spreadCoverageFact: LenormandSpreadCoverageFact;
  sequenceFacts: LenormandSequenceFact[];
  fixedCombinations: NonNullable<LenormandData['combinations']>;
  adjacentReadings: NonNullable<LenormandData['combinations']>;
  drawFact: LenormandDrawFact;
  drawOrderFacts: LenormandDrawOrderFact[];
  layoutCoverageFact: LenormandLayoutCoverageFact;
  randomFact: RandomTraceFact;
  counterSummaryFact: LenormandCounterSummaryFact;
  counterEvidenceFacts: LenormandCounterEvidenceFact[];
  traditionalFacts: LenormandTraditionalFact[];
  structuredLayoutFacts: LenormandLayoutFact[];
}): LenormandSummaryFact {
  const layoutComplete =
    params.layoutCoverageFact.status === '结构化覆盖' ||
    params.layoutCoverageFact.status === '旧版字符串兼容' ||
    params.layoutCoverageFact.status === '不适用';
  const status =
    params.spreadCoverageFact.status === '完整' &&
    params.drawFact.status === '可核验' &&
    ['可重放', '不适用'].includes(params.randomFact.status) &&
    params.drawOrderFacts.length === params.cards.length &&
    layoutComplete
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'lenormand:evidence-summary',
    status,
    factKeys: unique([
      params.randomFact.key,
      params.drawFact.key,
      ...params.drawOrderFacts.map((item) => item.key),
      params.spreadCoverageFact.key,
      ...params.cards.map((item) => item.key),
      ...params.sequenceFacts.map((item) => item.key),
      params.layoutCoverageFact.key,
      ...params.structuredLayoutFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      ...params.traditionalFacts.map((item) => item.key),
    ]),
    cardFactCount: params.cards.length,
    drawOrderFactCount: params.drawOrderFacts.length,
    sequenceFactCount: params.sequenceFacts.length,
    fixedCombinationCount: params.fixedCombinations.length,
    adjacentReadingCount: params.adjacentReadings.length,
    structuredLayoutFactCount: params.structuredLayoutFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    promptText: `证据链状态：${status}；逐牌${params.cards.length}项、抽取顺序${params.drawOrderFacts.length}项、牌序关系${params.sequenceFacts.length}项、固定组合${params.fixedCombinations.length}项、相邻合读${params.adjacentReadings.length}项、结构化布局${params.structuredLayoutFacts.length}项、反证覆盖${params.counterEvidenceFacts.length}项、传统解释${params.traditionalFacts.length}项`,
    sources: ['全部随机、抽牌、牌阵、逐牌、牌序组合、布局、反证与传统解释事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  cards: LenormandCardEvidence[];
  spreadCoverageFact: LenormandSpreadCoverageFact;
  sequenceFacts: LenormandSequenceFact[];
  fixedCombinations: NonNullable<LenormandData['combinations']>;
  adjacentReadings: NonNullable<LenormandData['combinations']>;
  drawFact: LenormandDrawFact;
  drawOrderFacts: LenormandDrawOrderFact[];
  layoutCoverageFact: LenormandLayoutCoverageFact;
  randomFact: RandomTraceFact;
  counterSummaryFact: LenormandCounterSummaryFact;
  counterEvidenceFacts: LenormandCounterEvidenceFact[];
  structuredLayoutFacts: LenormandLayoutFact[];
  summaryFact: LenormandSummaryFact;
}): LenormandEvidenceCalculationStep[] {
  const layoutComplete =
    params.layoutCoverageFact.status === '结构化覆盖' ||
    params.layoutCoverageFact.status === '旧版字符串兼容' ||
    params.layoutCoverageFact.status === '不适用';
  return [
    {
      key: 'lenormand:calculation:random',
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
      key: 'lenormand:calculation:draw',
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
      dependsOnStepKeys: ['lenormand:calculation:random'],
      promptText: params.drawFact.promptText,
      sources: params.drawFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'lenormand:calculation:spread',
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
      dependsOnStepKeys: ['lenormand:calculation:draw'],
      promptText: params.spreadCoverageFact.promptText,
      sources: params.spreadCoverageFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'lenormand:calculation:cards',
      stage: '逐牌映射核验',
      status: params.cards.length ? '已计算' : '资料不足',
      inputs: { cardCount: params.cards.length },
      result: {
        mappedCardCount: params.cards.length,
        positions: params.cards.map((item) => item.position),
        houses: params.cards.map((item) => item.house ?? '未列'),
      },
      dependsOnStepKeys: ['lenormand:calculation:spread'],
      promptText: `已逐牌映射${params.cards.length}个牌位的牌号、牌名、关键词、基础牌义、宫位与行列落点`,
      sources: unique(params.cards.flatMap((item) => item.sources)),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'lenormand:calculation:sequence-combinations',
      stage: '牌序与组合核验',
      status: params.cards.length ? '已计算' : '资料不足',
      inputs: { cardCount: params.cards.length },
      result: {
        sequenceFactCount: params.sequenceFacts.length,
        fixedCombinationCount: params.fixedCombinations.length,
        adjacentReadingCount: params.adjacentReadings.length,
      },
      dependsOnStepKeys: ['lenormand:calculation:cards'],
      promptText: `记录${params.sequenceFacts.length}项相邻牌序关系，分层保存固定组合${params.fixedCombinations.length}项与相邻合读${params.adjacentReadings.length}项`,
      sources: unique([
        '已声明牌阵的牌位顺序完整性检查',
        ...params.sequenceFacts.flatMap((item) => item.sources),
        '固定组合资料与相邻牌义合读生成规则',
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'lenormand:calculation:layout',
      stage: '布局覆盖核验',
      status: layoutComplete ? '已计算' : '资料不足',
      inputs: { cardCount: params.cards.length },
      result: {
        layoutStatus: params.layoutCoverageFact.status,
        structuredLayoutFactCount: params.structuredLayoutFacts.length,
        legacyLayoutFactCount: params.layoutCoverageFact.legacyFactCount,
      },
      dependsOnStepKeys: ['lenormand:calculation:sequence-combinations'],
      promptText: params.layoutCoverageFact.promptText,
      sources: unique([
        ...params.layoutCoverageFact.sources,
        ...params.structuredLayoutFacts.flatMap((item) => item.sources),
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'lenormand:calculation:counter',
      stage: '反证核验',
      status: '已计算',
      inputs: { layoutStatus: params.layoutCoverageFact.status },
      result: {
        counterStatus: params.counterSummaryFact.status,
        counterEvidenceCount: params.counterEvidenceFacts.length,
        gapCount: params.counterEvidenceFacts.filter((item) => item.status === '存在缺口').length,
      },
      dependsOnStepKeys: ['lenormand:calculation:layout'],
      promptText: params.counterSummaryFact.promptText,
      sources: params.counterSummaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'lenormand:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        cardFactCount: params.summaryFact.cardFactCount,
        sequenceFactCount: params.summaryFact.sequenceFactCount,
        fixedCombinationCount: params.summaryFact.fixedCombinationCount,
        structuredLayoutFactCount: params.summaryFact.structuredLayoutFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
      },
      dependsOnStepKeys: [
        'lenormand:calculation:random',
        'lenormand:calculation:draw',
        'lenormand:calculation:spread',
        'lenormand:calculation:cards',
        'lenormand:calculation:sequence-combinations',
        'lenormand:calculation:layout',
        'lenormand:calculation:counter',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  randomFact: RandomTraceFact;
  spreadCoverageFact: LenormandSpreadCoverageFact;
  cards: LenormandCardEvidence[];
  sequenceFacts: LenormandSequenceFact[];
  layoutCoverageFact: LenormandLayoutCoverageFact;
  counterSummaryFact: LenormandCounterSummaryFact;
  counterEvidenceFacts: LenormandCounterEvidenceFact[];
  traditionalFacts: LenormandTraditionalFact[];
  structuredLayoutFacts: LenormandLayoutFact[];
  summaryFact: LenormandSummaryFact;
}): LenormandLimitationFact[] {
  const definitions: Array<
    Pick<LenormandLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'lenormand:limitation:random',
      type: '随机边界',
      ownerFactKeys: [params.randomFact.key],
      promptText:
        params.randomFact.status === '不适用'
          ? '手工录入只核对用户提交的牌号与牌位，不依赖随机抽样'
          : '雷诺曼抽牌包含随机过程；seed或replay只能复现抽牌轨迹，不证明预测有效性',
      sources:
        params.randomFact.status === '不适用'
          ? ['用户手工录入来源边界']
          : ['洗牌和抽牌随机轨迹', '随机轨迹可重放边界'],
    },
    {
      key: 'lenormand:limitation:combination-level',
      type: '组合分层边界',
      ownerFactKeys: [
        ...params.sequenceFacts.map((item) => item.key),
        ...params.traditionalFacts
          .filter((item) => item.kind === '固定组合' || item.kind === '相邻合读')
          .map((item) => item.key),
        params.counterEvidenceFacts.find((item) => item.type === '固定组合覆盖')?.key ?? '',
      ],
      promptText:
        '固定组合仅指当前采用的固定牌对资料中明确登记的组合，相邻牌义合读是当前牌序解释，二者证据等级不同',
      sources: ['固定组合资料', '相邻牌义合读生成规则'],
    },
    {
      key: 'lenormand:limitation:layout',
      type: '布局边界',
      ownerFactKeys: [
        params.layoutCoverageFact.key,
        ...params.structuredLayoutFacts.map((item) => item.key),
        params.counterEvidenceFacts.find((item) => item.type === '布局覆盖')?.key ?? '',
      ],
      promptText:
        '九宫中心、横纵对角线、大桌宫位、近身牌和归宫牌只描述布局关系，不自动产生吉凶结论',
      sources: ['九宫与大桌结构化布局事实'],
    },
    {
      key: 'lenormand:limitation:symbolic-material',
      type: '象征材料边界',
      ownerFactKeys: [
        params.spreadCoverageFact.key,
        ...params.cards.map((item) => item.key),
        ...params.traditionalFacts.map((item) => item.key),
      ],
      promptText: '牌名、关键词、组合和布局属于象征解释材料，不是事件发生概率或现代统计证据',
      sources: ['36张雷诺曼牌组与组合、布局解释范围'],
    },
    {
      key: 'lenormand:limitation:high-risk',
      type: '高风险结论边界',
      ownerFactKeys: [params.summaryFact.key, params.counterSummaryFact.key],
      promptText: '单牌或单一组合不能证明他人意图、隐私、医疗、法律、财务事实或必然结果',
      sources: ['象征解释与现实事实分离原则'],
    },
    {
      key: 'lenormand:limitation:timing',
      type: '时间边界',
      ownerFactKeys: [params.summaryFact.key, params.layoutCoverageFact.key],
      promptText: '未给现实期限时不得把牌号、宫位或距离换算为唯一日期',
      sources: ['牌号、宫位、距离与现实时间无确定换算关系'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    ownerFactKeys: unique(definition.ownerFactKeys).length
      ? unique(definition.ownerFactKeys)
      : [params.summaryFact.key],
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeLenormandEvidence(data: LenormandData): LenormandEvidenceAnalysis {
  if (!data.cards.length) throw new Error('雷诺曼结构化证据至少需要一张牌。');
  const cards = data.cards.map((card, index): LenormandCardEvidence => {
    const key = `lenormand:card:${index + 1}:${card.id}`;
    const traditionalFactKey = `card:${index + 1}:${card.name}`;
    const promptMeaning = conditionLenormandTraditionalText(card.meaning, {
      kind: '单牌牌义',
      cardNames: [card.name],
      keywords: card.keywords,
    });
    return {
      key,
      status: '已映射',
      index: index + 1,
      cardId: card.id,
      name: card.name,
      position: card.position,
      keywords: [...card.keywords],
      meaning: card.meaning,
      house: card.house,
      row: card.row,
      column: card.column,
      traditionalFactKey,
      promptText: `${card.position}为${card.name}；关键词${card.keywords.join('、') || '未列'}；条件化牌义${promptMeaning}${card.house ? `；计算落${card.house}宫` : ''}${card.row && card.column ? `；第${card.row}排第${card.column}列` : ''}`,
      sources: ['已声明牌阵牌位', '已确定牌号与牌名', '36张雷诺曼逐牌关键词与基础牌义资料'],
      limitation: CARD_FACT_LIMITATION,
    };
  });
  const spreadCoverageFact = buildSpreadCoverageFact(data, cards);
  const sequenceFacts = buildSequenceFacts(cards);
  const sequence = sequenceFacts.map((fact) => fact.promptText);
  const fixedCombinations = (data.combinations ?? []).filter((item) => item.source === '固定组合');
  const adjacentReadings = (data.combinations ?? []).filter((item) => item.source !== '固定组合');
  const traditionalFacts = buildTraditionalFacts(cards, data.combinations ?? []);
  const structuredLayoutFacts = buildStructuredLayoutFacts(data, cards);
  const layoutFacts = data.layoutEvidence ?? [];
  const layoutCoverageFact = buildLayoutCoverageFact(data, structuredLayoutFacts, layoutFacts);
  const drawOrderFacts = buildDrawOrderFacts(data, cards);
  const drawFact = buildDrawFact(data, drawOrderFacts);
  const drawFacts = data.draw
    ? [
        `牌组规模：${data.draw.deckSize}张；洗牌与取牌方法：${data.draw.method}`,
        ...drawOrderFacts.map(
          (fact) =>
            `第${fact.recordedIndex}张对应${fact.position}：牌号${fact.cardId} ${fact.cardName}${fact.house ? `，落${fact.house}宫` : ''}${fact.row && fact.column ? `，第${fact.row}排第${fact.column}列` : ''}`,
        ),
      ]
    : ['现有资料未附洗牌方法与抽取顺序，仅保留已确定牌面，不能反推完整抽牌来源链'];
  const trace = data.meta?.random;
  const isManual = data.draw?.method === '用户按牌位手工录入';
  const isInteractive = data.draw?.method === '用户逐张触发前端随机抽取';
  const randomFact = buildRandomTraceFact({
    key: `random:lenormand:${data.spreadType}`,
    applicable: !isManual,
    trace,
    processLabel: isManual
      ? `${data.spreadName}的手工牌面录入过程`
      : isInteractive
        ? `${data.spreadName}的逐张抽牌生成过程`
        : `${data.spreadName}的洗牌与抽牌生成过程`,
    sources: isManual
      ? ['用户按牌位逐张录入的牌面记录']
      : isInteractive
        ? ['雷诺曼牌阵与逐张抽牌顺序记录', '抽牌随机样本与重放元数据']
        : ['雷诺曼牌阵与抽牌顺序记录', '洗牌、抽牌随机样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const fixedCombinationFacts = traditionalFacts.filter((fact) => fact.kind === '固定组合');
  const counterEvidenceFacts = buildCounterEvidenceFacts(fixedCombinationFacts, layoutCoverageFact);
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter((fact) => fact.status === '存在缺口')
    .map((fact) => fact.promptText);
  const summaryFact = buildSummaryFact({
    cards,
    spreadCoverageFact,
    sequenceFacts,
    fixedCombinations,
    adjacentReadings,
    drawFact,
    drawOrderFacts,
    layoutCoverageFact,
    randomFact,
    counterSummaryFact,
    counterEvidenceFacts,
    traditionalFacts,
    structuredLayoutFacts,
  });
  const calculationSteps = buildCalculationSteps({
    cards,
    spreadCoverageFact,
    sequenceFacts,
    fixedCombinations,
    adjacentReadings,
    drawFact,
    drawOrderFacts,
    layoutCoverageFact,
    randomFact,
    counterSummaryFact,
    counterEvidenceFacts,
    structuredLayoutFacts,
    summaryFact,
  });
  summaryFact.factKeys = unique([
    ...calculationSteps.map((item) => item.key),
    ...summaryFact.factKeys,
  ]);
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts({
    randomFact,
    spreadCoverageFact,
    cards,
    sequenceFacts,
    layoutCoverageFact,
    counterSummaryFact,
    counterEvidenceFacts,
    traditionalFacts,
    structuredLayoutFacts,
    summaryFact,
  });
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const drawTitle =
    drawFact.status === '可核验'
      ? isManual
        ? '手工录入牌序事实'
        : '洗牌与抽取顺序事实'
      : drawFact.status === '来源链不一致'
        ? '抽牌来源链不一致'
        : '抽牌来源链缺失';
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '雷诺曼抽牌、组合与布局计算链',
      detail: `${calculationChain.join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: unique(calculationSteps.flatMap((item) => item.sources)).join('、'),
      tags: ['计算链', summaryFact.status, data.spreadType],
    },
    {
      level: spreadCoverageFact.status === '完整' ? '辅证' : '反证',
      title: `牌阵结构：${data.spreadName}`,
      detail: `${spreadCoverageFact.promptText}；边界：${spreadCoverageFact.limitation}`,
      source: spreadCoverageFact.sources.join('、'),
      tags: ['牌阵结构', data.spreadType, spreadCoverageFact.status],
    },
    {
      level: drawFact.status === '可核验' ? '辅证' : '反证',
      title: drawTitle,
      detail: `${drawFact.promptText}；边界：${drawFact.limitation}`,
      source: drawFact.sources.join('、'),
      tags: ['抽牌来源', drawFact.status, drawFact.status === '可核验' ? '可重放' : '不可反推'],
    },
    ...cards.map((card, index): PromptEvidenceItem => ({
      level: index === Math.floor(cards.length / 2) || cards.length === 1 ? '主证' : '辅证',
      title: `${card.position}：${card.name}`,
      detail: `${card.promptText}；边界：${card.limitation}`,
      source: card.sources.join('、'),
      tags: [card.position, card.name, ...card.keywords.slice(0, 3)],
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
    ...traditionalFacts
      .filter((fact) => fact.kind !== '单牌牌义')
      .map((fact): PromptEvidenceItem => ({
        level: fact.kind === '固定组合' ? '主证' : '辅证',
        title: `${fact.kind}${fact.cardNames.join('+')}`,
        detail: `${fact.promptText}；现实核验项${fact.verificationTargets.join('、') || '未列'}；边界${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: [fact.kind, ...fact.cardNames],
      })),
    ...structuredLayoutFacts
      .filter((fact) => fact.kind !== '大桌宫位')
      .map((fact): PromptEvidenceItem => ({
        level: '辅证',
        title: `${fact.kind}：${fact.cardNames.slice(0, 3).join('→')}${fact.cardNames.length > 3 ? '等' : ''}`,
        detail: `${fact.factText}；解释边界${fact.promptText}；${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: ['布局证据', fact.kind],
      })),
    ...(structuredLayoutFacts.length
      ? []
      : layoutFacts.map((detail, index): PromptEvidenceItem => ({
          level: '辅证',
          title: `旧版布局资料${index + 1}`,
          detail: `${detail}；该字符串只作旧结果兼容，不能替代可核验的结构化行列与宫位事实`,
          source: '旧版牌阵布局资料',
          tags: ['布局证据', '旧版兼容'],
        }))),
    ...counterEvidenceFacts
      .filter((fact) => fact.status === '存在缺口')
      .map((fact): PromptEvidenceItem => ({
        level: '反证',
        title: '当前证据缺口',
        detail: `${fact.promptText}；边界：${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: ['证据缺口', fact.type],
      })),
    {
      level: '反证',
      title: `证据缺口汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['证据缺口', counterSummaryFact.status],
    },
    {
      level: '辅证',
      title: `雷诺曼证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '雷诺曼牌面解释边界',
      detail: `${limitationFacts.map((fact) => fact.promptText).join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((fact) => fact.sources))).join('、'),
      tags: ['象征解释', '现实复核'],
    },
  );
  const evidence: PromptEvidenceBundle = { title: '雷诺曼牌序组合与布局结构化证据', items };
  const promptText = [
    '【雷诺曼牌序组合与布局结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `牌序关系：${sequence.join('；') || '单牌牌阵，无相邻推进关系'}。`,
    `组合分层：固定组合${fixedCombinations.length}组，相邻合读${adjacentReadings.length}组；逐组条件化解释已列在证据条目中。`,
    `布局覆盖：${structuredLayoutFacts.length ? `${structuredLayoutFacts.length}条结构化布局事实已保存；自然语言证据只展开中心、路径、人物牌近身与归宫，逐牌宫位落点见对应牌面条目` : layoutCoverageFact.promptText}。`,
    `反证限制：${counterSummaryFact.promptText}。`,
    `计算链：${calculationChain.join(' → ')}`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'lenormand:evidence',
    status: '已计算',
    calculationSteps,
    calculationChain,
    cards,
    spreadCoverageFact,
    sequenceFacts,
    sequence,
    fixedCombinations,
    adjacentReadings,
    drawFact,
    drawOrderFacts,
    drawFacts,
    layoutFacts,
    layoutCoverageFact,
    randomFact,
    randomFacts,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    traditionalFacts,
    structuredLayoutFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先按牌阵固定牌位和抽牌顺序，再逐张读取牌名、关键词与基础牌义。',
      '抽牌来源单独保存牌组规模、Fisher-Yates洗牌方法、抽取序号与牌位落点，供结构化核验。',
      '固定组合与普通相邻合读分层保存，未命中固定组合时明确保留证据缺口。',
      '九宫和大桌仅增加可复核的空间关系，不把位置直接换算成吉凶或日期。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
