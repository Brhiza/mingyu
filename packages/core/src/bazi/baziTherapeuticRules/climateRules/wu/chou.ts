import type { ClimateRule } from '../../types';

export const WU_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-wu-bing-jia-first',
    label: '戊日丑月先丙后甲规则',
    description: '戊土生丑月，湿寒交加，传统多以丙火暖局、甲木疏土，先后有序。',
    months: ['丑'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '戊土丑月，先丙后甲',
  },
  {
    id: 'chou-month-wu-bing-jia-geng-all',
    label: '戊日丑月丙甲庚全透极品规则',
    description: '戊土生丑月，丙甲庚三者全透，较合原文"戊土生丑月，三者全透，鼎甲可期"。',
    months: ['丑'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['丙', '甲', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '金'],
    traceHints: ['取用层次:丙甲庚三者全透', '成格层次:鼎甲可期'],
    hint: '戊土丑月丙甲庚三者全透，鼎甲可期',
  },
];
