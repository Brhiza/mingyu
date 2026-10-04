import type { ClimateRule } from '../../types';

export const JI_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-ji-bing-gui-jia',
    label: '己日辰月先丙后癸再甲规则',
    description: '己土生辰月，原文先丙暖土，后癸润土，再随局取甲木疏土。',
    priority: 119,
    months: ['辰'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '木'],
    hint: '己土辰月，先丙后癸，再随局取甲疏土',
  },
];
