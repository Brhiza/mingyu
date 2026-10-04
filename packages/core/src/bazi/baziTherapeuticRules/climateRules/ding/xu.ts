import type { ClimateRule } from '../../types';

export const DING_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-ding-geng-jia-first',
    label: '丁日戌月甲庚并用规则',
    description: '丁火生戌月，九月专用甲庚，甲木引丁而庚金劈甲。',
    priority: 119,
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '丁火戌月，专用甲庚，甲引丁、庚劈甲',
  },
];
