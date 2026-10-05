import type { ClimateRule } from '../../types';

export const JIA_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-jia-geng-ding-first',
    label: '甲日丑月先庚后丁规则',
    description: '十二月甲木先用庚劈甲以引丁火；丁透重重时还须比肩配合，支多水须另核。',
    priority: 121,
    months: ['丑'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '甲木丑月先庚后丁，庚劈甲以引丁火',
  },
];
