import { tarotCards, tarotSpreads } from './tarot-data';
import type { RandomOptions } from '../shared/random';
import {
  createRandomContext,
  hasRandomOptions,
  randomFloat,
  randomInt,
  type RandomSource,
} from '../shared/random';
import { attachResultMeta } from '../shared/result';
import type { TarotData, TarotSpreadType } from '../types/divination';
import { analyzeTarotEvidence } from './tarot-evidence';
import './tarot-reference';

export { tarotCards, tarotSpreads } from './tarot-data';
export {
  analyzeTarotEvidence,
  conditionTarotTraditionalText,
  rebuildAuditedTarotData,
} from './tarot-evidence';
export type {
  TarotCardEvidence,
  TarotCounterEvidenceFact,
  TarotCounterSummaryFact,
  TarotDrawFact,
  TarotDrawOrderFact,
  TarotElementInteractionFact,
  TarotElementInteractionRelation,
  TarotEvidenceAnalysis,
  TarotLimitationFact,
  TarotSequenceFact,
  TarotSpreadCoverageFact,
  TarotThemeFact,
  TarotTraditionalFact,
} from './tarot-evidence';

export interface TarotManualCardInput {
  id: number;
  reversed: boolean;
}

export interface TarotDrawOptions extends RandomOptions {
  manualCards?: readonly TarotManualCardInput[];
  /** 用户在前端逐张抽牌时产生的原始随机样本，每张牌依次使用抽牌与正逆位两个样本。 */
  interactiveSamples?: readonly number[];
}

export interface TarotInteractiveCard {
  id: number;
  name: string;
  reversed: boolean;
}

function buildDrawFacts(
  cards: Array<{ id: number; name: string; position: string; reversed: boolean }>,
  method: 'random' | 'manual' | 'interactive' = 'random',
): NonNullable<TarotData['draw']> {
  return {
    deckSize: tarotCards.length,
    method:
      method === 'manual'
        ? '用户按牌位手工录入'
        : method === 'interactive'
          ? '用户逐张触发前端随机抽取'
          : 'Fisher-Yates洗牌后依牌位顺序取顶牌',
    orientationRule:
      method === 'manual'
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

function assertInteractiveSample(sample: number, index: number) {
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error(`第${index + 1}个塔罗抽牌随机样本无效`);
  }
}

/** 根据前端已产生的随机样本复算当前抽牌进度，允许传入未完成牌阵的样本。 */
export function resolveInteractiveTarotCards(
  spreadType: TarotSpreadType,
  samples: readonly number[],
): TarotInteractiveCard[] {
  const spread = tarotSpreads[spreadType];
  if (!spread) throw new Error(`未知的牌阵类型: ${spreadType}`);
  if (samples.length % 2 !== 0) throw new Error('塔罗手动抽取每张牌需要两个随机样本');
  if (samples.length > spread.cardCount * 2) {
    throw new Error(`${spread.name}最多抽取${spread.cardCount}张牌`);
  }
  samples.forEach(assertInteractiveSample);

  const remaining = [...tarotCards];
  const selected: TarotInteractiveCard[] = [];
  for (let index = 0; index < samples.length; index += 2) {
    const cardIndex = Math.floor(samples[index] * remaining.length);
    const [card] = remaining.splice(cardIndex, 1);
    selected.push({
      id: card.number,
      name: card.name,
      reversed: samples[index + 1] < 0.5,
    });
  }
  return selected;
}

function shuffleCards(rng: RandomSource) {
  const shuffled = [...tarotCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawSingleCard(options?: RandomOptions) {
  const context = createRandomContext(options);
  const rng = context.random;
  const shuffled = shuffleCards(rng);
  const card = shuffled[0];
  const isReversed = randomFloat(rng) < 0.5;
  const timestamp = Date.now();

  return attachResultMeta(
    {
      card,
      isReversed,
      position: tarotSpreads.single.positions[0],
      timestamp,
    },
    {
      algorithm: 'tarot.single',
      input: { spreadType: 'single' },
      calculatedAt: timestamp,
      random: context.getTrace(),
    },
  );
}

export function drawSpreadCards(spreadType: keyof typeof tarotSpreads, options?: RandomOptions) {
  const spread = tarotSpreads[spreadType];
  if (!spread) {
    throw new Error(`未知的牌阵类型: ${spreadType}`);
  }

  const context = createRandomContext(options);
  const rng = context.random;
  const shuffled = shuffleCards(rng);
  const cards = [];

  for (let i = 0; i < spread.cardCount; i++) {
    const card = shuffled[i];
    const isReversed = randomFloat(rng) < 0.5;

    cards.push({
      card: card,
      isReversed: isReversed,
      position: spread.positions[i],
    });
  }

  const timestamp = Date.now();
  return attachResultMeta(
    {
      spreadType,
      spreadName: spread.name,
      cards,
      timestamp,
    },
    {
      algorithm: 'tarot.spread',
      input: { spreadType },
      calculatedAt: timestamp,
      random: context.getTrace(),
    },
  );
}

export function drawTarotSpread(
  spreadType: TarotSpreadType = 'single',
  options?: TarotDrawOptions,
): TarotData {
  const spread = tarotSpreads[spreadType];
  if (!spread) {
    throw new Error(`未知的牌阵类型: ${spreadType}`);
  }

  if (options?.interactiveSamples && options.manualCards) {
    throw new Error('塔罗手动抽取不能同时提供手工录入牌面');
  }
  if (options?.interactiveSamples && hasRandomOptions(options)) {
    throw new Error('塔罗手动抽取样本不能同时提供随机选项');
  }

  if (options?.interactiveSamples) {
    if (options.interactiveSamples.length !== spread.cardCount * 2) {
      throw new Error(`${spread.name}需要逐张抽取${spread.cardCount}张牌`);
    }
    const cards = resolveInteractiveTarotCards(spreadType, options.interactiveSamples).map(
      (card, index) => ({
        ...card,
        position: spread.positions[index],
      }),
    );
    const timestamp = Date.now();
    const data = attachResultMeta(
      {
        spreadType,
        spreadName: spread.name,
        cards,
        draw: buildDrawFacts(cards, 'interactive'),
        timestamp,
      } satisfies Omit<TarotData, 'meta' | 'evidenceAnalysis'>,
      {
        algorithm: 'tarot.spread.interactive',
        input: { spreadType },
        calculatedAt: timestamp,
        random: { mode: 'system', samples: [...options.interactiveSamples] },
      },
    );
    return { ...data, evidenceAnalysis: analyzeTarotEvidence(data) };
  }

  if (options?.manualCards) {
    if (hasRandomOptions(options)) {
      throw new Error('手工录入塔罗牌时不能同时提供随机选项');
    }
    if (options.manualCards.length !== spread.cardCount) {
      throw new Error(`${spread.name}需要按牌位录入${spread.cardCount}张牌`);
    }
    const ids = options.manualCards.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('同一次塔罗牌阵不能重复录入同一张牌');
    }
    const cards = options.manualCards.map((input, index) => {
      const card = tarotCards.find((item) => item.number === input.id);
      if (!card || typeof input.reversed !== 'boolean') {
        throw new Error(`第${index + 1}张塔罗牌录入无效`);
      }
      return {
        id: card.number,
        name: card.name,
        position: spread.positions[index],
        reversed: input.reversed,
      };
    });
    const timestamp = Date.now();
    const data = attachResultMeta(
      {
        spreadType,
        spreadName: spread.name,
        cards,
        draw: buildDrawFacts(cards, 'manual'),
        timestamp,
      } satisfies Omit<TarotData, 'meta' | 'evidenceAnalysis'>,
      {
        algorithm: 'tarot.spread.manual',
        input: { spreadType, manualCards: options.manualCards },
        calculatedAt: timestamp,
      },
    );
    return { ...data, evidenceAnalysis: analyzeTarotEvidence(data) };
  }

  if (spreadType === 'single') {
    const draw = drawSingleCard(options);
    const cards: TarotData['cards'] = [
      {
        id: draw.card.number,
        name: draw.card.name,
        position: draw.position,
        reversed: draw.isReversed,
      },
    ];
    const data: TarotData = {
      spreadType,
      spreadName: '单牌指引',
      cards,
      draw: buildDrawFacts(cards),
      timestamp: draw.timestamp,
      meta: draw.meta,
    };
    data.evidenceAnalysis = analyzeTarotEvidence(data);
    return data;
  }

  const draw = drawSpreadCards(spreadType, options);
  const cards: TarotData['cards'] = draw.cards.map((item) => ({
    id: item.card.number,
    name: item.card.name,
    position: item.position,
    reversed: item.isReversed,
  }));
  const data: TarotData = {
    spreadType,
    spreadName: draw.spreadName,
    cards,
    draw: buildDrawFacts(cards),
    timestamp: draw.timestamp,
    meta: draw.meta,
  };
  data.evidenceAnalysis = analyzeTarotEvidence(data);
  return data;
}
