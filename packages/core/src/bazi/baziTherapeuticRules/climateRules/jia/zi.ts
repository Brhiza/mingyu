import type { ClimateRule } from '../../types';

export const JIA_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-jia-bing-gui-first',
    label: '甲日子月先丙后癸规则',
    description: '甲木生子月，寒冬木冻，传统多以丙火解冻、癸水滋扶，先暖后润。',
    months: ['子'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木子月，先丙后癸',
  },
  {
    id: 'zi-month-jia-bing-gui-geng-all',
    label: '甲日子月丙癸庚全透极品规则',
    description: '甲木生子月，丙癸庚三者全透，较合原文"甲木生子月，三者全透，鼎甲可期"。',
    months: ['子'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '甲木子月丙癸庚三者全透，鼎甲可期',
  },
];
