import type { ClimateRule } from '../../types';

export const GUI_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-gui-xin-bing',
    label: '癸日寅月辛丙并用规则',
    description: '癸水生寅月，雨露之精逢春木泄气，传统多以辛金为主、丙火次之，兼顾发源与温养。',
    months: ['寅'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '癸水寅月，辛金为主，丙火次之',
  },
];
