import type { ClimateRule } from '../../types';

export const WU_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-wu-gui-bing-first',
    label: '戊日巳月甲先丙癸为佐规则',
    description: '戊土生巳月，外实内虚，原文先用甲木疏劈，次取丙火、癸水为佐。',
    priority: 120,
    months: ['巳'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火', '水'],
    hint: '戊土巳月，先甲木疏土，丙火、癸水为佐',
  },
];
