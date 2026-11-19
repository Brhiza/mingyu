import { isLiuchong as baseIsLiuchong, isLiuhai as baseIsLiuhai, isLiuhe as baseIsLiuhe } from '../ganzhi-foundation';
export { EARTHLY_BRANCHES as BRANCH_ORDER, isSheng, isKe, getSeasonState, getBranchWuxing } from '../calendar';
export const CHANGSHENG_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
export const SANHE_GROUPS: Record<string, string[]> = { 水局: ['申', '子', '辰'], 木局: ['亥', '卯', '未'], 火局: ['寅', '午', '戌'], 金局: ['巳', '酉', '丑'] };
export function isLiuhe(a: string, b: string) { return baseIsLiuhe(a, b); }
export function isLiuchong(a: string, b: string) { return baseIsLiuchong(a, b); }
export function isLiuhai(a: string, b: string) { return baseIsLiuhai(a, b); }
export function isLiupo(a: string, b: string) {
  const pairs = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'];
  return pairs.some((pair) => pair.includes(a) && pair.includes(b) && a !== b);
}
export function getSanxingType(branch: string) {
  if (['子', '卯'].includes(branch)) return '无礼之刑';
  if (['寅', '巳', '申'].includes(branch)) return '无恩之刑';
  if (['丑', '戌', '未'].includes(branch)) return '恃势之刑';
  if (['辰', '午', '酉', '亥'].includes(branch)) return '自刑';
  throw new Error(`地支无效：${branch}`);
}
export function isSanxing(a: string, b: string) {
  if ((a === '子' && b === '卯') || (a === '卯' && b === '子')) return true;
  if (['寅', '巳', '申'].includes(a) && ['寅', '巳', '申'].includes(b) && a !== b) return true;
  if (['丑', '戌', '未'].includes(a) && ['丑', '戌', '未'].includes(b) && a !== b) return true;
  return ['辰', '午', '酉', '亥'].includes(a) && a === b;
}
export function getSixAnimals(dayStem: string) {
  const order = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
  const starts: Record<string, number> = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
  if (starts[dayStem] === undefined) throw new Error(`日干无效：${dayStem}`);
  return order.map((_, index) => order[(starts[dayStem] + index) % 6]);
}
