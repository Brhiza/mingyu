import type { ClimateRule } from '../../types';

export const GUI_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-gui-xin-bing',
    label: '癸日酉月辛丙并用规则',
    description: '癸水生酉月，正金白水清，传统多取辛金为用、丙火佐之，较简单秋水喜金更完整。',
    months: ['酉'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '癸水酉月，辛金为用，丙火佐之',
  },
];
