import type { ClimateRule } from '../../types';

export const GENG_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-geng-bing-jia-visible',
    label: '庚日寅月丙甲两透科甲规则',
    description: '庚金生寅月，先取丙暖庚，甲木疏土；丙甲两透，科甲显荣。',
    priority: 123,
    months: ['寅'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丙', '甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金寅月丙甲两透，科甲显荣',
  },
  {
    id: 'yin-month-geng-bing-jia-first',
    label: '庚日寅月先丙甲丁次规则',
    description: '庚金生寅月，先用丙暖庚，甲木疏土，丁火次之。',
    priority: 119,
    months: ['寅'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金寅月，先用丙暖庚，甲木疏土，丁火次之',
  },
];
