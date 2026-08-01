export type ZiweiTraditionalBirthSource = {
  method: 'time-index';
  name: string;
  gender: '男' | '女';
  dateType: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  birthTimeIndex: number;
};

export type ZiweiTrueSolarBirthSource = {
  method: 'true-solar-time';
  name: string;
  gender: '男' | '女';
  dateType: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  birthHour: number;
  birthMinute: number;
  birthLongitude: number;
  timezone: number;
  applyChinaDst: boolean;
};

export type ZiweiBirthSource = ZiweiTraditionalBirthSource | ZiweiTrueSolarBirthSource;

export type ZiweiCalculationSource = {
  fixLeap: boolean;
  algorithm: 'default' | 'zhongzhou';
  yearDivide: 'normal' | 'exact';
  horoscopeDivide: 'normal' | 'exact';
  ageDivide: 'normal' | 'birthday';
  dayDivide: 'current' | 'forward';
};

export type ZiweiGenerationSource = {
  birth: ZiweiBirthSource;
  calculation: ZiweiCalculationSource;
  timestamp: number;
  scopes: import('./analysis').ScopeType[];
  skipAnalysis: boolean;
};

export type ChartInput = {
  name: string;
  dateType: 'solar' | 'lunar';
  birthDate: string;
  birthTimeIndex: number;
  gender: '男' | '女';
  isLeapMonth?: boolean;
  fixLeap?: boolean;
  algorithm?: 'default' | 'zhongzhou';
  yearDivide?: 'normal' | 'exact';
  horoscopeDivide?: 'normal' | 'exact';
  ageDivide?: 'normal' | 'birthday';
  dayDivide?: 'current' | 'forward';
  /** 生成可信结果时优先采用的最小出生来源；真太阳时不得只保存校正后的派生盘面。 */
  birthSource?: ZiweiBirthSource;
  /** 开启真太阳时时的统一校正证据；只作输出透传，不参与紫微底层排盘参数。 */
  trueSolarEvidence?: import('../calendar/true-solar-time').TrueSolarTimeEvidenceFields;
};
