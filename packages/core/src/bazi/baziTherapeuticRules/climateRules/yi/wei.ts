import type { ClimateRule } from '../../types';

export const YI_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-yi-bing-gui-first',
    label: '乙日未月先癸后丙规则',
    description: '乙木生未月，燥土司令，传统多以癸水为先、丙火次之，先润后暖。',
    months: ['未'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '乙木未月，先癸后丙',
  },
  {
    id: 'wei-month-yi-gui-bing-geng-all',
    label: '乙日未月癸丙庚全透极品规则',
    description: '乙木生未月，癸丙庚三者全透，较合原文"乙木生未月，三者全透，鼎甲可期"。',
    months: ['未'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    requiredVisibleStems: ['癸', '丙', '庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '金'],
    traceHints: ['取用层次:癸丙庚三者全透', '成格层次:鼎甲可期'],
    hint: '乙木未月癸丙庚三者全透，鼎甲可期',
  },
];
