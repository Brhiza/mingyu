import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQizhengBirthRange } from '../packages/core/src/qi_zheng';
import { formatQizhengBirthRangePrompt } from '../src/lib/qizheng-birth-range-prompt';

test('七政本命区间资料保留月亮换宫两侧、整秒范围与完整连续量中文名称', () => {
  const startTimestamp = Date.parse('2024-02-19T11:24:48+08:00');
  const range = generateQizhengBirthRange(
    { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 48, timezone: 8 },
    { startTimestamp, endTimestamp: startTimestamp + 2_000 },
  );
  const text = formatQizhengBirthRangePrompt(range);
  assert.equal(range.branches.length, 2);
  assert.match(text, /共2个时刻、2段/);
  assert.match(text, /2024-02-19 11:24:48 至 2024-02-19 11:24:49/);
  assert.match(text, /2024-02-19 11:24:49 至 2024-02-19 11:24:50/);
  for (const branch of range.branches) {
    for (const item of branch.continuous) assert.ok(text.includes(item.label));
    for (const item of branch.representative.enNan?.aspectInteraction ?? []) {
      assert.ok(text.includes(item));
    }
  }
  assert.match(text, /流年与行限属于另外的时段资料/);
  assert.doesNotMatch(text, /calculationContext|startTimestamp|sourceId|mingyu|API|MCP/);
});
