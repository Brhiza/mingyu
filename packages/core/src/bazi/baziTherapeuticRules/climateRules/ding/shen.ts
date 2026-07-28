import type { ClimateRule } from '../../types';

export const DING_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-ding-geng-jia-first',
    label: '丁日申月先庚后甲规则',
    description: '丁火生申月，金旺火衰，传统多以庚金发源、甲木生扶，先后有序。',
    months: ['申'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    hint: '丁火申月，先庚后甲',
  },
  {
    id: 'shen-month-ding-geng-jia-ren-all',
    label: '丁日申月庚甲壬全透极品规则',
    description: '丁火生申月，庚甲壬三者全透，较合原文"丁火生申月，三者全透，鼎甲可期"。',
    months: ['申'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredVisibleStems: ['庚', '甲', '壬'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木', '水'],
    traceHints: ['取用层次:庚甲壬三者全透', '成格层次:鼎甲可期'],
    hint: '丁火申月庚甲壬三者全透，鼎甲可期',
  },
];
