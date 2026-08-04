import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSolarIlluminationEvidence } from '../packages/core/src/calendar/solar-illumination-evidence.ts';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';

function assertEvidenceReferences(evidence: ReturnType<typeof calculateSolarIlluminationEvidence>) {
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  const crossings = [
    evidence.sunriseSunset,
    evidence.civilTwilight,
    evidence.nauticalTwilight,
    evidence.astronomicalTwilight,
  ];
  assert.equal(evidence.summaryFact.calculationStepCount, evidence.calculationSteps.length);
  assert.equal(evidence.summaryFact.assumptionFactCount, evidence.assumptionFacts.length);
  assert.equal(evidence.summaryFact.limitationFactCount, evidence.limitationFacts.length);
  assert.equal(
    evidence.summaryFact.normalCrossingCount,
    crossings.filter((item) => item.status === '正常交点').length,
  );
  assert.equal(
    evidence.summaryFact.allDayStateCount,
    crossings.filter((item) => item.status !== '正常交点').length,
  );
  assert.ok(evidence.crossingSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    crossings.every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.calculationStepKeys.join('|'),
    ),
  );
  assert.ok(
    [...evidence.assumptionFacts, ...evidence.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 &&
        item.ownerFactKeys.every((key) => factKeys.has(key)) &&
        item.ownerFactKeys.join('|') === item.ownerStepKeys.join('|'),
    ),
  );
}

test('北京夏至应给出可复核的日出日落、太阳高度与曙暮光', () => {
  const evidence = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 6,
    day: 21,
    hour: 12,
    timezone: 8,
    latitude: 39.9042,
    longitude: 116.4074,
  });

  assert.ok(evidence.solarAltitudeDegrees > 72 && evidence.solarAltitudeDegrees < 74);
  assert.ok(evidence.solarAzimuthDegrees > 160 && evidence.solarAzimuthDegrees < 180);
  assert.equal(evidence.sunriseSunset.status, '正常交点');
  assert.match(evidence.sunriseSunset.morningLocalDateTime ?? '', /2024-06-21 04:4\d:/);
  assert.match(evidence.sunriseSunset.eveningLocalDateTime ?? '', /2024-06-21 19:4\d:/);
  assert.match(evidence.civilTwilight.morningLocalDateTime ?? '', /2024-06-21 04:1\d:/);
  assert.ok(
    [
      evidence.sunriseSunset,
      evidence.civilTwilight,
      evidence.nauticalTwilight,
      evidence.astronomicalTwilight,
    ].every(
      (item) =>
        item.key.startsWith('光照交点:') &&
        item.promptText.includes('阈值') &&
        item.sources.length >= 2 &&
        item.calculation.includes('求时角交点') &&
        item.limitation.includes('不代表实际可见性'),
    ),
  );
  assert.match(evidence.promptText, /真北起顺时针/);
  assert.match(evidence.promptText, /日出\/日落：太阳高度-0\.833°阈值/);
  assert.match(evidence.promptText, /不宣称达到观测级或导航级精度/);
  assert.equal(evidence.key, 'solar-illumination:2024-06-21:39.9042:116.4074');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.astronomicalTime.status, '已计算');
  assert.deepEqual(
    evidence.calculationSteps.map((item) => item.stage),
    ['天文时间', '参考太阳位置', '视太阳正午', '阈值交点'],
  );
  assert.deepEqual(
    evidence.calculationChain,
    evidence.calculationSteps.map((item) => item.promptText),
  );
  assert.deepEqual(evidence.calculationSteps[3].dependsOnStepKeys, [
    evidence.calculationSteps[1].key,
    evidence.calculationSteps[2].key,
  ]);
  assert.ok(
    [
      evidence.sunriseSunset,
      evidence.civilTwilight,
      evidence.nauticalTwilight,
      evidence.astronomicalTwilight,
    ].every((item) => item.calculationStepKeys.includes(evidence.calculationSteps[3].key)),
  );
  assert.equal(evidence.assumptions.length, evidence.assumptionFacts.length);
  assert.equal(evidence.crossingSummaryFact.status, '均有正常交点');
  assert.equal(evidence.crossingSummaryFact.crossingFactKeys.length, 4);
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assertEvidenceReferences(evidence);
  assert.ok(
    [
      ...evidence.calculationSteps,
      ...evidence.assumptionFacts,
      evidence.crossingSummaryFact,
      ...evidence.limitationFacts,
    ].every((item) => item.sources.length > 0 && item.limitation.length > 0),
  );
});

test('高纬冬夏应明确表达极夜无日出和极昼无日落', () => {
  const winter = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 12,
    day: 21,
    hour: 12,
    timezone: 1,
    latitude: 69.6492,
    longitude: 18.9553,
  });
  const summer = calculateSolarIlluminationEvidence({
    year: 2024,
    month: 6,
    day: 21,
    hour: 12,
    timezone: 2,
    latitude: 69.6492,
    longitude: 18.9553,
  });

  assert.equal(winter.sunriseSunset.status, '全天低于阈值');
  assert.equal(winter.sunriseSunset.morningUtcDateTime, null);
  assert.match(winter.sunriseSunset.calculation, /余弦时角大于1/);
  assert.equal(summer.sunriseSunset.status, '全天高于阈值');
  assert.equal(summer.civilTwilight.status, '全天高于阈值');
  assert.match(summer.sunriseSunset.calculation, /余弦时角小于-1/);
  assert.equal(winter.status, '存在全天状态');
  assert.equal(winter.crossingSummaryFact.status, '存在全天状态');
  assert.equal(summer.status, '存在全天状态');
  assert.equal(winter.summaryFact.status, '含全天状态');
  assert.equal(summer.summaryFact.status, '含全天状态');
  assertEvidenceReferences(winter);
  assertEvidenceReferences(summer);
});

test('太阳光照证据应复用IANA历史时区并拒绝非法坐标', () => {
  const evidence = calculateSolarIlluminationEvidence({
    year: 1990,
    month: 7,
    day: 1,
    hour: 12,
    timeZoneId: 'Asia/Shanghai',
    latitude: 31.2304,
    longitude: 121.4737,
  });

  assert.equal(evidence.timezone, 9);
  assert.throws(
    () =>
      calculateSolarIlluminationEvidence({
        year: 2024,
        month: 1,
        day: 1,
        timezone: 8,
        latitude: 91,
        longitude: 116,
      }),
    /纬度需在 -90 至 90 之间/,
  );
  assert.throws(
    () =>
      calculateSolarIlluminationEvidence({
        year: 2024,
        month: 1,
        day: 1,
        timezone: 8,
        latitude: 39,
        longitude: Number.NaN,
      }),
    /经度需在 -180 至 180 之间/,
  );
});

test('西占应附带地点相关光照证据而不生成吉凶结论', () => {
  const astrolabe = generateAstrolabe({
    name: '测试',
    gender: 'unspecified',
    year: '2024',
    month: '6',
    day: '21',
    hour: '12',
    minute: '0',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
  });
  assert.equal(astrolabe.solarIllumination.sunriseSunset.status, '正常交点');
  assert.doesNotMatch(
    astrolabe.evidenceAnalysis?.promptText ?? '',
    /光照吉凶|日出成功率|太阳高度评分/,
  );
});
