import type { ClimateRule } from '../../types';

export const WU_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-wu-gui-bing-first',
    label: '戊日午月先壬后甲规则',
    description:
      '戊土生午月，夏燥正盛，《穷通宝鉴》以壬水润燥为先、甲木疏土为佐，戊土高燥喜壬不喜癸。',
    priority: 120,
    months: ['午'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    hint: '戊土午月，先壬后甲',
  },
  {
    id: 'wu-month-wu-ren-jia-both-visible',
    label: '戊日午月壬甲齐透取用规则',
    description: '戊土生午月，壬水润燥与甲木疏土齐透，原文先壬后甲，明列壬甲两透。',
    priority: 126,
    months: ['午'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['壬', '甲'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用条件:壬甲齐透'],
    hint: '戊土午月壬甲两透，先壬后甲',
  },
];
