import type { ClimateRule } from '../../types';

export const JIA_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-jia-ding-geng-bing',
    label: '甲日子月丁先庚后丙佐规则',
    description: '甲木生子月，原文丁火为先、庚金随后，丙火佐之；癸水透出可能伤丁。',
    priority: 121,
    months: ['子'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '甲木子月，先丁后庚，丙火为佐',
  },
];
