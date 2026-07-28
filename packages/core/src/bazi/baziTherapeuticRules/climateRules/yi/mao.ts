import type { ClimateRule } from '../../types';

export const YI_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-yi-bing-gui',
    label: '乙日卯月丙癸君臣规则',
    description: '乙木生卯月，传统取丙为君、癸为臣，先泄秀后滋养，不宜只按春木泛论。',
    months: ['卯'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木卯月，丙为君，癸为臣',
  },
];
