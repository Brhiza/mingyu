/**
 * 底层源头公共中文格式化工具。
 * 供各术数核心渲染模块与精炼层共同引用，保证源头直接输出纯净中文而无需后期补丁翻译。
 */

export const ASTRO_HOUSE_SYSTEM_LABELS: Record<string, string> = {
  placidus: '普拉西德',
  whole_sign: '整宫',
  equal: '等宫',
  koch: '科赫',
  porphyry: '波菲利',
  regiomontanus: '雷吉奥蒙塔努斯',
  campanus: '坎帕努斯',
  alcabitius: '阿尔卡比特',
  morinus: '莫里努斯',
  meridian: '子午圈',
  polich_page: '波利希-佩奇',
  vehlow: '维洛等宫',
};

export function formatAstroHouseSystem(system: string): string {
  return ASTRO_HOUSE_SYSTEM_LABELS[system.toLowerCase()] ?? system;
}
