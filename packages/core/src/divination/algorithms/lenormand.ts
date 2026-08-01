import type { LenormandData, LenormandSpreadType } from '../../types/divination';
import type { RandomOptions, RandomSource, RandomTrace } from '../../shared/random';
import {
  createRandomContext,
  createSeededRandom,
  hasRandomOptions,
  randomInt,
} from '../../shared/random';
import { attachResultMeta, createResultMeta } from '../../shared/result';
import { analyzeRebuiltLenormandEvidence } from '../lenormand-evidence';

export { conditionLenormandTraditionalText } from '../lenormand-evidence';
export type {
  LenormandCardEvidence,
  LenormandCounterEvidenceFact,
  LenormandCounterSummaryFact,
  LenormandDrawFact,
  LenormandDrawOrderFact,
  LenormandEvidenceAnalysis,
  LenormandLayoutFact,
  LenormandLayoutCoverageFact,
  LenormandLimitationFact,
  LenormandSequenceFact,
  LenormandSpreadCoverageFact,
  LenormandTraditionalFact,
} from '../lenormand-evidence';

export const LENORMAND_CARDS = [
  '骑士',
  '三叶草',
  '船',
  '房子',
  '树',
  '云',
  '蛇',
  '棺材',
  '花束',
  '镰刀',
  '鞭子',
  '鸟',
  '孩子',
  '狐狸',
  '熊',
  '星星',
  '鹳',
  '狗',
  '塔',
  '花园',
  '山',
  '路',
  '老鼠',
  '心',
  '戒指',
  '书',
  '信',
  '男士',
  '女士',
  '百合',
  '太阳',
  '月亮',
  '钥匙',
  '鱼',
  '锚',
  '十字架',
].map((name, index) => ({ id: index + 1, name, keywords: [] as string[], meaning: '' }));

function createPendingSpreadPositions(cardCount: number) {
  return Array.from({ length: cardCount }, (_, index) => `第${index + 1}牌位`);
}

export const LENORMAND_SPREADS: Record<LenormandSpreadType, { name: string; positions: string[] }> =
  {
    single: { name: '单张抽牌', positions: createPendingSpreadPositions(1) },
    three: { name: '三张抽牌', positions: createPendingSpreadPositions(3) },
    five: { name: '五张抽牌', positions: createPendingSpreadPositions(5) },
    relationship: {
      name: '五张抽牌（关系入口）',
      positions: createPendingSpreadPositions(5),
    },
    decision: {
      name: '六张抽牌（选择入口）',
      positions: createPendingSpreadPositions(6),
    },
    nine: { name: '九张抽牌', positions: createPendingSpreadPositions(9) },
    element: {
      name: '四张抽牌（元素入口）',
      positions: createPendingSpreadPositions(4),
    },
    grandTableau: {
      name: '三十六张抽牌（大桌入口）',
      positions: createPendingSpreadPositions(36),
    },
  };

function assertInteractiveSample(sample: number, index: number) {
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error(`第${index + 1}个雷诺曼抽牌随机样本无效`);
  }
}

/** 根据前端已产生的随机样本复算当前抽牌进度，允许传入未完成牌阵的样本。 */
export function resolveInteractiveLenormandCards(
  spreadType: LenormandSpreadType,
  samples: readonly number[],
) {
  const spread = LENORMAND_SPREADS[spreadType];
  if (!spread) throw new Error(`未知的雷诺曼牌阵类型: ${spreadType}`);
  if (samples.length > spread.positions.length) {
    throw new Error(`${spread.name}最多抽取${spread.positions.length}张牌`);
  }
  samples.forEach(assertInteractiveSample);

  const remaining = [...LENORMAND_CARDS];
  return samples.map((sample) => {
    const index = Math.floor(sample * remaining.length);
    const card = remaining.splice(index, 1)[0];
    if (!card) throw new Error(`第${remaining.length + 1}张雷诺曼抽牌无法映射到剩余牌组`);
    return card;
  });
}

function shuffleCards(rng: RandomSource) {
  const shuffled = [...LENORMAND_CARDS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 固定组合在具体牌组版本、原文与页码闭合前失败关闭。 */
export const LENORMAND_FIXED_COMBINATIONS: Record<string, string> = {};

function buildLenormandCombinations(
  _spreadType: LenormandSpreadType,
  _cards: LenormandData['cards'],
): NonNullable<LenormandData['combinations']> {
  return [];
}

export function validateLenormandReferenceData(): void {
  const ids = LENORMAND_CARDS.map((card) => card.id);
  const names = LENORMAND_CARDS.map((card) => card.name);
  if (
    LENORMAND_CARDS.length !== 36 ||
    ids.some((id, index) => id !== index + 1) ||
    new Set(ids).size !== 36 ||
    new Set(names).size !== 36
  ) {
    throw new Error('雷诺曼牌组必须按 1-36 完整登记且牌号、牌名不重复');
  }
  if (LENORMAND_SPREADS.grandTableau.positions.length !== 36) {
    throw new Error('雷诺曼大桌入口必须完整登记 36 个中性牌位');
  }
  for (const pair of Object.keys(LENORMAND_FIXED_COMBINATIONS)) {
    const namesInPair = pair.split('+');
    if (
      namesInPair.length !== 2 ||
      namesInPair.some((name) => !names.includes(name)) ||
      namesInPair[0] === namesInPair[1]
    ) {
      throw new Error(`雷诺曼固定组合引用无效牌名：${pair}`);
    }
  }
}

validateLenormandReferenceData();

type LenormandReferenceCard = (typeof LENORMAND_CARDS)[number];
type AuditedLenormandSource = 'manual' | 'interactive' | 'random';

function buildLenormandCards(
  spreadType: LenormandSpreadType,
  selectedCards: readonly LenormandReferenceCard[],
): LenormandData['cards'] {
  const spread = LENORMAND_SPREADS[spreadType];
  return selectedCards.map((card, index) => {
    return {
      ...card,
      keywords: [...card.keywords],
      position: spread.positions[index],
      house: undefined,
      row: undefined,
      column: undefined,
    };
  });
}

function buildLenormandLayoutEvidence(
  _spreadType: LenormandSpreadType,
  _cards: LenormandData['cards'],
): string[] {
  return [];
}

function buildLenormandDraw(
  cards: LenormandData['cards'],
  source: AuditedLenormandSource,
): NonNullable<LenormandData['draw']> {
  return {
    deckSize: LENORMAND_CARDS.length,
    method:
      source === 'manual'
        ? '用户按牌位手工录入'
        : source === 'interactive'
          ? '用户逐张触发前端随机抽取'
          : 'Fisher-Yates洗牌后依牌位顺序取顶牌',
    order: cards.map((card, index) => ({
      index: index + 1,
      position: card.position,
      cardId: card.id,
      cardName: card.name,
      house: card.house,
      row: card.row,
      column: card.column,
    })),
  };
}

function assertLenormandTimestamp(timestamp: number): number {
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    Number.isNaN(new Date(timestamp).getTime())
  ) {
    throw new Error('雷诺曼结果时间戳无效，无法重建可信证据。');
  }
  return timestamp;
}

function normalizeLenormandRandomTrace(
  input: LenormandData,
  timestamp: number,
): RandomTrace | undefined {
  const rawTrace = input.meta?.random;
  if (rawTrace === undefined) return undefined;
  const trace = createResultMeta({
    algorithm: 'lenormand.audit.trace',
    input: { spreadType: input.spreadType },
    calculatedAt: timestamp,
    random: rawTrace,
  }).random!;
  if (trace.mode === 'seeded' && trace.seed === undefined) {
    throw new Error('雷诺曼 seeded 随机轨迹缺少种子，无法核验。');
  }
  if (trace.mode !== 'seeded' && trace.seed !== undefined) {
    throw new Error('雷诺曼非 seeded 随机轨迹不应携带种子。');
  }
  if (trace.mode === 'seeded') {
    const seeded = createSeededRandom(trace.seed!);
    trace.samples.forEach((sample, index) => {
      if (seeded() !== sample) {
        throw new Error(`雷诺曼随机轨迹第${index + 1}个样本与种子不一致。`);
      }
    });
    return trace;
  }
  return { mode: 'replay', samples: [...trace.samples] };
}

function replayLenormandCards(
  spreadType: LenormandSpreadType,
  trace: RandomTrace,
): { source: Exclude<AuditedLenormandSource, 'manual'>; ids: number[] } {
  const cardCount = LENORMAND_SPREADS[spreadType].positions.length;
  const shuffleSampleCount = LENORMAND_CARDS.length - 1;
  if (trace.samples.length === shuffleSampleCount) {
    const deck = [...LENORMAND_CARDS];
    for (let index = deck.length - 1, sampleIndex = 0; index > 0; index--, sampleIndex++) {
      const targetIndex = Math.floor(trace.samples[sampleIndex] * (index + 1));
      [deck[index], deck[targetIndex]] = [deck[targetIndex], deck[index]];
    }
    return { source: 'random', ids: deck.slice(0, cardCount).map((card) => card.id) };
  }
  if (trace.samples.length === cardCount) {
    return {
      source: 'interactive',
      ids: resolveInteractiveLenormandCards(spreadType, trace.samples).map((card) => card.id),
    };
  }
  throw new Error(
    `${LENORMAND_SPREADS[spreadType].name}随机轨迹应为${shuffleSampleCount}个完整洗牌样本或${cardCount}个逐张抽牌样本，当前为${trace.samples.length}个。`,
  );
}

/** 只保留牌阵、牌号与可核验来源，其余牌面、组合和布局事实一律按标准资料重建。 */
export function rebuildAuditedLenormandData(input: LenormandData): LenormandData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('雷诺曼结果必须是对象。');
  }
  const spread = LENORMAND_SPREADS[input.spreadType];
  if (!spread) throw new Error(`未知的雷诺曼牌阵类型: ${String(input.spreadType)}`);
  if (!Array.isArray(input.cards) || input.cards.length !== spread.positions.length) {
    throw new Error(`${spread.name}必须完整记录${spread.positions.length}张牌。`);
  }
  const timestamp = assertLenormandTimestamp(input.timestamp);
  const ids = input.cards.map((card, index) => {
    if (!card || typeof card !== 'object' || !Number.isSafeInteger(card.id)) {
      throw new Error(`第${index + 1}张雷诺曼牌号无效。`);
    }
    if (!LENORMAND_CARDS.some((reference) => reference.id === card.id)) {
      throw new Error(`第${index + 1}张雷诺曼牌号不在标准36张牌组中。`);
    }
    return card.id;
  });
  if (new Set(ids).size !== ids.length) throw new Error('同一次雷诺曼牌阵不能出现重复牌号。');

  const trace = normalizeLenormandRandomTrace(input, timestamp);
  let source: AuditedLenormandSource;
  if (trace) {
    const replayed = replayLenormandCards(input.spreadType, trace);
    source = replayed.source;
    replayed.ids.forEach((id, index) => {
      if (ids[index] !== id) {
        throw new Error(`第${index + 1}张雷诺曼牌与随机轨迹重放结果不一致。`);
      }
    });
  } else if (input.draw?.method === '用户按牌位手工录入') {
    source = 'manual';
  } else {
    throw new Error('雷诺曼随机抽牌缺少完整随机轨迹，且未声明为手工录入，无法建立可信来源。');
  }

  const selectedCards = ids.map((id) => LENORMAND_CARDS.find((card) => card.id === id)!);
  const cards = buildLenormandCards(input.spreadType, selectedCards);
  const combinations = buildLenormandCombinations(input.spreadType, cards);
  const layoutEvidence = buildLenormandLayoutEvidence(input.spreadType, cards);
  const rebuilt: LenormandData = {
    spreadType: input.spreadType,
    spreadName: spread.name,
    draw: buildLenormandDraw(cards, source),
    cards,
    combinations,
    layoutEvidence,
    timestamp,
    meta: createResultMeta({
      algorithm:
        source === 'manual'
          ? 'lenormand.spread.manual'
          : source === 'interactive'
            ? 'lenormand.spread.interactive'
            : 'lenormand.spread',
      input:
        source === 'manual'
          ? { spreadType: input.spreadType, manualCardIds: ids }
          : { spreadType: input.spreadType },
      calculatedAt: timestamp,
      ...(trace ? { random: trace } : {}),
    }),
  };
  rebuilt.evidenceAnalysis = analyzeRebuiltLenormandEvidence(rebuilt);
  return rebuilt;
}

/** 所有公开证据分析均先经过可信重建，禁止旧派生字段直接进入提示词。 */
export function analyzeLenormandEvidence(input: LenormandData) {
  return rebuildAuditedLenormandData(input).evidenceAnalysis!;
}

/**
 * 抽取雷诺曼牌阵
 *
 * 支持 single（单牌）、three（三张）、relationship（感情）、
 * decision（决策）、nine（九宫格）等 8 种牌阵。
 * 抽牌为随机洗牌，每次独立。
 *
 * @param spreadType 牌阵类型，默认 'single'。
 * @returns 雷诺曼牌阵数据对象，只含项目内部牌号、牌名、位置与可复算抽取记录。
 *
 * @example
 * ```ts
 * const result = drawLenormandSpread('single');
 * // result 包含 cards（牌面列表）和 combinations（组合含义）
 * ```
 */
export function drawLenormandSpread(
  spreadType: LenormandSpreadType = 'single',
  options?: RandomOptions & {
    manualCardIds?: readonly number[];
    interactiveSamples?: readonly number[];
  },
): LenormandData {
  const spread = LENORMAND_SPREADS[spreadType];
  if (!spread) {
    throw new Error(`未知的雷诺曼牌阵类型: ${spreadType}`);
  }

  const manualCardIds = options?.manualCardIds;
  const interactiveSamples = options?.interactiveSamples;
  if (manualCardIds && interactiveSamples) {
    throw new Error('雷诺曼手动抽取不能同时提供手工录入牌面');
  }
  if (interactiveSamples && hasRandomOptions(options)) {
    throw new Error('雷诺曼手动抽取样本不能同时提供随机选项');
  }
  if (interactiveSamples && interactiveSamples.length !== spread.positions.length) {
    throw new Error(`${spread.name}需要逐张抽取${spread.positions.length}张牌`);
  }
  if (manualCardIds && hasRandomOptions(options)) {
    throw new Error('手工录入雷诺曼牌时不能同时提供随机选项');
  }
  if (manualCardIds && manualCardIds.length !== spread.positions.length) {
    throw new Error(`${spread.name}需要按牌位录入${spread.positions.length}张牌`);
  }
  if (manualCardIds && new Set(manualCardIds).size !== manualCardIds.length) {
    throw new Error('同一次雷诺曼牌阵不能重复录入同一张牌');
  }

  const context = manualCardIds || interactiveSamples ? null : createRandomContext(options);
  const selectedCards = manualCardIds
    ? manualCardIds.map((id, index) => {
        const card = LENORMAND_CARDS.find((item) => item.id === id);
        if (!card) throw new Error(`第${index + 1}张雷诺曼牌录入无效`);
        return card;
      })
    : interactiveSamples
      ? resolveInteractiveLenormandCards(spreadType, interactiveSamples)
      : shuffleCards(context!.random).slice(0, spread.positions.length);
  const cards = buildLenormandCards(spreadType, selectedCards);

  const combinations = buildLenormandCombinations(spreadType, cards);

  const layoutEvidence = buildLenormandLayoutEvidence(spreadType, cards);

  const timestamp = Date.now();
  const draw = buildLenormandDraw(
    cards,
    manualCardIds ? 'manual' : interactiveSamples ? 'interactive' : 'random',
  );
  const result = attachResultMeta(
    {
      spreadType,
      spreadName: spread.name,
      draw,
      cards,
      combinations,
      layoutEvidence,
      timestamp,
    } satisfies LenormandData,
    {
      algorithm: manualCardIds
        ? 'lenormand.spread.manual'
        : interactiveSamples
          ? 'lenormand.spread.interactive'
          : 'lenormand.spread',
      input: manualCardIds ? { spreadType, manualCardIds } : { spreadType },
      calculatedAt: timestamp,
      ...(context
        ? { random: context.getTrace() }
        : interactiveSamples
          ? { random: { mode: 'system' as const, samples: [...interactiveSamples] } }
          : {}),
    },
  );
  return { ...result, evidenceAnalysis: analyzeLenormandEvidence(result) };
}
