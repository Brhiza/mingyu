import type { ClimateRule } from '../../types';

export const YI_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-yi-gui-xin-first',
    label: '乙日戌月癸辛取用规则',
    description: '九月乙木根枯叶落，赖癸水滋养，辛金发癸水之源。',
    priority: 120,
    months: ['戌'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '乙木戌月癸水滋养，辛金发源',
  },
];
