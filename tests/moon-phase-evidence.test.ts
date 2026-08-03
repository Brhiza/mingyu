import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMoonPhaseEvidence } from '../packages/core/src/calendar/moon-phase-evidence.ts';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';

const MINUTE = 60_000;

function assertEvidenceReferences(evidence: ReturnType<typeof calculateMoonPhaseEvidence>) {
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.principalEventCount, 2);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.ok(evidence.eventSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    [evidence.previousPrincipalPhase, evidence.nextPrincipalPhase].every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.calculationStepKeys.join('|'),
    ),
  );
  assert.ok(
    evidence.eventSummaryFact.ownerFactKeys.length > 0 &&
      evidence.eventSummaryFact.ownerFactKeys.every((key) => factKeys.has(key)),
  );
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
    ),
  );
}

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
  assert.equal(evidence.key, `moon-phase:${Date.parse('2024-04-08T18:21:00Z')}`);
  assert.equal(evidence.status, '已计算');
  assert.deepEqual(
    evidence.calculationSteps.map((item) => item.stage),
    ['日月位置', '月相角与照明', '前一四正相位', '下一四正相位'],
  );
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(evidence.previousPrincipalPhase.status, '已求根');
  assert.equal(evidence.nextPrincipalPhase.status, '已求根');
  assert.deepEqual(evidence.previousPrincipalPhase.calculationStepKeys, [
    evidence.calculationSteps[2].key,
  ]);
  assert.deepEqual(evidence.nextPrincipalPhase.calculationStepKeys, [
    evidence.calculationSteps[3].key,
  ]);
  assert.equal(evidence.eventSummaryFact.previousEventKey, evidence.previousPrincipalPhase.key);
  assert.equal(evidence.eventSummaryFact.nextEventKey, evidence.nextPrincipalPhase.key);
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assertEvidenceReferences(evidence);
  assert.ok(
    [...evidence.calculationSteps, evidence.eventSummaryFact, ...evidence.limitationFacts].every(
      (item) => item.sources.length > 0 && item.limitation.length > 0,
    ),
  );
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
  assertEvidenceReferences(evidence);
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

test('奇门应携带月相证据且不将其解释为吉凶', () => {
  const qimen = generateQimen(new Date('2024-04-08T18:21:00Z'));

  assert.equal(qimen.seasonality?.moonPhaseEvidence.eightPhaseName, '新月');
  assert.equal(typeof qimen.seasonality?.lunarPhaseConsistency, 'boolean');
});
