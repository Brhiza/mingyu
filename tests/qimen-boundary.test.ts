import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import {
  getDoorElement as getDoorElementFromPalaceUtils,
  getDunJiaStem,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils.ts';
import {
  analyzePalaceRelations,
  getDoorElement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-relations.ts';
import {
  evaluateSingleStar,
  getZhiFuStarJudgement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/star-palace.ts';
import {
  getDayOfficerInfo,
  getDaySeasonRelation,
  getLunarPhase,
  getLunarPhaseByIndex,
  getSeasonalElement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality.ts';
import {
  getMonthQimenJuShu,
  getYearQimenJuShu,
} from '../packages/core/src/divination/algorithms/qimen/helpers/jushu-extended.ts';
import { getQimenPatternTags } from '../packages/core/src/divination/algorithms/qimen/helpers/patterns.ts';
import {
  getNamedStemPairPattern,
  getStemPairPattern,
} from '../packages/core/src/divination/algorithms/qimen/helpers/stem-pair-patterns.ts';
import { estimateYingQi } from '../packages/core/src/divination/algorithms/qimen/helpers/ying-qi.ts';

test('奇门拆补法在交节当天应按具体时刻换节气，不应按整日提前换局', () => {
  const beforeXiaoman = generateQimen(new Date('2024-05-20T10:00:00+08:00'));
  assert.equal(beforeXiaoman.timeInfo.solarTerm, '立夏');
  assert.equal(beforeXiaoman.seasonality?.currentJieQi, '立夏');
  assert.equal(beforeXiaoman.timeInfo.epoch, '下元');
  assert.equal(beforeXiaoman.juShu, 7);

  const afterXiaoman = generateQimen(new Date('2024-05-20T21:30:00+08:00'));
  assert.equal(afterXiaoman.timeInfo.solarTerm, '小满');
  assert.equal(afterXiaoman.seasonality?.currentJieQi, '小满');
  assert.equal(afterXiaoman.timeInfo.epoch, '上元');
  assert.equal(afterXiaoman.juShu, 5);
});

test('奇门拆补法定三元应按晚子时日柱推进符头日', () => {
  const beforeLateZi = generateQimen(new Date('2024-02-19T22:30:00+08:00'));
  assert.equal(beforeLateZi.ganzhi.day, '癸丑');
  assert.equal(beforeLateZi.timeInfo.solarTerm, '立春');
  assert.equal(beforeLateZi.timeInfo.epoch, '下元');
  assert.equal(beforeLateZi.juShu, 2);

  const lateZi = generateQimen(new Date('2024-02-19T23:30:00+08:00'));
  assert.equal(lateZi.ganzhi.day, '甲寅');
  assert.equal(lateZi.timeInfo.solarTerm, '雨水');
  assert.equal(lateZi.timeInfo.epoch, '上元');
  assert.equal(lateZi.juShu, 9);

  const jingzheLateZi = generateQimen(new Date('2024-03-10T23:30:00+08:00'));
  assert.equal(jingzheLateZi.ganzhi.day, '甲戌');
  assert.equal(jingzheLateZi.timeInfo.solarTerm, '惊蛰');
  assert.equal(jingzheLateZi.timeInfo.epoch, '上元');
  assert.equal(jingzheLateZi.juShu, 1);
});

test('奇门排盘：未知排盘级别应明确报错，不应静默当作时家盘', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'zhuanpan',
        'quarter' as Parameters<typeof generateQimen>[2],
      ),
    /未知的奇门排盘级别/,
  );
});

test('奇门排盘：未知排盘方法应明确报错，不应静默当作飞盘', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'unknown-method' as Parameters<typeof generateQimen>[1],
      ),
    /未知的奇门排盘方法/,
  );
});

test('奇门遁干：非法干支应明确报错，不应把未知六甲默认遁戊', () => {
  assert.equal(getDunJiaStem('甲子'), '戊');
  assert.equal(getDunJiaStem('乙丑'), '乙');
  assert.throws(() => getDunJiaStem('甲丑'), /无法识别干支/);
});

test('奇门门星神关系：未知门星神应明确报错，不应当成比和', () => {
  assert.equal(getDoorElement('休门'), '水');
  assert.throws(() => getDoorElement('假门'), /八门 "假门" 无法识别/);
  assert.throws(() => getDoorElementFromPalaceUtils('假门'), /八门 "假门" 无法识别/);
  assert.throws(
    () =>
      analyzePalaceRelations({
        renPan: { door: '假门' },
        tianPan: { star: '天蓬', stem: '戊' },
        shenPan: { god: '值符' },
      }),
    /八门 "假门" 无法识别/,
  );
});

test('奇门门星神关系应返回逐项关系与计数，不展示综合评分', () => {
  const result = analyzePalaceRelations({
    renPan: { door: '休门' },
    tianPan: { star: '天蓬', stem: '戊' },
    shenPan: { god: '值符' },
  });

  assert.deepEqual(
    [result.doorStar.relation, result.doorGod.relation, result.starGod.relation],
    ['比和', '相克', '相克'],
  );
  assert.deepEqual(result.relationCounts, { supporting: 1, controlling: 2 });
  assert.doesNotMatch(result.description, /综合评分|\d+\s*\/\s*3/);
  assert.match(result.description, /不能压缩成单一吉凶结论/);
});

test('奇门九星旺衰：未知星或非法宫位应明确报错，不应默认休囚', () => {
  assert.equal(evaluateSingleStar('天蓬', 1, '水').state, '旺');
  assert.throws(() => evaluateSingleStar('假星', 1, '水'), /九星 "假星" 无法识别/);
  assert.throws(() => evaluateSingleStar('天蓬', 10, '水'), /宫位 "10" 无效/);
  assert.throws(() => evaluateSingleStar('天蓬', 1, '风'), /宫位五行 "风" 无法识别/);
  assert.throws(
    () =>
      getZhiFuStarJudgement({
        zhiFu: '天英',
        jiuGongGe: [{ gong: 1, element: '水', tianPan: { star: '天蓬' } }],
      }),
    /找不到值符星 "天英" 的落宫/,
  );
});

test('月家与年家奇门应校验完整干支，不应只读取单个天干或地支', () => {
  assert.deepEqual(getMonthQimenJuShu('丙寅', '甲辰'), {
    isYangDun: true,
    juShu: 1,
    yuan: '月局',
  });
  assert.throws(() => getMonthQimenJuShu('甲丑', '甲辰'), /月干支不是有效六十甲子/);
  assert.throws(() => getMonthQimenJuShu('丙寅', '甲丑'), /年干支不是有效六十甲子/);
  assert.throws(() => getYearQimenJuShu('甲丑'), /年干支不是有效六十甲子/);
});

test('奇门格局应拒绝未知值符和值使，不应按零宫位继续判断', () => {
  const baseParams = {
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 1,
    zhiShiLandingPalace: 1,
    jiuGongGe: [],
    hourGanForFind: '戊',
  };

  assert.throws(
    () => getQimenPatternTags({ ...baseParams, zhiFu: '假星' }),
    /值符星 "假星" 无法识别/,
  );
  assert.throws(
    () => getQimenPatternTags({ ...baseParams, zhiShi: '假门' }),
    /值使门 "假门" 无法识别/,
  );
});

test('奇门节令：未知节气或日干应明确报错，不应降级成无法判定', () => {
  assert.equal(getSeasonalElement('立春'), '木');
  assert.equal(getDaySeasonRelation('甲', '木').relation, '得时');
  assert.throws(() => getSeasonalElement('假节气'), /无法识别节气 "假节气" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('假', '木'), /无法识别日干 "假" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('甲', ''), /节令五行不能为空/);
});

test('奇门月相与建除映射缺失时应报错，不得默认新月或平', () => {
  assert.equal(getLunarPhaseByIndex(0), '新月');
  assert.equal(getLunarPhaseByIndex(7), '下弦');
  assert.equal(getDayOfficerInfo('成').fortune, '吉');
  assert.throws(() => getLunarPhaseByIndex(8), /无法识别历法月相索引/);
  assert.throws(() => getLunarPhase(new Date(Number.NaN)), /月相日期必须是有效日期/);
  assert.throws(() => getDayOfficerInfo('未知'), /无法识别建除十二神/);
});

test('奇门十干格局应正常返回合法组合并拒绝非法输入', () => {
  assert.ok(getStemPairPattern('壬', '癸'));
  assert.equal(getStemPairPattern('甲', '癸').name, '生');
  assert.equal(getNamedStemPairPattern('壬', '癸')?.name, '螣蛇飞空');
  assert.throws(() => getStemPairPattern('A', '癸'), /合法十天干/);
  assert.throws(() => getNamedStemPairPattern('A', '癸'), /合法十天干/);
});

test('奇门应期必须有明确基准宫并校验宫位与日干', () => {
  assert.throws(() => estimateYingQi([]), /必须提供用神落宫/);
  assert.throws(() => estimateYingQi([], 0), /用神落宫必须是 1-9/);
  assert.throws(() => estimateYingQi([], 1, { dayGanZhi: 'A子' }), /无法识别日干/);
});

test('奇门定局方法应支持拆补与置闰，并在结果中标明', () => {
  const date = new Date('2024-05-20T21:30:00+08:00');
  const chaibu = generateQimen(date, 'zhuanpan', 'hour', 'chaibu');
  const zhirun = generateQimen(date, 'zhuanpan', 'hour', 'zhirun');

  assert.equal(chaibu.juMethod, 'chaibu');
  assert.equal(zhirun.juMethod, 'zhirun');
  assert.equal(chaibu.timeInfo.juMethod, 'chaibu');
  assert.equal(zhirun.timeInfo.juMethod, 'zhirun');
  assert.match(String(chaibu.timeInfo.juMethodNote ?? ''), /拆补/);
  assert.match(String(zhirun.timeInfo.juMethodNote ?? ''), /置闰|符头|接气|超神|正授/);
  // 不得静默退回拆补标签
  assert.notEqual(zhirun.juMethod, 'chaibu');
});

test('奇门未知定局方法应明确报错', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'zhuanpan',
        'hour',
        'unknown' as 'chaibu',
      ),
    /未知的奇门定局方法/,
  );
});
