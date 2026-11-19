import { randomContext } from './systems/random';

type Method = 'tarot' | 'lenormand';
type Chosen = { id: number; name: string; position: string; reversed?: boolean };

/** Draw one new card locally; only the chosen cards are passed to calculation. */
export async function drawNext(
  method: Method,
  spreadId: string,
  chosen: readonly Chosen[],
  source?: () => number,
  options?: { majorOnly?: boolean },
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
  const remaining = deck.filter((card) => !ids.has(card.id));
  const random = randomContext(source);
  const card = remaining[random.integer(remaining.length)];
  const next: Chosen = { ...card, position: spread.positions[chosen.length], ...(method === 'tarot' ? { reversed: random.sample() < 0.5 } : {}) };
  return { card: next, total: spread.positions.length, spreadName: spread.name };
}
