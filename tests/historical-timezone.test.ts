import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAstronomicalTimeEvidence, resolveHistoricalTimezone } from 'mingyu-core/calendar';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { generateQizheng } from 'mingyu-core/qizheng';

function assertEvidenceReferences(evidence: ReturnType<typeof resolveHistoricalTimezone>) {
  const factKeys = new Set([
    evidence.summaryFact.key,
    ...evidence.calculationSteps.map((item) => item.key),
    ...evidence.diagnosticFacts.map((item) => item.key),
    evidence.diagnosticSummaryFact.key,
    ...evidence.limitationFacts.map((item) => item.key),
  ]);
  assert.ok(
    evidence.diagnosticFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
    ),
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

test('IANA 历史时区应识别中国 1990 年夏令时', () => {
  const evidence = resolveHistoricalTimezone({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: 'Asia/Shanghai',
  });

  assert.equal(evidence.status, 'unique');
  assert.equal(evidence.resolvedOffsetHours, 9);
  assert.equal(evidence.selectedUtcDateTime, '1990-07-01T03:00:00.000Z');
  assert.equal(evidence.key, 'historical-timezone:Asia/Shanghai:1990-07-01 12:00:00');
  assert.deepEqual(
    evidence.calculationSteps.map((item) => item.stage),
    ['时区规则加载', '候选偏移采样', '当地时刻匹配', '偏移核验'],
  );
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(evidence.calculationSteps[2].status, '已匹配');
  assert.equal(evidence.diagnosticFacts[0].status, '唯一映射');
  assert.equal(evidence.diagnosticFacts[1].status, '未核验');
  assert.equal(evidence.diagnosticSummaryFact.status, '唯一映射且未核验固定偏移');
  assert.deepEqual(
    evidence.diagnosticSummaryFact.factKeys,
    evidence.diagnosticFacts.map((item) => item.key),
  );
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.equal(evidence.summaryFact.status, evidence.diagnosticSummaryFact.status);
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.diagnosticFactCount, evidence.diagnosticFacts.length);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.deepEqual(evidence.summaryFact.factKeys, [
    ...evidence.calculationSteps.map((item) => item.key),
    ...evidence.diagnosticFacts.map((item) => item.key),
    evidence.diagnosticSummaryFact.key,
    ...evidence.limitationFacts.map((item) => item.key),
  ]);
  assertEvidenceReferences(evidence);
  assert.ok(
    [
      ...evidence.calculationSteps,
      ...evidence.diagnosticFacts,
      evidence.diagnosticSummaryFact,
      evidence.summaryFact,
      ...evidence.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
});

test('IANA 历史时区应识别普通唯一时刻与固定偏移冲突', () => {
  const current = resolveHistoricalTimezone({
    year: 2026,
    month: 7,
    day: 14,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: 'Asia/Shanghai',
  });
  assert.equal(current.resolvedOffsetHours, 8);

  const historical = resolveHistoricalTimezone({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
    timeZoneId: 'Asia/Shanghai',
    fixedOffsetHours: 8,
  });
  assert.equal(historical.offsetConflict, true);
  assert.match(historical.diagnostics.join('；'), /UTC\+8.*UTC\+9/);
  assert.equal(historical.calculationSteps[3].status, '存在冲突');
  assert.equal(historical.diagnosticFacts[1].status, '存在冲突');
  assert.equal(historical.diagnosticSummaryFact.status, '唯一但偏移冲突');
  assert.equal(historical.summaryFact.status, '唯一但偏移冲突');
});

test('IANA 历史时区应保留纽约秋季回拨的两个候选时刻', () => {
  const evidence = resolveHistoricalTimezone({
    year: 2024,
    month: 11,
    day: 3,
    hour: 1,
    minute: 30,
    second: 0,
    timeZoneId: 'America/New_York',
  });

  assert.equal(evidence.status, 'ambiguous');
  assert.deepEqual(evidence.possibleOffsetsHours, [-4, -5]);
  assert.deepEqual(evidence.possibleUtcDateTimes, [
    '2024-11-03T05:30:00.000Z',
    '2024-11-03T06:30:00.000Z',
  ]);
  assert.equal(evidence.calculationSteps[2].status, '存在歧义');
  assert.equal(evidence.diagnosticFacts[0].status, '存在回拨歧义');
  assert.equal(evidence.diagnosticSummaryFact.status, '存在回拨歧义且未核验固定偏移');
  assert.equal(evidence.summaryFact.status, '存在回拨歧义且未核验固定偏移');
  assert.equal(evidence.diagnosticSummaryFact.factKeys.length, 2);
  assertEvidenceReferences(evidence);
});

test('固定偏移应选择秋季回拨时间中对应的唯一候选', () => {
  const daylight = resolveHistoricalTimezone({
    year: 2024,
    month: 11,
    day: 3,
    hour: 1,
    minute: 30,
    second: 0,
    timeZoneId: 'America/New_York',
    fixedOffsetHours: -4,
  });
  const standard = resolveHistoricalTimezone({
    year: 2024,
    month: 11,
    day: 3,
    hour: 1,
    minute: 30,
    second: 0,
    timeZoneId: 'America/New_York',
    fixedOffsetHours: -5,
  });

  assert.equal(daylight.selectedUtcDateTime, '2024-11-03T05:30:00.000Z');
  assert.equal(daylight.resolvedOffsetHours, -4);
  assert.equal(daylight.offsetConflict, false);
  assert.equal(daylight.ambiguityResolvedByFixedOffset, true);
  assert.equal(standard.selectedUtcDateTime, '2024-11-03T06:30:00.000Z');
  assert.equal(standard.resolvedOffsetHours, -5);
  assert.equal(standard.offsetConflict, false);
  assert.match(standard.diagnostics[0], /固定偏移 UTC-5/);
});

test('IANA 历史时区应拒绝春季跳时与无效时区', () => {
  assert.throws(
    () =>
      resolveHistoricalTimezone({
        year: 2024,
        month: 3,
        day: 10,
        hour: 2,
        minute: 30,
        second: 0,
        timeZoneId: 'America/New_York',
      }),
    /不存在.*夏令时跳时/,
  );
  assert.throws(
    () =>
      resolveHistoricalTimezone({
        year: 2026,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        timeZoneId: 'Invalid\/Zone',
      }),
    /无法识别 IANA 时区/,
  );
});

test('天文时间尺度应直接采用 IANA 解析出的历史偏移', () => {
  const evidence = buildAstronomicalTimeEvidence({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    timeZoneId: 'Asia/Shanghai',
  });

  assert.equal(evidence.timezone, 9);
  assert.equal(evidence.utcDateTime, '1990-07-01 03:00:00Z');
  assert.equal(evidence.timezoneEvidence?.resolvedOffsetHours, 9);
  assert.ok(
    evidence.summaryFact.factKeys.includes(evidence.timezoneEvidence?.summaryFact.key ?? ''),
  );
  assert.match(evidence.promptText, /IANA|历史时区/);
});

test('七政四余应采用 IANA 解析出的历史偏移并保留证据', () => {
  const result = generateQizheng({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    latitude: 31.23,
    longitude: 121.47,
    timeZoneId: 'Asia/Shanghai',
  });

  assert.equal(result.calculationContext.timezone, 9);
  assert.equal(result.calculationContext.utcDateTime, '1990-07-01T03:00:00.000Z');
  assert.equal(result.calculationContext.astronomicalTime.timezoneEvidence?.resolvedOffsetHours, 9);
  assert.equal(result.stars.length, 11);
  assert.equal(result.mansionBoundaries.length, 28);
});

test('西占本命盘应采用 IANA 历史偏移，并拒绝冲突固定偏移', () => {
  assert.throws(
    () =>
      generateAstrolabe({
        name: '测试',
        gender: '男',
        year: '1990',
        month: '7',
        day: '1',
        hour: '12',
        minute: '0',
        latitude: '31.23',
        longitude: '121.47',
        timezone: '8',
        timeZoneId: 'Asia/Shanghai',
      }),
    /固定偏移.*历史偏移不一致/,
  );
  const result = generateAstrolabe({
    name: '测试',
    gender: '男',
    year: '1990',
    month: '7',
    day: '1',
    hour: '12',
    minute: '0',
    latitude: '31.23',
    longitude: '121.47',
    timeZoneId: 'Asia/Shanghai',
  });

  assert.equal(result.birth.timezone, 9);
  assert.equal(result.birth.timeZoneId, 'Asia/Shanghai');
  assert.equal(result.birth.timezoneStatus, 'unique');
  assert.match(result.birth.timezoneDiagnostics?.join('；') ?? '', /只有一个 UTC 对应时刻/);
  assert.equal(result.birth.timezoneEvidence?.status, 'unique');
  assert.equal(
    result.birth.timezoneEvidence?.diagnosticSummaryFact.status,
    '唯一映射且未核验固定偏移',
  );
  assert.equal(result.birth.timezoneEvidence?.limitationFacts.length, 3);
  assert.equal(result.evidenceAnalysis?.timezoneFact?.key, result.birth.timezoneEvidence?.key);
  assert.equal(result.evidenceAnalysis?.summaryFact.status, '证据链完整');
  assert.match(result.evidenceAnalysis?.promptText ?? '', /历史时区映射与诊断/);
});
