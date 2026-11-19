type TianPanPalace = { tianPan: { star: string; stem?: string; companionStar?: string; companionStem?: string } };

export const palaceStars = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
export const doorPalaces: Record<string, number> = { 休门: 1, 生门: 8, 伤门: 3, 杜门: 4, 景门: 9, 死门: 2, 惊门: 7, 开门: 6 };
export const doorElements: Record<string, string> = { 休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金' };
export const branchPalaces: Record<string, number> = { 子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6 };
export const stemTombs: Record<string, { branch: string; palace: number }> = {
  乙: { branch: '未', palace: 2 }, 丙: { branch: '戌', palace: 6 }, 丁: { branch: '丑', palace: 8 },
  戊: { branch: '戌', palace: 6 }, 己: { branch: '辰', palace: 4 }, 庚: { branch: '未', palace: 2 },
  辛: { branch: '丑', palace: 8 }, 壬: { branch: '辰', palace: 4 }, 癸: { branch: '辰', palace: 4 },
};

export function hasTianPanStar(palace: TianPanPalace, star: string) {
  return palace.tianPan.star === star || palace.tianPan.companionStar === star;
}
export function hasTianPanStem(palace: TianPanPalace, stem: string) {
  return palace.tianPan.stem === stem || palace.tianPan.companionStem === stem;
}
export function getTianPanStemForStar(palace: TianPanPalace, star: string) {
  return palace.tianPan.star === star ? palace.tianPan.stem : palace.tianPan.companionStar === star ? palace.tianPan.companionStem : undefined;
}
export function getTianPanStems(palace: TianPanPalace): string[] {
  return [palace.tianPan.stem, palace.tianPan.companionStem].filter((stem): stem is string => Boolean(stem));
}
export function getTianPanStars(palace: TianPanPalace): string[] {
  return [palace.tianPan.star, palace.tianPan.companionStar].filter((star): star is string => Boolean(star));
}
export function getOppositePalace(palace: number) { return palace === 5 || palace < 1 || palace > 9 ? null : 10 - palace; }
export function getDoorElement(door: string) {
  if (!doorElements[door]) throw new Error(`八门 "${door}" 无法识别。`);
  return doorElements[door];
}
export function formatTianPanStars(palace: TianPanPalace) {
  return [palace.tianPan.star, palace.tianPan.companionStar].filter(Boolean).join('、');
}
export function formatTianPanStems(palace: TianPanPalace) {
  return [palace.tianPan.stem, palace.tianPan.companionStem].filter(Boolean).join('、');
}
