import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '@core/huangji-jingshi';

// 《皇极经世书绪言》中华书局聚珍仿宋本，第三册扫描第7页。
// NCL-002452169：小畜甲子起，甲戌蛊、甲申咸、甲午豫、甲辰随，癸亥需。
// 年份为现行纪元下的对应坐标；本例核对原文卦序及层级，不据此断定尧即位的公历年代。
test('皇极现行纪元下的小畜六十年卦序复现扫描本分直例题', () => {
  for (const [year, ganzhi, annual] of [
    [-2397, '甲子', '小畜'],
    [-2387, '甲戌', '蛊'],
    [-2377, '甲申', '咸'],
    [-2367, '甲午', '豫'],
    [-2357, '甲辰', '随'],
    [-2338, '癸亥', '需'],
  ] as const) {
    const forecast = calculateHuangjiJingshi({ year }).forecast!;
    assert.equal(forecast.hexagrams.governing.hexagram.shortName, '夬');
    assert.equal(forecast.hexagrams.yun.hexagram.shortName, '乾');
    assert.equal(forecast.hexagrams.sixtyYear.hexagram.shortName, '小畜');
    assert.equal(forecast.hexagrams.annual.ganzhi, ganzhi);
    assert.equal(forecast.hexagrams.annual.shortName, annual, `${year}年`);
  }
  const jiawu = calculateHuangjiJingshi({ year: -2367 }).forecast!;
  const jiachen = calculateHuangjiJingshi({ year: -2357 }).forecast!;
  assert.equal(jiawu.hexagrams.decade.hexagram.shortName, '乾');
  assert.equal(jiachen.hexagrams.decade.hexagram.shortName, '大畜');
});
