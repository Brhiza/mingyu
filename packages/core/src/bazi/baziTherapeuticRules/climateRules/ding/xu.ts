import type { ClimateRule } from '../../types';

export const DING_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-ding-geng-jia-first',
    label: '丁日戌月先庚后甲规则',
    description: '丁火生戌月，火入库而衰，传统多以庚金发源、甲木生扶，先后有序。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    hint: '丁火戌月，先庚后甲',
  },
  {
    id: 'xu-month-ding-geng-jia-ren-all',
    label: '丁日戌月庚甲壬全透极品规则',
    description: '丁火生戌月，庚甲壬三者全透，较合原文"丁火生戌月，三者全透，鼎甲可期"。',
    months: ['戌'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredVisibleStems: ['庚', '甲', '壬'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木', '水'],
    traceHints: ['取用层次:庚甲壬三者全透', '成格层次:鼎甲可期'],
    hint: '丁火戌月庚甲壬三者全透，鼎甲可期',
  },
];
