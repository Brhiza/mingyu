import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
  buildIztroConfig,
  normalizeChartInput,
  resolveIztroAstro,
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

test('星曜精确名称查找与原引擎的星体、落宫和完整分析资料一致', async () => {
  const input = normalizeChartInput({
    name: '公开合成星曜查询样例',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 4,
  });
  const engine = resolveIztroAstro(await import('iztro'));
  const reference = engine.withOptions({
    type: input.dateType,
    dateStr: input.birthDate,
    timeIndex: input.birthTimeIndex,
    gender: input.gender,
    fixLeap: input.fixLeap,
    language: 'zh-CN',
    config: buildIztroConfig(input),
  });
  const actual = await buildAstrolabeFromInput(input);
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
