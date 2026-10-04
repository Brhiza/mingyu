import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
  normalizeChartInput,
} from '../packages/core/src/ziwei/iztro/runtime-helpers';
import { buildPalaceFacts } from '../packages/core/src/ziwei/iztro/build-analysis-payload/helpers/builders';
import { buildAnalysisPayloadV1 } from '../packages/core/src/ziwei/iztro/build-analysis-payload';
import type { ChartInput } from '../packages/core/src/types/chart';

test('十二宫共享运限落宫查询并完整保留各层落宫标记', async () => {
  const input: ChartInput = {
    name: '公开合成落宫样例',
    gender: '男',
    dateType: 'solar',
    birthDate: '1990-06-14',
    birthTimeIndex: 5,
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  for (const dateStr of ['1990-06-14', '2025-01-01']) {
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, dateStr, 6);
    const expected = [
      [horoscope.palace('命宫', 'decadal')?.index, `${horoscope.decadal.name || '大限'}落宫`],
      [horoscope.agePalace()?.index, '小限落宫'],
      [horoscope.palace('命宫', 'yearly')?.index, '流年落宫'],
      [horoscope.palace('命宫', 'monthly')?.index, '流月落宫'],
      [horoscope.palace('命宫', 'daily')?.index, '流日落宫'],
      [horoscope.palace('命宫', 'hourly')?.index, '流时落宫'],
    ];
    let palaceCalls = 0;
    let ageCalls = 0;
    const palace = horoscope.palace.bind(horoscope);
    const agePalace = horoscope.agePalace.bind(horoscope);
    horoscope.palace = (...args) => {
      palaceCalls += 1;
      return palace(...args);
    };
    horoscope.agePalace = () => {
      ageCalls += 1;
      return agePalace();
    };
    const facts = buildPalaceFacts({ astrolabe, horoscope, currentScope: 'origin' });
    assert.equal(facts.length, 12);
    for (const fact of facts) {
      const hits = expected.filter(([index]) => index === fact.index).map(([, label]) => label);
      assert.deepEqual(fact.scope_hits, hits);
      assert.deepEqual(
        fact.summary_tags.filter((tag) => tag.endsWith('落宫')),
        hits,
      );
    }
    assert.equal(palaceCalls, 5, '每层落宫只查询一次，不随十二宫重复');
    assert.equal(ageCalls, 1, '小限落宫只查询一次');
  }
});

test('紫微运限落宫证据归入运限采集与统计', async () => {
  const input: ChartInput = {
    name: '运限证据归类样例',
    gender: '男',
    dateType: 'solar',
    birthDate: '1990-06-14',
    birthTimeIndex: 5,
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2025-01-01', 6);
  const payload = buildAnalysisPayloadV1({ astrolabe, horoscope, currentScope: 'yearly' });
  const scopeHits = payload.evidence_pool.filter((fact) => fact.type === 'palace_scope_hit');
  assert.ok(scopeHits.length > 0);
  assert.ok(scopeHits.every((fact) => fact.scope === 'yearly'));
  assert.ok(scopeHits.every((fact) => fact.title.startsWith('流年落宫')));
  assert.ok(
    scopeHits.every((fact) =>
      payload.palaces
        .find((palace) => palace.index === fact.palace_indexes[0])
        ?.scope_hits.includes('流年落宫'),
    ),
  );
  assert.ok(
    scopeHits.every(
      (fact) =>
        fact.calculationStepKey === 'ziwei:evidence:calculation:scope-facts' &&
        fact.dependsOnStepKeys.includes('ziwei:evidence:calculation:scope-facts'),
    ),
  );
  const scopeFactCount = payload.evidence_pool.filter(
    (fact) => fact.calculationStepKey === 'ziwei:evidence:calculation:scope-facts',
  ).length;
  const natalFactCount = payload.evidence_pool.length - scopeFactCount;
  assert.equal(payload.evidence_analysis.summaryFact.scopeFactCount, scopeFactCount);
  assert.equal(payload.evidence_analysis.summaryFact.natalFactCount, natalFactCount);
});

test('紫微大限证据只记录大限落宫，不混入同一时点的流年流日落宫', async () => {
  const input: ChartInput = {
    name: '大限证据层级样例',
    gender: '男',
    dateType: 'solar',
    birthDate: '1990-06-14',
    birthTimeIndex: 5,
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2025-01-01', 6);
  const payload = buildAnalysisPayloadV1({ astrolabe, horoscope, currentScope: 'decadal' });
  const scopeHits = payload.evidence_pool.filter((fact) => fact.type === 'palace_scope_hit');
  assert.equal(scopeHits.length, 1);
  assert.equal(
    scopeHits[0]?.title,
    `${horoscope.decadal.name || '大限'}落宫位于${scopeHits[0]?.palace_names[0]}`,
  );
  assert.equal(scopeHits[0]?.palace_indexes[0], horoscope.palace('命宫', 'decadal')?.index);
});

test('星曜精确名称查找与原引擎的星体、落宫和完整分析资料一致', async () => {
  const input = normalizeChartInput({
    name: '公开合成星曜查询样例',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 4,
  });
  const actual = await buildAstrolabeFromInput(input);
  // 从适配入口加载的原类重建参照实例，其构造函数保留引擎原生查询方法。
  // 单独排盘提供星体，避免两份实例共享星体的落宫引用。
  const referenceData = await buildAstrolabeFromInput(input);
  const OriginalAstrolabe = referenceData.constructor as new (
    data: typeof referenceData,
  ) => typeof referenceData;
  const reference = new OriginalAstrolabe(referenceData);
  const names = reference.palaces.flatMap((palace) =>
    [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].map((star) => star.name),
  );
  for (const name of [...names, 'emperor', 'ziweiMaj'] as Parameters<typeof actual.star>[0][]) {
    const expectedStar = reference.star(name);
    const actualStar = actual.star(name);
    assert.equal(actualStar.name, expectedStar.name, name);
    assert.equal(actualStar.palace()?.index, expectedStar.palace()?.index, name);
    assert.equal(actualStar.oppositePalace()?.index, expectedStar.oppositePalace()?.index, name);
    assert.equal(actualStar, actual.star(name), '查找保留盘内同一星体对象');
  }
  assert.throws(() => actual.star('不存在的星曜' as never));
  const expectedHoroscope = await buildHoroscopeFromInput(reference, input, '2025-01-01', 6);
  const actualHoroscope = await buildHoroscopeFromInput(actual, input, '2025-01-01', 6);
  for (const currentScope of ['origin', 'decadal', 'yearly', 'age'] as const) {
    assert.deepEqual(
      buildAnalysisPayloadV1({ astrolabe: actual, horoscope: actualHoroscope, currentScope }),
      buildAnalysisPayloadV1({ astrolabe: reference, horoscope: expectedHoroscope, currentScope }),
      `${currentScope} 全部盘面、四化、证据与格局资料不变`,
    );
  }
});
