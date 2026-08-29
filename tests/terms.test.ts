import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METAPHYSICS_TERMS,
  lookupMetaphysicsTerm,
  getBaziTermContext,
  getLiuyaoTermContext,
} from 'mingyu-core/terms';
import { baziCalculator } from 'mingyu-core/bazi';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';

test('术语词典库：应覆盖各主要术数门类并支持精准与模糊检索', () => {
  assert.ok(METAPHYSICS_TERMS.length > 150, '术语库条目数量应大于150条');

  // 八字天干
  const jiaMu = lookupMetaphysicsTerm('甲木');
  assert.ok(jiaMu, '应能检索到甲木');
  assert.equal(jiaMu?.category, '八字');
  assert.ok(jiaMu?.positive?.includes('开创'), '应包含辩证优势');
  assert.ok(jiaMu?.negative?.includes('刚直'), '应包含风险警示');

  // 塔罗大阿卡纳
  const fool = lookupMetaphysicsTerm('愚者');
  assert.ok(fool, '应能检索到愚者');
  assert.equal(fool?.category, '塔罗');
  assert.ok(
    fool?.classicRef?.includes('The Fool') || fool?.aliases?.includes('0号牌'),
    '应包含塔罗对应牌名或牌号',
  );

  // 雷诺曼牌
  const rider = lookupMetaphysicsTerm('骑士');
  assert.ok(rider, '应能检索到骑士');
  assert.equal(rider?.category, '雷诺曼');

  // 紫微主星
  const ziwei = lookupMetaphysicsTerm('紫微星');
  assert.ok(ziwei, '应能检索到紫微星');
  assert.equal(ziwei?.category, '紫微');
});

test('八字术语盘面情境推断：应根据日主旺衰与喜忌动态生成角色', () => {
  const bazi = baziCalculator.calculateCoreBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 6,
    gender: 'male',
  });

  const termCtx = getBaziTermContext('正官', bazi, { pillarLabel: '月柱' });
  assert.ok(termCtx, '应返回十神情境数据');
  assert.ok(termCtx.roleInChart.length > 10, '应生成具体的盘面作用解析');
  assert.ok(termCtx.relationshipSummary?.includes('日主'), '应包含日主旺衰与格局摘要');
});

test('六爻术语盘面情境推断：应准确识别世爻、应爻与动变作用', () => {
  const liuyao = generateLiuyao(new Date('2024-06-01T12:00:00'));

  const worldYao = liuyao.yaosDetail.find((l) => l.isWorld);
  assert.ok(worldYao, '应存在世爻');

  const termCtx = getLiuyaoTermContext('世爻', liuyao, {
    position: worldYao.position,
    sixRelative: worldYao.sixRelative,
    sixGod: worldYao.sixGod,
    isWorld: true,
    isChanging: worldYao.isChanging,
  });

  assert.ok(termCtx, '应返回六爻情境数据');
  assert.ok(termCtx.roleInChart.includes('自身立足点'), '应包含世爻主体解析');
});
