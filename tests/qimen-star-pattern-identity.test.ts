import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import { getZhiFuZhiShiByGanZhi } from '../packages/core/src/divination/algorithms/qimen/helpers/jushu';
import {
  arrangeJiuGongGe,
  resolveZhiShiLandingPalace,
  type QimenMethod,
} from '../packages/core/src/divination/algorithms/qimen/helpers/layout';
import {
  getDunJiaStem,
  hasTianPanStar,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils';
import { getQimenPatternTags } from '../packages/core/src/divination/algorithms/qimen/helpers/patterns';
import { buildDivinationPrompt } from '../src/lib/divination/engine';

function getLayoutTags(isYangDun: boolean, juShu: number, hour: string, method: QimenMethod) {
  const setup = getZhiFuZhiShiByGanZhi(hour, { isYangDun, juShu });
  const jiuGongGe = arrangeJiuGongGe(isYangDun, juShu, setup.zhiFu, setup.zhiShi, { hour }, method);
  const zhiFuLandingPalace = jiuGongGe.find((palace) => hasTianPanStar(palace, setup.zhiFu))!.gong;
  const tags = getQimenPatternTags({
    ...setup,
    jiuGongGe,
    zhiFuLandingPalace,
    zhiShiLandingPalace: resolveZhiShiLandingPalace(
      isYangDun,
      setup.zhiShi,
      hour,
      setup.xunShouPalace,
      method,
    ),
    activeGanForFind: getDunJiaStem(hour),
  });
  return { tags, jiuGongGe, zhiFuLandingPalace };
}

test('转盘天禽值符寄坤且九星归位时应识别星伏吟', () => {
  const { tags, jiuGongGe, zhiFuLandingPalace } = getLayoutTags(true, 5, '甲子', 'zhuanpan');
  assert.equal(zhiFuLandingPalace, 2);
  assert.deepEqual(
    jiuGongGe.map((palace) => palace.tianPan.star),
    ['天蓬', '天芮', '天冲', '天辅', '', '天心', '天柱', '天任', '天英'],
  );
  assert.equal(jiuGongGe[1].tianPan.companionStar, '天禽');
  assert.ok(tags.includes('星伏吟'));
  assert.ok(!tags.includes('星反吟'));
});

test('阴遁飞盘天禽居中而外宫九星对冲时应识别星反吟', () => {
  const { tags, jiuGongGe } = getLayoutTags(false, 5, '甲子', 'feipan');
  assert.deepEqual(
    jiuGongGe.map((palace) => palace.tianPan.star),
    ['天英', '天任', '天柱', '天心', '天禽', '天辅', '天冲', '天芮', '天蓬'],
  );
  assert.ok(tags.includes('星反吟'));
  assert.ok(!tags.includes('星伏吟'));
});

test('飞盘仅值符星临对宫时不应把全盘标为星反吟', () => {
  const { tags, jiuGongGe, zhiFuLandingPalace } = getLayoutTags(true, 1, '乙丑', 'feipan');
  assert.equal(zhiFuLandingPalace, 9);
  assert.equal(jiuGongGe[0].tianPan.star, '天芮');
  assert.equal(jiuGongGe[7].tianPan.star, '天英');
  assert.ok(!tags.includes('星反吟'));
  assert.ok(!tags.includes('星伏吟'));
});

test('天禽值符实盘的星伏吟与星反吟进入应期及完整提示词', () => {
  for (const [date, expected, excluded] of [
    ['2026-01-01T00:00:00+08:00', '星伏吟', '星反吟'],
    ['2026-01-01T12:00:00+08:00', '星反吟', '星伏吟'],
  ]) {
    const data = generateQimen(new Date(date));
    assert.equal(data.zhiFu, '天禽');
    assert.ok(data.patternTags?.includes(expected));
    assert.ok(!data.patternTags?.includes(excluded));
    assert.ok(data.patternDetails?.some((item) => item.tag === expected));
    assert.ok(data.yingQi?.sources.some((source) => source.startsWith(`${expected.slice(1)}局`)));
    const prompt = buildDivinationPrompt('qimen', '请按盘面解读。', data);
    assert.ok(prompt.includes(`${expected.slice(1)}局，事势`));
  }
});
