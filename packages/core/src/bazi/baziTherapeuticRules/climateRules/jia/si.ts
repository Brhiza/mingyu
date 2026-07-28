import type { ClimateRule } from '../../types';

export const JIA_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-jia-gui-ding-geng',
    label: '甲日巳月先癸后丁规则',
    description:
      '甲木生巳月，丙火司权，传统以癸水为先，丁火次之，并借庚金佐助成材，不宜仍停留在单一润燥判断。',
    months: ['巳'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '金'],
    hint: '甲木巳月，先癸后丁，庚金佐助',
  },
];
