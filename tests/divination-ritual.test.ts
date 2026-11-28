import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDayangThreeChanges } from '../src/app/components/divination/ManualCastStudio';

describe('大衍揲蓍真实三变数学推演', () => {
  it('遍历 49 策所有合法分割点 [6, 43] 均准确经历 3 变且余数严格合法', () => {
    for (let split = 6; split <= 43; split++) {
      const res = computeDayangThreeChanges(split);
      assert.equal(res.changes.length, 3, `split=${split} 应为 3 变`);
      assert.ok([6, 7, 8, 9].includes(res.value), `split=${split} 结果应为 6/7/8/9，实际 ${res.value}`);

      const [c1, c2, c3] = res.changes;
      assert.equal(c1!.before, 49);
      assert.equal(c1!.left, split);
      assert.equal(c1!.right, 49 - split);
      assert.ok(c1!.removed === 5 || c1!.removed === 9, `第一变归奇应为 5 或 9，实际 ${c1!.removed}`);
      assert.ok(c1!.after === 44 || c1!.after === 40, `第一变余策应为 44 或 40，实际 ${c1!.after}`);

      assert.equal(c2!.before, c1!.after);
      assert.ok(c2!.removed === 4 || c2!.removed === 8, `第二变归奇应为 4 或 8，实际 ${c2!.removed}`);
      assert.equal(c2!.after, c2!.before - c2!.removed);

      assert.equal(c3!.before, c2!.after);
      assert.ok(c3!.removed === 4 || c3!.removed === 8, `第三变归奇应为 4 或 8，实际 ${c3!.removed}`);
      assert.equal(c3!.after, c3!.before - c3!.removed);
      assert.ok([24, 28, 32, 36].includes(c3!.after), `三变终余策应为 24/28/32/36，实际 ${c3!.after}`);
      assert.equal(c3!.after / 4, res.value);
    }
  });
});
