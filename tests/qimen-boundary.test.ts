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
  getDaySeasonRelation,
  getSeasonalElement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality.ts';

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

test('奇门节令：未知节气或日干应明确报错，不应降级成无法判定', () => {
  assert.equal(getSeasonalElement('立春'), '木');
  assert.equal(getDaySeasonRelation('甲', '木').relation, '得时');
  assert.throws(() => getSeasonalElement('假节气'), /无法识别节气 "假节气" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('假', '木'), /无法识别日干 "假" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('甲', ''), /节令五行不能为空/);
});
