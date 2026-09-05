/**
 * @file 命录 (Minglu / Life Record Wiki) 核心数据模型与接口定义
 * @description 命录是全息、百科式、结构化且支持全量展开与内链互通的命理大报告数据模型。
 */

import type { BaziChartResult, Wuxing } from '../bazi/baziTypes';
import type { ZiweiRuntime } from '../ziwei/runtime';
import type { AstrolabeData } from '../types/divination';
import type { QizhengResult } from '../qi_zheng';
import type { ResidentialFengshuiResult } from '../residential_fengshui';

export type MingluSectionType =
  | 'overview'
  | 'bazi-pillars'
  | 'bazi-five-elements'
  | 'bazi-pattern-gods'
  | 'bazi-interactions'
  | 'bazi-shensha'
  | 'bazi-ten-gods'
  | 'bazi-life-stages'
  | 'bazi-luck-chronicle'
  | 'ziwei-twelve-palaces'
  | 'ziwei-patterns'
  | 'ziwei-mutagens'
  | 'astrolabe-chart'
  | 'astrolabe-aspects'
  | 'qizheng-chart'
  | 'fengshui-bazhai'
  | 'cross-synthesis'
  | 'glossary-index';

export interface MingluMetadata {
  subjectName: string;
  gender: 'male' | 'female' | '';
  genderLabel: string;
  solarDateStr: string;
  lunarDateStr: string;
  shichenName: string;
  exactBirthTime?: string;
  birthPlace?: string;
  longitude?: number;
  latitude?: number;
  timezone?: number;
  timeZoneId?: string;
  isTrueSolarTime: boolean;
  trueSolarTimeStr?: string;
  baziFourPillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  dayMaster: {
    gan: string;
    wuxing: Wuxing;
    yinYang: '阴' | '阳';
  };
  zodiac: string;
  constellation: string;
  mingGua?: {
    gua: string;
    number: number;
    eastWest: string;
    element: string;
  };
  ziweiSummary?: {
    soulMaster: string;
    bodyMaster: string;
    wuxingBureau: string;
    soulPalaceBranch: string;
    bodyPalaceBranch: string;
  };
  astrolabeSummary?: {
    sunSign: string;
    moonSign: string;
    ascendantSign: string;
    dominantElement: string;
  };
}

export interface MingluTOCItem {
  id: string;
  title: string;
  anchorId: string;
  level: 1 | 2 | 3;
  icon?: string;
  badge?: string;
  itemCount?: number;
  subItems?: MingluTOCItem[];
}

export interface MingluGlossaryEntry {
  term: string;
  category:
    '干支' | '十神' | '五行' | '格局' | '神煞' | '星曜' | '宫位' | '占星' | '风水' | '古籍概念';
  pinyin?: string;
  shortDesc: string;
  fullDesc: string;
  classicSource?: string;
  anchorId: string;
  relatedTerms?: string[];
  presentInChart?: boolean;
}

export interface MingluCrossLink {
  id: string;
  label: string;
  targetAnchorId: string;
  category: string;
  description?: string;
}

// 1. 四柱全息大表数据
export interface MingluPillarColumn {
  key: 'year' | 'month' | 'day' | 'hour' | string;
  label: string;
  caption?: string;
  gan: string;
  zhi: string;
  ganWuxing: Wuxing;
  zhiWuxing: Wuxing;
  ganTenGod: string;
  zhiTenGod: string;
  hiddenStems: Array<{
    stem: string;
    wuxing: Wuxing;
    tenGod: string;
    role: '本气' | '中气' | '余气';
  }>;
  nayin: string;
  ziZuo: string;
  lifeStage: string;
  kongWang: string[];
  shensha: string[];
  isDayMaster?: boolean;
}

export interface MingluPillarsSectionData {
  columns: MingluPillarColumn[];
  sanYuan: {
    taiYuan: { ganZhi: string; nayin: string; desc: string };
    taiXi: { ganZhi: string; nayin: string; desc: string };
    mingGong: { ganZhi: string; nayin: string; desc: string };
    shenGong: { ganZhi: string; nayin: string; desc: string };
  };
  seasonInfo: {
    jieqiName: string;
    currentSeason: string;
    monthCommander: string;
    monthCommanderDesc: string;
  };
  mingGuaInfo?: {
    name: string;
    number: number;
    eastWest: string;
    wuxing: string;
    directions: Array<{ type: '吉' | '凶'; name: string; direction: string; desc: string }>;
  };
}

// 2. 五行能量全息数据
export interface MingluFiveElementsSectionData {
  elements: Array<{
    wuxing: Wuxing;
    count: number;
    score: number;
    percentage: number;
    seasonStatus: string;
    isDominant: boolean;
    isWeakest: boolean;
    isMissing: boolean;
  }>;
  dayMasterStrength: {
    status: string;
    score: number;
    sameKindScore: number;
    diffKindScore: number;
    sameRatio: number;
    diffRatio: number;
    dimensions: {
      timely: boolean;
      seasonalEffect: string;
      grounded: boolean;
      supported: boolean;
      assisted: boolean;
      hasRoot: boolean;
      hasStrongRoot: boolean;
    };
    ruleBasis: string[];
    judgmentSummary: string;
  };
  healthTcmAdvice?: Array<{
    wuxing: Wuxing;
    organPair: string;
    status: '过旺耗伤' | '虚弱不足' | '平衡中和';
    manifestations: string;
    wellnessDiet: string;
  }>;
}

// 3. 格局与用神体系数据
export interface MingluPatternUsefulGodSectionData {
  pattern: {
    name: string;
    isSpecial: boolean;
    type: string;
    basis: string;
    formationAnalysis: string;
    classicCommentary?: string;
  };
  usefulGods: {
    primaryUseful: string;
    primaryAvoid: string;
    favorable: string[];
    unfavorable: string[];
    usefulGodCategory: string;
    reasoning: string;
    strategyTrace: string[];
  };
  qiongtongAdvice?: {
    title: string;
    source: string;
    summary: string;
    quotes: string[];
  };
  ditiansuiAdvice?: {
    title: string;
    source: string;
    summary: string;
    quotes: string[];
  };
  zipingAdvice?: {
    title: string;
    source: string;
    summary: string;
    quotes: string[];
  };
}

// 4. 全量柱间作用网络
export interface MingluInteractionItem {
  id: string;
  category:
    | '天干五合'
    | '天干相冲'
    | '天干相克'
    | '地支三会'
    | '地支三合'
    | '地支半合'
    | '地支六合'
    | '地支六冲'
    | '地支相刑'
    | '地支相害'
    | '地支相破'
    | '地支暗合'
    | '柱间伏吟'
    | '柱间反吟'
    | '岁运并临'
    | '天合地合'
    | '天克地冲';
  name: string;
  involvedPillars: string[];
  involvedStemsBranches: string[];
  transformElement?: string;
  nature: '吉' | '凶' | '中性';
  description: string;
  influence: string;
  anchorId: string;
}

// 5. 全息神煞谱系
export interface MingluShenShaItem {
  id: string;
  name: string;
  type: '吉' | '凶' | '中性';
  pillars: string[];
  foundRuleBasis: string;
  traditionalDescription: string;
  significance: string;
  tenGodCombo?: string;
  anchorId: string;
}

// 6. 十神心性与六亲意象
export interface MingluTenGodItem {
  tenGod: string;
  count: number;
  isExposed: boolean;
  isHidden: boolean;
  pillars: string[];
  psychology: string;
  careerSymbol?: string;
  wealthSymbol?: string;
  relationshipSymbol?: string;
}

export interface MingluTenGodsSectionData {
  godsList: MingluTenGodItem[];
  dominantGods: string[];
  flowAnalysis: {
    channels: Array<{
      from: string;
      to: string;
      flowType: string;
      desc: string;
    }>;
    summary: string;
  };
  housesSixKin: Array<{
    pillar: string;
    pillarLabel: string;
    ageRange: string;
    sixKinSignificance: string;
    environmentSignificance: string;
    actualTenGods: string[];
  }>;
}

// 7. 十二长生全景
export interface MingluLifeStagesSectionData {
  tableMatrix: Array<{
    stem: string;
    wuxing: Wuxing;
    stages: Record<string, string>;
  }>;
  natalStages: Array<{
    pillar: string;
    pillarLabel: string;
    stem: string;
    branch: string;
    dayMasterStage: string;
    dayMasterStageDesc: string;
    ziZuoStage: string;
    ziZuoStageDesc: string;
  }>;
}

// 8. 大运流年流月全息编年
export interface MingluMonthlyData {
  monthIndex: number;
  monthName: string;
  solarTerm: string;
  ganZhi: string;
  ganTenGod: string;
  zhiTenGod: string;
  nayin: string;
  commander: string;
}

export interface MingluAnnualYearItem {
  year: number;
  ganZhi: string;
  age: number;
  tenGod: string;
  zhiTenGod: string;
  nayin: string;
  taiSuiShensha: string[];
  interactionWithNatal: string[];
  interactionWithLuck: string[];
  specialEvents: string[];
  yearTheme: string;
  months: MingluMonthlyData[];
}

export interface MingluLuckCycleItem {
  cycleIndex: number;
  /** 条目类型：大运，或起运前的童限（小运） */
  entryType: '大运' | '小运';
  isXiaoyun: boolean;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  ganZhi: string;
  tenGod: string;
  zhiTenGod: string;
  nayin: string;
  lifeStage: string;
  lifeStageDesc: string;
  interactionWithNatal: string[];
  lifeTheme: string;
  careerAdvice: string;
  healthAdvice: string;
  annualYears: MingluAnnualYearItem[];
}

export interface MingluLuckChronicleSectionData {
  startAge: number;
  startYear: number;
  handoverInfo: string;
  direction: '顺行' | '逆行';
  cycles: MingluLuckCycleItem[];
}

// 9. 紫微斗数十二宫全息图谱
export interface MingluZiweiStarFact {
  name: string;
  type: 'major' | 'minor' | 'malefic' | 'helper' | 'adjective' | 'other';
  brightness?: string;
  wuxing?: string;
  birthMutagen?: string;
  /** 当前运限四化（区别于宫位自化 selfMutagens） */
  activeScopeMutagen?: string;
  scopeMutagen?: string;
}

export interface MingluZiweiPalaceData {
  index: number;
  name: string;
  earthlyBranch: string;
  heavenlyStem: string;
  isBodyPalace: boolean;
  isOriginSoulPalace: boolean;
  isLaiYinPalace?: boolean;
  decadalRange: [number, number];
  majorStars: MingluZiweiStarFact[];
  minorStars: MingluZiweiStarFact[];
  maleficStars: MingluZiweiStarFact[];
  otherStars: MingluZiweiStarFact[];
  changsheng12: string;
  boshi12: string;
  suiqian12: string;
  jiangqian12: string;
  oppositePalaceName: string;
  surroundedPalaceNames: string[];
  selfMutagens: string[];
  anchorId: string;
}

export interface MingluZiweiSectionData {
  bureau: string;
  soulMaster: string;
  bodyMaster: string;
  soulPalaceBranch: string;
  bodyPalaceBranch: string;
  palaces: MingluZiweiPalaceData[];
  patterns: Array<{
    name: string;
    type: '吉格' | '凶格' | '中性格';
    matched: boolean;
    conditions: string[];
    traditionalInterpretation: string;
    sourceTitle?: string;
    sourceQuote?: string;
  }>;
  mutagens: Array<{
    mutagen: string;
    star: string;
    palaceName: string;
    significance: string;
  }>;
}

// 10. 西洋占星全景数据
export interface MingluAstrolabePointData {
  name: string;
  label: string;
  sign: string;
  house: number;
  degree: number;
  minute: number;
  formatted: string;
  isRetrograde?: boolean;
  dignity?: string;
}

export interface MingluAstrolabeAspectData {
  body1: string;
  body2: string;
  type: string;
  angle: number;
  orb: number;
  closeness: string;
  isApplying?: boolean | null;
  nature: '和谐' | '挑战' | '中性';
}

export interface MingluAstrolabeSectionData {
  points: MingluAstrolabePointData[];
  angles: MingluAstrolabePointData[];
  houses: Array<{
    house: number;
    sign: string;
    formatted: string;
    planetsInHouse: string[];
  }>;
  aspects: MingluAstrolabeAspectData[];
  distributions: {
    elements: Record<string, { count: number; percentage: number; points: string[] }>;
    modalities: Record<string, { count: number; percentage: number; points: string[] }>;
  };
  dayNight: {
    isDayChart: boolean;
    sunAltitude?: number;
  };
}

// 11. 宅命与风水全息数据
export interface MingluFengshuiSectionData {
  mingGua: {
    gua: string;
    number: number;
    eastWest: string;
    wuxing: string;
    beneficialDirections: Array<{ name: string; direction: string; desc: string }>;
    unfavorableDirections: Array<{ name: string; direction: string; desc: string }>;
  };
  yuanYun: {
    currentYun: number;
    yunName: string;
    wuxing: string;
    period: string;
  };
  residentialChart?: {
    facingDegree?: number;
    facingDirection?: string;
    houseYear?: number;
    houseGua?: string;
    palaces?: Array<{
      direction: string;
      star: string;
      nature: '吉' | '凶';
      desc: string;
    }>;
  };
}

// 12. 跨术数全景互证
export interface MingluCrossSynthesisThemeData {
  themeId: string;
  title: string;
  focus: string;
  baziEvidence: string[];
  ziweiEvidence: string[];
  astrolabeEvidence?: string[];
  crossVerificationNotes: string[];
}

export interface MingluBeginnerGuide {
  coreArchetype: string;
  natureAnalogy: string;
  strengthPlain: string;
  favorableHabitsPlain: string[];
  careerTalentsPlain: string[];
  lifeAdvicePlain: string;
  fourPillarsMetaphor: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
}

// 命录总结构
export interface MingluArticle {
  metadata: MingluMetadata;
  tableOfContents: MingluTOCItem[];
  beginnerGuide?: MingluBeginnerGuide;
  glossary: MingluGlossaryEntry[];
  crossLinks: MingluCrossLink[];

  pillarsSection: MingluPillarsSectionData;
  fiveElementsSection: MingluFiveElementsSectionData;
  patternUsefulGodSection: MingluPatternUsefulGodSectionData;
  interactionsSection: MingluInteractionItem[];
  shenShaSection: MingluShenShaItem[];
  tenGodsSection: MingluTenGodsSectionData;
  lifeStagesSection: MingluLifeStagesSectionData;
  luckChronicleSection: MingluLuckChronicleSectionData;
  ziweiSection?: MingluZiweiSectionData;
  astrolabeSection?: MingluAstrolabeSectionData;
  fengshuiSection?: MingluFengshuiSectionData;
  crossSynthesisSection?: MingluCrossSynthesisThemeData[];

  statistics: {
    totalSections: number;
    totalGlossaryEntries: number;
    totalShenShaCount: number;
    totalInteractionsCount: number;
    totalLuckYearsCount: number;
    totalZiweiStarsCount?: number;
    totalAstrolabeAspectsCount?: number;
  };
}

export interface MingluPersonInput {
  name?: string;
  gender?: 'male' | 'female' | '';
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  birthHour?: number;
  birthMinute?: number;
  birthPlace?: string;
  birthLongitude?: number;
  birthLatitude?: number;
  timezone?: number;
  timeZoneId?: string;
  useTrueSolarTime?: boolean;
}

export interface BuildMingluOptions {
  person: MingluPersonInput;
  baziResult: BaziChartResult;
  ziweiRuntime?: ZiweiRuntime | null;
  astrolabeData?: AstrolabeData | null;
  qizhengResult?: QizhengResult | null;
  residentialResult?: ResidentialFengshuiResult | null;
}
