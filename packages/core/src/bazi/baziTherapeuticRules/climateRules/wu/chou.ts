import type { ClimateRule } from '../../types';

export const WU_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-wu-bing-jia-first',
    label: '戊日丑月先丙后甲规则',
    description: '戊土生丑月，湿寒交加，传统多以丙火暖局、甲木疏土，先后有序。',
    priority: 121,
    months: ['丑'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '戊土丑月，先丙后甲',
  },
];
