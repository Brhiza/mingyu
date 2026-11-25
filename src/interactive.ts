import { randomContext } from './systems/random';
import { resolveTarotReversalMode, TAROT_REVERSAL_RATES, type TarotReversalMode } from './systems/defaults';

type Method = 'tarot' | 'lenormand';
type Chosen = { id: number; name: string; position: string; reversed?: boolean };
export type ShuffledTarotCard = { id: number; name: string; reversed: boolean };

/** 预先洗牌并在洗牌阶段锁定整副塔罗牌的正逆位，供交互式逐张抽牌直接按序抽取。 */
export async function createShuffledTarotDeck(
  options?: { majorOnly?: boolean; reversalMode?: TarotReversalMode },
  source?: () => number,
): Promise<ShuffledTarotCard[]> {
  const reference = (await import('./systems/tarot-data.json')).default;
  const fullDeck = reference.cards.map((card) => ({ id: card.number, name: card.name }));
  const deck = options?.majorOnly ? fullDeck.filter((card) => card.id <= 22) : fullDeck;
  const random = randomContext(source);
  const reversalRate = TAROT_REVERSAL_RATES[resolveTarotReversalMode(options?.reversalMode)];
  const shuffled: ShuffledTarotCard[] = deck.map((card) => ({
    ...card,
    reversed: reversalRate > 0 ? random.sample() < reversalRate : false,
  }));
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = random.integer(index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

/** Draw one new card locally; only the chosen cards are passed to calculation. */
export async function drawNext(
  method: Method,
  spreadId: string,
  chosen: readonly Chosen[],
  source?: () => number,
  options?: { majorOnly?: boolean; reversalMode?: TarotReversalMode; preShuffledDeck?: readonly ShuffledTarotCard[] },
) {
  const reference = method === 'tarot'
    ? (await import('./systems/tarot-data.json')).default
    : (await import('./systems/lenormand-data.json')).default;
  const spreads = reference.spreads as Record<string, { name: string; positions: string[] }>;
  const spread = spreads[spreadId];
  if (!spread) throw new Error('未知的牌阵。');
  if (chosen.length >= spread.positions.length) throw new Error('本次牌阵已经抽完。');
  const ids = new Set(chosen.map((card) => card.id));
  const fullDeck = reference.cards.map((card) => ({ id: 'id' in card ? card.id : card.number, name: card.name }));
  const deck = method === 'tarot' && options?.majorOnly ? fullDeck.filter((card) => card.id <= 22) : fullDeck;
  if (ids.size !== chosen.length || [...ids].some((id) => !deck.some((card) => card.id === id))) throw new Error('已有选牌无效。');
  if (method === 'tarot' && options?.preShuffledDeck?.length) {
    const picked = options.preShuffledDeck.find((card) => !ids.has(card.id) && deck.some((d) => d.id === card.id));
    if (!picked) throw new Error('预洗牌堆已无可用牌面。');
    const next: Chosen = { id: picked.id, name: picked.name, position: spread.positions[chosen.length], reversed: picked.reversed };
    return { card: next, total: spread.positions.length, spreadName: spread.name };
  }
  const remaining = deck.filter((card) => !ids.has(card.id));
  const random = randomContext(source);
  const card = remaining[random.integer(remaining.length)];
  const reversalRate = TAROT_REVERSAL_RATES[resolveTarotReversalMode(options?.reversalMode)];
  const next: Chosen = {
    ...card,
    position: spread.positions[chosen.length],
    ...(method === 'tarot' ? { reversed: reversalRate > 0 ? random.sample() < reversalRate : false } : {}),
  };
  return { card: next, total: spread.positions.length, spreadName: spread.name };
}
