import type { ClimateRule } from '../../types';

export const WU_MAO_CLIMATE_RULES: ClimateRule[] = [
  // “无庚无比印难从杀”跨寅卯两月规则登记于 wu/yin.ts，此处不再重复登记
  {
    id: 'mao-month-wu-bing-jia-first',
    label: '戊日卯月先丙后甲规则',
    description: '戊土生卯月，春湿土润，传统多以丙火暖局、甲木疏土，先后有序。',
    priority: 119,
    months: ['卯'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '戊土卯月，先丙后甲',
  },
  {
    id: 'mao-month-wu-bing-jia-geng-all',
    label: '戊日卯月丙甲庚全透极品规则',
    description: '戊土生卯月，丙甲庚三者全透，较合原文"戊土生卯月，三者全透，鼎甲可期"。',
    priority: 126,
    months: ['卯'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['丙', '甲', '庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '金'],
    traceHints: ['取用层次:丙甲庚三者全透', '成格层次:鼎甲可期'],
    hint: '戊土卯月丙甲庚三者全透，鼎甲可期',
  },
];
