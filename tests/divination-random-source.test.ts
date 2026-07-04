import test from 'node:test';
import assert from 'node:assert/strict';

import { drawSpreadCards } from '../packages/core/src/divination/tarot.ts';
import { drawRandomSign } from '../packages/core/src/divination/algorithms/ssgw.ts';
import { drawLenormandSpread } from '../packages/core/src/divination/algorithms/lenormand.ts';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';

const SEED = 'fixed-random-source';
const DATE = new Date('2025-01-01T08:00:00+08:00');

test('随机占法支持种子复现抽取结果', () => {
  const tarot = (seed: string) =>
    drawSpreadCards('three', { seed }).cards.map((item) => [
      item.card.name,
      item.position,
      item.isReversed,
    ]);
  const ssgw = (seed: string) => drawRandomSign(DATE, { seed }).number;
  const lenormand = (seed: string) =>
    drawLenormandSpread('five', { seed }).cards.map((item) => [item.id, item.position]);
  const meihua = (seed: string) => {
    const data = generateMeihua(DATE, { method: 'random', seed });
    return [
      data.calculation?.upperTrigramIndex,
      data.calculation?.lowerTrigramIndex,
      data.calculation?.movingYaoIndex,
    ];
  };

  assert.deepEqual(tarot(SEED), tarot(SEED));
  assert.equal(ssgw(SEED), ssgw(SEED));
  assert.deepEqual(lenormand(SEED), lenormand(SEED));
  assert.deepEqual(meihua(SEED), meihua(SEED));
});
