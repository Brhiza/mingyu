import type { ClimateRule } from '../../types';

export const WU_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-wu-bing-jia-first',
    label: '戊日亥月先丙后甲规则',
    description: '戊土生亥月，水冷土寒，传统多以丙火暖局、甲木疏土，先后有序。',
    months: ['亥'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '戊土亥月，先丙后甲',
  },
  {
    id: 'hai-month-wu-bing-jia-geng-all',
    label: '戊日亥月丙甲庚全透极品规则',
    description: '戊土生亥月，丙甲庚三者全透，较合原文"戊土生亥月，三者全透，鼎甲可期"。',
    months: ['亥'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['丙', '甲', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '金'],
    traceHints: ['取用层次:丙甲庚三者全透', '成格层次:鼎甲可期'],
    hint: '戊土亥月丙甲庚三者全透，鼎甲可期',
  },
];
