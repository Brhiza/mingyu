import type { QimenJiuGongGe } from './types';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../calendar';
import { palaceStars as stars } from './palace';

export type QimenMethod = 'zhuanpan' | 'feipan';
export type QimenFeipanMode = 'star-only' | 'all-fly';
export type QimenCenterPalace = 'kun2' | 'yang-gen8-yin-kun2';

export function resolveCenterPalaceTarget(isYangDun: boolean, centerPalace: QimenCenterPalace = 'kun2'): 2 | 8 {
  if (centerPalace !== 'kun2' && centerPalace !== 'yang-gen8-yin-kun2') {
    throw new Error(`未知的中五宫寄宫口径: ${String(centerPalace)}`);
  }
  return centerPalace === 'yang-gen8-yin-kun2' && isYangDun ? 8 : 2;
}

const cycle = Array.from({ length: 60 }, (_, i) => HEAVENLY_STEMS[i % 10] + EARTHLY_BRANCHES[i % 12]);
const instruments = [...'戊己庚辛壬癸丁丙乙'];
const path = [1, 8, 3, 4, 9, 2, 7, 6];
const rotatingStars = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];
const doors = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
const gods = ['值符', '九天', '九地', '玄武', '白虎', '六合', '太阴', '螣蛇'];
const positions = [
  ['坎一宫', '正北', '水'], ['坤二宫', '西南', '土'], ['震三宫', '正东', '木'],
  ['巽四宫', '东南', '木'], ['中五宫', '中央', '土'], ['乾六宫', '西北', '金'],
  ['兑七宫', '正西', '金'], ['艮八宫', '东北', '土'], ['离九宫', '正南', '火'],
];
const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

function validateDirectionAndMethod(isYangDun: boolean, method: QimenMethod) {
  if (typeof isYangDun !== 'boolean') throw new Error(`阴阳遁标记必须是布尔值，收到 ${String(isYangDun)}。`);
  if (method !== 'zhuanpan' && method !== 'feipan') throw new Error(`未知的奇门排盘方法: ${String(method)}`);
}

function cyclePosition(ganZhi: string) {
  const index = cycle.indexOf(ganZhi);
  if (index < 0) throw new Error(`无法识别干支 "${ganZhi}"。`);
  return index;
}

/** 六甲遁于六仪；其余干支取自身天干。 */
export function getDunJiaStem(ganZhi: string) {
  const index = cyclePosition(ganZhi);
  return index % 10 === 0 ? instruments[Math.floor(index / 10)] : ganZhi[0];
}

/** 旬首所遁六仪在地盘的宫位决定值符和值使。 */
export function getZhiFuZhiShiByGanZhi(ganZhi: string, layout: { isYangDun: boolean; juShu: number }, centerPalace: QimenCenterPalace = 'kun2') {
  const xun = Math.floor(cyclePosition(ganZhi) / 10);
  if (typeof layout.isYangDun !== 'boolean' || !Number.isInteger(layout.juShu) || layout.juShu < 1 || layout.juShu > 9) throw new Error('奇门局数或阴阳遁无效。');
  const xunShouPalace = mod(layout.juShu - 1 + (layout.isYangDun ? xun : -xun), 9) + 1;
  const zhiFu = stars[xunShouPalace - 1];
  const target = resolveCenterPalaceTarget(layout.isYangDun, centerPalace);
  const zhiShi = xunShouPalace === 5 ? doors[path.indexOf(target)] : doors[path.indexOf(xunShouPalace)];
  return { zhiFu, zhiShi, xunShouPalace };
}

/** 仅时家检查六甲、六癸、时干入墓和五不遇。 */
export function checkSpecialHourConditions(hour: string, day: string) {
  const index = cyclePosition(hour), hourStem = hour[0], dayStem = day[0];
  const tombs: Record<string, [number, string]> = {
    乙未: [2, '三奇日时干入墓'], 丙戌: [6, '三奇日时干入墓'], 丁丑: [8, '三奇日时干入墓'],
    戊辰: [4, '时干入墓'], 壬辰: [4, '时干入墓'], 己未: [2, '时干入墓'], 癸未: [2, '时干入墓'], 辛丑: [8, '时干入墓'],
  };
  const isLiuJiaHour = index % 10 === 0, isLiuGuiHour = index % 10 === 9;
  const tomb = tombs[hour], isShiGanRuMu = Boolean(tomb);
  const isWuBuYuShi = HEAVENLY_STEMS.indexOf(hourStem) === (HEAVENLY_STEMS.indexOf(dayStem) + 6) % 10;
  let description = '';
  if (isLiuJiaHour) description += '六甲时辰（甲时），甲遁于六仪之下；';
  if (isLiuGuiHour) description += '六癸时辰，癸为阴干之末；';
  if (tomb) description += `${tomb[1]}（${hour}，${hourStem}入${tomb[0]}宫/${hour[1]}支），事情停滞，不宜举事；`;
  if (isWuBuYuShi) description += `五不遇时（日干${dayStem}遇时干${hourStem}克日干），事多不顺，不宜举事；`;
  return { isLiuJiaHour, isLiuGuiHour, isShiGanRuMu, isWuBuYuShi, description };
}

/** 值使从旬首宫按旬内步数飞宫，最终落中五时按中五宫寄宫口径寄宫。 */
export function resolveZhiShiLandingPalace(
  isYangDun: boolean, zhiShi: string, ganZhi: string, startPalace?: number, method: QimenMethod = 'zhuanpan',
  centerPalace: QimenCenterPalace = 'kun2',
) {
  validateDirectionAndMethod(isYangDun, method);
  const centerTarget = resolveCenterPalaceTarget(isYangDun, centerPalace);
  const doorIndex = doors.indexOf(zhiShi);
  if (doorIndex < 0) throw new Error(`找不到值使门 "${zhiShi}"。`);
  const start = startPalace ?? path[doorIndex];
  if (!Number.isInteger(start) || start < 1 || start > 9) throw new Error(`无效九宫编号 "${start}"。`);
  const steps = cyclePosition(ganZhi) % 10;
  const palace = mod(start - 1 + (isYangDun ? steps : -steps), 9) + 1;
  return palace === 5 ? centerTarget : palace;
}

const feipanDoors = ['休门', '死门', '伤门', '杜门', '', '开门', '惊门', '生门', '景门'];
const feipanGods = ['值符', '螣蛇', '太阴', '六合', '白虎', '太常', '玄武', '九地', '九天'];

/** 布地盘、天盘、人盘和神盘；转盘天禽随寄宫主星，飞盘保留中宫，支持九星单飞与门星神全飞盘。 */
export function arrangeJiuGongGe(
  isYangDun: boolean, juShu: number, zhiFu: string, zhiShi: string,
  ganzhi: { hour: string }, method: QimenMethod = 'zhuanpan', centerPalace: QimenCenterPalace = 'kun2',
  feipanMode: QimenFeipanMode = 'star-only',
): QimenJiuGongGe[] {
  validateDirectionAndMethod(isYangDun, method);
  const centerTarget = resolveCenterPalaceTarget(isYangDun, centerPalace);
  if (!Number.isInteger(juShu) || juShu < 1 || juShu > 9) throw new Error(`奇门局数必须是 1-9 的整数，收到 ${String(juShu)}。`);
  if (!ganzhi || typeof ganzhi.hour !== 'string') throw new Error('奇门排盘必须提供时辰干支。');
  const dunStem = getDunJiaStem(ganzhi.hour);
  const home = stars.indexOf(zhiFu) + 1;
  if (!home) throw new Error(`找不到值符星 "${zhiFu}"。`);

  const palaces: QimenJiuGongGe[] = positions.map(([name, direction, element], i) => ({
    gong: i + 1, name, direction, element,
    tianPan: { star: '', stem: '' }, diPan: { stem: '' }, renPan: { door: '' }, shenPan: { god: '' },
  }));
  for (let i = 0; i < 9; i++) palaces[mod(juShu - 1 + (isYangDun ? i : -i), 9)].diPan.stem = instruments[i];

  let landing = palaces.findIndex((palace) => palace.diPan.stem === dunStem) + 1;
  if (!landing) throw new Error(`找不到遁干 "${dunStem}" 的落宫。`);
  if (method === 'zhuanpan' && landing === 5) landing = centerTarget;
  const doorLanding = resolveZhiShiLandingPalace(isYangDun, zhiShi, ganzhi.hour, home, method, centerPalace);

  if (method === 'zhuanpan') {
    const hostStar = stars[centerTarget - 1];
    const starStart = rotatingStars.indexOf(zhiFu === '天禽' ? hostStar : zhiFu);
    const palaceStart = path.indexOf(landing);
    for (let i = 0; i < 8; i++) {
      const palace = palaces[path[(palaceStart + i) % 8] - 1];
      const star = rotatingStars[(starStart + i) % 8];
      palace.tianPan.star = star;
      palace.tianPan.stem = palaces[stars.indexOf(star)].diPan.stem;
      if (star === hostStar) {
        palace.tianPan.companionStar = '天禽';
        palace.tianPan.companionStem = palaces[4].diPan.stem;
      }
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const star = stars[(home - 1 + i) % 9];
      const palace = palaces[mod(landing - 1 + (isYangDun ? i : -i), 9)];
      palace.tianPan.star = star;
      palace.tianPan.stem = palaces[stars.indexOf(star)].diPan.stem;
    }
  }

  if (method === 'feipan' && feipanMode === 'all-fly') {
    const doorHomeIdx = feipanDoors.indexOf(zhiShi);
    for (let i = 0; i < 9; i++) {
      palaces[mod(doorLanding - 1 + (isYangDun ? i : -i), 9)].renPan.door = feipanDoors[(doorHomeIdx + i) % 9];
      palaces[mod(landing - 1 + (isYangDun ? i : -i), 9)].shenPan.god = feipanGods[i];
    }
    return palaces;
  }

  const doorStart = doors.indexOf(zhiShi);
  const doorPalaceStart = path.indexOf(doorLanding);
  const godPalaceStart = path.indexOf(landing === 5 ? centerTarget : landing);
  for (let i = 0; i < 8; i++) {
    palaces[path[(doorPalaceStart + i) % 8] - 1].renPan.door = doors[(doorStart + i) % 8];
    palaces[path[mod(godPalaceStart + (isYangDun ? -i : i), 8)] - 1].shenPan.god = gods[i];
  }
  return palaces;
}
