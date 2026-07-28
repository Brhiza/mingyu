import type { ClimateRule } from '../../types';

export const GUI_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-gui-bing-xin',
    label: '癸日子月丙辛解冻规则',
    description: '癸水生子月，冰冻太过，传统多以丙火解冻为先，辛金滋扶随后，不宜仍只按冬水取火。',
    months: ['子'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '癸水子月，先丙解冻，再取辛金滋扶',
  },
];
