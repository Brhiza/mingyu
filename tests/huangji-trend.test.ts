import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiJingshi } from '@core/huangji-jingshi';
import { evaluateHuangjiEraTrend } from '../packages/core/src/huangji-jingshi/trend';
import { hexagramsData } from '../packages/core/src/divination/hexagram-data';

// 《朱子语类》卷六十五先天图：震、离、兑、乾一边属阳，巽、坎、艮、坤一边属阴。
// https://www.shidianguji.com/zh/book/NGJ89241199900857619816/chapter/1lwrimy88s1sa
const yangCounts: Record<string, number> = {
  乾: 3,
  兑: 2,
  离: 2,
  震: 1,
  巽: 2,
  坎: 1,
  艮: 1,
  坤: 0,
};

test('皇极圆图六十四卦均按卦画计数并按内卦划分阴阳半周', () => {
  const base = calculateHuangjiJingshi({ year: 2026 }).forecast!;
  for (const hexagram of hexagramsData) {
    const shortName = hexagram.upper === hexagram.lower ? hexagram.upper : hexagram.name.slice(2);
    const forecast = structuredClone(base);
    forecast.hexagrams.annual = { ...base.hexagrams.annual, ...hexagram, shortName };
    const result = evaluateHuangjiEraTrend(forecast);
    const yang = yangCounts[hexagram.upper] + yangCounts[hexagram.lower];
    assert.equal(result.yangLineCount, yang, hexagram.name);
    assert.equal(result.yinLineCount, 6 - yang, hexagram.name);
    const phase =
      shortName === '乾'
        ? '极盛防变'
        : ['坤', '剥'].includes(shortName)
          ? '剥极将生'
          : ['震', '离', '兑', '乾'].includes(hexagram.lower)
            ? '阳息进取'
            : '阴消蓄养';
    assert.equal(result.phase, phase, hexagram.name);
    assert.match(result.summary, new RegExp(`${yang}阳${6 - yang}阴`));
    assert.doesNotMatch(result.summary, /处于.*期|气机进取|万物收敛/);
  }
});

test('皇极实际值年鼎卦应为四阳二阴且属于姤至坤半周', () => {
  const result = calculateHuangjiJingshi({ year: 1984 });
  assert.equal(result.forecast!.hexagrams.annual.shortName, '鼎');
  assert.equal(result.eraTrend!.yangLineCount, 4);
  assert.equal(result.eraTrend!.yinLineCount, 2);
  assert.equal(result.eraTrend!.phase, '阴消蓄养');
  assert.match(result.prompt, /4阳2阴/);
  assert.match(result.prompt, /姤至坤/);
});

test('皇极消息分析拒绝不存在或互相矛盾的值年卦资料', () => {
  const base = calculateHuangjiJingshi({ year: 2026 }).forecast!;
  for (const patch of [{ id: 0 }, { shortName: '未知' }, { lower: '坤' }, { name: '地水师' }]) {
    const forecast = structuredClone(base);
    Object.assign(forecast.hexagrams.annual, patch);
    assert.throws(() => evaluateHuangjiEraTrend(forecast), /值年卦/);
  }
});
