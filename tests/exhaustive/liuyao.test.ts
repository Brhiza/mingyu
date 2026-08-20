import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';

const YAO_VALUES = [6, 7, 8, 9] as const;
const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');

const TRIGRAM_TRUTHS = [
  { name: '乾', lines: [1, 1, 1] },
  { name: '兑', lines: [1, 1, 0] },
  { name: '离', lines: [1, 0, 1] },
  { name: '震', lines: [1, 0, 0] },
  { name: '巽', lines: [0, 1, 1] },
  { name: '坎', lines: [0, 1, 0] },
  { name: '艮', lines: [0, 0, 1] },
  { name: '坤', lines: [0, 0, 0] },
] as const;

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
  if (lines.length !== 6) {
    throw new Error(`六爻真值必须包含 6 个爻：${lines.join('')}`);
  }
  const lowerIndex = trigramIndexByLines.get(lines.slice(0, 3).join(''));
  const upperIndex = trigramIndexByLines.get(lines.slice(3, 6).join(''));
  if (lowerIndex === undefined || upperIndex === undefined) {
    throw new Error(`六爻真值无法解析：${lines.join('')}`);
  }
  return HEXAGRAM_NAME_TRUTHS[upperIndex][lowerIndex];
}

function enumerateYaos(): number[][] {
  const result: number[][] = [];
  for (let n = 0; n < 4 ** 6; n += 1) {
    let value = n;
    const yaos: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      yaos.push(YAO_VALUES[value % 4]);
      value = Math.floor(value / 4);
    }
    result.push(yaos);
  }
  return result;
}

test('六爻手工起卦4096种爻值组合应逐项复现独立卦名与动变真值', () => {
  const allYaos = enumerateYaos();
  assert.equal(allYaos.length, 4096);

  for (const yaos of allYaos) {
    const data = generateLiuyao(SAMPLE_DATE, { yaos });
    const mainLines = yaos.map((value) => (value === 7 || value === 9 ? 1 : 0));
    const changedLines = yaos.map((value, index) => {
      if (value === 6) return 1;
      if (value === 9) return 0;
      return mainLines[index];
    });
    const interLines = [...mainLines.slice(1, 4), ...mainLines.slice(2, 5)];
    const expectedMain = hexagramNameFromBottomUpLines(mainLines);
    const expectedInter = hexagramNameFromBottomUpLines(interLines);
    const expectedChanged = hexagramNameFromBottomUpLines(changedLines);
    const expectedChanging = yaos
      .map((value, index) => (value === 6 || value === 9 ? index + 1 : 0))
      .filter(Boolean);
    const label = yaos.join(',');

    assert.deepEqual(data.yaoArray, yaos, label);
    assert.equal(data.originalName, expectedMain, label);
    assert.equal(data.interName, expectedInter, label);
    assert.equal(data.changedName, expectedChanged, label);
    assert.deepEqual(
      data.yaosDetail.map((yao) => (yao.yaoType === '阳' ? 1 : 0)),
      mainLines,
      label,
    );
    assert.deepEqual(
      data.changingYaos.map((yao) => yao.position),
      expectedChanging,
      label,
    );
  }
});
