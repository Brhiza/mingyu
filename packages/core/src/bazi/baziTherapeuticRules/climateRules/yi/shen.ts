import type { ClimateRule } from '../../types';

export const YI_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-yi-bing-gui-first',
    label: '乙日申月先丙后癸规则',
    description: '乙木生申月，金旺木弱，传统多以丙火制金、癸水滋木，先后有序。',
    priority: 120,
    months: ['申'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木申月，先丙后癸',
  },
];
