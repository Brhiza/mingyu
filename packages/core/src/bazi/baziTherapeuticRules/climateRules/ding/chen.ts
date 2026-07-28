import type { ClimateRule } from '../../types';

export const DING_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-ding-geng-jia-first',
    label: '丁日辰月先庚后甲规则',
    description: '丁火生辰月，土旺泄火，传统多以庚金发源、甲木生扶，先后有序。',
    months: ['辰'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    hint: '丁火辰月，先庚后甲',
  },
];
