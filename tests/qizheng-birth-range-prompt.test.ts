import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateQizhengBirthRange,
  generateQizhengFlowBirthRange,
} from '../packages/core/src/qi_zheng';
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

test('七政流曜区间资料保留目标窗口、所有分段、行限与事件连续量', () => {
  const startTimestamp = Date.parse('2024-02-19T11:24:48+08:00');
  const range = generateQizhengFlowBirthRange(
    {
      year: 2024,
      month: 2,
      day: 19,
      hour: 11,
      minute: 24,
      second: 48,
      timezone: 8,
      gender: 'male',
      flowYear: 2024,
      flowMonth: 3,
      flowDay: 15,
    },
    {
      startTimestamp,
      endTimestamp: startTimestamp + 2_000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
  );
  const text = formatQizhengBirthRangePrompt(range);
  assert.match(text, /【七政四余流曜与出生区间】/);
  assert.match(text, /2024-03-15/);
  assert.match(text, /周期事件窗口/);
  assert.match(text, /大限/);
  assert.match(text, /小限/);
  assert.match(text, /【时段1】/);
  assert.match(text, /【时段2】/);
  assert.doesNotMatch(text, /流年与行限属于另外/);
  for (const branch of range.branches) {
    for (const item of branch.continuous) assert.ok(text.includes(item.label));
    for (const event of branch.representative.flowingStars!.periodEvents.events) {
      assert.ok(text.includes(event.movingStar));
      if (event.targetStar) assert.ok(text.includes(event.targetStar));
      if (event.aspectDirection) assert.ok(text.includes(`黄经差${event.aspectDirection}`));
    }
  }
  assert.doesNotMatch(text, /calculationContext|startTimestamp|sourceId|mingyu|API|MCP/);
});
