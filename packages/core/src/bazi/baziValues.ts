
// ── 天干阴阳 ──
export const STEM_YINYANG: Record<string, string> = {
  甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳',
  己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴',
};
export const BRANCH_YINYANG: Record<string, string> = {
  子: '阳', 丑: '阴', 寅: '阳', 卯: '阴', 辰: '阳',
  巳: '阴', 午: '阳', 未: '阴', 申: '阳', 酉: '阴', 戌: '阳', 亥: '阴',
};
export const BRANCH_BREAK: Record<string, string> = {
  子: '酉', 酉: '子', 丑: '辰', 辰: '丑',
  寅: '亥', 亥: '寅', 卯: '午', 午: '卯',
  巳: '申', 申: '巳', 未: '戌', 戌: '未',
};
export const LU_BRANCH: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午',
  戊: '巳', 己: '午', 庚: '申', 辛: '酉',
  壬: '亥', 癸: '子',
};
export const BLADE_BRANCH: Record<string, string> = {
  甲: '卯', 乙: '寅', 丙: '午', 丁: '巳',
  戊: '午', 己: '巳', 庚: '酉', 辛: '申',
  壬: '子', 癸: '亥',
};
export const TOMB_BRANCH: Record<string, string> = {
  金: '丑', 木: '未', 火: '戌', 水: '辰', 土: '辰',
};
export const TWELVE_STAGES = [
  '长生', '沐浴', '冠带', '临官', '帝旺',
  '衰', '病', '死', '墓', '绝', '胎', '养',
];
const TWELVE_STAGES_START: Record<string, string> = {
  木: '亥', 火: '寅', 金: '巳', 水: '申', 土: '申',
};
import { TWELVE_STAGES_MAP } from './baziMappingsData';
export function getLifeStage(stem: string, branch: string): string {
  return TWELVE_STAGES_MAP[stem]?.[branch] || '未知';
}
export const MONTH_LING: Record<string, string> = {
  寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火',
  未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土',
};
