import type { ClimateRule } from '../../types';

export const JI_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-ji-gui-bing',
    recommendationStems: ['癸', '丙'],
    label: '己日酉月先癸后丙规则',
    description: '己土生酉月，秋燥渐寒，传统以癸水为先、丙火后之，兼有润燥制金之意。',
    priority: 116,
    months: ['酉'],
    dayMasters: ['土'],
    dayStems: ['己'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '己土酉月，先癸后丙',
  },
];
