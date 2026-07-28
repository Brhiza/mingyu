import type { ClimateRule } from '../../types';

export const REN_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-ren-water-self-support',
    label: '壬日巳月比肩为先规则',
    description:
      '壬水生巳月，火旺水弱，传统常先取壬水比肩扶助，再取辛庚发源，不宜直接泛化为金印为先。',
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '壬水巳月，先取比肩扶助元神',
  },
  {
    id: 'si-month-ren-bing-jia-first',
    label: '壬日巳月先丙后甲规则',
    description: '壬水生巳月，火旺水弱，传统多先取丙火调候，次甲木疏通，较单用比肩更完整。',
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '壬水巳月，先丙后甲',
  },
  {
    id: 'si-month-ren-bing-jia-xin-all',
    label: '壬日巳月丙甲辛全透极品规则',
    description: '壬水生巳月，丙甲辛三者全透，较合原文"壬水生巳月，三者全透，鼎甲可期"。',
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['丙', '甲', '辛'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '金'],
    traceHints: ['取用层次:丙甲辛三者全透', '成格层次:鼎甲可期'],
    hint: '壬水巳月丙甲辛三者全透，鼎甲可期',
  },
];
