import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeNumber,
  analyzeNumberEnergyPair,
  buildNumberEnergyPrompt,
} from '../packages/core/src/name-number/index.ts';

test('八星全部64组数字与大游年变爻规则相符', () => {
  const expected = {
    生气: [3],
    天医: [1, 2],
    延年: [1, 2, 3],
    伏位: [],
    绝命: [2],
    五鬼: [2, 3],
    六煞: [1, 3],
    祸害: [1],
  };
  const digits = [1, 2, 3, 4, 6, 7, 8, 9];
  const counts = new Map<string, number>();
  for (const left of digits) {
    for (const right of digits) {
      const result = analyzeNumber(`${left}${right}`);
      const pair = result.energyPairs[0];
      const evidence = pair.trigramEvidence;
      assert.equal(evidence.name, pair.name, `${left}${right}卦变与磁场名称`);
      assert.deepEqual(evidence.changedLines, expected[pair.name], `${left}${right}变爻`);
      assert.equal(evidence.from.digit, left);
      assert.equal(evidence.to.digit, right);
      assert.equal(analyzeNumberEnergyPair(right, left).name, evidence.name);
      counts.set(pair.name, (counts.get(pair.name) ?? 0) + 1);
    }
  }
  assert.equal(counts.size, 8);
  assert.ok([...counts.values()].every((count) => count === 8));
});

test('乾宫八组卦变与古籍所列次序一致', () => {
  const sequence = [7, 3, 2, 1, 4, 8, 9, 6];
  assert.deepEqual(
    sequence.map((digit) => {
      const evidence = analyzeNumberEnergyPair(6, digit);
      return [evidence.to.name, evidence.name, evidence.starName];
    }),
    [
      ['兑', '生气', '贪狼'],
      ['震', '五鬼', '廉贞'],
      ['坤', '延年', '武曲'],
      ['坎', '六煞', '文曲'],
      ['巽', '祸害', '禄存'],
      ['艮', '天医', '巨门'],
      ['离', '绝命', '破军'],
      ['乾', '伏位', '辅弼'],
    ],
  );
});

test('夹0和5的数组以两端卦数提供证据并在提示词中区分取数口径', () => {
  const result = analyzeNumber('1053');
  const evidence = result.energyPairs[0].trigramEvidence;
  assert.equal(evidence.from.name, '坎');
  assert.equal(evidence.to.name, '震');
  assert.equal(evidence.starName, '巨门');
  assert.deepEqual(evidence.changedLines, [1, 2]);
  const prompt = buildNumberEnergyPrompt({ analysis: result });
  assert.match(prompt, /卦变：1为坎☵，3为震☳/);
  assert.match(prompt, /【取数口径】/);
  assert.match(prompt, /大游年原为宅卦相配之法/);
  for (const name of ['生气', '天医', '延年', '伏位', '祸害', '五鬼', '六煞', '绝命']) {
    assert.ok(prompt.includes(name));
  }
  assert.doesNotMatch(prompt, /sourceUrl|trigramEvidence|https?:\/\/|undefined/);
});

test('卦变入口拒绝中心数、修饰数及无效数字', () => {
  for (const invalid of [0, 5, -1, 10, 1.1, NaN, Infinity]) {
    assert.throws(() => analyzeNumberEnergyPair(invalid, 1), /八星卦数/);
    assert.throws(() => analyzeNumberEnergyPair(1, invalid), /八星卦数/);
  }
});
