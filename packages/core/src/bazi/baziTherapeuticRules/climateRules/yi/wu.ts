import type { ClimateRule } from '../../types';

export const YI_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-yi-mangzhong-metal-water-fire-first',
    label: '乙日午月上半月金水重丙先规则',
    description: '乙木生午月上半月，本宜癸润；若原局金水偏多，则传统改以丙火为先，免金寒水冷困木。',
    months: ['午'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    currentJieqi: ['芒种'],
    minWuxingCounts: { 金: 2, 水: 2 },
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木午月上半月而金水偏多，丙火为先',
  },
  {
    id: 'wu-month-yi-xiazhi-bing-gui',
    label: '乙日午月下半月丙癸齐用规则',
    description: '乙木生午月下半月，传统以丙癸齐用，不应仍停留在单取癸水。',
    months: ['午'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    currentJieqi: ['夏至'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    hint: '乙木午月下半月，丙癸齐用',
  },
];
