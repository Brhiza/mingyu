import type { ClimateRule } from '../../types';

export const JIA_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-jia-bing-gui-first',
    label: '甲日卯月先丙后癸规则',
    description: '甲木生卯月，羊刃当令，传统多以丙火调候、癸水滋扶，先暖后润。',
    months: ['卯'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木卯月，先丙后癸',
  },
  {
    id: 'mao-month-jia-bing-gui-wu-all',
    label: '甲日卯月丙癸戊全透极品规则',
    description: '甲木生卯月，丙癸戊三者全透，较合原文"甲木生卯月，三者全透，鼎甲可期"。',
    months: ['卯'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    requiredVisibleStems: ['丙', '癸', '戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '土'],
    traceHints: ['取用层次:丙癸戊三者全透', '成格层次:鼎甲可期'],
    hint: '甲木卯月丙癸戊三者全透，鼎甲可期',
  },
];
