import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAstronomicalTimeEvidence, estimateDeltaTSeconds } from 'mingyu-core/calendar';

function assertEvidenceReferences(evidence: ReturnType<typeof buildAstronomicalTimeEvidence>) {
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(evidence.summaryFact.factKeys.length > 0);
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.assumptionFactCount, evidence.assumptionFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.ok(
    [
      ...evidence.assumptionFacts,
      ...evidence.counterEvidenceFacts,
      ...evidence.limitationFacts,
    ].every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
    ),
  );
}

test('天文时间尺度应以 J2000.0 校验 UTC 儒略日', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    timezone: 0,
  });

  assert.equal(evidence.utcDateTime, '2000-01-01 12:00:00Z');
  assert.equal(evidence.julianDayUtc, 2451545);
  assert.equal(evidence.julianDayUtApprox, 2451545);
  assert.ok(evidence.julianDayTtApprox > evidence.julianDayUtc);
  assert.match(evidence.promptText, /UT1≈UTC/);
  assert.match(evidence.promptText, /不自动推断地点历史时区/);
  assert.equal(evidence.key, 'astronomical-time:2000-01-01 12:00:00:0');
  assert.equal(evidence.status, '已计算');
  assert.deepEqual(
    evidence.calculationSteps.map((item) => item.stage),
    ['时区解析', 'UTC换算', 'UTC儒略日', 'UT1近似', 'ΔT与TT'],
  );
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.deepEqual(evidence.calculationSteps[1].dependsOnStepKeys, [
    evidence.calculationSteps[0].key,
  ]);
  assert.deepEqual(evidence.calculationSteps[4].dependsOnStepKeys, [
    evidence.calculationSteps[3].key,
  ]);
  assert.equal(evidence.assumptions.length, evidence.assumptionFacts.length);
  assert.equal(evidence.counterEvidence.length, evidence.counterEvidenceFacts.length);
  assert.deepEqual(
    evidence.counterSummaryFact.factKeys,
    evidence.counterEvidenceFacts.map((item) => item.key),
  );
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.equal(evidence.summaryFact.status, '民用时间链完整');
  assertEvidenceReferences(evidence);
  assert.ok(
    [
      ...evidence.calculationSteps,
      ...evidence.assumptionFacts,
      ...evidence.counterEvidenceFacts,
      evidence.counterSummaryFact,
      ...evidence.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
});

test('天文时间尺度应正确把当地钟表时间换算为 UTC', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 2026,
    month: 7,
    day: 14,
    hour: 8,
    minute: 30,
    timezone: 8,
  });

  assert.equal(evidence.utcDateTime, '2026-07-14 00:30:00Z');
  assert.equal(evidence.precisionLevel, '近现代估算');
  assert.ok(evidence.deltaTSeconds > 60 && evidence.deltaTSeconds < 100);
  assert.match(evidence.source, /Espenak-Meeus/);
});

test('ΔT 长期年份应明确标为外推并拒绝越界年份', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 2180,
    month: 1,
    day: 1,
    timezone: 0,
  });

  assert.equal(evidence.precisionLevel, '长期外推');
  assert.equal(evidence.summaryFact.status, '含长期外推');
  assertEvidenceReferences(evidence);
  assert.throws(() => estimateDeltaTSeconds(1899), /1900-2200/);
  assert.throws(
    () =>
      buildAstronomicalTimeEvidence({
        year: 2026,
        month: 2,
        day: 30,
        timezone: 8,
      }),
    /不存在第30日/,
  );
});

test('天文时间汇总应拒绝歧义与冲突，并接受明确固定偏移消歧', () => {
  assert.throws(
    () =>
      buildAstronomicalTimeEvidence({
        year: 2024,
        month: 11,
        day: 3,
        hour: 1,
        minute: 30,
        timeZoneId: 'America/New_York',
      }),
    /回拨歧义.*timezone/,
  );
  assert.throws(
    () =>
      buildAstronomicalTimeEvidence({
        year: 1990,
        month: 7,
        day: 1,
        hour: 12,
        timeZoneId: 'Asia/Shanghai',
        timezone: 8,
      }),
    /固定偏移.*历史偏移不一致/,
  );
  const resolved = buildAstronomicalTimeEvidence({
    year: 2024,
    month: 11,
    day: 3,
    hour: 1,
    minute: 30,
    timeZoneId: 'America/New_York',
    timezone: -5,
  });

  assert.equal(resolved.utcDateTime, '2024-11-03 06:30:00Z');
  assert.equal(resolved.summaryFact.status, '历史时区歧义已消解');
  assert.ok(
    resolved.summaryFact.factKeys.includes(resolved.timezoneEvidence?.summaryFact.key ?? ''),
  );
  assertEvidenceReferences(resolved);
  assert.match(resolved.promptText, /证据汇总：天文时间证据状态为历史时区歧义已消解/);
});
