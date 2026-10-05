import type { ClimateRule } from '../../types';

export const GENG_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-geng-ding-jia-first',
    label: '庚日未月先丁后甲规则',
    description: '庚金生未月，三伏生寒，先用丁火，次取甲木；支会土局时才改为甲先丁后。',
    priority: 121,
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金未月，先丁后甲；支会土局另论甲先丁后',
  },
];
