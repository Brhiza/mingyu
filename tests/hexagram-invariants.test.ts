import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { generateLiuyao } from '../packages/core/src/divination/algorithms/liuyao.ts';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { hexagramsData, trigramsByIndex } from '../packages/core/src/divination/hexagram-data.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');
const TRIGRAM_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'] as const;

// 固定真值来自八卦卦画，自下而上记录，不从生产表或待测函数派生。
const TRIGRAM_TRUTHS = [
  { name: '乾', symbol: '☰', lines: [1, 1, 1] },
  { name: '兑', symbol: '☱', lines: [1, 1, 0] },
  { name: '离', symbol: '☲', lines: [1, 0, 1] },
  { name: '震', symbol: '☳', lines: [1, 0, 0] },
  { name: '巽', symbol: '☴', lines: [0, 1, 1] },
  { name: '坎', symbol: '☵', lines: [0, 1, 0] },
  { name: '艮', symbol: '☶', lines: [0, 0, 1] },
  { name: '坤', symbol: '☷', lines: [0, 0, 0] },
] as const;

// 行为上卦、列为下卦，次序均为乾兑离震巽坎艮坤。
const HEXAGRAM_NAME_TRUTHS = [
  ['乾为天', '天泽履', '天火同人', '天雷无妄', '天风姤', '天水讼', '天山遁', '天地否'],
  ['泽天夬', '兑为泽', '泽火革', '泽雷随', '泽风大过', '泽水困', '泽山咸', '泽地萃'],
  ['火天大有', '火泽睽', '离为火', '火雷噬嗑', '火风鼎', '火水未济', '火山旅', '火地晋'],
  ['雷天大壮', '雷泽归妹', '雷火丰', '震为雷', '雷风恒', '雷水解', '雷山小过', '雷地豫'],
  ['风天小畜', '风泽中孚', '风火家人', '风雷益', '巽为风', '风水涣', '风山渐', '风地观'],
  ['水天需', '水泽节', '水火既济', '水雷屯', '水风井', '坎为水', '水山蹇', '水地比'],
  ['山天大畜', '山泽损', '山火贲', '山雷颐', '山风蛊', '山水蒙', '艮为山', '山地剥'],
  ['地天泰', '地泽临', '地火明夷', '地雷复', '地风升', '地水师', '地山谦', '坤为地'],
] as const;

const trigramIndexByLines = new Map(
  TRIGRAM_TRUTHS.map((trigram, index) => [trigram.lines.join(''), index]),
);

function hexagramNameFromBottomUpLines(lines: readonly number[]): string {
  assert.equal(lines.length, 6);
  const lowerIndex = trigramIndexByLines.get(lines.slice(0, 3).join(''));
  const upperIndex = trigramIndexByLines.get(lines.slice(3, 6).join(''));
  assert.notEqual(lowerIndex, undefined);
  assert.notEqual(upperIndex, undefined);
  return HEXAGRAM_NAME_TRUTHS[upperIndex!][lowerIndex!];
}

function replaySampleForIndex(index: number, total: number): number {
  return (index - 0.5) / total;
}

test('八卦基础表应符合卦画且统一按初爻到三爻排列', () => {
  for (const [offset, truth] of TRIGRAM_TRUTHS.entries()) {
    const actual = trigramsByIndex[offset + 1];
    assert.equal(actual.name, truth.name);
    assert.equal(actual.symbol, truth.symbol);
    assert.deepEqual(actual.lines, truth.lines, `${truth.name}卦爻序`);
  }
});

test('六十四卦名称、上下卦、卦画和二进制编码应符合固定真值表', () => {
  assert.equal(hexagramsData.length, 64);
  assert.deepEqual(
    [...new Set(hexagramsData.map((hexagram) => hexagram.id))].sort((a, b) => a - b),
    Array.from({ length: 64 }, (_, index) => index + 1),
  );

  for (let upperIndex = 0; upperIndex < 8; upperIndex += 1) {
    for (let lowerIndex = 0; lowerIndex < 8; lowerIndex += 1) {
      const name = HEXAGRAM_NAME_TRUTHS[upperIndex][lowerIndex];
      const upper = TRIGRAM_TRUTHS[upperIndex];
      const lower = TRIGRAM_TRUTHS[lowerIndex];
      const actual = hexagramsData.find((hexagram) => hexagram.name === name);

      assert.ok(actual, `${name}存在`);
      assert.equal(actual.upper, upper.name, `${name}上卦`);
      assert.equal(actual.lower, lower.name, `${name}下卦`);
      assert.equal(actual.symbol, `${upper.symbol}${lower.symbol}`, `${name}卦画`);
      assert.equal(
        actual.binarySymbol,
        `${upper.lines.join('')}${lower.lines.join('')}`,
        `${name}二进制`,
      );
    }
  }
});

test('梅花与六爻的 64 卦乘 6 动爻应得到相同主卦、互卦和变卦', () => {
  for (let upperIndex = 1; upperIndex <= 8; upperIndex += 1) {
    for (let lowerIndex = 1; lowerIndex <= 8; lowerIndex += 1) {
      const mainLines = [
        ...TRIGRAM_TRUTHS[lowerIndex - 1].lines,
        ...TRIGRAM_TRUTHS[upperIndex - 1].lines,
      ];

      for (let movingYaoIndex = 1; movingYaoIndex <= 6; movingYaoIndex += 1) {
        const changedLines = [...mainLines];
        changedLines[movingYaoIndex - 1] = 1 - changedLines[movingYaoIndex - 1];
        const interLines = [...mainLines.slice(1, 4), ...mainLines.slice(2, 5)];
        const expectedMain = hexagramNameFromBottomUpLines(mainLines);
        const expectedChanged = hexagramNameFromBottomUpLines(changedLines);
        const expectedInter = hexagramNameFromBottomUpLines(interLines);
        const label = `${expectedMain}第${movingYaoIndex}爻`;
        const interLowerIndex = trigramIndexByLines.get(interLines.slice(0, 3).join(''));
        const interUpperIndex = trigramIndexByLines.get(interLines.slice(3, 6).join(''));
        const changedLowerIndex = trigramIndexByLines.get(changedLines.slice(0, 3).join(''));
        const changedUpperIndex = trigramIndexByLines.get(changedLines.slice(3, 6).join(''));
        assert.notEqual(interLowerIndex, undefined, `${label}互卦下卦真值缺失`);
        assert.notEqual(interUpperIndex, undefined, `${label}互卦上卦真值缺失`);
        assert.notEqual(changedLowerIndex, undefined, `${label}变卦下卦真值缺失`);
        assert.notEqual(changedUpperIndex, undefined, `${label}变卦上卦真值缺失`);

        const meihua = generateMeihua(SAMPLE_DATE, {
          method: 'random',
          replay: [
            replaySampleForIndex(upperIndex, 8),
            replaySampleForIndex(lowerIndex, 8),
            replaySampleForIndex(movingYaoIndex, 6),
          ],
        });
        const liuyao = generateLiuyao(SAMPLE_DATE, {
          method: 'manual',
          yaos: mainLines.map((line, index) => {
            if (index === movingYaoIndex - 1) return line === 1 ? 9 : 6;
            return line === 1 ? 7 : 8;
          }),
        });

        assert.deepEqual(
          meihua.yaosDetail.map((yao) => (yao.yaoType === '阳' ? 1 : 0)),
          mainLines,
          `${label}梅花主卦爻序`,
        );
        assert.deepEqual(
          liuyao.yaosDetail.map((yao) => (yao.yaoType === '阳' ? 1 : 0)),
          mainLines,
          `${label}六爻主卦爻序`,
        );
        assert.deepEqual(
          [meihua.originalName, meihua.interName, meihua.changedName],
          [expectedMain, expectedInter, expectedChanged],
          `${label}梅花主互变`,
        );
        assert.equal(
          meihua.mainHexagram.upper,
          TRIGRAM_TRUTHS[upperIndex - 1].name,
          `${label}梅花主卦上卦`,
        );
        assert.equal(
          meihua.mainHexagram.lower,
          TRIGRAM_TRUTHS[lowerIndex - 1].name,
          `${label}梅花主卦下卦`,
        );
        assert.equal(
          meihua.interHexagram?.upper,
          TRIGRAM_TRUTHS[interUpperIndex].name,
          `${label}梅花互卦上卦`,
        );
        assert.equal(
          meihua.interHexagram?.lower,
          TRIGRAM_TRUTHS[interLowerIndex].name,
          `${label}梅花互卦下卦`,
        );
        assert.equal(
          meihua.changedHexagram?.upper,
          TRIGRAM_TRUTHS[changedUpperIndex].name,
          `${label}梅花变卦上卦`,
        );
        assert.equal(
          meihua.changedHexagram?.lower,
          TRIGRAM_TRUTHS[changedLowerIndex].name,
          `${label}梅花变卦下卦`,
        );
        assert.equal(meihua.movingYao.position, movingYaoIndex, `${label}梅花动爻`);
        assert.deepEqual(
          [liuyao.originalName, liuyao.interName, liuyao.changedName],
          [expectedMain, expectedInter, expectedChanged],
          `${label}六爻主互变`,
        );
        const liuyaoInterHexagram = hexagramsData.find(
          (hexagram) => hexagram.name === liuyao.interName,
        );
        const liuyaoChangedHexagram = hexagramsData.find(
          (hexagram) => hexagram.name === liuyao.changedName,
        );
        assert.ok(liuyaoInterHexagram, `${label}六爻互卦数据缺失`);
        assert.ok(liuyaoChangedHexagram, `${label}六爻变卦数据缺失`);
        assert.equal(
          liuyaoInterHexagram.binarySymbol,
          `${TRIGRAM_TRUTHS[interUpperIndex].lines.join('')}${TRIGRAM_TRUTHS[interLowerIndex].lines.join('')}`,
          `${label}六爻互卦卦画`,
        );
        assert.equal(
          liuyaoChangedHexagram.binarySymbol,
          `${TRIGRAM_TRUTHS[changedUpperIndex].lines.join('')}${TRIGRAM_TRUTHS[changedLowerIndex].lines.join('')}`,
          `${label}六爻变卦卦画`,
        );
        assert.deepEqual(
          liuyao.changingYaos.map((yao) => yao.position),
          [movingYaoIndex],
          `${label}六爻动爻`,
        );
      }
    }
  }
});
