import type { ClimateRule } from '../../types';

export const YI_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-yi-bing-only',
    label: '乙日丑月专取丙火规则',
    description: '乙木生丑月，木寒宜丙，传统有寒谷回春之象，专以丙火为用，不宜只落到泛化冬木调候。',
    priority: 121,
    months: ['丑'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: '乙木丑月，专取丙火',
  },
];
