import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeJiuGongGe } from '../packages/core/src/divination/algorithms/qimen/helpers/layout.ts';

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIXTY_JIAZI = Array.from({ length: 60 }, (_, index) => {
  const stem = HEAVENLY_STEMS[index % 10];
  const branch = EARTHLY_BRANCHES[index % 12];
  return `${stem}${branch}`;
});
const SAN_QI_LIU_YI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
const LUO_SHU_PATH = [1, 8, 3, 4, 9, 2, 7, 6];
const STAR_HOME: Record<string, number> = {
  天蓬: 1,
  天芮: 2,
  天冲: 3,
  天辅: 4,
  天禽: 5,
  天心: 6,
  天柱: 7,
  天任: 8,
  天英: 9,
};
const DUN_JIA: Record<string, string> = {
  甲子: '戊',
  甲戌: '己',
  甲申: '庚',
  甲午: '辛',
  甲辰: '壬',
  甲寅: '癸',
};
const PALACE_STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
const DOOR_BY_PALACE: Record<number, string> = {
  1: '休门',
  2: '死门',
  3: '伤门',
  4: '杜门',
  6: '开门',
  7: '惊门',
  8: '生门',
  9: '景门',
};
const DOORS = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
const GODS = ['值符', '九天', '九地', '玄武', '白虎', '六合', '太阴', '螣蛇'];

function referenceDiPan(isYangDun: boolean, juShu: number): string[] {
  const result = Array(9).fill('');
  for (let index = 0; index < SAN_QI_LIU_YI.length; index += 1) {
    const palace = isYangDun
      ? ((juShu + index - 1 + 9) % 9) + 1
      : ((juShu - index - 1 + 9) % 9) + 1;
    result[palace - 1] = SAN_QI_LIU_YI[index];
  }
  return result;
}

function referenceXunShou(ganZhi: string): string {
  const ganIndex = HEAVENLY_STEMS.indexOf(ganZhi.charAt(0));
  const zhiIndex = EARTHLY_BRANCHES.indexOf(ganZhi.charAt(1));
  return `甲${EARTHLY_BRANCHES[(zhiIndex - ganIndex + 12) % 12]}`;
}

function referenceZhiFuZhiShi(
  ganZhi: string,
  isYangDun: boolean,
  juShu: number,
): { zhiFu: string; zhiShi: string } {
  const diPan = referenceDiPan(isYangDun, juShu);
  const xunShouPalace = diPan.indexOf(DUN_JIA[referenceXunShou(ganZhi)]) + 1;
  return {
    zhiFu: PALACE_STARS[xunShouPalace - 1],
    zhiShi: xunShouPalace === 5 ? '死门' : DOOR_BY_PALACE[xunShouPalace],
  };
}

function referenceZhuanpan(
  isYangDun: boolean,
  juShu: number,
  ganZhi: string,
): Array<{
  diPan: string;
  star: string;
  stem: string;
  companionStar: string;
  companionStem: string;
  door: string;
  god: string;
}> {
  const diPan = referenceDiPan(isYangDun, juShu);
  const { zhiFu, zhiShi } = referenceZhiFuZhiShi(ganZhi, isYangDun, juShu);
  const hourGan = ganZhi.startsWith('甲') ? DUN_JIA[ganZhi] : ganZhi.charAt(0);
  const zhiFuLanding = diPan.indexOf(hourGan) + 1 === 5 ? 2 : diPan.indexOf(hourGan) + 1;
  const zhiFuHome = STAR_HOME[zhiFu];
  const steps = HEAVENLY_STEMS.indexOf(ganZhi.charAt(0));
  const zhiShiLanding =
    (((zhiFuHome === 5 ? 2 : zhiFuHome) - 1 + (isYangDun ? steps : -steps) + 90) % 9) + 1 === 5
      ? 2
      : (((zhiFuHome === 5 ? 2 : zhiFuHome) - 1 + (isYangDun ? steps : -steps) + 90) % 9) + 1;

  const result = Array.from({ length: 9 }, () => ({
    diPan: '',
    star: '',
    stem: '',
    companionStar: '',
    companionStem: '',
    door: '',
    god: '',
  }));
  for (let index = 0; index < 9; index += 1) {
    result[index].diPan = diPan[index];
  }

  const effectiveZhiFu = zhiFu === '天禽' ? '天芮' : zhiFu;
  const starOrder = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];
  const zhiFuStarIndex = starOrder.indexOf(effectiveZhiFu);
  const zhiFuPathIndex = LUO_SHU_PATH.indexOf(zhiFuLanding);
  for (let index = 0; index < 8; index += 1) {
    const palace = LUO_SHU_PATH[(zhiFuPathIndex + index) % 8];
    const star = starOrder[(zhiFuStarIndex + index) % 8];
    result[palace - 1].star = star;
    result[palace - 1].stem = diPan[STAR_HOME[star] - 1];
    if (star === '天芮') {
      result[palace - 1].companionStar = '天禽';
      result[palace - 1].companionStem = diPan[4];
    }
  }

  const zhiShiDoorIndex = DOORS.indexOf(zhiShi);
  const zhiShiLuoShuIndex = LUO_SHU_PATH.indexOf(zhiShiLanding);
  for (let index = 0; index < 8; index += 1) {
    const palace = LUO_SHU_PATH[(zhiShiLuoShuIndex + index) % 8];
    result[palace - 1].door = DOORS[(zhiShiDoorIndex + index) % 8];
  }

  const startIndex = LUO_SHU_PATH.indexOf(zhiFuLanding);
  const direction = isYangDun ? -1 : 1;
  for (let index = 0; index < 8; index += 1) {
    const pathIndex = (startIndex + direction * index + 8) % 8;
    result[LUO_SHU_PATH[pathIndex] - 1].god = GODS[index];
  }

  return result;
}

function referenceFeipan(
  isYangDun: boolean,
  juShu: number,
  ganZhi: string,
): Array<{
  diPan: string;
  star: string;
  stem: string;
  door: string;
  god: string;
}> {
  const diPan = referenceDiPan(isYangDun, juShu);
  const { zhiFu, zhiShi } = referenceZhiFuZhiShi(ganZhi, isYangDun, juShu);
  const hourGan = ganZhi.startsWith('甲') ? DUN_JIA[ganZhi] : ganZhi.charAt(0);
  const zhiFuLanding = diPan.indexOf(hourGan) + 1;
  const zhiFuHome = STAR_HOME[zhiFu];
  const steps = HEAVENLY_STEMS.indexOf(ganZhi.charAt(0));
  const zhiShiRaw = ((zhiFuHome - 1 + (isYangDun ? steps : -steps) + 90) % 9) + 1;
  const zhiShiLanding = zhiShiRaw === 5 ? 2 : zhiShiRaw;

  const result = Array.from({ length: 9 }, () => ({
    diPan: '',
    star: '',
    stem: '',
    door: '',
    god: '',
  }));
  for (let index = 0; index < 9; index += 1) {
    result[index].diPan = diPan[index];
  }

  const zhiFuStarIndex = PALACE_STARS.indexOf(zhiFu);
  for (let index = 0; index < 9; index += 1) {
    const starIndex = (zhiFuStarIndex + index) % 9;
    const palace = ((zhiFuLanding - 1 + (isYangDun ? index : -index) + 9) % 9) + 1;
    const star = PALACE_STARS[starIndex];
    result[palace - 1].star = star;
    result[palace - 1].stem = diPan[STAR_HOME[star] - 1];
  }

  const zhiShiDoorIndex = DOORS.indexOf(zhiShi);
  const zhiShiLuoShuIndex = LUO_SHU_PATH.indexOf(zhiShiLanding);
  for (let index = 0; index < 8; index += 1) {
    const palace = LUO_SHU_PATH[(zhiShiLuoShuIndex + index) % 8];
    result[palace - 1].door = DOORS[(zhiShiDoorIndex + index) % 8];
  }

  const shenPanStart = zhiFuLanding === 5 ? 2 : zhiFuLanding;
  const startIndex = LUO_SHU_PATH.indexOf(shenPanStart);
  const direction = isYangDun ? -1 : 1;
  for (let index = 0; index < 8; index += 1) {
    const pathIndex = (startIndex + direction * index + 8) % 8;
    result[LUO_SHU_PATH[pathIndex] - 1].god = GODS[index];
  }

  return result;
}

function snapshots(palaces: ReturnType<typeof arrangeJiuGongGe>) {
  return palaces.map((palace) => ({
    diPan: palace.diPan.stem,
    star: palace.tianPan.star,
    stem: palace.tianPan.stem,
    companionStar: palace.tianPan.companionStar ?? '',
    companionStem: palace.tianPan.companionStem ?? '',
    door: palace.renPan.door,
    god: palace.shenPan.god,
  }));
}

function feipanSnapshots(palaces: ReturnType<typeof arrangeJiuGongGe>) {
  return palaces.map((palace) => ({
    diPan: palace.diPan.stem,
    star: palace.tianPan.star,
    stem: palace.tianPan.stem,
    door: palace.renPan.door,
    god: palace.shenPan.god,
  }));
}

test('奇门转盘18局六十时辰应逐宫复现独立经典排盘规则', () => {
  for (const isYangDun of [true, false]) {
    for (let juShu = 1; juShu <= 9; juShu += 1) {
      for (const ganZhi of SIXTY_JIAZI) {
        const { zhiFu, zhiShi } = referenceZhiFuZhiShi(ganZhi, isYangDun, juShu);
        const actual = snapshots(
          arrangeJiuGongGe(isYangDun, juShu, zhiFu, zhiShi, { hour: ganZhi }, 'zhuanpan'),
        );
        const expected = referenceZhuanpan(isYangDun, juShu, ganZhi);
        assert.deepEqual(
          actual,
          expected,
          `${isYangDun ? '阳' : '阴'}遁${juShu}局 ${ganZhi} 盘面与独立规则不一致`,
        );
      }
    }
  }
});

test('奇门飞盘18局六十时辰应逐宫复现独立经典排盘规则', () => {
  for (const isYangDun of [true, false]) {
    for (let juShu = 1; juShu <= 9; juShu += 1) {
      for (const ganZhi of SIXTY_JIAZI) {
        const { zhiFu, zhiShi } = referenceZhiFuZhiShi(ganZhi, isYangDun, juShu);
        const actual = feipanSnapshots(
          arrangeJiuGongGe(isYangDun, juShu, zhiFu, zhiShi, { hour: ganZhi }, 'feipan'),
        );
        const expected = referenceFeipan(isYangDun, juShu, ganZhi);
        assert.deepEqual(
          actual,
          expected,
          `${isYangDun ? '阳' : '阴'}遁${juShu}局 ${ganZhi} 飞盘盘面与独立规则不一致`,
        );
      }
    }
  }
});

test('奇门独立参考应锚定芒种上元阳六局癸未时固定古盘', () => {
  const expected = referenceZhuanpan(true, 6, '癸未');
  assert.equal(expected[1].diPan, '癸');
  assert.equal(expected[1].star, '天柱');
  assert.equal(expected[1].stem, '己');
  assert.equal(expected[1].door, '死门');
  assert.equal(expected[1].god, '值符');
  assert.equal(expected[5].star, '天蓬');
  assert.equal(expected[5].stem, '壬');
  assert.equal(expected[5].door, '开门');
  assert.equal(expected[5].god, '太阴');
  assert.equal(expected[8].star, '天芮');
  assert.equal(expected[8].companionStar, '天禽');
  assert.equal(expected[8].companionStem, '乙');
  assert.equal(expected[8].god, '九天');
});
