import type { ClimateRule } from '../../types';

export const YI_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-yi-bing-gui-first',
    label: '乙日亥月先丙后癸规则',
    description: '乙木生亥月，水冷木寒，传统多以丙火解冻、癸水滋扶，先暖后润。',
    months: ['亥'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木亥月，先丙后癸',
  },
  {
    id: 'hai-month-yi-bing-gui-geng-all',
    label: '乙日亥月丙癸庚全透极品规则',
    description: '乙木生亥月，丙癸庚三者全透，较合原文"乙木生亥月，三者全透，鼎甲可期"。',
    months: ['亥'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '乙木亥月丙癸庚三者全透，鼎甲可期',
  },
];
