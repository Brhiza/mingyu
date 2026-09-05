/**
 * @file types.ts
 * Classical text, rules, and dictionary types for traditional Chinese metaphysics.
 */

export interface ZhouyiYaoText {
  position: number;
  positionName: string;
  yaoCi: string;
  xiaoXiang: string;
  explanation?: string;
}

export interface ZhouyiHexagramText {
  id: number;
  name: string;
  upper: string;
  lower: string;
  palace: string;
  guaCi: string;
  tuanCi: string;
  daXiang: string;
  wenYan?: string;
  yaos: ZhouyiYaoText[];
  yongCi?: string;
}

export type QimenPatternAuspice = '大吉' | '吉' | '平' | '凶' | '大凶';

export interface QimenStemPattern {
  heavenStem: string;
  earthStem: string;
  name: string;
  auspice: QimenPatternAuspice;
  classicVerse: string;
  modernMeaning: string;
  category: '三奇得使' | '三奇贵格' | '十干克应' | '凶格刑悖' | '门迫入墓';
}

export interface QimenDoorPattern {
  door: string;
  palace: string;
  state: '门迫' | '宫迫' | '入墓' | '相生' | '比和';
  auspice: QimenPatternAuspice;
  verse: string;
  modernAdvice: string;
}

export interface BaziQiongtongEntry {
  dayMaster: string;
  monthBranch: string;
  seasonSummary: string;
  primaryGods: string[];
  classicVerse: string;
  modernExplanation: string;
  taboos: string[];
}

export interface LiuyaoMovementRule {
  key: string;
  trigger: string;
  sourceBook: '黄金策' | '增删卜易' | '断易天机' | '卜筮正宗' | '火珠林' | '易经' | string;
  originalVerse: string;
  generalMeaning: string;
  topicSpecificAdvice: {
    career?: string;
    wealth?: string;
    relationship?: string;
    health?: string;
  };
}

export interface MeihuaBodyUseJudgement {
  relationType: '体用比和' | '体克用' | '用克体' | '体生用' | '用生体';
  auspice: '大吉' | '吉' | '凶' | '大凶' | '小损';
  classicSummary: string;
  actionAdvice: string;
  matterCategories: {
    wishing: string;
    seekingWealth: string;
    marriage: string;
    travel: string;
    illness: string;
  };
}

export interface XiaoliurenPalaceClassic {
  name: string;
  wuxing: string;
  auspice: '大吉' | '吉' | '平' | '凶' | '大凶' | '小吉';
  sourceBook: string;
  poem: string;
  modernAdvice: string;
  direction?: string;
  bodyPart?: string;
}

export interface JinkoujueMovementClassic {
  key: string;
  name: string;
  category: '五动' | '三动' | '入式';
  sourceBook: string;
  verse: string;
  modernAdvice: string;
}

export interface LiurenTransmissionClassic {
  rule: string;
  category: string;
  sourceBook: string;
  summary: string;
  verse?: string;
  modernAdvice: string;
}

export interface LiurenLessonPatternClassic {
  pattern: string;
  sourceBook: string;
  verse: string;
  modernAdvice: string;
}

export interface BaziDitiansuiEntry {
  stem: string;
  wuxing: string;
  sourceBook: string;
  verse: string;
  nature: string;
  modernAdvice: string;
}

export interface BaziZipingPatternEntry {
  pattern: string;
  category: '正格' | '变格' | '杂格';
  sourceBook: string;
  rule: string;
  verse?: string;
  modernAdvice: string;
  taboos: string[];
}

export interface QimenStarClassic {
  star: string;
  originalPalace: string;
  wuxing: string;
  auspice: QimenPatternAuspice;
  sourceBook: string;
  verse: string;
  nature: string;
  modernAdvice: string;
}

export interface QimenDoorClassic {
  door: string;
  originalPalace: string;
  wuxing: string;
  auspice: QimenPatternAuspice;
  sourceBook: string;
  verse: string;
  nature?: string;
  modernAdvice: string;
}

export interface QimenDeityClassic {
  deity: string;
  wuxing: string;
  auspice: QimenPatternAuspice;
  sourceBook: string;
  verse: string;
  nature?: string;
  modernAdvice: string;
}

export interface LiuyaoChishiClassic {
  relation: string;
  sourceBook: string;
  verse: string;
  modernAdvice: string;
}

export interface LiurenGeneralClassic {
  general: string;
  wuxing: string;
  polarity: '阳' | '阴';
  auspice: '吉' | '凶' | '中性';
  sourceBook: string;
  verse: string;
  modernAdvice: string;
}

export interface MeihuaTrigramClassic {
  trigram: string;
  name: string;
  nature: string;
  wuxing: string;
  family: string;
  bodyPart: string;
  matters: string;
  sourceBook: string;
  verse: string;
}

export interface ZiweiStarClassic {
  star: string;
  type: '北斗' | '南斗' | '中天';
  wuxing: string;
  polarity: '阳' | '阴';
  brightnessGeneral: string;
  sourceBook: string;
  verse: string;
  nature: string;
  careerAdvice: string;
}

export interface BazhaiStarClassic {
  star: string;
  auspice: '大吉' | '次吉' | '中吉' | '小吉' | '大凶' | '次凶' | '中凶' | '小凶';
  wuxing: string;
  sourceBook: string;
  verse: string;
  nature: string;
  placementAdvice: string;
}

export interface TaiyiGeneralClassic {
  general: string;
  role: string;
  wuxing?: string;
  sourceBook: string;
  verse: string;
  nature: string;
  actionAdvice: string;
}

export interface HuangjiCycleClassic {
  cycleType: '元' | '会' | '运' | '世' | '年';
  name: string;
  sourceBook: string;
  verse: string;
  principle: string;
  modernAdvice: string;
}

export interface QizhengStarClassic {
  star: string;
  category: '七政' | '四余';
  wuxing: string;
  sourceBook: string;
  verse: string;
  nature: string;
  interpretation: string;
}

export interface XuankongStarClassic {
  starNumber: number;
  starName: string;
  trigram: string;
  wuxing: string;
  sourceBook: string;
  verse: string;
  timelyMeaning: string;
  untimelyMeaning: string;
}

export interface WuyunLiuqiClassic {
  factor: string;
  category: '大运' | '司天' | '在泉' | '主气' | '客气';
  sourceBook: string;
  verse: string;
  climateFeature: string;
  healthAdvice?: string;
}

export interface AlmanacOfficerClassic {
  officer: string;
  order: number;
  auspice: '吉' | '平' | '凶';
  sourceBook: string;
  verse: string;
  suitable: string[];
  taboo: string[];
}

export interface ZiweiFuClassic {
  key: string;
  title: string;
  sourceBook: '太微赋' | '骨髓赋' | '形性赋' | '问答论';
  originalVerse: string;
  modernMeaning: string;
}
