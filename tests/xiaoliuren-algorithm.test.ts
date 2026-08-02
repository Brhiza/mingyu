import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  analyzeXiaoliurenEvidence,
  generateXiaoliuren,
  rebuildAuditedXiaoliurenData,
} from '../packages/core/src/divination/algorithms/xiaoliuren.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const FORBIDDEN_OUTPUT = /大安事事昌|留连事难成|速喜喜来临|赤口主口舌|小吉最吉昌|空亡事不祥/;

test('小六壬：只输出可复核的时间、历法和时辰原始事实', () => {
  const data = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });

  assert.equal(data.lunarMonth, 6);
  assert.equal(data.lunarDay, 5);
  assert.equal(data.hourLabel, '辰时');
  assert.equal(data.calculation.hourNumber, 5);
  assert.equal(data.calculation.dayBoundary, '东八区民用日零点换日');
  assert.equal(data.calculation.leapMonthRule, '闰月沿用同名月序');
  assert.equal('sequence' in data, false);
  assert.equal('primary' in data, false);
  assert.equal('palaceOrder' in data, false);
  assert.doesNotMatch(JSON.stringify(data), FORBIDDEN_OUTPUT);
});

test('小六壬：二十四个民用小时均映射到子1至亥12的原始时辰序号', () => {
  const expected = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 1];
  for (let hour = 0; hour < 24; hour += 1) {
    const date = new Date(`2025-06-29T${String(hour).padStart(2, '0')}:30:00+08:00`);
    assert.equal(
      generateXiaoliuren({ method: 'time', customDate: date }).calculation.hourNumber,
      expected[hour],
    );
  }
});

test('小六壬：晚子时按子一记录，但农历日到零点才换日', () => {
  const beforeZi = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T22:59:00+08:00'),
  });
  const lateZi = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T23:00:00+08:00'),
  });
  const earlyZi = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-30T00:00:00+08:00'),
  });

  assert.equal(beforeZi.calculation.hourNumber, 12);
  assert.equal(lateZi.hourLabel, '晚子时');
  assert.equal(lateZi.calculation.hourNumber, 1);
  assert.equal(lateZi.lunarDay, 5);
  assert.equal(earlyZi.hourLabel, '早子时');
  assert.equal(earlyZi.calculation.hourNumber, 1);
  assert.equal(earlyZi.lunarDay, 6);
});

test('小六壬：闰月只作为原始历法事实并显式标注当前口径', () => {
  const regularMonth = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-25T08:00:00+08:00'),
  });
  const leapMonth = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-07-25T08:00:00+08:00'),
  });

  assert.equal(regularMonth.lunarMonth, 6);
  assert.equal(regularMonth.isLeapMonth, false);
  assert.equal(leapMonth.lunarMonth, 6);
  assert.equal(leapMonth.isLeapMonth, true);
  assert.equal(leapMonth.calculation.leapMonthRule, '闰月沿用同名月序');
});

test('小六壬：底本未闭合时证据必须失败关闭', () => {
  const data = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });
  const evidence = data.evidenceAnalysis;
  assert.ok(evidence);

  assert.equal(evidence.status, '资料不足');
  assert.equal(evidence.calculationFact.status, '规则待校');
  assert.equal(evidence.calculationSteps.length, 0);
  assert.equal(evidence.palaceFacts.length, 0);
  assert.equal(evidence.primaryFact, null);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.match(evidence.promptText, /固定底本、具体版本和页码/);
  assert.match(evidence.promptText, /本次不自动顺数、不提供落宫结论或六宫歌诀/);
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('小六壬：非时间起课必须明确拒绝', () => {
  assert.throws(
    () => generateXiaoliuren({ method: 'number' as never }),
    /只保留时间原始事实，不支持其他起课方式/,
  );
});

test('小六壬：审核重建只认时间戳，不吸收旧落宫、歌诀或证据污染', () => {
  const clean = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });
  const polluted = structuredClone(clean) as typeof clean & Record<string, unknown>;
  polluted.methodLabel = '伪造起课法';
  polluted.ganzhi.day = '甲子';
  polluted.lunarMonth = 1;
  polluted.sequence = { month: '伪造月宫', day: '伪造日宫', hour: '伪造时宫' };
  polluted.primary = { name: '伪造占得宫', verse: '留连事难成' };
  polluted.evidenceAnalysis!.promptText = '伪造旧证据';

  assert.deepEqual(rebuildAuditedXiaoliurenData(clean), clean);
  assert.deepEqual(rebuildAuditedXiaoliurenData(polluted), clean);
  assert.deepEqual(analyzeXiaoliurenEvidence(polluted), clean.evidenceAnalysis);
});

test('小六壬：审核重建应拒绝非法原始来源', () => {
  const data = generateXiaoliuren({
    method: 'time',
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });

  assert.throws(
    () => rebuildAuditedXiaoliurenData(null as unknown as typeof data),
    /结果必须是对象/,
  );
  assert.throws(
    () => rebuildAuditedXiaoliurenData({ ...data, timestamp: Number.NaN }),
    /时间戳无效/,
  );
  assert.throws(
    () => rebuildAuditedXiaoliurenData({ ...data, method: 'number' as typeof data.method }),
    /未知的小六壬起课方式/,
  );
  assert.throws(
    () => rebuildAuditedXiaoliurenData({ ...data, randomTrace: { samples: [0.5] } } as typeof data),
    /不应携带随机轨迹/,
  );
});
