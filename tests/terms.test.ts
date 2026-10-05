import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METAPHYSICS_TERMS,
  lookupMetaphysicsTerm,
  getBaziTermContext,
  getLiuyaoTermContext,
  getZiweiTermContext,
} from 'mingyu-core/terms';
import { baziCalculator } from 'mingyu-core/bazi';
import { STEM_WUXING } from 'mingyu-core/ganzhi';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';

const baziTermContextFixture = baziCalculator.calculateCoreBazi({
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 6,
  gender: 'male',
});

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
  for (const brightness of ['庙', '旺']) {
    const options = { palaceName: '命宫', starName: '太阴', brightness, mutagen: '忌' };
    const context = getZiweiTermContext('太阴', options);
    assert.equal(context?.dynamicTone, 'unlucky');
    assert.deepEqual(context, getZiweiTermContext('太阴', { ...options, mutagen: '化忌' }));
    assert.match(context!.relationshipSummary!, /四化：化忌/);
  }
  assert.equal(
    getZiweiTermContext('太阴', {
      palaceName: '命宫',
      starName: '太阴',
      brightness: '陷',
      mutagen: '禄',
    })?.dynamicTone,
    'lucky',
  );
});

test('八字术语按既有喜忌区分主辅与别名，从格取用不由身弱重新推断', () => {
  const bazi = structuredClone(baziTermContextFixture);
  bazi.analysis.dayMasterStrength.status = '身弱';
  bazi.analysis.mingGe.pattern = '从儿格';
  bazi.analysis.usefulGod = {
    favorable: ['正财', '食神'],
    unfavorable: ['正印', '偏印', '七杀'],
    primaryFavorable: ['正财'],
    secondaryFavorable: ['食神'],
    primaryUnfavorable: ['正印', '偏印'],
    secondaryUnfavorable: ['七杀'],
    useful: '财星',
    avoid: '印星',
  };
  const termCtx = getBaziTermContext('正印', bazi, { pillarLabel: '月柱' });
  assert.ok(termCtx, '应返回十神情境数据');
  assert.equal(termCtx.dynamicTone, 'unlucky');
  assert.match(termCtx.roleInChart, /列为主忌/);
  assert.match(termCtx.relationshipSummary!, /日主身弱 · 主用：财星 · 主忌：印星/);
  assert.match(getBaziTermContext('正财', bazi)!.roleInChart, /列为主用/);
  assert.match(getBaziTermContext('食神', bazi)!.roleInChart, /列为辅喜/);
  assert.match(getBaziTermContext('枭神', bazi)!.roleInChart, /列为主忌/);
  assert.match(getBaziTermContext('偏官', bazi)!.roleInChart, /列为次忌/);
  const patternContext = getBaziTermContext('从儿格', bazi)!;
  assert.equal(patternContext.dynamicTone, 'neutral');
  assert.match(patternContext.roleInChart, /格局为【从儿格】；主用：财星；主忌：印星/);
  assert.doesNotMatch(patternContext.roleInChart, /身弱喜印比/);

  bazi.analysis.usefulGod.favorable.push('正印');
  assert.equal(getBaziTermContext('正印', bazi)?.dynamicTone, 'neutral');
  bazi.analysis.usefulGod = { favorable: [], unfavorable: [], useful: '正印', avoid: '七杀' };
  const undecided = getBaziTermContext('正印', bazi)!;
  assert.equal(undecided.dynamicTone, 'neutral');
  assert.doesNotMatch(undecided.roleInChart, /列为|中临正印/);
});

test('八字术语只将有效六十甲子和天干五行名归为对应盘面事实', () => {
  const bazi = baziTermContextFixture;

  assert.equal(getBaziTermContext('甲子', bazi)?.chartTitle, '四柱干支气数');
  assert.equal(getBaziTermContext('甲木', bazi)?.chartTitle, '天干实盘作用');
  assert.equal(getBaziTermContext('甲丑', bazi), undefined);
  assert.equal(getBaziTermContext('甲火', bazi), undefined);
  assert.equal(getBaziTermContext('子土', bazi), undefined);
  assert.equal(getBaziTermContext('炉中火', bazi), undefined);
  assert.equal(
    getBaziTermContext('炉中火', bazi, { pillarLabel: '年柱', ganZhi: '丙寅' })?.chartTitle,
    '柱位纳音气象',
  );
  assert.equal(
    getBaziTermContext('炉中火', bazi, { pillarLabel: '年柱', ganZhi: '甲子' }),
    undefined,
  );
  const textOnly = structuredClone(bazi);
  textOnly.analysis.usefulGod = {
    favorable: [],
    unfavorable: [],
    useful: '甲',
    avoid: '子',
  };
  assert.equal(getBaziTermContext('甲木', textOnly)?.dynamicTone, 'neutral');
  assert.equal(getBaziTermContext('子水', textOnly)?.dynamicTone, 'neutral');
  const baseline = structuredClone(getBaziTermContext('甲木', bazi));
  assert.ok(baseline);
  assert.equal(baseline.chartTitle, '天干实盘作用');
  const original = STEM_WUXING.甲;
  try {
    STEM_WUXING.甲 = '水';
    assert.equal(STEM_WUXING.甲, '水');
    assert.deepEqual(getBaziTermContext('甲木', bazi), baseline);
    assert.equal(getBaziTermContext('甲水', bazi), undefined);
  } finally {
    STEM_WUXING.甲 = original;
  }
  assert.equal(STEM_WUXING.甲, original);
  assert.deepEqual(getBaziTermContext('甲木', bazi), baseline);
});

test('六爻术语盘面情境推断：应准确识别世爻、应爻与动变作用', () => {
  const liuyao = generateLiuyao(new Date('2024-06-01T12:00:00'));

  const worldYao = liuyao.yaosDetail.find((l) => l.isWorld);
  assert.ok(worldYao, '应存在世爻');

  const yaoInfo = {
    position: worldYao.position,
    sixRelative: worldYao.sixRelative,
    sixGod: worldYao.sixGod,
    isWorld: true,
    isChanging: worldYao.isChanging,
  };
  const termCtx = getLiuyaoTermContext('世爻', liuyao, yaoInfo);

  assert.ok(termCtx, '应返回六爻情境数据');
  assert.ok(termCtx.roleInChart.includes('自身立足点'), '应包含世爻主体解析');
  assert.equal(termCtx.dynamicTone, 'neutral');
  assert.equal(termCtx.pillarOrPalace, `世爻（第${worldYao.position}爻）`);
  assert.match(termCtx.relationshipSummary!, worldYao.isChanging ? /动爻/ : /静爻/);
  assert.deepEqual(getLiuyaoTermContext(worldYao.sixRelative, liuyao, yaoInfo), termCtx);
});
