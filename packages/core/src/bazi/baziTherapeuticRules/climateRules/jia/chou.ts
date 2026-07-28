import type { ClimateRule } from '../../types';

export const JIA_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-jia-bing-gui-first',
    label: '甲日丑月先丙后癸规则',
    description: '甲木生丑月，湿寒交加，传统多以丙火解冻、癸水滋扶，先暖后润。',
    months: ['丑'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木丑月，先丙后癸',
  },
  {
    id: 'chou-month-jia-bing-gui-geng-all',
    label: '甲日丑月丙癸庚全透极品规则',
    description: '甲木生丑月，丙癸庚三者全透，较合原文"甲木生丑月，三者全透，鼎甲可期"。',
    months: ['丑'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '甲木丑月丙癸庚三者全透，鼎甲可期',
  },
];
