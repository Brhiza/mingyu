import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { buildAstrolabeScopeContext } from 'mingyu-core/divination/astrolabe-scope';
import type { AstrolabeData } from 'mingyu-core/types';

const astrolabeData = generateAstrolabe({
  name: '区间事实用例',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
});

function assertTransitFacts(context: ReturnType<typeof buildAstrolabeScopeContext>) {
  const evidence = context.transitFacts;
  assert.ok(evidence, `${context.scope} 应提供结构化行运相位事实`);
  assert.equal(evidence.status, '有效');
  assert.ok(evidence.facts.length > 0);
  assert.equal(new Set(evidence.facts.map((fact) => fact.key)).size, evidence.facts.length);
  assert.deepEqual(
    evidence.headlineFactKeys,
    evidence.facts.filter((fact) => fact.line === '主线').map((fact) => fact.key),
  );

  const expectedPrompt = [
    `主要行运相位：${evidence.facts
      .filter((fact) => fact.line === '主线')
      .map((fact) => fact.promptText)
      .join('；')}。`,
    evidence.facts.some((fact) => fact.line === '其余')
      ? `其余取样相位：${evidence.facts
          .filter((fact) => fact.line === '其余')
          .map((fact) => fact.promptText)
          .join('；')}。`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  assert.equal(evidence.promptText, expectedPrompt);
  assert.ok(context.promptText.includes(evidence.promptText));

  for (const fact of evidence.facts) {
    assert.equal(fact.status, '有效');
    const rawAngle = Math.abs(fact.transiting.longitude - fact.natal.longitude);
    const expectedAngle = rawAngle > 180 ? 360 - rawAngle : rawAngle;
    assert.ok(Math.abs(fact.actualAngle - expectedAngle) < 1e-9);
    assert.ok(Math.abs(Math.abs(fact.actualAngle - fact.exactAngle) - fact.deviation) < 1e-9);
    assert.equal(typeof fact.isOutOfSign, 'boolean');
    assert.ok(Number.isFinite(fact.transiting.longitude));
    assert.ok(Number.isFinite(fact.natal.longitude));
    assert.equal(typeof fact.transiting.sign, 'string');
    assert.equal(typeof fact.transiting.signLabel, 'string');
    assert.equal(typeof fact.transiting.retrograde, 'boolean');
    assert.equal(typeof fact.transiting.longitudeSpeed, 'number');
    assert.ok(
      fact.transiting.natalHouse === null ||
        (fact.transiting.natalHouse >= 1 && fact.transiting.natalHouse <= 12),
    );
    assert.equal(typeof fact.phase, 'string');
  }
}

test('流年、流月和流日均保留完整行运相位与落宫事实', () => {
  for (const [scope, dateStr] of [
    ['yearly', '2028'],
    ['monthly', '2028-06'],
    ['daily', '2028-06-12'],
  ] as const) {
    const context = buildAstrolabeScopeContext(astrolabeData, scope, dateStr, {
      includePeriodEvents: false,
    });
    assertTransitFacts(context);

    const houseEvidence = context.transitHouseFacts;
    assert.ok(houseEvidence);
    assert.equal(houseEvidence.status, '有效');
    assert.ok(houseEvidence.facts.length > 0);
    assert.ok(context.promptText.includes(houseEvidence.promptText));
    for (const fact of houseEvidence.facts) {
      assert.equal(fact.status, '有效');
      assert.ok(Number.isFinite(fact.longitude));
      assert.equal(typeof fact.sign, 'string');
      assert.equal(typeof fact.signLabel, 'string');
      assert.equal(typeof fact.longitudeSpeed, 'number');
      assert.ok(Number.isInteger(fact.second) && fact.second >= 0 && fact.second < 60);
      const aspect = context.transitFacts?.facts.find(
        (item) => item.transiting.name === fact.transitingBody,
      );
      if (aspect) {
        assert.equal(fact.longitude, aspect.transiting.longitude);
        assert.equal(fact.latitude, aspect.transiting.latitude);
        assert.equal(fact.distance, aspect.transiting.distance);
        assert.equal(fact.second, aspect.transiting.second);
      }
      assert.ok(fact.natalHouse === null || (fact.natalHouse >= 1 && fact.natalHouse <= 12));
      assert.ok(fact.promptText.includes(fact.signLabel));
    }
  }
});

test('资料不足、无相位和缺少宫头分别保留可判定状态', () => {
  const incompletePoints = {
    ...astrolabeData,
    planets: astrolabeData.planets.map((point) => ({ ...point, longitude: Number.NaN })),
    angles: astrolabeData.angles.map((point) => ({ ...point, longitude: Number.NaN })),
  } satisfies AstrolabeData;
  const insufficient = buildAstrolabeScopeContext(incompletePoints, 'daily', '2028-06-12', {
    includePeriodEvents: false,
  });
  assert.equal(insufficient.transitFacts?.status, '资料不足');
  assert.deepEqual(insufficient.transitFacts?.facts, []);
  assert.equal(insufficient.transitFacts?.promptText, '主要行运相位：本命点经度资料不足。');

  const incompleteHouses = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((point) => ({ ...point, longitude: Number.NaN })),
  } satisfies AstrolabeData;
  const missingHouses = buildAstrolabeScopeContext(incompleteHouses, 'daily', '2028-06-12', {
    includePeriodEvents: false,
  });
  assert.equal(missingHouses.transitHouseFacts?.status, '资料不足');
  assert.deepEqual(missingHouses.transitHouseFacts?.facts, []);
  assert.equal(missingHouses.transitHouseFacts?.promptText, '行运落宫：本命宫头资料不足。');

  const sparseData = {
    ...astrolabeData,
    planets: astrolabeData.planets.slice(0, 3).map((point) => ({
      ...point,
      longitude: 0,
      sign: '白羊座',
      degree: 0,
      minute: 0,
      longitudeSpeed: undefined,
    })),
    angles: [],
  } satisfies AstrolabeData;
  const noAspectContext = buildAstrolabeScopeContext(sparseData, 'daily', '2028-05-06', {
    includePeriodEvents: false,
  });
  assert.equal(noAspectContext.transitFacts?.status, '无相位');
  assert.deepEqual(noAspectContext.transitFacts?.facts, []);
  assert.equal(
    noAspectContext.transitFacts?.promptText,
    '主要行运相位：所选日期未见当前容许度内的主要相位。',
  );
});

test('includeScopeFacts为false时不计算或附加行运结构化事实', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028', {
    includeScopeFacts: false,
    includePeriodEvents: false,
  });

  assert.equal(context.transitFacts, undefined);
  assert.equal(context.transitHouseFacts, undefined);
  assert.doesNotMatch(context.promptText, /主要行运相位：/);
  assert.doesNotMatch(context.promptText, /行运落宫：/);
});

test('同一行运相位在排名变化后仍保留稳定身份', () => {
  const options = { includePeriodEvents: false };
  const first = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-12', options)
    .transitFacts!.facts;
  const second = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-13', options)
    .transitFacts!.facts;
  let reordered = 0;
  for (const [index, fact] of first.entries()) {
    const nextIndex = second.findIndex(
      (other) =>
        other.transiting.name === fact.transiting.name &&
        other.natal.name === fact.natal.name &&
        other.aspectType === fact.aspectType,
    );
    if (nextIndex < 0) continue;
    assert.equal(second[nextIndex].key, fact.key);
    if (nextIndex !== index) reordered += 1;
  }
  assert.ok(reordered > 0, '合成日期应包含排名变化的同一相位');
});
