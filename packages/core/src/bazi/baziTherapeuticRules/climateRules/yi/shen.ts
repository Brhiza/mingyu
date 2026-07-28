import type { ClimateRule } from '../../types';

export const YI_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-yi-bing-gui-first',
    label: '乙日申月先丙后癸规则',
    description: '乙木生申月，金旺木弱，传统多以丙火制金、癸水滋木，先后有序。',
    months: ['申'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木申月，先丙后癸',
  },
  {
    id: 'shen-month-yi-bing-gui-geng-all',
    label: '乙日申月丙癸庚全透极品规则',
    description: '乙木生申月，丙癸庚三者全透，较合原文"乙木生申月，三者全透，鼎甲可期"。',
    months: ['申'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '乙木申月丙癸庚三者全透，鼎甲可期',
  },
];
