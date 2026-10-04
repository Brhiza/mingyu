import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyao } from '@core/divination/algorithms/liuyao';

const date = new Date('2025-06-18T10:30:00+08:00');
const coinThrows = Array.from({ length: 6 }, () => ({
  coins: [2, 2, 3] as const,
  total: 7 as const,
}));

test('手工三钱记录不被写成模拟投掷，随机轨迹标为不适用', () => {
  const data = generateLiuyao(date, { method: 'coins', coinThrows });
  const evidence = data.evidenceAnalysis;
  assert.ok(evidence);
  assert.equal(evidence.generationFact.methodLabel, '三钱记录起卦');
  assert.match(evidence.generationFact.promptText, /第1爻投掷记录2\+2\+3=7/u);
  assert.equal(evidence.randomFact.status, '不适用');
  assert.doesNotMatch(evidence.promptText, /模拟三钱起卦|随机轨迹缺失/u);
});

test('程序模拟三钱保留计算样本和随机轨迹', () => {
  const data = generateLiuyao(date, { method: 'coins', seed: '六爻来源测试' });
  const evidence = data.evidenceAnalysis;
  assert.ok(evidence);
  assert.equal(evidence.generationFact.methodLabel, '模拟三钱起卦');
  assert.match(evidence.generationFact.promptText, /第1爻计算样本/u);
  assert.equal(evidence.randomFact.status, '可重放');
});

test('六爻三钱重放必须恰好用尽输入样本', () => {
  const original = generateLiuyao(date, { method: 'coins', seed: '六爻重放边界' });
  const samples = original.meta!.random!.samples;
  const replayed = generateLiuyao(date, { method: 'coins', replay: samples });
  assert.deepEqual(replayed.yaoArray, original.yaoArray);
  assert.throws(
    () => generateLiuyao(date, { method: 'coins', replay: [...samples, 0] }),
    /重放样本有剩余/,
  );
});

test('六爻手工爻值和铜钱记录拒绝空数组项并返回可读的输入错误', () => {
  assert.throws(
    () => generateLiuyao(date, { method: 'manual', yaos: null as unknown as number[] }),
    /六爻手工爻值必须恰好包含 6 爻/,
  );
  assert.throws(
    () =>
      generateLiuyao(date, {
        method: 'coins',
        coinThrows: [null, ...coinThrows.slice(1)] as unknown as typeof coinThrows,
      }),
    /第1爻必须包含三枚有效铜钱/,
  );
  assert.throws(
    () =>
      generateLiuyao(date, {
        method: 'coins',
        coinThrows: [
          { coins: null, total: 7 },
          ...coinThrows.slice(1),
        ] as unknown as typeof coinThrows,
      }),
    /第1爻必须包含三枚有效铜钱/,
  );
});
