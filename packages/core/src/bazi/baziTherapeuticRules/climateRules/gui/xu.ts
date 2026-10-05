import type { ClimateRule } from '../../types';

export const GUI_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-gui-xin-jia',
    label: '癸日戌月辛甲并用规则',
    description: '癸水生戌月，戊土司权，原文取辛金发水源、甲木制戊，辛甲并用。',
    priority: 120,
    months: ['戌'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    hint: '癸水戌月，辛金发源、甲木制戊并核',
  },
];
