import type { ClimateRule } from '../../types';

export const WU_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-mao-month-wu-no-geng-no-resource-follow-kill-fail',
    label: '戊日寅卯月无庚无比印难从杀规则',
    description:
      '戊土生寅卯月，木势偏盛时常以庚金为先；若木多而庚金不透，且天干又无比劫、印星扶身，传统多断难作从杀，主遭凶困顿，不宜仍按可从之局泛论。',
    priority: 123,
    months: ['寅', '卯'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    forbiddenVisibleStems: ['庚'],
    minWuxingCounts: { 木: 4 },
    minTenGodCategoryVisibleCounts: { 官杀: 2 },
    maxTenGodCategoryVisibleCounts: { 比劫: 0, 印星: 0 },
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    traceHints: ['破格因素:无庚且无比印', '成格层次:难作从杀，定主遭凶'],
    hint: '戊土寅卯月木多而无庚且无比印，难作从杀',
  },
  {
    id: 'yin-month-wu-bing-jia-first',
    label: '戊日寅月先丙后甲规则',
    description: '戊土生寅月，春寒未尽，传统多以丙火暖局、甲木疏土，先后有序。',
    priority: 119,
    months: ['寅'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '戊土寅月，先丙后甲',
  },
];
