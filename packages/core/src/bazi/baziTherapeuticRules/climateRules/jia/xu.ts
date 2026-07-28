import type { ClimateRule } from '../../types';

export const JIA_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-jia-bing-gui-first',
    label: '甲日戌月先丙后癸规则',
    description: '甲木生戌月，秋深气凉，传统多以丙火调候、癸水滋扶，先暖后润。',
    months: ['戌'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木戌月，先丙后癸',
  },
  {
    id: 'xu-month-jia-bing-gui-geng-all',
    label: '甲日戌月丙癸庚全透极品规则',
    description: '甲木生戌月，丙癸庚三者全透，较合原文"甲木生戌月，三者全透，鼎甲可期"。',
    months: ['戌'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    requiredVisibleStems: ['丙', '癸', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '金'],
    traceHints: ['取用层次:丙癸庚三者全透', '成格层次:鼎甲可期'],
    hint: '甲木戌月丙癸庚三者全透，鼎甲可期',
  },
];
