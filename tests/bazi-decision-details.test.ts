import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziDecisionDetails } from '../src/lib/bazi-decision-details';

test('展示依据保留旺衰、格局成败及调候与扶抑区别', () => {
  const result = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
  });
  const text = formatBaziDecisionDetails(result).join('\n');
  assert.match(text, /取用基线：.*扶抑，喜/);
  assert.ok(text.includes(result.analysis.mingGe.basis!));
  assert.ok(text.includes(result.analysis.dayMasterStrength.details.ruleBasis[0]));
  for (const condition of result.analysis.mingGe.fulfillment?.conditionFacts ?? []) {
    assert.ok(text.includes(`成格条件（${condition.status}）：${condition.detail}`));
  }
  assert.match(text, /调候参考次序：/);
  assert.match(text, /日柱甲与时柱己/);
  assert.doesNotMatch(
    JSON.stringify(result.analysis.mingGe.fulfillment),
    /(?:year|month|day|hour)[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/,
  );
  assert.doesNotMatch(text, /ruleId|within-balance|wei-month-jia|day甲|hour己|小数总分/);
});

test('展示依据完整保留旺衰裁决的每条规则依据', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 8,
    gender: 'female',
    isLunar: false,
  });
  const details = formatBaziDecisionDetails(result);
  const strengthBasis = result.analysis.dayMasterStrength.details.ruleBasis.filter(Boolean);
  const displayBasis = details.filter((line) => line.startsWith('旺衰依据：'));

  assert.ok(strengthBasis.length > 1);
  assert.equal(displayBasis.length, strengthBasis.length);
  assert.match(displayBasis[0] ?? '', /旺衰依据：/);
  assert.match(displayBasis.join('\n'), /机械分数/);
  assert.doesNotMatch(
    displayBasis.join('\n'),
    /ruleId|within-balance|wei-month-jia|day甲|hour己|小数总分/,
  );
});

test('成格名称与成败状态分别保留，待核条件和反证不会被隐藏', () => {
  const result = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
  });
  result.analysis.mingGe.fulfillment = {
    patternName: '正财格',
    status: '未判定',
    basis: '月令取格',
    summary: '救应条件待核',
    contradiction: '财星受合绊',
    remedies: [
      {
        stem: '壬',
        pillar: 'hour',
        tenGod: '正印',
        effect: '印星护官',
        placement: '透干',
      },
    ],
    conditionFacts: [
      { key: 'private-root-key', status: '资料不足', detail: '根气尚待核对' },
      { key: 'private-path-key', status: '不满足', detail: '作用路径未成立' },
    ],
    pathEvaluations: [
      {
        key: 'private-path-evaluation',
        label: '印星护官',
        status: '资料不足',
        source: ['时柱壬（正印）'],
        target: ['年柱庚（正官）'],
        sourceStems: ['壬'],
        targetStems: ['庚'],
        position: '未判定',
        positionPairs: [],
        detail: '位置与根气尚待核对',
      },
    ],
  };
  const text = formatBaziDecisionDetails(result).join('\n');
  assert.match(text, /格局成败：未判定；救应条件待核/);
  assert.match(text, /成格条件（资料不足）：根气尚待核对/);
  assert.match(text, /成格条件（不满足）：作用路径未成立/);
  assert.match(text, /制化路径（资料不足）：印星护官（未判定）；位置与根气尚待核对/);
  assert.match(text, /候选取用：印星护官/);
  assert.match(text, /格局反证：财星受合绊/);
  assert.doesNotMatch(text, /private-root-key|private-path-key/);
});
