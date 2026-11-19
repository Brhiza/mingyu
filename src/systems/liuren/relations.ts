import data from './relations-data.json';
export const GANZHI_RELATION_TABLES = data as { BRANCH_WUXING: Record<string, string>; LIUCHONG_MAP: Record<string, string>; SANXING_MAP: Record<string, string>; TIAN_GAN_HE: Record<string, { partner: string; wuxing: string }> };
export const BAZI_RELATION_MAPPINGS = { BASIC_MAPPINGS: { STEM_WUXING: data.STEM_WUXING } };
const branches = '子丑寅卯辰巳午未申酉戌亥';
const stems = '甲乙丙丁戊己庚辛壬癸';
export function getYiMa(branch: string) {
  if ('申子辰'.includes(branch)) return '寅';
  if ('亥卯未'.includes(branch)) return '巳';
  if ('寅午戌'.includes(branch)) return '申';
  if ('巳酉丑'.includes(branch)) return '亥';
  throw new Error(`地支无效：${branch}`);
}
export function getXunHead(ganzhi: string) {
  const index = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]).indexOf(ganzhi);
  if (index < 0) throw new Error(`干支无效：${ganzhi}`);
  return ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'][Math.floor(index / 10)];
}
