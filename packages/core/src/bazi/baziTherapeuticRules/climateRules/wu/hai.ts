import type { ClimateRule } from '../../types';

export const WU_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-wu-bing-jia-first',
    label: '戊日亥月先甲后丙规则',
    description: '戊土生亥月，时值小阳，原文先用甲木疏土，次取丙火照暖。',
    priority: 120,
    months: ['亥'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    hint: '戊土亥月，先甲后丙',
  },
];
