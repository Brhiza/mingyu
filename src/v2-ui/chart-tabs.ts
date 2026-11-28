export type PersonalChartTabId =
  | 'bazi'
  | 'ziwei'
  | 'bazi-ziwei'
  | 'qimen-lifetime'
  | 'astrolabe'
  | 'qizheng'
  | 'minglu';

export type CompatibilityChartTabId =
  | 'bazi-synastry'
  | 'ziwei-synastry'
  | 'astrolabe-synastry';

export type DivinationFormMethod =
  | 'liuyao'
  | 'meihua'
  | 'qimen'
  | 'liuren'
  | 'jinkoujue'
  | 'taiyi'
  | 'xiaoliuren'
  | 'huangji-jingshi'
  | 'wuyun-liuqi'
  | 'tarot'
  | 'lenormand'
  | 'ssgw'
  | 'zhuge'
  | 'random-divination'
  | 'almanac'
  | 'bazhai'
  | 'xuankong'
  | 'residential';

export const DIVINATION_FORM_METHODS: readonly DivinationFormMethod[] = [
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'jinkoujue',
  'taiyi',
  'xiaoliuren',
  'huangji-jingshi',
  'wuyun-liuqi',
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'random-divination',
  'almanac',
  'bazhai',
  'xuankong',
  'residential',
];

export function isDivinationFormMethod(method: string): method is DivinationFormMethod {
  return (DIVINATION_FORM_METHODS as readonly string[]).includes(method);
}

export const PERSONAL_CHART_TABS: ReadonlyArray<{
  id: PersonalChartTabId;
  label: string;
  shortLabel: string;
}> = [
  { id: 'bazi', label: '八字', shortLabel: '八字' },
  { id: 'ziwei', label: '紫微斗数', shortLabel: '紫微' },
  { id: 'qimen-lifetime', label: '奇门终身局', shortLabel: '奇门' },
  { id: 'astrolabe', label: '西洋星盘', shortLabel: '星盘' },
  { id: 'qizheng', label: '七政四余', shortLabel: '七政' },
  { id: 'bazi-ziwei', label: '多术数合参', shortLabel: '合参' },
  { id: 'minglu', label: '命录', shortLabel: '命录' },
];

export const COMPATIBILITY_CHART_TABS: ReadonlyArray<{
  id: CompatibilityChartTabId;
  label: string;
  shortLabel: string;
}> = [
  { id: 'bazi-synastry', label: '八字合盘', shortLabel: '八字合盘' },
  { id: 'ziwei-synastry', label: '紫微合盘', shortLabel: '紫微合盘' },
  { id: 'astrolabe-synastry', label: '西洋星盘合盘', shortLabel: '星盘合盘' },
];

export function isPersonalChartMethod(method: string): method is PersonalChartTabId {
  return PERSONAL_CHART_TABS.some((item) => item.id === method);
}

export function isCompatibilityChartMethod(method: string): method is CompatibilityChartTabId {
  return COMPATIBILITY_CHART_TABS.some((item) => item.id === method);
}
