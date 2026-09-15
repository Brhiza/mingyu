import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { analyzeBaziCompatibility } from '../packages/core/src/bazi/compatibilityEvidence';

test('缺时辰不把午时当成出生事实，完整判断只出现在候选中', () => {
  const result = baziCalculator.calculateBazi({ year: 2000, month: 1, day: 7, gender: 'male' });
  assert.equal(result.isThreePillars, true);
  assert.equal(result.pillars.hour.ganZhi, '');
  assert.equal(result.timeInfo.index, -1);
  assert.equal(result.analysis.dayMasterStrength.status, '未知');
  assert.equal(result.analysis.mingGe.pattern, '待补时');
  assert.deepEqual(result.analysis.usefulGod.favorableWuxing, []);
  assert.deepEqual(result.luckInfo.cycles, []);
  assert.equal(result.mingGong, '');
  assert.deepEqual(result.shenShaAnalysis.hour, []);
  assert.equal(result.unknownTimeAnalysis?.scenarios.length, 15);
  const chou = result.unknownTimeAnalysis?.scenarios.find((scenario) => scenario.timeIndex === 1);
  assert.equal(chou?.pillars.hour.ganZhi, '乙丑');
  const explicit = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 1,
    gender: 'male',
  });
  assert.equal(chou?.strength, explicit.analysis.dayMasterStrength.status);
  assert.deepEqual(chou?.favorableWuxing, explicit.analysis.usefulGod.favorableWuxing);
  assert.equal(result.evidenceAnalysis?.status, '存在资料缺口');
  assert.ok(result.evidenceAnalysis?.analysisFacts.every((fact) => fact.status === '资料缺口'));
  assert.doesNotMatch(result.evidenceAnalysis?.calculationChain.join('\n') ?? '', /明确选择的.*午/);
  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /时辰未知/);
  assert.match(prompt, /丑时候选/);
  assert.doesNotMatch(prompt, /【核心判断】|【大运】|命宫:/);
  assert.throws(() => analyzeBaziCompatibility(result, result), /先补齐双方出生时分/);
});

test('未知时辰的晚子日柱与立春交界柱保留为待定', () => {
  const result = baziCalculator.calculateBazi({ year: 2024, month: 2, day: 4, gender: 'female' });
  assert.deepEqual(result.unknownTimeAnalysis?.uncertainPillars, ['year', 'month', 'day']);
  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['', '', '', ''],
  );
  assert.equal(result.mingGua, undefined);
  const years = new Set(
    result.unknownTimeAnalysis?.scenarios.map((scenario) => scenario.pillars.year.ganZhi),
  );
  assert.deepEqual([...years].sort(), ['甲辰', '癸卯'].sort());
});

test('明确丑时仍返回唯一完整命盘，不产生缺时辰候选', () => {
  const result = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    timeIndex: 1,
    gender: 'male',
  });
  assert.equal(result.isThreePillars, false);
  assert.equal(result.unknownTimeAnalysis, undefined);
  assert.equal(result.pillars.hour.ganZhi, '乙丑');
  assert.ok(result.luckInfo.cycles.length > 0);
});

test('日初交立春不能因早子代表在00:30就误认全年柱已确定', () => {
  // 2013年立春为2月4日00:13:25，位于日初与早子代表时刻之间。
  const result = baziCalculator.calculateBazi({ year: 2013, month: 2, day: 4, gender: 'male' });
  assert.equal(result.pillars.year.ganZhi, '');
  assert.equal(result.pillars.month.ganZhi, '');
  assert.equal(result.unknownTimeAnalysis?.scenarios[0].pillars.year.ganZhi, '壬辰');
  assert.equal(result.unknownTimeAnalysis?.scenarios[1].pillars.year.ganZhi, '癸巳');
});

test('公开基础排盘入口不返回缺时辰的午时占位资料', () => {
  assert.throws(
    () => baziCalculator.calculateCoreBazi({ year: 2000, month: 1, day: 7, gender: 'male' }),
    /出生时辰未知.*calculateBazi/,
  );
});

test('非法时辰资料不能静默转成缺时辰模式', () => {
  const person = { year: 2000, month: 1, day: 7, gender: 'male' as const };
  for (const timeIndex of [-2, -0.5, 13, Number.NaN, '1', null]) {
    assert.throws(
      () => baziCalculator.calculateBazi({ ...person, timeIndex: timeIndex as number }),
      /无效的时辰索引/,
    );
  }
  assert.throws(
    () =>
      baziCalculator.calculateBazi({ ...person, isThreePillars: 'false' as unknown as boolean }),
    /时辰未知标志必须是布尔值/,
  );
});
