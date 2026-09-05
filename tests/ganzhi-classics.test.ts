import { getNayin, getNayinWuxing } from '../packages/core/src/ganzhi/index.ts';
import { NAYIN_MAP } from '../packages/core/src/ganzhi/data.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getStemWuxing, getBranchWuxing, isLiuhe } from '../packages/core/src/ganzhi/index.ts';
import { isValidGanZhi } from '../packages/core/src/ganzhi/validation.ts';

test('干支五行与六合逐项对应《渊海子平》基础表', () => {
  const groups = {
    木: '甲乙寅卯',
    火: '丙丁巳午',
    土: '戊己辰戌丑未',
    金: '庚辛申酉',
    水: '壬癸亥子',
  };
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  for (const [element, characters] of Object.entries(groups))
    for (const character of characters) {
      assert.equal(
        stems.includes(character) ? getStemWuxing(character) : getBranchWuxing(character),
        element,
      );
    }
  const pairs = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
  for (const a of branches)
    for (const b of branches) {
      assert.equal(isLiuhe(a, b), pairs.includes(a + b) || pairs.includes(b + a), a + b);
    }
  let valid = 0;
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 12; j++) {
      const expected = i % 2 === j % 2;
      assert.equal(isValidGanZhi(stems[i] + branches[j]), expected);
      if (expected) valid++;
    }
  assert.equal(valid, 60);
});

test('六十甲子纳音五行逐对符合《碎金》乾象篇', () => {
  const pairs =
    '甲子乙丑 丙寅丁卯 戊辰己巳 庚午辛未 壬申癸酉 甲戌乙亥 丙子丁丑 戊寅己卯 庚辰辛巳 壬午癸未 甲申乙酉 丙戌丁亥 戊子己丑 庚寅辛卯 壬辰癸巳 甲午乙未 丙申丁酉 戊戌己亥 庚子辛丑 壬寅癸卯 甲辰乙巳 丙午丁未 戊申己酉 庚戌辛亥 壬子癸丑 甲寅乙卯 丙辰丁巳 戊午己未 庚申辛酉 壬戌癸亥'.split(
      ' ',
    );
  const elements = [...'金火木土金火水土金木水土火木水金火木土金火水土金木水土火木水'];
  const names =
    '海中金 炉中火 大林木 路旁土 剑锋金 山头火 涧下水 城头土 白蜡金 杨柳木 泉中水 屋上土 霹雳火 松柏木 长流水 沙中金 山下火 平地木 壁上土 金箔金 覆灯火 天河水 大驿土 钗钏金 桑柘木 大溪水 沙中土 天上火 石榴木 大海水'.split(
      ' ',
    );
  assert.equal(pairs.length, 30);
  assert.equal(elements.length, 30);
  const covered = new Set<string>();
  pairs.forEach((pair, index) => {
    for (const ganZhi of [pair.slice(0, 2), pair.slice(2)]) {
      assert.equal(getNayin(ganZhi), names[index], ganZhi);
      assert.equal(NAYIN_MAP[ganZhi], names[index]);
      assert.equal(getNayinWuxing(ganZhi), elements[index], ganZhi);
      assert.equal(NAYIN_MAP[ganZhi].slice(-1), elements[index], `${ganZhi}备用表`);
      covered.add(ganZhi);
    }
  });
  assert.equal(covered.size, 60);
  assert.equal(Object.keys(NAYIN_MAP).length, 60);
});
