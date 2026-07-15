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
  /** 开启真太阳时时的统一校正证据；只作输出透传，不参与紫微底层排盘参数。 */
  trueSolarEvidence?: import('../calendar/true-solar-time').TrueSolarTimeEvidenceFields;
};
