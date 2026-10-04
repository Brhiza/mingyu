import type { ClimateRule } from '../../types';

export const JI_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-ji-bing-jia-first',
    label: '己日子月先丙后甲规则',
    description: '己土生子月，冬寒土冻，传统多以丙火暖局、甲木疏土，先后有序。',
    priority: 120,
    months: ['子'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '己土子月，先丙后甲',
  },
];
