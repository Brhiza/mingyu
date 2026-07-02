import test from 'node:test';
import assert from 'node:assert/strict';

import { drawLenormandSpread } from '../packages/core/src/divination/algorithms/lenormand.ts';

test('雷诺曼大桌牌阵应抽取完整 36 张牌', () => {
  const result = drawLenormandSpread('grandTableau');

  assert.equal(result.cards.length, 36);
  assert.equal(new Set(result.cards.map((card) => card.id)).size, 36);
  assert.equal(result.cards[0].position, '位置1（全桌解读）');
  assert.equal(result.cards[35].position, '位置36（全桌解读）');
});
