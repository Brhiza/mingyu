export interface TaiyiPalaceProfile {
  gua: string;
  dir: string;
  wu: string;
}

/** 太乙八宫编号不是洛书九宫编号。 */
const CANONICAL_TAIYI_PALACES: Readonly<Record<number, Readonly<TaiyiPalaceProfile>>> = {
  1: { gua: '乾', dir: '西北', wu: '金' },
  2: { gua: '离', dir: '南', wu: '火' },
  3: { gua: '艮', dir: '东北', wu: '土' },
  4: { gua: '震', dir: '东', wu: '木' },
  6: { gua: '兑', dir: '西', wu: '金' },
  7: { gua: '坤', dir: '西南', wu: '土' },
  8: { gua: '坎', dir: '北', wu: '水' },
  9: { gua: '巽', dir: '东南', wu: '木' },
};

/** 十六神固定宫位。 */
const CANONICAL_TAIYI_16_GODS: { name: string; branch: string }[] = [
  { name: '地主', branch: '子' },
  { name: '阳德', branch: '丑' },
  { name: '和德', branch: '艮' },
  { name: '吕申', branch: '寅' },
  { name: '高丛', branch: '卯' },
  { name: '太阳', branch: '辰' },
  { name: '大炅', branch: '巽' },
  { name: '大神', branch: '巳' },
  { name: '大威', branch: '午' },
  { name: '天道', branch: '未' },
  { name: '大武', branch: '坤' },
  { name: '武德', branch: '申' },
  { name: '太簇', branch: '酉' },
  { name: '阴主', branch: '戌' },
  { name: '阴德', branch: '乾' },
  { name: '大义', branch: '亥' },
];

export function getTaiyiPalaces(): Record<number, TaiyiPalaceProfile> {
  return Object.fromEntries(
    Object.entries(CANONICAL_TAIYI_PALACES).map(([key, value]) => [key, { ...value }]),
  );
}

export function getTaiyiSixteenGods(): { name: string; branch: string }[] {
  return CANONICAL_TAIYI_16_GODS.map((god) => ({ ...god }));
}
