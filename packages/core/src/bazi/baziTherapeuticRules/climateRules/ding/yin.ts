import type { ClimateRule } from '../../types';

export const DING_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-ding-geng-chop-jia',
    label: '丁日寅月庚劈甲引丁规则',
    description: '丁火生寅月，甲木当权，取庚金劈甲以引丁。',
    priority: 118,
    months: ['寅'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    hint: '丁火寅月，取庚劈甲引丁',
  },
];
