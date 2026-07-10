import test from 'node:test';
import assert from 'node:assert/strict';

import { drawSpreadCards, getCardKeywords } from '../packages/core/src/divination/tarot.ts';
import { drawRandomSign } from '../packages/core/src/divination/algorithms/ssgw.ts';
import { drawLenormandSpread } from '../packages/core/src/divination/algorithms/lenormand.ts';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { TimeManager } from '../packages/core/src/calendar/timeManager.ts';
import { createRandomSource, randomInt } from '../packages/core/src/shared/random.ts';

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

test('塔罗抽牌应拒绝未知牌阵和未知牌名，不应用泛化关键词掩盖错误', () => {
  assert.throws(() => drawSpreadCards('unknown' as never), /未知的牌阵类型/);
  assert.throws(() => getCardKeywords('不存在的牌'), /未知的塔罗牌名/);
});

test('时间起卦随机工具应拒绝非法范围和数量，避免返回空结果或 NaN', () => {
  assert.throws(() => TimeManager.getSeededRandom(Number.NaN, 6), /随机种子时间戳必须是有效数字/);
  assert.throws(
    () => TimeManager.getSeededRandom(DATE.getTime(), 0),
    /随机范围必须是安全范围内的正整数/,
  );
  assert.throws(
    () => TimeManager.generateYaosByTime(DATE.getTime(), 0),
    /爻象数量必须是安全范围内的正整数/,
  );
  assert.throws(() => TimeManager.generateYaosByRandom(-1), /爻象数量必须是安全范围内的正整数/);
  assert.throws(
    () => randomInt(Number.MAX_SAFE_INTEGER + 1, () => 0.5),
    /随机整数范围必须是安全范围内的正整数/,
  );
});

test('时间三钱法应能稳定产生老阴老阳，分布接近 1:3:3:1', () => {
  const counts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
  const start = Date.UTC(2026, 0, 1);
  const samples = 8192;

  for (let index = 0; index < samples; index += 1) {
    const yao = TimeManager.generateYaosByTime(start + index * 1000, 1)[0];
    counts[yao] += 1;
  }

  assert.ok(counts[6] > samples * 0.09 && counts[6] < samples * 0.16, JSON.stringify(counts));
  assert.ok(counts[7] > samples * 0.33 && counts[7] < samples * 0.42, JSON.stringify(counts));
  assert.ok(counts[8] > samples * 0.33 && counts[8] < samples * 0.42, JSON.stringify(counts));
  assert.ok(counts[9] > samples * 0.09 && counts[9] < samples * 0.16, JSON.stringify(counts));
  assert.deepEqual(
    TimeManager.generateYaosByTime(DATE.getTime(), 6),
    TimeManager.generateYaosByTime(DATE.getTime(), 6),
  );
});

test('自定义随机源必须返回合法区间，避免抽取结果被坏输入静默污染', () => {
  assert.throws(() => createRandomSource({ rng: 0.5 as never }), /自定义随机源必须是函数/);
  assert.throws(
    () => createRandomSource({ seed: Number.POSITIVE_INFINITY }),
    /随机种子必须是有限数字或文本/,
  );
  assert.throws(() => createRandomSource({ seed: {} as never }), /随机种子必须是有限数字或文本/);
  assert.throws(() => randomInt(10, () => Number.NaN), /随机源必须返回/);
  assert.throws(() => randomInt(10, () => 1), /随机源必须返回/);
  assert.throws(() => randomInt(10, () => -0.1), /随机源必须返回/);
});
