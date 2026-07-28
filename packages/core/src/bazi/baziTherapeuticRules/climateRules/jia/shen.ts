import type { ClimateRule } from '../../types';

export const JIA_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-jia-bing-gui-first',
    label: '甲日申月先丙后癸规则',
    description: '甲木生申月，金旺木弱，传统多以丙火制金、癸水滋扶，先后有序。',
    months: ['申'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木申月，先丙后癸',
  },
  {
    id: 'shen-month-jia-bing-gui-geng-all',
    label: '甲日申月丙癸庚全透极品规则',
    description: '甲木生申月，丙癸庚三者全透，较合原文"甲木生申月，三者全透，鼎甲可期"。',
    months: ['申'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '甲木申月丙癸庚三者全透，鼎甲可期',
  },
];
