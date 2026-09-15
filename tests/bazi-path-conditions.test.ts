import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';

test('制化来源确定无根时，对象根气待核不能掩盖已失效的必要条件', () => {
  // 合成历法夹具：火无根，丑中辛金为余气；两端条件必须同时成立。
  const chart = baziCalculator.calculateBazi({
    year: 1997,
    month: 1,
    day: 2,
    timeIndex: 1,
    gender: 'male',
  });
  assert.equal(chart.pillars.day.gan, '甲');
  const result = evaluatePatternFulfillment(chart.pillars, '甲', '七杀格', getTenGod);
  const source = result.rootEvidence!.find(
    (item) => item.stem === '丙' && item.placement === '透干',
  );
  const target = result.rootEvidence!.find(
    (item) => item.stem === '庚' && item.placement === '透干',
  );
  assert.equal(source?.rooted, false);
  assert.equal(target?.rooted, true);
  assert.ok(target?.rootPositions.every((position) => position.includes('余气')));
  assert.equal(result.pathEvaluations!.find((path) => path.key === '食神制杀')?.status, '不满足');
});

test('建禄泄秀由日主生食伤，外干不另透比劫也能形成路径', () => {
  const chart = baziCalculator.calculateBazi({
    year: 2056,
    month: 2,
    day: 22,
    timeIndex: 2,
    gender: 'male',
  });
  assert.equal(chart.pillars.day.gan, '甲');
  assert.equal(chart.pillars.month.zhi, '寅');
  assert.ok(
    ['year', 'month', 'hour'].every(
      (position) =>
        !['甲', '乙'].includes(chart.pillars[position as 'year' | 'month' | 'hour'].gan),
    ),
  );
  const result = chart.analysis.mingGe.fulfillment!;
  const path = result.pathEvaluations!.find((item) => item.key === '食伤泄秀')!;
  assert.equal(path.status, '满足');
  assert.deepEqual(path.sourceStems, ['甲']);
  assert.ok(path.targetStems.includes('丙'));
  assert.ok(path.source.every((item) => item.includes('日主')));
  const officerPath = result.pathEvaluations!.find((item) => item.key === '官杀制比劫')!;
  assert.ok(officerPath.sourceStems.includes('庚'));
  assert.deepEqual(officerPath.targetStems, ['甲']);
  const wealthPath = result.pathEvaluations!.find((item) => item.key === '财星承禄劫')!;
  assert.deepEqual(wealthPath.sourceStems, ['甲']);
  assert.ok(wealthPath.targetStems.every((stem) => ['戊', '己'].includes(stem)));
  assert.match(wealthPath.label, /日主克财/);
  assert.equal(result.status, '成格');
  const consumed = chart.analysis.usefulGod.decisionEvidence!.controlFunctions.find(
    (item) => item.key === '食伤泄秀',
  )!;
  assert.deepEqual(consumed.sourceStems, ['甲']);
  assert.ok(consumed.sourceRootEvidence.some((item) => item.tenGod === '日主' && item.rooted));
  assert.ok(!consumed.evidenceGaps.includes('来源根气'));
  assert.match(formatBaziForPrompt(chart), /甲作用于丙/);
});

test('月刃驾刃路径明确不成立时，不适用的待核路径不能改成未判定', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1947,
    month: 3,
    day: 16,
    timeIndex: 11,
    gender: 'male',
  });
  assert.equal(chart.pillars.day.gan, '甲');
  assert.equal(chart.pillars.month.zhi, '卯');
  const result = evaluatePatternFulfillment(chart.pillars, '甲', '月刃格', getTenGod, {
    strengthStatus: chart.analysis.dayMasterStrength.status,
  });
  assert.equal(result.pathEvaluations!.find((path) => path.key === '官杀制比劫')?.status, '不满足');
  assert.ok(result.pathEvaluations!.some((path) => path.status === '资料不足'));
  assert.equal(result.status, '破格');
  assert.match(result.decisionDetail!, /未见有效官杀驾刃/);
});
