import type { ClimateRule } from '../../types';

export const WU_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-wu-bing-jia-first',
    label: '戊日子月先丙后甲规则',
    description: '戊土生子月，冬寒土冻，传统多以丙火暖局、甲木疏土，先后有序。',
    priority: 120,
    months: ['子'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '戊土子月，先丙后甲',
  },
];
