export type FortuneScope = 'daily' | 'monthly' | 'yearly';
export type FortuneTopic =
  | 'general'
  | 'career'
  | 'wealth'
  | 'relationship'
  | 'academic'
  | 'health'
  | 'decision';

export type FortuneTrend = '旺' | '平' | '谨';
export type FortuneTier = '大吉' | '顺遂' | '平稳' | '谨慎' | '波动';

export interface FortuneScoreFactor {
  label: string;
  category: 'bazi' | 'ziwei' | 'astrolabe' | 'almanac' | 'wuyun';
  impact: number;
  sentiment: 'positive' | 'neutral' | 'caution';
  detail: string;
}

export interface FortuneDimension {
  id: 'career' | 'wealth' | 'relationship' | 'health' | 'decision';
  label: string;
  score: number;
  trend: FortuneTrend;
  focused?: boolean;
  summary: string;
}

export interface FortuneLuckyElements {
  wuxing: string[];
  colors: string[];
  directions: string[];
  numbers: number[];
  hours?: string[];
  focusTip: string;
}

export interface FortuneOverview {
  overallScore: number;
  overallTier: FortuneTier;
  headline: string;
  keywords: string[];
  scoreFactors: FortuneScoreFactor[];
  dimensions: FortuneDimension[];
  actionGuide: {
    suitable: string[];
    caution: string[];
    luckyElements: FortuneLuckyElements;
  };
}

export interface DailyHourSlice {
  name: string;
  range: string;
  ganzhi: string;
  twelveStar: string;
  tenGod?: string;
  rating: '吉' | '平' | '慎';
  note: string;
}

export interface MonthlyDaySlice {
  date: string;
  day: number;
  weekday: string;
  weekdayIndex: number;
  lunarDate: string;
  dayGanZhi: string;
  dayOfficer: string;
  twelveStar: string;
  tenGod?: string;
  score: number;
  rating: '优选' | '平稳' | '慎用';
  tag: string;
}

export interface YearlyMonthSlice {
  monthIndex: number;
  jieName: string;
  startDate: string;
  endDate: string;
  monthGanZhi: string;
  tenGod?: string;
  ziweiPalace?: string;
  ziweiMutagens?: string[];
  score: number;
  trend: FortuneTrend;
  note: string;
}

export interface FortuneCalendarContext {
  targetDate: string;
  year: number;
  month: number;
  day: number;
  weekday: string;
  lunarDate: string;
  solarTerm: string;
  ganzhi: { year: string; month: string; day: string };
  nayin: { year: string; month: string; day: string };
  dayOfficer: string;
  twelveStar: string;
  twentyEightStar: string;
  nineStar: string;
  clash: string;
  recommends: string[];
  avoids: string[];
  dailyDirections: {
    joy: string;
    wealth: string;
    mascot: string;
    yangGui: string;
    yinGui: string;
  };
  gods: Array<{ name: string; luck: string }>;
}

export interface PersonalBaziSummary {
  dayMaster: string;
  dayMasterElement: string;
  strengthStatus: string;
  pattern: string;
  useful: string;
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  natalPillars: { year: string; month: string; day: string; hour: string };
  dayunGanZhi: string | null;
  flowYearGanZhi: string;
  flowMonthGanZhi: string;
  flowDayGanZhi: string;
  flowTenGods: {
    dayun?: string;
    year: string;
    month: string;
    day: string;
  };
  interactions: string[];
  shenshaHits: string[];
  precisionNote?: string;
}

export interface PersonalZiweiSummary {
  natalMingPalace: string;
  yearlyPalace?: string;
  yearlyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
  monthlyPalace?: string;
  monthlyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
  dailyPalace?: string;
  dailyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
}

export interface PersonalAstrolabeSummary {
  sunSign: string;
  moonSign: string;
  ascSign: string;
  topAspects: Array<{
    movingName: string;
    aspectLabel: string;
    natalName: string;
    strength: number;
    phase: string | null;
  }>;
  solarReturnHighlights?: string[];
}
