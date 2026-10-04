import type { ClimateRule } from '../../types';

// “己日夏月无癸有壬权代”跨巳午未三月规则登记于 ji/si.ts，此处只登记六月基础取用。
export const JI_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-ji-gui-bing-first',
    label: '己日未月先癸后丙规则',
    description: '三夏己土禾稼在田，原文以癸水甘沛为要、丙火照暖次之；无癸有壬另论。',
    priority: 115,
    months: ['未'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '己土未月，癸水为要、丙火次之',
  },
];
