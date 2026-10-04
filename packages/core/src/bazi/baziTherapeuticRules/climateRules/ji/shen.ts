import type { ClimateRule } from '../../types';

export const JI_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-ji-bing-jia-first',
    label: '己日申月先癸后丙规则',
    description: '己土生申月，依三秋总论先癸润土，后丙温土，辛金辅癸。',
    priority: 119,
    months: ['申'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '金'],
    hint: '己土申月，先癸后丙，辛金辅癸',
  },
];
