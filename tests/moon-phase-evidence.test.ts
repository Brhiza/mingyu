import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMoonPhaseEvidence } from '../packages/core/src/calendar/moon-phase-evidence.ts';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';

const MINUTE = 60_000;

test('月相证据应识别2024年4月日食附近的朔并保留精度限制', () => {
  const evidence = calculateMoonPhaseEvidence(Date.parse('2024-04-08T18:21:00Z'));

  assert.equal(evidence.eightPhaseName, '新月');
  assert.ok(evidence.elongationDegrees < 0.1);
  assert.ok(evidence.illuminationPercent < 0.01);
  assert.equal(evidence.nextPrincipalPhase.name, '朔');
  assert.match(evidence.nextPrincipalPhase.key, /^四正月相:朔:/);
  assert.ok(evidence.nextPrincipalPhase.sources.length >= 2);
  assert.match(evidence.nextPrincipalPhase.calculation, /二分求根/);
  assert.match(evidence.nextPrincipalPhase.promptText, /目标日月黄经差0°/);
  assert.match(evidence.nextPrincipalPhase.limitation, /不等于观测级精度/);
  assert.ok(
    Math.abs(evidence.nextPrincipalPhase.utcTimestamp - Date.parse('2024-04-08T18:22:28Z')) <
      2 * MINUTE,
  );
  assert.match(evidence.promptText, /求根到 1 秒只表示数值区间/);
  assert.match(evidence.promptText, /不得用于月食可见性判断/);
});

test('月相证据应区分望、上弦、下弦及盈亏方向', () => {
  const fullMoon = calculateMoonPhaseEvidence(Date.parse('2024-03-25T07:00:00Z'));
  const firstQuarter = calculateMoonPhaseEvidence(Date.parse('2024-04-15T19:13:00Z'));
  const lastQuarter = calculateMoonPhaseEvidence(Date.parse('2024-04-02T03:15:00Z'));

  assert.equal(fullMoon.eightPhaseName, '满月');
  assert.ok(Math.abs(fullMoon.phaseAngleDegrees - 180) < 0.1);
  assert.ok(fullMoon.illuminationPercent > 99.99);
  assert.equal(firstQuarter.eightPhaseName, '上弦月');
  assert.equal(firstQuarter.waxing, true);
  assert.ok(Math.abs(firstQuarter.phaseAngleDegrees - 90) < 0.1);
  assert.equal(lastQuarter.eightPhaseName, '下弦月');
  assert.equal(lastQuarter.waxing, false);
  assert.ok(Math.abs(lastQuarter.phaseAngleDegrees - 270) < 0.1);
});

test('一般日期的月相证据应由前后四正相位稳定包围', () => {
  const timestamp = Date.parse('2024-04-12T12:00:00Z');
  const evidence = calculateMoonPhaseEvidence(timestamp);

  assert.ok(evidence.previousPrincipalPhase.utcTimestamp < timestamp);
  assert.ok(evidence.nextPrincipalPhase.utcTimestamp > timestamp);
  assert.ok(evidence.previousPrincipalPhase.residualDegrees < 0.001);
  assert.ok(evidence.nextPrincipalPhase.residualDegrees < 0.001);
  assert.ok(
    [evidence.previousPrincipalPhase, evidence.nextPrincipalPhase].every(
      (item) =>
        item.key.startsWith('四正月相:') &&
        item.sources.length >= 2 &&
        item.promptText.includes('求根残差') &&
        item.limitation.includes('不证明月食可见性'),
    ),
  );
  assert.ok(evidence.approximateMoonAgeDays > 0);
  assert.ok(evidence.approximateMoonAgeDays < 29.530588861);
});

test('月相证据应拒绝无效时间戳和超出支持范围的年份', () => {
  assert.throws(() => calculateMoonPhaseEvidence(Number.NaN), /有效的 UTC 时间戳/);
  assert.throws(
    () => calculateMoonPhaseEvidence(Date.parse('1899-12-31T00:00:00Z')),
    /支持 1900-2200 年/,
  );
  assert.throws(
    () => calculateMoonPhaseEvidence(Date.parse('2201-01-01T00:00:00Z')),
    /支持 1900-2200 年/,
  );
});

test('奇门和七政四余应携带月相证据且不将其解释为吉凶', () => {
  const qimen = generateQimen(new Date('2024-04-08T18:21:00Z'));
  const qizheng = generateQizheng({
    year: 2024,
    month: 4,
    day: 9,
    hour: 2,
    minute: 21,
    timezone: 8,
  });

  assert.equal(qimen.seasonality?.moonPhaseEvidence.eightPhaseName, '新月');
  assert.equal(typeof qimen.seasonality?.lunarPhaseConsistency, 'boolean');
  assert.equal(qizheng.calculationContext.moonPhase.eightPhaseName, '新月');
  assert.match(qizheng.prompt, /月相证据：/);
  assert.match(qizheng.evidenceAnalysis.methodology.join(''), /不把月相直接解释为吉凶/);
  assert.doesNotMatch(qizheng.prompt, /月相吉凶|月相评分|月相成功率/);
});
