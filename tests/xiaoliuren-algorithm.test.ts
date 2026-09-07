import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  analyzeXiaoliurenEvidence,
  generateXiaoliuren,
} from '../packages/core/src/divination/algorithms/xiaoliuren.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const PALACE_NAMES = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'] as const;

test('小六壬：古法二月例、闰月与子时边界保持同一偏移，旧盘沿用通行法', () => {
  const secondMonth = generateXiaoliuren({
    rule: 'duoneng',
    customDate: new Date('2025-02-28T00:30:00+08:00'),
  });
  assert.equal(secondMonth.lunarMonth, 2);
  assert.equal(secondMonth.lunarDay, 1);
  assert.equal(secondMonth.primary.name, '速喜');
  for (const time of [
    '2025-07-25T08:00:00+08:00',
    '2025-06-29T23:00:00+08:00',
    '2025-06-30T00:00:00+08:00',
  ]) {
    const customDate = new Date(time);
    const common = generateXiaoliuren({ customDate });
    const old = { ...common };
    delete old.rule;
    delete old.ruleLabel;
    assert.deepEqual(analyzeXiaoliurenEvidence(old), common.evidenceAnalysis);
    const ancient = generateXiaoliuren({ customDate, rule: 'duoneng' });
    assert.equal(ancient.primary.index, (common.primary.index + 1) % 6);
    assert.equal(ancient.lunarDay, common.lunarDay);
    assert.equal(ancient.isLeapMonth, common.isLeapMonth);
  }
});

test('小六壬：多能鄙事正月初一十二时辰与扫描例题一致', () => {
  const names = ['留连', '速喜', '赤口', '小吉', '空亡', '大安'];
  for (let i = 0; i < 12; i++) {
    const customDate = new Date(Date.parse('2025-01-29T00:30:00+08:00') + i * 7200000);
    const data = generateXiaoliuren({ rule: 'duoneng', customDate });
    const common = generateXiaoliuren({ customDate });
    assert.equal(data.lunarMonth, 1);
    assert.equal(data.lunarDay, 1);
    assert.equal(data.sequence.month.name, '大安');
    assert.equal(data.sequence.day.name, '留连');
    assert.equal(data.primary.name, names[i % 6]);
    assert.equal(data.primary.index, (common.primary.index + 1) % 6);
    assert.equal(data.ruleLabel, '《多能鄙事》');
    assert.match(data.evidenceAnalysis!.promptText, /多能鄙事/);
    assert.doesNotMatch(data.evidenceAnalysis!.promptText, /通行俗传/);
    assert.match(data.evidenceAnalysis!.calculationSteps[1]!.formula, /下一宫起初一/);
  }
  for (const rule of ['unknown', null, false, ['duoneng']]) {
    assert.throws(() => generateXiaoliuren({ rule } as never), /起课口径/);
  }
});
const FORBIDDEN_EXTENSIONS =
  /起因.{0,12}过程.{0,12}结果|五行推进|月令旺衰|日干六亲|旬空|驿马|桃花|固定应期|华山派完整课/;

test('小六壬：修改已返回宫位不会污染后续起课及同盘其他宫位', () => {
  const params = { customDate: new Date('2025-06-29T08:00:00+08:00') };
  const baseline = generateXiaoliuren(params);
  const expected = structuredClone(baseline);
  const palaces = [
    baseline.sequence.month,
    baseline.sequence.day,
    baseline.sequence.hour,
    baseline.primary,
    ...baseline.palaceOrder,
  ];
  const originals = palaces.map((palace) => ({ ...palace }));
  try {
    baseline.primary.verse = '修改后的歌诀';
    assert.deepEqual(baseline.sequence.hour, expected.sequence.hour);
    for (const palace of palaces) {
      palace.verse = '修改后的歌诀';
      palace.index = 99;
    }
    const next = generateXiaoliuren(params);
    assert.deepEqual(next.sequence, expected.sequence);
    assert.deepEqual(next.primary, expected.primary);
    assert.deepEqual(next.palaceOrder, expected.palaceOrder);
    assert.deepEqual(next.evidenceAnalysis, expected.evidenceAnalysis);
  } finally {
    palaces.forEach((palace, index) => Object.assign(palace, originals[index]));
  }
});

test('小六壬：六宫顺序和通行歌诀应完整且稳定', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });

  assert.deepEqual(
    data.palaceOrder.map((palace) => palace.name),
    PALACE_NAMES,
  );
  assert.deepEqual(
    data.palaceOrder.map((palace) => palace.index),
    [0, 1, 2, 3, 4, 5],
  );
  assert.ok(data.palaceOrder.every((palace) => palace.verse.length >= 30));
  assert.match(data.palaceOrder[0]?.verse ?? '', /^大安事事昌/);
  assert.match(data.palaceOrder[5]?.verse ?? '', /^空亡事不祥/);
});

test('小六壬：农历六月初五辰时通行样例应为月空亡、日赤口、时留连', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });

  assert.equal(data.lunarMonth, 6);
  assert.equal(data.lunarDay, 5);
  assert.equal(data.hourLabel, '辰时');
  assert.equal(data.calculation.hourNumber, 5);
  assert.equal(data.sequence.month.name, '空亡');
  assert.equal(data.sequence.day.name, '赤口');
  assert.equal(data.sequence.hour.name, '留连');
  assert.equal(data.primary.name, '留连');
});

test('小六壬：晚子时按子一计数，但农历日到零点才换日', () => {
  const beforeZi = generateXiaoliuren({
    customDate: new Date('2025-06-29T22:59:00+08:00'),
  });
  const lateZi = generateXiaoliuren({ customDate: new Date('2025-06-29T23:00:00+08:00') });
  const earlyZi = generateXiaoliuren({ customDate: new Date('2025-06-30T00:00:00+08:00') });
  const chou = generateXiaoliuren({ customDate: new Date('2025-06-30T01:00:00+08:00') });

  assert.equal(beforeZi.hourLabel, '亥时');
  assert.equal(beforeZi.calculation.hourNumber, 12);
  assert.equal(lateZi.hourLabel, '晚子时');
  assert.equal(lateZi.calculation.hourNumber, 1);
  assert.equal(lateZi.lunarDay, 5);
  assert.equal(earlyZi.hourLabel, '早子时');
  assert.equal(earlyZi.calculation.hourNumber, 1);
  assert.equal(earlyZi.lunarDay, 6);
  assert.equal(chou.hourLabel, '丑时');
  assert.equal(chou.calculation.hourNumber, 2);
  assert.equal(lateZi.calculation.dayBoundary, '东八区民用日零点换日');
});

test('小六壬：闰月沿用同名月序并显式标注口径', () => {
  const regularMonth = generateXiaoliuren({
    customDate: new Date('2025-06-25T08:00:00+08:00'),
  });
  const leapMonth = generateXiaoliuren({
    customDate: new Date('2025-07-25T08:00:00+08:00'),
  });

  assert.equal(regularMonth.lunarMonth, 6);
  assert.equal(regularMonth.isLeapMonth, false);
  assert.equal(leapMonth.lunarMonth, 6);
  assert.equal(leapMonth.isLeapMonth, true);
  assert.equal(leapMonth.sequence.month.name, regularMonth.sequence.month.name);
  assert.equal(leapMonth.calculation.leapMonthRule, '闰月沿用同名月序');
});

test('小六壬：只有时宫是主证，月宫和日宫必须标为计算轨迹', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.deepEqual(
    evidence.palaceFacts.map((fact) => [fact.role, fact.level]),
    [
      ['月宫', '计算轨迹'],
      ['日宫', '计算轨迹'],
      ['时宫', '主证'],
    ],
  );
  assert.equal(evidence.primaryFact.key, 'xiaoliuren:palace:hour');
  assert.equal(evidence.primaryFact.palace.name, data.primary.name);
  assert.match(evidence.limitations.join('\n'), /月宫和日宫只是顺数中间位置/);
  assert.match(evidence.limitations.join('\n'), /歌诀是传统分类文本，不是现实事实/);
});

test('小六壬：证据步骤依赖与限制归属应全部闭合', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });
  const evidence = data.evidenceAnalysis;
  assert.ok(evidence);

  const stepKeys = new Set(evidence.calculationSteps.map((step) => step.key));
  assert.ok(
    evidence.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((dependency) => stepKeys.has(dependency)),
    ),
  );
  const factKeys = new Set([
    evidence.calculationFact.key,
    ...evidence.calculationSteps.map((step) => step.key),
    ...evidence.palaceFacts.map((fact) => fact.key),
  ]);
  assert.ok(
    evidence.limitationFacts.every(
      (fact) =>
        fact.ownerFactKeys.length > 0 &&
        fact.ownerFactKeys.every((ownerKey) => factKeys.has(ownerKey)),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assertPromptIsPortableTaskText(evidence.promptText);
});

test('小六壬：来源限制必须明确，提示词不得恢复无来源扩展', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });
  const evidenceText = data.evidenceAnalysis?.promptText ?? '';
  const limitationText = data.evidenceAnalysis?.limitations.join('\n') ?? '';

  assert.match(evidenceText, /通行俗传小六壬掌诀/);
  assert.match(limitationText, /署名不作为已证实的古籍归属/);
  assert.match(limitationText, /多能鄙事.*正月初一留连起子时/);
  assert.match(limitationText, /通行掌诀正月初一大安起子时的起日口径不同/);
  assert.ok(
    data.evidenceAnalysis?.limitationFacts
      .find((fact) => fact.type === '来源边界')
      ?.sources.some((source) => source.includes('第196—197页')),
  );
  assert.doesNotMatch(data.primary.verse, FORBIDDEN_EXTENSIONS);
  assert.match(limitationText, /未采用无可核验出处的华山派完整课/);
  const { evidenceAnalysis: _evidenceAnalysis, ...chartData } = data;
  assert.doesNotMatch(JSON.stringify(chartData), FORBIDDEN_EXTENSIONS);
  assert.ok(
    data.evidenceAnalysis?.limitationFacts
      .find((fact) => fact.type === '扩展规则边界')
      ?.promptText.startsWith('未采用'),
  );
});

test('小六壬：非时间起课必须明确拒绝', () => {
  assert.throws(
    () =>
      generateXiaoliuren({
        method: 'number' as never,
        customDate: new Date('2025-06-29T08:00:00+08:00'),
      }),
    /仅保留有明确顺数规则的时间起课/,
  );
});

test('小六壬：缺少计算参数时证据不得伪装成可复核', () => {
  const data = generateXiaoliuren({ customDate: new Date('2025-06-29T08:00:00+08:00') });
  const incomplete = { ...data, calculation: undefined } as unknown as Parameters<
    typeof analyzeXiaoliurenEvidence
  >[0];
  const evidence = analyzeXiaoliurenEvidence(incomplete);

  assert.equal(evidence.calculationFact.status, '缺少中间参数');
  assert.equal(evidence.calculationSteps.length, 0);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.match(evidence.calculationFact.promptText, /不能复核落宫/);
});
