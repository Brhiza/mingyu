import type { ClimateRule } from '../../types';

export const JI_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-ji-gui-bing-jia',
    label: '己日戌月先癸后丙兼甲规则',
    description: '己土生戌月，三秋己土以癸润土为先、丙火温土为后；九月土盛，另需甲木疏土。',
    priority: 119,
    months: ['戌'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '木'],
    hint: '己土戌月，先癸后丙；土盛再核甲木疏土',
  },
];
