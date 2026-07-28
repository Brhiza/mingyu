import type { ClimateRule } from '../../types';

export const JI_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-ji-bing-jia-first',
    label: '己日辰月先丙后甲规则',
    description: '己土生辰月，春深土湿，传统多以丙火暖局、甲木疏土，先后有序。',
    months: ['辰'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '己土辰月，先丙后甲',
  },
];
