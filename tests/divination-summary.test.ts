import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
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

test('小六壬摘要应展示时宫主证和顺数轨迹', () => {
  const data = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });
  const summary = getDivinationSummaryBlocks('xiaoliuren', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /时宫留连|占得宫：留连/);
  assert.match(text, /月宫空亡.*日宫赤口.*时宫留连/);
  assert.match(text, /零点换日|闰月沿用同名月序/);
  assert.doesNotMatch(text, /起因|过程|五行推进|月令旺衰|六亲|旬空|驿马|桃花/);
});

test('雷诺曼摘要应使用关键词核验范围而非原始牌义断语', () => {
  const data = drawLenormandSpread('three', { seed: '摘要条件化样例' });
  const summary = getDivinationSummaryBlocks('lenormand', data);
  const text = [...summary.tags, ...summary.lines].join('\n');

  assert.match(text, /传统单牌|解释范围|现实线索/);
  for (const card of data.cards) assert.doesNotMatch(text, new RegExp(card.meaning));
});
