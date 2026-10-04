import type { ClimateRule } from '../../types';

export const GENG_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-geng-bing-first',
    label: '庚日丑月先丙次丁规则',
    description: '庚金生丑月，先取丙火解冻，次取丁火炼金，甲木亦不可少。',
    priority: 121,
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金丑月，先丙解冻、次丁炼金，甲亦不可少',
  },
];
