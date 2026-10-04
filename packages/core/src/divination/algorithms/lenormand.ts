/**
 * @file 雷诺曼牌算法
 * @传统依据 Petit Lenormand 通行牌序与组合读法；历史牌组参照 1799 年《Das Spiel der Hoffnung》资料。
 */
import { getLenormandReferenceData } from '../lenormand-data';
export {
  getLenormandReferenceData,
  LENORMAND_CARDS,
  LENORMAND_SPREADS,
  LENORMAND_FIXED_COMBINATIONS,
} from '../lenormand-data';
import type { LenormandData, LenormandSpreadType } from '../../types/divination';
import type { RandomOptions, RandomSource } from '../../shared/random';
import {
  assertReplaySamplesConsumed,
  createRandomContext,
  hasRandomOptions,
  randomInt,
} from '../../shared/random';
import { attachResultMeta } from '../../shared/result';
import { analyzeLenormandEvidence } from '../lenormand-evidence';

const { LENORMAND_CARDS, LENORMAND_SPREADS, LENORMAND_FIXED_COMBINATIONS } =
  getLenormandReferenceData();

export { analyzeLenormandEvidence, conditionLenormandTraditionalText } from '../lenormand-evidence';
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
  const spread =
    typeof spreadType === 'string' && Object.hasOwn(LENORMAND_SPREADS, spreadType)
      ? LENORMAND_SPREADS[spreadType]
      : undefined;
  if (!spread) throw new Error(`未知的雷诺曼牌阵类型: ${spreadType}`);
  if (!Array.isArray(samples)) throw new Error('雷诺曼抽牌随机样本必须是数组');
  if (samples.length > spread.positions.length) {
    throw new Error(`${spread.name}最多抽取${spread.positions.length}张牌`);
  }
  for (let index = 0; index < samples.length; index++) {
    assertInteractiveSample(samples[index], index);
  }

  const remaining = [...LENORMAND_CARDS];
  return samples.map((sample) => {
    const index = Math.floor(sample * remaining.length);
    const card = remaining.splice(index, 1)[0];
    if (!card) throw new Error(`第${remaining.length + 1}张雷诺曼抽牌无法映射到剩余牌组`);
    return { ...card, keywords: [...card.keywords] };
  });
}

export function shuffleLenormandCards(rng: RandomSource) {
  const shuffled = LENORMAND_CARDS.map((card) => ({ ...card, keywords: [...card.keywords] }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 雷诺曼牌组两牌组合含义（为配对解读提供传统关键词）
 * 如 "太阳+鱼" = 财运好、"鞭子+鼠" = 消耗性争执
 */

type LenormandCardPlacement = LenormandData['cards'][number];
type LenormandCombination = NonNullable<LenormandData['combinations']>[number];

/** 判词含先后/过程语义的组合仅在牌序与判词顺序一致时取用。 */
const DIRECTIONAL_COMBINATION_KEYS = new Set([
  '骑士+心',
  '月亮+太阳',
  '星星+月亮',
  '锚+星星',
  '船+鹳',
]);

function getFixedCombinationMeaning(firstName: string, secondName: string): string | null {
  const direct = LENORMAND_FIXED_COMBINATIONS[`${firstName}+${secondName}`];
  if (direct) return direct;
  const reverseKey = `${secondName}+${firstName}`;
  return DIRECTIONAL_COMBINATION_KEYS.has(reverseKey)
    ? null
    : (LENORMAND_FIXED_COMBINATIONS[reverseKey] ?? null);
}

function getGridCombinationCandidates(cards: LenormandCardPlacement[]) {
  cards.forEach((card, index) => {
    if (!card.row || !card.column) {
      throw new Error(`雷诺曼网格牌阵第${index + 1}张缺少行列坐标`);
    }
  });

  return cards.flatMap((first, firstIndex) =>
    cards.slice(firstIndex + 1).flatMap((second) => {
      const rowDistance = Math.abs(first.row! - second.row!);
      const columnDistance = Math.abs(first.column! - second.column!);
      if (rowDistance > 1 || columnDistance > 1 || (rowDistance === 0 && columnDistance === 0)) {
        return [];
      }
      return [
        {
          first,
          second,
          rowDistance,
          columnDistance,
          relation:
            rowDistance === 0
              ? ('横向相邻' as const)
              : columnDistance === 0
                ? ('纵向相邻' as const)
                : ('对角相邻' as const),
        },
      ];
    }),
  );
}

export function buildLenormandCombinations(
  spreadType: LenormandSpreadType,
  cards: LenormandCardPlacement[],
): NonNullable<LenormandData['combinations']> {
  const candidates =
    spreadType === 'nine' || spreadType === 'grandTableau'
      ? getGridCombinationCandidates(cards)
      : cards
          .slice(1)
          .map((second, index) => ({
            first: cards[index],
            second,
            rowDistance: 0,
            columnDistance: 0,
            relation: '牌序相邻' as const,
          }))
          // 选择A走向与选择B分属两条支线，不按牌序互作组合。
          .filter(
            ({ first, second }) =>
              !(
                spreadType === 'decision' &&
                first.position === '选择A走向' &&
                second.position === '选择B'
              ),
          );

  return candidates.flatMap(({ first, second, relation, rowDistance, columnDistance }) => {
    const fixedMeaning = getFixedCombinationMeaning(first.name, second.name);
    const isPersonNeighborhood =
      spreadType === 'grandTableau' &&
      (first.name === '男士' ||
        first.name === '女士' ||
        second.name === '男士' ||
        second.name === '女士');
    if (spreadType === 'grandTableau' && !fixedMeaning && !isPersonNeighborhood) {
      return [];
    }
    const isSequential = relation === '牌序相邻';
    const firstMeaning = first.meaning.replace(/[。！？]$/u, '');
    const meaning =
      fixedMeaning ??
      (isSequential
        ? spreadType === 'three'
          ? `${first.position}${first.name}的“${first.keywords.slice(0, 2).join('、')}”与${second.position}${second.name}的“${second.keywords.slice(0, 2).join('、')}”前后相接，先按${firstMeaning}，再看${second.meaning}`
          : `${first.position}${first.name}（${first.keywords.slice(0, 2).join('、')}）与${second.position}${second.name}（${second.keywords.slice(0, 2).join('、')}）是牌序相邻的两组线索，可按各自牌位并读`
        : `${first.position}${first.name}与${second.position}${second.name}为${relation}，互参“${first.keywords.slice(0, 2).join('、')}”与“${second.keywords.slice(0, 2).join('、')}”两组线索`);
    const combination: LenormandCombination = {
      card1: first.name,
      card2: second.name,
      position1: first.position,
      position2: second.position,
      relation,
      rowDistance,
      columnDistance,
      meaning,
      source: fixedMeaning ? '固定组合' : '相邻牌义合读',
    };
    return [combination];
  });
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
  if (
    LENORMAND_SPREADS.grandTableau.positions.length !== 36 ||
    LENORMAND_SPREADS.grandTableau.positions.some((position) => position.includes('未知'))
  ) {
    throw new Error('雷诺曼大桌必须完整登记 36 个同序宫位');
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

/**
 * 抽取雷诺曼牌阵
 *
 * 支持 single（单牌）、three（三张）、relationship（感情）、
 * decision（决策）、nine（九宫格）等 8 种牌阵。
 * 抽牌为随机洗牌，每次独立。
 *
 * @param spreadType 牌阵类型，默认 'single'。
 * @returns 雷诺曼牌阵数据对象 LenormandData，含牌面、位置和两牌组合含义。
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
  const spread =
    typeof spreadType === 'string' && Object.hasOwn(LENORMAND_SPREADS, spreadType)
      ? LENORMAND_SPREADS[spreadType]
      : undefined;
  if (!spread) {
    throw new Error(`未知的雷诺曼牌阵类型: ${spreadType}`);
  }

  const manualCardIds = options?.manualCardIds;
  const interactiveSamples = options?.interactiveSamples;
  if (manualCardIds !== undefined && !Array.isArray(manualCardIds)) {
    throw new Error('雷诺曼手工录入牌号必须是数组');
  }
  if (interactiveSamples !== undefined && !Array.isArray(interactiveSamples)) {
    throw new Error('雷诺曼抽牌随机样本必须是数组');
  }
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
    ? [...manualCardIds].map((id, index) => {
        const card = LENORMAND_CARDS.find((item) => item.id === id);
        if (!card) throw new Error(`第${index + 1}张雷诺曼牌录入无效`);
        return card;
      })
    : interactiveSamples
      ? resolveInteractiveLenormandCards(spreadType, interactiveSamples)
      : shuffleLenormandCards(context!.random).slice(0, spread.positions.length);
  const randomTrace = context?.getTrace();
  if (randomTrace) assertReplaySamplesConsumed(options, randomTrace);
  const cards = selectedCards.map((card, index) => {
    const columns = spreadType === 'grandTableau' ? 9 : spreadType === 'nine' ? 3 : 0;
    const houseCard = spreadType === 'grandTableau' ? LENORMAND_CARDS[index] : undefined;
    if (spreadType === 'grandTableau' && !houseCard) {
      throw new Error(`雷诺曼第${index + 1}宫缺少对应宫位牌`);
    }
    return {
      ...card,
      keywords: [...card.keywords],
      position: spread.positions[index],
      house: houseCard?.name,
      row: columns ? Math.floor(index / columns) + 1 : undefined,
      column: columns ? (index % columns) + 1 : undefined,
    };
  });

  const combinations = buildLenormandCombinations(spreadType, cards);

  const layoutEvidence: string[] = [];
  if (spreadType === 'nine') {
    const center = cards[4];
    layoutEvidence.push(
      `中心牌${center.name}是九宫主轴；上排为背景与思考，中排为当下，下排为落地走向`,
    );
    layoutEvidence.push(
      `横向：${cards
        .slice(3, 6)
        .map((card) => card.name)
        .join('→')}；纵向：${[cards[1], cards[4], cards[7]].map((card) => card.name).join('→')}`,
    );
    layoutEvidence.push(
      `对角线：${[cards[0], cards[4], cards[8]].map((card) => card.name).join('→')}；${[cards[2], cards[4], cards[6]].map((card) => card.name).join('→')}`,
    );
  }
  if (spreadType === 'grandTableau') {
    const keyCards = ['男士', '女士'];
    keyCards.forEach((name) => {
      const index = cards.findIndex((card) => card.name === name);
      if (index < 0) return;
      const card = cards[index];
      const neighbors = cards.filter((candidate) => {
        if (!candidate.row || !candidate.column || !card.row || !card.column) return false;
        const rowDistance = Math.abs(candidate.row - card.row);
        const columnDistance = Math.abs(candidate.column - card.column);
        return rowDistance <= 1 && columnDistance <= 1 && rowDistance + columnDistance > 0;
      });
      layoutEvidence.push(
        `${name}落第${index + 1}宫（${card.house}宫，第${card.row}排第${card.column}列）；近身牌${neighbors.map((item) => item.name).join('、')}`,
      );
    });
    const houseMatches = cards.filter((card) => card.house === card.name);
    if (houseMatches.length) {
      layoutEvidence.push(
        `归宫牌：${houseMatches.map((card) => `${card.name}回到本宫`).join('、')}`,
      );
    }
  }

  const timestamp = Date.now();
  const draw: NonNullable<LenormandData['draw']> = {
    deckSize: LENORMAND_CARDS.length,
    method: manualCardIds
      ? '用户按牌位手工录入'
      : interactiveSamples
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
