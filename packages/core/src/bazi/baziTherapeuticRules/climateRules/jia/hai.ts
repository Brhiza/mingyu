import type { ClimateRule } from '../../types';

export const JIA_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-jia-bing-gui-first',
    label: '甲日亥月先丙后癸规则',
    description: '甲木生亥月，水冷木寒，传统多以丙火解冻、癸水滋扶，先暖后润。',
    months: ['亥'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木亥月，先丙后癸',
  },
  {
    id: 'hai-month-jia-bing-gui-geng-all',
    label: '甲日亥月丙癸庚全透极品规则',
    description: '甲木生亥月，丙癸庚三者全透，较合原文"甲木生亥月，三者全透，鼎甲可期"。',
    months: ['亥'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '甲木亥月丙癸庚三者全透，鼎甲可期',
  },
];
