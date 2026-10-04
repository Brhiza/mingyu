import type { ClimateRule } from '../../types';

export const JI_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-ji-bing-jia-first',
    label: '己日寅月丙火为尊规则',
    description: '己土生寅月，田园犹冻，原文以丙火照暖为尊；壬水偏多时另以戊土为堤。',
    priority: 119,
    months: ['寅'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: '己土寅月，以丙火照暖为尊',
  },
];
