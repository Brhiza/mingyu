import type { ClimateRule } from '../../types';

export const DING_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-ding-geng-jia-first',
    label: '丁日未月甲主壬次规则',
    description: '丁火生未月，阴柔退气，专取甲木，壬水次之；原文另述无庚不妙。',
    priority: 119,
    months: ['未'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    hint: '丁火未月，专取甲木，壬水次之',
  },
];
