import type { ClimateRule } from '../../types';

export const JIA_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-jia-ding-geng',
    label: '甲日未月先丁后庚规则',
    description:
      '甲木生未月，丁火退气而木仍需裁成，传统多先丁火，次庚金，无癸亦可，不宜仍按午月同断。',
    months: ['未'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金', '水'],
    hint: '甲木未月，先丁后庚，癸水酌用',
  },
];
