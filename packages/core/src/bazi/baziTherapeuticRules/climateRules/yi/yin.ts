import type { ClimateRule } from '../../types';

export const YI_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-yi-bing-gui',
    label: '乙日寅月先丙后癸规则',
    description: '乙木生寅月，初春仍寒，传统以丙火为先、癸水次之，使柔木得暖而不枯。',
    months: ['寅'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木寅月，先丙后癸',
  },
];
