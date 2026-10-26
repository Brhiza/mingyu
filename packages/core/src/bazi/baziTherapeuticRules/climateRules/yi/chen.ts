import type { ClimateRule } from '../../types';

export const YI_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-yi-gui-bing',
    recommendationStems: ['癸', '丙'],
    label: '乙日辰月先癸后丙规则',
    description: '乙木生辰月，阳气渐炽，传统以癸水为先、丙火次之，先滋后发，不宜仍按春木一律先火。',
    priority: 118,
    months: ['辰'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '乙木辰月，先癸后丙',
  },
];
