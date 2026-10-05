import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeNumber,
  analyzeNumberEnergyPair,
  buildNumberEnergyPrompt,
} from '../packages/core/src/name-number/index.ts';

test('后天卦数的64组星类、卦画与乾宫大游年次序符合独立真值', () => {
  const digits = [1, 2, 3, 4, 6, 7, 8, 9] as const;
  // 爻线按初爻到上爻排列；1为阳，0为阴。
  const trigrams = {
    1: { name: '坎', symbol: '☵', lines: [0, 1, 0] },
    2: { name: '坤', symbol: '☷', lines: [0, 0, 0] },
    3: { name: '震', symbol: '☳', lines: [1, 0, 0] },
    4: { name: '巽', symbol: '☴', lines: [0, 1, 1] },
    6: { name: '乾', symbol: '☰', lines: [1, 1, 1] },
    7: { name: '兑', symbol: '☱', lines: [1, 1, 0] },
    8: { name: '艮', symbol: '☶', lines: [0, 0, 1] },
    9: { name: '离', symbol: '☲', lines: [1, 0, 1] },
  } as const;
  // 《钦定协纪辨方书》卷二大游年变卦，行、列均按后天卦数 digits 排列。
  // https://zh.wikisource.org/zh-hant/欽定協紀辨方書_(四庫全書本)/卷02
  const expectedStarTypes = [
    ['伏位', '绝命', '天医', '生气', '六煞', '祸害', '五鬼', '延年'],
    ['绝命', '伏位', '祸害', '五鬼', '延年', '天医', '生气', '六煞'],
    ['天医', '祸害', '伏位', '延年', '五鬼', '绝命', '六煞', '生气'],
    ['生气', '五鬼', '延年', '伏位', '祸害', '六煞', '绝命', '天医'],
    ['六煞', '延年', '五鬼', '祸害', '伏位', '生气', '天医', '绝命'],
    ['祸害', '天医', '绝命', '六煞', '生气', '伏位', '延年', '五鬼'],
    ['五鬼', '生气', '六煞', '绝命', '天医', '延年', '伏位', '祸害'],
    ['延年', '六煞', '生气', '天医', '绝命', '五鬼', '祸害', '伏位'],
  ] as const;
  const starNames = {
    生气: '贪狼',
    天医: '巨门',
    延年: '武曲',
    伏位: '辅弼',
    绝命: '破军',
    五鬼: '廉贞',
    六煞: '文曲',
    祸害: '禄存',
  } as const;
  const counts = new Map<string, number>();
  const directPairs = new Map<string, ReturnType<typeof analyzeNumberEnergyPair>>();
  for (const [leftIndex, left] of digits.entries()) {
    const expectedFrom = trigrams[left];
    for (const [rightIndex, right] of digits.entries()) {
      const expectedTo = trigrams[right];
      const expectedName = expectedStarTypes[leftIndex]![rightIndex]!;
      const expectedChangedLines = expectedFrom.lines.flatMap((line, index) =>
        line === expectedTo.lines[index] ? [] : [index + 1],
      );
      const result = analyzeNumber(`${left}${right}`);
      const pair = result.energyPairs[0];
      const evidence = pair.trigramEvidence;
      assert.equal(evidence.name, pair.name, `${left}${right}卦变与磁场名称`);
      assert.equal(pair.name, expectedName, `${left}${right}独立八星真值`);
      assert.equal(evidence.starName, starNames[expectedName], `${left}${right}星名`);
      assert.deepEqual(
        [evidence.from.digit, evidence.from.name, evidence.from.symbol, evidence.from.lines],
        [left, expectedFrom.name, expectedFrom.symbol, expectedFrom.lines],
        `${left}${right}起卦卦画`,
      );
      assert.deepEqual(
        [evidence.to.digit, evidence.to.name, evidence.to.symbol, evidence.to.lines],
        [right, expectedTo.name, expectedTo.symbol, expectedTo.lines],
        `${left}${right}变卦卦画`,
      );
      assert.deepEqual(evidence.changedLines, expectedChangedLines, `${left}${right}变爻`);

      const direct = analyzeNumberEnergyPair(right, left);
      const directExpectedName = expectedStarTypes[rightIndex]![leftIndex]!;
      const directExpectedChangedLines = expectedTo.lines.flatMap((line, index) =>
        line === expectedFrom.lines[index] ? [] : [index + 1],
      );
      assert.equal(direct.name, directExpectedName, `${right}${left}直接配对八星真值`);
      assert.equal(direct.starName, starNames[directExpectedName], `${right}${left}直接配对星名`);
      assert.deepEqual(
        [direct.from.digit, direct.from.name, direct.from.symbol, direct.from.lines],
        [right, expectedTo.name, expectedTo.symbol, expectedTo.lines],
        `${right}${left}直接配对起卦卦画`,
      );
      assert.deepEqual(
        [direct.to.digit, direct.to.name, direct.to.symbol, direct.to.lines],
        [left, expectedFrom.name, expectedFrom.symbol, expectedFrom.lines],
        `${right}${left}直接配对变卦卦画`,
      );
      assert.deepEqual(
        direct.changedLines,
        directExpectedChangedLines,
        `${right}${left}直接配对变爻`,
      );
      assert.equal(direct.name, evidence.name, `${right}${left}直接入口与聚合入口类别一致`);
      directPairs.set(`${right}:${left}`, direct);
      counts.set(pair.name, (counts.get(pair.name) ?? 0) + 1);
    }
  }
  assert.equal(counts.size, 8);
  assert.ok([...counts.values()].every((count) => count === 8));
  const qianPalaceSequence = [
    [7, '兑', '生气', '贪狼'],
    [3, '震', '五鬼', '廉贞'],
    [2, '坤', '延年', '武曲'],
    [1, '坎', '六煞', '文曲'],
    [4, '巽', '祸害', '禄存'],
    [8, '艮', '天医', '巨门'],
    [9, '离', '绝命', '破军'],
    [6, '乾', '伏位', '辅弼'],
  ] as const;
  for (const [digit, gua, starType, starName] of qianPalaceSequence) {
    const evidence = directPairs.get(`6:${digit}`);
    assert.ok(evidence, `缺少乾宫至${gua}的直接配对`);
    assert.deepEqual(
      [evidence.to.name, evidence.name, evidence.starName],
      [gua, starType, starName],
    );
  }
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
