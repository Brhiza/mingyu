import assert from 'node:assert/strict';
import test from 'node:test';
import { jiazi } from '../packages/core/src/divination/divination-data';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import { getZhiFuZhiShiByGanZhi } from '../packages/core/src/divination/algorithms/qimen/helpers/jushu';
import {
  arrangeJiuGongGe,
  resolveZhiShiLandingPalace,
} from '../packages/core/src/divination/algorithms/qimen/helpers/layout';
import {
  getTianPanStemForStar,
  hasTianPanStar,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils';
import {
  getClassicPatterns,
  getStemRelations,
} from '../packages/core/src/divination/algorithms/qimen/helpers/classic-patterns';
import {
  evaluateStarPalaces,
  getZhiFuStarJudgement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/star-palace';

const outerPalaces = [1, 8, 3, 4, 9, 2, 7, 6];
const rotatingStars = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];
const doors = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];

function byGong<T extends { gong: number }>(items: T[]): Record<number, T> {
  return Object.fromEntries(items.map((item) => [item.gong, item]));
}

test('奇门转盘应完整复现芒种上元阳六局癸未时盘面', () => {
  const result = generateQimen(new Date('2024-06-15T14:30:00+08:00'));
  const palaces = byGong(result.jiuGongGe);

  assert.equal(result.ganzhi.day, '庚戌');
  assert.equal(result.ganzhi.hour, '癸未');
  assert.equal(result.timeInfo.solarTerm, '芒种');
  assert.equal(result.timeInfo.epoch, '上元');
  assert.equal(result.juShu, 6);
  assert.equal(result.zhiFu, '天柱');
  assert.equal(result.zhiShi, '惊门');

  assert.deepEqual(
    result.jiuGongGe.map((palace) => palace.diPan.stem),
    ['壬', '癸', '丁', '丙', '乙', '戊', '己', '庚', '辛'],
  );
  assert.deepEqual(
    Object.fromEntries(
      result.jiuGongGe
        .filter((palace) => palace.renPan.door)
        .map((palace) => [palace.gong, palace.renPan.door]),
    ),
    { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' },
  );
  assert.deepEqual(
    Object.fromEntries(
      result.jiuGongGe
        .filter((palace) => palace.tianPan.star)
        .map((palace) => [palace.gong, palace.tianPan.star]),
    ),
    { 1: '天任', 2: '天柱', 3: '天辅', 4: '天英', 6: '天蓬', 7: '天心', 8: '天冲', 9: '天芮' },
  );
  assert.equal(palaces[9].tianPan.companionStar, '天禽');
  assert.equal(palaces[9].tianPan.companionStem, '乙');
  assert.deepEqual(
    Object.fromEntries(
      result.jiuGongGe
        .filter((palace) => palace.shenPan.god)
        .map((palace) => [palace.gong, palace.shenPan.god]),
    ),
    { 1: '六合', 2: '值符', 3: '玄武', 4: '九地', 6: '太阴', 7: '螣蛇', 8: '白虎', 9: '九天' },
  );
});

test('奇门飞盘应复现元灵经阳九局天禽加兑古例', () => {
  const palaces = byGong(arrangeJiuGongGe(true, 9, '天禽', '死门', { hour: '丙辰' }, 'feipan'));

  assert.equal(palaces[5].diPan.stem, '癸');
  assert.equal(palaces[7].tianPan.star, '天禽');
  assert.equal(palaces[7].tianPan.stem, '癸');
  assert.equal(palaces[8].tianPan.star, '天心');
  assert.equal(palaces[9].tianPan.star, '天柱');
  assert.equal(palaces[7].renPan.door, '死门');
});

test('奇门飞盘应复现元灵经阴八局天任加中古例', () => {
  const palaces = byGong(arrangeJiuGongGe(false, 8, '天任', '生门', { hour: '辛未' }, 'feipan'));

  assert.equal(palaces[5].diPan.stem, '辛');
  assert.equal(palaces[5].tianPan.star, '天任');
  assert.equal(palaces[5].tianPan.stem, '戊');
  assert.equal(palaces[4].tianPan.star, '天英');
  assert.equal(palaces[3].tianPan.star, '天蓬');
  assert.equal(palaces[1].renPan.door, '生门');
});

test('奇门转盘值使最终落中时应按御定奇门宝鉴统一寄坤二', () => {
  assert.equal(resolveZhiShiLandingPalace(true, '休门', '戊辰', 1, 'zhuanpan'), 2);
  assert.equal(resolveZhiShiLandingPalace(false, '景门', '戊辰', 9, 'zhuanpan'), 2);
});

test('奇门九宫底层入口应拒绝非法阴阳遁、局数和干支结构', () => {
  const arrange = (...args: Parameters<typeof arrangeJiuGongGe>) => arrangeJiuGongGe(...args);

  assert.throws(
    () => arrange('阳遁' as unknown as boolean, 1, '天蓬', '休门', { hour: '甲子' }),
    /阴阳遁标记必须是布尔值/,
  );
  for (const juShu of [0, 1.5, 10, Number.NaN]) {
    assert.throws(
      () => arrange(true, juShu, '天蓬', '休门', { hour: '甲子' }),
      /奇门局数必须是 1-9 的整数/,
    );
  }
  assert.throws(
    () => arrange(true, 1, '天蓬', '休门', null as unknown as { hour: string }),
    /必须提供.*时辰干支/,
  );
  assert.throws(() => arrange(true, 1, '天蓬', '休门', { hour: '不存在' }), /无法识别干支/);
  assert.throws(
    () => resolveZhiShiLandingPalace(1 as unknown as boolean, '休门', '甲子', 1, 'zhuanpan'),
    /阴阳遁标记必须是布尔值/,
  );
});

test('奇门转盘天禽值符应随天芮落宫并保留自己所携中宫干', () => {
  const hour = '丙辰';
  const setup = getZhiFuZhiShiByGanZhi(hour, { isYangDun: true, juShu: 9 });
  const palaces = arrangeJiuGongGe(true, 9, setup.zhiFu, setup.zhiShi, { hour }, 'zhuanpan');
  const zhiFuPalace = palaces.find((palace) => hasTianPanStar(palace, setup.zhiFu));

  assert.equal(setup.zhiFu, '天禽');
  assert.equal(zhiFuPalace?.tianPan.star, '天芮');
  assert.equal(zhiFuPalace?.tianPan.companionStar, '天禽');
  assert.equal(zhiFuPalace?.tianPan.companionStem, palaces[4].diPan.stem);
  assert.notEqual(zhiFuPalace?.tianPan.stem, zhiFuPalace?.tianPan.companionStem);
  assert.equal(
    zhiFuPalace && getTianPanStemForStar(zhiFuPalace, '天禽'),
    zhiFuPalace?.tianPan.companionStem,
  );

  const starStates = evaluateStarPalaces({ jiuGongGe: palaces });
  assert.equal(starStates.length, 9);
  assert.equal(new Set(starStates.map((item) => item.star)).size, 9);
  assert.equal(starStates.find((item) => item.star === '天禽')?.gong, zhiFuPalace?.gong);
  assert.equal(
    getZhiFuStarJudgement({ jiuGongGe: palaces, zhiFu: '天禽' })?.gong,
    zhiFuPalace?.gong,
  );
});

test('奇门转盘中宫干随天禽时应参与三奇、入墓、击刑与天地盘格局判断', () => {
  const findPalaces = (isYangDun: boolean, juShu: number, targetGong: number) => {
    for (const hour of jiazi) {
      const setup = getZhiFuZhiShiByGanZhi(hour, { isYangDun, juShu });
      const palaces = arrangeJiuGongGe(
        isYangDun,
        juShu,
        setup.zhiFu,
        setup.zhiShi,
        { hour },
        'zhuanpan',
      );
      if (palaces[targetGong - 1].tianPan.companionStar === '天禽') {
        return { palaces, setup };
      }
    }
    throw new Error(`未找到${isYangDun ? '阳' : '阴'}遁${juShu}局天禽落${targetGong}宫样本`);
  };

  const yiRuMu = findPalaces(true, 6, 2);
  const yiPatterns = getClassicPatterns({
    jiuGongGe: yiRuMu.palaces,
    zhiFu: yiRuMu.setup.zhiFu,
    zhiShi: yiRuMu.setup.zhiShi,
  });
  const yiRelations = getStemRelations(yiRuMu.palaces);
  assert.equal(yiRuMu.palaces[1].tianPan.companionStem, '乙');
  assert.ok(yiPatterns.some((pattern) => pattern.name === '日奇入墓' && pattern.palace === 2));
  assert.ok(yiPatterns.some((pattern) => pattern.name === '乙入墓' && pattern.palace === 2));
  assert.ok(
    yiRelations.some(
      (relation) => relation.heaven === '乙' && relation.earth === '癸' && relation.palace === 2,
    ),
  );

  const yiDeShi = findPalaces(true, 6, 9);
  const deShiPatterns = getClassicPatterns({
    jiuGongGe: yiDeShi.palaces,
    zhiFu: yiDeShi.setup.zhiFu,
    zhiShi: yiDeShi.setup.zhiShi,
  });
  assert.equal(yiDeShi.palaces[8].tianPan.companionStem, '乙');
  assert.equal(yiDeShi.palaces[8].diPan.stem, '辛');
  assert.ok(deShiPatterns.some((pattern) => pattern.name === '日奇得使' && pattern.palace === 9));

  const gengJiXing = findPalaces(true, 3, 8);
  const jiXingPatterns = getClassicPatterns({
    jiuGongGe: gengJiXing.palaces,
    zhiFu: gengJiXing.setup.zhiFu,
    zhiShi: gengJiXing.setup.zhiShi,
  });
  assert.equal(gengJiXing.palaces[7].tianPan.companionStem, '庚');
  assert.ok(jiXingPatterns.some((pattern) => pattern.name === '庚击刑' && pattern.palace === 8));
});

test('奇门证据提示词应完整展示天芮天禽及各自所携天盘干', () => {
  const result = generateQimen(new Date('2024-06-15T14:30:00+08:00'));
  const companionFact = result.evidenceAnalysis?.palaceFacts.find(
    (fact) => fact.tianPan.companionStar === '天禽',
  );

  assert.ok(companionFact);
  assert.match(companionFact.promptText, /天盘干癸、乙，九星天芮、天禽/);
});

test('奇门18局六十时辰转盘结构应始终完整且值符值使落点一致', () => {
  for (const isYangDun of [true, false]) {
    for (let juShu = 1; juShu <= 9; juShu++) {
      for (const hour of jiazi) {
        const { zhiFu, zhiShi, xunShouPalace } = getZhiFuZhiShiByGanZhi(hour, {
          isYangDun,
          juShu,
        });
        const palaces = arrangeJiuGongGe(isYangDun, juShu, zhiFu, zhiShi, { hour });
        const center = palaces[4];
        const outer = outerPalaces.map((gong) => palaces[gong - 1]);

        assert.equal(new Set(palaces.map((palace) => palace.diPan.stem)).size, 9);
        assert.equal(center.tianPan.star, '');
        assert.equal(center.renPan.door, '');
        assert.equal(center.shenPan.god, '');
        assert.deepEqual(
          new Set(outer.map((palace) => palace.tianPan.star)),
          new Set(rotatingStars),
        );
        assert.deepEqual(new Set(outer.map((palace) => palace.renPan.door)), new Set(doors));
        assert.equal(outer.filter((palace) => palace.shenPan.god).length, 8);

        const tianRui = outer.find((palace) => palace.tianPan.star === '天芮');
        assert.equal(tianRui?.tianPan.companionStar, '天禽');
        assert.equal(tianRui?.tianPan.companionStem, center.diPan.stem);

        const expectedZhiFuPalace = (() => {
          const hourStem = hour.startsWith('甲')
            ? { 甲子: '戊', 甲戌: '己', 甲申: '庚', 甲午: '辛', 甲辰: '壬', 甲寅: '癸' }[hour]
            : hour.charAt(0);
          const palace = palaces.find((item) => item.diPan.stem === hourStem)?.gong;
          return palace === 5 ? 2 : palace;
        })();
        assert.equal(
          palaces.find((palace) => hasTianPanStar(palace, zhiFu))?.gong,
          expectedZhiFuPalace,
        );
        assert.equal(
          palaces.find((palace) => palace.renPan.door === zhiShi)?.gong,
          resolveZhiShiLandingPalace(isYangDun, zhiShi, hour, xunShouPalace, 'zhuanpan'),
        );
      }
    }
  }
});
