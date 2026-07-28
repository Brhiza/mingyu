import type { ClimateRule } from '../../types';

export const JIA_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-jia-bing-gui',
    label: '甲日寅月丙癸并用规则',
    description:
      '甲木生寅月，初春余寒未尽，传统多取丙火为先、癸水次之，先暖后润，较泛化春木先火更细。',
    months: ['寅'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '甲木寅月，先丙后癸，温扶兼滋养',
  },
];
