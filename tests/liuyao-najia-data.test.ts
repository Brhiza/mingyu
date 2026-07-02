import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hexagramNaJia as appHexagramNaJia } from '../src/config/divination-data.ts';
import { getSixAnimals } from '../packages/core/src/calendar/lunar.ts';
import { hexagramNaJia as coreHexagramNaJia } from '../packages/core/src/divination/divination-data.ts';

/**
 * 六爻纳甲规则回归测试
 *
 * 传统京房纳甲定例：一个六画卦的下三爻（内卦）按其所属八纯卦的内卦地支纳支，
 * 上三爻（外卦）按其所属八纯卦的外卦地支纳支，与几世卦、游魂、归魂无关，
 * 一律按上下经卦所属纯卦分别套用。
 *
 * 此前 hexagramNaJia 中 19 个四世/五世/游魂/归魂卦的外卦地支套错纯卦
 * （误用了外卦所属纯卦的内卦地支或其他地支），导致六亲、用神判断失真。
 * 本测试以规则推导全 64 卦期望值，防止该类错误回归。
 */

// 八纯卦内卦 / 外卦纳甲地支（阳四宫顺行、阴四宫逆行）
const pureNaJia: Record<string, { inner: string[]; outer: string[] }> = {
  乾: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  坎: { inner: ['寅', '辰', '午'], outer: ['申', '戌', '子'] },
  艮: { inner: ['辰', '午', '申'], outer: ['戌', '子', '寅'] },
  震: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  巽: { inner: ['丑', '亥', '酉'], outer: ['未', '巳', '卯'] },
  离: { inner: ['卯', '丑', '亥'], outer: ['酉', '未', '巳'] },
  坤: { inner: ['未', '巳', '卯'], outer: ['丑', '亥', '酉'] },
  兑: { inner: ['巳', '卯', '丑'], outer: ['亥', '酉', '未'] },
};

// 64 卦 → [上经卦, 下经卦]（所属八纯卦）。按八宫顺序列出。
const trigrams: Record<string, [string, string]> = {
  // 乾宫（金）
  乾为天: ['乾', '乾'],
  天风姤: ['乾', '巽'],
  天山遁: ['乾', '艮'],
  天地否: ['乾', '坤'],
  风地观: ['巽', '坤'],
  山地剥: ['艮', '坤'],
  火地晋: ['离', '坤'],
  火天大有: ['离', '乾'],
  // 坎宫（水）
  坎为水: ['坎', '坎'],
  水泽节: ['坎', '兑'],
  水雷屯: ['坎', '震'],
  水火既济: ['坎', '离'],
  泽火革: ['兑', '离'],
  雷火丰: ['震', '离'],
  地火明夷: ['坤', '离'],
  地水师: ['坤', '坎'],
  // 艮宫（土）
  艮为山: ['艮', '艮'],
  山火贲: ['艮', '离'],
  山天大畜: ['艮', '乾'],
  山泽损: ['艮', '兑'],
  火泽睽: ['离', '兑'],
  天泽履: ['乾', '兑'],
  风泽中孚: ['巽', '兑'],
  风山渐: ['巽', '艮'],
  // 震宫（木）
  震为雷: ['震', '震'],
  雷地豫: ['震', '坤'],
  雷水解: ['震', '坎'],
  雷风恒: ['震', '巽'],
  地风升: ['坤', '巽'],
  水风井: ['坎', '巽'],
  泽风大过: ['兑', '巽'],
  泽雷随: ['兑', '震'],
  // 巽宫（木）
  巽为风: ['巽', '巽'],
  风天小畜: ['巽', '乾'],
  风火家人: ['巽', '离'],
  风雷益: ['巽', '震'],
  天雷无妄: ['乾', '震'],
  火雷噬嗑: ['离', '震'],
  山雷颐: ['艮', '震'],
  山风蛊: ['艮', '巽'],
  // 离宫（火）
  离为火: ['离', '离'],
  火山旅: ['离', '艮'],
  火风鼎: ['离', '巽'],
  火水未济: ['离', '坎'],
  山水蒙: ['艮', '坎'],
  风水涣: ['巽', '坎'],
  天水讼: ['乾', '坎'],
  天火同人: ['乾', '离'],
  // 坤宫（土）
  坤为地: ['坤', '坤'],
  地雷复: ['坤', '震'],
  地泽临: ['坤', '兑'],
  地天泰: ['坤', '乾'],
  雷天大壮: ['震', '乾'],
  泽天夬: ['兑', '乾'],
  水天需: ['坎', '乾'],
  水地比: ['坎', '坤'],
  // 兑宫（金）
  兑为泽: ['兑', '兑'],
  泽水困: ['兑', '坎'],
  泽地萃: ['兑', '坤'],
  泽山咸: ['兑', '艮'],
  水山蹇: ['坎', '艮'],
  地山谦: ['坤', '艮'],
  雷山小过: ['震', '艮'],
  雷泽归妹: ['震', '兑'],
};

test('六爻纳甲：核心包全 64 卦按上下经卦所属纯卦分别纳甲', () => {
  for (const [name, [upper, lower]] of Object.entries(trigrams)) {
    const expected = [...pureNaJia[lower].inner, ...pureNaJia[upper].outer];
    assert.deepEqual(
      coreHexagramNaJia[name],
      expected,
      `${name} 纳甲不符规则（上${upper}下${lower}）：应为 ${expected.join('')}，实际 ${coreHexagramNaJia[name].join('')}`,
    );
  }
});

test('六爻纳甲：前端配置与核心包保持一致', () => {
  for (const name of Object.keys(trigrams)) {
    assert.deepEqual(
      appHexagramNaJia[name],
      coreHexagramNaJia[name],
      `${name} 前端配置与核心包不一致`,
    );
  }
});

test('六爻纳甲：覆盖全 64 卦，无遗漏', () => {
  assert.equal(Object.keys(trigrams).length, 64, '上下经卦归属表应为 64 卦');
  for (const name of Object.keys(trigrams)) {
    assert.ok(coreHexagramNaJia[name], `${name} 缺失纳甲数据`);
    assert.equal(coreHexagramNaJia[name].length, 6, `${name} 纳甲应为 6 爻`);
  }
});

test('六爻六神：按日干从初爻起六神，使用螣蛇标准写法', () => {
  const expectedByDayStem: Record<string, string[]> = {
    甲: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
    乙: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
    丙: ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'],
    丁: ['朱雀', '勾陈', '螣蛇', '白虎', '玄武', '青龙'],
    戊: ['勾陈', '螣蛇', '白虎', '玄武', '青龙', '朱雀'],
    己: ['螣蛇', '白虎', '玄武', '青龙', '朱雀', '勾陈'],
    庚: ['白虎', '玄武', '青龙', '朱雀', '勾陈', '螣蛇'],
    辛: ['白虎', '玄武', '青龙', '朱雀', '勾陈', '螣蛇'],
    壬: ['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'],
    癸: ['玄武', '青龙', '朱雀', '勾陈', '螣蛇', '白虎'],
  };

  for (const [dayStem, expected] of Object.entries(expectedByDayStem)) {
    assert.deepEqual(getSixAnimals(dayStem), expected, `${dayStem}日六神起法不正确`);
  }
});
