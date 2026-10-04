import type { ClimateRule } from '../../types';

export const REN_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-ren-water-self-support',
    label: '壬日巳月比肩为先规则',
    description:
      '壬水生巳月，火旺水弱，传统常先取壬水比肩扶助，再取辛庚发源，不宜直接泛化为金印为先。',
    priority: 117,
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '壬水巳月，先取比肩扶助元神',
  },
];
