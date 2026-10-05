import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnalysisPayloadV1 } from '../packages/core/src/ziwei/iztro/build-analysis-payload';
import { buildNatalPalaceFacts } from '../packages/core/src/ziwei/iztro/build-analysis-payload/helpers/builders';
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

test('宫位关系复用保持原生四化类别、层级与顺序且每宫只计算一次', async () => {
  for (const input of fixtures) {
    const astrolabe = await buildAstrolabeFromInput(input);
    const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-08-06', 4);
    const expectedByPalace = astrolabe.palaces.map((palace) => {
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

      return {
        index: palace.index,
        selfMutagens: expectedSelfMutagens,
        surroundedMutagens: expectedSurroundedMutagens,
        birthMutagen: expectedBirthMutagen,
        scopeMutagen: expectedScopeMutagen,
      };
    });
    const verifyRelationReuse = input === fixtures[0];
    const calls = {
      surroundedPalaces: 0,
      selfMutaged: 0,
      hasMutagen: 0,
      hasHoroscopeMutagen: 0,
    };
    const surroundedPalaceIndexes: number[] = [];

    if (verifyRelationReuse) {
      const surroundedPalaces = astrolabe.surroundedPalaces.bind(astrolabe);
      astrolabe.surroundedPalaces = (...args) => {
        calls.surroundedPalaces += 1;
        assert.equal(typeof args[0], 'number');
        surroundedPalaceIndexes.push(args[0] as number);
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
    }

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
      const expected = expectedByPalace.find((candidate) => candidate.index === palace.index);
      assert.ok(fact);
      assert.ok(expected);
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

      assert.deepEqual(fact.self_mutagens, expected.selfMutagens, `${palace.name}自化`);
      assert.deepEqual(evidenceMutagens, expected.surroundedMutagens, `${palace.name}三方四正四化`);
      assert.deepEqual(
        fact.summary_tags
          .filter((tag) => tag.startsWith('三方四正见化'))
          .map((tag) => tag.slice('三方四正见化'.length)),
        expected.surroundedMutagens,
        `${palace.name}三方四正摘要`,
      );
      assert.equal(fact.summary_tags.includes('有生年四化'), expected.birthMutagen);
      assert.equal(fact.summary_tags.includes('有当前运限四化'), expected.scopeMutagen);
    }
    if (verifyRelationReuse) {
      assert.equal(payload.palaces.length, 12);
      assert.equal(calls.surroundedPalaces, 12, '每宫只建立一次三方四正关系');
      assert.deepEqual(
        surroundedPalaceIndexes,
        astrolabe.palaces.map((palace) => palace.index),
        '直接使用已校验宫位索引，不重复按宫名反查',
      );
      assert.equal(calls.selfMutaged, 0, '自化直接复用飞化目标');
      assert.equal(calls.hasMutagen, 0, '摘要与证据直接复用星曜四化事实');
      assert.equal(calls.hasHoroscopeMutagen, 0, '运限摘要直接复用已映射运限四化');
    }
  }
});

test('本命宫位枚举顺序改变时仍按唯一宫位索引取得原生三方四正', async () => {
  const astrolabe = await buildAstrolabeFromInput(fixtures[0]);
  const reorderedAstrolabe = Object.create(astrolabe) as typeof astrolabe;
  const reorderedPalaces = [...astrolabe.palaces].reverse();
  Object.defineProperty(reorderedAstrolabe, 'palaces', {
    configurable: true,
    enumerable: true,
    value: reorderedPalaces,
  });

  const facts = buildNatalPalaceFacts(reorderedAstrolabe);

  assert.deepEqual(
    facts.map((fact) => fact.index),
    reorderedPalaces.map((palace) => palace.index),
    '事实顺序保留调用方提供的宫位排列',
  );
  for (const palace of reorderedPalaces) {
    const fact = facts.find((candidate) => candidate.index === palace.index);
    const surrounded = astrolabe.surroundedPalaces(palace.name);
    assert.ok(fact);
    assert.equal(fact.opposite_palace_index, surrounded.opposite.index, palace.name);
    assert.deepEqual(
      fact.surrounded_palace_indexes,
      [
        surrounded.target.index,
        surrounded.opposite.index,
        surrounded.wealth.index,
        surrounded.career.index,
      ],
      palace.name,
    );
  }
});
