import type { ClimateRule } from '../../types';

export const DING_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-ding-geng-jia-first',
    label: '丁日亥月甲尊庚佐规则',
    description: '丁火生亥月，甲木为尊以引丁，庚金为佐以劈甲；癸戊随盘面酌用。',
    priority: 119,
    months: ['亥'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火亥月，甲木为尊，庚金为佐',
  },
];
