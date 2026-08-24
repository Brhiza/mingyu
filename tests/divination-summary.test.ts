import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateTaiyi } from 'mingyu-core/taiyi';
import { calculateHuangjiJingshi } from 'mingyu-core/huangji-jingshi';
import { getDivinationSummaryBlocks } from '../src/lib/divination/summary';

test('黄历择日摘要应展示候选状态与限制，不暴露内部数字评分', () => {
  const data = generateAlmanacSelection({
    topic: 'contract',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });

  const summary = getDivinationSummaryBlocks('almanac', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /可用候选|条件候选|慎用候选/);
  assert.doesNotMatch(text, /评分\s*-?\d|成功率|匹配率/);
});

test('奇门摘要应把复合格局分数转换为证据条件标签', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));
  const summary = getDivinationSummaryBlocks('qimen', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /复合格局：/);
  assert.match(text, /支持条件较集中|限制条件较集中|支持与限制并存/);
  assert.doesNotMatch(text, /复合格局：[^\n]*（-?\d+）/);
});

test('太乙摘要应显示中文计式名称', () => {
  const data = generateTaiyi({
    scope: 'month',
    date: new Date('2026-07-11T14:35:00+08:00'),
  });
  const summary = getDivinationSummaryBlocks('taiyi', data);

  assert.equal(summary.title, '太乙神数月计结果');
  assert.doesNotMatch(summary.title, /month|day|hour|year/);
});

test('皇极经世摘要应显示周期层级与值年卦关系', () => {
  const data = calculateHuangjiJingshi({ year: 2026 });
  const summary = getDivinationSummaryBlocks('huangji', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.equal(summary.title, '皇极经世结果');
  assert.match(text, /公元2026年/);
  assert.match(text, /天火同人/);
  assert.match(text, /泽风大过.*火风鼎/);
  assert.match(text, /互错综/);
});
