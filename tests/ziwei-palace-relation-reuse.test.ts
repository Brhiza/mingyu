import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnalysisPayloadV1 } from '../packages/core/src/ziwei/iztro/build-analysis-payload';
import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
} from '../packages/core/src/ziwei/iztro/runtime-helpers';
import type { ChartInput } from '../packages/core/src/types/chart';
import type { MutagenName } from '../packages/core/src/types/analysis';

const MUTAGENS: MutagenName[] = ['禄', '权', '科', '忌'];
const fixtures: ChartInput[] = [
  {
    name: '公开合成关系复用样例一',
    gender: '女',
    dateType: 'solar',
    birthDate: '1992-08-21',
    birthTimeIndex: 4,
    algorithm: 'default',
  },
  {
    name: '公开合成关系复用样例二',
    gender: '男',
    dateType: 'solar',
    birthDate: '1987-03-11',
    birthTimeIndex: 9,
    algorithm: 'zhongzhou',
  },
];

test('宫位关系复用保持原生四化类别、层级与宫位顺序', async () => {
  for (const input of fixtures) {
    const astrolabe = await buildAstrolabeFromInput(input);
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-08-06', 4);
    const payload = buildAnalysisPayloadV1({
      astrolabe,
      horoscope,
      currentScope: 'yearly',
    });

    assert.deepEqual(
      payload.palaces.map((palace) => palace.index),
      astrolabe.palaces.map((palace) => palace.index),
    );

    for (const palace of astrolabe.palaces) {
      const fact = payload.palaces.find((candidate) => candidate.index === palace.index);
      assert.ok(fact);

      const expectedSelfMutagens = MUTAGENS.filter((mutagen) =>
        palace.selfMutaged(mutagen as never),
      );
      const surrounded = astrolabe.surroundedPalaces(palace.name);
      const expectedSurroundedMutagens = MUTAGENS.filter((mutagen) =>
        surrounded.haveMutagen(mutagen as never),
      );
      const expectedBirthMutagen = MUTAGENS.some((mutagen) => palace.hasMutagen(mutagen as never));
      const dynamicPalaceName = horoscope.yearly.palaceNames[palace.index];
      const expectedScopeMutagen = MUTAGENS.some((mutagen) =>
        horoscope.hasHoroscopeMutagen(dynamicPalaceName as never, 'yearly', mutagen as never),
      );
      const evidenceMutagens = payload.evidence_pool
        .filter(
          (item) =>
            item.type === 'surrounded_mutagen' &&
            item.title.startsWith(`${palace.name}三方四正见化`),
        )
        .flatMap((item) => item.mutagens)
        .sort(
          (left, right) =>
            MUTAGENS.indexOf(left as MutagenName) - MUTAGENS.indexOf(right as MutagenName),
        );

      assert.deepEqual(fact.self_mutagens, expectedSelfMutagens, `${palace.name}自化`);
      assert.deepEqual(evidenceMutagens, expectedSurroundedMutagens, `${palace.name}三方四正四化`);
      assert.deepEqual(
        fact.summary_tags
          .filter((tag) => tag.startsWith('三方四正见化'))
          .map((tag) => tag.slice('三方四正见化'.length)),
        expectedSurroundedMutagens,
        `${palace.name}三方四正摘要`,
      );
      assert.equal(fact.summary_tags.includes('有生年四化'), expectedBirthMutagen);
      assert.equal(fact.summary_tags.includes('有当前运限四化'), expectedScopeMutagen);
    }
  }
});

test('完整分析只计算一次十二宫关系并复用到摘要与证据', async () => {
  const input = fixtures[0];
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-08-06', 4);
  const calls = {
    surroundedPalaces: 0,
    selfMutaged: 0,
    hasMutagen: 0,
    hasHoroscopeMutagen: 0,
  };

  const surroundedPalaces = astrolabe.surroundedPalaces.bind(astrolabe);
  astrolabe.surroundedPalaces = (...args) => {
    calls.surroundedPalaces += 1;
    return surroundedPalaces(...args);
  };
  for (const palace of astrolabe.palaces) {
    const selfMutaged = palace.selfMutaged.bind(palace);
    const hasMutagen = palace.hasMutagen.bind(palace);
    palace.selfMutaged = (...args) => {
      calls.selfMutaged += 1;
      return selfMutaged(...args);
    };
    palace.hasMutagen = (...args) => {
      calls.hasMutagen += 1;
      return hasMutagen(...args);
    };
  }
  const hasHoroscopeMutagen = horoscope.hasHoroscopeMutagen.bind(horoscope);
  horoscope.hasHoroscopeMutagen = (...args) => {
    calls.hasHoroscopeMutagen += 1;
    return hasHoroscopeMutagen(...args);
  };

  const payload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'yearly',
  });

  assert.equal(payload.palaces.length, 12);
  assert.equal(calls.surroundedPalaces, 12, '每宫只建立一次三方四正关系');
  assert.equal(calls.selfMutaged, 0, '自化直接复用飞化目标');
  assert.equal(calls.hasMutagen, 0, '摘要与证据直接复用星曜四化事实');
  assert.equal(calls.hasHoroscopeMutagen, 0, '运限摘要直接复用已映射运限四化');
});
