import type { ClimateRule } from '../../types';

export const DING_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-ding-geng-jia-first',
    label: '丁日申月甲主庚劈甲规则',
    description: '丁火生申月，三秋专用甲木，仍取庚劈甲以引丁；七月可借丙暖金晒木。',
    priority: 119,
    months: ['申'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火申月，甲木为主、庚劈甲引丁，可借丙暖金晒木',
  },
];
