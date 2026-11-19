export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type YinYang = '阳' | '阴';
export type FiveElement = '木' | '火' | '土' | '金' | '水';
export type FiveElementsClass = '水二局' | '木三局' | '金四局' | '土五局' | '火六局';
export type Brightness = '庙' | '旺' | '得' | '利' | '平' | '不' | '陷' | '';
export type Mutagen = '禄' | '权' | '科' | '忌';
export type StarType = 'major' | 'soft' | 'tough' | 'lucun' | 'tianma' | 'flower' | 'helper' | 'adjective';
export type ScopeName = 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly';
export type ZiweiAlgorithm = 'default' | 'zhongzhou' | 'beipai';
export type MutagenSchool = 'default' | 'zhongzhou' | 'quanshu' | 'tianfu';
export type LeapMonthMode = 'split-15' | 'same' | 'next';
export type PlateType = 'heaven' | 'earth' | 'human';
export type TianmaMode = 'year' | 'month';
export type DivideMode = 'normal' | 'exact';
export type AgeDivideMode = 'normal' | 'birthday';
export type DayDivideMode = 'forward' | 'current';
export type GenderLabel = '男' | '女' | '中性';

export interface ZiweiEngineRules {
  algorithm: ZiweiAlgorithm;
  fixLeap: boolean;
  leapMonthMode: LeapMonthMode;
  mutagenSchool: MutagenSchool;
  plateType: PlateType;
  tianmaMode: TianmaMode;
  yearDivide: DivideMode;
  horoscopeDivide: DivideMode;
  ageDivide: AgeDivideMode;
  dayDivide: DayDivideMode;
}

export interface ZiweiStar {
  name: string;
  type: StarType;
  scope: ScopeName;
  brightness?: string;
  mutagen?: Mutagen;
}

export interface ZiweiPalaceRaw {
  index: number;
  name: string;
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  majorStars: ZiweiStar[];
  minorStars: ZiweiStar[];
  adjectiveStars: ZiweiStar[];
  changsheng12: string;
  boshi12: string;
  jiangqian12: string;
  suiqian12: string;
  decadal: {
    range: [number, number];
    heavenlyStem: HeavenlyStem;
    earthlyBranch: EarthlyBranch;
  };
  ages: number[];
}

export interface LunarDateParts {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeap: boolean;
  maxDaysInMonth: number;
  toString(chinese?: boolean): string;
}

export interface ChineseDatePillars {
  yearly: [HeavenlyStem, EarthlyBranch];
  monthly: [HeavenlyStem, EarthlyBranch];
  daily: [HeavenlyStem, EarthlyBranch];
  hourly: [HeavenlyStem, EarthlyBranch];
}

export interface ZiweiAstrolabe {
  gender: GenderLabel;
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  rawDates: {
    lunarDate: LunarDateParts;
    chineseDate: ChineseDatePillars;
  };
  time: string;
  timeRange: string;
  sign: string;
  zodiac: string;
  earthlyBranchOfSoulPalace: EarthlyBranch;
  earthlyBranchOfBodyPalace: EarthlyBranch;
  soul: string;
  body: string;
  fiveElementsClass: FiveElementsClass;
  palaces: ZiweiPalaceRaw[];
  rules: ZiweiEngineRules;
  omittedGenderStars?: Array<{ palace: string; stars: string[] }>;
}

export interface ZiweiHoroscopeScopeItem {
  index: number;
  name: string;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  palaceNames: string[];
  mutagen: string[];
  stars?: ZiweiStar[][];
}

export interface ZiweiHoroscope {
  solarDate: string;
  lunarDate: string;
  decadal: ZiweiHoroscopeScopeItem;
  age: ZiweiHoroscopeScopeItem & { nominalAge: number };
  yearly: ZiweiHoroscopeScopeItem & {
    yearlyDecStar: { suiqian12: string[]; jiangqian12: string[] };
  };
  monthly: ZiweiHoroscopeScopeItem;
  daily: ZiweiHoroscopeScopeItem;
  hourly: ZiweiHoroscopeScopeItem;
}
