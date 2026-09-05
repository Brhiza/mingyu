import test from 'node:test';
import assert from 'node:assert/strict';
import { generateYarrow } from '../packages/core/src/divination/algorithms/liuyao';

test('蓍草三变守恒与四象权数覆盖全部余数组合', () => {
  // 《周易衍义》老阴4、少阳20、少阴28、老阳12种。
  // https://www.shidianguji.com/mid-page/7370076425560260634
  const counts = { 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++)
      for (let c = 0; c < 4; c++) {
        const samples = Array.from({ length: 6 }, () => [a / 4, 0, b / 4, 0, c / 4, 0]).flat();
        const result = generateYarrow({ replay: samples });
        counts[result.yaos[0]]++;
        assert.equal(result.lines.length, 6);
        for (const line of result.lines) {
          assert.equal(line.changes.length, 3);
          assert.equal(line.changes[0].initial, 49);
          for (const [index, step] of line.changes.entries()) {
            assert.equal(step.left + step.right, step.initial);
            assert.equal(step.hanging + step.leftRemainder + step.rightRemainder, step.removed);
            assert.equal(step.remaining + step.removed, step.initial);
            assert.ok((index === 0 ? [5, 9] : [4, 8]).includes(step.removed));
            if (index > 0) assert.equal(step.initial, line.changes[index - 1].remaining);
          }
          assert.equal(line.changes[2].remaining, line.value * 4);
        }
      }
  assert.deepEqual(counts, { 6: 4, 7: 20, 8: 28, 9: 12 });
});

test('蓍草支持种子与分堆重放并拒绝非法记录', () => {
  const first = generateYarrow({ seed: '蓍草' });
  assert.deepEqual(generateYarrow({ seed: '蓍草' }), first);
  assert.deepEqual(generateYarrow({ replay: first.randomTrace!.samples }).lines, first.lines);
  const splits = first.lines.flatMap((line) => line.changes.map((step) => step.left));
  assert.deepEqual(generateYarrow({ splits }).lines, first.lines);
  for (const invalid of [0, -1, 49, 1.5, NaN, Infinity]) {
    assert.throws(() => generateYarrow({ splits: [invalid, ...splits.slice(1)] }), /左堆/);
  }
  assert.throws(() => generateYarrow({ splits: [] }), /十八变/);
  assert.throws(() => generateYarrow({ splits, seed: 1 }), /同时/);
});
