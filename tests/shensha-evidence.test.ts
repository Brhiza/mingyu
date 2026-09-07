import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeShenshaEvidence,
  listShenshaCatalog,
  registerShensha,
} from '../packages/core/src/shensha/index.ts';

const context = {
  yearGanZhi: '甲子',
  monthGanZhi: '丙寅',
  dayGanZhi: '戊辰',
  hourGanZhi: '丁酉',
};

test('通用神煞证据应严格核验完整四柱并逐项定位命中柱位', () => {
  const analysis = analyzeShenshaEvidence(context);

  assert.equal(analysis.status, '已核验');
  assert.equal(analysis.pillarFacts.length, 4);
  assert.equal(analysis.calculationSteps.length, 8);
  assert.deepEqual(
    analysis.calculationChain,
    analysis.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(analysis.matchFacts.length, 3);
  assert.deepEqual(analysis.matchFacts.find((item) => item.id === 'kongwang')?.targetBranches, [
    '戌',
    '亥',
  ]);
  assert.equal(analysis.matchFacts.find((item) => item.id === 'kongwang')?.status, '未命中');
  assert.deepEqual(analysis.matchFacts.find((item) => item.id === 'yima')?.matchedPillars, [
    { pillar: 'monthGanZhi', label: '月柱', ganZhi: '丙寅', branch: '寅' },
  ]);
  assert.deepEqual(analysis.matchFacts.find((item) => item.id === 'taohua')?.matchedPillars, [
    { pillar: 'hourGanZhi', label: '时柱', ganZhi: '丁酉', branch: '酉' },
  ]);
  assert.equal(analysis.summaryFact.status, '证据链完整');
  assert.equal(analysis.summaryFact.matchedRuleCount, 2);
  assert.equal(analysis.summaryFact.matchFactCount, analysis.matchFacts.length);
  assert.equal(analysis.summaryFact.limitationFactCount, analysis.limitationFacts.length);
  assert.ok(analysis.matchFacts.every((item) => item.evidenceStatus === '来源已声明'));
  assert.ok(analysis.matchFacts.every((item) => item.ownerStepKeys.length === 2));
  assert.match(analysis.promptText, /【通用神煞资料】/);
  assert.match(analysis.promptText, /【传统依据】/);
  assert.doesNotMatch(
    analysis.promptText,
    /吉凶总分[：=]?\s*\d|成功率[：=]?\s*\d|事件概率[：=]?\s*\d|候选时辰|缺时柱/,
  );
});

test('通用神煞证据应拒绝未知编号、缺柱与非法六十甲子', () => {
  assert.throws(() => analyzeShenshaEvidence(context, ['unknown']), /未注册神煞/);
  assert.throws(
    () => analyzeShenshaEvidence({ ...context, yearGanZhi: '甲丑' }),
    /年柱必须是有效六十甲子/,
  );
  assert.throws(
    () => analyzeShenshaEvidence({ ...context, hourGanZhi: '' }),
    /时柱必须是有效六十甲子/,
  );
  assert.throws(() => analyzeShenshaEvidence(context, []), /至少需要查询一个神煞/);
});

test('动态注册规则未声明来源时应显式保留证据缺口', () => {
  registerShensha({
    id: 'evidence-gap-demo',
    name: '来源缺口示例',
    scope: 'bazi',
    compute: () => ({ id: 'evidence-gap-demo', name: '来源缺口示例', value: '命中' }),
  });

  const catalog = listShenshaCatalog('bazi');
  const catalogItem = catalog.find((item) => item.id === 'evidence-gap-demo');
  assert.equal(catalogItem?.evidenceStatus, '来源未声明');
  assert.deepEqual(catalogItem?.sources, []);

  const analysis = analyzeShenshaEvidence(context, ['evidence-gap-demo']);
  assert.equal(analysis.matchFacts[0]?.status, '命中');
  assert.equal(analysis.matchFacts[0]?.evidenceStatus, '来源未声明');
  assert.equal(analysis.summaryFact.status, '存在来源未声明');
  assert.equal(analysis.summaryFact.undeclaredSourceRuleCount, 1);
  assert.match(analysis.promptText, /未提供公开出处/);
});
