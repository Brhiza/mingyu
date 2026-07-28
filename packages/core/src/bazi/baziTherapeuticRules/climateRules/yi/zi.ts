import type { ClimateRule } from '../../types';

export const YI_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-yi-bing-gui-first',
    label: '乙日子月先丙后癸规则',
    description: '乙木生子月，寒冬木冻，传统多以丙火解冻、癸水滋扶，先暖后润。',
    months: ['子'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木子月，先丙后癸',
  },
  {
    id: 'zi-month-yi-bing-gui-xin-all',
    label: '乙日子月丙癸辛全透极品规则',
    description: '乙木生子月，丙癸辛三者全透，较合原文"乙木生子月，三者全透，鼎甲可期"。',
    months: ['子'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    requiredVisibleStems: ['丙', '癸', '辛'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸辛三者全透', '成格层次:鼎甲可期'],
    hint: '乙木子月丙癸辛三者全透，鼎甲可期',
  },
];
